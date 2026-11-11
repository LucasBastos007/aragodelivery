// Fechamento financeiro diário (pedido do Lucas, 16/10/2026). Só LÊ dados financeiros —
// nunca altera valor de pedido nem faz repasse. A única escrita é a importação dos Pix
// enviados pelo Asaas para `movimentos_financeiros` (registro, idempotente por
// externo_id), e só quando `persistir` = true.
//
// Cada fechamento mostra SÓ o dia (pedido do Lucas, 16/10/2026) — sem saldo acumulado.
// Pix enviados no dia (repasse semanal de dias anteriores) aparecem só como informação.

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { buscarPagamentoMp, ehIdMp } from "@/lib/mercadopago"
import { calcularPedido, type CalculoPedido, type CupomBase, type LojaBase, type PedidoBase } from "@/lib/regrasFinanceiras"

const TZ = "America/Sao_Paulo"
const DIA_MS = 86400000

export function adminSb(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const ymdBrt = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d))
const iniUtc = (ymd: string) => new Date(`${ymd}T00:00:00-03:00`).toISOString()
const fimUtc = (ymd: string) => new Date(`${ymd}T23:59:59.999-03:00`).toISOString()
const somaDias = (ymd: string, d: number) => new Date(new Date(`${ymd}T12:00:00Z`).getTime() + d * DIA_MS).toISOString().slice(0, 10)
const diaSemana = (ymd: string) => new Date(`${ymd}T12:00:00-03:00`).getUTCDay()
const r2 = (v: number) => Math.round(v * 100) / 100
const n = (v: unknown) => Number(v ?? 0) || 0
const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9@.]+/g, " ").trim()
const chavePix = (s: string | null | undefined) => {
  const t = (s ?? "").trim().toLowerCase()
  if (!t) return ""
  if (t.includes("@")) return t
  const dig = t.replace(/\D/g, "")
  if (/^[0-9+().\-\s]+$/.test(t)) return dig.length >= 12 && dig.startsWith("55") ? dig.slice(2) : dig
  return t.replace(/[^a-z0-9]/g, "")
}

// ───────────────────────── Asaas (somente leitura) ─────────────────────────

async function asaasGet<T>(path: string): Promise<T> {
  const base = process.env.ASAAS_BASE_URL ?? "https://api.asaas.com/v3"
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const res = await fetch(`${base}${path}`, {
      headers: { access_token: process.env.ASAAS_API_KEY!, "User-Agent": "ChegoDelivery/1.0" },
      cache: "no-store",
    })
    if (res.status === 429) { await new Promise(r => setTimeout(r, 1500 * (tentativa + 1))); continue }
    if (!res.ok) throw new Error(`Asaas ${path.split("?")[0]} HTTP ${res.status}`)
    return res.json() as Promise<T>
  }
  throw new Error(`Asaas ${path.split("?")[0]}: limite de requisições`)
}

async function asaasLista<T>(path: string): Promise<T[]> {
  const out: T[] = []
  for (let off = 0; off < 5000; off += 100) {
    const j = await asaasGet<{ data: T[]; hasMore: boolean }>(`${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${off}`)
    out.push(...j.data)
    if (!j.hasMore) break
  }
  return out
}

type AsaasPayment = { id: string; customer: string; value: number; netValue: number; status: string; billingType: string; subscription?: string | null; description?: string | null; paymentDate?: string | null; clientPaymentDate?: string | null; refunds?: unknown }
type AsaasTransfer = { id: string; value: number; status: string; dateCreated: string; effectiveDate?: string | null; description?: string | null; operationType?: string; bankAccount?: { ownerName?: string | null; pixAddressKey?: string | null } | null }

// ───────────────────────── Tipos do resultado ─────────────────────────

export type Movimento = {
  id: string; beneficiario_tipo: string; motoboy_id: string | null; loja_id: string | null; destinatario_nome: string | null
  tipo: string; valor: number; forma: string | null; ocorrido_em: string; responsavel: string | null; motivo: string
  pedido_id: string | null; origem: string; externo_id?: string | null
}

export type LinhaPedido = CalculoPedido & {
  id: string; codigo: string; loja: string; loja_id: string; motoboy: string | null; motoboy_id: string | null
  status: string; forma: string; criado_em: string; entregue_em: string | null; cupom: string | null
  asaasStatus: string | null; asaasTaxa: number | null
}

export type LinhaLoja = {
  loja_id: string; nome: string; pedidos: number; produtos: number; descontos: number; descontoLoja: number
  comissaoPct: string; comissao: number; taxaPagamento: number; participacaoEntrega: number
  recebidoPelaLoja: number; outrosAjustes: number; liquido: number; repassadoDia: number
  pendenteAnterior: number; pendenteAtual: number; ajustesDescricao: string[]
}

export type LinhaMotoboy = {
  motoboy_id: string; nome: string; entregas: number; entregasAvulsas: number; ganhoAvulsas: number; ajudaCustoInfo: number; entregasPix: number; entregasDinheiro: number; entregasCartao: number
  dinheiroRecebido: number; outrasModalidades: number; taxasEntrega: number; complementoPiso: number; ganho: number
  bonus: number; bonusDescricao: string[]; descontos: number; retiradasDinheiro: number; pagamentosRecebidos: number; pagamentosInfo: number
  aReceberDia: number; saldoAnteriorReceber: number; saldoReceber: number
  dinheiroEntregueCaixa: number; dinheiroPagamentosAutorizados: number
  dinheiroAnterior: number; dinheiroSobResponsabilidade: number
  conferido: number | null; conferidoOrigem: string | null; divergenciaCaixa: number | null
  saldoFinal: number
}

