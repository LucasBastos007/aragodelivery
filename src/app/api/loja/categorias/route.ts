import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const _sess = requireLoja(req)
  if (!_sess) return unauthorized()
  const sessLojaId = _sess.loja_id

  const { nome, ordem } = await req.json()
  const loja_id = sessLojaId
  if (!loja_id || !nome) return NextResponse.json({ error: "loja_id e nome obrigatórios" }, { status: 400 })

  const { error } = await adminClient().from("categorias_produto").insert({ loja_id, nome: nome.trim(), ordem })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const _sess = requireLoja(req)
  if (!_sess) return unauthorized()
  const sessLojaId = _sess.loja_id

  const { id, nome, foto_url } = await req.json()
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (nome !== undefined) updates.nome = nome.trim()
  if (foto_url !== undefined) updates.foto_url = foto_url || null

  const { error } = await adminClient()
    .from("categorias_produto")
    .update(updates)
    .eq("id", id)
    .eq("loja_id", sessLojaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const _sess = requireLoja(req)
  if (!_sess) return unauthorized()
  const sessLojaId = _sess.loja_id

  const { id } = await req.json()
  const loja_id = sessLojaId
  if (!id || !loja_id) return NextResponse.json({ error: "id e loja_id obrigatórios" }, { status: 400 })

  const { error } = await adminClient().from("categorias_produto").delete().eq("id", id).eq("loja_id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
