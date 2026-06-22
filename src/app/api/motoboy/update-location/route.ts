import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const { motoboy_id, lat, lng } = await req.json()
  if (!motoboy_id || lat == null || lng == null) {
    return NextResponse.json({ error: "motoboy_id, lat e lng obrigatórios" }, { status: 400 })
  }
  const { error } = await adminClient()
    .from("motoboys")
    .update({ lat, lng, last_seen: new Date().toISOString() })
    .eq("id", motoboy_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
