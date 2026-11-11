import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"

const COOKIE  = "arago_sess"
const MAX_AGE = 60 * 60 * 24 * 30 // 30 dias

function getSecret(): string {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error("SESSION_SECRET não configurada — configure a variável de ambiente antes de subir o servidor.")
  return s
}

export type SessionPayload =
  | { role: "admin"; av?: string }
  | { role: "loja"; loja_id: string }
  | { role: "motoboy"; motoboy_id: string }

function sign(data: string): string {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("hex")
}

function encodeSession(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${data}.${sign(data)}`
}

function decodeSession(token: string): SessionPayload | null {
  const dot = token.lastIndexOf(".")
  if (dot < 0) return null
  const data = token.slice(0, dot)
  const sig  = token.slice(dot + 1)
  const expected = sign(data)
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null
  } catch { return null }
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload
  } catch { return null }
}

/** Marca da senha de admin atual. Vai dentro da sessão de admin: trocou a senha
 *  (ADMIN_SENHA_HASH), todas as sessões de admin antigas deixam de valer. */
export function versaoAdmin(): string {
  return crypto.createHash("sha256").update(process.env.ADMIN_SENHA_HASH ?? "").digest("hex").slice(0, 16)
}

/** Motoboys com acesso cortado na hora (ids em MOTOBOYS_BLOQUEADOS, separados por vírgula).
 *  Suspender no banco só barra o próximo login; isto derruba o celular que já estava logado. */
function bloqueados(): Set<string> {
  return new Set((process.env.MOTOBOYS_BLOQUEADOS ?? "").split(",").map(x => x.trim()).filter(Boolean))
}

/** Lê a sessão do cookie da requisição. */
export function getSession(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(COOKIE)?.value
  if (!token) return null
  const s = decodeSession(token)
  if (s?.role === "admin" && s.av !== versaoAdmin()) return null
  if (s?.role === "motoboy" && bloqueados().has(s.motoboy_id)) return null
  return s
}

/** Gera uma NextResponse com o cookie de sessão setado (HttpOnly). */
export function sessionResponse(
  payload: SessionPayload,
  body: object,
  status = 200,
): NextResponse {
  const res = NextResponse.json(body, { status })
  res.cookies.set(COOKIE, encodeSession(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  })
  return res
}

/** Resposta 401 padrão. */
export function unauthorized(msg = "Não autorizado"): NextResponse {
  return NextResponse.json({ error: msg }, { status: 401 })
}

/** Guard: requer admin — retorna null se não autorizado. */
export function requireAdmin(req: NextRequest): (SessionPayload & { role: "admin" }) | null {
  const s = getSession(req)
  return s?.role === "admin" ? s : null
}

/** Guard: requer lojista — retorna a sessão com loja_id. */
export function requireLoja(req: NextRequest): (SessionPayload & { role: "loja" }) | null {
  const s = getSession(req)
  return s?.role === "loja" ? s : null
}

/** Guard: requer motoboy — retorna a sessão com motoboy_id. */
export function requireMotoboy(req: NextRequest): (SessionPayload & { role: "motoboy" }) | null {
  const s = getSession(req)
  return s?.role === "motoboy" ? s : null
}
