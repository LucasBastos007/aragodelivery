import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const SECRET = process.env.RESET_SECRET ?? "chego-reset-secret-2024"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function verificarToken(token: string): { id: string; tipo: string } | null {
  try {
    const [payload, sig] = token.split(".")
    if (!payload || !sig) return null
    const esperado = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url")
    if (sig !== esperado) return null
    const { id, tipo, exp } = JSON.parse(Buffer.from(payload, "base64url").toString())
    if (Date.now() > exp) return null
    return { id, tipo }
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const { token, senha } = await req.json()

  if (!token || !senha || senha.length < 8) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
  }

  const parsed = verificarToken(token)
  if (!parsed) {
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 400 })
  }

  const sb = adminSb()
  const hash = await bcrypt.hash(senha, 12)

  if (parsed.tipo === "lojista") {
    const { error } = await sb.from("lojas").update({ senha: hash }).eq("id", parsed.id)
    if (error) return NextResponse.json({ error: "Erro ao atualizar senha" }, { status: 500 })
  } else if (parsed.tipo === "motoboy") {
    const { error } = await sb.from("motoboys").update({ senha: hash }).eq("id", parsed.id)
    if (error) return NextResponse.json({ error: "Erro ao atualizar senha" }, { status: 500 })
  } else {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
