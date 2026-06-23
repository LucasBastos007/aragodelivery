import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Campos que a loja pode atualizar em si mesma
const CAMPOS_PERMITIDOS = ["aberto"] as const
type CampoPermitido = typeof CAMPOS_PERMITIDOS[number]

export async function POST(req: NextRequest) {
  const _sess = requireLoja(req)
  if (!_sess) return unauthorized()
  const sessLojaId = _sess.loja_id

  const { ...campos } = await req.json()
  const loja_id = sessLojaId
  if (!loja_id) return NextResponse.json({ error: "loja_id obrigatório" }, { status: 400 })

  const updates: Partial<Record<CampoPermitido, unknown>> = {}
  for (const k of CAMPOS_PERMITIDOS) {
    if (k in campos) updates[k] = campos[k]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar" }, { status: 400 })
  }

  const { error } = await adminClient().from("lojas").update(updates).eq("id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
