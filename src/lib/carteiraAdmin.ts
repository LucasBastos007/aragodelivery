// Carteira do admin (20/10/2026): pra onde vai cada real que entra.
// Por pedido entregue, o que o cliente pagou vira 4 partes:
//   loja (produtos − comissão − taxa cobrada da loja − cupom da loja; inclui o que ela recebeu no
//   balcão), motoboy (ganho com piso), custo de pagamento (Asaas/maquininha, ESTIMADO) e o app
//   (o que sobra). A regra da loja e do motoboy é a mesma do fechamento (calcularPedido).
import type { SupabaseClient } from "@supabase/supabase-js"
import { calcularPedido, type CupomBase, type LojaBase, type PedidoBase } from "@/lib/regrasFinanceiras"
import { iniUtc, fimUtc, ymdBrt, INICIO_REPASSES } from "@/lib/repasseLoja"
import { saldoMotoboys } from "@/lib/saldosRepasse"

// Quanto o Asaas e a maquininha cobram do Chegô. ESTIMATIVA: confirmar com o Lucas e trocar aqui.
// Pix: Asaas cobra R$ 1,99 fixo (o desconto de R$ 0,99 acabou em 09/09/2026); Mercado Pago 0,99%
// (cobranças com id "mp_", desde 22/10/2026). O custo do Pix por pedido sai de custoPix().
export const TAXA_PIX_MP = 0.0099
export function custoPix(v: number, idCobranca: string | null | undefined, criadoEm: string): number {
  if (idCobranca?.startsWith("mp_")) return v * TAXA_PIX_MP
  return criadoEm < "2026-09-10" ? 0.99 : 1.99
}
export const CUSTO_PAGAMENTO = {
  pix: () => 1.99,
  cartao: (v: number) => v * 0.0299 + 0.49,
  maquininha: (v: number) => v * 0.0199,
} as Record<string, (v: number) => number>
export const CUSTO_ESTIMADO = true

const r2 = (v: number) => Math.round(v * 100) / 100
const n = (v: unknown) => Number(v ?? 0) || 0

export type LinhaCarteira = { id: string; codigo: string; criado_em: string; dia: string; loja_id: string; motoboy_id: string | null; forma: string
  pago: number; produtos: number; entrega: number; loja: number; mb: number; custo: number; app: number; comissao: number; taxaLoja: number; cupomLoja: number; cupomChego: number; recebidoLoja: number
  // Como o cliente pagou (maquininha separada em débito e crédito quando a entrega registrou)
  meios: Record<string, number> }

const SEL = "id,codigo,loja_id,motoboy_id,status,forma_pagamento,forma_pagamento_2,valor_pagamento_1,valor_pagamento_2,subtotal,taxa_entrega,taxa_dinamica,total,desconto,cupom_codigo,frete_gratis,frete_absorvido_por,endereco_entrega,criado_em,tipo_cartao_entrega,observacao,asaas_payment_id,asaas_payment_id_2"

