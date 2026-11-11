// Destinação do dinheiro dos pedidos — cards "Repasse aos lojistas", "Repasse aos
// motoboys" e "Receita do Chegô" da Visão financeira (pedido do Lucas, 16/10/2026).
// Usa as mesmas regras do fechamento diário (lib/regrasFinanceiras.ts) — nenhuma regra
// nova aqui. Valores devolvidos em CENTAVOS (padrão da Visão financeira).
//
// Conciliação: para cada pedido entregue,
//   total pago = líquido da loja + já recebido pela loja + ganho do motoboy
//              + receita do Chegô no pedido − custos do Chegô no pedido + entrega sem motoboy
// Mensalidades ficam FORA dessa conta (não vêm de pedido).

import { ganhoMotoboy } from "@/lib/comissao"
import { calcularPedido, type CupomBase, type LojaBase, type PedidoBase } from "@/lib/regrasFinanceiras"

// Pedido do Lucas (16/10/2026): os cards contam SÓ a partir de hoje — nada antes de 16/10.
export const DESTINACOES_DESDE = "2026-10-16"

const c = (v: number) => Math.round(v * 100)
const n = (v: unknown) => Number(v ?? 0) || 0
const ymd = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso))

export type AvulsaBase = { id: string; loja_id: string; motoboy_id: string | null; status: string; taxa_entrega: number | string; comissao_valor?: number | string | null; criado_em: string }
export type MovBase = { tipo: string; valor: number | string; loja_id: string | null; motoboy_id: string | null; ocorrido_em: string; origem: string; cancelado_em?: string | null }
export type SaqueBase = { tipo?: string; loja_id?: string | null; motoboy_id?: string | null; valor?: number | string; status: string; pago_em?: string | null }
export type MotoboyBase = { id: string; nome: string; ajuda_custo_semanal?: number | string | null; ajuda_custo_dia_semana?: number | null }
export type MensalidadeRecebida = { loja: string; valor: number; liquido: number; data: string; origem: string }

