import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { enviarBoasVindasLoja } from "@/lib/email"

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// GET /api/contrato-loja?token=xxx — carrega loja pelo token
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (!token) return NextResponse.json({ error: "Token obrigatório." }, { status: 400 })

  const { data, error } = await adminClient()
    .from("lojas")
    .select("id, nome, categoria, endereco, nome_responsavel, cnpj, cpf_responsavel, contrato_assinado")
    .eq("contrato_token", token)
    .single()

  if (error || !data) return NextResponse.json({ error: "Link inválido ou expirado." }, { status: 404 })
  return NextResponse.json(data)
}

// POST /api/contrato-loja — salva assinatura e ativa status
export async function POST(req: NextRequest) {
  const { token, assinatura } = await req.json()
  if (!token || !assinatura) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 })

  const client = adminClient()

  const { data: loja, error: findErr } = await client
    .from("lojas")
    .select("id, nome, email, senha")
    .eq("contrato_token", token)
    .single()

  if (findErr || !loja) return NextResponse.json({ error: "Token inválido." }, { status: 404 })

  const { error } = await client.from("lojas").update({
    contrato_assinatura: assinatura,
    contrato_assinado: true,
    contrato_assinado_em: new Date().toISOString(),
    status: "ativo",
  }).eq("id", loja.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (loja.email) {
    enviarBoasVindasLoja({
      nome: loja.nome,
      email: loja.email,
      senha: loja.senha ?? "",
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
