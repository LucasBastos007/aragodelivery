export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"

// Taxas e frete (admin 2.0, 20/10/2026). Só o Chegô muda: as lojas não editam frete.
// GET: taxa base, comissão, participação na entrega e mensalidade de cada loja + tabela de frete por município.
// POST (uma ação por vez, nunca apaga linha):
//   { acao: "loja", loja_id, taxa_entrega?, comissao?, participacao_entrega?, plano_mensalidade? }
//   { acao: "municipio", municipio, taxa, loja_id? }  → muda a taxa do município em todas as lojas que já atendem lá (ou só numa)
//   { acao: "adicionar_municipio", municipio, taxa } → passa a atender o município em todas as lojas ativas que ainda não tinham
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const num = (v: unknown, max: number) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : null }

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const [{ data: lojas }, { data: tab }] = await Promise.all([
    sb.from("lojas").select("id,nome,logo_url,status,taxa_entrega,comissao,participacao_entrega,plano,plano_mensalidade").order("nome"),
    sb.from("tabela_frete").select("id,loja_id,municipio,taxa,tipo").limit(5000),
  ])
  return NextResponse.json({ lojas: lojas ?? [], frete: tab ?? [] })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const b = await req.json().catch(() => ({}))
  if (b.acao === "loja") {
    if (!b.loja_id) return NextResponse.json({ error: "Loja obrigatória." }, { status: 400 })
    const campos: Record<string, number> = {}
    for (const [k, max] of [["taxa_entrega", 300], ["comissao", 50], ["participacao_entrega", 50], ["plano_mensalidade", 20000]] as const) {
      if (b[k] === undefined) continue
      const v = num(b[k], max); if (v === null) return NextResponse.json({ error: `Valor inválido em ${k}.` }, { status: 400 }); campos[k] = v
    }
    if (!Object.keys(campos).length) return NextResponse.json({ error: "Nada pra salvar." }, { status: 400 })
    const { error } = await sb.from("lojas").update(campos).eq("id", b.loja_id)
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true })
  }
  if (b.acao === "municipio" || b.acao === "adicionar_municipio") {
    const muni = String(b.municipio ?? "").trim(), taxa = num(b.taxa, 300)
    if (!muni || taxa === null) return NextResponse.json({ error: "Município e taxa obrigatórios." }, { status: 400 })
    if (b.acao === "municipio") {
      let q = sb.from("tabela_frete").update({ taxa }).eq("municipio", muni)
      if (b.loja_id) q = q.eq("loja_id", b.loja_id)
      const { data, error } = await q.select("id")
      return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true, alteradas: (data ?? []).length })
    }
    const [{ data: ativas }, { data: ja }] = await Promise.all([sb.from("lojas").select("id").eq("status", "ativo"), sb.from("tabela_frete").select("loja_id").eq("municipio", muni)])
    const tem = new Set((ja ?? []).map((x: any) => x.loja_id)), novas = (ativas ?? []).filter((l: any) => !tem.has(l.id)).map((l: any) => ({ loja_id: l.id, municipio: muni, taxa, tipo: "municipio" }))
    if (!novas.length) return NextResponse.json({ ok: true, alteradas: 0 })
    const { error } = await sb.from("tabela_frete").insert(novas)
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true, alteradas: novas.length })
  }
  return NextResponse.json({ error: "Ação inválida." }, { status: 400 })
}
