export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"
import { calcularRepasse, somaDiasYmd, ymdBrt } from "@/lib/repasseLoja"

// Vendas da loja num período (Financeiro > Vendas, 20/10/2026): 1D, 1S, 1M, 3M, 6M, ano ou
// um dia escolhido. Mesma conta do repasse (só produtos, taxas e cupons descontados).
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const ymd = (v: string | null) => v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null

export async function GET(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()
  const u = new URL(req.url), hoje = ymdBrt()
  const ate = ymd(u.searchParams.get("ate")) ?? hoje
  const de = ymd(u.searchParams.get("de")) ?? somaDiasYmd(ate, -6)
  if (de > ate) return NextResponse.json({ error: "Período inválido." }, { status: 400 })
  if (somaDiasYmd(de, 400) < ate) return NextResponse.json({ error: "Escolha no máximo 400 dias." }, { status: 400 })
  // Itens dos pedidos só quando o período é curto (lista do dia / da semana)
  const curto = somaDiasYmd(de, 7) >= ate
  const r = await calcularRepasse(sb, sess.loja_id, { ini: de, fim: ate, paga: "" }, { itens: curto || u.searchParams.get("itens") === "1", semCorte: true })
  return NextResponse.json({ de, ate, hoje, resumo: { ...r, linhas: curto ? r.linhas : r.linhas.map(l => ({ ...l, itens: [] })) } })
}
