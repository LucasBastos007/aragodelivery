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
  const sess = requireMotoboy(req)
  if (!sess) return unauthorized()
  const motoboy_id = sess.motoboy_id

  const { avulsa_id } = await req.json()
  if (!avulsa_id) return NextResponse.json({ error: "avulsa_id obrigatório" }, { status: 400 })

  const sb = adminClient()

  const { data, error } = await sb
    .from("entregas_avulsas")
    .update({ status: "aceito" })
    .eq("id", avulsa_id)
    .eq("motoboy_id", motoboy_id)
    .eq("status", "aguardando_aceite")
    .select("id, status")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: "Entrega não disponível" }, { status: 409 })

  return NextResponse.json({ ok: true })
}
