export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { CUSTO_ESTIMADO, divisaoSaldo, lerSaldoMp, lerSaldoTon, linhasCarteira } from "@/lib/carteiraAdmin"
import { somaDiasYmd, ymdBrt } from "@/lib/repasseLoja"
import { saldoConta } from "@/lib/asaas"

// Carteira do admin: divisão do dinheiro no período + saldo do Asaas dividido (20/10/2026)
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const ymd = (v: string | null) => v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const u = new URL(req.url), hoje = ymdBrt(), ate = ymd(u.searchParams.get("ate")) ?? hoje, de = ymd(u.searchParams.get("de")) ?? somaDiasYmd(ate, -6)
  if (de > ate || somaDiasYmd(de, 400) < ate) return NextResponse.json({ error: "Período inválido (até 400 dias)." }, { status: 400 })
  const semSaldo = u.searchParams.get("saldo") === "0"
  let saldo: number | null = null
  if (!semSaldo) { try { saldo = (await saldoConta()).balance } catch {} }
  const [linhas, divisao, { data: lojas }, { data: mbs }] = await Promise.all([
    linhasCarteira(sb, de, ate), semSaldo ? Promise.resolve(null) : divisaoSaldo(sb, saldo),
    sb.from("lojas").select("id,nome,logo_url"), sb.from("motoboys").select("id,nome"),
  ])
  return NextResponse.json({ de, ate, hoje, custoEstimado: CUSTO_ESTIMADO, linhas, divisao,
    lojas: Object.fromEntries((lojas ?? []).map((l: any) => [l.id, { nome: l.nome, logo: l.logo_url }])),
    motoboys: Object.fromEntries((mbs ?? []).map((m: any) => [m.id, m.nome])) })
}

// Saldo da Ton digitado pelo admin (a Ton não tem API). Body: { saldo, aReceber } em reais.
// Saldo do Mercado Pago (a API não informa saldo): body { conta: "mp", saldo }.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const b = await req.json().catch(() => ({}))
  if (b?.conta === "mp") {
    const saldo = Number(b?.saldo)
    if (!Number.isFinite(saldo) || saldo < 0 || saldo > 10_000_000) return NextResponse.json({ error: "Valor inválido." }, { status: 400 })
    const valor = { saldo: Math.round(saldo * 100) / 100, em: new Date().toISOString() }
    const { error } = await sb.from("configuracoes").upsert({ chave: "mp_saldo", valor: JSON.stringify(valor), atualizado_em: valor.em }, { onConflict: "chave" })
    return error ? NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 }) : NextResponse.json({ ok: true, mp: await lerSaldoMp(sb) })
  }
  const saldo = Number(b?.saldo), aReceber = Number(b?.aReceber ?? 0)
  if (!Number.isFinite(saldo) || saldo < 0 || saldo > 10_000_000 || !Number.isFinite(aReceber) || aReceber < 0 || aReceber > 10_000_000) return NextResponse.json({ error: "Valores inválidos." }, { status: 400 })
  const valor = { saldo: Math.round(saldo * 100) / 100, aReceber: Math.round(aReceber * 100) / 100, em: new Date().toISOString() }
  const { error } = await sb.from("configuracoes").upsert({ chave: "ton_saldo", valor: JSON.stringify(valor), atualizado_em: valor.em }, { onConflict: "chave" })
  return error ? NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 }) : NextResponse.json({ ok: true, ton: await lerSaldoTon(sb) })
}
