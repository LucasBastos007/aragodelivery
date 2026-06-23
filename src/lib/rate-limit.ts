import { NextRequest, NextResponse } from "next/server"

const WINDOW_MS  = 15 * 60 * 1000  // 15 minutos
const MAX_HITS   = 5                // tentativas por janela

interface Entry { count: number; resetAt: number }

// Map in-memory — por instância serverless; suficiente para bloquear brute force
const store = new Map<string, Entry>()

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}

/**
 * Chama no início de qualquer endpoint de login.
 * Retorna uma NextResponse 429 se o IP excedeu o limite, ou null se pode prosseguir.
 */
export function checkRateLimit(req: NextRequest): NextResponse | null {
  const ip  = getIp(req)
  const now = Date.now()
  let entry = store.get(ip)

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS }
    store.set(ip, entry)
    return null
  }

  entry.count++

  if (entry.count > MAX_HITS) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000)
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit":     String(MAX_HITS),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset":     String(Math.ceil(entry.resetAt / 1000)),
        },
      }
    )
  }

  return null
}
