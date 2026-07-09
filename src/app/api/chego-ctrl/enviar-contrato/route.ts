import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/session"
import { enviarContratoLoja } from "@/lib/email"

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { loja_id } = await req.json()
  if (!loja_id) return NextResponse.json({ error: "loja_id obrigatório" }, { status: 400 })

  const { data: loja, error } = await admin
    .from("lojas")
    .select("id, nome, email, contrato_token")
    .eq("id", loja_id)
    .single()

  if (error || !loja) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 })
  if (!loja.email) return NextResponse.json({ error: "Loja sem e-mail cadastrado" }, { status: 400 })
  if (!loja.contrato_token) return NextResponse.json({ error: "Gere o contrato primeiro" }, { status: 400 })

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://chegodelivery.com"
  const linkContrato = `${base}/contrato/loja/${loja.contrato_token}`
  const linkPdf = `${base}/api/chego-ctrl/contrato?tipo=loja&id=${loja.id}&modo=preview`

  await enviarContratoLoja({
    nome: loja.nome,
    email: loja.email,
    linkContrato,
    linkPdf,
  })

  return NextResponse.json({ ok: true })
}
