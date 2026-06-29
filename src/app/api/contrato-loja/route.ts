import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { enviarBoasVindasLoja } from "@/lib/email"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
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

// POST /api/contrato-loja — salva assinatura e muda status para contrato_assinado (não ativa direto)
export async function POST(req: NextRequest) {
  const { token, assinatura } = await req.json()
  if (!token || !assinatura) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 })

  const client = adminClient()

  const { data: loja, error: findErr } = await client
    .from("lojas")
    .select("id, nome, email, contrato_token_expira_em, contrato_assinado")
    .eq("contrato_token", token)
    .single()

  if (findErr || !loja) return NextResponse.json({ error: "Token inválido." }, { status: 404 })

  // Rejeita token expirado (se o campo existir)
  if (loja.contrato_token_expira_em && new Date(loja.contrato_token_expira_em) < new Date()) {
    return NextResponse.json({ error: "Link de contrato expirado. Solicite um novo link." }, { status: 410 })
  }

  // Impede re-assinatura
  if (loja.contrato_assinado) {
    return NextResponse.json({ error: "Contrato já assinado anteriormente." }, { status: 409 })
  }

  const { error } = await client.from("lojas").update({
    contrato_assinatura: assinatura,
    contrato_assinado: true,
    contrato_assinado_em: new Date().toISOString(),
    status: "contrato_assinado", // admin ativa manualmente depois
  }).eq("id", loja.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Não enviamos credenciais por e-mail aqui — admin notifica após ativar
  return NextResponse.json({ ok: true })
}
