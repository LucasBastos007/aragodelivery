import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { requireAdmin } from "@/lib/session"
import { enviarCredenciaisLojista } from "@/lib/email"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Gera senha de 6 dígitos usando apenas os algarismos 1 a 6
function gerarSenhaTemp(): string {
  const digitos = "123456"
  let senha = ""
  for (let i = 0; i < 6; i++) {
    senha += digitos[Math.floor(Math.random() * digitos.length)]
  }
  return senha
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const { loja_id } = await req.json()
  if (!loja_id) return NextResponse.json({ error: "loja_id obrigatório." }, { status: 400 })

  const sb = adminClient()

  const { data: loja, error: findErr } = await sb
    .from("lojas")
    .select("id, nome, email, status")
    .eq("id", loja_id)
    .single()

  if (findErr || !loja) return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 })
  if (!loja.email) return NextResponse.json({ error: "A loja não possui e-mail cadastrado." }, { status: 400 })

  const senhaTemp = gerarSenhaTemp()
  const hash = await bcrypt.hash(senhaTemp, 12)

  const { error: updateErr } = await sb
    .from("lojas")
    .update({ senha: hash, primeiro_acesso: true })
    .eq("id", loja_id)

  if (updateErr) {
    console.error("[criar-credenciais] erro ao atualizar senha:", updateErr)
    return NextResponse.json({ error: "Erro ao salvar credenciais." }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://chegodelivery.com"
  const linkTrocarSenha = `${baseUrl}/loja/primeiro-acesso`

  try {
    await enviarCredenciaisLojista({
      nome:             loja.nome,
      email:            loja.email,
      senhaTemporaria:  senhaTemp,
      linkTrocarSenha,
    })
  } catch (emailErr) {
    console.error("[criar-credenciais] erro ao enviar email:", emailErr)
    // Não falha — senha já foi salva; avisa o admin no retorno
    return NextResponse.json({
      ok: true,
      senhaTemporaria: senhaTemp,
      emailEnviado: false,
      avisoEmail: "Senha criada, mas o e-mail não pôde ser enviado. Copie a senha e envie manualmente.",
    })
  }

  return NextResponse.json({ ok: true, senhaTemporaria: senhaTemp, emailEnviado: true })
}