export async function linhasCarteira(sb: SupabaseClient, de: string, ate: string): Promise<LinhaCarteira[]> {
  const peds: any[] = []
  for (let i = 0; i < 100_000; i += 1000) {
    const { data, error } = await sb.from("pedidos").select(SEL).eq("status", "entregue").gte("criado_em", iniUtc(de)).lte("criado_em", fimUtc(ate)).order("criado_em").range(i, i + 999)
    if (error) throw error
    peds.push(...(data ?? [])); if ((data ?? []).length < 1000) break
  }
  const [{ data: lojas }, { data: cupons }] = await Promise.all([sb.from("lojas").select("id,nome,comissao,participacao_entrega"), sb.from("cupons").select("codigo,loja_id")])
  const L = new Map<string, LojaBase>((lojas ?? []).map((l: any) => [l.id, l]))
  const C = new Map<string, CupomBase>((cupons ?? []).map((c: any) => [String(c.codigo).toUpperCase(), c]))
  return peds.map(p => {
    const c = calcularPedido(p as PedidoBase, L.get(p.loja_id) ?? { id: p.loja_id, nome: "", comissao: 0 }, p.cupom_codigo ? C.get(String(p.cupom_codigo).toUpperCase()) ?? null : null)
    const custo = c.partes.filter(x => x.recebidoPor !== "loja" && x.recebidoPor !== "motoboy_dinheiro").reduce((s, x) => s + (x.forma === "pix" ? custoPix(x.valor, idPix(p), p.criado_em) : CUSTO_PAGAMENTO[x.forma]?.(x.valor) ?? 0), 0)
    const loja = c.liquidoLoja + c.recebidoPelaLoja
    const pago = c.totalCliente, mb = c.ganhoMotoboy
    return { id: p.id, codigo: p.codigo, criado_em: p.criado_em, dia: ymdBrt(new Date(p.criado_em)), loja_id: p.loja_id, motoboy_id: p.motoboy_id, forma: p.forma_pagamento_2 ? `${p.forma_pagamento}+${p.forma_pagamento_2}` : p.forma_pagamento,
      // Sem arredondar por pedido: as telas somam e arredondam só o total, igual ao fechamento diário
      // (senão lojas com muitos pedidos ficam 1 centavo diferentes). A tela formata em R$ com 2 casas.
      pago: pago, produtos: c.produtos, entrega: c.entrega, loja, mb, custo, app: pago - loja - mb - custo,
      comissao: c.comissao, taxaLoja: c.taxaPagamento, cupomLoja: c.descontoLoja, cupomChego: c.descontoChego, recebidoLoja: c.recebidoPelaLoja,
      meios: c.partes.reduce((m: Record<string, number>, x) => { const k = x.forma === "maquininha" ? `maquininha_${tipoMaquininha(p) ?? "sem_tipo"}` : x.forma; m[k] = r2((m[k] ?? 0) + x.valor); return m }, {}) }
  })
}

/** Id da cobrança Pix do pedido: no pix + cartão o pix fica em asaas_payment_id_2 (lib/pagamentoDividido). */
function idPix(p: any): string | null {
  return p.forma_pagamento_2 && [p.forma_pagamento, p.forma_pagamento_2].includes("cartao") ? p.asaas_payment_id_2 : p.asaas_payment_id
}

/** Saldo no Mercado Pago (22/10/2026). A API do Mercado Pago não informa o saldo: o admin digita o saldo do
 *  app (configuracoes.mp_saldo) e o sistema soma sozinho os Pix pagos depois, já sem a taxa de 0,99%. Pix
 *  cai na hora (não tem "a receber"). Sem nada digitado, conta todos os Pix do Mercado Pago desde o início.
 *  Transferência pro Asaas e estorno o sistema não vê: aí o admin corrige com o valor do app. */
export type SaldoMp = { saldo: number; em: string | null; digitado: number; vendas: number; recebido: number; daConta?: boolean }
export async function lerSaldoMp(sb: SupabaseClient): Promise<SaldoMp | null> {
  const { data } = await sb.from("configuracoes").select("valor").eq("chave", "mp_saldo").maybeSingle()
  let base = { saldo: 0, em: null as string | null, daConta: false }
  try { const j = JSON.parse(String(data?.valor ?? "")); if (j.em && !isNaN(+new Date(j.em))) base = { saldo: n(j.saldo), em: String(j.em), daConta: j.fonte === "mercadopago" } } catch {}
  let q = sb.from("pedidos").select("forma_pagamento,forma_pagamento_2,valor_pagamento_1,valor_pagamento_2,total,asaas_payment_id,asaas_payment_id_2")
    .or("asaas_payment_id.like.mp_%,asaas_payment_id_2.like.mp_%").not("status", "in", "(aguardando_pagamento,cancelado)").limit(10000)
  if (base.em) q = q.gt("criado_em", base.em)
  const { data: peds } = await q
  if (!base.em && !(peds ?? []).length) return null
  let recebido = 0
  for (const p of (peds ?? []) as any[]) {
    if (!idPix(p)?.startsWith("mp_")) continue
    recebido += p.forma_pagamento_2 ? (p.forma_pagamento === "pix" ? n(p.valor_pagamento_1) : n(p.valor_pagamento_2)) : n(p.total)
  }
  return { saldo: r2(base.saldo + recebido * (1 - TAXA_PIX_MP)), em: base.em, digitado: base.saldo, vendas: (peds ?? []).length, recebido: r2(recebido), daConta: base.daConta }
}

