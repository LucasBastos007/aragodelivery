import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { sessionResponse } from "@/lib/session"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req)
  if (limited) return limited

  try {
    const { email, senha } = await req.json()
    if (!email || !senha) return NextResponse.json({ error: "Email e senha obrigatórios." }, { status: 400 })

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data, error } = await client
      .from("lojas")
      .select("id, nome, status, senha, primeiro_acesso")
      .eq("email", (email as string).trim().toLowerCase())
      .single()

    // Hash dummy garante timing igual quando e-mail não existe (evita timing oracle)
    const DUMMY_HASH = "$2b$12$invalidhashfortimingequalityxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

    if (error || !data) {
      await bcrypt.compare(senha, DUMMY_HASH).catch(() => {})
      return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 })
    }

    // Verificação com migração transparente para bcrypt
    let valid = false
    if (data.senha) {
      if (data.senha.startsWith("$2")) {
        valid = await bcrypt.compare(senha, data.senha)
      } else {
        valid = data.senha === senha
        if (valid) {
          const hash = await bcrypt.hash(senha, 12)
          await client.from("lojas").update({ senha: hash }).eq("id", data.id)
        }
      }
    }
    if (!valid) return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 })

    if (data.status === "pendente")          return NextResponse.json({ error: "Seu cadastro ainda não foi processado. Assine o contrato enviado por e-mail ou aguarde contato da nossa equipe." }, { status: 403 })
    if (data.status === "contrato_assinado") return NextResponse.json({ error: "Contrato assinado! Sua loja será ativada em breve pela equipe Chegô." }, { status: 403 })
    if (data.status === "suspenso")          return NextResponse.json({ error: "Esta conta foi suspensa. Entre em contato com o suporte." }, { status: 403 })

    await client.from("lojas").update({ aberto: true }).eq("id", data.id)

    return sessionResponse(
      { role: "loja", loja_id: data.id },
      { ok: true, loja_id: data.id, loja_nome: data.nome, primeiro_acesso: data.primeiro_acesso ?? false },
    )
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erro interno" }, { status: 500 })
  }
}
