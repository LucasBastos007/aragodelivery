import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUS_MSG: Record<string, { title: string; body: string }> = {
  aceito:     { title: "✅ Pedido confirmado!", body: "Sua loja confirmou o pedido. Está sendo preparado." },
  preparando: { title: "👨‍🍳 Preparando seu pedido", body: "A loja está preparando seu pedido agora." },
  pronto:     { title: "📦 Pedido pronto!", body: "Aguardando o motoboy para coleta." },
  coletado:   { title: "🛵 Saiu para entrega!", body: "O motoboy está a caminho. Aguarde!" },
  entregue:   { title: "🎉 Pedido entregue!", body: "Aproveite! Que tal avaliar seu pedido?" },
  cancelado:  { title: "❌ Pedido cancelado", body: "Seu pedido foi cancelado. Entre em contato com a loja." },
}

// POST /api/push — subscribe or send
export async function POST(req: NextRequest) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  const body = await req.json()
  const { action } = body

  if (action === "subscribe") {
    const { pedido_id, subscription } = body
    if (!pedido_id || !subscription) {
      return NextResponse.json({ error: "pedido_id e subscription obrigatórios" }, { status: 400 })
    }
    await supabaseAdmin.from("pedidos").update({ push_subscription: subscription }).eq("id", pedido_id)
    return NextResponse.json({ ok: true })
  }

  if (action === "send") {
    const { pedido_id, status, codigo } = body
    if (!pedido_id || !status) {
      return NextResponse.json({ error: "pedido_id e status obrigatórios" }, { status: 400 })
    }
    const msg = STATUS_MSG[status]
    if (!msg) return NextResponse.json({ ok: true, skipped: true })

    const { data: pedido } = await supabaseAdmin
      .from("pedidos")
      .select("push_subscription")
      .eq("id", pedido_id)
      .single()

    if (!pedido?.push_subscription) {
      return NextResponse.json({ ok: true, skipped: "no subscription" })
    }

    try {
      await webpush.sendNotification(
        pedido.push_subscription as any,
        JSON.stringify({
          title: msg.title,
          body:  msg.body,
          tag:   `pedido-${pedido_id}`,
          url:   `/pedido/${codigo}`,
        })
      )
      return NextResponse.json({ ok: true })
    } catch (err: any) {
      if (err.statusCode === 410) {
        // Subscription expirada — limpar
        await supabaseAdmin.from("pedidos").update({ push_subscription: null }).eq("id", pedido_id)
      }
      return NextResponse.json({ ok: false, error: String(err.message) })
    }
  }

  return NextResponse.json({ error: "action inválida" }, { status: 400 })
}
