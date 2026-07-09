import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/session"

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { loja_id } = await req.json()
  if (!loja_id) return NextResponse.json({ error: "loja_id obrigatório" }, { status: 400 })

  await admin.from("mensalidades").delete().eq("loja_id", loja_id)
  await admin.from("pedidos").delete().eq("loja_id", loja_id)
  await admin.from("produtos").delete().eq("loja_id", loja_id)
  await admin.from("cupons").delete().eq("loja_id", loja_id)
  await admin.from("categorias").delete().eq("loja_id", loja_id)

  const { error } = await admin.from("lojas").delete().eq("id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
