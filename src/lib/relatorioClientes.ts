// Relatório "clientes que pararam de pedir" — pedido do usuário, 2026-10-09: planilha pro
// financeiro (esposa dele) com cada cliente que já pediu pelo app, quantos pedidos fez, a
// loja que mais pediu e a data do último pedido. "Parou" = 14+ dias sem pedido entregue.
// Conta só pedidos entregues do app (tipo "normal"; avulsas ficam de fora), desde o início.
import { createClient } from "@supabase/supabase-js"
import ExcelJS from "exceljs"

export const DIAS_PARADO = 14

type Pedido = { loja_id: string; total: number | null; criado_em: string; cliente_id: string | null; nome_cliente: string | null; telefone_cliente: string | null }
export type LinhaCliente = { nome: string; telefone: string; pedidos: number; loja: string; outras: string; gasto: number; primeiro: string; ultimo: string; dias: number }

const ymdBrt = (iso: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso))
const fmt = (ymd: string) => { const [a, m, d] = ymd.split("-"); return `${d}/${m}/${a}` }
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())
export const faixa = (d: number) => d >= 60 ? "60+ dias" : d >= 30 ? "30 a 59 dias" : d >= DIAS_PARADO ? "14 a 29 dias" : "Ativo (até 13 dias)"

function telefone(t: string | null) {
  const d = (t ?? "").replace(/\D/g, "")
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d
}

export async function levantarClientes() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const todos: Pedido[] = []
  for (let i = 0; ; i += 1000) {
    const { data, error } = await sb.from("pedidos").select("loja_id,total,criado_em,cliente_id,nome_cliente,telefone_cliente")
      .eq("status", "entregue").eq("tipo", "normal").order("criado_em").range(i, i + 999)
    if (error) throw error
    todos.push(...(data as Pedido[]))
    if (!data || data.length < 1000) break
  }
  const { data: lojas } = await sb.from("lojas").select("id,nome")
  const nomeLoja = new Map((lojas ?? []).map(l => [l.id as string, String(l.nome).trim()]))

  const grupos = new Map<string, Pedido[]>()
  for (const p of todos) {
    const k = p.cliente_id || (p.telefone_cliente ?? "").replace(/\D/g, "") || (p.nome_cliente ?? "").trim().toLowerCase()
    if (!k) continue
    const g = grupos.get(k); if (g) g.push(p); else grupos.set(k, [p])
  }
  const hoje = ymdBrt(new Date())
  const linhas: LinhaCliente[] = []
  for (const ps of grupos.values()) {
    const ult = ps[ps.length - 1]
    const cont = new Map<string, number>()
    for (const p of ps) { const n = nomeLoja.get(p.loja_id) ?? "?"; cont.set(n, (cont.get(n) ?? 0) + 1) }
    const rank = [...cont].sort((a, b) => b[1] - a[1])
    const ultimo = ymdBrt(ult.criado_em)
    linhas.push({
      nome: titulo((ult.nome_cliente ?? "").trim()) || "(sem nome)", telefone: telefone(ult.telefone_cliente), pedidos: ps.length,
      loja: `${rank[0][0]} (${rank[0][1]})`, outras: rank.slice(1, 4).map(([n, q]) => `${n} (${q})`).join(", "),
      gasto: Math.round(ps.reduce((s, p) => s + Number(p.total ?? 0), 0) * 100) / 100,
      primeiro: ymdBrt(ps[0].criado_em), ultimo, dias: diasEntre(ultimo, hoje),
    })
  }
  linhas.sort((a, b) => b.pedidos - a.pedidos || a.dias - b.dias)
  const parados = linhas.filter(l => l.dias >= DIAS_PARADO)
  const inicio = todos.length ? ymdBrt(todos[0].criado_em) : hoje
  const resumo: [string, number][] = [
    ["Clientes que já pediram", linhas.length],
    ["Ativos (pediram nos últimos 13 dias)", linhas.length - parados.length],
    [`Pararam de pedir (${DIAS_PARADO}+ dias)`, parados.length],
    ["   14 a 29 dias", parados.filter(l => l.dias < 30).length],
    ["   30 a 59 dias", parados.filter(l => l.dias >= 30 && l.dias < 60).length],
    ["   60+ dias", parados.filter(l => l.dias >= 60).length],
    ["Pararam e tinham 2+ pedidos (prioridade)", parados.filter(l => l.pedidos >= 2).length],
    ["Pararam e tinham 5+ pedidos", parados.filter(l => l.pedidos >= 5).length],
  ]
  return { linhas, parados, resumo, inicio, hoje }
}

