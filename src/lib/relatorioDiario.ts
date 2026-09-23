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
const FORMA_LABEL: Record<string, string> = { pix: "Pix", maquininha: "Maquininha", cartao: "Cartão", dinheiro: "Dinheiro" }

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
`

// @sparticuz/chromium empacota um binário Linux (Vercel/Lambda) — não roda no macOS local.
// Em dev local (sem VERCEL definido), usa o Chrome do sistema pra permitir testar a
// geração do PDF antes de subir; em produção usa sempre o binário do sparticuz.
function esperar(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function renderHtmlParaPdf(html: string): Promise<Buffer> {
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

export async function gerarPdfLojistas(dataYmd: string): Promise<{ buffer: Buffer; temMovimento: boolean; comissaoTotal: number }> {
  const sb = adminSb()
  const [inicioUtc, fimUtc] = limitesDoDataYmdBrt(dataYmd)

  const { data: pedidos } = await sb.from("pedidos")
    .select("codigo, loja_id, forma_pagamento, subtotal, taxa_entrega, total, criado_em, nome_cliente")
    .eq("status", "entregue").gte("criado_em", inicioUtc).lte("criado_em", fimUtc).order("criado_em")

  const lojaIds = [...new Set((pedidos ?? []).map(p => p.loja_id))]
  const { data: avulsas } = lojaIds.length > 0
    ? await sb.from("entregas_avulsas").select("codigo, loja_id, taxa_entrega, criado_em")
        .eq("status", "entregue").in("loja_id", lojaIds).gte("criado_em", inicioUtc).lte("criado_em", fimUtc).order("criado_em")
    : { data: [] as any[] }

  const idsComMovimento = new Set([...(pedidos ?? []).map(p => p.loja_id), ...(avulsas ?? []).map((a: any) => a.loja_id)])
  const { data: lojas } = idsComMovimento.size > 0
    ? await sb.from("lojas").select("id, nome, comissao").in("id", [...idsComMovimento])
    : { data: [] as any[] }
  const lojasPorId = new Map((lojas ?? []).map(l => [l.id, l]))

  const porLoja = new Map<string, { nome: string; comissaoPct: number; pedidos: any[]; avulsas: any[] }>()
  for (const p of pedidos ?? []) {
    const loja = lojasPorId.get(p.loja_id)
    if (!loja) continue
    if (!porLoja.has(p.loja_id)) porLoja.set(p.loja_id, { nome: loja.nome, comissaoPct: Number(loja.comissao) / 100, pedidos: [], avulsas: [] })
    const valor = Number(p.total), entrega = Number(p.taxa_entrega), subtotal = Number(p.subtotal)
    const comissaoPct = porLoja.get(p.loja_id)!.comissaoPct
    const comissao = comissaoPct * subtotal
    const tpgto = taxaPgto(p.forma_pagamento, valor)
    porLoja.get(p.loja_id)!.pedidos.push({ codigo: p.codigo, cliente: p.nome_cliente || "—", forma: FORMA_LABEL[p.forma_pagamento] ?? p.forma_pagamento, valor, entrega, subtotal, comissao, tpgto, liquido: valor - entrega - comissao - tpgto, criado_em: p.criado_em })
  }
  for (const a of (avulsas ?? []) as any[]) {
    const loja = lojasPorId.get(a.loja_id)
    if (!loja) continue
    if (!porLoja.has(a.loja_id)) porLoja.set(a.loja_id, { nome: loja.nome, comissaoPct: Number(loja.comissao) / 100, pedidos: [], avulsas: [] })
    const taxa = Number(a.taxa_entrega)
    const repasseExtra = taxa === 3.00 ? 1.00 : 0
    porLoja.get(a.loja_id)!.avulsas.push({ codigo: a.codigo, taxa, repasseExtra, total: taxa + repasseExtra, criado_em: a.criado_em })
  }

  const lojasOrdenadas = [...porLoja.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome))

  function linhaResumo([, d]: [string, typeof porLoja extends Map<string, infer V> ? V : never]) {
    const bruto = d.pedidos.reduce((s, p) => s + p.valor, 0)
    const entregaPedidos = d.pedidos.reduce((s, p) => s + p.entrega, 0)
    const entregaAvulsas = d.avulsas.reduce((s: number, a: any) => s + a.total, 0)
    const comissao = d.pedidos.reduce((s, p) => s + p.comissao, 0)
    const taxaPgtoTotal = d.pedidos.reduce((s, p) => s + p.tpgto, 0)
    const entregas = entregaPedidos + entregaAvulsas
    const liquido = bruto - entregas - comissao - taxaPgtoTotal
    return { nome: d.nome, pedidos: d.pedidos.length, bruto, entregas, comissao, taxaPgto: taxaPgtoTotal, liquido }
  }
  const resumos = lojasOrdenadas.map(linhaResumo)
  const totalGeral = resumos.reduce((acc, l) => ({ pedidos: acc.pedidos + l.pedidos, bruto: acc.bruto + l.bruto, entregas: acc.entregas + l.entregas, comissao: acc.comissao + l.comissao, taxaPgto: acc.taxaPgto + l.taxaPgto, liquido: acc.liquido + l.liquido }), { pedidos: 0, bruto: 0, entregas: 0, comissao: 0, taxaPgto: 0, liquido: 0 })

  function paginaLoja([, d]: [string, typeof porLoja extends Map<string, infer V> ? V : never]) {
    const isenta = d.comissaoPct === 0
    const bruto = d.pedidos.reduce((s, p) => s + p.valor, 0)
    const entregaPedidos = d.pedidos.reduce((s, p) => s + p.entrega, 0)
    const entregaAvulsas = d.avulsas.reduce((s: number, a: any) => s + a.total, 0)
    const comissao = d.pedidos.reduce((s, p) => s + p.comissao, 0)
    const taxaPgtoTotal = d.pedidos.reduce((s, p) => s + p.tpgto, 0)
    const liquido = bruto - entregaPedidos - entregaAvulsas - comissao - taxaPgtoTotal
    return `
    <div class="page">
      <div class="brand">Chegô Delivery <span style="color:${DARK};font-weight:400">· CNPJ ${CNPJ}</span></div>
      <div class="subtitle">Fechamento diário — repasse ao lojista</div>
      <h1>${d.nome}</h1>
      <div class="periodo">Dia ${fmtDataLabel(dataYmd)} · Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
      <div class="linha-calc first"><span>Vendas entregues (${d.pedidos.length} pedidos)</span><span>R$ ${R(bruto)}</span></div>
      <div class="linha-calc"><span>(−) Taxas de entrega dos pedidos</span><span class="neg">− R$ ${R(entregaPedidos)}</span></div>
      ${d.avulsas.length > 0 ? `<div class="linha-calc"><span>(−) Entregas avulsas (${d.avulsas.length})</span><span class="neg">− R$ ${R(entregaAvulsas)}</span></div>` : ""}
      <div class="linha-calc"><span>(−) Comissão Chegô ${isenta ? "(isenta)" : `${(d.comissaoPct * 100).toFixed(0)}%`}</span><span class="${isenta ? "" : "neg"}">${isenta ? "R$ 0,00" : `− R$ ${R(comissao)}`}</span></div>
      <div class="linha-calc"><span>(−) Taxas de pagamento</span><span class="neg">− R$ ${R(taxaPgtoTotal)}</span></div>
      <div class="box-liquido"><span class="lbl">LÍQUIDO DO DIA</span><span class="val">R$ ${R(liquido)}</span></div>
      <h3>Pedidos entregues (${d.pedidos.length})</h3>
      <table>
        <thead><tr><th>Hora</th><th>Pedido</th><th>Cliente</th><th>Pgto</th><th class="num">Valor</th><th class="num">Entrega</th><th class="num">Comissão</th><th class="num">Taxa pgto</th><th class="num">Líquido</th></tr></thead>
        <tbody>
          ${d.pedidos.map(p => `<tr><td>${fmtDataHora(p.criado_em)}</td><td>${p.codigo}</td><td>${truncNome(p.cliente)}</td><td>${p.forma}</td><td class="num">${R(p.valor)}</td><td class="num">${R(p.entrega)}</td><td class="num">${isenta ? "0,00" : R(p.comissao)}</td><td class="num">${R(p.tpgto)}</td><td class="num">${R(p.liquido)}</td></tr>`).join("")}
          <tr class="total"><td colspan="4">Total</td><td class="num">${R(bruto)}</td><td class="num">${R(entregaPedidos)}</td><td class="num">${R(comissao)}</td><td class="num">${R(taxaPgtoTotal)}</td><td class="num">${R(bruto - entregaPedidos - comissao - taxaPgtoTotal)}</td></tr>
        </tbody>
      </table>
      ${d.avulsas.length > 0 ? `
      <h3>Entregas avulsas (${d.avulsas.length})</h3>
      <table>
        <thead><tr><th>Hora</th><th>Código</th><th class="num">Taxa</th><th class="num">Repasse</th><th class="num">Total</th></tr></thead>
        <tbody>${d.avulsas.map((a: any) => `<tr><td>${fmtDataHora(a.criado_em)}</td><td>${a.codigo}</td><td class="num">R$ ${R(a.taxa)}</td><td class="num">${a.repasseExtra > 0 ? `R$ ${R(a.repasseExtra)}` : "—"}</td><td class="num">R$ ${R(a.total)}</td></tr>`).join("")}
        <tr class="total"><td colspan="4">Total</td><td class="num">R$ ${R(entregaAvulsas)}</td></tr></tbody>
      </table>` : ""}
      <p class="footer-note">Comissão Chegô ${isenta ? "0% (loja isenta)" : `${(d.comissaoPct * 100).toFixed(0)}%`} sobre o valor dos produtos. Taxa de pagamento: Pix R$1,00 fixo · Maquininha 3,08% · Cartão 1,99%+R$0,49 · Dinheiro sem taxa. Entregas avulsas de R$3,00 recebem R$1,00 de repasse extra pra fechar R$4,00.</p>
    </div>`
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="page">
      <div class="brand">Chegô Delivery <span style="color:${DARK};font-weight:400">· CNPJ ${CNPJ}</span></div>
      <div class="subtitle">Fechamento diário — repasse aos lojistas</div>
      <span class="selo">✓ Gerado automaticamente a partir dos pedidos reais do sistema</span>
      <h1>Repasse aos lojistas — resumo do dia</h1>
      <div class="periodo">Dia ${fmtDataLabel(dataYmd)} · Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
      ${resumos.length === 0 ? `<p class="sem-movimento">Nenhum pedido entregue neste dia.</p>` : `
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

