export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"
import { statusOperacional, pedidoValido, pedidoConcluidoOuCancelado } from "@/lib/statusPedido"
import {
  resolverPeriodo, resolverPeriodoAnterior, variacaoPct, horaBrt, ymdBrt, diaSemanaYmd,
  hojeYmdBrt, type ChavePeriodo,
} from "@/lib/periodoBrt"
import { tempoPedido } from "@/lib/tempoPedido"
import type { StatusPedido } from "@/types"

// Endpoint agregador da Visão Geral (Dashboard) do lojista — consolida tudo num único
// round-trip do navegador em vez de várias queries Supabase soltas por card (spec do
// redesign, seção 19 "performance"). Todo o cálculo de período/status vive aqui, nunca
// duplicado nos componentes — fonte única de verdade (seção 21).
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
const STATUS_LABEL: Record<StatusPedido, string> = {
  aguardando_pagamento: "Aguard. pagamento", pendente: "Novo pedido", aceito: "Aceito",
  preparando: "Preparando", pronto: "Pronto para entrega", aguardando_aceite: "Aguardando motoboy",
  indo_para_loja: "Motoboy a caminho", na_loja: "Motoboy na loja", em_rota: "Em rota de entrega",
  coletado: "Coletado", entregue: "Entregue", cancelado: "Cancelado",
}

interface PedidoBasico {
  id: string; status: StatusPedido; subtotal: number; criado_em: string
  aceito_em: string | null; pronto_em: string | null; coletado_em: string | null; entregue_em: string | null
}

function somaVendas(lista: { status: StatusPedido; subtotal: number }[]) {
  return lista.filter(p => pedidoValido(p.status)).reduce((s, p) => s + (p.subtotal ?? 0), 0)
}
function contaPedidosValidos(lista: { status: StatusPedido }[]) {
  return lista.filter(p => pedidoValido(p.status)).length
}

