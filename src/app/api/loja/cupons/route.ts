import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// POST — criar cupom da loja
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { loja_id, codigo, tipo, valor, pedido_minimo, validade } = body
  if (!loja_id || !codigo || !tipo || valor == null) {
    return NextResponse.json({ error: "loja_id, codigo, tipo e valor são obrigatórios" }, { status: 400 })
  }
  const { data, error } = await adminClient().from("cupons").insert({
    codigo: String(codigo).toUpperCase().trim(),
    tipo, valor: Number(valor),
    loja_id,
    pedido_minimo: Number(pedido_minimo) || 0,
    validade: validade || null,
    ativo: true,
  }).select("id").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, id: data.id })
}

// PATCH — ativar/desativar (valida que pertence à loja)
export async function PATCH(req: NextRequest) {
  const { id, loja_id, ativo } = await req.json()
  if (!id || !loja_id) return NextResponse.json({ error: "id e loja_id obrigatórios" }, { status: 400 })
  const { error } = await adminClient().from("cupons").update({ ativo }).eq("id", id).eq("loja_id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — excluir (valida que pertence à loja)
export async function DELETE(req: NextRequest) {
  const { id, loja_id } = await req.json()
  if (!id || !loja_id) return NextResponse.json({ error: "id e loja_id obrigatórios" }, { status: 400 })
  const { error } = await adminClient().from("cupons").delete().eq("id", id).eq("loja_id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