export type Alerta = { nivel: "critico" | "atencao" | "info"; titulo: string; detalhe: string; pedido?: string; responsavel?: string; valor?: number }

export type Fechamento = {
  data: string; inicioControle: string; corteEm: string; ultimoMovimentoEm: string | null
  resumo: {
    pedidosRealizados: number; concluidos: number; cancelados: number; emAndamento: number; aguardandoPagamento: number
    faturamentoBruto: number; produtos: number; taxasEntrega: number
    descontos: number; descontosLoja: number; descontosChego: number; descontosNaoIdentificados: number
    comissoes: number; devidoLojas: number; devidoMotoboys: number
    receitaBruta: number; custos: number; resultado: number; resultadoParcial: boolean
  }
  porForma: { forma: string; pedidos: number; valor: number; recebidoPor: string }[]
  pedidos: LinhaPedido[]
  cancelados: { codigo: string; loja: string; forma: string; total: number; motivo: string | null; asaasStatus: string | null }[]
  emAndamento: { codigo: string; loja: string; status: string; forma: string; total: number }[]
  ajustesAnteriores: { codigo: string; loja: string; dia: string; status: string; total: number; efeito: string }[]
  lojas: LinhaLoja[]
  motoboys: LinhaMotoboy[]
  movimentosDia: (Movimento & { nome: string })[]
  receita: {
    comissoes: number; taxasPagamentoCobradas: number; participacaoEntrega: number; mensalidades: number
    mensalidadesDetalhe: { loja: string; valor: number; liquido: number }[]
    outrasReceitas: number
    taxasProcessamento: number; taxasProcessamentoDetalhe: string; taxaStoneNaoApurada: number
    cuponsChego: number; complementoPiso: number; bonus: number; pagamentosAutorizados: number
    despesas: number; despesasDetalhe: { descricao: string; valor: number }[]
    receitaTotal: number; custosTotal: number; resultado: number; pendencias: string[]
  }
  recebimentosSemPedido: { descricao: string; valor: number; tipo: string }[]
  alertas: Alerta[]
  snapshot: Record<string, string>
}

// ───────────────────────── Cálculo ─────────────────────────

