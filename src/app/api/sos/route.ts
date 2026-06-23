import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireMotoboy, requireAdmin, unauthorized } from "@/lib/session"

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const VAPID_EMAIL  = process.env.VAPID_EMAIL          ?? "mailto:admin@chegodelivery.com"
const VAPID_PUB    = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY  ?? ""
const VAPID_PRIV   = process.env.VAPID_PRIVATE_KEY    ?? ""

export async function POST(req: NextRequest) {
  const _sess = requireMotoboy(req)
  if (!_sess) return unauthorized()
  const motoboy_id = _sess.motoboy_id

  const { pedido_id, lat, lng } = await req.json()

  // Save alert with service role (bypasses RLS)
  await sb.from("alertas_sos").insert({
    motoboy_id,
    pedido_id: pedido_id || null,
    lat, lng,
    status: "pendente",
    criado_em: new Date().toISOString(),
  })

  // Fetch motoboy name for the push message
  const { data: mb } = await sb.from("motoboys").select("nome").eq("id", motoboy_id).single()

  // Send push to all registered admin subscriptions
  try {
    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("subscription")
      .eq("tipo", "admin")

    if (subs && subs.length > 0 && VAPID_PUB && VAPID_PRIV) {
      const wp = await import("web-push")
      wp.setVapidDetails(VAPID_EMAIL, VAPID_PUB, VAPID_PRIV)

      const coordsText = lat && lng
        ? ` · GPS: ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`
        : ""

      const payload = JSON.stringify({
        title: "🚨 SOS — Emergência!",
        body: `${mb?.nome ?? "Motoboy"} acionou o SOS${coordsText}`,
        requireInteraction: true,
        tag: "sos-admin",
        url: "/admin/pedidos",
        vibrate: [500, 200, 500, 200, 500, 200, 800],
      })

      await Promise.allSettled(
        subs.map((s: any) => wp.sendNotification(s.subscription, payload))
      )
    }
  } catch {}

  return NextResponse.json({ ok: true })
}

// Admin registers their push subscription
export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()

  const { subscription } = await req.json()
  if (!subscription) return NextResponse.json({ error: "missing subscription" }, { status: 400 })

  // Upsert based on endpoint to avoid duplicates
  await sb.from("push_subscriptions").upsert(
    { tipo: "admin", subscription, endpoint: (subscription as any).endpoint },
    { onConflict: "endpoint" }
  )

  return NextResponse.json({ ok: true })
}