/** Saldo da Ton (maquininha). A Ton não tem API (21/10/2026, opção 1 do Lucas): o admin digita o saldo e o
 *  "a receber" do app da Ton (configuracoes.ton_saldo) e o sistema segue sozinho a partir dali, somando as
 *  vendas na maquininha entregues depois, já sem a taxa. A Ton libera no dia seguinte: venda de hoje fica
 *  em "a receber" e vira saldo amanhã. Retirada da conta da Ton o sistema não vê: aí o admin corrige.
 *  Taxa do débito medida em 21/10: venda de R$ 84,00 (#2CN3J9, débito) virou R$ 82,89 (1,32%).
 *  Crédito: a mesma taxa (confirmado pelo Lucas em 21/10/2026). */
export const TAXA_TON = { debito: 0.0132, credito: 0.0132 }
/** Débito ou crédito da maquininha: o checkout grava "💳 Maquininha: Crédito/Débito" na observação;
 *  pedidos feitos pela loja usam a coluna tipo_cartao_entrega. */
export function tipoMaquininha(p: { tipo_cartao_entrega?: string | null; observacao?: string | null }): "debito" | "credito" | null {
  if (p.tipo_cartao_entrega === "debito" || p.tipo_cartao_entrega === "credito") return p.tipo_cartao_entrega
  const m = String(p.observacao ?? "").match(/Maquininha:\s*(Crédito|Débito)/i)
  return m ? (/^d/i.test(m[1]) ? "debito" : "credito") : null
}
export type SaldoTon = { saldo: number; aReceber: number; em: string; digitado: { saldo: number; aReceber: number }; vendas: number; vendido: number }
export async function lerSaldoTon(sb: SupabaseClient, hoje = ymdBrt()): Promise<SaldoTon | null> {
  const { data } = await sb.from("configuracoes").select("valor").eq("chave", "ton_saldo").maybeSingle()
  let base: { saldo: number; aReceber: number; em: string }
  try { const j = JSON.parse(String(data?.valor ?? "")); base = { saldo: n(j.saldo), aReceber: n(j.aReceber), em: String(j.em ?? "") } } catch { return null }
  if (!base.em || isNaN(+new Date(base.em))) return null
  const { data: peds } = await sb.from("pedidos").select("forma_pagamento,forma_pagamento_2,valor_pagamento_1,valor_pagamento_2,total,entregue_em,tipo_cartao_entrega,observacao")
    .eq("status", "entregue").or("forma_pagamento.eq.maquininha,forma_pagamento_2.eq.maquininha").gt("entregue_em", base.em).limit(5000)
  const diaBase = ymdBrt(new Date(base.em))
  // O "a receber" digitado já virou saldo se o dia virou
  let saldo = base.saldo + (hoje > diaBase ? base.aReceber : 0), aReceber = hoje > diaBase ? 0 : base.aReceber, vendido = 0
  for (const p of (peds ?? []) as any[]) {
    const v = p.forma_pagamento === "maquininha" ? n(p.valor_pagamento_1 ?? p.total) : n(p.valor_pagamento_2)
    if (!(v > 0)) continue
    vendido += v
    const liq = v * (1 - TAXA_TON[tipoMaquininha(p) ?? "credito"])
    if (ymdBrt(new Date(p.entregue_em)) < hoje) saldo += liq; else aReceber += liq
  }
  return { saldo: r2(saldo), aReceber: r2(aReceber), em: base.em, digitado: { saldo: base.saldo, aReceber: base.aReceber }, vendas: (peds ?? []).length, vendido: r2(vendido) }
}

