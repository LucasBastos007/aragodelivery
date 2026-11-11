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

// Campos que a loja pode atualizar em si mesma. Desde 20/10/2026 o Perfil da loja salva por
// aqui (antes gravava direto do navegador). Taxa de entrega, plano, comissão, situação e senha
// ficam de fora de propósito: só o Chegô muda.
const CAMPOS_PERMITIDOS = [
  "aberto", "nome", "descricao", "categoria", "cep", "logradouro", "numero", "complemento", "bairro",
  "cidade", "estado", "endereco", "telefone", "tempo_min", "tempo_max", "nome_responsavel", "logo_url",
  "pix_key", "banco", "banco_agencia", "banco_conta", "banco_tipo_conta", "horarios", "lat", "lng",
] as const
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
  if ("aberto" in updates && typeof updates.aberto !== "boolean") return NextResponse.json({ error: "aberto inválido" }, { status: 400 })
  for (const k of ["lat", "lng"] as const) if (k in updates && updates[k] !== null && !Number.isFinite(Number(updates[k]))) return NextResponse.json({ error: `${k} inválido` }, { status: 400 })
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar" }, { status: 400 })
  }

  const { error } = await adminClient().from("lojas").update(updates).eq("id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
