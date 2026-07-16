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

// GET — lista categorias de uma loja
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return unauthorized()
  const { id: loja_id } = await params
  const { data, error } = await adminClient()
    .from("categorias_produto")
    .select("*")
    .eq("loja_id", loja_id)
    .order("ordem")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — criar categoria
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return unauthorized()
  const { id: loja_id } = await params
  const { nome, ordem } = await req.json()
  if (!nome) return NextResponse.json({ error: "nome obrigatório" }, { status: 400 })

  const { error } = await adminClient()
    .from("categorias_produto")
    .insert({ loja_id, nome: nome.trim(), ordem })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — remove categoria por id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return unauthorized()
  const { id: loja_id } = await params
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })

  const { error } = await adminClient()
    .from("categorias_produto")
    .delete()
    .eq("id", id)
    .eq("loja_id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
