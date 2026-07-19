import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"
import { requireMotoboy, requireLoja, requireAdmin, getSession, unauthorized } from "@/lib/session"
import { checkRateLimit } from "@/lib/rate-limit"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

// Mensagens para o cliente (sobre seu pedido)
const STATUS_MSG_CLIENTE: Record<string, { title: string; body: string }> = {
  aceito:          { title: "✅ Pedido confirmado!", body: "Sua loja confirmou o pedido. Está sendo preparado." },
  preparando:      { title: "👨‍🍳 Preparando seu pedido", body: "A loja está preparando seu pedido agora." },
  pronto:          { title: "📦 Pedido pronto!", body: "Aguardando o motoboy para coleta." },
  aguardando_aceite: { title: "🛵 Motoboy a caminho!", body: "Um motoboy está indo buscar seu pedido." },
  indo_para_loja:  { title: "🛵 Motoboy a caminho!", body: "Um motoboy está indo buscar seu pedido." },
  na_loja:         { title: "📦 Motoboy na loja", body: "O motoboy está coletando seu pedido agora." },
  em_rota:         { title: "🚀 Saiu para entrega!", body: "O motoboy está a caminho. Aguarde!" },
  coletado:        { title: "🛵 Saiu para entrega!", body: "O motoboy está a caminho. Aguarde!" },
  cheguei:         { title: "🛵 Seu pedido chegou!", body: "O motoboy está na sua porta. Vá buscar!" },
  entregue:        { title: "🎉 Pedido entregue!", body: "Aproveite! Que tal avaliar seu pedido?" },
  cancelado:       { title: "❌ Pedido cancelado", body: "Seu pedido foi cancelado. Entre em contato com a loja." },
}

function initVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
}

async function sendPush(subscription: any, payload: object) {
  await webpush.sendNotification(subscription, JSON.stringify(payload))
}

// Envia para todos os dispositivos do motoboy (array ou objeto legado)
async function sendPushToAll(
  raw: any,
  payload: object,
  onExpired?: (endpoint: string) => void
): Promise<void> {
  const subs: any[] = Array.isArray(raw) ? raw : raw ? [raw] : []
  await Promise.allSettled(
    subs.map(async sub => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload))
      } catch (err: any) {
        if (err.statusCode === 410 && onExpired) onExpired(sub.endpoint)
      }
    })
  )
}

