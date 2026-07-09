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

// Atualiza disponivel e/ou raio_km do motoboy via admin client (bypassa RLS)
export async function POST(req: NextRequest) {
  const _sess = requireMotoboy(req)
  if (!_sess) return unauthorized()
  const motoboy_id = _sess.motoboy_id

  const body = await req.json()
  const { disponivel, raio_km } = body

  const updates: Record<string, unknown> = {}
  if (disponivel !== undefined) updates.disponivel = disponivel
  if (raio_km    !== undefined) updates.raio_km    = raio_km
  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true })

  const { error } = await adminClient()
    .from("motoboys")
    .update(updates)
    .eq("id", motoboy_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
