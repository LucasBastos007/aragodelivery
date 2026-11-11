export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSession, unauthorized } from "@/lib/session"
import crypto from "crypto"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function gerarCodigo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = crypto.randomBytes(6)
  return Array.from(bytes).map(b => chars[b % chars.length]).join("")
}

export async function POST(req: NextRequest) {
  const sess = getSession(req)
  if (sess?.role !== "loja") return unauthorized()
  const { loja_id } = sess as any

  // Sem tela que use esta rota (0 pedidos "manual"). Ela gravava a taxa digitada pela loja,
  // e o frete é só do Chegô (20/10/2026): a loja usa a Entrega avulsa, que calcula a taxa.
  void loja_id
  return NextResponse.json({ error: "Use a Entrega avulsa: a taxa de entrega é calculada pelo Chegô." }, { status: 410 })
}
