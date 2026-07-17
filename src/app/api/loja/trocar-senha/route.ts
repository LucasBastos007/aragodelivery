import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { requireLoja } from "@/lib/session"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const sessao = requireLoja(req)
  if (!sessao) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const { novaSenha } = await req.json()
  if (!novaSenha || novaSenha.length < 6) {
    return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres." }, { status: 400 })
  }

  const hash = await bcrypt.hash(novaSenha, 12)

  const { error } = await adminClient()
    .from("lojas")
    .update({ senha: hash, primeiro_acesso: false })
    .eq("id", sessao.loja_id)

  if (error) return NextResponse.json({ error: "Erro ao salvar senha." }, { status: 500 })

  return NextResponse.json({ ok: true })
}
