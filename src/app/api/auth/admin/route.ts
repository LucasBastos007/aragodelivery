import crypto from "crypto"
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

  // timingSafeEqual para evitar timing attack
  let emailOk = false
  let senhaOk = false
  try {
    emailOk = crypto.timingSafeEqual(Buffer.from(email ?? ""), Buffer.from(adminEmail))
    senhaOk = crypto.timingSafeEqual(Buffer.from(senha ?? ""), Buffer.from(adminSenha))
  } catch {}

  if (!emailOk || !senhaOk) return unauthorized("Credenciais inválidas.")

  return sessionResponse({ role: "admin" }, { ok: true, role: "admin" })
}
