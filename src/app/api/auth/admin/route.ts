import { NextRequest, NextResponse } from "next/server"
import { sessionResponse, unauthorized } from "@/lib/session"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req)
  if (limited) return limited

  const { email, senha } = await req.json()

  const adminEmail = process.env.ADMIN_EMAIL
  const adminSenha = process.env.ADMIN_SENHA
  if (!adminEmail || !adminSenha) {
    return NextResponse.json({ error: "Credenciais de admin não configuradas no servidor." }, { status: 500 })
  }

  console.log(`[admin-auth] email_len=${(email ?? "").length} env_email_len=${adminEmail.length} senha_len=${(senha ?? "").length} env_senha_len=${adminSenha.length}`)

  const emailOk = (email ?? "").toLowerCase().trim() === adminEmail.toLowerCase().trim()
  const senhaOk = (senha ?? "").trim() === adminSenha.trim()

  console.log(`[admin-auth] emailOk=${emailOk} senhaOk=${senhaOk}`)

  if (!emailOk || !senhaOk) return unauthorized("Credenciais inválidas.")

  return sessionResponse({ role: "admin" }, { ok: true, role: "admin" })
}
