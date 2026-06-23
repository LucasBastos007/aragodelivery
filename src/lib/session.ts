import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"

const SECRET = process.env.SESSION_SECRET ?? "dev-insecure-change-me-in-production"
const COOKIE = "arago_sess"
const MAX_AGE = 60 * 60 * 24 * 7 // 7 dias

export type SessionPayload =
  | { role: "admin" }
  | { role: "loja"; loja_id: string }
  | { role: "motoboy"; motoboy_id: string }

function sign(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("hex")
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

/** Lê a sessão do cookie da requisição. */
export function getSession(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(COOKIE)?.value
  if (!token) return null
  return decodeSession(token)
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
