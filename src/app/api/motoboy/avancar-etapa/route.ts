import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireMotoboy, unauthorized } from "@/lib/session"
import { emitirNfcePedido } from "@/lib/emitir-nfce"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const NEXT_STATUS: Record<string, string> = {
  indo_para_loja: "na_loja",
  na_loja:        "em_rota",
  em_rota:        "entregue",
  coletado:       "entregue",
}

// Correção 2026-09-22 (achado da rodada anterior do Dashboard): esta rota tentava
// gravar `ganho_motoboy` junto com `status`/`entregue_em` num único UPDATE. Essa coluna
// NUNCA existiu em `pedidos` (confirmado pelo erro real do Postgres: "Could not find
// the 'ganho_motoboy' column ... in the schema cache") — o UPDATE inteiro falhava e um
// fallback silencioso salvava só o `status`, perdendo `entregue_em` em TODA entrega
// concluída. Auditoria confirmou que nada no projeto depende de pedidos.ganho_motoboy
// persistido: o único outro lugar que menciona a coluna
// (src/app/motoboy/historico/page.tsx) já tinha um comentário explícito dizendo que ela
// "tem histórico de valores gravados por caminhos divergentes e não é confiável",
// recalculando tudo via lib/comissao.ts::ganhoMotoboy(taxa_entrega, criado_em) — mesma
// fórmula usada em saldo a pagar, saques e relatórios. Por isso: removida do UPDATE, sem
// criar a coluna (decisão do usuário — ver relatório da rodada 3 do Dashboard).
export async function POST(req: NextRequest) {
  const _sess = requireMotoboy(req)
  if (!_sess) return unauthorized()
  const motoboy_id = _sess.motoboy_id

  const { pedido_id, status_atual } = await req.json()

  if (!pedido_id || !status_atual) {
    return NextResponse.json({ error: "pedido_id e status_atual são obrigatórios" }, { status: 400 })
  }

  const nextStatus = NEXT_STATUS[status_atual as string]
  if (!nextStatus) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 })
  }

  const sb = adminClient()

  const updates: Record<string, string> = { status: nextStatus }
  if (nextStatus === "em_rota") updates.coletado_em = new Date().toISOString()
  if (nextStatus === "entregue") updates.entregue_em = new Date().toISOString()

  // Guarda de idempotência: só aplica a transição se o pedido AINDA estiver no status
  // de origem esperado (`status_atual`, vindo do app do motoboy). Uma requisição
  // duplicada/retry que chega depois que a transição já aconteceu não encontra nenhuma
  // linha pra atualizar — nunca sobrescreve entregue_em/coletado_em com um timestamp
  // novo (spec seção 4: "13:20 entregue" não pode virar "13:27 entregue" por retry).
  const { data: atualizado, error } = await sb
    .from("pedidos")
    .update(updates)
    .eq("id", pedido_id)
    .eq("motoboy_id", motoboy_id)
    .eq("status", status_atual)
    .select("id, status")
    .maybeSingle()

  if (error) {
    // Falha real de persistência — nunca mais converter isso em "salvou status, deu
    // tudo certo" (spec seção 3). O app do motoboy recebe erro de verdade e pode tentar
    // de novo, em vez de achar que a entrega foi concluída sem o timestamp real.
    console.error("[avancar-etapa] falha ao persistir transição", { pedido_id, status_atual, nextStatus, erro: error.message })
    return NextResponse.json({ error: "Não foi possível atualizar o pedido: " + error.message }, { status: 500 })
  }

  let jaProcessado = false
  if (!atualizado) {
    // Zero linhas afetadas: ou é um retry idempotente (pedido já tinha avançado pro
    // status de destino) ou o pedido não existe/não pertence a este motoboy — os dois
    // casos recebem tratamento e mensagem diferentes.
    const { data: atual } = await sb.from("pedidos").select("status").eq("id", pedido_id).eq("motoboy_id", motoboy_id).maybeSingle()
    if (!atual) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    if (atual.status !== nextStatus) {
      return NextResponse.json({ error: `Pedido está em status inesperado (${atual.status}), esperava ${status_atual}` }, { status: 409 })
    }
    jaProcessado = true // já estava no status de destino — retorna sucesso sem repetir os efeitos colaterais abaixo
  }

  // Push ao cliente para coletado e entregue — só na transição real, nunca em retry.
  if (!jaProcessado && (nextStatus === "coletado" || nextStatus === "entregue")) {
    try {
      const { data: ped } = await sb.from("pedidos").select("codigo, push_subscription").eq("id", pedido_id).single()
      if (ped?.push_subscription) {
        const wp = await import("web-push")
        wp.setVapidDetails(
          process.env.VAPID_EMAIL!,
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          process.env.VAPID_PRIVATE_KEY!
        )
        const MSG: Record<string, { title: string; body: string }> = {
          coletado: { title: "🛵 Saiu para entrega!", body: "O motoboy está a caminho da sua casa!" },
          entregue: { title: "🎉 Pedido entregue!", body: "Aproveite! Que tal avaliar seu pedido?" },
        }
        const msg = MSG[nextStatus]
        if (msg) {
          await wp.sendNotification(
            ped.push_subscription,
            JSON.stringify({ title: msg.title, body: msg.body, tag: `pedido-${pedido_id}`, url: `/pedido/${ped.codigo}`, requireInteraction: nextStatus === "entregue" })
          ).catch(() => {})
        }
      }
    } catch {}
  }

  // Emissão automática de NFC-e ao entregar (não bloqueia a resposta se falhar) — só na
  // transição real, nunca em retry (evita tentar emitir a mesma nota duas vezes).
  if (!jaProcessado && nextStatus === "entregue") {
    emitirNfcePedido(pedido_id, sb).catch(e => console.error("[NFC-e auto]", e))
  }

  return NextResponse.json({ ok: true, nextStatus, jaProcessado })
}
