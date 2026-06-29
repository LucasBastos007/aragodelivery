import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { enviarBoasVindasMotoboy } from "@/lib/email"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const { token, assinatura, selfieContratoUrl } = await req.json()
  if (!token || !assinatura) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 })

  const client = adminClient()

  const { data: motoboy, error: findErr } = await client
    .from("motoboys")
    .select("id, nome, email, contrato_token_expira_em, contrato_assinado")
    .eq("contrato_token", token)
    .single()

  if (findErr || !motoboy) return NextResponse.json({ error: "Token inválido." }, { status: 404 })

  // Rejeita token expirado (se o campo existir)
  if (motoboy.contrato_token_expira_em && new Date(motoboy.contrato_token_expira_em) < new Date()) {
    return NextResponse.json({ error: "Link de contrato expirado. Solicite um novo link." }, { status: 410 })
  }

  // Impede re-assinatura
  if (motoboy.contrato_assinado) {
    return NextResponse.json({ error: "Contrato já assinado anteriormente." }, { status: 409 })
  }

  const { error } = await client.from("motoboys").update({
    contrato_assinatura: assinatura,
    contrato_assinado: true,
    contrato_assinado_em: new Date().toISOString(),
    status: "contrato_assinado", // admin ativa manualmente depois
    ...(selfieContratoUrl ? { selfie_contrato: selfieContratoUrl } : {}),
  }).eq("id", motoboy.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Não enviamos credenciais por e-mail aqui — admin notifica após ativar
  return NextResponse.json({ ok: true })
}