export async function gerarPdfMotoboys(dataYmd: string): Promise<{ buffer: Buffer; temMovimento: boolean; corteAppTotal: number }> {
  const sb = adminSb()
  const [inicioUtc, fimUtc] = limitesDoDataYmdBrt(dataYmd)

  const { data: pedidos } = await sb.from("pedidos")
    .select("codigo, motoboy_id, taxa_entrega, criado_em, loja_id")
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
    const nome = nomeMotoboyPorId.get(p.motoboy_id) ?? "—"
    if (!porMotoboy.has(p.motoboy_id)) porMotoboy.set(p.motoboy_id, { nome, entregas: [] })
    const taxa = Number(p.taxa_entrega)
    const ganho = ganhoMotoboy(taxa, p.criado_em)
    corteAppTotal += taxaMotoboy(taxa, p.criado_em)
    porMotoboy.get(p.motoboy_id)!.entregas.push({ tipo: "Pedido", codigo: p.codigo, origem: nomeLojaPorId.get(p.loja_id) ?? "—", taxa, ganho, criado_em: p.criado_em })
  }
  for (const a of (avulsas ?? []) as any[]) {
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

  function paginaMotoboy([, d]: [string, { nome: string; entregas: any[] }]) {
    const ganhoTotal = d.entregas.reduce((s, e) => s + e.ganho, 0)
    return `
    <div class="page">
      <div class="brand">Chegô Delivery <span style="color:${DARK};font-weight:400">· CNPJ ${CNPJ}</span></div>
      <div class="subtitle">Fechamento diário — repasse ao entregador</div>
      <h1>${d.nome}</h1>
      <div class="periodo">Dia ${fmtDataLabel(dataYmd)} · Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
      <div class="box-liquido"><span class="lbl">TOTAL A RECEBER NO DIA (${d.entregas.length} entrega${d.entregas.length !== 1 ? "s" : ""})</span><span class="val">R$ ${R(ganhoTotal)}</span></div>
      <h3>Entregas realizadas</h3>
      <table>
        <thead><tr><th>Hora</th><th>Tipo</th><th>Código</th><th>Loja/Origem</th><th class="num">Taxa de entrega</th><th class="num">Ganho</th></tr></thead>
        <tbody>
          ${d.entregas.map(e => `<tr><td>${fmtDataHora(e.criado_em)}</td><td>${e.tipo}</td><td>${e.codigo}</td><td>${truncNome(e.origem, 30)}</td><td class="num">${R(e.taxa)}</td><td class="num">${R(e.ganho)}</td></tr>`).join("")}
          <tr class="total"><td colspan="5">Total</td><td class="num">${R(ganhoTotal)}</td></tr>
        </tbody>
      </table>
      <p class="footer-note">Ganho calculado pela regra vigente de repasse ao entregador (lib/comissao.ts) — piso de R$${4},00 por entrega quando a taxa cobrada é menor que isso.</p>
    </div>`
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="page">
      <div class="brand">Chegô Delivery <span style="color:${DARK};font-weight:400">· CNPJ ${CNPJ}</span></div>
      <div class="subtitle">Fechamento diário — repasse aos motoboys</div>
      <span class="selo">✓ Gerado automaticamente a partir das entregas reais do sistema</span>
      <h1>Repasse aos motoboys — resumo do dia</h1>
      <div class="periodo">Dia ${fmtDataLabel(dataYmd)} · Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
      ${resumos.length === 0 ? `<p class="sem-movimento">Nenhuma entrega realizada neste dia.</p>` : `
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
