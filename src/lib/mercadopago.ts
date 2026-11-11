// Mercado Pago (22/10/2026): Pix passa a ser cobrado pelo Mercado Pago (taxa 0,99% contra
// R$ 1,99 fixo no Asaas). Cartão, repasses e Pix pros motoboys continuam no Asaas.
//
// Liga com PIX_PROVEDOR=mercadopago + MP_ACCESS_TOKEN. Sem isso, o Pix continua no Asaas.
// As cobranças do Mercado Pago ficam nas mesmas colunas do pedido (asaas_payment_id /
// asaas_payment_id_2) com o prefixo "mp_", e lib/asaas.ts encaminha buscar, cancelar e
// estornar pra cá quando o id tem esse prefixo. Pedidos antigos seguem no Asaas.
import crypto from "crypto"

const BASE = process.env.MP_BASE_URL ?? "https://api.mercadopago.com"
export const PREFIXO_MP = "mp_"

export function pixNoMercadoPago(): boolean {
  return process.env.PIX_PROVEDOR === "mercadopago" && !!process.env.MP_ACCESS_TOKEN
}

export function ehIdMp(id: string | null | undefined): boolean {
  return !!id && id.startsWith(PREFIXO_MP)
}

const idNumerico = (id: string) => id.replace(PREFIXO_MP, "")

async function call<T = unknown>(path: string, method = "GET", body?: object, idempotencia?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(idempotencia ? { "X-Idempotency-Key": idempotencia } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string; cause?: { description?: string }[] }
    const msg = err.cause?.map(c => c.description).filter(Boolean).join(" | ") || err.message || `Mercado Pago HTTP ${res.status}`
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

type PagamentoMp = {
  id: number
  status: string
  status_detail?: string
  external_reference?: string | null
  transaction_amount?: number
  transaction_details?: { net_received_amount?: number }
  date_of_expiration?: string | null
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } }
}

/** Status do Mercado Pago traduzido pro vocabulário do Asaas, que o resto do sistema já entende. */
export function statusComoAsaas(status: string): string {
  switch (status) {
    case "approved":     return "RECEIVED"
    case "authorized":
    case "pending":
    case "in_process":
    case "in_mediation": return "PENDING"
    case "rejected":     return "DECLINED"
    case "cancelled":    return "DELETED"
    case "refunded":
    case "charged_back": return "REFUNDED"
    default:             return status.toUpperCase()
  }
}

/** Cria a cobrança Pix. Vale 24h, igual ao vencimento de amanhã que o Asaas usava. */
export async function criarPixMp(valor: number, pedidoId: string, pagador: { nome: string; email: string; cpf?: string }, chave: string) {
  const expira = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const cpf = pagador.cpf?.replace(/\D/g, "")
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chegodelivery.com"
  const p = await call<PagamentoMp>("/v1/payments", "POST", {
    transaction_amount: Math.round(valor * 100) / 100,
    description: "Pedido Chegô",
    payment_method_id: "pix",
    external_reference: pedidoId,
    date_of_expiration: expira.toISOString().replace("Z", "-00:00"),
    notification_url: `${site}/api/pagamento/mp-webhook`,
    payer: {
      email: pagador.email,
      first_name: pagador.nome.split(" ")[0],
      ...(cpf && cpf.length === 11 ? { identification: { type: "CPF", number: cpf } } : {}),
    },
  }, chave)
  const td = p.point_of_interaction?.transaction_data
  return {
    id: PREFIXO_MP + p.id,
    status: statusComoAsaas(p.status),
    qrcode: td?.qr_code_base64 ?? "",
    copiaCola: td?.qr_code ?? "",
    expiraEm: p.date_of_expiration ?? expira.toISOString(),
  }
}

