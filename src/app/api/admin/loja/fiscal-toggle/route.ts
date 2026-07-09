export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/session"

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// POST /api/admin/loja/fiscal-toggle
// Body: { loja_id, fiscal_ativo: boolean }
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { loja_id, fiscal_ativo } = await req.json()
  if (!loja_id || typeof fiscal_ativo !== "boolean") {
    return NextResponse.json({ error: "loja_id e fiscal_ativo (boolean) obrigatórios" }, { status: 400 })
  }

  const { error } = await sb().from("lojas").update({ fiscal_ativo }).eq("id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
