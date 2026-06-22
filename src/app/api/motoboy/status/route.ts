import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Atualiza disponivel e/ou raio_km do motoboy via admin client (bypassa RLS)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { motoboy_id, disponivel, raio_km } = body

  if (!motoboy_id) {
    return NextResponse.json({ error: "motoboy_id obrigatório" }, { status: 400 })
  }

  const updates: Record<string, unknown> = { last_seen: new Date().toISOString() }
  if (disponivel !== undefined) updates.disponivel = disponivel
  if (raio_km    !== undefined) updates.raio_km    = raio_km

  const { error } = await adminClient()
    .from("motoboys")
    .update(updates)
    .eq("id", motoboy_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