export async function POST(req: NextRequest) {
  initVapid()
  const body = await req.json()
  const { action } = body

  // ── Salvar subscription do cliente (pedido) — exige token secreto do pedido ─
  if (action === "subscribe") {
    const { pedido_id, subscription, cliente_push_token } = body
    if (!pedido_id || !subscription || !cliente_push_token) {
      return NextResponse.json({ error: "pedido_id, subscription e cliente_push_token obrigatórios" }, { status: 400 })
    }
    // Valida que o token pertence ao pedido (gerado server-side ao criar o pedido)
    const { data: pedido } = await supabaseAdmin
      .from("pedidos")
      .select("id, cliente_push_token")
      .eq("id", pedido_id)
      .eq("cliente_push_token", cliente_push_token)
      .single()
    if (!pedido) {
      return NextResponse.json({ error: "Token inválido." }, { status: 403 })
    }
    await supabaseAdmin.from("pedidos").update({ push_subscription: subscription }).eq("id", pedido_id)
    return NextResponse.json({ ok: true })
  }

  // ── Salvar subscription do motoboy — requer sessão motoboy ──────────────────
  if (action === "subscribe-motoboy") {
    const _sess = requireMotoboy(req)
    if (!_sess) return unauthorized()
    const { subscription } = body
    if (!subscription) {
      return NextResponse.json({ error: "subscription obrigatório" }, { status: 400 })
    }
    // Acumula subscriptions (suporte multi-dispositivo) — máx 5, sem duplicatas de endpoint
    const { data: mb } = await supabaseAdmin
      .from("motoboys").select("push_subscription").eq("id", _sess.motoboy_id).single()
    const existentes: any[] = Array.isArray(mb?.push_subscription)
      ? mb.push_subscription
      : mb?.push_subscription ? [mb.push_subscription] : []
    const semDup = existentes.filter((s: any) => s?.endpoint !== subscription.endpoint)
    const novaLista = [...semDup, subscription].slice(-5)
    const { error } = await supabaseAdmin
      .from("motoboys")
      .update({ push_subscription: novaLista })
      .eq("id", _sess.motoboy_id)
    if (error) return NextResponse.json({ ok: false, error: error.message })
    return NextResponse.json({ ok: true })
  }

  // ── Salvar subscription da loja — requer sessão loja ────────────────────────
  if (action === "subscribe-loja") {
    const _sess = requireLoja(req)
    if (!_sess) return unauthorized()
    const { subscription } = body
    if (!subscription) {
      return NextResponse.json({ error: "subscription obrigatório" }, { status: 400 })
    }
    const { error } = await supabaseAdmin
      .from("lojas")
      .update({ push_subscription: subscription })
      .eq("id", _sess.loja_id)
    if (error) return NextResponse.json({ ok: false, error: error.message })
    return NextResponse.json({ ok: true })
  }

  // ── Enviar notificação à loja (novo pedido) ──────────────────────────────────
  // Aceita: (a) x-internal-secret igual ao CRON_SECRET (calls server-side),
  //      ou (b) rate limit por IP (call do checkout client-side)
  if (action === "send-loja") {
    const internalSecret = req.headers.get("x-internal-secret")
    const isInternal = internalSecret && internalSecret === process.env.CRON_SECRET
    if (!isInternal) {
      const rateLimited = checkRateLimit(req)
      if (rateLimited) return rateLimited
    }

    const { loja_id, pedido_id, codigo, nome_cliente, total, qtd_itens } = body
    if (!loja_id) {
      return NextResponse.json({ error: "loja_id obrigatório" }, { status: 400 })
    }

    const { data: loja } = await supabaseAdmin
      .from("lojas")
      .select("push_subscription")
      .eq("id", loja_id)
      .single()

    if (!loja?.push_subscription) {
      return NextResponse.json({ ok: true, skipped: "no subscription" })
    }

    const qtd = Number(qtd_itens ?? 1)
    try {
      await sendPush(loja.push_subscription, {
        title: `Novo pedido #${codigo}!`,
        body:  `${nome_cliente} · ${qtd} item${qtd !== 1 ? "s" : ""} · R$ ${Number(total).toFixed(2)}`,
        tag:   `pedido-loja-${pedido_id}`,
        url:   "/loja",
        requireInteraction: true,
      })
      return NextResponse.json({ ok: true })
    } catch (err: any) {
      if (err.statusCode === 410) {
        await supabaseAdmin.from("lojas").update({ push_subscription: null }).eq("id", loja_id)
      }
      return NextResponse.json({ ok: false, error: String(err.message) })
    }
  }

  // ── Demais ações de envio — requer sessão autenticada ────────────────────────
  if (!getSession(req)) return unauthorized()

  // ── Enviar notificação ao cliente (pedido) — loja ou motoboy ─────────────────
  if (action === "send") {
    const { pedido_id, status, codigo } = body
    if (!pedido_id || !status) {
      return NextResponse.json({ error: "pedido_id e status obrigatórios" }, { status: 400 })
    }
    let msg = STATUS_MSG_CLIENTE[status]
    if (!msg) return NextResponse.json({ ok: true, skipped: true })

    const { data: pedido } = await supabaseAdmin
      .from("pedidos").select("push_subscription, endereco_entrega").eq("id", pedido_id).single()

    if (!pedido?.push_subscription) {
      return NextResponse.json({ ok: true, skipped: "no subscription" })
    }

    // Para retirada, ajusta mensagem de "pronto" e "entregue"
    const isRetirada = pedido.endereco_entrega?.includes("Retirada") ?? false
    if (isRetirada && status === "pronto") {
      msg = { title: "🏪 Pedido pronto para retirada!", body: "Seu pedido está pronto. Pode vir buscar na loja!" }
    } else if (isRetirada && status === "entregue") {
      msg = { title: "✅ Retirada confirmada!", body: "Obrigado! Seu pedido foi retirado com sucesso." }
    }

    const isCheguei = status === "cheguei"
    try {
      await sendPush(pedido.push_subscription, {
        title: msg.title, body: msg.body,
        tag:   isCheguei ? `cheguei-${pedido_id}` : `pedido-${pedido_id}`,
        url:   `/pedido/${codigo}`,
      })
      return NextResponse.json({ ok: true })
    } catch (err: any) {
      if (err.statusCode === 410) {
        await supabaseAdmin.from("pedidos").update({ push_subscription: null }).eq("id", pedido_id)
      }
      return NextResponse.json({ ok: false, error: String(err.message) })
    }
  }

  // ── Enviar notificação ao motoboy — somente admin ────────────────────────────
  if (action === "send-motoboy") {
    if (!requireAdmin(req)) return unauthorized()
    const { motoboy_id, title, body: msgBody, url } = body
    if (!motoboy_id) {
      return NextResponse.json({ error: "motoboy_id obrigatório" }, { status: 400 })
    }

    const { data: motoboy } = await supabaseAdmin
      .from("motoboys").select("push_subscription").eq("id", motoboy_id).single()

    if (!motoboy?.push_subscription) {
      return NextResponse.json({ ok: true, skipped: "no subscription" })
    }

    const expiredEndpoints: string[] = []
    await sendPushToAll(
      motoboy.push_subscription,
      {
        title: title ?? "Nova corrida disponível!",
        body:  msgBody ?? "Você recebeu uma nova oferta de entrega.",
        tag:   `motoboy-${motoboy_id}`,
        url:   url ?? "/motoboy",
        requireInteraction: true,
      },
      ep => expiredEndpoints.push(ep)
    )
    // Remove subscriptions expiradas
    if (expiredEndpoints.length > 0) {
      const { data: fresh } = await supabaseAdmin.from("motoboys").select("push_subscription").eq("id", motoboy_id).single()
      const subs: any[] = Array.isArray(fresh?.push_subscription) ? fresh.push_subscription : fresh?.push_subscription ? [fresh.push_subscription] : []
      const filtradas = subs.filter((s: any) => !expiredEndpoints.includes(s?.endpoint))
      await supabaseAdmin.from("motoboys").update({ push_subscription: filtradas.length ? filtradas : null }).eq("id", motoboy_id)
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "action inválida" }, { status: 400 })
}
