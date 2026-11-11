// Borderô de repasse (20/10/2026, pedido do Lucas): a relação de pedidos que forma o pagamento de
// cada loja (ciclo de sexta a quinta) e de cada motoboy (entregas desde 16/10), pra mandar conferir
// antes de pagar. Usa a MESMA conta do pagamento (calcularRepasse / saldoMotoboys), então o valor
// do borderô é exatamente o que o servidor aceita pagar.
import type { SupabaseClient } from "@supabase/supabase-js"
import { adiantamentosCiclo, calcularRepasse, chaveCiclo, ymdBrt, iniUtc, type Ciclo } from "@/lib/repasseLoja"
import { linhasCarteira } from "@/lib/carteiraAdmin"
import { saldoMotoboys } from "@/lib/saldosRepasse"
import { DESTINACOES_DESDE } from "@/lib/destinacoesFinanceiras"
import { ganhoMotoboy } from "@/lib/comissao"
import { precoAdicionais } from "@/lib/precoAdicionais"

const r2 = (v: number) => Math.round(v * 100) / 100
const FORMA: Record<string, string> = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha", pix_loja: "Pix na loja" }
const forma = (a: string, b?: string | null) => [a, b].filter(Boolean).map(x => FORMA[x!] ?? x).join(" + ")

export type LinhaBorderoLoja = { codigo: string; dia: string; hora: string; forma: string; itens: string; frete: number; alerta: string | null; produtos: number; cupom: number; comissao: number; taxas: number; entrega: number; balcao: number; liquido: number }
export type BorderoLoja = { tipo: "loja"; id: string; nome: string; periodo_ini: string; periodo_fim: string; paga: string
  linhas: LinhaBorderoLoja[]; alertas: number; frete: number; produtos: number; cupom: number; comissao: number; taxas: number; entrega: number; balcao: number; avulsas: number; qtdAvulsas: number; ajustes: number; ajustesLista: { valor: number; motivo: string; dia: string }[]; adiantado: number; valor: number; saldo: number }
export type LinhaBorderoMb = { codigo: string; dia: string; loja: string; ganho: number; avulsa: boolean }
export type BorderoMb = { tipo: "motoboy"; id: string; nome: string; periodo_ini: string; periodo_fim: string
  linhas: LinhaBorderoMb[]; ganho: number; bonus: number; descontos: number; pago: number; compensado: number; reservado: number; valor: number }

export async function borderoLoja(sb: SupabaseClient, lojaId: string, c: Ciclo): Promise<BorderoLoja> {
  const [r, ad, { data: loja }] = await Promise.all([calcularRepasse(sb, lojaId, c, { itens: true }), adiantamentosCiclo(sb, lojaId, c), sb.from("lojas").select("nome").eq("id", lojaId).single()])
  // Trava dos 100% (pedido do Lucas): o bruto da loja é SÓ produtos (itens + adicionais), nunca frete.
  // Cada pedido é conferido: produtos = itens + adicionais, e produtos + frete − desconto = total pago.
  const ids = r.linhas.map(l => l.id), ped = new Map<string, any>(), itensSoma = new Map<string, number>()
  for (let i = 0; i < ids.length; i += 300) {
    const lote = ids.slice(i, i + 300)
    const [{ data: ps }, { data: its }] = await Promise.all([
      sb.from("pedidos").select("id,subtotal,taxa_entrega,taxa_dinamica,desconto,total,frete_gratis").in("id", lote),
      sb.from("itens_pedido").select("pedido_id,produto_id,preco,quantidade,adicionais").in("pedido_id", lote),
    ])
    for (const p of ps ?? []) ped.set((p as any).id, p)
    // Adicionais com a mesma regra do carrinho (pizza meio a meio cobra só o sabor mais caro)
    const prodIds = [...new Set(((its ?? []) as any[]).map(x => x.produto_id).filter(Boolean))]
    const { data: prods } = prodIds.length ? await sb.from("produtos").select("id,adicionais").in("id", prodIds) : { data: [] as any[] }
    const defs = new Map(((prods ?? []) as any[]).map(x => [x.id, x.adicionais]))
    for (const it of (its ?? []) as any[]) {
      const ad = Array.isArray(it.adicionais) ? precoAdicionais(defs.get(it.produto_id), it.adicionais.map((a: any) => ({ id: String(a?.id ?? ""), preco: Number(a?.preco ?? 0) * Number(a?.quantidade ?? 1) }))) : 0
      itensSoma.set(it.pedido_id, (itensSoma.get(it.pedido_id) ?? 0) + (Number(it.preco ?? 0) + ad) * Number(it.quantidade ?? 1))
    }
  }
  const alerta = (id: string, produtos: number) => {
    const p = ped.get(id); if (!p) return "pedido não encontrado"
    const it = r2(itensSoma.get(id) ?? 0), fr = Number(p.taxa_entrega ?? 0) + Number(p.taxa_dinamica ?? 0), desc = Number(p.desconto ?? 0), tot = Number(p.total ?? 0)
    if (Math.abs(it - produtos) > 0.01) return `produtos ${produtos.toFixed(2)} não batem com os itens ${it.toFixed(2)}`
    if (!p.frete_gratis && Math.abs(produtos + fr - desc - tot) > 0.01) return `produtos + frete − desconto não dá o total pago (${tot.toFixed(2)})`
    return null
  }
  const linhas = r.linhas.map(l => ({ codigo: l.codigo, dia: l.dia, hora: new Date(l.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }), forma: forma(l.forma, l.forma_2), itens: l.itens.map(i => `${i.quantidade}x ${i.nome}`).join(", "),
    frete: r2(Number(ped.get(l.id)?.taxa_entrega ?? 0)), alerta: alerta(l.id, l.produtos),
    produtos: l.produtos, cupom: l.cupomLoja, comissao: l.comissao, taxas: r2(l.taxaOnline + l.taxaMaquininha), entrega: l.participacaoEntrega, balcao: l.recebidoPelaLoja, liquido: l.liquido }))
  return { tipo: "loja", id: lojaId, nome: (loja as any)?.nome ?? "Loja", periodo_ini: r.ciclo.ini, periodo_fim: c.fim, paga: c.paga, linhas,
    alertas: linhas.filter(l => l.alerta).length, frete: r2(linhas.reduce((t, l) => t + l.frete, 0)), produtos: r.produtos, cupom: r.cupomLoja, comissao: r.comissao, taxas: r2(r.taxaOnline + r.taxaMaquininha), entrega: r.participacaoEntrega, balcao: r.recebidoPelaLoja,
    avulsas: r.avulsas, qtdAvulsas: r.qtdAvulsas, ajustes: r.ajustes, ajustesLista: r.ajustesLista, adiantado: ad.total, valor: Math.max(0, r2(r.liquido - ad.total)), saldo: r2(r.liquido - ad.total) }
}

