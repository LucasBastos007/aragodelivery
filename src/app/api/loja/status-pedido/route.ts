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
    sb.from("lojas").select("nome").eq("id", loja_id).single(),
    sb.from("motoboys").select("id, push_subscription").eq("disponivel", true).eq("status", "ativo"),
  ])
  if (!motoboys || motoboys.length === 0 || !initVapid()) return

  const payload = JSON.stringify({
    title: "🍳 Novo pedido em preparo",
    body:  `${loja?.nome ?? "Uma loja"} aceitou o pedido #${codigo} — fique de olho, avisamos quando estiver pronto pra retirada.`,
    tag:   `pedido-aceito-${pedido_id}`,
    url:   "/motoboy/pedidos",
  })

  const expiredPorMotoboy: Record<string, string[]> = {}
  await Promise.allSettled(
    motoboys.flatMap((m: any) => {
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

  // Busca pedido antes para ter o asaas_payment_id e status atual
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
    extras.cancelado_por = "loja"
    extras.motivo_cancelamento = motivo_cancelamento ?? "outro"
    if (motivo_outro) extras.motivo_outro = motivo_outro
  }

  const { data, error } = await sb
    .from("pedidos")
    .update({ status, ...extras })
    .eq("id", pedido_id)
    .eq("loja_id", loja_id)
    .select("id, codigo, status")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Avisa motoboys disponíveis assim que a loja aceita — não trava a resposta pro lojista
  if (status === "aceito" && !pedidoAtual.endereco_entrega?.includes("Retirada")) {
    avisarMotoboysPedidoAceito(sb, pedido_id, pedidoAtual.codigo, loja_id).catch(() => {})
  }

  // Estorno automático ao cancelar pedidos pagos via PIX ou cartão
  if (status === "cancelado" && pedidoAtual.asaas_payment_id) {
    const pid = pedidoAtual.asaas_payment_id
    const statusAtual = pedidoAtual.status
    try {
      // Se ainda não confirmado → cancela. Se já pago → estorna.
      if (statusAtual === "aguardando_pagamento") {
        await cancelarPagamento(pid)
      } else {
        await estornarPagamento(pid)
      }
    } catch (e) {
      console.error("[estorno] falha:", e)
    }
  }

  return NextResponse.json({ ok: true, pedido: data?.[0] })
}
