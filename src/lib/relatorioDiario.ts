// Fechamento diário — Prompt do usuário, 2026-09-18: 1 PDF de repasse aos lojistas
// (separado por loja dentro do mesmo arquivo) + 1 PDF de repasse aos motoboys, enviados
// por e-mail todo dia às 10h (BRT) cobrindo o dia anterior completo (00h-23h59 BRT).
//
// Regras de taxa confirmadas pelo usuário em chat (não vêm de uma constante única no
// código — documentado também em memória do projeto):
// - Comissão Chegô: `lojas.comissao` (normalmente 10%, algumas lojas isentas = 0%).
// - Taxa de pagamento: Pix R$1,00 FIXO por pedido (não percentual) · Maquininha 3,08% ·
//   Cartão 1,99% + R$0,49 · Dinheiro sem taxa.
// - Entrega avulsa a R$3,00 soma R$1,00 de repasse extra pra fechar R$4,00 pro motoboy.
//
// Ganho do motoboy: reaproveita `ganhoMotoboy`/`taxaMotoboy` de lib/comissao.ts — nunca
// duplicar essa fórmula aqui (ver AGENTS.md). Pedido explícito do usuário, 2026-09-18:
// a diferença que a loja deveria cobrir pra completar o piso de R$4 em pedidos com
// taxa_entrega baixa (`repasseLojaPorPedido`) NÃO entra no desconto do lojista por
// enquanto — fica de fora deste relatório até decisão em contrário.

import { createClient } from "@supabase/supabase-js"
import { partesPagamento, rotuloPagamento, temForma } from "@/lib/pagamentoDividido"
// puppeteer-core (não playwright-core) — @sparticuz/chromium é testado/documentado
// oficialmente com puppeteer-core; a combinação com playwright-core deu "spawn ETXTBSY"
// em produção na Vercel (achado real, 2026-09-18), mesmo com o binário extraído certo.
import puppeteer from "puppeteer-core"
import sparticuzChromium from "@sparticuz/chromium"
import { ganhoMotoboy, taxaMotoboy } from "@/lib/comissao"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const CNPJ = "67.543.510/0001-86"
const ORANGE = "#F26522"
const ORANGE_LIGHT = "#FFF3EC"
const DARK = "#1A1A1A"
const BORDER = "#E5E7EB"
const FORMA_LABEL: Record<string, string> = { pix: "Pix", maquininha: "Maquininha", cartao: "Cartão", dinheiro: "Dinheiro", pix_loja: "Pix loja" }

