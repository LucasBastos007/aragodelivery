export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { conferirAsaas } from "@/lib/asaasConferencia"
import { linhasCarteira } from "@/lib/carteiraAdmin"

// Conferência com o Asaas (admin 2.0, 20/10/2026): extrato real x o que o app registrou no período.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const ymd = (v: string | null) => v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
const r2 = (v: number) => Math.round(v * 100) / 100

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const u = new URL(req.url), de = ymd(u.searchParams.get("de")), ate = ymd(u.searchParams.get("ate"))
  if (!de || !ate || de > ate) return NextResponse.json({ error: "Período inválido." }, { status: 400 })
  try {
    const [a, linhas] = await Promise.all([conferirAsaas(de, ate), linhasCarteira(sb, de, ate)])
    const appPix = r2(linhas.reduce((s, l) => s + (l.meios?.pix ?? 0), 0)), appCartao = r2(linhas.reduce((s, l) => s + (l.meios?.cartao ?? 0), 0))
    const taxaEstimada = r2(linhas.reduce((s, l) => s + l.custo, 0))
    return NextResponse.json({ de, ate, asaas: a, app: { pix: appPix, cartao: appCartao, total: r2(appPix + appCartao), taxaEstimada } })
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "Não foi possível falar com o Asaas." }, { status: 502 }) }
}
