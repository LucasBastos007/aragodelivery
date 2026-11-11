// Conferência com o Asaas (admin 2.0, 20/10/2026): o que o extrato REAL da conta diz no período,
// pra comparar com o que o app registrou. Só leitura.
//  - extrato (/financialTransactions) agrupado por tipo: recebimentos, taxas, Pix enviados, estornos, antecipações
//  - a receber (/payments?status=CONFIRMED): cartão aprovado que ainda não caiu no saldo
//  - antecipações (/anticipations) do período
const BASE = () => process.env.ASAAS_BASE_URL ?? "https://api.asaas.com/v3"
async function get(path: string) {
  const r = await fetch(`${BASE()}${path}`, { headers: { access_token: process.env.ASAAS_API_KEY ?? "", "User-Agent": "ChegoDelivery/1.0" }, cache: "no-store", signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`Asaas respondeu ${r.status} em ${path.split("?")[0]}`)
  return r.json() as Promise<{ data: any[]; hasMore: boolean }>
}
export async function todos(path: string, max = 5000) {
  const out: any[] = []
  for (let off = 0; off < max; off += 100) { const sep = path.includes("?") ? "&" : "?"; const j = await get(`${path}${sep}offset=${off}&limit=100`); out.push(...(j.data ?? [])); if (!j.hasMore) break }
  return out
}
const r2 = (v: number) => Math.round(v * 100) / 100

// Nome em português de cada tipo do extrato do Asaas
export const NOME_TIPO: Record<string, string> = {
  PAYMENT_RECEIVED: "Recebimentos de clientes", PAYMENT_FEE: "Taxa do Asaas nos recebimentos", TRANSFER: "Pix e transferências enviadas", TRANSFER_FEE: "Taxa de transferência",
  TRANSFER_REVERSAL: "Transferência devolvida", PAYMENT_REVERSAL: "Estorno pro cliente", REFUND_REQUEST: "Estorno pro cliente", PAYMENT_REFUND_CANCELLED: "Estorno cancelado",
  RECEIVABLE_ANTICIPATION_GROSS_CREDIT: "Antecipação recebida", RECEIVABLE_ANTICIPATION_DEBIT: "Antecipação descontada", RECEIVABLE_ANTICIPATION_FEE: "Taxa de antecipação",
  PIX_TRANSACTION_DEBIT: "Pix enviado", PIX_TRANSACTION_CREDIT: "Pix recebido", PIX_TRANSACTION_DEBIT_FEE: "Taxa de Pix enviado", BILL_PAYMENT: "Boleto pago", BILL_PAYMENT_FEE: "Taxa de boleto",
  CHARGEBACK: "Chargeback (contestação)", CHARGEBACK_REVERSAL: "Chargeback devolvido", INTERNAL_TRANSFER_DEBIT: "Transferência interna enviada", INTERNAL_TRANSFER_CREDIT: "Transferência interna recebida",
  PAYMENT_DUNNING_RECEIVED_FEE: "Taxa de negativação", PROMOTIONAL_CODE_CREDIT: "Crédito promocional", CREDIT: "Crédito", DEBIT: "Débito",
}

export async function conferirAsaas(de: string, ate: string) {
  if (!process.env.ASAAS_API_KEY && !process.env.ASAAS_BASE_URL) throw new Error("Chave do Asaas não configurada no servidor.")
  const [saldo, extrato, confirmados, antecip] = await Promise.all([
    get("/finance/balance").catch(() => null) as Promise<any>,
    todos(`/financialTransactions?startDate=${de}&finishDate=${ate}&order=asc`),
    todos(`/payments?status=CONFIRMED`, 2000).catch(() => []),
    todos(`/anticipations`, 1000).catch(() => []),
  ])
  const porTipo = new Map<string, { tipo: string; n: number; valor: number }>()
  for (const t of extrato) { const k = String(t.type ?? "OUTRO"); const a = porTipo.get(k) ?? { tipo: k, n: 0, valor: 0 }; a.n++; a.valor += Number(t.value ?? 0); porTipo.set(k, a) }
  const tipos = [...porTipo.values()].map(x => ({ ...x, nome: NOME_TIPO[x.tipo] ?? x.tipo, valor: r2(x.valor) })).sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
  const soma = (f: (k: string) => boolean) => r2(tipos.filter(t => f(t.tipo)).reduce((s, t) => s + t.valor, 0))
  const antecipacoes = antecip.filter((a: any) => { const d = String(a.anticipationDate ?? a.requestDate ?? a.dateCreated ?? "").slice(0, 10); return d >= de && d <= ate })
    .map((a: any) => ({ id: a.id, status: a.status, data: String(a.anticipationDate ?? a.requestDate ?? "").slice(0, 10), valor: r2(Number(a.totalValue ?? a.value ?? 0)), taxa: r2(Number(a.fee ?? 0)), liquido: r2(Number(a.netValue ?? 0)) }))
  return {
    saldo: saldo ? r2(Number(saldo.balance ?? 0)) : null,
    tipos, lancamentos: extrato.length,
    entradas: soma(k => k === "PAYMENT_RECEIVED" || k === "PIX_TRANSACTION_CREDIT"),
    taxas: soma(k => /_FEE$/.test(k)),
    enviados: soma(k => k === "TRANSFER" || k === "PIX_TRANSACTION_DEBIT"),
    estornos: soma(k => /REVERSAL|REFUND|CHARGEBACK/.test(k)),
    movimento: r2(extrato.reduce((s, t) => s + Number(t.value ?? 0), 0)),
    saldoInicial: extrato.length ? r2(Number(extrato[0].balance ?? 0) - Number(extrato[0].value ?? 0)) : null,
    saldoFinal: extrato.length ? r2(Number(extrato[extrato.length - 1].balance ?? 0)) : null,
    aReceber: { n: confirmados.length, bruto: r2(confirmados.reduce((s: number, p: any) => s + Number(p.value ?? 0), 0)), liquido: r2(confirmados.reduce((s: number, p: any) => s + Number(p.netValue ?? 0), 0)),
      proximos: confirmados.slice(0, 50).map((p: any) => ({ id: p.id, valor: r2(Number(p.value ?? 0)), liquido: r2(Number(p.netValue ?? 0)), cai: p.estimatedCreditDate ?? p.creditDate ?? null, ref: p.externalReference ?? null })) },
    antecipacoes, antecipadoTotal: r2(antecipacoes.filter(a => a.status === "CREDITED").reduce((s, a) => s + a.liquido, 0)),
  }
}