function taxaPgto(forma: string, valor: number): number {
  if (forma === "pix") return 1.00
  if (forma === "maquininha") return valor * 0.0308
  if (forma === "cartao") return valor * 0.0199 + 0.49
  return 0
}
function R(v: number) { return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function truncNome(n: string, max = 26) { return n.length > max ? n.slice(0, max - 1) + "…" : n }
function fmtDataHora(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600000)
  const dd = String(d.getUTCDate()).padStart(2, "0"), mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const hh = String(d.getUTCHours()).padStart(2, "0"), mi = String(d.getUTCMinutes()).padStart(2, "0")
  return `${dd}/${mm} ${hh}:${mi}`
}
/** dataYmd "YYYY-MM-DD" (dia em Brasília) -> [inicioUtcIso, fimUtcIso] cobrindo 00h-23h59:59 BRT. */
function limitesDoDataYmdBrt(dataYmd: string): [string, string] {
  const inicio = new Date(`${dataYmd}T00:00:00-03:00`).toISOString()
  const fim = new Date(`${dataYmd}T23:59:59.999-03:00`).toISOString()
  return [inicio, fim]
}
function fmtDataLabel(dataYmd: string) {
  const [ano, mes, dia] = dataYmd.split("-")
  return `${dia}/${mes}/${ano}`
}
/** Rótulos do cabeçalho: dia único (cron diário) ou período (export manual de vários dias). */
function rotulos(dataYmd: string, fimYmd: string) {
  const periodo = fimYmd !== dataYmd
  return {
    periodo,
    data: periodo ? `Período ${fmtDataLabel(dataYmd)} a ${fmtDataLabel(fimYmd)}` : `Dia ${fmtDataLabel(dataYmd)}`,
    fechamento: periodo ? "Fechamento do período" : "Fechamento diário",
    doDia: periodo ? "do período" : "do dia",
    nesteDia: periodo ? "neste período" : "neste dia",
  }
}
const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"]
/** ISO UTC -> "YYYY-MM-DD" do dia em Brasília. */
function diaBrt(iso: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso)) }
function fmtDiaSemana(dataYmd: string) { return `${DIAS_SEMANA[new Date(`${dataYmd}T12:00:00-03:00`).getUTCDay()]}, ${fmtDataLabel(dataYmd)}` }
/** Todos os dias de inicio a fim (inclusive), "YYYY-MM-DD". */
function diasDoPeriodo(inicioYmd: string, fimYmd: string): string[] {
  const dias: string[] = []
  for (let t = new Date(`${inicioYmd}T12:00:00Z`).getTime(); t <= new Date(`${fimYmd}T12:00:00Z`).getTime(); t += 86400000) dias.push(new Date(t).toISOString().slice(0, 10))
  return dias
}
function doDia<T extends { criado_em: string }>(lista: T[], dataYmd: string) { return lista.filter(x => diaBrt(x.criado_em) === dataYmd) }

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: ${DARK}; margin: 0; }
  .page { padding: 32px 36px; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .brand { color: ${ORANGE}; font-weight: 800; font-size: 13px; }
  .subtitle { color: #6B7280; font-size: 11px; margin-top: 2px; }
  h1 { font-size: 20px; margin: 8px 0 2px; }
  .periodo { color: #6B7280; font-size: 12px; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  thead tr { background: ${DARK}; color: #fff; }
  th { text-align: left; padding: 6px 7px; font-weight: 700; }
  th.num, td.num { text-align: right; }
  td { padding: 5px 7px; border-bottom: 1px solid ${BORDER}; }
  tr.total td { font-weight: 800; border-top: 2px solid ${DARK}; border-bottom: none; background: ${ORANGE_LIGHT}; }
  .resumo-table tr:nth-child(odd) td { background: #FAFAFA; }
  .box-liquido { background: ${ORANGE}; color: #fff; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin: 10px 0 14px; }
  .box-liquido .lbl { font-size: 12px; font-weight: 700; }
  .box-liquido .val { font-size: 20px; font-weight: 900; }
  .linha-calc { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; border-bottom: 1px solid ${BORDER}; }
  .linha-calc.first { font-weight: 700; padding-top: 0; }
  .linha-calc .neg { color: #B91C1C; }
  h3 { font-size: 12.5px; margin: 14px 0 6px; }
  .footer-note { font-size: 9px; color: #6B7280; margin-top: 10px; line-height: 1.5; }
  .selo { display: inline-block; font-size: 9px; font-weight: 800; color: #166534; background: #DCFCE7; border: 1px solid #86EFAC; border-radius: 999px; padding: 3px 10px; margin-bottom: 8px; }
  .sem-movimento { color: #6B7280; font-size: 12.5px; margin-top: 30px; }
  table.det { font-size: 9.5px; }
  table.det th, table.det td { padding: 4px 5px; }
  tr.ped td { border-bottom: none; padding-bottom: 1px; }
  tr.itens td { color: #4B5563; font-size: 9px; padding: 0 5px 5px 5px; border-bottom: 1px solid ${BORDER}; line-height: 1.45; }
  tr.itens td b { color: ${DARK}; font-weight: 700; }
  tr { page-break-inside: avoid; }
`

// @sparticuz/chromium empacota um binário Linux (Vercel/Lambda) — não roda no macOS local.
// Em dev local (sem VERCEL definido), usa o Chrome do sistema pra permitir testar a
// geração do PDF antes de subir; em produção usa sempre o binário do sparticuz.
/** "2× X-Bacon (+ Bacon extra, + Cheddar) R$ 25,00 — obs: sem cebola" */
function descreverItem(it: { nome?: string; preco?: number | string; quantidade?: number; adicionais?: unknown; observacao?: string | null }): string {
  // itens_pedido.preco é o preço BASE; cada adicional tem preço próprio (somado à parte)
  const q = Number(it.quantidade ?? 1)
  const adic = Array.isArray(it.adicionais) ? (it.adicionais as { nome?: string; preco?: number | string }[]).filter(a => a?.nome) : []
  const valorUnit = Number(it.preco ?? 0) + adic.reduce((s, a) => s + Number(a.preco ?? 0), 0)
  const obs = (it.observacao ?? "").toString().trim()
  const adicTxt = adic.map(a => Number(a.preco ?? 0) > 0 ? `${a.nome} R$ ${R(Number(a.preco))}` : a.nome).join(", + ")
  return `${q}× ${it.nome ?? "item"}${adic.length ? ` (+ ${adicTxt})` : ""} = R$ ${R(valorUnit * q)}${obs ? ` — obs: ${obs}` : ""}`
}

function esperar(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function renderHtmlParaPdf(html: string): Promise<Buffer> {
  const local = !process.env.VERCEL
  const executablePath = local ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : await sparticuzChromium.executablePath()
  // "spawn ETXTBSY" real em produção (achado 2026-09-18) — copiar o binário pra um
  // caminho único quebrou o Chromium (ele precisa dos arquivos irmãos extraídos junto —
  // fontes, ICU, swiftshader — que ficam no mesmo diretório do sparticuz). O ETXTBSY
  // real é uma corrida: Vercel (Fluid Compute) roda invocações concorrentes no mesmo
  // container, e duas chamadas simultâneas de executablePath() podem colidir escrevendo
  // /tmp/chromium ao mesmo tempo. Retry com espera curta resolve sem quebrar os
  // arquivos irmãos, reaproveitando o caminho fixo/cacheado como o pacote já pretende.
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null
  let ultimoErro: unknown
  for (let tentativa = 0; tentativa < 4 && !browser; tentativa++) {
    if (tentativa > 0) await esperar(500 * tentativa)
    try {
      browser = await puppeteer.launch({
        executablePath,
        args: local ? [] : sparticuzChromium.args,
        headless: true,
      })
    } catch (e) {
      ultimoErro = e
    }
  }
  if (!browser) throw ultimoErro
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "load" })
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "8mm", bottom: "12mm", left: "0mm", right: "0mm" } })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

// ───────────────────────── LOJISTAS ─────────────────────────

/** `lojaId` (opcional) gera o demonstrativo de UMA loja só — mesmo layout do fechamento
 * enviado por e-mail (usado pra demonstrativos individuais por período). */
export async function gerarPdfLojistas(dataYmd: string, fimYmd = dataYmd, lojaId?: string): Promise<{ buffer: Buffer; temMovimento: boolean; comissaoTotal: number }> {
  const sb = adminSb()
  const [inicioUtc] = limitesDoDataYmdBrt(dataYmd)
  const [, fimUtc] = limitesDoDataYmdBrt(fimYmd)
  const rot = rotulos(dataYmd, fimYmd)

  const { data: pedidos } = await sb.from("pedidos")
    .select("id, codigo, loja_id, forma_pagamento, forma_pagamento_2, valor_pagamento_1, valor_pagamento_2, subtotal, taxa_entrega, total, desconto, cupom_codigo, frete_gratis, criado_em, nome_cliente, troco_para, tipo_cartao_entrega")
    .eq("status", "entregue").gte("criado_em", inicioUtc).lte("criado_em", fimUtc).order("criado_em")

  // Itens de cada pedido (detalhamento do repasse) — em lotes pra não estourar a URL
  const itensPorPedido = new Map<string, string>()
  const idsPed = (pedidos ?? []).filter(p => !lojaId || p.loja_id === lojaId).map(p => p.id)
  for (let i = 0; i < idsPed.length; i += 150) {
    const { data: itens } = await sb.from("itens_pedido").select("pedido_id, nome, preco, quantidade, adicionais, observacao").in("pedido_id", idsPed.slice(i, i + 150))
    for (const it of itens ?? []) {
      const l = itensPorPedido.get(it.pedido_id) ?? ""
      itensPorPedido.set(it.pedido_id, (l ? l + " · " : "") + descreverItem(it))
    }
  }

  // Avulsas de TODAS as lojas — antes só entravam as de lojas que também tiveram pedido
  // no app no período, então loja que só usou avulsa nem aparecia no repasse. Desde
  // 2026-10-04 a avulsa traz itens do cardápio e a comissão da Chegô sobre eles
  // (comissao_valor, calculada na criação em /api/entrega-avulsa) — descontada do repasse.
  const { data: avulsas } = await sb.from("entregas_avulsas").select("codigo, loja_id, taxa_entrega, subtotal_itens, comissao_valor, criado_em, cliente_nome, itens")
    .eq("status", "entregue").gte("criado_em", inicioUtc).lte("criado_em", fimUtc).order("criado_em")

  const idsComMovimento = new Set([...(pedidos ?? []).map(p => p.loja_id), ...(avulsas ?? []).map((a: any) => a.loja_id)])
  const { data: lojas } = idsComMovimento.size > 0
    ? await sb.from("lojas").select("id, nome, comissao").in("id", [...idsComMovimento])
    : { data: [] as any[] }
  const lojasPorId = new Map((lojas ?? []).map(l => [l.id, l]))

  const porLoja = new Map<string, { nome: string; comissaoPct: number; pedidos: any[]; avulsas: any[] }>()
  for (const p of pedidos ?? []) {
    if (lojaId && p.loja_id !== lojaId) continue
    const loja = lojasPorId.get(p.loja_id)
    if (!loja) continue
    if (!porLoja.has(p.loja_id)) porLoja.set(p.loja_id, { nome: loja.nome, comissaoPct: Number(loja.comissao) / 100, pedidos: [], avulsas: [] })
    const valor = Number(p.total), entrega = Number(p.taxa_entrega), subtotal = Number(p.subtotal)
    const comissaoPct = porLoja.get(p.loja_id)!.comissaoPct
    const comissao = comissaoPct * subtotal
    // Pagamento em 2 formas: taxa de cada parte sobre o próprio valor
    const tpgto = partesPagamento(p).reduce((s, x) => s + taxaPgto(x.forma, x.valor), 0)
    const forma = (p.forma_pagamento_2 ? rotuloPagamento(p) : FORMA_LABEL[p.forma_pagamento] ?? p.forma_pagamento) + (temForma(p, "maquininha") && p.tipo_cartao_entrega ? ` (${p.tipo_cartao_entrega})` : "")
    porLoja.get(p.loja_id)!.pedidos.push({ codigo: p.codigo, cliente: p.nome_cliente || "—", forma, formaChave: FORMA_LABEL[p.forma_pagamento] ?? p.forma_pagamento, valor, entrega, subtotal, desconto: Number(p.desconto ?? 0), cupom: p.cupom_codigo ?? null, freteGratis: !!p.frete_gratis, troco: p.troco_para ? Number(p.troco_para) : null, itens: itensPorPedido.get(p.id) ?? "", comissao, tpgto, liquido: valor - entrega - comissao - tpgto, criado_em: p.criado_em })
  }
  for (const a of (avulsas ?? []) as any[]) {
    if (lojaId && a.loja_id !== lojaId) continue
    const loja = lojasPorId.get(a.loja_id)
    if (!loja) continue
    if (!porLoja.has(a.loja_id)) porLoja.set(a.loja_id, { nome: loja.nome, comissaoPct: Number(loja.comissao) / 100, pedidos: [], avulsas: [] })
    const taxa = Number(a.taxa_entrega)
    const repasseExtra = taxa === 3.00 ? 1.00 : 0
    const itensAv = Array.isArray(a.itens) ? a.itens.map(descreverItem).join(" · ") : ""
    porLoja.get(a.loja_id)!.avulsas.push({ codigo: a.codigo, cliente: a.cliente_nome || "—", itens: itensAv, taxa, repasseExtra, total: taxa + repasseExtra, pedido: Number(a.subtotal_itens ?? 0), comissao: Number(a.comissao_valor ?? 0), criado_em: a.criado_em })
  }

  const lojasOrdenadas = [...porLoja.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome))

  function linhaResumo([, d]: [string, typeof porLoja extends Map<string, infer V> ? V : never]) {
    const bruto = d.pedidos.reduce((s, p) => s + p.valor, 0)
    const entregaPedidos = d.pedidos.reduce((s, p) => s + p.entrega, 0)
    const entregaAvulsas = d.avulsas.reduce((s: number, a: any) => s + a.total, 0)
    const comissao = d.pedidos.reduce((s, p) => s + p.comissao, 0) + d.avulsas.reduce((s: number, a: any) => s + a.comissao, 0)
    const taxaPgtoTotal = d.pedidos.reduce((s, p) => s + p.tpgto, 0)
    const entregas = entregaPedidos + entregaAvulsas
    const liquido = bruto - entregas - comissao - taxaPgtoTotal
    return { nome: d.nome, pedidos: d.pedidos.length, bruto, entregas, comissao, taxaPgto: taxaPgtoTotal, liquido }
  }
  const resumos = lojasOrdenadas.map(linhaResumo)
  const totalGeral = resumos.reduce((acc, l) => ({ pedidos: acc.pedidos + l.pedidos, bruto: acc.bruto + l.bruto, entregas: acc.entregas + l.entregas, comissao: acc.comissao + l.comissao, taxaPgto: acc.taxaPgto + l.taxaPgto, liquido: acc.liquido + l.liquido }), { pedidos: 0, bruto: 0, entregas: 0, comissao: 0, taxaPgto: 0, liquido: 0 })

  const dias = diasDoPeriodo(dataYmd, fimYmd)
  function tabelaPedidos(lista: any[], isenta: boolean, rotuloTotal: string) {
    const t = (k: string) => lista.reduce((s, p) => s + p[k], 0)
    // Detalhado (pedido do usuário, 2026-10-09): produtos, desconto/cupom e os itens de
    // cada pedido numa linha logo abaixo — dá pra conferir a comissão (sobre os produtos).
    return `<table class="det">
        <thead><tr><th>Data/hora</th><th>Pedido</th><th>Cliente</th><th>Pagamento</th><th class="num">Produtos</th><th class="num">Desc.</th><th class="num">Entrega</th><th class="num">Total</th><th class="num">Comissão</th><th class="num">Taxa pgto</th><th class="num">Líquido</th></tr></thead>
        <tbody>
          ${lista.map(p => `<tr class="ped"><td>${fmtDataHora(p.criado_em)}</td><td><b>${p.codigo}</b></td><td>${truncNome(p.cliente, 22)}</td><td>${p.forma}${p.troco ? `<br><span style="color:#6B7280">troco p/ R$ ${R(p.troco)}</span>` : ""}</td><td class="num">${R(p.subtotal)}</td><td class="num">${p.desconto > 0 ? `−${R(p.desconto)}` : "—"}</td><td class="num">${p.freteGratis ? "grátis" : R(p.entrega)}</td><td class="num">${R(p.valor)}</td><td class="num">${isenta ? "0,00" : R(p.comissao)}</td><td class="num">${R(p.tpgto)}</td><td class="num"><b>${R(p.liquido)}</b></td></tr>
          <tr class="itens"><td colspan="11">${p.itens ? `<b>Itens:</b> ${p.itens}` : "<i>itens não registrados</i>"}${p.cupom ? ` · <b>Cupom:</b> ${p.cupom}` : ""}</td></tr>`).join("")}
          <tr class="total"><td colspan="4">${rotuloTotal}</td><td class="num">${R(t("subtotal"))}</td><td class="num">${t("desconto") > 0 ? `−${R(t("desconto"))}` : "—"}</td><td class="num">${R(t("entrega"))}</td><td class="num">${R(t("valor"))}</td><td class="num">${R(t("comissao"))}</td><td class="num">${R(t("tpgto"))}</td><td class="num">${R(t("liquido"))}</td></tr>
        </tbody>
      </table>`
  }
  function tabelaAvulsas(lista: any[], rotuloTotal: string) {
    return `<table class="det">
        <thead><tr><th>Data/hora</th><th>Código</th><th>Cliente</th><th class="num">Pedido</th><th class="num">Taxa</th><th class="num">Repasse</th><th class="num">Entrega</th><th class="num">Comissão</th></tr></thead>
        <tbody>${lista.map((a: any) => `<tr class="ped"><td>${fmtDataHora(a.criado_em)}</td><td><b>${a.codigo}</b></td><td>${truncNome(a.cliente, 22)}</td><td class="num">${a.pedido > 0 ? `R$ ${R(a.pedido)}` : "—"}</td><td class="num">R$ ${R(a.taxa)}</td><td class="num">${a.repasseExtra > 0 ? `R$ ${R(a.repasseExtra)}` : "—"}</td><td class="num">R$ ${R(a.total)}</td><td class="num">${a.comissao > 0 ? `R$ ${R(a.comissao)}` : "—"}</td></tr>
        <tr class="itens"><td colspan="8">${a.itens ? `<b>Itens:</b> ${a.itens}` : "<i>corrida sem itens do cardápio</i>"}</td></tr>`).join("")}
        <tr class="total"><td colspan="6">${rotuloTotal}</td><td class="num">R$ ${R(lista.reduce((s: number, a: any) => s + a.total, 0))}</td><td class="num">R$ ${R(lista.reduce((s: number, a: any) => s + a.comissao, 0))}</td></tr></tbody>
      </table>`
  }

  function paginaLoja([, d]: [string, typeof porLoja extends Map<string, infer V> ? V : never]) {
    const isenta = d.comissaoPct === 0
    const bruto = d.pedidos.reduce((s, p) => s + p.valor, 0)
    const entregaPedidos = d.pedidos.reduce((s, p) => s + p.entrega, 0)
    const entregaAvulsas = d.avulsas.reduce((s: number, a: any) => s + a.total, 0)
    const comissao = d.pedidos.reduce((s, p) => s + p.comissao, 0)
    const comissaoAvulsas = d.avulsas.reduce((s: number, a: any) => s + a.comissao, 0)
    const taxaPgtoTotal = d.pedidos.reduce((s, p) => s + p.tpgto, 0)
    const liquido = bruto - entregaPedidos - entregaAvulsas - comissao - comissaoAvulsas - taxaPgtoTotal
    return `
    <div class="page">
      <div class="brand">Chegô Delivery <span style="color:${DARK};font-weight:400">· CNPJ ${CNPJ}</span></div>
      <div class="subtitle">${rot.fechamento} — repasse ao lojista</div>
      <h1>${d.nome}</h1>
      <div class="periodo">${rot.data} · Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
      <div class="linha-calc first"><span>Vendas entregues (${d.pedidos.length} pedidos)</span><span>R$ ${R(bruto)}</span></div>
      <div class="linha-calc"><span>(−) Taxas de entrega dos pedidos</span><span class="neg">− R$ ${R(entregaPedidos)}</span></div>
      ${d.avulsas.length > 0 ? `<div class="linha-calc"><span>(−) Entregas avulsas (${d.avulsas.length})</span><span class="neg">− R$ ${R(entregaAvulsas)}</span></div>` : ""}
      ${comissaoAvulsas > 0 ? `<div class="linha-calc"><span>(−) Comissão Chegô sobre itens das avulsas</span><span class="neg">− R$ ${R(comissaoAvulsas)}</span></div>` : ""}
      <div class="linha-calc"><span>(−) Comissão Chegô ${isenta ? "(isenta)" : `${(d.comissaoPct * 100).toFixed(0)}%`}</span><span class="${isenta ? "" : "neg"}">${isenta ? "R$ 0,00" : `− R$ ${R(comissao)}`}</span></div>
      <div class="linha-calc"><span>(−) Taxas de pagamento</span><span class="neg">− R$ ${R(taxaPgtoTotal)}</span></div>
      <div class="box-liquido"><span class="lbl">LÍQUIDO ${rot.doDia.toUpperCase()}</span><span class="val">R$ ${R(liquido)}</span></div>
      ${d.pedidos.length > 0 ? `
      <h3>Por forma de pagamento</h3>
      <table class="resumo-table">
        <thead><tr><th>Pagamento</th><th class="num">Pedidos</th><th class="num">Produtos</th><th class="num">Entrega</th><th class="num">Total</th><th class="num">Comissão</th><th class="num">Taxa pgto</th><th class="num">Líquido</th></tr></thead>
        <tbody>${[...new Set(d.pedidos.map(p => p.formaChave))].map(f => { const ps = d.pedidos.filter(p => p.formaChave === f), t = (k: string) => ps.reduce((s, p) => s + p[k], 0)
          return `<tr><td>${f}</td><td class="num">${ps.length}</td><td class="num">${R(t("subtotal"))}</td><td class="num">${R(t("entrega"))}</td><td class="num">${R(t("valor"))}</td><td class="num">${R(t("comissao"))}</td><td class="num">${R(t("tpgto"))}</td><td class="num"><strong>${R(t("liquido"))}</strong></td></tr>` }).join("")}</tbody>
      </table>` : ""}
      ${rot.periodo ? `
      <h3>Resumo por dia</h3>
      <table class="resumo-table">
        <thead><tr><th>Dia</th><th class="num">Pedidos</th><th class="num">Bruto</th><th class="num">Entrega</th><th class="num">Avulsas</th><th class="num">Comissão</th><th class="num">Taxa pgto</th><th class="num">Líquido</th></tr></thead>
        <tbody>
          ${dias.map(dia => { const ps = doDia(d.pedidos, dia), avs = doDia(d.avulsas, dia), t = (k: string) => ps.reduce((s, p) => s + p[k], 0), av = avs.reduce((s: number, a: any) => s + a.total, 0), avCom = avs.reduce((s: number, a: any) => s + a.comissao, 0)
            return `<tr><td>${fmtDiaSemana(dia)}</td><td class="num">${ps.length}</td><td class="num">${R(t("valor"))}</td><td class="num">${R(t("entrega"))}</td><td class="num">${R(av)}</td><td class="num">${R(t("comissao") + avCom)}</td><td class="num">${R(t("tpgto"))}</td><td class="num"><strong>${R(t("liquido") - av - avCom)}</strong></td></tr>` }).join("")}
          <tr class="total"><td>Total</td><td class="num">${d.pedidos.length}</td><td class="num">${R(bruto)}</td><td class="num">${R(entregaPedidos)}</td><td class="num">${R(entregaAvulsas)}</td><td class="num">${R(comissao + comissaoAvulsas)}</td><td class="num">${R(taxaPgtoTotal)}</td><td class="num">${R(liquido)}</td></tr>
        </tbody>
      </table>
      ${dias.filter(dia => doDia(d.pedidos, dia).length + doDia(d.avulsas, dia).length > 0).map(dia => {
        const ps = doDia(d.pedidos, dia), avs = doDia(d.avulsas, dia)
        return `<h3>${fmtDiaSemana(dia)} — ${ps.length} pedido${ps.length !== 1 ? "s" : ""}${avs.length > 0 ? ` + ${avs.length} avulsa${avs.length !== 1 ? "s" : ""}` : ""}</h3>
        ${ps.length > 0 ? tabelaPedidos(ps, isenta, "Total do dia") : ""}${avs.length > 0 ? tabelaAvulsas(avs, "Avulsas do dia") : ""}`
      }).join("")}` : `
      <h3>Pedidos entregues (${d.pedidos.length})</h3>
      ${tabelaPedidos(d.pedidos, isenta, "Total")}
      ${d.avulsas.length > 0 ? `
      <h3>Entregas avulsas (${d.avulsas.length})</h3>
      ${tabelaAvulsas(d.avulsas, "Total")}` : ""}`}
      <p class="footer-note">Comissão Chegô ${isenta ? "0% (loja isenta)" : `${(d.comissaoPct * 100).toFixed(0)}%`} sobre o valor dos produtos. Taxa de pagamento: Pix R$1,00 fixo · Maquininha 3,08% · Cartão 1,99%+R$0,49 · Dinheiro sem taxa. Entregas avulsas de R$3,00 recebem R$1,00 de repasse extra pra fechar R$4,00.</p>
    </div>`
  }

  // Demonstrativo individual (lojaId): sem a página de resumo geral — vai direto pra loja
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="page"${lojaId && resumos.length ? ' style="display:none"' : ""}>
      <div class="brand">Chegô Delivery <span style="color:${DARK};font-weight:400">· CNPJ ${CNPJ}</span></div>
      <div class="subtitle">${rot.fechamento} — repasse aos lojistas</div>
      <span class="selo">✓ Gerado automaticamente a partir dos pedidos reais do sistema</span>
      <h1>Repasse aos lojistas — resumo ${rot.doDia}</h1>
      <div class="periodo">${rot.data} · Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
      ${resumos.length === 0 ? `<p class="sem-movimento">Nenhum pedido entregue ${rot.nesteDia}.</p>` : `
      <table class="resumo-table">
        <thead><tr><th>Loja</th><th class="num">Pedidos</th><th class="num">Bruto</th><th class="num">Entregas</th><th class="num">Comissão</th><th class="num">Taxa pgto</th><th class="num">Líquido</th></tr></thead>
        <tbody>
          ${resumos.map(l => `<tr><td>${l.nome}</td><td class="num">${l.pedidos}</td><td class="num">${R(l.bruto)}</td><td class="num">${R(l.entregas)}</td><td class="num">${R(l.comissao)}</td><td class="num">${R(l.taxaPgto)}</td><td class="num"><strong>${R(l.liquido)}</strong></td></tr>`).join("")}
          <tr class="total"><td>Total</td><td class="num">${totalGeral.pedidos}</td><td class="num">${R(totalGeral.bruto)}</td><td class="num">${R(totalGeral.entregas)}</td><td class="num">${R(totalGeral.comissao)}</td><td class="num">${R(totalGeral.taxaPgto)}</td><td class="num">${R(totalGeral.liquido)}</td></tr>
        </tbody>
      </table>`}
    </div>
    ${lojasOrdenadas.map(paginaLoja).join("")}
  </body></html>`

  return { buffer: await renderHtmlParaPdf(html), temMovimento: resumos.length > 0, comissaoTotal: totalGeral.comissao }
}

// ───────────────────────── MOTOBOYS ─────────────────────────

/** `motoboyId` (opcional) gera o demonstrativo de UM entregador só (sem o resumo geral). */
export async function gerarPdfMotoboys(dataYmd: string, fimYmd = dataYmd, motoboyId?: string): Promise<{ buffer: Buffer; temMovimento: boolean; corteAppTotal: number }> {
  const sb = adminSb()
  const [inicioUtc] = limitesDoDataYmdBrt(dataYmd)
  const [, fimUtc] = limitesDoDataYmdBrt(fimYmd)
  const rot = rotulos(dataYmd, fimYmd)

  const { data: pedidos } = await sb.from("pedidos")
    .select("codigo, motoboy_id, taxa_entrega, taxa_dinamica, criado_em, loja_id")
    .eq("status", "entregue").not("motoboy_id", "is", null)
    .gte("criado_em", inicioUtc).lte("criado_em", fimUtc).order("criado_em")

  const { data: avulsas } = await sb.from("entregas_avulsas")
    .select("codigo, motoboy_id, motoboy_nome, taxa_entrega, criado_em")
    .eq("status", "entregue").not("motoboy_id", "is", null)
    .gte("criado_em", inicioUtc).lte("criado_em", fimUtc).order("criado_em")

  const idsLojas = [...new Set((pedidos ?? []).map(p => p.loja_id))]
  const { data: lojas } = idsLojas.length > 0 ? await sb.from("lojas").select("id, nome").in("id", idsLojas) : { data: [] as any[] }
  const nomeLojaPorId = new Map((lojas ?? []).map(l => [l.id, l.nome]))

  const idsMotoboys = [...new Set([...(pedidos ?? []).map(p => p.motoboy_id), ...(avulsas ?? []).map((a: any) => a.motoboy_id)])]
  const { data: motoboys } = idsMotoboys.length > 0 ? await sb.from("motoboys").select("id, nome").in("id", idsMotoboys) : { data: [] as any[] }
  const nomeMotoboyPorId = new Map((motoboys ?? []).map(m => [m.id, m.nome]))

  const porMotoboy = new Map<string, { nome: string; entregas: any[] }>()
  let corteAppTotal = 0
  for (const p of pedidos ?? []) {
    if (motoboyId && p.motoboy_id !== motoboyId) continue
    const nome = nomeMotoboyPorId.get(p.motoboy_id) ?? "—"
    if (!porMotoboy.has(p.motoboy_id)) porMotoboy.set(p.motoboy_id, { nome, entregas: [] })
    const taxa = Number(p.taxa_entrega)
    const ganho = ganhoMotoboy(taxa, p.criado_em) + (Number((p as any).taxa_dinamica) || 0) // + corrida dinâmica
    corteAppTotal += taxaMotoboy(taxa, p.criado_em)
    porMotoboy.get(p.motoboy_id)!.entregas.push({ tipo: "Pedido", codigo: p.codigo, origem: nomeLojaPorId.get(p.loja_id) ?? "—", taxa, ganho, criado_em: p.criado_em })
  }
  for (const a of (avulsas ?? []) as any[]) {
    if (motoboyId && a.motoboy_id !== motoboyId) continue
    const nome = nomeMotoboyPorId.get(a.motoboy_id) ?? a.motoboy_nome ?? "—"
    if (!porMotoboy.has(a.motoboy_id)) porMotoboy.set(a.motoboy_id, { nome, entregas: [] })
    const taxa = Number(a.taxa_entrega)
    const ganho = ganhoMotoboy(taxa, a.criado_em)
    corteAppTotal += taxaMotoboy(taxa, a.criado_em)
    porMotoboy.get(a.motoboy_id)!.entregas.push({ tipo: "Avulsa", codigo: a.codigo, origem: "Corrida avulsa", taxa, ganho, criado_em: a.criado_em })
  }

  const motoboysOrdenados = [...porMotoboy.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome))
  const resumos = motoboysOrdenados.map(([, d]) => ({ nome: d.nome, entregas: d.entregas.length, ganho: d.entregas.reduce((s, e) => s + e.ganho, 0) }))
  const totalGeral = resumos.reduce((acc, m) => ({ entregas: acc.entregas + m.entregas, ganho: acc.ganho + m.ganho }), { entregas: 0, ganho: 0 })

  const dias = diasDoPeriodo(dataYmd, fimYmd)
  function tabelaEntregas(lista: any[], rotuloTotal: string) {
    return `<table>
        <thead><tr><th>Hora</th><th>Tipo</th><th>Código</th><th>Loja/Origem</th><th class="num">Taxa de entrega</th><th class="num">Ganho</th></tr></thead>
        <tbody>
          ${lista.map(e => `<tr><td>${fmtDataHora(e.criado_em)}</td><td>${e.tipo}</td><td>${e.codigo}</td><td>${truncNome(e.origem, 30)}</td><td class="num">${R(e.taxa)}</td><td class="num">${R(e.ganho)}</td></tr>`).join("")}
          <tr class="total"><td colspan="5">${rotuloTotal}</td><td class="num">${R(lista.reduce((s, e) => s + e.ganho, 0))}</td></tr>
        </tbody>
      </table>`
  }

  function paginaMotoboy([, d]: [string, { nome: string; entregas: any[] }]) {
    const ganhoTotal = d.entregas.reduce((s, e) => s + e.ganho, 0)
    return `
    <div class="page">
      <div class="brand">Chegô Delivery <span style="color:${DARK};font-weight:400">· CNPJ ${CNPJ}</span></div>
      <div class="subtitle">${rot.fechamento} — repasse ao entregador</div>
      <h1>${d.nome}</h1>
      <div class="periodo">${rot.data} · Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
      <div class="box-liquido"><span class="lbl">TOTAL A RECEBER ${rot.doDia.toUpperCase()} (${d.entregas.length} entrega${d.entregas.length !== 1 ? "s" : ""})</span><span class="val">R$ ${R(ganhoTotal)}</span></div>
      ${rot.periodo ? `
      <h3>Resumo por dia</h3>
      <table class="resumo-table">
        <thead><tr><th>Dia</th><th class="num">Entregas</th><th class="num">Ganho</th></tr></thead>
        <tbody>
          ${dias.map(dia => { const es = doDia(d.entregas, dia); return `<tr><td>${fmtDiaSemana(dia)}</td><td class="num">${es.length}</td><td class="num"><strong>${R(es.reduce((s, e) => s + e.ganho, 0))}</strong></td></tr>` }).join("")}
          <tr class="total"><td>Total</td><td class="num">${d.entregas.length}</td><td class="num">${R(ganhoTotal)}</td></tr>
        </tbody>
      </table>
      ${dias.filter(dia => doDia(d.entregas, dia).length > 0).map(dia => {
        const es = doDia(d.entregas, dia)
        return `<h3>${fmtDiaSemana(dia)} — ${es.length} entrega${es.length !== 1 ? "s" : ""}</h3>${tabelaEntregas(es, "Total do dia")}`
      }).join("")}` : `
      <h3>Entregas realizadas</h3>
      ${tabelaEntregas(d.entregas, "Total")}`}
      <p class="footer-note">Ganho calculado pela regra vigente de repasse ao entregador (lib/comissao.ts) — piso de R$${4},00 por entrega quando a taxa cobrada é menor que isso.</p>
    </div>`
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="page"${motoboyId && resumos.length ? ' style="display:none"' : ""}>
      <div class="brand">Chegô Delivery <span style="color:${DARK};font-weight:400">· CNPJ ${CNPJ}</span></div>
      <div class="subtitle">${rot.fechamento} — repasse aos motoboys</div>
      <span class="selo">✓ Gerado automaticamente a partir das entregas reais do sistema</span>
      <h1>Repasse aos motoboys — resumo ${rot.doDia}</h1>
      <div class="periodo">${rot.data} · Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
      ${resumos.length === 0 ? `<p class="sem-movimento">Nenhuma entrega realizada ${rot.nesteDia}.</p>` : `
      <table class="resumo-table">
        <thead><tr><th>Motoboy</th><th class="num">Entregas</th><th class="num">Ganho total</th></tr></thead>
        <tbody>
          ${resumos.map(m => `<tr><td>${m.nome}</td><td class="num">${m.entregas}</td><td class="num"><strong>${R(m.ganho)}</strong></td></tr>`).join("")}
          <tr class="total"><td>Total</td><td class="num">${totalGeral.entregas}</td><td class="num">${R(totalGeral.ganho)}</td></tr>
        </tbody>
      </table>`}
    </div>
    ${motoboysOrdenados.map(paginaMotoboy).join("")}
  </body></html>`

  return { buffer: await renderHtmlParaPdf(html), temMovimento: resumos.length > 0, corteAppTotal }
}

// ───────────────────────── ENTREGAS AVULSAS ─────────────────────────

/** Relatório próprio das corridas avulsas (pedido do usuário, 2026-10-09): resumo por loja
 * e a lista completa, uma a uma — loja, cliente, endereço, motoboy, itens, taxa, repasse
 * extra (R$3 → R$4), total ao motoboy e comissão da Chegô sobre os itens. Mesmas regras
 * do repasse aos lojistas/motoboys (os valores batem com os outros dois PDFs). */
export async function gerarPdfAvulsas(dataYmd: string, fimYmd = dataYmd): Promise<{ buffer: Buffer; temMovimento: boolean; total: number }> {
  const sb = adminSb()
  const [inicioUtc] = limitesDoDataYmdBrt(dataYmd)
  const [, fimUtc] = limitesDoDataYmdBrt(fimYmd)
  const rot = rotulos(dataYmd, fimYmd)
  const { data: avulsas } = await sb.from("entregas_avulsas")
    .select("codigo, loja_id, loja_nome, motoboy_id, motoboy_nome, cliente_nome, cliente_tel, endereco, referencia, taxa_entrega, subtotal_itens, valor_pedido, comissao_valor, itens, observacao, criado_em")
    .eq("status", "entregue").gte("criado_em", inicioUtc).lte("criado_em", fimUtc).order("criado_em")
  const lista = (avulsas ?? []) as any[]
  const idsLojas = [...new Set(lista.map(a => a.loja_id).filter(Boolean))]
  const idsMb = [...new Set(lista.map(a => a.motoboy_id).filter(Boolean))]
  const [{ data: lojas }, { data: mbs }] = await Promise.all([
    idsLojas.length ? sb.from("lojas").select("id, nome").in("id", idsLojas) : Promise.resolve({ data: [] as any[] }),
    idsMb.length ? sb.from("motoboys").select("id, nome").in("id", idsMb) : Promise.resolve({ data: [] as any[] }),
  ])
  const nomeLoja = new Map((lojas ?? []).map((l: any) => [l.id, l.nome]))
  const nomeMb = new Map((mbs ?? []).map((m: any) => [m.id, m.nome]))
  const linhas = lista.map(a => {
    const taxa = Number(a.taxa_entrega)
    const repasseExtra = taxa === 3.00 ? 1.00 : 0
    const itens = Array.isArray(a.itens) ? a.itens.map(descreverItem).join(" · ") : ""
    return {
      codigo: a.codigo, criado_em: a.criado_em, loja: nomeLoja.get(a.loja_id) ?? a.loja_nome ?? "—", motoboy: nomeMb.get(a.motoboy_id) ?? a.motoboy_nome ?? "—",
      cliente: a.cliente_nome || "—", telefone: a.cliente_tel || "", endereco: [a.endereco, a.referencia ? `ref: ${a.referencia}` : ""].filter(Boolean).join(" · "),
      itens, obs: (a.observacao ?? "").toString().trim(), pedido: Number(a.subtotal_itens ?? a.valor_pedido ?? 0),
      taxa, repasseExtra, motoboyRecebe: ganhoMotoboy(taxa, a.criado_em), comissao: Number(a.comissao_valor ?? 0),
    }
  })
  const soma = (l: typeof linhas, k: "pedido" | "taxa" | "repasseExtra" | "motoboyRecebe" | "comissao") => l.reduce((s, x) => s + x[k], 0)
  const porLoja = [...new Set(linhas.map(l => l.loja))].sort().map(nome => ({ nome, l: linhas.filter(x => x.loja === nome) }))
  const dias = diasDoPeriodo(dataYmd, fimYmd)
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="page">
      <div class="brand">Chegô Delivery <span style="color:${DARK};font-weight:400">· CNPJ ${CNPJ}</span></div>
      <div class="subtitle">${rot.fechamento} — entregas avulsas</div>
      <span class="selo">✓ Gerado automaticamente a partir das corridas reais do sistema</span>
      <h1>Entregas avulsas — ${linhas.length} corrida${linhas.length === 1 ? "" : "s"}</h1>
      <div class="periodo">${rot.data} · Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
      ${linhas.length === 0 ? `<p class="sem-movimento">Nenhuma entrega avulsa ${rot.nesteDia}.</p>` : `
      <div class="linha-calc first"><span>Corridas entregues</span><span>${linhas.length}</span></div>
      <div class="linha-calc"><span>Valor dos itens (cardápio)</span><span>R$ ${R(soma(linhas, "pedido"))}</span></div>
      <div class="linha-calc"><span>Taxas de entrega cobradas das lojas</span><span>R$ ${R(soma(linhas, "taxa"))}</span></div>
      <div class="linha-calc"><span>Repasse extra (corridas de R$3 completadas pra R$4)</span><span>R$ ${R(soma(linhas, "repasseExtra"))}</span></div>
      <div class="linha-calc"><span>Total aos motoboys</span><span>R$ ${R(soma(linhas, "motoboyRecebe"))}</span></div>
      <div class="box-liquido"><span class="lbl">COMISSÃO CHEGÔ SOBRE OS ITENS</span><span class="val">R$ ${R(soma(linhas, "comissao"))}</span></div>
      <h3>Por loja</h3>
      <table class="resumo-table">
        <thead><tr><th>Loja</th><th class="num">Corridas</th><th class="num">Itens</th><th class="num">Taxas</th><th class="num">Repasse extra</th><th class="num">Aos motoboys</th><th class="num">Comissão</th></tr></thead>
        <tbody>${porLoja.map(g => `<tr><td>${g.nome}</td><td class="num">${g.l.length}</td><td class="num">${R(soma(g.l, "pedido"))}</td><td class="num">${R(soma(g.l, "taxa"))}</td><td class="num">${R(soma(g.l, "repasseExtra"))}</td><td class="num">${R(soma(g.l, "motoboyRecebe"))}</td><td class="num"><strong>${R(soma(g.l, "comissao"))}</strong></td></tr>`).join("")}
          <tr class="total"><td>Total</td><td class="num">${linhas.length}</td><td class="num">${R(soma(linhas, "pedido"))}</td><td class="num">${R(soma(linhas, "taxa"))}</td><td class="num">${R(soma(linhas, "repasseExtra"))}</td><td class="num">${R(soma(linhas, "motoboyRecebe"))}</td><td class="num">${R(soma(linhas, "comissao"))}</td></tr></tbody>
      </table>
      <h3>Por motoboy</h3>
      <table class="resumo-table">
        <thead><tr><th>Motoboy</th><th class="num">Corridas</th><th class="num">Recebe</th></tr></thead>
        <tbody>${[...new Set(linhas.map(l => l.motoboy))].sort().map(m => { const l = linhas.filter(x => x.motoboy === m); return `<tr><td>${m}</td><td class="num">${l.length}</td><td class="num"><strong>${R(soma(l, "motoboyRecebe"))}</strong></td></tr>` }).join("")}</tbody>
      </table>`}
    </div>
    ${linhas.length === 0 ? "" : `<div class="page">
      <div class="brand">Chegô Delivery <span style="color:${DARK};font-weight:400">· CNPJ ${CNPJ}</span></div>
      <div class="subtitle">${rot.fechamento} — entregas avulsas, corrida a corrida</div>
      ${dias.filter(d => doDia(linhas, d).length > 0).map(d => { const l = doDia(linhas, d); return `
      <h3>${fmtDiaSemana(d)} — ${l.length} corrida${l.length === 1 ? "" : "s"}</h3>
      <table class="det">
        <thead><tr><th>Hora</th><th>Código</th><th>Loja</th><th>Cliente</th><th>Motoboy</th><th class="num">Itens</th><th class="num">Taxa</th><th class="num">Extra</th><th class="num">Motoboy</th><th class="num">Comissão</th></tr></thead>
        <tbody>${l.map(a => `<tr class="ped"><td>${fmtDataHora(a.criado_em)}</td><td><b>${a.codigo}</b></td><td>${truncNome(a.loja, 20)}</td><td>${truncNome(a.cliente, 18)}</td><td>${truncNome(a.motoboy, 16)}</td><td class="num">${a.pedido > 0 ? R(a.pedido) : "—"}</td><td class="num">${R(a.taxa)}</td><td class="num">${a.repasseExtra > 0 ? R(a.repasseExtra) : "—"}</td><td class="num">${R(a.motoboyRecebe)}</td><td class="num">${a.comissao > 0 ? R(a.comissao) : "—"}</td></tr>
          <tr class="itens"><td colspan="10">${a.endereco ? `<b>Endereço:</b> ${a.endereco}` : ""}${a.telefone ? ` · <b>Tel:</b> ${a.telefone}` : ""}${a.itens ? `<br><b>Itens:</b> ${a.itens}` : " · <i>corrida sem itens do cardápio</i>"}${a.obs ? ` · <b>Obs:</b> ${a.obs}` : ""}</td></tr>`).join("")}
          <tr class="total"><td colspan="5">Total do dia</td><td class="num">${R(soma(l, "pedido"))}</td><td class="num">${R(soma(l, "taxa"))}</td><td class="num">${R(soma(l, "repasseExtra"))}</td><td class="num">${R(soma(l, "motoboyRecebe"))}</td><td class="num">${R(soma(l, "comissao"))}</td></tr></tbody>
      </table>` }).join("")}
      <p class="footer-note">Taxa = valor cobrado da loja pela corrida. Corridas de R$3,00 recebem R$1,00 de repasse extra pra fechar R$4,00 ao motoboy. Comissão Chegô sobre o valor dos itens do cardápio, conforme o % da loja — descontada no repasse ao lojista.</p>
    </div>`}
  </body></html>`
  return { buffer: await renderHtmlParaPdf(html), temMovimento: linhas.length > 0, total: soma(linhas, "comissao") }
}
