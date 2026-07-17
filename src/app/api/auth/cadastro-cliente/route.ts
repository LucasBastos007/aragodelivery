import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { email, senha, nome, telefone } = await req.json()
    if (!email || !senha || !nome) {
      return NextResponse.json({ error: "Dados obrigatórios ausentes." }, { status: 400 })
    }

    // Cria usuário já confirmado — sem enviar email de confirmação
    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: senha,
      email_confirm: true,
      user_metadata: { nome: nome.trim() },
    })

    if (error) {
      const msg = error.message.includes("already registered")
        ? "Este e-mail já está cadastrado."
        : error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (data.user) {
      await admin.from("clientes").upsert({
        id: data.user.id,
        nome: nome.trim(),
        telefone: (telefone ?? "").trim(),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erro interno" }, { status: 500 })
  }
}