export async function calcularFechamento(dataYmd: string, opts: { persistir?: boolean; sb?: SupabaseClient } = {}): Promise<Fechamento> {
  const sb = opts.sb ?? adminSb()
  const corteEm = new Date().toISOString()
  // Pedido do Lucas (16/10/2026): o fechamento é SÓ do dia — sem saldo acumulado.
  const inicioControle = dataYmd
  const iniDia = iniUtc(dataYmd), fimDia = fimUtc(dataYmd), iniCtrl = iniUtc(inicioControle)
  const iniAjustes = iniUtc(somaDias(dataYmd, -3))
  const alertas: Alerta[] = []

  const SEL = "id,codigo,loja_id,motoboy_id,status,forma_pagamento,forma_pagamento_2,valor_pagamento_1,valor_pagamento_2,subtotal,taxa_entrega,taxa_dinamica,total,desconto,cupom_codigo,frete_gratis,frete_absorvido_por,endereco_entrega,criado_em,entregue_em,cancelado_em,atualizado_em,asaas_payment_id,asaas_payment_id_2,motivo_cancelamento"
  async function todos(q: () => any) {
    const out: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await q().range(from, from + 999)
      if (error) throw error
      out.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }
    return out
  }
  const desde = iniCtrl < iniAjustes ? iniCtrl : iniAjustes
  const [pedidosAll, lojasArr, motoboysArr, cuponsArr, movsArr, caixaDecl, despesasArr, fechAnt] = await Promise.all([
    todos(() => sb.from("pedidos").select(SEL).gte("criado_em", desde).lte("criado_em", fimDia).order("criado_em")),
    todos(() => sb.from("lojas").select("id,nome,comissao,plano,participacao_entrega,pix_key,pix_chave,nome_responsavel,asaas_customer_id")),
    todos(() => sb.from("motoboys").select("id,nome,pix_key,pix_chave,ajuda_custo_semanal,ajuda_custo_dia_semana,status")),
    todos(() => sb.from("cupons").select("codigo,loja_id")),
    todos(() => sb.from("movimentos_financeiros").select("*").is("cancelado_em", null).gte("ocorrido_em", iniCtrl).lte("ocorrido_em", fimDia)),
    todos(() => sb.from("motoboy_caixa").select("motoboy_id,valor,observacao,criado_em").gte("criado_em", iniDia).lte("criado_em", fimDia)),
    todos(() => sb.from("despesas").select("descricao,categoria,valor,data,ativo").eq("data", dataYmd)),
    sb.from("fechamentos_diarios").select("pedidos_snapshot,corte_em").eq("data", somaDias(dataYmd, -1)).maybeSingle(),
  ])
  const L = new Map<string, any>(lojasArr.map(l => [l.id, l]))
  const M = new Map<string, any>(motoboysArr.map(m => [m.id, m]))
  const C = new Map<string, CupomBase>(cuponsArr.map(c => [String(c.codigo).toUpperCase(), c]))
  const nomeLoja = (id: string | null) => (id && L.get(id)?.nome) || "—"
  const nomeMb = (id: string | null) => (id && M.get(id)?.nome) || "—"

  // ── Asaas: cobranças dos pedidos (taxa real e status) ──
  const pedidosDia = pedidosAll.filter(p => p.criado_em >= iniDia)
  const pedidosCtrl = pedidosAll.filter(p => p.criado_em >= iniCtrl)
  const pay = new Map<string, AsaasPayment>()
  let asaasErro: string | null = null
  try {
    for (const p of await asaasLista<AsaasPayment>(`/payments?dateCreated[ge]=${somaDias(dataYmd, -1)}&dateCreated[le]=${dataYmd}`)) pay.set(p.id, p)
    // Pedido pix + cartão tem duas cobranças (asaas_payment_id_2 = pix, ver lib/pagamentoDividido)
    const faltando = pedidosDia.flatMap(p => [p.asaas_payment_id, p.asaas_payment_id_2]).filter(id => id && !pay.has(id)).slice(0, 60)
    // Pix do Mercado Pago (id "mp_", desde 22/10/2026): lido na API do Mercado Pago no mesmo formato
    for (const id of faltando) { try {
      if (ehIdMp(id)) { const m = await buscarPagamentoMp(id); pay.set(id, { id, customer: "", value: m.valor, netValue: m.liquido, status: m.status, billingType: "PIX" }) }
      else pay.set(id, await asaasGet<AsaasPayment>(`/payments/${id}`))
    } catch {} }
  } catch (e: any) { asaasErro = e?.message ?? String(e) }
  if (asaasErro) alertas.push({ nivel: "critico", titulo: "Asaas indisponível", detalhe: `Não foi possível ler o Asaas (${asaasErro}). Taxas reais, mensalidades e Pix enviados não foram conferidos.` })

  // ── Cálculo por pedido ──
  const linha = (p: any): LinhaPedido => {
    const loja: LojaBase = L.get(p.loja_id) ?? { id: p.loja_id, nome: "—", comissao: 0 }
    const cupom = p.cupom_codigo ? C.get(String(p.cupom_codigo).toUpperCase()) ?? null : null
    const c = calcularPedido(p as PedidoBase, loja, cupom)
    const cobr = [p.asaas_payment_id, p.asaas_payment_id_2].filter(Boolean).map((id: string) => pay.get(id))
    const lidas = cobr.filter((x): x is AsaasPayment => !!x)
    const a = lidas.length === cobr.length && lidas.length ? {
      status: lidas.find(x => !["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(x.status))?.status ?? lidas[0].status,
      value: lidas.reduce((s, x) => s + n(x.value), 0), netValue: lidas.reduce((s, x) => s + n(x.netValue), 0),
    } : undefined
    return { ...c, id: p.id, codigo: p.codigo, loja: nomeLoja(p.loja_id), loja_id: p.loja_id, motoboy: p.motoboy_id ? nomeMb(p.motoboy_id) : null, motoboy_id: p.motoboy_id,
      status: p.status, forma: p.forma_pagamento, criado_em: p.criado_em, entregue_em: p.entregue_em, cupom: p.cupom_codigo ?? null,
      asaasStatus: a?.status ?? null, asaasTaxa: a ? r2(n(a.value) - n(a.netValue)) : null }
  }
  const entreguesDia = pedidosDia.filter(p => p.status === "entregue").map(linha)
  const entreguesCtrl = pedidosCtrl.filter(p => p.status === "entregue").map(linha)
  const canceladosDia = pedidosDia.filter(p => p.status === "cancelado")
  const aguardPag = pedidosDia.filter(p => p.status === "aguardando_pagamento")
  const andamento = pedidosDia.filter(p => !["entregue", "cancelado", "aguardando_pagamento"].includes(p.status))

  // ── Movimentos: importa Pix enviados pelo Asaas no dia ──
  const movs: Movimento[] = movsArr.map(m => ({ ...m, valor: n(m.valor) }))
  try {
    if (!asaasErro) {
      const transf = await asaasLista<AsaasTransfer>(`/transfers?dateCreated[ge]=${dataYmd}&dateCreated[le]=${dataYmd}`)
      const jaTem = new Set(movs.map(m => m.externo_id).filter(Boolean))
      const idxChave = new Map<string, { tipo: "loja" | "motoboy"; id: string }>()
      for (const l of lojasArr) for (const k of [l.pix_key, l.pix_chave]) if (chavePix(k)) idxChave.set(chavePix(k), { tipo: "loja", id: l.id })
      for (const m of motoboysArr) for (const k of [m.pix_key, m.pix_chave]) if (chavePix(k)) idxChave.set(chavePix(k), { tipo: "motoboy", id: m.id })
      const novos: any[] = []
      for (const t of transf) {
        if (["CANCELLED", "FAILED"].includes(t.status)) continue
        const externo = `asaas_transfer:${t.id}`
        if (jaTem.has(externo)) continue
        const dono = t.bankAccount?.ownerName ?? ""
        let alvo = idxChave.get(chavePix(t.bankAccount?.pixAddressKey))
        if (!alvo) {
          const nd = norm(dono)
          const mb = motoboysArr.find(m => norm(m.nome) === nd || (nd.length > 8 && norm(m.nome).startsWith(nd)) || (norm(m.nome).length > 8 && nd.startsWith(norm(m.nome))))
          const lj = lojasArr.find(l => (l.nome_responsavel && norm(l.nome_responsavel) === nd) || norm(l.nome) === nd)
          if (mb) alvo = { tipo: "motoboy", id: mb.id }
          else if (lj) alvo = { tipo: "loja", id: lj.id }
        }
        const interna = /^67\D?543\D?510/.test(dono.trim()) || /chego/i.test(norm(dono))
        const ocorrido = t.effectiveDate ? new Date(t.effectiveDate.replace(" ", "T") + "-03:00").toISOString() : new Date(`${t.dateCreated}T12:00:00-03:00`).toISOString()
        const mov = {
          beneficiario_tipo: alvo?.tipo ?? "outro", motoboy_id: alvo?.tipo === "motoboy" ? alvo.id : null, loja_id: alvo?.tipo === "loja" ? alvo.id : null,
          destinatario_nome: dono || null,
          tipo: interna ? "transferencia_interna" : alvo?.tipo === "loja" ? "repasse" : alvo?.tipo === "motoboy" ? "pagamento" : "nao_identificado",
          valor: r2(n(t.value)), forma: "pix", ocorrido_em: ocorrido, responsavel: "Asaas (importação automática)",
          motivo: t.description?.trim() || "Pix enviado pelo Asaas", pedido_id: null, origem: "asaas", externo_id: externo, criado_por: "fechamento-diario",
        }
        novos.push(mov)
      }
      if (novos.length) {
        if (opts.persistir) {
          const { data, error } = await sb.from("movimentos_financeiros").upsert(novos, { onConflict: "externo_id", ignoreDuplicates: true }).select("*")
          if (error) throw error
          movs.push(...(data ?? []).map((m: any) => ({ ...m, valor: n(m.valor) })))
        } else movs.push(...novos.map((m, i) => ({ ...m, id: `preview-${i}` })))
      }
    }
  } catch (e: any) {
    alertas.push({ nivel: "atencao", titulo: "Pix enviados não importados", detalhe: `Falha ao ler/registrar transferências do Asaas: ${e?.message ?? e}` })
  }
  const movsDia = movs.filter(m => m.ocorrido_em >= iniDia && m.ocorrido_em <= fimDia)
  const movsAntes = movs.filter(m => m.ocorrido_em < iniDia)

  // ── Lojas ──
  const somaPor = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + f(x), 0)
  const lojasIds = new Set<string>([...entreguesDia.map(p => p.loja_id), ...movsDia.filter(m => m.loja_id).map(m => m.loja_id!)])
  const ajusteLoja = (ms: Movimento[], id: string) => somaPor(ms.filter(m => m.loja_id === id), m =>
    m.tipo === "ajuste_credito" ? m.valor : m.tipo === "ajuste_debito" ? -m.valor : 0)
  const repasseLoja = (ms: Movimento[], id: string) => somaPor(ms.filter(m => m.loja_id === id && m.tipo === "repasse"), m => m.valor)
  // Lojas com saldo acumulado aberto também aparecem (mesmo sem venda no dia)
  for (const p of entreguesCtrl) lojasIds.add(p.loja_id)
  const lojas: LinhaLoja[] = [...lojasIds].map(id => {
    const ps = entreguesDia.filter(p => p.loja_id === id)
    const antes = entreguesCtrl.filter(p => p.loja_id === id && p.criado_em < iniDia)
    const loja = L.get(id)
    const pcts = [...new Set(ps.map(p => p.comissaoPct))]
    const ajustesDia = ajusteLoja(movsDia, id)
    const liquido = somaPor(ps, p => p.liquidoLoja)
    const pendenteAnterior = somaPor(antes, p => p.liquidoLoja) + ajusteLoja(movsAntes, id) - repasseLoja(movsAntes, id)
    const repassadoDia = repasseLoja(movsDia, id)
    return {
      loja_id: id, nome: loja?.nome ?? "—", pedidos: ps.length, produtos: somaPor(ps, p => p.produtos), descontos: somaPor(ps, p => p.desconto), descontoLoja: somaPor(ps, p => p.descontoLoja),
      comissaoPct: pcts.length ? pcts.map(x => `${x.toLocaleString("pt-BR")}%`).join(" / ") : `${n(loja?.comissao)}%`,
      comissao: somaPor(ps, p => p.comissao), taxaPagamento: somaPor(ps, p => p.taxaPagamento), participacaoEntrega: somaPor(ps, p => p.participacaoEntrega),
      recebidoPelaLoja: somaPor(ps, p => p.recebidoPelaLoja), outrosAjustes: ajustesDia, liquido: liquido + ajustesDia, repassadoDia,
      pendenteAnterior, pendenteAtual: pendenteAnterior + liquido + ajustesDia,
      ajustesDescricao: movsDia.filter(m => m.loja_id === id && m.tipo.startsWith("ajuste")).map(m => `${m.tipo === "ajuste_credito" ? "+" : "−"}${r2(m.valor)} ${m.motivo}`),
    }
  }).filter(l => l.pedidos > 0 || Math.abs(l.pendenteAtual) > 0.009 || l.repassadoDia > 0).sort((a, b) => a.nome.localeCompare(b.nome))

  // ── Motoboys ──
  const bonusRecorrente = (m: any, de: string, ate: string) => {
    const v = n(m?.ajuda_custo_semanal)
    if (!v || !m) return 0
    let t = 0
    for (let d = de; d <= ate; d = somaDias(d, 1)) if (diaSemana(d) === Number(m.ajuda_custo_dia_semana ?? 5)) t += v
    return t
  }
  type Acc = { ganho: number; bonus: number; desc: number; pago: number; pagInfo: number; retirada: number; din: number; caixa: number; autoriz: number }
  const acum = (id: string, ps: LinhaPedido[], ms: Movimento[], de: string | null, ate: string | null): Acc => {
    const pm = ps.filter(p => p.motoboy_id === id), mm = ms.filter(x => x.motoboy_id === id)
    const s = (t: string[]) => somaPor(mm.filter(x => t.includes(x.tipo)), x => x.valor)
    return {
      ganho: somaPor(pm, p => p.ganhoMotoboy), bonus: s(["bonus", "ajuste_credito"]),
      desc: s(["desconto", "ajuste_debito"]), pago: s(["adiantamento"]), pagInfo: s(["pagamento"]), retirada: s(["retirada_dinheiro"]),
      din: somaPor(pm, p => p.dinheiroComMotoboy), caixa: s(["entrega_caixa"]), autoriz: s(["pagamento_autorizado_dinheiro"]),
    }
  }
  const mbIds = new Set<string>([...entreguesCtrl.filter(p => p.motoboy_id).map(p => p.motoboy_id!), ...movs.filter(m => m.motoboy_id).map(m => m.motoboy_id!)])
  for (const m of motoboysArr) if (n(m.ajuda_custo_semanal) > 0 && m.status === "ativo") mbIds.add(m.id)
  const dAnt = somaDias(dataYmd, -1)
  const motoboys: LinhaMotoboy[] = [...mbIds].map(id => {
    const psDia = entreguesDia.filter(p => p.motoboy_id === id)
    const dia = acum(id, entreguesDia, movsDia, dataYmd, dataYmd)
    const ant = acum(id, entreguesCtrl.filter(p => p.criado_em < iniDia), movsAntes, inicioControle, dAnt)
    const receberDia = dia.ganho + dia.bonus - dia.desc - dia.pago - dia.retirada
    const receberAnt = ant.ganho + ant.bonus - ant.desc - ant.pago - ant.retirada
    const dinAnt = ant.din - ant.caixa - ant.retirada - ant.autoriz
    const dinAtual = dinAnt + dia.din - dia.caixa - dia.retirada - dia.autoriz
    const conf = movsDia.filter(m => m.motoboy_id === id && m.tipo === "conferencia_caixa").sort((a, b) => b.ocorrido_em.localeCompare(a.ocorrido_em))[0]
    const decl = caixaDecl.filter(c => c.motoboy_id === id).sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0]
    const conferido = conf ? conf.valor : decl ? n(decl.valor) : null
    const bonusDesc = [
      ...movsDia.filter(m => m.motoboy_id === id && ["bonus", "ajuste_credito"].includes(m.tipo)).map(m => `${m.motivo}: R$ ${m.valor.toFixed(2).replace(".", ",")}`),
    ]
    return {
      motoboy_id: id, nome: nomeMb(id), entregas: psDia.length,
      entregasAvulsas: psDia.filter(p => p.isAvulsa).length, ganhoAvulsas: somaPor(psDia.filter(p => p.isAvulsa), p => p.ganhoMotoboy),
      ajudaCustoInfo: bonusRecorrente(M.get(id), dataYmd, dataYmd),
      entregasPix: psDia.filter(p => p.formaGrupo === "pix").length, entregasDinheiro: psDia.filter(p => p.formaGrupo === "dinheiro").length, entregasCartao: psDia.filter(p => p.formaGrupo === "cartao").length,
      dinheiroRecebido: dia.din, outrasModalidades: somaPor(psDia, p => somaPor(p.partes.filter(x => x.recebidoPor === "maquininha_app"), x => x.valor)),
      taxasEntrega: somaPor(psDia, p => p.entrega), complementoPiso: somaPor(psDia, p => p.complementoPiso), ganho: dia.ganho,
      bonus: dia.bonus, bonusDescricao: bonusDesc, descontos: dia.desc, retiradasDinheiro: dia.retirada, pagamentosRecebidos: dia.pago, pagamentosInfo: dia.pagInfo,
      aReceberDia: receberDia, saldoAnteriorReceber: receberAnt, saldoReceber: receberAnt + receberDia,
      dinheiroEntregueCaixa: dia.caixa, dinheiroPagamentosAutorizados: dia.autoriz, dinheiroAnterior: dinAnt, dinheiroSobResponsabilidade: dinAtual,
      conferido, conferidoOrigem: conf ? `conferência registrada por ${conf.responsavel ?? "—"}` : decl ? "declarado pelo motoboy no app" : null,
      divergenciaCaixa: conferido === null ? null : r2(conferido - dinAtual),
      saldoFinal: (receberAnt + receberDia) - dinAtual,
    }
  }).filter(m => m.entregas > 0 || m.ajudaCustoInfo > 0 || Math.abs(m.saldoReceber) > 0.009 || Math.abs(m.dinheiroSobResponsabilidade) > 0.009 || m.bonus > 0 || m.pagamentosRecebidos > 0 || m.pagamentosInfo > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome))

  // ── Receita e resultado da Chegô (dia) ──
  const recebDia = !asaasErro ? await asaasLista<AsaasPayment>(`/payments?paymentDate[ge]=${dataYmd}&paymentDate[le]=${dataYmd}`).catch(() => [] as AsaasPayment[]) : []
  const idsPedidoAsaas = new Set(pedidosAll.flatMap(p => [p.asaas_payment_id, p.asaas_payment_id_2]).filter(Boolean))
  const lojaPorCliente = new Map<string, any>(lojasArr.filter(l => l.asaas_customer_id).map(l => [l.asaas_customer_id, l]))
  const mensalidadesDetalhe: { loja: string; valor: number; liquido: number }[] = []
  const recebimentosSemPedido: { descricao: string; valor: number; tipo: string }[] = []
  for (const p of recebDia) {
    if (idsPedidoAsaas.has(p.id) || !["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(p.status)) continue
    const lj = lojaPorCliente.get(p.customer)
    if (lj) mensalidadesDetalhe.push({ loja: lj.nome, valor: n(p.value), liquido: n(p.netValue) })
    else recebimentosSemPedido.push({ descricao: p.description || `Cobrança ${p.billingType}`, valor: n(p.value), tipo: p.billingType })
  }
  const taxasAsaas = somaPor(entreguesDia.filter(p => p.asaasTaxa !== null), p => p.asaasTaxa!) + somaPor(mensalidadesDetalhe, m => m.valor - m.liquido)
  const temOnline = (p: LinhaPedido) => p.partes.some(x => x.recebidoPor === "asaas")
  const semTaxaReal = entreguesDia.filter(p => temOnline(p) && p.asaasTaxa === null)
  const maquininhaApp = somaPor(entreguesDia, p => somaPor(p.partes.filter(x => x.recebidoPor === "maquininha_app"), x => x.valor))
  const despesasValidas = despesasArr.filter(d => d.ativo !== false && !/^taxas asaas/i.test(d.descricao ?? ""))
  const comissoes = somaPor(entreguesDia, p => p.comissao), tpCobradas = somaPor(entreguesDia, p => p.taxaPagamento), particip = somaPor(entreguesDia, p => p.participacaoEntrega)
  const mensal = somaPor(mensalidadesDetalhe, m => m.valor)
  const cuponsChego = somaPor(entreguesDia, p => p.descontoChego), complemento = somaPor(entreguesDia, p => p.complementoPiso)
  const bonusDia = somaPor(motoboys, m => m.bonus), autorizDia = somaPor(motoboys, m => m.dinheiroPagamentosAutorizados)
  const despesas = somaPor(despesasValidas, d => n(d.valor))
  const receitaTotal = comissoes + tpCobradas + particip + mensal
  const custosTotal = taxasAsaas + cuponsChego + complemento + bonusDia + autorizDia + despesas
  const pendencias: string[] = []
  if (maquininhaApp > 0) pendencias.push(`Taxa real da maquininha (Stone) sobre R$ ${maquininhaApp.toFixed(2).replace(".", ",")} não apurada — a Stone não está integrada ao sistema.`)
  if (semTaxaReal.length) pendencias.push(`${semTaxaReal.length} pedido(s) online sem taxa real do Asaas: ${semTaxaReal.map(p => p.codigo).join(", ")}.`)
  if (!despesasValidas.length) pendencias.push("Nenhuma despesa cadastrada para este dia (aluguel, salários, marketing etc. não entram se não forem lançados em Despesas).")
  if (asaasErro) pendencias.push("Asaas indisponível: taxas reais e mensalidades não apuradas.")

  // ── Ajustes de dias anteriores (concluídos/cancelados depois do corte) ──
  const snapAnt: Record<string, string> = (fechAnt.data?.pedidos_snapshot as any) ?? {}
  const ajustesAnteriores = pedidosAll.filter(p => p.criado_em < iniDia && p.criado_em >= iniAjustes &&
    ((p.status === "entregue" && p.entregue_em && p.entregue_em >= iniDia) || (p.status === "cancelado" && p.cancelado_em && p.cancelado_em >= iniDia)) &&
    snapAnt[p.id] !== p.status)
    .map(p => { const c = linha(p); return { codigo: p.codigo, loja: nomeLoja(p.loja_id), dia: ymdBrt(p.criado_em), status: p.status, total: n(p.total),
      efeito: p.status === "entregue" ? `concluído após o corte — loja R$ ${c.liquidoLoja.toFixed(2).replace(".", ",")}, motoboy R$ ${c.ganhoMotoboy.toFixed(2).replace(".", ",")} (entram no saldo acumulado)` : "cancelado após o corte" } })

  // ── Conciliação ──
  // Por parte de pagamento: pedido em 2 formas conta nas duas modalidades, cada uma com o seu valor.
  const FORMAS_CONHECIDAS = ["pix", "cartao", "maquininha", "dinheiro", "pix_loja"]
  const porForma = FORMAS_CONHECIDAS.map(f => {
    const partes = entreguesDia.flatMap(p => p.partes.filter(x => x.forma === f))
    const rec = f === "pix" || f === "cartao" ? "Asaas (Chegô)" : f === "pix_loja" ? "Loja" : f === "maquininha" ? `Maquininha Chegô ${partes.filter(x => x.recebidoPor === "loja").length ? "/ loja (retirada)" : ""}` : `Motoboy ${partes.filter(x => x.recebidoPor === "loja").length ? "/ loja (retirada)" : ""}`
    return { forma: f, pedidos: partes.length, valor: somaPor(partes, x => x.valor), recebidoPor: rec.trim() }
  }).filter(f => f.pedidos > 0)
  const outrasPartes = entreguesDia.flatMap(p => p.partes.filter(x => !FORMAS_CONHECIDAS.includes(x.forma)))
  if (outrasPartes.length) porForma.push({ forma: "outras", pedidos: outrasPartes.length, valor: somaPor(outrasPartes, x => x.valor), recebidoPor: "—" })
  const faturamento = somaPor(entreguesDia, p => p.totalCliente)
  if (Math.abs(somaPor(porForma, f => f.valor) - faturamento) > 0.009)
    alertas.push({ nivel: "critico", titulo: "Total por modalidade não fecha", detalhe: `Soma das modalidades difere do faturamento em R$ ${(somaPor(porForma, f => f.valor) - faturamento).toFixed(2)}`, valor: somaPor(porForma, f => f.valor) - faturamento })
  for (const p of entreguesDia) {
    if (!p.valorConfere) alertas.push({ nivel: "atencao", titulo: "Valores do pedido não fecham", detalhe: `produtos + entrega − desconto ≠ total pago`, pedido: p.codigo, responsavel: p.loja, valor: p.produtos + p.entrega - p.desconto - p.totalCliente })
    if (temOnline(p) && !asaasErro) {
      const idAsaas = pedidosDia.find(x => x.id === p.id)?.asaas_payment_id
      if (!idAsaas) alertas.push({ nivel: "critico", titulo: "Pedido online sem cobrança no Asaas", detalhe: `${p.forma} entregue sem cobrança vinculada`, pedido: p.codigo, responsavel: p.loja, valor: p.totalCliente })
      else if (p.asaasStatus && !["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(p.asaasStatus))
        alertas.push({ nivel: "critico", titulo: "Pagamento online não confirmado", detalhe: `Pedido entregue com cobrança ${p.asaasStatus} no Asaas`, pedido: p.codigo, responsavel: p.loja, valor: p.totalCliente })
    }
    if (p.descontoFinanciador === "nao_identificado") alertas.push({ nivel: "atencao", titulo: "Desconto sem cupom identificado", detalhe: "Considerado custo da Chegô até confirmação", pedido: p.codigo, responsavel: p.loja, valor: p.desconto })
  }
  for (const p of canceladosDia) {
    const a = [p.asaas_payment_id, p.asaas_payment_id_2].filter(Boolean).map((id: string) => pay.get(id)).find(x => x && ["RECEIVED", "CONFIRMED"].includes(x.status))
    if (a) alertas.push({ nivel: "critico", titulo: "Pedido cancelado com pagamento recebido", detalhe: "Cobrança paga no Asaas e sem estorno — conferir devolução ao cliente", pedido: p.codigo, responsavel: nomeLoja(p.loja_id), valor: n(p.total) })
  }
  const dupAsaas = new Map<string, string[]>()
  for (const p of pedidosDia) for (const id of [p.asaas_payment_id, p.asaas_payment_id_2]) if (id) dupAsaas.set(id, [...(dupAsaas.get(id) ?? []), p.codigo])
  for (const [, cods] of dupAsaas) if (cods.length > 1) alertas.push({ nivel: "critico", titulo: "Mesma cobrança em mais de um pedido", detalhe: cods.join(", ") })
  const grupoTransf = new Map<string, Movimento[]>()
  for (const m of movsDia.filter(m => m.origem === "asaas")) { const k = `${m.motoboy_id ?? m.loja_id ?? m.destinatario_nome}|${m.valor}`; grupoTransf.set(k, [...(grupoTransf.get(k) ?? []), m]) }
  for (const [, ms] of grupoTransf) if (ms.length > 1) alertas.push({ nivel: "atencao", titulo: "Possível pagamento duplicado", detalhe: `${ms.length} Pix de R$ ${ms[0].valor.toFixed(2).replace(".", ",")} para ${ms[0].destinatario_nome ?? "—"} no mesmo dia`, responsavel: ms[0].destinatario_nome ?? undefined, valor: ms[0].valor * (ms.length - 1) })
  for (const m of movsDia.filter(m => m.tipo === "nao_identificado")) alertas.push({ nivel: "atencao", titulo: "Pix enviado sem identificação", detalhe: `${m.destinatario_nome ?? "—"} — ${m.motivo}. Atribua a uma loja/motoboy em Financeiro → Movimentos.`, responsavel: m.destinatario_nome ?? undefined, valor: m.valor })
  for (const m of movsDia.filter(m => m.origem === "manual" && !m.responsavel)) alertas.push({ nivel: "atencao", titulo: "Movimento sem responsável", detalhe: `${m.tipo} — ${m.motivo}`, valor: m.valor })
  for (const mb of motoboys) {
    if (mb.divergenciaCaixa !== null && Math.abs(mb.divergenciaCaixa) > 0.009)
      alertas.push({ nivel: "critico", titulo: `⚠️ DIVERGÊNCIA DE CAIXA — VALOR A CONCILIAR: R$ ${Math.abs(mb.divergenciaCaixa).toFixed(2).replace(".", ",")}`, detalhe: `${mb.nome}: esperado R$ ${mb.dinheiroSobResponsabilidade.toFixed(2).replace(".", ",")}, ${mb.conferidoOrigem} R$ ${mb.conferido!.toFixed(2).replace(".", ",")}. Pedidos em dinheiro do dia: ${entreguesDia.filter(p => p.motoboy_id === mb.motoboy_id && p.dinheiroComMotoboy > 0).map(p => p.codigo).join(", ") || "nenhum"}. Não presume desvio — conferir.`, responsavel: mb.nome, valor: Math.abs(mb.divergenciaCaixa) })
    else if (mb.conferido === null && mb.dinheiroSobResponsabilidade > 0.009)
      alertas.push({ nivel: "atencao", titulo: "Dinheiro sem conferência", detalhe: `${mb.nome} está com R$ ${mb.dinheiroSobResponsabilidade.toFixed(2).replace(".", ",")} em espécie sem conferência registrada no dia.`, responsavel: mb.nome, valor: mb.dinheiroSobResponsabilidade })
  }
  if (aguardPag.length) alertas.push({ nivel: "info", titulo: "Pedidos não pagos", detalhe: `${aguardPag.length} pedido(s) ficaram aguardando pagamento e não contam como venda: ${aguardPag.map(p => p.codigo).join(", ")}` })
  if (andamento.length) alertas.push({ nivel: "info", titulo: "Pedidos em andamento no corte", detalhe: `${andamento.length} pedido(s) ainda não concluídos; entram como ajuste no próximo fechamento: ${andamento.map(p => p.codigo).join(", ")}` })
  for (const r of recebimentosSemPedido) alertas.push({ nivel: "info", titulo: "Recebimento no Asaas sem pedido", detalhe: `${r.descricao} (${r.tipo}) — não contado como receita até identificação`, valor: r.valor })

  const ultimo = [...pedidosDia.map(p => p.atualizado_em ?? p.criado_em), ...movsDia.map(m => m.ocorrido_em)].sort().pop() ?? null
  const devidoLojas = somaPor(lojas.filter(l => l.pendenteAtual > 0), l => l.pendenteAtual)
  const devidoMotoboys = somaPor(motoboys.filter(m => m.saldoReceber > 0), m => m.saldoReceber)
  const ordem = { critico: 0, atencao: 1, info: 2 }
  alertas.sort((a, b) => ordem[a.nivel] - ordem[b.nivel])

  return {
    data: dataYmd, inicioControle, corteEm, ultimoMovimentoEm: ultimo,
    resumo: {
      pedidosRealizados: pedidosDia.length - aguardPag.length, concluidos: entreguesDia.length, cancelados: canceladosDia.length, emAndamento: andamento.length, aguardandoPagamento: aguardPag.length,
      faturamentoBruto: faturamento, produtos: somaPor(entreguesDia, p => p.produtos), taxasEntrega: somaPor(entreguesDia, p => p.entrega),
      descontos: somaPor(entreguesDia, p => p.desconto), descontosLoja: somaPor(entreguesDia, p => p.descontoLoja),
      descontosChego: somaPor(entreguesDia.filter(p => p.descontoFinanciador === "chego"), p => p.descontoChego),
      descontosNaoIdentificados: somaPor(entreguesDia.filter(p => p.descontoFinanciador === "nao_identificado"), p => p.desconto),
      comissoes, devidoLojas, devidoMotoboys,
      receitaBruta: receitaTotal, custos: custosTotal, resultado: receitaTotal - custosTotal, resultadoParcial: pendencias.length > 0,
    },
    porForma, pedidos: entreguesDia,
    cancelados: canceladosDia.map(p => ({ codigo: p.codigo, loja: nomeLoja(p.loja_id), forma: p.forma_pagamento, total: n(p.total), motivo: p.motivo_cancelamento ?? null, asaasStatus: p.asaas_payment_id ? pay.get(p.asaas_payment_id)?.status ?? null : null })),
    emAndamento: andamento.map(p => ({ codigo: p.codigo, loja: nomeLoja(p.loja_id), status: p.status, forma: p.forma_pagamento, total: n(p.total) })),
    ajustesAnteriores, lojas, motoboys,
    movimentosDia: movsDia.map(m => ({ ...m, nome: m.motoboy_id ? nomeMb(m.motoboy_id) : m.loja_id ? nomeLoja(m.loja_id) : m.destinatario_nome ?? "—" })).sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em)),
    receita: {
      comissoes, taxasPagamentoCobradas: tpCobradas, participacaoEntrega: particip, mensalidades: mensal, mensalidadesDetalhe, outrasReceitas: 0,
      taxasProcessamento: taxasAsaas, taxasProcessamentoDetalhe: "Taxas reais do Asaas (Pix, cartão e boletos de mensalidade)", taxaStoneNaoApurada: maquininhaApp,
      cuponsChego, complementoPiso: complemento, bonus: bonusDia, pagamentosAutorizados: autorizDia,
      despesas, despesasDetalhe: despesasValidas.map(d => ({ descricao: d.descricao, valor: n(d.valor) })),
      receitaTotal, custosTotal, resultado: receitaTotal - custosTotal, pendencias,
    },
    recebimentosSemPedido, alertas,
    snapshot: Object.fromEntries(pedidosDia.map(p => [p.id, p.status])),
  }
}

