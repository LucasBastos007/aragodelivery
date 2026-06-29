import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireMotoboy, unauthorized } from "@/lib/session"

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

export async function POST(req: NextRequest) {
  const _sess = requireMotoboy(req)
  if (!_sess) return unauthorized()
  const motoboy_id = _sess.motoboy_id

  const { pedido_id, status_atual, taxa_entrega } = await req.json()

  if (!pedido_id || !status_atual) {
    return NextResponse.json({ error: "pedido_id e status_atual são obrigatórios" }, { status: 400 })
  }

  const nextStatus = NEXT_STATUS[status_atual as string]
  if (!nextStatus) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 })
  }

  const sb = adminClient()

  const updates: Record<string, any> = { status: nextStatus }
  if (nextStatus === "em_rota") {
    updates.coletado_em = new Date().toISOString()
  }
  if (nextStatus === "entregue") {
    updates.entregue_em = new Date().toISOString()
    if (taxa_entrega != null) updates.ganho_motoboy = taxa_entrega
  }

  const { error } = await sb
    .from("pedidos")
    .update(updates)
    .eq("id", pedido_id)
    .eq("motoboy_id", motoboy_id)

  if (error) {
    if (nextStatus === "entregue") {
      // Fallback: coluna ganho_motoboy ou entregue_em pode não existir
      const { error: e2 } = await sb
        .from("pedidos")
        .update({ status: nextStatus })
        .eq("id", pedido_id)
        .eq("motoboy_id", motoboy_id)
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    } else {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Push ao cliente para coletado e entregue
  if (nextStatus === "coletado" || nextStatus === "entregue") {
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

  return NextResponse.json({ ok: true, nextStatus })
}
