// Extrato da Carteira (admin 2.0, 20/10/2026): o extrato REAL da conta do Asaas, lançamento por
// lançamento, com nome de gente. Cada recebimento vira "Pedido #X, loja Y" (pelo asaas_payment_id),
// cada Pix enviado vira "Repasse pra loja" / "Pagamento ao motoboy" (pelo comprovante asaas:<id>).
// A taxa do Asaas de um recebimento vem junto dele (uma linha só, com o líquido). Só leitura.
import type { SupabaseClient } from "@supabase/supabase-js"
import { NOME_TIPO, todos } from "@/lib/asaasConferencia"

const r2 = (v: number) => Math.round(v * 100) / 100
const FORMA: Record<string, string> = { pix: "Pix", cartao: "cartão", dinheiro: "dinheiro", maquininha: "maquininha" }
export type ItemExtrato = { id: string; data: string; tipo: string; grupo: "entrada" | "saida"; titulo: string; detalhe: string
  valor: number; taxa: number; saldo: number; pedido?: string; comprovante?: { tipo: string; id: string } }

async function emLotes<T>(ids: string[], f: (lote: string[]) => PromiseLike<{ data: T[] | null }>) {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 200) { const { data } = await f(ids.slice(i, i + 200)); out.push(...(data ?? [])) }
  return out
}

export async function extratoCarteira(sb: SupabaseClient, de: string, ate: string) {
  if (!process.env.ASAAS_API_KEY && !process.env.ASAAS_BASE_URL) throw new Error("Chave do Asaas não configurada no servidor.")
  const ext = await todos(`/financialTransactions?startDate=${de}&finishDate=${ate}&order=asc`)
  const pays = [...new Set(ext.map((t: any) => t.paymentId ?? t.payment).filter(Boolean))] as string[]
  const trs = [...new Set(ext.map((t: any) => t.transferId ?? t.transfer).filter(Boolean))] as string[]
  const [p1, p2, movs, saqs, { data: lojas }, { data: mbs }] = await Promise.all([
    emLotes<any>(pays, l => sb.from("pedidos").select("id,codigo,loja_id,forma_pagamento,asaas_payment_id").in("asaas_payment_id", l)),
    emLotes<any>(pays, l => sb.from("pedidos").select("id,codigo,loja_id,forma_pagamento_2,asaas_payment_id_2").in("asaas_payment_id_2", l)),
    emLotes<any>(trs, l => sb.from("movimentos_financeiros").select("id,tipo,loja_id,motoboy_id,destinatario_nome,comprovante_path").in("comprovante_path", l.map(x => `asaas:${x}`))),
    emLotes<any>(trs, l => sb.from("saques").select("id,tipo,loja_id,motoboy_id,comprovante_path").in("comprovante_path", l.map(x => `asaas:${x}`))),
    sb.from("lojas").select("id,nome"), sb.from("motoboys").select("id,nome"),
  ])
  const nL = new Map((lojas ?? []).map((l: any) => [l.id, l.nome as string])), nM = new Map((mbs ?? []).map((m: any) => [m.id, m.nome as string]))
  const ped = new Map<string, { id: string; codigo: string; loja: string; forma: string }>()
  for (const p of p1) ped.set(p.asaas_payment_id, { id: p.id, codigo: p.codigo, loja: nL.get(p.loja_id) ?? "Loja", forma: p.forma_pagamento })
  for (const p of p2) ped.set(p.asaas_payment_id_2, { id: p.id, codigo: p.codigo, loja: nL.get(p.loja_id) ?? "Loja", forma: p.forma_pagamento_2 })
  const env = new Map<string, { titulo: string; comprovante: { tipo: string; id: string } }>()
  for (const s of saqs) env.set(String(s.comprovante_path).slice(6), { titulo: s.tipo === "motoboy" ? `Saque de ${nM.get(s.motoboy_id) ?? "motoboy"}` : `Adiantamento pra ${nL.get(s.loja_id) ?? "loja"}`, comprovante: { tipo: "saque", id: s.id } })
  for (const m of movs) env.set(String(m.comprovante_path).slice(6), { titulo: m.loja_id ? `Repasse pra ${nL.get(m.loja_id) ?? m.destinatario_nome ?? "loja"}` : m.motoboy_id ? `Pagamento a ${nM.get(m.motoboy_id) ?? m.destinatario_nome ?? "motoboy"}` : `Pix pra ${m.destinatario_nome ?? "fora do app"}`, comprovante: { tipo: "movimento", id: m.id } })

  // Junta a taxa do Asaas ao recebimento do mesmo pagamento
  const itens: ItemExtrato[] = [], porPay = new Map<string, ItemExtrato>()
  for (const t of ext) {
    const v = r2(Number(t.value ?? 0)), tipo = String(t.type ?? ""), pay = t.paymentId ?? t.payment, tr = t.transferId ?? t.transfer, saldo = r2(Number(t.balance ?? 0))
    if (tipo === "PAYMENT_FEE" && pay && porPay.has(pay)) { const it = porPay.get(pay)!; it.taxa = r2(it.taxa - v); it.saldo = saldo; continue }
    const p = pay ? ped.get(pay) : undefined, e = tr ? env.get(tr) : undefined
    let titulo = NOME_TIPO[tipo] ?? (t.description || tipo), detalhe = String(t.description ?? "")
    if (tipo === "PAYMENT_RECEIVED") { titulo = p ? `Pedido #${p.codigo}` : "Recebimento de cliente"; detalhe = p ? `${p.loja}, ${FORMA[p.forma] ?? p.forma}` : detalhe || "cobrança sem pedido ligado" }
    else if (tipo === "PAYMENT_FEE") { titulo = "Taxa do Asaas"; detalhe = p ? `Pedido #${p.codigo}` : detalhe }
    else if ((tipo === "TRANSFER" || tipo === "PIX_TRANSACTION_DEBIT") && e) { titulo = e.titulo; detalhe = "Pix pelo Asaas" }
    else if (tipo === "TRANSFER" || tipo === "PIX_TRANSACTION_DEBIT") { titulo = "Pix enviado"; detalhe = detalhe || "feito fora do painel" }
    else if (/REVERSAL|REFUND|CHARGEBACK/.test(tipo) && p) detalhe = `Pedido #${p.codigo}`
    const it: ItemExtrato = { id: String(t.id), data: String(t.date ?? "").slice(0, 10), tipo, grupo: v >= 0 ? "entrada" : "saida", titulo, detalhe, valor: v, taxa: 0, saldo, pedido: p?.codigo, comprovante: e?.comprovante }
    if (tipo === "PAYMENT_RECEIVED" && pay) porPay.set(pay, it)
    itens.push(it)
  }
  const soma = (f: (i: ItemExtrato) => number) => r2(itens.reduce((s, i) => s + f(i), 0))
  const ehTaxa = (i: ItemExtrato) => /_FEE$/.test(i.tipo)
  return {
    itens: itens.reverse(),
    saldoInicial: ext.length ? r2(Number(ext[0].balance ?? 0) - Number(ext[0].value ?? 0)) : null,
    saldoFinal: ext.length ? r2(Number(ext[ext.length - 1].balance ?? 0)) : null,
    entrou: soma(i => i.valor > 0 ? i.valor : 0),
    saiu: soma(i => i.valor < 0 && !ehTaxa(i) ? -i.valor : 0),
    taxas: soma(i => (ehTaxa(i) ? -i.valor : 0) + i.taxa),
  }
}
