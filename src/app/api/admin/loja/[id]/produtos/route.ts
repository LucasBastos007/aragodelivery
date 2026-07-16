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

// GET — lista produtos de uma loja
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return unauthorized()
  const { id: loja_id } = await params
  const sb = adminClient()
  const { data, error } = await sb
    .from("produtos")
    .select("*")
    .eq("loja_id", loja_id)
    .order("criado_em")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — insert ou update
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return unauthorized()
  const { id: loja_id } = await params
  const body = await req.json()
  const { id, loja_id: _ignored, ...dados } = body
  const sb = adminClient()

  if (id) {
    const { error } = await sb.from("produtos").update(dados).eq("id", id).eq("loja_id", loja_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await sb.from("produtos").insert({ loja_id, ...dados })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE — remove por id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return unauthorized()
  const { id: loja_id } = await params
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })

  const { error } = await adminClient().from("produtos").delete().eq("id", id).eq("loja_id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH — toggle disponivel
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return unauthorized()
  const { id: loja_id } = await params
  const { id, disponivel } = await req.json()
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })

  const { error } = await adminClient().from("produtos").update({ disponivel }).eq("id", id).eq("loja_id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
