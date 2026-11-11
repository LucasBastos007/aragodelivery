export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import ExcelJS from "exceljs"
import { requireAdmin, unauthorized } from "@/lib/session"

// Conferência da maquininha Ton (admin 2.0, 20/10/2026). A Ton não tem API pra maquininha, então o
// admin baixa o extrato de vendas no app/portal da Ton (CSV ou Excel) e envia aqui. Nada é gravado:
// lê o arquivo, acha as colunas pelo nome e cruza com os pedidos pagos na maquininha (mesmo dia e valor).
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
type Venda = { linha: number; quando: Date | null; dia: string | null; valor: number; liquido: number | null; tipo: "debito" | "credito" | "pix" | "outro"; bandeira: string; status: string; parcelas: number }

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
const ymdBrt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d)
function numero(v: unknown): number | null {
  if (typeof v === "number") return v
  const s = String(v ?? "").replace(/[R$\s]/g, ""); if (!s) return null
  const n = /,\d{1,2}$/.test(s) ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s.replace(/,/g, ""))
  return Number.isFinite(n) ? Math.abs(n) : null
}
function data(v: unknown, hora?: unknown): Date | null {
  if (v instanceof Date) return v
  const s = String(v ?? "").trim(); const h = String(hora ?? "").trim()
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) { const [, d, mo, y, hh, mi] = m; const yy = y.length === 2 ? `20${y}` : y; const hm = hh ? `${hh.padStart(2, "0")}:${mi}` : (h.match(/^(\d{1,2}):(\d{2})/)?.slice(1, 3).map((x, i) => i ? x : x.padStart(2, "0")).join(":") ?? "12:00"); return new Date(`${yy}-${mo}-${d}T${hm}:00-03:00`) }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/)
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "12"}:${m[5] ?? "00"}:00-03:00`)
  return null
}
const COL: Record<string, RegExp> = {
  data: /^(data|data da venda|data venda|data e hora|data\/hora|dt)/, hora: /^hora/, valor: /(valor bruto|valor da venda|valor venda|valor total|^valor$|bruto)/,
  liquido: /liquido/, tipo: /(forma|modalidade|tipo de pagamento|tipo|produto|meio)/, bandeira: /bandeira/, status: /(status|situacao)/, parcelas: /parcela/,
}

async function linhasDoArquivo(f: File): Promise<unknown[][]> {
  const buf = Buffer.from(await f.arrayBuffer())
  if (/\.xlsx$/i.test(f.name)) {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as any)
    const ws = wb.worksheets[0]; const out: unknown[][] = []
    ws.eachRow({ includeEmpty: false }, r => { out.push((r.values as unknown[]).slice(1).map(c => (c && typeof c === "object" && "result" in (c as any)) ? (c as any).result : (c && typeof c === "object" && "text" in (c as any)) ? (c as any).text : c)) })
    return out
  }
  const txt = buf.toString("utf8").replace(/^﻿/, ""), sep = (txt.split("\n")[0].match(/;/g)?.length ?? 0) >= (txt.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ","
  return txt.split(/\r?\n/).filter(l => l.trim()).map(l => { const cel: string[] = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { cel.push(cur); cur = "" } else cur += ch } cel.push(cur); return cel })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const fd = await req.formData().catch(() => null), f = fd?.get("arquivo") as File | null
  if (!f) return NextResponse.json({ error: "Envie o extrato da Ton (CSV ou Excel)." }, { status: 400 })
  if (f.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Arquivo muito grande (até 10 MB)." }, { status: 400 })
  if (/\.xls$/i.test(f.name)) return NextResponse.json({ error: "Esse é o Excel antigo (.xls). Salve como .xlsx ou CSV e envie de novo." }, { status: 400 })
  let linhas: unknown[][]
  try { linhas = await linhasDoArquivo(f) } catch { return NextResponse.json({ error: "Não consegui abrir o arquivo. Envie em CSV ou .xlsx." }, { status: 400 }) }

  // Acha a linha de cabeçalho: a primeira com coluna de data e de valor
  let cab = -1, idx: Record<string, number> = {}
  for (let i = 0; i < Math.min(30, linhas.length) && cab < 0; i++) {
    const nomes = linhas[i].map(norm), achou: Record<string, number> = {}
    for (const [k, re] of Object.entries(COL)) { const j = nomes.findIndex(n => re.test(n) && !Object.values(achou).includes(nomes.indexOf(n))); if (j >= 0) achou[k] = j }
    if (achou.data !== undefined && achou.valor !== undefined) { cab = i; idx = achou }
  }
  if (cab < 0) return NextResponse.json({ error: "Não achei as colunas de data e valor. Mande o extrato de vendas da Ton (não o de recebimentos).", colunasVistas: (linhas[0] ?? []).map(String).slice(0, 15) }, { status: 422 })

  const vendas: Venda[] = []
  for (let i = cab + 1; i < linhas.length; i++) {
    const l = linhas[i], valor = numero(l[idx.valor]); if (!valor) continue
    const quando = data(l[idx.data], idx.hora !== undefined ? l[idx.hora] : undefined)
    const t = norm(idx.tipo !== undefined ? l[idx.tipo] : ""), st = norm(idx.status !== undefined ? l[idx.status] : "")
    if (/(cancel|estorn|negad|recusad)/.test(st)) continue
    vendas.push({ linha: i + 1, quando, dia: quando ? ymdBrt(quando) : null, valor, liquido: idx.liquido !== undefined ? numero(l[idx.liquido]) : null,
      tipo: /debito/.test(t) ? "debito" : /credito/.test(t) ? "credito" : /pix/.test(t) ? "pix" : "outro", bandeira: String(idx.bandeira !== undefined ? l[idx.bandeira] ?? "" : ""), status: st, parcelas: Number(idx.parcelas !== undefined ? l[idx.parcelas] : 1) || 1 })
  }
  if (!vendas.length) return NextResponse.json({ error: "O arquivo não tem vendas aprovadas." }, { status: 422 })
  const dias = vendas.map(v => v.dia).filter(Boolean).sort() as string[]
  const de = dias[0], ate = dias[dias.length - 1]
  if (!de) return NextResponse.json({ error: "Não consegui ler as datas das vendas." }, { status: 422 })

  // Pedidos com maquininha entregues no período (a parte paga na maquininha, quando o pagamento foi dividido)
  const fim = new Date(`${ate}T12:00:00Z`); fim.setUTCDate(fim.getUTCDate() + 1)
  const peds: any[] = []
  for (let i = 0; i < 50000; i += 1000) {
    const { data: ps } = await sb.from("pedidos").select("id,codigo,criado_em,entregue_em,total,forma_pagamento,forma_pagamento_2,valor_pagamento_1,valor_pagamento_2,tipo_cartao_entrega,loja:lojas(nome),motoboy:motoboys(nome)")
      .eq("status", "entregue").or("forma_pagamento.eq.maquininha,forma_pagamento_2.eq.maquininha").gte("criado_em", `${de}T03:00:00Z`).lt("criado_em", `${fim.toISOString().slice(0, 10)}T03:00:00Z`).order("id").range(i, i + 999)
    peds.push(...(ps ?? [])); if ((ps ?? []).length < 1000) break
  }
  const itens = peds.map(p => { const v = p.forma_pagamento_2 ? Number(p.forma_pagamento === "maquininha" ? p.valor_pagamento_1 : p.valor_pagamento_2) : Number(p.total)
    const q = new Date(p.entregue_em ?? p.criado_em); return { id: p.id, codigo: p.codigo, quando: q, dia: ymdBrt(new Date(p.criado_em)), valor: Math.round(v * 100) / 100, tipo: p.tipo_cartao_entrega as string | null, loja: p.loja?.nome ?? "", motoboy: p.motoboy?.nome ?? "" } })

  // Cruza: mesmo dia e mesmo valor; com hora, fica com o mais perto
  const usados = new Set<string>(), pares: any[] = [], soTon: Venda[] = []
  for (const v of vendas.sort((a, b) => (a.quando?.getTime() ?? 0) - (b.quando?.getTime() ?? 0))) {
    const cand = itens.filter(p => !usados.has(p.id) && p.dia === v.dia && Math.abs(p.valor - v.valor) < 0.011)
      .sort((a, b) => Math.abs(a.quando.getTime() - (v.quando?.getTime() ?? 0)) - Math.abs(b.quando.getTime() - (v.quando?.getTime() ?? 0)))
    const p = cand[0]
    if (!p) { soTon.push(v); continue }
    usados.add(p.id)
    pares.push({ venda: v, pedido: { codigo: p.codigo, loja: p.loja, motoboy: p.motoboy, tipo: p.tipo }, tipoDiferente: !!p.tipo && v.tipo !== "outro" && v.tipo !== "pix" && p.tipo !== v.tipo })
  }
  const soApp = itens.filter(p => !usados.has(p.id) && p.dia >= de && p.dia <= ate)
  const bruto = vendas.reduce((t, v) => t + v.valor, 0), liquido = vendas.every(v => v.liquido != null) ? vendas.reduce((t, v) => t + (v.liquido ?? 0), 0) : null
  const r2 = (x: number) => Math.round(x * 100) / 100
  return NextResponse.json({
    arquivo: f.name, de, ate, colunas: Object.keys(idx),
    resumo: { vendas: vendas.length, bruto: r2(bruto), liquido: liquido == null ? null : r2(liquido), taxaReal: liquido == null ? null : r2(bruto - liquido), taxaPct: liquido == null || !bruto ? null : r2((bruto - liquido) / bruto * 100),
      porTipo: ["debito", "credito", "pix", "outro"].map(t => ({ tipo: t, n: vendas.filter(v => v.tipo === t).length, valor: r2(vendas.filter(v => v.tipo === t).reduce((s, v) => s + v.valor, 0)) })).filter(x => x.n),
      bateram: pares.length, tipoDiferente: pares.filter(p => p.tipoDiferente).length, soTon: soTon.length, soApp: soApp.length },
    pares, soTon, soApp: soApp.map(p => ({ codigo: p.codigo, dia: p.dia, valor: p.valor, tipo: p.tipo, loja: p.loja, motoboy: p.motoboy, quando: p.quando })),
  })
}