const ROXO = "FF5B2C83"
const CAB = ["Cliente", "Telefone", "Qtd. pedidos", "Loja mais pedida (pedidos)", "Outras lojas", "Total gasto (R$)", "Primeiro pedido", "Último pedido", "Dias sem pedir", "Situação"]
const LARG = [30, 17, 10, 34, 40, 14, 13, 13, 10, 16]

export async function gerarPlanilhaClientes() {
  const r = await levantarClientes()
  const wb = new ExcelJS.Workbook()
  const fonte = { name: "Arial", size: 10 }
  const periodo = `Período analisado: ${fmt(r.inicio)} a ${fmt(r.hoje)} — só pedidos entregues pelo app (sem avulsas). Ordenado por qtd. de pedidos.`

  const rs = wb.addWorksheet("Resumo")
  rs.getCell("A1").value = "Clientes que pararam de pedir — Chegô"
  rs.getCell("A1").font = { name: "Arial", bold: true, size: 14, color: { argb: ROXO } }
  rs.getCell("A2").value = `Gerado em ${fmt(r.hoje)}. "Parou" = sem pedido há ${DIAS_PARADO} dias ou mais.`
  rs.getCell("A2").font = { name: "Arial", italic: true, size: 9, color: { argb: "FF666666" } }
  r.resumo.forEach(([a, b], i) => {
    rs.getCell(4 + i, 1).value = a; rs.getCell(4 + i, 1).font = { name: "Arial", size: 11, bold: !a.startsWith(" ") }
    rs.getCell(4 + i, 2).value = b; rs.getCell(4 + i, 2).font = { name: "Arial", size: 11, bold: true }
  })
  rs.getColumn(1).width = 44; rs.getColumn(2).width = 10

  const aba = (nome: string, tit: string, dados: LinhaCliente[]) => {
    const ws = wb.addWorksheet(nome, { views: [{ state: "frozen", xSplit: 1, ySplit: 4 }] })
    ws.getCell("A1").value = tit; ws.getCell("A1").font = { name: "Arial", bold: true, size: 13, color: { argb: ROXO } }
    ws.getCell("A2").value = periodo; ws.getCell("A2").font = { name: "Arial", italic: true, size: 9, color: { argb: "FF666666" } }
    const h = ws.getRow(4); h.height = 30
    CAB.forEach((c, i) => {
      const cel = h.getCell(i + 1); cel.value = c
      cel.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } }
      cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROXO } }
      cel.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    })
    dados.forEach((l, i) => {
      const row = ws.getRow(5 + i)
      const data = (ymd: string) => { const [a, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d)) }
      row.values = [l.nome, l.telefone, l.pedidos, l.loja, l.outras, l.gasto, data(l.primeiro), data(l.ultimo), l.dias, faixa(l.dias)]
      row.eachCell(c => { c.font = fonte; c.border = { bottom: { style: "thin", color: { argb: "FFDDDDDD" } } } })
      row.getCell(6).numFmt = '"R$" #,##0.00'
      for (const n of [7, 8]) { row.getCell(n).numFmt = "dd/mm/yyyy"; row.getCell(n).alignment = { horizontal: "center" } }
      for (const n of [3, 9]) row.getCell(n).alignment = { horizontal: "center" }
      if (l.dias >= 60) row.getCell(10).font = { ...fonte, bold: true, color: { argb: "FFB00020" } }
      else if (l.dias >= 30) row.getCell(10).font = { ...fonte, bold: true, color: { argb: "FFC25E00" } }
    })
    LARG.forEach((w, i) => { ws.getColumn(i + 1).width = w })
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + dados.length, column: 10 } }
  }
  aba("Pararam de pedir", `Clientes que pararam de pedir (${DIAS_PARADO}+ dias sem pedido)`, r.parados)
  aba("Todos os clientes", "Todos os clientes", r.linhas)

  const buffer = Buffer.from(await wb.xlsx.writeBuffer())
  return { buffer, ...r, fmtHoje: fmt(r.hoje) }
}
