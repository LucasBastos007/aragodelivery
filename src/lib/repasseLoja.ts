// Repasse semanal da loja (20/10/2026, regra do Lucas):
// - Ciclo de SEXTA a QUINTA (horário de Brasília). O repasse do ciclo cai na sexta seguinte.
// - Depois do pagamento o saldo volta pra zero e o ciclo novo começa a contar.
// - Primeiro ciclo controlado aqui: sexta 16/10/2026. Vendas antes disso já foram acertadas.
// - Valor da loja por pedido = calcularPedido().liquidoLoja (regra validada do fechamento):
//   produtos − cupom da loja − comissão − taxa de pagamento (Pix R$ 1,00; cartão 1,99% + R$ 0,49;
//   maquininha 3,08%) − participação na entrega − o que a loja já recebeu no balcão.
// - Ajustes manuais da loja (movimentos ajuste_credito/ajuste_debito) entram no ciclo pela data
//   em que ocorreram, a partir do ciclo de 30/10/2026 (06/11/2026, pedido do Lucas; os de antes
//   já foram acertados nos repasses daquelas semanas).
// - Repasses pagos ficam em movimentos_financeiros (tipo "repasse"), com o ciclo no externo_id.
import type { SupabaseClient } from "@supabase/supabase-js"
import { calcularPedido, type CupomBase, type LojaBase, type PedidoBase } from "@/lib/regrasFinanceiras"

export const INICIO_REPASSES = "2026-10-16"
export const AJUSTES_NO_REPASSE_DESDE = "2026-10-30"

const r2 = (v: number) => Math.round(v * 100) / 100
const n = (v: unknown) => Number(v ?? 0) || 0

/** Data (AAAA-MM-DD) em Brasília. Sem argumento = hoje. Fora da produção, CHEGO_HOJE_TESTE
 *  (AAAA-MM-DD) simula outro dia, pra testar o pagamento de sexta antes da sexta. */
export function ymdBrt(d?: Date): string {
  if (!d && process.env.NODE_ENV !== "production" && /^\d{4}-\d{2}-\d{2}$/.test(process.env.CHEGO_HOJE_TESTE ?? "")) return process.env.CHEGO_HOJE_TESTE!
  return new Date((d ?? new Date()).getTime() - 3 * 3600_000).toISOString().slice(0, 10)
}
export function somaDiasYmd(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10)
}
const diaSemana = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay()
export const iniUtc = (ymd: string) => new Date(`${ymd}T00:00:00-03:00`).toISOString()
export const fimUtc = (ymd: string) => new Date(`${ymd}T23:59:59.999-03:00`).toISOString()

export type Ciclo = { ini: string; fim: string; paga: string }
/** Ciclo (sexta a quinta) que contém a data. */
export function cicloDe(ymd: string): Ciclo {
  const ini = somaDiasYmd(ymd, -((diaSemana(ymd) - 5 + 7) % 7))
  return { ini, fim: somaDiasYmd(ini, 6), paga: somaDiasYmd(ini, 7) }
}
export const cicloAnterior = (c: Ciclo): Ciclo => cicloDe(somaDiasYmd(c.ini, -1))
export const chaveCiclo = (lojaId: string, c: Ciclo) => `repasse_ciclo:${lojaId}:${c.ini}`

export type LinhaRepasse = {
  id: string; codigo: string; criado_em: string; dia: string; forma: string; forma_2: string | null
  produtos: number; cupomLoja: number; comissao: number; taxaOnline: number; taxaMaquininha: number
  participacaoEntrega: number; recebidoPelaLoja: number; liquido: number; itens: { nome: string; quantidade: number; preco: number }[]
}
export type ResumoRepasse = {
  ciclo: Ciclo; pedidos: number; avulsas: number; qtdAvulsas: number; produtos: number
  vendasApp: number; vendasEntrega: number; recebidoPelaLoja: number
  comissao: number; taxaOnline: number; taxaMaquininha: number; cupomLoja: number; participacaoEntrega: number
  ajustes: number; ajustesLista: { valor: number; motivo: string; dia: string }[]
  liquido: number; porDia: { dia: string; produtos: number; pedidos: number }[]; linhas: LinhaRepasse[]
}

