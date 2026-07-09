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

export async function POST(req: NextRequest) {
  const _sess = requireMotoboy(req)
  if (!_sess) return unauthorized()
  const motoboy_id = _sess.motoboy_id

  const { lat, lng } = await req.json()
  if (lat == null || lng == null) {
    return NextResponse.json({ error: "lat e lng obrigatórios" }, { status: 400 })
  }

  const { error } = await adminClient()
    .from("motoboys")
    .update({ lat, lng })
    .eq("id", motoboy_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Broadcast via Supabase Realtime HTTP — sem WebSocket, funciona em serverless
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      "apikey":        serviceKey,
    },
    body: JSON.stringify({
      messages: [{ topic: `motoboy-loc-${motoboy_id}`, event: "location", payload: { lat, lng } }],
    }),
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
