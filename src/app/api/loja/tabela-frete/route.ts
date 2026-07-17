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

export async function GET(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()

  const { data, error } = await adminClient()
    .from("tabela_frete")
    .select("municipio, taxa")
    .eq("loja_id", sess.loja_id)
    .order("municipio")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()

  const { municipio, taxa } = await req.json()
  if (!municipio || taxa == null) return NextResponse.json({ error: "municipio e taxa obrigatórios" }, { status: 400 })

  const { error } = await adminClient()
    .from("tabela_frete")
    .upsert({ loja_id: sess.loja_id, municipio: municipio.trim(), taxa: parseFloat(taxa) }, { onConflict: "loja_id,municipio" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()

  const { municipio } = await req.json()
  if (!municipio) return NextResponse.json({ error: "municipio obrigatório" }, { status: 400 })

  const { error } = await adminClient()
    .from("tabela_frete")
    .delete()
    .eq("loja_id", sess.loja_id)
    .eq("municipio", municipio.trim())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
