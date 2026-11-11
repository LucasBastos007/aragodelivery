// Regras financeiras por pedido — fonte única usada pelo fechamento financeiro diário.
// Validadas com o Lucas nos repasses de 09 a 15/10/2026 e no plano do fechamento (16/10):
//
// - Comissão: `lojas.comissao`% sobre os produtos (subtotal). Loja com comissão 0 (plano
//   Black — Petiscaria) é isenta.
// - Pedido avulso (código "AV"): sem comissão até 11/10/2026; a partir de 12/10/2026,
//   COMISSAO_AVULSA_PCT sobre os produtos, exceto loja isenta.
// - Taxa de pagamento cobrada da loja: Pix R$ 1,00 · maquininha da Chegô 3,08% · cartão
//   online 1,99% + R$ 0,49 · dinheiro sem taxa. Nada quando a loja recebeu direto.
// - Quem recebe o dinheiro:
//     · Pix/cartão online → conta Asaas da Chegô
//     · Maquininha/dinheiro em ENTREGA feita por motoboy → Chegô (maquininha do app /
//       dinheiro fica com o motoboy até prestar contas)
//     · Maquininha/dinheiro em RETIRADA → a própria loja, no balcão
//     · "Pix pago à loja" → a própria loja
//   Quando a loja recebeu, o valor que ela recebeu é abatido do repasse (e a taxa de
//   entrega que veio junto volta para o motoboy por esse abatimento).
// - `lojas.participacao_entrega`: R$ por entrega que a loja assume (Armazém Gastrobar e
//   Petiscaria: R$ 1,00 em TODA entrega). Cobrada separada da comissão.
// - Corrida dinâmica (25/10/2026): `taxa_dinamica` do pedido, paga pelo cliente, soma inteira
//   no ganho do motoboy; não entra em piso, corte, comissão nem taxa de pagamento da loja.
// - Motoboy: `ganhoMotoboy` de lib/comissao.ts (taxa de entrega, mínimo R$ 4,00). A
//   diferença até o mínimo é custo da Chegô ("complemento do piso").
// - Desconto/cupom: cupom com `loja_id` = custeado pela loja (abatido do repasse); sem
//   `loja_id` = custeado pela Chegô. Desconto sem cupom = financiador não identificado
//   (tratado como Chegô e sinalizado na conciliação). Cupom PROMOCHEGO10 (promoção de
//   05/11/2026, lib/promoChego) não existe em `cupons` e conta como custeado pela Chegô.

import { ganhoMotoboy } from "@/lib/comissao"
import { PROMO_CODIGO } from "@/lib/promoChego"

export const AVULSA_COMISSAO_DESDE = "2026-10-12T00:00:00-03:00"
export const COMISSAO_AVULSA_PCT = 10

export type FormaGrupo = "pix" | "cartao" | "dinheiro" | "outro"
export type RecebidoPor = "asaas" | "maquininha_app" | "motoboy_dinheiro" | "loja"

export type PedidoBase = {
  id: string
  codigo: string
  loja_id: string
  motoboy_id: string | null
  status: string
  forma_pagamento: string
  // Pagamento em 2 formas (20/10/2026): cada parte entra com o próprio valor (lib/pagamentoDividido)
  forma_pagamento_2?: string | null
  valor_pagamento_1?: number | string | null
  valor_pagamento_2?: number | string | null
  subtotal: number | string
  taxa_entrega: number | string
  /** Corrida dinâmica (chuva): o cliente paga, vai inteira pro motoboy. 0 na maioria. */
  taxa_dinamica?: number | string | null
  total: number | string
  desconto?: number | string | null
  cupom_codigo?: string | null
  frete_gratis?: boolean | null
  frete_absorvido_por?: string | null
  endereco_entrega?: string | null
  criado_em: string
}

export type LojaBase = { id: string; nome: string; comissao: number | string | null; participacao_entrega?: number | string | null }
export type CupomBase = { codigo: string; loja_id: string | null }

export type CalculoPedido = {
  isAvulsa: boolean
  isRetirada: boolean
  formaGrupo: FormaGrupo
  recebidoPor: RecebidoPor
  /** Uma parte por forma de pagamento (uma só quando o pedido não foi dividido). */
  partes: { forma: string; valor: number; recebidoPor: RecebidoPor; taxa: number }[]
  produtos: number
  entrega: number
  /** Corrida dinâmica paga pelo cliente (já somada em ganhoMotoboy). */
  dinamica: number
  desconto: number
  descontoLoja: number
  descontoChego: number
  descontoFinanciador: "loja" | "chego" | "nao_identificado" | null
  totalCliente: number
  comissaoPct: number
  comissao: number
  taxaPagamento: number
  participacaoEntrega: number
  recebidoPelaLoja: number
  liquidoLoja: number
  ganhoMotoboy: number
  complementoPiso: number
  corteEntrega: number
  entregaSemMotoboy: number
  dinheiroComMotoboy: number
  valorConfere: boolean
}

const n = (v: unknown) => Number(v ?? 0) || 0

export function isRetirada(p: Pick<PedidoBase, "endereco_entrega">): boolean {
  return /retirada/i.test(p.endereco_entrega ?? "")
}

export function isAvulsa(p: Pick<PedidoBase, "codigo">): boolean {
  return /^AV/i.test(p.codigo ?? "")
}

export function formaGrupo(forma: string): FormaGrupo {
  if (forma === "pix" || forma === "pix_loja") return "pix"
  if (forma === "cartao" || forma === "maquininha") return "cartao"
  if (forma === "dinheiro") return "dinheiro"
  return "outro"
}

