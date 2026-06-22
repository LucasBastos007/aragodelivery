import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const STATUS_VALIDOS = ["aceito", "preparando", "pronto", "cancelado"]

export async function POST(req: NextRequest) {
  const { pedido_id, status, loja_id } = await req.json()
  if (!pedido_id || !status || !loja_id) {
    return NextResponse.json({ error: "pedido_id, status e loja_id obrigatórios" }, { status: 400 })
  }
  if (!STATUS_VALIDOS.includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 })
  }

  const sb = adminClient()

  // Garante que o pedido pertence à loja antes de atualizar
  const { data, error } = await sb
    .from("pedidos")
    .update({ status })
    .eq("id", pedido_id)
    .eq("loja_id", loja_id)
    .select("id, codigo, status")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Pedido não encontrado ou não pertence à loja" }, { status: 404 })
  }

  return NextResponse.json({ ok: true, pedido: data[0] })
}