export async function GET(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()
  const loja_id = sess.loja_id

  const { searchParams } = req.nextUrl
  const chave = (searchParams.get("periodo") ?? "hoje") as ChavePeriodo
  const customInicio = searchParams.get("inicio") ?? undefined
  const customFim = searchParams.get("fim") ?? undefined

  if (!["hoje", "semana", "mes", "custom"].includes(chave)) {
    return NextResponse.json({ error: "Período inválido" }, { status: 400 })
  }
  if (chave === "custom") {
    if (!customInicio || !customFim) return NextResponse.json({ error: "Informe início e fim" }, { status: 400 })
    if (customInicio > customFim) return NextResponse.json({ error: "Data final não pode ser anterior à inicial" }, { status: 400 })
  }

  const periodo = resolverPeriodo(chave, customInicio, customFim)
  const periodoAnterior = resolverPeriodoAnterior(chave)

  const sb = adminClient()

  const camposPeriodo = "id, status, subtotal, criado_em, aceito_em, pronto_em, coletado_em, entregue_em"
  const hojeInicioUtc = new Date(`${hojeYmdBrt()}T00:00:00-03:00`).toISOString()

  const [
    { data: lojaRow },
    { data: pedidosPeriodo, error: erroPeriodo },
    { data: pedidosAnteriorRaw },
    { data: operacaoAgora, error: erroOperacao },
    { data: produtosLoja },
    { data: ultimosRaw },
  ] = await Promise.all([
    sb.from("lojas").select("aberto, nome").eq("id", loja_id).single(),
    sb.from("pedidos").select(camposPeriodo).eq("loja_id", loja_id).gte("criado_em", periodo.inicioUtc).lte("criado_em", periodo.fimUtc),
    periodoAnterior
      ? sb.from("pedidos").select("id, status, subtotal").eq("loja_id", loja_id).gte("criado_em", periodoAnterior.inicioUtc).lte("criado_em", periodoAnterior.fimUtc)
      : Promise.resolve({ data: [] as { id: string; status: StatusPedido; subtotal: number }[] }),
    sb.from("pedidos").select("id, status, motoboy_id, criado_em").eq("loja_id", loja_id).gte("criado_em", hojeInicioUtc)
      .not("status", "in", '("aguardando_pagamento","entregue","cancelado")'),
    sb.from("produtos").select("id, foto_url").eq("loja_id", loja_id),
    sb.from("pedidos").select("id, codigo, status, nome_cliente, total, criado_em, entregue_em").eq("loja_id", loja_id).order("criado_em", { ascending: false }).limit(5),
  ])

  if (erroPeriodo) return NextResponse.json({ error: erroPeriodo.message }, { status: 500 })
  if (erroOperacao) return NextResponse.json({ error: erroOperacao.message }, { status: 500 })

  const lista = (pedidosPeriodo ?? []) as PedidoBasico[]
  const listaAnterior = (pedidosAnteriorRaw ?? []) as { id: string; status: StatusPedido; subtotal: number }[]

  // ── KPIs ────────────────────────────────────────────────────────────────────────
  const vendas = somaVendas(lista)
  const numPedidos = contaPedidosValidos(lista)
  const ticketMedio = numPedidos > 0 ? vendas / numPedidos : 0

  const vendasAnterior = periodoAnterior ? somaVendas(listaAnterior) : null
  const pedidosAnterior = periodoAnterior ? contaPedidosValidos(listaAnterior) : null
  const ticketMedioAnterior = periodoAnterior && pedidosAnterior ? (vendasAnterior ?? 0) / pedidosAnterior : (periodoAnterior ? 0 : null)

  const concluidosOuCancelados = lista.filter(p => pedidoConcluidoOuCancelado(p.status))
  const entregues = concluidosOuCancelados.filter(p => p.status === "entregue").length
  const cancelados = concluidosOuCancelados.filter(p => p.status === "cancelado").length
  const taxaConclusao = concluidosOuCancelados.length > 0 ? (entregues / concluidosOuCancelados.length) * 100 : null

  // ── Operação agora (tempo real, ignora filtro de período) ────────────────────────
  const opAgora = { novo: 0, preparo: 0, pronto: 0, aguardando_motoboy: 0, em_entrega: 0 }
  for (const p of operacaoAgora ?? []) {
    const s = statusOperacional(p.status as StatusPedido)
    if (s) opAgora[s]++
  }

  // ── Itens vendidos no período (só pedidos entregues) → Mais vendidos ────────────
  const idsEntreguesPeriodo = lista.filter(p => p.status === "entregue").map(p => p.id)
  let maisVendidos: { produto_id: string | null; nome: string; qtd: number; valorTotal: number; foto_url: string | null }[] = []
  if (idsEntreguesPeriodo.length > 0) {
    const { data: itens } = await sb.from("itens_pedido").select("produto_id, nome, quantidade, preco").in("pedido_id", idsEntreguesPeriodo)
    const fotoPorProduto = new Map((produtosLoja ?? []).map((p: { id: string; foto_url: string | null }) => [p.id, p.foto_url]))
    const contagem = new Map<string, { produto_id: string | null; nome: string; qtd: number; valorTotal: number }>()
    for (const i of itens ?? []) {
      const chave = i.produto_id ?? i.nome
      const atual = contagem.get(chave) ?? { produto_id: i.produto_id, nome: i.nome, qtd: 0, valorTotal: 0 }
      atual.qtd += i.quantidade
      atual.valorTotal += (i.preco ?? 0) * i.quantidade
      contagem.set(chave, atual)
    }
    maisVendidos = [...contagem.values()]
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 5)
      .map(p => ({ ...p, foto_url: p.produto_id ? fotoPorProduto.get(p.produto_id) ?? null : null }))
  }

  // ── Série do gráfico de vendas ───────────────────────────────────────────────────
  const serie = montarSerie(chave, lista, periodo.inicioYmd, periodo.fimYmd)

  // ── Últimos pedidos (tempo real, não filtrado por período) ──────────────────────
  // Tempo calculado via lib/tempoPedido.ts — nunca "agora - criado_em" direto aqui de
  // novo (era exatamente esse cálculo incondicional que gerava "73366 min" em pedidos
  // entregues/cancelados há semanas).
  interface UltimoPedidoRaw { id: string; codigo: string; status: StatusPedido; nome_cliente: string | null; total: number; criado_em: string; entregue_em: string | null }
  const ultimosPedidos = ((ultimosRaw ?? []) as UltimoPedidoRaw[]).map(p => {
    const t = tempoPedido(p)
    return {
      id: p.id, codigo: p.codigo, cliente: p.nome_cliente ?? "Cliente", status: p.status,
      statusLabel: STATUS_LABEL[p.status] ?? p.status, valor: p.total,
      tempoLabel: t.label, tempoTipo: t.tipo,
    }
  })

  // ── Horário de pico (pedidos entregues no período, por hora BRT) ────────────────
  const entreguesPeriodo = lista.filter(p => p.status === "entregue")
  let horarioPico: { faixa: string; participacaoPct: number } | null = null
  if (entreguesPeriodo.length >= 3) {
    const porHora = new Map<number, number>()
    for (const p of entreguesPeriodo) {
      const h = horaBrt(p.criado_em)
      porHora.set(h, (porHora.get(h) ?? 0) + 1)
    }
    let melhorHora = 0, melhorQtd = -1
    for (const [h, qtd] of porHora) if (qtd > melhorQtd) { melhorHora = h; melhorQtd = qtd }
    const janela = [melhorHora, (melhorHora + 1) % 24, (melhorHora + 2) % 24]
    const qtdJanela = janela.reduce((s, h) => s + (porHora.get(h) ?? 0), 0)
    horarioPico = {
      faixa: `${String(melhorHora).padStart(2, "0")}h – ${String((melhorHora + 2) % 24).padStart(2, "0")}h`,
      participacaoPct: Math.round((qtdJanela / entreguesPeriodo.length) * 100),
    }
  }

  // ── Desempenho operacional ───────────────────────────────────────────────────────
  // Só calcula tempo com timestamps confiáveis — auditoria confirmou pronto_em vazio em
  // boa parte da amostra (~63% dos pedidos recentes), então o tempo de preparo só usa a
  // fração que tem os dois carimbos, com o tamanho da amostra sempre exposto.
  const comPreparo = entreguesPeriodo.filter(p => p.aceito_em && p.pronto_em)
  const tempoPreparoMin = comPreparo.length > 0
    ? comPreparo.reduce((s, p) => s + (new Date(p.pronto_em!).getTime() - new Date(p.aceito_em!).getTime()), 0) / comPreparo.length / 60000
    : null
  const comEntrega = entreguesPeriodo.filter(p => p.coletado_em && p.entregue_em)
  const tempoEntregaMin = comEntrega.length > 0
    ? comEntrega.reduce((s, p) => s + (new Date(p.entregue_em!).getTime() - new Date(p.coletado_em!).getTime()), 0) / comEntrega.length / 60000
    : null
  const taxaCancelamento = concluidosOuCancelados.length > 0 ? (cancelados / concluidosOuCancelados.length) * 100 : null

  return NextResponse.json({
    lojaNome: lojaRow?.nome ?? null,
    aberto: lojaRow?.aberto ?? false,
    periodo: { inicioYmd: periodo.inicioYmd, fimYmd: periodo.fimYmd },
    kpis: {
      vendas, vendasAnterior, vendasVariacaoPct: variacaoPct(vendas, vendasAnterior),
      pedidos: numPedidos, pedidosAnterior, pedidosVariacaoPct: variacaoPct(numPedidos, pedidosAnterior),
      ticketMedio, ticketMedioAnterior, ticketMedioVariacaoPct: variacaoPct(ticketMedio, ticketMedioAnterior),
      taxaConclusao, cancelados,
    },
    operacaoAgora: opAgora,
    serie,
    maisVendidos,
    ultimosPedidos,
    horarioPico,
    desempenho: {
      tempoPreparoMin, amostraPreparo: comPreparo.length,
      tempoEntregaMin, amostraEntrega: comEntrega.length,
      taxaCancelamento,
    },
  })
}

