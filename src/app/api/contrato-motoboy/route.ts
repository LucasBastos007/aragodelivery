import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { enviarBoasVindasMotoboy } from "@/lib/email"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const { token, assinatura, selfieContratoUrl } = await req.json()
  if (!token || !assinatura) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 })

  const client = adminClient()

  const { data: motoboy, error: findErr } = await client
    .from("motoboys")
    .select("id, nome, email, senha")
    .eq("contrato_token", token)
    .single()

  if (findErr || !motoboy) return NextResponse.json({ error: "Token inválido." }, { status: 404 })

  const { error } = await client.from("motoboys").update({
    contrato_assinatura: assinatura,
    contrato_assinado: true,
    contrato_assinado_em: new Date().toISOString(),
    status: "ativo",
    ...(selfieContratoUrl ? { selfie_contrato: selfieContratoUrl } : {}),
  }).eq("id", motoboy.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Envia email de boas-vindas em background (não bloqueia resposta)
  if (motoboy.email) {
    enviarBoasVindasMotoboy({
      nome: motoboy.nome,
      email: motoboy.email,
      senha: motoboy.senha ?? "",
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
