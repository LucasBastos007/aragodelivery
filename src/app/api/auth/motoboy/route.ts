import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { sessionResponse, unauthorized } from "@/lib/session"

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json()
  if (!email || !senha) {
    return NextResponse.json({ error: "Email e senha obrigatórios." }, { status: 400 })
  }

  const { data: rows, error } = await sb
    .from("motoboys")
    .select("id, nome, status, senha")
    .eq("email", (email as string).trim().toLowerCase())
    .order("status", { ascending: false }) // "ativo" antes de "pendente"
    .limit(1)

  const data = rows?.[0] ?? null

  // Hash dummy garante timing igual quando e-mail não existe (evita timing oracle)
  const DUMMY_HASH = "$2b$12$invalidhashfortimingequalityxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

  if (error || !data) {
    await bcrypt.compare(senha, DUMMY_HASH).catch(() => {})
    return unauthorized("E-mail ou senha incorretos.")
  }

  if (data.status === "pendente")  return NextResponse.json({ error: "Cadastro aguardando aprovação." }, { status: 403 })
  if (data.status === "suspenso")  return NextResponse.json({ error: "Conta suspensa. Entre em contato com o suporte." }, { status: 403 })

  // Verificação com migração transparente para bcrypt
  let valid = false
  if (data.senha) {
    if (data.senha.startsWith("$2")) {
      valid = await bcrypt.compare(senha, data.senha)
    } else {
      valid = data.senha === senha
      if (valid) {
        const hash = await bcrypt.hash(senha, 12)
        await sb.from("motoboys").update({ senha: hash }).eq("id", data.id)
      }
    }
  }
  if (!valid) return unauthorized("E-mail ou senha incorretos.")

  return sessionResponse(
    { role: "motoboy", motoboy_id: data.id },
    { ok: true, motoboy_id: data.id, motoboy_nome: data.nome },
  )
}