/** Calcula o repasse de uma loja num ciclo, pedido a pedido. Só pedidos entregues. */
export async function calcularRepasse(sb: SupabaseClient, lojaId: string, ciclo: Ciclo, opts: { itens?: boolean; semCorte?: boolean } = {}): Promise<ResumoRepasse> {
  // semCorte: consulta de vendas por período (não é repasse), vale qualquer data
  const ini = !opts.semCorte && ciclo.ini < INICIO_REPASSES ? INICIO_REPASSES : ciclo.ini
  const SEL = "id,codigo,loja_id,motoboy_id,status,forma_pagamento,forma_pagamento_2,valor_pagamento_1,valor_pagamento_2,subtotal,taxa_entrega,taxa_dinamica,total,desconto,cupom_codigo,frete_gratis,frete_absorvido_por,endereco_entrega,criado_em"
  // O banco devolve no máximo 1.000 linhas por consulta: busca em páginas
  async function todosPedidos() {
    const out: any[] = []
    for (let de = 0; de < 50_000; de += 1000) {
      const { data, error } = await sb.from("pedidos").select(SEL).eq("loja_id", lojaId).eq("status", "entregue")
        .gte("criado_em", iniUtc(ini)).lte("criado_em", fimUtc(ciclo.fim)).order("criado_em").range(de, de + 999)
      if (error) throw error
      out.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }
    return out
  }
  const [{ data: loja }, peds, { data: cupons }] = await Promise.all([
    sb.from("lojas").select("id,nome,comissao,participacao_entrega").eq("id", lojaId).single(),
    todosPedidos(),
    sb.from("cupons").select("codigo,loja_id"),
  ])
  const C = new Map<string, CupomBase>((cupons ?? []).map((c: any) => [String(c.codigo).toUpperCase(), c]))
  const L: LojaBase = (loja as any) ?? { id: lojaId, nome: "", comissao: 0 }

  let itensPor = new Map<string, { nome: string; quantidade: number; preco: number }[]>()
  if (opts.itens && (peds ?? []).length) {
    const ids = (peds ?? []).map((p: any) => p.id)
    for (let i = 0; i < ids.length; i += 300) {
      const { data: it } = await sb.from("itens_pedido").select("pedido_id,nome,quantidade,preco").in("pedido_id", ids.slice(i, i + 300))
      for (const x of it ?? []) { const l = itensPor.get((x as any).pedido_id) ?? []; l.push({ nome: (x as any).nome, quantidade: n((x as any).quantidade), preco: n((x as any).preco) }); itensPor.set((x as any).pedido_id, l) }
    }
  }

  // Totais somados SEM arredondar pedido a pedido e arredondados só no fim, igual ao fechamento
  // diário (destinacoesFinanceiras). Assim o valor pago bate no centavo com o fechamento.
  const bruto: Record<string, number> = { produtos: 0, cupomLoja: 0, comissao: 0, taxaOnline: 0, taxaMaquininha: 0, participacaoEntrega: 0, recebidoPelaLoja: 0, liquido: 0, vendasApp: 0 }
  const online = (f: string | null) => f === "pix" || f === "cartao"
  const linhas: LinhaRepasse[] = (peds ?? []).map((p: any) => {
    const c = calcularPedido(p as PedidoBase, L, p.cupom_codigo ? C.get(String(p.cupom_codigo).toUpperCase()) ?? null : null)
    const taxaMaq = c.partes.filter(x => x.forma === "maquininha").reduce((s, x) => s + x.taxa, 0)
    bruto.produtos += c.produtos; bruto.cupomLoja += c.descontoLoja; bruto.comissao += c.comissao; bruto.taxaOnline += c.taxaPagamento - taxaMaq; bruto.taxaMaquininha += taxaMaq
    bruto.participacaoEntrega += c.participacaoEntrega; bruto.recebidoPelaLoja += c.recebidoPelaLoja; bruto.liquido += c.liquidoLoja
    if (online(p.forma_pagamento) && !p.forma_pagamento_2) bruto.vendasApp += c.produtos
    return {
      id: p.id, codigo: p.codigo, criado_em: p.criado_em, dia: ymdBrt(new Date(p.criado_em)), forma: p.forma_pagamento, forma_2: p.forma_pagamento_2 ?? null,
      produtos: r2(c.produtos), cupomLoja: r2(c.descontoLoja), comissao: r2(c.comissao), taxaOnline: r2(c.taxaPagamento - taxaMaq), taxaMaquininha: r2(taxaMaq),
      participacaoEntrega: r2(c.participacaoEntrega), recebidoPelaLoja: r2(c.recebidoPelaLoja), liquido: r2(c.liquidoLoja), itens: itensPor.get(p.id) ?? [],
    }
  })
  const soma = (k: string) => r2(bruto[k])
  const porDiaMap = new Map<string, { dia: string; produtos: number; pedidos: number }>()
  for (let d = ini; d <= ciclo.fim; d = somaDiasYmd(d, 1)) porDiaMap.set(d, { dia: d, produtos: 0, pedidos: 0 })
  for (const l of linhas) { const x = porDiaMap.get(l.dia); if (x) { x.produtos = r2(x.produtos + l.produtos); x.pedidos++ } }
  const produtos = soma("produtos"), recebido = soma("recebidoPelaLoja")
  // Vendas que passaram pelo Chegô: app (Pix/cartão) e na entrega (dinheiro/maquininha com o motoboy)
  const vendasApp = soma("vendasApp")
  // Entregas avulsas da tabela antiga no ciclo: a loja paga a corrida (taxa + R$ 1 nas de R$ 3) e a
  // comissão dos itens. Mesma regra do fechamento (destinacoesFinanceiras), pra pagar o valor certo.
  const { data: avs } = await sb.from("entregas_avulsas").select("taxa_entrega,comissao_valor").eq("loja_id", lojaId).eq("status", "entregue")
    .gte("criado_em", iniUtc(ini)).lte("criado_em", fimUtc(ciclo.fim))
  const avulsas = r2((avs ?? []).reduce((t: number, a: any) => { const tx = n(a.taxa_entrega); return t + tx + (tx === 3 ? 1 : 0) + n(a.comissao_valor) }, 0))
  // Ajustes manuais do admin (crédito soma, débito desconta), mesma regra do fechamento (destinacoesFinanceiras)
  const iniAj = ini < AJUSTES_NO_REPASSE_DESDE ? AJUSTES_NO_REPASSE_DESDE : ini
  const { data: ajs } = iniAj > ciclo.fim ? { data: [] as any[] } : await sb.from("movimentos_financeiros").select("tipo,valor,motivo,ocorrido_em").eq("loja_id", lojaId)
    .in("tipo", ["ajuste_credito", "ajuste_debito"]).is("cancelado_em", null).gte("ocorrido_em", iniUtc(iniAj)).lte("ocorrido_em", fimUtc(ciclo.fim)).order("ocorrido_em")
  const ajustesLista = ((ajs ?? []) as any[]).map(a => ({ valor: r2(a.tipo === "ajuste_debito" ? -n(a.valor) : n(a.valor)), motivo: String(a.motivo ?? "Ajuste"), dia: ymdBrt(new Date(a.ocorrido_em)) }))
  const ajustes = r2(ajustesLista.reduce((t, a) => t + a.valor, 0))
  return {
    ciclo, pedidos: linhas.length, produtos, avulsas, qtdAvulsas: (avs ?? []).length,
    vendasApp, vendasEntrega: r2(produtos - vendasApp - recebido), recebidoPelaLoja: recebido,
    comissao: soma("comissao"), taxaOnline: soma("taxaOnline"), taxaMaquininha: soma("taxaMaquininha"),
    cupomLoja: soma("cupomLoja"), participacaoEntrega: soma("participacaoEntrega"), ajustes, ajustesLista,
    liquido: r2(bruto.liquido - avulsas + ajustes), porDia: [...porDiaMap.values()], linhas,
  }
}

