export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { BLACK_CHAVE_SUSPENSA, BLACK_CODIGO, BLACK_FIM, BLACK_INICIO, BLACK_LOJAS, BLACK_MARCA_ID, blackAtiva } from "@/lib/blackFriday"
import { blackSuspensa } from "@/lib/blackFridayServidor"

// Painel da Black Friday Chegô (admin): pedidos promocionais da campanha em tempo real, separados
// por situação (pendente / confirmado / concluído / cancelado) pra o financeiro não misturar valor
// que ainda pode cair. Valores do split vêm da marca gravada em cada item (custo_chego/custo_loja).
// POST { suspensa: true|false } liga/desliga a suspensão emergencial (pedidos já feitos ficam).
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const r2 = (v: number) => Math.round(v * 100) / 100
const fim8 = (t?: string | null) => String(t ?? "").replace(/\D/g, "").slice(-8)

type Situacao = "pendente" | "confirmado" | "concluido" | "cancelado"
const situacao = (st: string): Situacao =>
  st === "cancelado" ? "cancelado" : st === "entregue" ? "concluido" : st === "pendente" || st === "aguardando_pagamento" ? "pendente" : "confirmado"

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const peds: any[] = []
  for (let i = 0; i < 50_000; i += 1000) {
    const { data, error } = await sb.from("pedidos")
      .select("id,codigo,loja_id,status,cliente_id,nome_cliente,telefone_cliente,subtotal,desconto,total,forma_pagamento,criado_em,motivo_cancelamento")
      .eq("cupom_codigo", BLACK_CODIGO).gte("criado_em", BLACK_INICIO).lt("criado_em", BLACK_FIM)
      .order("criado_em", { ascending: false }).range(i, i + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    peds.push(...(data ?? [])); if ((data ?? []).length < 1000) break
  }
  // split e quantidades gravados nos itens
  const porPed = new Map<string, { qtd: number; original: number; desc: number; chego: number; loja: number; itens: string[] }>()
  const ids = peds.map(p => p.id)
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from("itens_pedido").select("pedido_id,nome,quantidade,adicionais").in("pedido_id", ids.slice(i, i + 200))
    for (const it of data ?? []) {
      const m = (Array.isArray(it.adicionais) ? it.adicionais : []).find((a: any) => a?.id === BLACK_MARCA_ID) as any
      if (!m) continue
      const x = porPed.get(it.pedido_id) ?? { qtd: 0, original: 0, desc: 0, chego: 0, loja: 0, itens: [] }
      x.qtd += Number(m.qtd ?? it.quantidade) || 0; x.original += Number(m.original) || 0; x.desc += Number(m.desconto_black) || 0
      x.chego += Number(m.custo_chego) || 0; x.loja += Number(m.custo_loja) || 0; x.itens.push(`${it.quantidade}× ${it.nome}`)
      porPed.set(it.pedido_id, x)
    }
  }
  const nomeLoja = new Map(Object.values(BLACK_LOJAS).map(l => [l.id, l.nome]))
  const vazio = () => ({ pedidos: 0, produtos: 0, original: 0, promocional: 0, desconto: 0, chego: 0, loja: 0 })
  const totais: Record<Situacao, ReturnType<typeof vazio>> = { pendente: vazio(), confirmado: vazio(), concluido: vazio(), cancelado: vazio() }
  const lojas = new Map<string, { id: string; nome: string; pedidos: number; produtos: number; original: number; desconto: number; chego: number; loja: number; cancelados: number }>()
  const clientes = new Set<string>()
  const lista = peds.map(p => {
    const s = situacao(p.status), x = porPed.get(p.id) ?? { qtd: 0, original: 0, desc: Number(p.desconto) || 0, chego: 0, loja: 0, itens: [] }
    const t = totais[s]
    t.pedidos++; t.produtos += x.qtd; t.original += x.original; t.promocional += x.original - x.desc; t.desconto += x.desc; t.chego += x.chego; t.loja += x.loja
    const l = lojas.get(p.loja_id) ?? { id: p.loja_id, nome: nomeLoja.get(p.loja_id) ?? "Loja", pedidos: 0, produtos: 0, original: 0, desconto: 0, chego: 0, loja: 0, cancelados: 0 }
    if (s === "cancelado") l.cancelados++
    else { l.pedidos++; l.produtos += x.qtd; l.original += x.original; l.desconto += x.desc; l.chego += x.chego; l.loja += x.loja; clientes.add(p.cliente_id || `t:${fim8(p.telefone_cliente)}`) }
    lojas.set(p.loja_id, l)
    return { id: p.id, codigo: p.codigo, situacao: s, status: p.status, loja: nomeLoja.get(p.loja_id) ?? "Loja", loja_id: p.loja_id, cliente: p.nome_cliente ?? "", criado_em: p.criado_em,
      forma: p.forma_pagamento, itens: x.itens.join(", "), qtd: x.qtd, original: r2(x.original), desconto: r2(x.desc), chego: r2(x.chego), custo_loja: r2(x.loja), total: Number(p.total) || 0 }
  })
  const arred = (o: any) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "number" ? r2(v) : v]))
  const validos = (["pendente", "confirmado", "concluido"] as Situacao[]).reduce((a, k) => {
    for (const [kk, v] of Object.entries(totais[k])) (a as any)[kk] = ((a as any)[kk] ?? 0) + v
    return a
  }, vazio())
  return NextResponse.json({
    janela: { inicio: BLACK_INICIO, fim: BLACK_FIM, no_ar: blackAtiva(), suspensa: await blackSuspensa(sb) },
    consolidado: { ...arred(validos), clientes: clientes.size, cancelados: totais.cancelado.pedidos },
    por_situacao: Object.fromEntries(Object.entries(totais).map(([k, v]) => [k, arred(v)])),
    por_loja: [...lojas.values()].map(arred).sort((a: any, b: any) => b.desconto - a.desconto),
    lojas_participantes: Object.values(BLACK_LOJAS).length,
    pedidos: lista,
  })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const body = await req.json().catch(() => ({}))
  if (typeof body?.suspensa !== "boolean") return NextResponse.json({ error: "Informe suspensa: true ou false." }, { status: 400 })
  const valor = body.suspensa ? "1" : "0"
  const { data: atual } = await sb.from("configuracoes").select("chave").eq("chave", BLACK_CHAVE_SUSPENSA).maybeSingle()
  const { error } = atual
    ? await sb.from("configuracoes").update({ valor }).eq("chave", BLACK_CHAVE_SUSPENSA)
    : await sb.from("configuracoes").insert({ chave: BLACK_CHAVE_SUSPENSA, valor })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  console.log("[black-friday] suspensão", { suspensa: body.suspensa })
  return NextResponse.json({ ok: true, suspensa: body.suspensa })
}
