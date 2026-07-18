import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"
import { getSession, unauthorized } from "@/lib/session"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
  const sess = getSession(req)
  if (sess?.role !== "admin") return unauthorized()

  const { motoboy_id } = await req.json()
  if (!motoboy_id) return NextResponse.json({ error: "motoboy_id obrigatório" }, { status: 400 })

  const { data: m } = await supabase
    .from("motoboys")
    .select("id, nome, push_subscription")
    .eq("id", motoboy_id)
    .single()

  if (!m) return NextResponse.json({ error: "motoboy não encontrado" }, { status: 404 })

  if (!m.push_subscription) {
    return NextResponse.json({ error: "Motoboy sem push subscription registrada" }, { status: 422 })
  }

  if (!initVapid()) {
    return NextResponse.json({ error: "VAPID não configurado" }, { status: 500 })
  }

  const subs: any[] = Array.isArray(m.push_subscription) ? m.push_subscription : [m.push_subscription]

  const payload = JSON.stringify({
    title: "🔔 Teste de notificação",
    body:  "Isso é apenas um teste — nenhuma ação necessária.",
    tag:   "push-teste",
    url:   "/motoboy",
    requireInteraction: false,
  })

  const expiredEndpoints: string[] = []
  const results = await Promise.allSettled(
    subs.map(async sub => {
      try {
        await webpush.sendNotification(sub, payload)
        return "ok"
      } catch (e: any) {
        if (e.statusCode === 410) expiredEndpoints.push(sub.endpoint)
        throw e
      }
    })
  )

  // Limpa subscrições expiradas
  if (expiredEndpoints.length > 0) {
    const filtradas = subs.filter(s => !expiredEndpoints.includes(s?.endpoint))
    await supabase.from("motoboys")
      .update({ push_subscription: filtradas.length ? filtradas : null })
      .eq("id", motoboy_id)
  }

  const enviados = results.filter(r => r.status === "fulfilled").length
  const falhas   = results.filter(r => r.status === "rejected").length

  if (enviados === 0) {
    return NextResponse.json({ error: "Falha ao enviar — subscription pode estar expirada" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, enviados, falhas })
}