function montarSerie(chave: ChavePeriodo, lista: PedidoBasico[], inicioYmd: string, fimYmd: string) {
  const validos = lista.filter(p => pedidoValido(p.status))
  const diffDias = (new Date(fimYmd + "T00:00:00Z").getTime() - new Date(inicioYmd + "T00:00:00Z").getTime()) / 86400000

  // Hoje (ou personalizado <= 1 dia): agrupa por faixa de 2 horas.
  if (chave === "hoje" || (chave === "custom" && diffDias <= 1)) {
    const buckets = Array.from({ length: 12 }, (_, i) => ({ rotulo: `${String(i * 2).padStart(2, "0")}h`, vendas: 0, pedidos: 0 }))
    for (const p of validos) {
      const h = horaBrt(p.criado_em)
      const idx = Math.floor(h / 2)
      buckets[idx].vendas += p.subtotal ?? 0
      buckets[idx].pedidos += 1
    }
    return buckets
  }

  // Semana (ou personalizado <= 7 dias): agrupa por dia da semana.
  if (chave === "semana" || (chave === "custom" && diffDias <= 7)) {
    const dias: string[] = []
    for (let ymd = inicioYmd; ymd <= fimYmd; ) {
      dias.push(ymd)
      const [a, m, d] = ymd.split("-").map(Number)
      const dt = new Date(Date.UTC(a, m - 1, d + 1))
      ymd = dt.toISOString().slice(0, 10)
    }
    const buckets = dias.map(ymd => ({ rotulo: DIAS_SEMANA[diaSemanaYmd(ymd)], ymd, vendas: 0, pedidos: 0 }))
    const porYmd = new Map(buckets.map(b => [b.ymd, b]))
    for (const p of validos) {
      const b = porYmd.get(ymdBrt(p.criado_em))
      if (b) { b.vendas += p.subtotal ?? 0; b.pedidos += 1 }
    }
    return buckets.map(({ rotulo, vendas, pedidos }) => ({ rotulo, vendas, pedidos }))
  }

  // Mês (ou personalizado <= 62 dias): agrupa por dia.
  if (chave === "mes" || (chave === "custom" && diffDias <= 62)) {
    const dias: string[] = []
    for (let ymd = inicioYmd; ymd <= fimYmd; ) {
      dias.push(ymd)
      const [a, m, d] = ymd.split("-").map(Number)
      const dt = new Date(Date.UTC(a, m - 1, d + 1))
      ymd = dt.toISOString().slice(0, 10)
    }
    const buckets = dias.map(ymd => ({ rotulo: ymd.slice(8, 10), ymd, vendas: 0, pedidos: 0 }))
    const porYmd = new Map(buckets.map(b => [b.ymd, b]))
    for (const p of validos) {
      const b = porYmd.get(ymdBrt(p.criado_em))
      if (b) { b.vendas += p.subtotal ?? 0; b.pedidos += 1 }
    }
    return buckets.map(({ rotulo, vendas, pedidos }) => ({ rotulo, vendas, pedidos }))
  }

  // Personalizado longo (> 62 dias): agrupa por semana.
  const semanas = new Map<string, { rotulo: string; vendas: number; pedidos: number }>()
  for (const p of validos) {
    const ymd = ymdBrt(p.criado_em)
    const inicioSemana = (() => {
      const [a, m, d] = ymd.split("-").map(Number)
      const dt = new Date(Date.UTC(a, m - 1, d))
      dt.setUTCDate(dt.getUTCDate() - diaSemanaYmd(ymd))
      return dt.toISOString().slice(0, 10)
    })()
    const b = semanas.get(inicioSemana) ?? { rotulo: inicioSemana.slice(5).replace("-", "/"), vendas: 0, pedidos: 0 }
    b.vendas += p.subtotal ?? 0; b.pedidos += 1
    semanas.set(inicioSemana, b)
  }
  return [...semanas.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
}