/** Dinheiro do Chegô dividido (21/10/2026): Asaas + Ton + Mercado Pago (22/10) + dinheiro que os motoboys receberam dos clientes
 *  e ainda não prestaram conta. Disso, é das lojas (repasse), dos motoboys (saldo desde 16/10, a mesma
 *  conta da tela de Repasses), reservado (reembolsos) e o resto é do app.
 *  Também devolve quanto é de cada loja e de cada motoboy, pra abrir o "saldo de repasse". */
export async function divisaoSaldo(sb: SupabaseClient, saldoAsaas: number | null) {
  const hoje = ymdBrt()
  const [linhas, { data: movs }, { data: adiant }, mbsSaldo, { data: reembs }, { data: lojas }, ton] = await Promise.all([
    linhasCarteira(sb, INICIO_REPASSES, hoje),
    sb.from("movimentos_financeiros").select("valor,externo_id,motivo,loja_id").eq("tipo", "repasse").is("cancelado_em", null).gte("ocorrido_em", iniUtc(INICIO_REPASSES)),
    sb.from("saques").select("valor,loja_id").eq("tipo", "lojista").not("status", "in", "(cancelado,recusado)").gte("criado_em", iniUtc(INICIO_REPASSES)),
    saldoMotoboys(sb, hoje),
    sb.from("reembolsos").select("valor_solicitado, pedido:pedidos(total)").eq("status", "solicitado"),
    sb.from("lojas").select("id,nome,logo_url"),
    lerSaldoTon(sb),
  ])
  const mp = await lerSaldoMp(sb)
  // Por loja: o que ela tem a receber desde 16/10 (sem o que já pegou no balcão), menos repasses
  // do sistema novo (marca do ciclo no registro) e adiantamentos de terça
  const por = new Map<string, number>()
  for (const l of linhas) por.set(l.loja_id, (por.get(l.loja_id) ?? 0) + l.loja - l.recebidoLoja)
  for (const m of (movs ?? []) as any[]) if (m.loja_id && /repasse_ciclo:/.test(String(m.externo_id ?? "") + String(m.motivo ?? ""))) por.set(m.loja_id, (por.get(m.loja_id) ?? 0) - n(m.valor))
  for (const a of (adiant ?? []) as any[]) if (a.loja_id) por.set(a.loja_id, (por.get(a.loja_id) ?? 0) - n(a.valor))
  const L = new Map((lojas ?? []).map((l: any) => [l.id, l]))
  const porLoja = [...por.entries()].map(([id, v]) => ({ id, nome: (L.get(id) as any)?.nome ?? "Loja", logo: (L.get(id) as any)?.logo_url ?? null, v: r2(v) })).filter(x => x.v > 0.004).sort((a, b) => b.v - a.v)
  const porMb = mbsSaldo.filter(m => m.pendente > 0.004).map(m => ({ id: m.id, nome: m.nome, v: r2(m.pendente), n: m.entregas })).sort((a, b) => b.v - a.v)
  const porDinheiro = mbsSaldo.filter(m => m.dinheiroAPrestar > 0.004).map(m => ({ id: m.id, nome: m.nome, v: r2(m.dinheiroAPrestar) })).sort((a, b) => b.v - a.v)
  const devidoLojas = porLoja.reduce((t, x) => t + x.v, 0)
  const mbs = porMb.reduce((t, x) => t + x.v, 0)
  const dinheiro = porDinheiro.reduce((t, x) => t + x.v, 0)
  const reservado = (reembs ?? []).reduce((s: number, r: any) => s + n(r.valor_solicitado ?? r.pedido?.total), 0)
  const asaas = saldoAsaas ?? 0, total = asaas + (ton?.saldo ?? 0) + (mp?.saldo ?? 0) + dinheiro
  return { total: r2(total), asaas: r2(asaas), ton, mp, dinheiro: r2(dinheiro), lido: saldoAsaas != null, lojas: r2(devidoLojas), motoboys: r2(mbs), reservado: r2(reservado), app: r2(total - devidoLojas - mbs - reservado), porLoja, porMb, porDinheiro }
}
