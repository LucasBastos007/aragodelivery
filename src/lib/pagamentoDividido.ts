// Pagamento em 2 formas (20/10/2026, pedido do Lucas: "todas as combinações").
//
// Colunas em pedidos: forma_pagamento (1ª forma), valor_pagamento_1, forma_pagamento_2,
// valor_pagamento_2, asaas_payment_id_2, pagamentos_online_confirmados (text[]).
// Pedido de uma forma só: forma_pagamento_2 = null e tudo funciona como antes.
//
// Cobranças no Asaas:
//  - uma parte online (pix OU cartão) → asaas_payment_id, como sempre;
//  - as duas partes online (pix + cartão) → cartão em asaas_payment_id, pix em asaas_payment_id_2.
// O pedido só vai pra loja ("pendente") quando TODAS as partes online estão confirmadas.

export const FORMAS = ["pix", "cartao", "dinheiro", "maquininha"] as const
export type Forma = typeof FORMAS[number]
export const ONLINE: readonly string[] = ["pix", "cartao"]
export const NA_ENTREGA: readonly string[] = ["dinheiro", "maquininha"]

export const NOME_FORMA: Record<string, string> = {
  pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha",
}

export type Parte = { forma: string; valor: number }

type PedidoPag = {
  forma_pagamento?: string | null
  forma_pagamento_2?: string | null
  valor_pagamento_1?: number | string | null
  valor_pagamento_2?: number | string | null
  total?: number | string | null
  asaas_payment_id?: string | null
  asaas_payment_id_2?: string | null
  pagamentos_online_confirmados?: string[] | null
}

const r2 = (v: number) => Math.round(v * 100) / 100

export function ehDividido(p: PedidoPag): boolean {
  return !!p.forma_pagamento_2
}

/** Partes do pagamento. Pedido de uma forma só devolve uma parte com o total. */
export function partesPagamento(p: PedidoPag): Parte[] {
  if (!p.forma_pagamento_2) return [{ forma: p.forma_pagamento ?? "", valor: r2(Number(p.total ?? 0)) }]
  return [
    { forma: p.forma_pagamento ?? "", valor: r2(Number(p.valor_pagamento_1 ?? 0)) },
    { forma: p.forma_pagamento_2, valor: r2(Number(p.valor_pagamento_2 ?? 0)) },
  ]
}

/** Valor de uma forma dentro do pedido (0 se a forma não faz parte). */
export function valorDaForma(p: PedidoPag, forma: string): number {
  return r2(partesPagamento(p).filter(x => x.forma === forma).reduce((s, x) => s + x.valor, 0))
}

export function temForma(p: PedidoPag, forma: string): boolean {
  return partesPagamento(p).some(x => x.forma === forma)
}

/** Quanto o motoboy/loja recebe na entrega (dinheiro + maquininha). */
export function valorNaEntrega(p: PedidoPag): number {
  return r2(partesPagamento(p).filter(x => NA_ENTREGA.includes(x.forma)).reduce((s, x) => s + x.valor, 0))
}

export function cobraNaEntrega(p: PedidoPag): boolean {
  return partesPagamento(p).some(x => NA_ENTREGA.includes(x.forma))
}

/** Pix + cartão no mesmo pedido: o pix fica na segunda cobrança (asaas_payment_id_2). */
export function duasPartesOnline(p: PedidoPag): boolean {
  return partesPagamento(p).filter(x => ONLINE.includes(x.forma)).length === 2
}

/** Coluna onde fica a cobrança de cada forma online. */
export function colunaCobranca(p: PedidoPag, forma: "pix" | "cartao"): "asaas_payment_id" | "asaas_payment_id_2" {
  return duasPartesOnline(p) && forma === "pix" ? "asaas_payment_id_2" : "asaas_payment_id"
}

/** Todas as cobranças Asaas do pedido (pra cancelar/estornar). */
export function idsCobranca(p: PedidoPag): string[] {
  return [p.asaas_payment_id, p.asaas_payment_id_2].filter((x): x is string => !!x)
}

/** Texto curto: "Pix" ou "Pix R$ 20,00 + Dinheiro R$ 30,00". */
export function rotuloPagamento(p: PedidoPag): string {
  const partes = partesPagamento(p)
  if (partes.length === 1) return NOME_FORMA[partes[0].forma] ?? partes[0].forma
  return partes.map(x => `${NOME_FORMA[x.forma] ?? x.forma} ${brl(x.valor)}`).join(" + ")
}

const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Valida o pedido de pagamento dividido vindo do checkout. Devolve as partes ou um erro.
 * valor_pagamento_1 vem do cliente; o servidor calcula a 2ª parte como total − 1ª.
 */
export function validarDivisao(forma1: string, forma2: string | null | undefined, valor1: unknown, total: number):
  { ok: true; partes: Parte[] | null } | { ok: false; erro: string } {
  if (!forma2) return { ok: true, partes: null }
  if (!FORMAS.includes(forma1 as Forma) || !FORMAS.includes(forma2 as Forma)) return { ok: false, erro: "Forma de pagamento inválida." }
  if (forma1 === forma2) return { ok: false, erro: "Escolha duas formas de pagamento diferentes." }
  const v1 = r2(Number(valor1))
  if (!isFinite(v1) || v1 < 1) return { ok: false, erro: "A primeira forma precisa ser de pelo menos R$ 1,00." }
  const v2 = r2(total - v1)
  if (v2 < 1) return { ok: false, erro: "A segunda forma precisa ser de pelo menos R$ 1,00." }
  return { ok: true, partes: [{ forma: forma1, valor: v1 }, { forma: forma2, valor: v2 }] }
}

/**
 * Marca uma cobrança online como paga. Pedido de uma forma só: vai pra "pendente" na hora
 * (comportamento de sempre). Pedido dividido: guarda o id em pagamentos_online_confirmados e
 * só vai pra "pendente" quando todas as partes online estão confirmadas.
 * Devolve true quando o pedido foi liberado pra loja nesta chamada.
 */
export async function confirmarCobranca(sb: any, pedidoId: string, paymentId: string | null): Promise<{ liberou: boolean; completo: boolean }> {
  const { data: p } = await sb.from("pedidos")
    .select("id, status, forma_pagamento, forma_pagamento_2, valor_pagamento_1, valor_pagamento_2, total, asaas_payment_id, asaas_payment_id_2, pagamentos_online_confirmados")
    .eq("id", pedidoId).maybeSingle()
  if (!p) return { liberou: false, completo: false }

  if (!ehDividido(p)) {
    if (p.status !== "aguardando_pagamento") return { liberou: false, completo: true }
    const { data } = await sb.from("pedidos").update({ status: "pendente", atualizado_em: new Date().toISOString() })
      .eq("id", pedidoId).eq("status", "aguardando_pagamento").select("id")
    return { liberou: !!data?.length, completo: true }
  }

  const confirmados = new Set<string>(p.pagamentos_online_confirmados ?? [])
  if (paymentId) confirmados.add(paymentId)
  const precisa = partesPagamento(p).filter(x => ONLINE.includes(x.forma)).length
  const validos = idsCobranca(p).filter(id => confirmados.has(id))
  const completo = validos.length >= precisa

  await sb.from("pedidos").update({ pagamentos_online_confirmados: [...confirmados] }).eq("id", pedidoId)
  if (!completo || p.status !== "aguardando_pagamento") return { liberou: false, completo }
  const { data } = await sb.from("pedidos").update({ status: "pendente", atualizado_em: new Date().toISOString() })
    .eq("id", pedidoId).eq("status", "aguardando_pagamento").select("id")
  return { liberou: !!data?.length, completo }
}
