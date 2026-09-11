import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/session"

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { pedido_id } = await req.json()
  if (!pedido_id) return NextResponse.json({ error: "pedido_id obrigatório" }, { status: 400 })

  await admin.from("itens_pedido").delete().eq("pedido_id", pedido_id)
  await admin.from("reembolsos").delete().eq("pedido_id", pedido_id)

  const { error } = await admin.from("pedidos").delete().eq("id", pedido_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
