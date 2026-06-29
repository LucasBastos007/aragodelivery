import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })
  const sb = adminClient()
  const { data } = await sb.from("cupons").select("usos").eq("id", id).single()
  if (!data) return NextResponse.json({ error: "cupom não encontrado" }, { status: 404 })
  await sb.from("cupons").update({ usos: (data.usos ?? 0) + 1 }).eq("id", id)
  return NextResponse.json({ ok: true })
}