export async function buscarPagamentoMp(id: string) {
  const p = await call<PagamentoMp>(`/v1/payments/${idNumerico(id)}`)
  return { id: PREFIXO_MP + p.id, status: statusComoAsaas(p.status), externalReference: p.external_reference ?? "", statusMp: p.status,
    valor: Number(p.transaction_amount ?? 0), liquido: Number(p.transaction_details?.net_received_amount ?? 0) }
}

/** Devolve o dinheiro (total ou parcial). Pix ainda não pago não tem o que estornar: use cancelar. */
export async function estornarPagamentoMp(id: string, valor?: number) {
  const r = await call<{ id: number; status: string }>(
    `/v1/payments/${idNumerico(id)}/refunds`, "POST",
    valor != null ? { amount: Math.round(valor * 100) / 100 } : {},
    `estorno-${idNumerico(id)}-${valor ?? "total"}`,
  )
  return { id: PREFIXO_MP + "refund_" + r.id, status: r.status }
}

/** Cancela um Pix que ainda não foi pago (o QR deixa de valer). */
export async function cancelarPagamentoMp(id: string) {
  await call(`/v1/payments/${idNumerico(id)}`, "PUT", { status: "cancelled" })
  return { deleted: true }
}

/**
 * Confere a assinatura do aviso (header x-signature) com a chave secreta do webhook,
 * MP_WEBHOOK_SECRET. Sem a chave configurada, aceita o aviso: o webhook sempre consulta o
 * pagamento direto na API antes de mexer no pedido, então um aviso falso não confirma nada.
 */
export function assinaturaValida(xSignature: string | null, xRequestId: string | null, dataId: string): boolean {
  const segredo = process.env.MP_WEBHOOK_SECRET
  if (!segredo) return true
  if (!xSignature) return false
  const partes = Object.fromEntries(xSignature.split(",").map(s => s.trim().split("=") as [string, string]))
  if (!partes.ts || !partes.v1) return false
  let manifesto = `id:${dataId.toLowerCase()};`
  if (xRequestId) manifesto += `request-id:${xRequestId};`
  manifesto += `ts:${partes.ts};`
  const esperado = crypto.createHmac("sha256", segredo).update(manifesto).digest("hex")
  const a = Buffer.from(esperado), b = Buffer.from(partes.v1)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// ---------- Saldo real da conta (24/10/2026) ----------
// A API não tem "saldo", mas o relatório de liberações traz a coluna BALANCE_AMOUNT (saldo disponível
// depois de cada movimento, inclusive transferências e estornos). O cron /api/cron/mp-saldo pede um
// relatório a cada 10 min e, na rodada seguinte, lê o saldo da última linha.
export type RelatorioMp = { id: number; file_name: string; date_created: string }
export async function listarRelatoriosMp(): Promise<RelatorioMp[]> {
  const l = await call<RelatorioMp[]>("/v1/account/release_report/list")
  return (Array.isArray(l) ? l : []).filter(r => r.file_name).sort((a, b) => b.id - a.id)
}
export async function pedirRelatorioMp() {
  const ini = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 19) + "Z"
  const fim = new Date(Date.now() - 60_000).toISOString().slice(0, 19) + "Z"
  await call("/v1/account/release_report", "POST", { begin_date: ini, end_date: fim })
}
/** Saldo da última linha do relatório (null se o arquivo ainda não está pronto ou veio sem linhas). */
export async function saldoDoRelatorioMp(fileName: string): Promise<number | null> {
  const res = await fetch(`${BASE}/v1/account/release_report/${encodeURIComponent(fileName)}`, { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }, cache: "no-store" })
  if (!res.ok) return null
  const linhas = (await res.text()).trim().split(/\r?\n/)
  const cab = linhas[0]?.split(";") ?? []
  const iData = cab.indexOf("DATE"), iSaldo = cab.indexOf("BALANCE_AMOUNT")
  if (iData < 0 || iSaldo < 0) return null
  const dados = linhas.slice(1).map(l => l.split(";")).filter(c => c[iData])
  if (!dados.length) return null
  const v = Number(dados[dados.length - 1][iSaldo])
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : null
}
