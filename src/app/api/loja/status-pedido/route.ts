import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"
import { requireLoja, unauthorized } from "@/lib/session"
import { estornarPagamento, cancelarPagamento } from "@/lib/asaas"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dL = (lat2 - lat1) * Math.PI / 180
  const dG = (lng2 - lng1) * Math.PI / 180
  const a  = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dG/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function initVapid(): boolean {
  try {
    if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(process.env.VAPID_EMAIL, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
      return true
    }
  } catch {}
  return false
}

// Aviso prévio pros motoboys disponíveis assim que a loja ACEITA o pedido — antes de
// "pronto" e sem precisar a loja clicar em "Chamar motoboy" (isso continua existindo à
// parte, pra broadcast real da corrida). É só um "fique de olho", pra quem já tá de olho
// na aba Pedidos do app não ser pego de surpresa quando a corrida abrir de verdade.
async function avisarMotoboysPedidoAceito(sb: ReturnType<typeof adminClient>, pedido_id: string, codigo: string, loja_id: string) {
  const [{ data: loja }, { data: motoboys }] = await Promise.all([
    sb.from("lojas").select("nome, lat, lng").eq("id", loja_id).single(),
    sb.from("motoboys").select("id, push_subscription, lat, lng, raio_km").eq("disponivel", true).eq("status", "ativo"),
  ])
  if (!motoboys || motoboys.length === 0 || !initVapid()) return

  // Mesmo corte de raio do despacho ativo (escalada) — sem isso, um motoboy fora do
  // alcance recebe o "fique de olho" mas nunca é oferecida a corrida de verdade depois,
  // o que é confuso. Sem coordenada real da loja ou do motoboy, não filtra (mostra a todos).
  const RAIO_KM_DEFAULT = 12
  const lojaLat = loja?.lat, lojaLng = loja?.lng
  const candidatos = (lojaLat && lojaLng)
    ? motoboys.filter((m: any) => !m.lat || !m.lng || haversineKm(m.lat, m.lng, lojaLat, lojaLng) <= (m.raio_km ?? RAIO_KM_DEFAULT))
    : motoboys

  if (candidatos.length === 0) return

  const payload = JSON.stringify({
    title: "🍳 Novo pedido em preparo",
    body:  `${loja?.nome ?? "Uma loja"} aceitou o pedido #${codigo} — fique de olho, avisamos quando estiver pronto pra retirada.`,
    tag:   `pedido-aceito-${pedido_id}`,
    url:   "/motoboy/pedidos",
  })

  const expiredPorMotoboy: Record<string, string[]> = {}
  await Promise.allSettled(
    candidatos.flatMap((m: any) => {
      const subs: any[] = Array.isArray(m.push_subscription) ? m.push_subscription : m.push_subscription ? [m.push_subscription] : []
      return subs.map(async sub => {
        try {
          await webpush.sendNotification(sub, payload, { urgency: "normal" })
        } catch (e: any) {
          if (e.statusCode === 410) (expiredPorMotoboy[m.id] ??= []).push(sub.endpoint)
        }
      })
    })
  )
  for (const [motoboy_id, expiredEndpoints] of Object.entries(expiredPorMotoboy)) {
    const m = motoboys.find((x: any) => x.id === motoboy_id)
    if (!m) continue
    const subs: any[] = Array.isArray(m.push_subscription) ? m.push_subscription : m.push_subscription ? [m.push_subscription] : []
    const filtradas = subs.filter((s: any) => !expiredEndpoints.includes(s?.endpoint))
    await sb.from("motoboys").update({ push_subscription: filtradas.length ? filtradas : null }).eq("id", motoboy_id)
  }
}

const STATUS_VALIDOS = ["aceito", "preparando", "pronto", "entregue", "cancelado"]

const MOTIVOS_VALIDOS = [
  "produto_esgotado", "loja_ocupada", "timeout_aceite",
  "cliente_cancelou", "sem_entregador", "problema_pagamento", "outro",
]

// Status de origem esperado pra cada transição feita pela loja — mesmo princípio de
// idempotência aplicado em motoboy/avancar-etapa (2026-09-22): o UPDATE só mexe na
// linha se o pedido AINDA estiver no status de origem, então uma requisição
// duplicada/retry que chega depois que a transição já aconteceu não encontra nenhuma
// linha pra atualizar — nunca reescreve aceito_em/pronto_em/entregue_em com um
// timestamp novo, e nunca repete efeitos colaterais (push, aviso a motoboys, estorno).
// "cancelado" é tratado à parte (guarda abaixo) porque pode vir de vários status de
// origem diferentes, não só um.
const ORIGEM_ESPERADA: Partial<Record<string, string>> = {
  aceito: "pendente",
  preparando: "aceito",
  pronto: "preparando",
  // "entregue" por esta rota só é usado por confirmarRetirada() (retirada no balcão,
  // sem motoboy) — o botão só aparece com status "pronto" (ver src/app/loja/page.tsx).
  entregue: "pronto",
}

