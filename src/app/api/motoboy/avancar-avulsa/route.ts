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
  aceito:  "em_rota",
  em_rota: "entregue",
}

export async function POST(req: NextRequest) {
  const sess = requireMotoboy(req)
  if (!sess) return unauthorized()
  const motoboy_id = sess.motoboy_id

  const { avulsa_id, status_atual } = await req.json()
  if (!avulsa_id || !status_atual) {
    return NextResponse.json({ error: "avulsa_id e status_atual são obrigatórios" }, { status: 400 })
  }

  const nextStatus = NEXT_STATUS[status_atual as string]
  if (!nextStatus) return NextResponse.json({ error: "Status inválido" }, { status: 400 })

  const sb = adminClient()

  const updates: Record<string, any> = { status: nextStatus }

  const { error } = await sb
    .from("entregas_avulsas")
    .update(updates)
    .eq("id", avulsa_id)
    .eq("motoboy_id", motoboy_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, nextStatus })
}
