import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import webpush from "web-push"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function initVapid() {
  try {
    if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        process.env.VAPID_EMAIL,
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      )
      return true
    }
  } catch {}
  return false
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()

  const { pedido_id, motoboy_id } = await req.json()
  if (!pedido_id || !motoboy_id) {
    return NextResponse.json({ error: "pedido_id e motoboy_id obrigatórios" }, { status: 400 })
  }

  const sb = adminClient()

  // Atualização atômica: só despacha se ainda estiver pronto e sem motoboy
  const { data, error } = await sb
    .from("pedidos")
    .update({ motoboy_id, status: "aguardando_aceite" })
    .eq("id", pedido_id)
    .eq("status", "pronto")
    .is("motoboy_id", null)
    .select("id, codigo, taxa_entrega")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Pedido já foi despachado ou não está disponível" }, { status: 409 })
  }

  const pedido = data[0]

  // Envia push para o motoboy acionado
  if (initVapid()) {
    const { data: motoboy } = await sb
      .from("motoboys")
      .select("push_subscription")
      .eq("id", motoboy_id)
      .single()

    if (motoboy?.push_subscription) {
      const subs: any[] = Array.isArray(motoboy.push_subscription)
        ? motoboy.push_subscription
        : [motoboy.push_subscription]

      const payload = JSON.stringify({
        title: "Nova corrida disponível!",
        body: `Pedido #${pedido.codigo} — R$ ${(pedido.taxa_entrega ?? 0).toFixed(2)}`,
        tag: "corrida-nova",
        url: "/motoboy",
        pedido_id,
        requireInteraction: true,
      })

      const expiradas: string[] = []
      await Promise.allSettled(
        subs.map(async (sub) => {
          try { await webpush.sendNotification(sub, payload) }
          catch (e: any) { if (e.statusCode === 410) expiradas.push(sub.endpoint) }
        })
      )

      if (expiradas.length > 0) {
        const filtradas = subs.filter(s => !expiradas.includes(s?.endpoint))
        await sb.from("motoboys")
          .update({ push_subscription: filtradas.length ? filtradas : null })
          .eq("id", motoboy_id)
      }
    }
  }

  return NextResponse.json({ ok: true, pedido })
}