export async function borderoMotoboy(sb: SupabaseClient, motoboyId: string): Promise<BorderoMb> {
  const hoje = ymdBrt()
  const [linhas, saldos, { data: avs }, { data: mb }, { data: lojas }, { data: abertos }] = await Promise.all([
    linhasCarteira(sb, DESTINACOES_DESDE, hoje), saldoMotoboys(sb, hoje),
    sb.from("entregas_avulsas").select("codigo,loja_id,taxa_entrega,criado_em").eq("motoboy_id", motoboyId).eq("status", "entregue").gte("criado_em", iniUtc(DESTINACOES_DESDE)),
    sb.from("motoboys").select("nome").eq("id", motoboyId).single(), sb.from("lojas").select("id,nome"),
    sb.from("saques").select("valor").eq("tipo", "motoboy").eq("motoboy_id", motoboyId).eq("status", "solicitado"),
  ])
  const L = new Map((lojas ?? []).map((l: any) => [l.id, l.nome as string]))
  const lista: LinhaBorderoMb[] = [
    ...linhas.filter(l => l.motoboy_id === motoboyId && l.mb > 0).map(l => ({ codigo: l.codigo, dia: l.dia, loja: L.get(l.loja_id) ?? "Loja", ganho: r2(l.mb), avulsa: false })),
    ...((avs ?? []) as any[]).map(a => ({ codigo: a.codigo ?? "avulsa", dia: ymdBrt(new Date(a.criado_em)), loja: L.get(a.loja_id) ?? "Loja", ganho: r2(ganhoMotoboy(Number(a.taxa_entrega ?? 0), a.criado_em)), avulsa: true })),
  ].sort((a, b) => a.dia.localeCompare(b.dia))
  const s = saldos.find(x => x.id === motoboyId)
  const reservado = r2(((abertos ?? []) as any[]).reduce((t, x) => t + Number(x.valor ?? 0), 0))
  return { tipo: "motoboy", id: motoboyId, nome: (mb as any)?.nome ?? "Motoboy", periodo_ini: DESTINACOES_DESDE, periodo_fim: hoje, linhas: lista,
    ganho: s?.ganho ?? r2(lista.reduce((t, l) => t + l.ganho, 0)), bonus: s?.bonus ?? 0, descontos: s?.descontos ?? 0, pago: s?.pago ?? 0, compensado: s?.compensado ?? 0,
    reservado, valor: r2(Math.max(0, (s?.pendente ?? 0) - reservado)) }
}

/** Borderô em aberto (o mais recente não cancelado) de uma loja no ciclo, ou de um motoboy. */
export async function borderoAtual(sb: SupabaseClient, tipo: "loja" | "motoboy", id: string, periodoIni?: string) {
  let q = sb.from("borderos").select("id,status,valor,qtd,enviado_em,respondido_em,resposta,movimento_id,pago_em,periodo_ini,periodo_fim").eq("tipo", tipo).neq("status", "cancelado").order("criado_em", { ascending: false }).limit(1)
  q = tipo === "loja" ? q.eq("loja_id", id).eq("periodo_ini", periodoIni!) : q.eq("motoboy_id", id).neq("status", "pago")
  const { data } = await q
  return (data?.[0] as any) ?? null
}

/** Depois de pagar: marca o borderô em aberto como pago, ligado ao movimento do pagamento. */
export async function marcarBorderoPago(sb: SupabaseClient, tipo: "loja" | "motoboy", id: string, movimentoId: string | null, periodoIni?: string) {
  const b = await borderoAtual(sb, tipo, id, periodoIni)
  if (b && b.status !== "pago") await sb.from("borderos").update({ status: "pago", movimento_id: movimentoId, pago_em: new Date().toISOString() }).eq("id", b.id)
}

export const tagCiclo = chaveCiclo