export function taxaPagamentoLoja(forma: string, valor: number): number {
  if (forma === "pix") return 1
  if (forma === "maquininha") return valor * 0.0308
  if (forma === "cartao") return valor * 0.0199 + 0.49
  return 0
}

export function calcularPedido(p: PedidoBase, loja: LojaBase, cupom?: CupomBase | null): CalculoPedido {
  const produtos = n(p.subtotal), entrega = n(p.taxa_entrega), totalCliente = n(p.total), desconto = n(p.desconto)
  // Corrida dinâmica: fora de `entrega` pra piso, cortes e taxas seguirem como antes
  const dinamica = n(p.taxa_dinamica)
  const retirada = isRetirada(p), avulsa = isAvulsa(p)
  const forma = p.forma_pagamento

  const quemRecebe = (f: string): RecebidoPor =>
    f === "pix_loja" ? "loja"
    : f === "pix" || f === "cartao" ? "asaas"
    : retirada ? "loja"
    : f === "dinheiro" ? "motoboy_dinheiro"
    : "maquininha_app"
  const recebidoPor = quemRecebe(forma)
  const partes = (p.forma_pagamento_2
    ? [{ forma, valor: n(p.valor_pagamento_1) }, { forma: p.forma_pagamento_2, valor: n(p.valor_pagamento_2) }]
    : [{ forma, valor: totalCliente }]
  ).map((x, i) => {
    const rp = quemRecebe(x.forma)
    // A taxa da maquininha/cartão cobrada da loja não incide sobre a dinâmica (que é do motoboy)
    const base = i === 0 ? Math.max(0, x.valor - dinamica) : x.valor
    return { ...x, recebidoPor: rp, taxa: rp === "loja" ? 0 : taxaPagamentoLoja(x.forma, base) }
  })

  const lojaPct = n(loja.comissao)
  let comissaoPct: number
  if (avulsa) comissaoPct = new Date(p.criado_em).getTime() < new Date(AVULSA_COMISSAO_DESDE).getTime() || lojaPct === 0 ? 0 : COMISSAO_AVULSA_PCT
  else comissaoPct = lojaPct
  const comissao = produtos * comissaoPct / 100

  // Promoção Chegô 10% (05/11/2026): não tem linha em `cupons`, é sempre custo da Chegô
  if (!cupom && String(p.cupom_codigo ?? "").toUpperCase() === PROMO_CODIGO) cupom = { codigo: PROMO_CODIGO, loja_id: null }
  let descontoFinanciador: CalculoPedido["descontoFinanciador"] = null
  let descontoLoja = 0, descontoChego = 0
  if (desconto > 0) {
    if (cupom?.loja_id) { descontoFinanciador = "loja"; descontoLoja = desconto }
    else if (cupom) { descontoFinanciador = "chego"; descontoChego = desconto }
    else { descontoFinanciador = "nao_identificado"; descontoChego = desconto }
  }
  // Frete grátis: a taxa fica registrada no pedido mas o cliente não pagou. Quem bancou
  // vem de `frete_absorvido_por` ("app" = Chegô, "loja" = loja); sem isso, pelo cupom.
  const descontoFrete = p.frete_gratis ? Math.max(0, produtos + entrega + dinamica - desconto - totalCliente) : 0
  if (descontoFrete > 0.004) {
    const pelaLoja = p.frete_absorvido_por ? p.frete_absorvido_por === "loja" : !!cupom?.loja_id
    if (pelaLoja) descontoLoja += descontoFrete; else descontoChego += descontoFrete
    descontoFinanciador ??= pelaLoja ? "loja" : (p.frete_absorvido_por || cupom) ? "chego" : "nao_identificado"
  }

  const taxaPagamento = partes.reduce((s, x) => s + x.taxa, 0)
  const temEntrega = !retirada && !!p.motoboy_id
  const participacaoEntrega = temEntrega ? n(loja.participacao_entrega) : 0
  const recebidoPelaLoja = partes.filter(x => x.recebidoPor === "loja").reduce((s, x) => s + x.valor, 0)
  const liquidoLoja = produtos - descontoLoja - comissao - taxaPagamento - participacaoEntrega - recebidoPelaLoja

  const ganhoSemDinamica = temEntrega ? ganhoMotoboy(entrega, p.criado_em) : 0
  const ganho = ganhoSemDinamica + (temEntrega ? dinamica : 0)
  const complementoPiso = temEntrega ? Math.max(0, ganhoSemDinamica - entrega) : 0
  // Pedidos antigos (antes de 17/09/2026) tinham corte da Chegô sobre a entrega — receita
  // da Chegô. Pedido entregue sem motoboy registrado (e que não é retirada): não dá para
  // saber quem fez a entrega, então a taxa fica "a identificar" — nunca vira receita.
  const corteEntrega = temEntrega ? Math.max(0, entrega - ganhoSemDinamica) : 0
  const entregaSemMotoboy = !temEntrega && !retirada ? entrega + dinamica : 0
  const dinheiroComMotoboy = partes.filter(x => x.recebidoPor === "motoboy_dinheiro").reduce((s, x) => s + x.valor, 0)

  return {
    isAvulsa: avulsa, isRetirada: retirada, formaGrupo: formaGrupo(forma), recebidoPor, partes,
    produtos, entrega, dinamica, desconto: desconto + descontoFrete, descontoLoja, descontoChego, descontoFinanciador, totalCliente,
    comissaoPct, comissao, taxaPagamento, participacaoEntrega, recebidoPelaLoja, liquidoLoja,
    ganhoMotoboy: ganho, complementoPiso, corteEntrega, entregaSemMotoboy, dinheiroComMotoboy,
    valorConfere: Math.abs(produtos + entrega + dinamica - desconto - descontoFrete - totalCliente) < 0.01,
  }
}
