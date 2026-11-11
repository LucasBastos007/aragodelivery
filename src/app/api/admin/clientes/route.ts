export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"

// Clientes do admin 2.0 (20/10/2026): quem pede, quanto gasta e quem voltou.
// GET: lista com pedidos entregues, gasto, primeiro e último pedido e lojas preferidas.
// PATCH: só o frete fixo do cliente (clientes.frete_fixo, usado em lib/frete.ts antes de qualquer tabela).
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

async function tudo(tabela: string, sel: string, filtro?: (q: any) => any) {
  const out: any[] = []
  for (let i = 0; i < 200_000; i += 1000) {
    let q = sb.from(tabela).select(sel).range(i, i + 999)
    if (filtro) q = filtro(q)
    const { data, error } = await q
    if (error) throw error
    out.push(...(data ?? [])); if ((data ?? []).length < 1000) break
  }
  return out
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const [clientes, peds, lojas] = await Promise.all([
    tudo("clientes", "id,nome,telefone,email,criado_em,endereco_rua,endereco_numero,endereco_bairro,endereco_cidade,frete_fixo"),
    tudo("pedidos", "cliente_id,loja_id,total,status,criado_em,codigo", q => q.not("cliente_id", "is", null).in("status", ["entregue", "cancelado"])),
    tudo("lojas", "id,nome"),
  ])
  const L = new Map(lojas.map((l: any) => [l.id, l.nome]))
  const por = new Map<string, { n: number; v: number; canc: number; prim: string; ult: string; ultCod: string; lojas: Map<string, number> }>()
  for (const p of peds) {
    const a = por.get(p.cliente_id) ?? { n: 0, v: 0, canc: 0, prim: p.criado_em, ult: p.criado_em, ultCod: p.codigo, lojas: new Map() }
    if (p.status === "cancelado") { a.canc++; por.set(p.cliente_id, a); continue }
    a.n++; a.v += Number(p.total ?? 0)
    if (p.criado_em < a.prim) a.prim = p.criado_em
    if (p.criado_em >= a.ult) { a.ult = p.criado_em; a.ultCod = p.codigo }
    a.lojas.set(p.loja_id, (a.lojas.get(p.loja_id) ?? 0) + 1)
    por.set(p.cliente_id, a)
  }
  const lista = clientes.map((c: any) => {
    const a = por.get(c.id)
    const fav = a ? [...a.lojas.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([id, n]) => ({ nome: L.get(id) ?? "Loja", n })) : []
    return { id: c.id, nome: c.nome, telefone: c.telefone, email: c.email, criado_em: c.criado_em, bairro: c.endereco_bairro, cidade: c.endereco_cidade,
      endereco: [c.endereco_rua, c.endereco_numero].filter(Boolean).join(", "), frete_fixo: c.frete_fixo == null ? null : Number(c.frete_fixo),
      pedidos: a?.n ?? 0, gasto: Math.round((a?.v ?? 0) * 100) / 100, cancelados: a?.canc ?? 0, primeiro: a?.n ? a.prim : null, ultimo: a?.n ? a.ult : null, ultimoCodigo: a?.n ? a.ultCod : null, lojas: fav }
  })
  return NextResponse.json({ clientes: lista })
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const { id, frete_fixo } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: "Cliente obrigatório." }, { status: 400 })
  const v = frete_fixo === null || frete_fixo === "" ? null : Number(frete_fixo)
  if (v !== null && !(v >= 0 && v <= 500)) return NextResponse.json({ error: "Frete inválido." }, { status: 400 })
  const { error } = await sb.from("clientes").update({ frete_fixo: v == null ? null : Math.round(v * 100) / 100 }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