export async function POST(req: NextRequest) {
  const _sess = requireLoja(req)
  if (!_sess) return unauthorized()
  const sessLojaId = _sess.loja_id

  const { pedido_id, status, motivo_cancelamento, motivo_outro } = await req.json()
  const loja_id = sessLojaId
  if (!pedido_id || !status || !loja_id) {
    return NextResponse.json({ error: "pedido_id, status e loja_id obrigatórios" }, { status: 400 })
  }
  if (!STATUS_VALIDOS.includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 })
  }
  if (
    status === "cancelado" &&
    motivo_cancelamento &&
    !MOTIVOS_VALIDOS.includes(motivo_cancelamento)
  ) {
    return NextResponse.json({ error: "Motivo de cancelamento inválido" }, { status: 400 })
  }

  const sb = adminClient()

  // Busca pedido antes para ter o asaas_payment_id e status atual (decide cancelar vs
  // estornar) — leitura, não faz parte da condição atômica do UPDATE abaixo.
  const { data: pedidoAtual } = await sb
    .from("pedidos")
    .select("id, codigo, status, asaas_payment_id, forma_pagamento, endereco_entrega")
    .eq("id", pedido_id)
    .eq("loja_id", loja_id)
    .single()

  if (!pedidoAtual) {
    return NextResponse.json({ error: "Pedido não encontrado ou não pertence à loja" }, { status: 404 })
  }

  // Monta campos extras conforme o novo status
  const extras: Record<string, any> = {}
  if (status === "aceito") {
    extras.aceito_em = new Date().toISOString()
  } else if (status === "pronto") {
    extras.pronto_em = new Date().toISOString()
  } else if (status === "entregue") {
    extras.entregue_em = new Date().toISOString()
  } else if (status === "cancelado") {
    extras.cancelado_em = new Date().toISOString()
    extras.cancelado_por = "loja"
    extras.motivo_cancelamento = motivo_cancelamento ?? "outro"
    if (motivo_outro) extras.motivo_outro = motivo_outro
  }

  // UPDATE atômico com guarda de status de origem — é essa condição no WHERE (avaliada
  // pelo próprio Postgres, não em duas etapas leitura+escrita) que garante segurança
  // mesmo com duas requisições chegando quase ao mesmo tempo: só uma delas vai
  // encontrar a linha ainda no status de origem e efetivamente aplicar a mudança.
  let query = sb.from("pedidos").update({ status, ...extras }).eq("id", pedido_id).eq("loja_id", loja_id)
  if (status === "cancelado") {
    // Cancelamento pode vir de vários status de origem — a guarda aqui é "ainda não
    // finalizado" (não cancelado nem entregue), não um status único.
    query = query.not("status", "in", '("cancelado","entregue")')
  } else {
    const origem = ORIGEM_ESPERADA[status]
    if (origem) query = query.eq("status", origem)
  }

  const { data: atualizado, error } = await query.select("id, codigo, status").maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let jaProcessado = false
  if (!atualizado) {
    // Zero linhas afetadas: ou é retry idempotente (pedido já estava no status de
    // destino) ou é um conflito real (pedido pulou pra outro status enquanto isso).
    if (pedidoAtual.status === status) {
      jaProcessado = true
    } else {
      return NextResponse.json({ error: `Pedido está em status inesperado (${pedidoAtual.status}) para essa transição` }, { status: 409 })
    }
  }

  // Efeitos colaterais — só disparam na transição REAL, nunca em retry/duplo clique.
  if (!jaProcessado) {
    // Avisa motoboys disponíveis assim que a loja aceita — não trava a resposta pro lojista
    if (status === "aceito" && !pedidoAtual.endereco_entrega?.includes("Retirada")) {
      avisarMotoboysPedidoAceito(sb, pedido_id, pedidoAtual.codigo, loja_id).catch(() => {})
    }

    // Estorno automático ao cancelar pedidos pagos via PIX ou cartão — nunca pode
    // rodar duas vezes (dobraria o estorno de dinheiro real).
    if (status === "cancelado" && pedidoAtual.asaas_payment_id) {
      const pid = pedidoAtual.asaas_payment_id
      const statusAntesDoCancelamento = pedidoAtual.status
      try {
        // Se ainda não confirmado → cancela. Se já pago → estorna.
        if (statusAntesDoCancelamento === "aguardando_pagamento") {
          await cancelarPagamento(pid)
        } else {
          await estornarPagamento(pid)
        }
      } catch (e) {
        console.error("[estorno] falha:", e)
      }
    }
  }

  return NextResponse.json({ ok: true, pedido: atualizado ?? { id: pedidoAtual.id, codigo: pedidoAtual.codigo, status }, jaProcessado })
}