/** Repasses já registrados da loja (mais recentes primeiro). */
export async function repassesPagos(sb: SupabaseClient, lojaId: string, limite = 20) {
  const { data } = await sb.from("movimentos_financeiros").select("id,valor,ocorrido_em,motivo,origem,externo_id,responsavel,comprovante_path")
    .eq("loja_id", lojaId).eq("tipo", "repasse").is("cancelado_em", null).order("ocorrido_em", { ascending: false }).limit(limite)
  return (data ?? []).map((m: any) => ({ ...m, valor: n(m.valor) }))
}

/** Chave Pix da loja (lojas.pix_key ou pix_chave; aceita JSON {pix: ...}). */
export function chavePixLoja(l: { pix_key?: string | null; pix_chave?: string | null }): string | null {
  for (const v of [l.pix_key, l.pix_chave]) {
    const s = String(v ?? "").trim(); if (!s) continue
    if (s.startsWith("{")) { try { const j = JSON.parse(s); if (j?.pix) return String(j.pix).trim() } catch {} continue }
    return s
  }
  return null
}
const cpfValido = (d: string) => {
  if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false
  const dv = (k: number) => { let s = 0; for (let i = 0; i < k; i++) s += Number(d[i]) * (k + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}
/** Tipo provável da chave. 11 dígitos pode ser CPF ou celular: quem paga sempre confirma. */
export function tipoChaveSugerido(chave: string): { tipo: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP"; certeza: boolean } {
  const s = chave.trim(), d = s.replace(/\D/g, "")
  if (s.includes("@")) return { tipo: "EMAIL", certeza: true }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return { tipo: "EVP", certeza: true }
  if (d.length === 14) return { tipo: "CNPJ", certeza: true }
  if (s.startsWith("+") || d.length === 13) return { tipo: "PHONE", certeza: true }
  if (d.length === 11) return cpfValido(d) ? { tipo: "CPF", certeza: false } : { tipo: "PHONE", certeza: false }
  return { tipo: "PHONE", certeza: false }
}

/** Adiantamentos de terça pedidos dentro do ciclo (saques da loja não cancelados). Saem do
 *  repasse de sexta: a loja já recebeu esse valor (menos a taxa de R$ 5,00) na terça. */
export async function adiantamentosCiclo(sb: SupabaseClient, lojaId: string, c: Ciclo) {
  const { data } = await sb.from("saques").select("id,valor,status,criado_em,taxa_saque").eq("loja_id", lojaId).eq("tipo", "lojista")
    .not("status", "in", "(cancelado,recusado)").gte("criado_em", iniUtc(c.ini)).lte("criado_em", fimUtc(c.fim))
  const lista = (data ?? []).map((s: any) => ({ ...s, valor: n(s.valor) }))
  return { lista, total: r2(lista.reduce((t, s) => t + s.valor, 0)) }
}

/** Confere se a chave Pix é de verdade pro tipo escolhido e devolve como o Asaas espera (21/10/2026).
 *  Texto como "Itaú Ag:0001 Cc:123" (conta bancária) é recusado: nunca manda Pix pra chave inventada. */
export function validarChavePix(chave: string | null | undefined, tipo: string): { ok: true; chave: string } | { ok: false; motivo: string } {
  const s = String(chave ?? "").trim(), d = s.replace(/\D/g, "")
  if (!s) return { ok: false, motivo: "Não tem chave Pix cadastrada." }
  const soNumerosEFormato = /^[\d\s().+\-\/]+$/.test(s)
  if (tipo === "CPF") return soNumerosEFormato && cpfValido(d) ? { ok: true, chave: d } : { ok: false, motivo: "Não é um CPF válido." }
  if (tipo === "CNPJ") return soNumerosEFormato && d.length === 14 && !/^(\d)\1+$/.test(d) ? { ok: true, chave: d } : { ok: false, motivo: "Não é um CNPJ válido." }
  if (tipo === "EMAIL") return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? { ok: true, chave: s.toLowerCase() } : { ok: false, motivo: "Não é um e-mail válido." }
  if (tipo === "EVP") return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? { ok: true, chave: s.toLowerCase() } : { ok: false, motivo: "Não é uma chave aleatória válida." }
  if (tipo === "PHONE") {
    const n = d.length === 13 && d.startsWith("55") ? d.slice(2) : d.length === 12 && d.startsWith("55") ? d.slice(2) : d
    return soNumerosEFormato && (n.length === 10 || n.length === 11) && Number(n.slice(0, 2)) >= 11 ? { ok: true, chave: n } : { ok: false, motivo: "Não é um celular com DDD válido." }
  }
  return { ok: false, motivo: "Escolha o tipo da chave Pix." }
}
/** A chave serve pra algum tipo? Usado pela tela pra avisar antes (sem certeza do tipo). */
export function chavePixParece(chave: string | null | undefined) {
  return ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"].some(t => validarChavePix(chave, t).ok)
}
