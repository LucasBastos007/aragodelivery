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

// POST — insert ou update
export async function POST(req: NextRequest) {
  const _sess = requireLoja(req)
  if (!_sess) return unauthorized()
  const sessLojaId = _sess.loja_id

  const body = await req.json()
  const { id, ...dados } = body
  const loja_id = sessLojaId

  if (!loja_id) return NextResponse.json({ error: "loja_id obrigatório" }, { status: 400 })

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
export async function DELETE(req: NextRequest) {
  const _sess = requireLoja(req)
  if (!_sess) return unauthorized()
  const sessLojaId = _sess.loja_id

  const { id } = await req.json()
  const loja_id = sessLojaId
  if (!id || !loja_id) return NextResponse.json({ error: "id e loja_id obrigatórios" }, { status: 400 })

  const { error } = await adminClient().from("produtos").delete().eq("id", id).eq("loja_id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH — toggle disponivel
export async function PATCH(req: NextRequest) {
  const _sess = requireLoja(req)
  if (!_sess) return unauthorized()
  const sessLojaId = _sess.loja_id

  const { id, disponivel } = await req.json()
  const loja_id = sessLojaId
  if (!id || !loja_id) return NextResponse.json({ error: "id e loja_id obrigatórios" }, { status: 400 })

  const { error } = await adminClient().from("produtos").update({ disponivel }).eq("id", id).eq("loja_id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