export function calcularDestinacoes(args: {
  pedidos: (PedidoBase & { status: string })[]; avulsas: AvulsaBase[]; lojas: (LojaBase & { id: string })[]; cupons: CupomBase[]
  motoboys: MotoboyBase[]; movimentos: MovBase[]; saques: SaqueBase[]; mensalidades: MensalidadeRecebida[]; mensalidadesErro?: string | null
  inicio: string; fim: string
}) {
  const fim = args.fim
  const inicio = args.inicio < DESTINACOES_DESDE ? DESTINACOES_DESDE : args.inicio
  const desdeHoje = (iso: string) => ymd(iso) >= inicio && ymd(iso) <= fim
  const noPeriodo = (iso?: string | null) => !!iso && ymd(iso) >= inicio && ymd(iso) <= fim
  const L = new Map(args.lojas.map(l => [l.id, l]))
  const C = new Map(args.cupons.map(x => [String(x.codigo).toUpperCase(), x]))
  const M = new Map(args.motoboys.map(m => [m.id, m]))

  type Loja = { id: string; nome: string; comissaoPct: number; participacao: number; pedidos: number; produtos: number; descontoLoja: number; comissao: number; taxaPagamento: number
    participacaoEntrega: number; avulsas: number; cobrancaAvulsas: number; recebidoPelaLoja: number; liquido: number; repassado: number; pendente: number }
  type Mb = { id: string; nome: string; entregas: number; avulsas: number; ganhoAvulsas: number; ganho: number; ajudaCusto: number; bonus: number; descontos: number; pago: number; compensado: number
    devido: number; pendente: number; dinheiroClientes: number; dinheiroEntregue: number; dinheiroAPrestar: number }
  const lojas = new Map<string, Loja>(), mbs = new Map<string, Mb>()
  const loja = (id: string) => { let x = lojas.get(id); if (!x) { const l = L.get(id); x = { id, nome: l?.nome ?? "Loja não identificada", comissaoPct: n(l?.comissao), participacao: n(l?.participacao_entrega), pedidos: 0, produtos: 0, descontoLoja: 0, comissao: 0, taxaPagamento: 0, participacaoEntrega: 0, avulsas: 0, cobrancaAvulsas: 0, recebidoPelaLoja: 0, liquido: 0, repassado: 0, pendente: 0 }; lojas.set(id, x) } return x }
  const mb = (id: string) => { let x = mbs.get(id); if (!x) { x = { id, nome: M.get(id)?.nome ?? "Motoboy não identificado", entregas: 0, avulsas: 0, ganhoAvulsas: 0, ganho: 0, ajudaCusto: 0, bonus: 0, descontos: 0, pago: 0, compensado: 0, devido: 0, pendente: 0, dinheiroClientes: 0, dinheiroEntregue: 0, dinheiroAPrestar: 0 }; mbs.set(id, x) } return x }

  const ch = { comissoes: 0, comissoesAvulsas: 0, taxasPagamento: 0, participacaoEntrega: 0, corteEntrega: 0, corteAvulsas: 0, complementoPiso: 0, complementoAvulsas: 0, cuponsChego: 0 }
  let vendas = 0, entregaSemMotoboy = 0, pedidosSemMotoboy = 0

  for (const p of args.pedidos.filter(p => p.status === "entregue" && desdeHoje(p.criado_em))) {
    const lj = L.get(p.loja_id) ?? { id: p.loja_id, nome: "—", comissao: 0 }
    const k = calcularPedido(p, lj, p.cupom_codigo ? C.get(String(p.cupom_codigo).toUpperCase()) ?? null : null)
    vendas += k.totalCliente
    const x = loja(p.loja_id)
    x.pedidos++; x.produtos += k.produtos; x.descontoLoja += k.descontoLoja; x.comissao += k.comissao; x.taxaPagamento += k.taxaPagamento
    x.participacaoEntrega += k.participacaoEntrega; x.recebidoPelaLoja += k.recebidoPelaLoja; x.liquido += k.liquidoLoja
    ch.comissoes += k.comissao; ch.taxasPagamento += k.taxaPagamento; ch.participacaoEntrega += k.participacaoEntrega
    ch.corteEntrega += k.corteEntrega; ch.complementoPiso += k.complementoPiso; ch.cuponsChego += k.descontoChego
    if (k.entregaSemMotoboy) { entregaSemMotoboy += k.entregaSemMotoboy; pedidosSemMotoboy++ }
    if (p.motoboy_id && k.ganhoMotoboy) { const m = mb(p.motoboy_id); m.entregas++; m.ganho += k.ganhoMotoboy; m.dinheiroClientes += k.dinheiroComMotoboy; if (k.isAvulsa) { m.avulsas++; m.ganhoAvulsas += k.ganhoMotoboy } }
  }
  // Entregas avulsas da tabela antiga: a loja paga a corrida (taxa + R$ 1 nas de R$ 3) e a comissão dos itens
  for (const a of args.avulsas.filter(a => a.status === "entregue" && desdeHoje(a.criado_em))) {
    const t = n(a.taxa_entrega), cobr = t + (t === 3 ? 1 : 0), com = n(a.comissao_valor)
    const x = loja(a.loja_id); x.avulsas++; x.cobrancaAvulsas += cobr + com; x.liquido -= cobr + com
    ch.comissoesAvulsas += com
    const g = a.motoboy_id ? ganhoMotoboy(t, a.criado_em) : 0
    if (a.motoboy_id) { const m = mb(a.motoboy_id); m.entregas++; m.ganho += g; m.avulsas++; m.ganhoAvulsas += g }
    ch.corteAvulsas += Math.max(0, cobr - g); ch.complementoAvulsas += Math.max(0, g - cobr)
  }

  // Pagamentos registrados no período: Pix importados do Asaas + lançamentos manuais
  // (movimentos_financeiros) e saques pagos no app. Um saque pago pelo Asaas também vira
  // Pix importado — nesse caso conta uma vez só (mesmo beneficiário, valor e dia).
  const movs = args.movimentos.filter(m => !m.cancelado_em && noPeriodo(m.ocorrido_em))
  const chaveMov = new Set(movs.filter(m => m.origem === "asaas").map(m => `${m.loja_id ?? m.motoboy_id}|${c(n(m.valor))}|${ymd(m.ocorrido_em)}`))
  const saquesPagos = args.saques.filter(s => s.status === "pago" && noPeriodo(s.pago_em))
    .filter(s => !chaveMov.has(`${s.loja_id ?? s.motoboy_id}|${c(n(s.valor))}|${ymd(s.pago_em!)}`))
  for (const s of saquesPagos) {
    if (s.tipo === "lojista" && s.loja_id) loja(s.loja_id).repassado += n(s.valor)
    if (s.tipo === "motoboy" && s.motoboy_id) mb(s.motoboy_id).pago += n(s.valor)
  }
  for (const m of movs) {
    const v = n(m.valor)
    if (m.loja_id) { const x = loja(m.loja_id); if (m.tipo === "repasse") x.repassado += v; else if (m.tipo === "ajuste_credito") x.liquido += v; else if (m.tipo === "ajuste_debito") x.liquido -= v }
    if (m.motoboy_id) {
      const x = mb(m.motoboy_id)
      if (m.tipo === "pagamento" || m.tipo === "adiantamento") x.pago += v
      else if (m.tipo === "retirada_dinheiro") { x.compensado += v; x.dinheiroEntregue += v }
      else if (m.tipo === "bonus" || m.tipo === "ajuste_credito") x.bonus += v
      else if (m.tipo === "desconto" || m.tipo === "ajuste_debito") x.descontos += v
      else if (m.tipo === "entrega_caixa" || m.tipo === "pagamento_autorizado_dinheiro") x.dinheiroEntregue += v
    }
  }
  // Ajuda de custo recorrente (ex.: Henrique, R$ 250 às sextas)
  for (const m of args.motoboys) {
    const v = n(m.ajuda_custo_semanal); if (!v) continue
    let total = 0
    for (let d = inicio < DESTINACOES_DESDE ? DESTINACOES_DESDE : inicio; d <= fim; d = new Date(new Date(`${d}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10))
      if (new Date(`${d}T12:00:00-03:00`).getUTCDay() === Number(m.ajuda_custo_dia_semana ?? 5)) total += v
    if (total) mb(m.id).ajudaCusto += total
  }
  for (const x of lojas.values()) x.pendente = Math.max(0, x.liquido - x.repassado)
  for (const x of mbs.values()) {
    // Ajuda de custo é paga à parte (pedido do Lucas, 16/10): não entra no devido
    x.devido = x.ganho + x.bonus - x.descontos
    x.pendente = Math.max(0, x.devido - x.pago - x.compensado)
    x.dinheiroAPrestar = Math.max(0, x.dinheiroClientes - x.dinheiroEntregue)
  }

  const listaLojas = [...lojas.values()].filter(x => x.pedidos || x.avulsas || x.repassado).sort((a, b) => b.liquido - a.liquido)
  const listaMbs = [...mbs.values()].filter(x => x.entregas || x.pago || x.ajudaCusto || x.compensado || x.bonus).sort((a, b) => b.devido - a.devido)
  const soma = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0)

  const receitaPedidos = ch.comissoes + ch.taxasPagamento + ch.participacaoEntrega + ch.corteEntrega
  const receitaAvulsas = ch.comissoesAvulsas + ch.corteAvulsas
  const custos = ch.complementoPiso + ch.complementoAvulsas + ch.cuponsChego
  const mensal = soma(args.mensalidades, m => m.valor)

  const lojistasLiquido = soma(listaLojas, x => x.liquido)
  const recebidoLojas = soma(listaLojas, x => x.recebidoPelaLoja)
  const motoboysGanho = soma(listaMbs, x => x.ganho)
  // Conciliação dos pedidos (mensalidades fora): soma das destinações = vendas concluídas
  const destinado = lojistasLiquido + recebidoLojas + motoboysGanho + receitaPedidos + receitaAvulsas - custos + entregaSemMotoboy

  return {
    desde: DESTINACOES_DESDE, inicioConsiderado: inicio, cortado: args.inicio < DESTINACOES_DESDE, semPeriodo: fim < DESTINACOES_DESDE,
    lojistas: {
      liquido: c(lojistasLiquido), recebidoPelasLojas: c(recebidoLojas), repassado: c(soma(listaLojas, x => x.repassado)), pendente: c(soma(listaLojas, x => x.pendente)), aCobrar: c(soma(listaLojas, x => Math.max(0, x.repassado - x.liquido))),
      lojas: listaLojas.map(x => ({ ...x, produtos: c(x.produtos), descontoLoja: c(x.descontoLoja), comissao: c(x.comissao), taxaPagamento: c(x.taxaPagamento), participacaoEntrega: c(x.participacaoEntrega), cobrancaAvulsas: c(x.cobrancaAvulsas), recebidoPelaLoja: c(x.recebidoPelaLoja), liquido: c(x.liquido), repassado: c(x.repassado), pendente: c(x.pendente) })),
    },
    motoboys: {
      ganho: c(motoboysGanho), avulsas: soma(listaMbs, x => x.avulsas), ganhoAvulsas: c(soma(listaMbs, x => x.ganhoAvulsas)), ajudaCusto: c(soma(listaMbs, x => x.ajudaCusto)), bonus: c(soma(listaMbs, x => x.bonus)), descontos: c(soma(listaMbs, x => x.descontos)),
      devido: c(soma(listaMbs, x => x.devido)), pago: c(soma(listaMbs, x => x.pago)), compensado: c(soma(listaMbs, x => x.compensado)), pendente: c(soma(listaMbs, x => x.pendente)),
      dinheiroClientes: c(soma(listaMbs, x => x.dinheiroClientes)), dinheiroAPrestar: c(soma(listaMbs, x => x.dinheiroAPrestar)),
      lista: listaMbs.map(x => ({ ...x, ganhoAvulsas: c(x.ganhoAvulsas), ganho: c(x.ganho), ajudaCusto: c(x.ajudaCusto), bonus: c(x.bonus), descontos: c(x.descontos), pago: c(x.pago), compensado: c(x.compensado), devido: c(x.devido), pendente: c(x.pendente), dinheiroClientes: c(x.dinheiroClientes), dinheiroEntregue: c(x.dinheiroEntregue), dinheiroAPrestar: c(x.dinheiroAPrestar) })),
    },
    chego: {
      comissoes: c(ch.comissoes), comissoesAvulsas: c(ch.comissoesAvulsas), taxasPagamento: c(ch.taxasPagamento), participacaoEntrega: c(ch.participacaoEntrega),
      corteEntrega: c(ch.corteEntrega + ch.corteAvulsas), receitaPedidos: c(receitaPedidos + receitaAvulsas),
      complementoPiso: c(ch.complementoPiso + ch.complementoAvulsas), cuponsChego: c(ch.cuponsChego), custosPedidos: c(custos),
      receitaLiquidaPedidos: c(receitaPedidos + receitaAvulsas - custos),
      mensalidades: c(mensal), mensalidadesDetalhe: args.mensalidades.map(m => ({ ...m, valor: c(m.valor), liquido: c(m.liquido) })), mensalidadesErro: args.mensalidadesErro ?? null,
      outrasReceitas: 0, total: c(receitaPedidos + receitaAvulsas - custos + mensal),
    },
    conciliacao: {
      vendas: c(vendas), lojistasLiquido: c(lojistasLiquido), recebidoPelasLojas: c(recebidoLojas), motoboys: c(motoboysGanho),
      receitaChegoPedidos: c(receitaPedidos + receitaAvulsas), custosChegoPedidos: c(custos), entregaSemMotoboy: c(entregaSemMotoboy), pedidosSemMotoboy,
      destinado: c(destinado), diferenca: c(destinado) - c(vendas),
    },
  }
}
export type Destinacoes = ReturnType<typeof calcularDestinacoes>
