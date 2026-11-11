export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { extratoCarteira } from "@/lib/carteiraExtrato"
import { todos } from "@/lib/asaasConferencia"

// Extrato da Carteira (20/10/2026): lançamentos reais do Asaas no período + o que ainda vai cair do cartão.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const ymd = (v: string | null) => v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
const r2 = (v: number) => Math.round(v * 100) / 100

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const u = new URL(req.url), de = ymd(u.searchParams.get("de")), ate = ymd(u.searchParams.get("ate"))
  if (!de || !ate || de > ate) return NextResponse.json({ error: "Período inválido." }, { status: 400 })
  try {
    const [e, conf] = await Promise.all([extratoCarteira(sb, de, ate), todos(`/payments?status=CONFIRMED`, 2000).catch(() => null)])
    const aReceber = conf ? { n: conf.length, liquido: r2(conf.reduce((s: number, p: any) => s + Number(p.netValue ?? 0), 0)),
      proxima: conf.map((p: any) => String(p.estimatedCreditDate ?? p.creditDate ?? "")).filter(Boolean).sort()[0] ?? null,
      // Separado pelo mês em que cai (o painel do Asaas mostra um mês por vez, e em valor bruto)
      porMes: Object.values(conf.reduce((m: Record<string, { mes: string; n: number; bruto: number; liquido: number }>, p: any) => {
        const k = String(p.estimatedCreditDate ?? p.creditDate ?? "").slice(0, 7) || "?"; const x = (m[k] ??= { mes: k, n: 0, bruto: 0, liquido: 0 })
        x.n++; x.bruto = r2(x.bruto + Number(p.value ?? 0)); x.liquido = r2(x.liquido + Number(p.netValue ?? 0)); return m }, {})).sort((a: any, b: any) => a.mes.localeCompare(b.mes)) } : null
    return NextResponse.json({ de, ate, ...e, aReceber })
  } catch (err: any) { return NextResponse.json({ error: err?.message ?? "Não foi possível ler o extrato do Asaas." }, { status: 502 }) }
}
