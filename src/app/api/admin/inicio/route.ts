export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { divisaoSaldo, linhasCarteira } from "@/lib/carteiraAdmin"
import { iniUtc, somaDiasYmd, ymdBrt } from "@/lib/repasseLoja"
import { saldoConta } from "@/lib/asaas"

// Início do admin (20/10/2026): números do dia, o que precisa de atenção agora, dinheiro no Asaas
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const min = (iso?: string | null) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 60000) : 0

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const hoje = ymdBrt(), de7 = somaDiasYmd(hoje, -7)
  let saldo: number | null = null
  try { saldo = (await saldoConta()).balance } catch {}
  const [linhas, divisao, { data: abertos }, { data: sos }, { data: lojas }, { data: hojeTodos }] = await Promise.all([
    linhasCarteira(sb, de7, hoje), divisaoSaldo(sb, saldo),
    sb.from("pedidos").select("id,codigo,status,criado_em,atualizado_em,pronto_em,aceito_em,loja:lojas(nome,telefone)").in("status", ["aguardando_pagamento", "pendente", "aceito", "preparando", "pronto", "aguardando_aceite"]).gte("criado_em", iniUtc(somaDiasYmd(hoje, -1))).limit(300),
    sb.from("alertas_sos").select("id,criado_em,motoboy:motoboys(nome)").eq("status", "pendente").limit(5),
    sb.from("lojas").select("id,nome,logo_url"),
    sb.from("pedidos").select("id,total,status").gte("criado_em", iniUtc(hoje)).neq("status", "cancelado"),
  ])
  const alertas: { g: "grave" | "atencao"; t: string; d: string; ir: string }[] = []
  for (const s of sos ?? []) alertas.push({ g: "grave", t: `SOS de ${(s as any).motoboy?.nome ?? "motoboy"}`, d: `Há ${min((s as any).criado_em)} min.`, ir: "/chego-ctrl/ao-vivo?aba=despacho" })
  for (const p of (abertos ?? []) as any[]) {
    const loja = p.loja?.nome ?? "Loja"
    if (p.status === "pendente" && min(p.atualizado_em ?? p.criado_em) >= 5) alertas.push({ g: "grave", t: `${loja} não aceitou o #${p.codigo}`, d: `Esperando há ${min(p.atualizado_em ?? p.criado_em)} min.`, ir: `/chego-ctrl/pedidos?codigo=${p.codigo}` })
    if ((p.status === "pronto" || p.status === "aguardando_aceite") && min(p.pronto_em ?? p.atualizado_em) >= 8) alertas.push({ g: "grave", t: `#${p.codigo} pronto sem motoboy`, d: `${min(p.pronto_em ?? p.atualizado_em)} min parado na ${loja}.`, ir: "/chego-ctrl/ao-vivo?aba=despacho" })
    if (p.status === "aguardando_pagamento" && min(p.criado_em) >= 10) alertas.push({ g: "atencao", t: `#${p.codigo}: Pix não pago`, d: `Gerado há ${min(p.criado_em)} min.`, ir: `/chego-ctrl/pedidos?codigo=${p.codigo}` })
    if (p.status === "preparando" && min(p.aceito_em ?? p.criado_em) >= 40) alertas.push({ g: "atencao", t: `#${p.codigo} demorando na cozinha`, d: `${min(p.aceito_em ?? p.criado_em)} min desde que a ${loja} aceitou.`, ir: `/chego-ctrl/pedidos?codigo=${p.codigo}` })
  }
  const dias: Record<string, { pago: number; pedidos: number; app: number }> = {}
  for (let d = de7; d <= hoje; d = somaDiasYmd(d, 1)) dias[d] = { pago: 0, pedidos: 0, app: 0 }
  for (const l of linhas) { const x = dias[l.dia]; if (x) { x.pago += l.pago; x.pedidos++; x.app += l.app } }
  const linHoje = linhas.filter(l => l.dia === hoje)
  const porLoja = Object.entries(linHoje.reduce((a: Record<string, number>, l) => (a[l.loja_id] = (a[l.loja_id] ?? 0) + l.produtos, a), {})).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const L = new Map((lojas ?? []).map((l: any) => [l.id, l]))
  return NextResponse.json({ hoje, alertas: alertas.sort((a, b) => (a.g === "grave" ? 0 : 1) - (b.g === "grave" ? 0 : 1)), divisao, serie: dias,
    hojeLinhas: linHoje, pedidosHojeTodos: (hojeTodos ?? []).length, topLojas: porLoja.map(([id, v]) => ({ id, v, nome: (L.get(id) as any)?.nome ?? "", logo: (L.get(id) as any)?.logo_url ?? null })) })
}
