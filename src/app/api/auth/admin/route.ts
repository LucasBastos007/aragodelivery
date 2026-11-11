import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { sessionResponse, unauthorized, requireAdmin, versaoAdmin } from "@/lib/session"

// Confere se o cookie de admin ainda vale. O painel guarda "sou admin" no aparelho, mas o
// servidor só aceita o cookie: se ele expirou ou foi trocado por um login de loja/motoboy no
// mesmo celular, toda ação dava "Não autorizado" com a tela aberta (Vida, 26/10/2026).
export async function GET(req: NextRequest) {
  return requireAdmin(req) ? NextResponse.json({ ok: true }) : unauthorized("Sessão de admin expirada.")
}
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req)
  if (limited) return limited

  const { email, senha } = await req.json()

  const adminEmail = process.env.ADMIN_EMAIL
  const adminSenhaHash = process.env.ADMIN_SENHA_HASH

  if (!adminEmail || !adminSenhaHash) {
    return NextResponse.json({ error: "Credenciais de admin não configuradas no servidor." }, { status: 500 })
  }

  // Comparação de e-mail constante em tempo
  const emailInput = (email ?? "").toLowerCase().trim()
  const emailEnv   = adminEmail.toLowerCase().trim()

  // Sempre roda bcrypt para evitar timing oracle (mesmo quando e-mail errado)
  const DUMMY_HASH = "$2b$12$invalidhashfortimingequalityxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  const hashParaComparar = emailInput === emailEnv ? adminSenhaHash : DUMMY_HASH
  const senhaOk = await bcrypt.compare(senha ?? "", hashParaComparar)

  if (emailInput !== emailEnv || !senhaOk) {
    return unauthorized("Credenciais inválidas.")
  }

  return sessionResponse({ role: "admin", av: versaoAdmin() }, { ok: true, role: "admin" })
}
