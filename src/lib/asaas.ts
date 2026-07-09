const BASE = process.env.ASAAS_BASE_URL ?? "https://api.asaas.com/v3"
const KEY  = process.env.ASAAS_API_KEY!

export interface AsaasSplit {
  walletId: string
  percentualValue: number  // percentual que vai para o lojista (ex: 90 = 90%)
}

async function call<T = unknown>(path: string, method = "GET", body?: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "access_token": KEY,
      "Content-Type": "application/json",
      "User-Agent":   "ChegoDelivery/1.0",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>
    const errs = err.errors as { code?: string; description?: string }[] | undefined
    const msgs = errs?.map(e => [e.code, e.description].filter(Boolean).join(": ")).join(" | ")
    const msg = msgs || `Asaas HTTP ${res.status}`
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

function amanha() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split("T")[0]
}

export async function criarCliente(nome: string, opts: { cpf?: string; email?: string; telefone?: string } = {}) {
  return call<{ id: string }>("/customers", "POST", {
    name: nome,
    ...(opts.cpf      ? { cpfCnpj:    opts.cpf.replace(/\D/g, "")      } : {}),
    ...(opts.email    ? { email:       opts.email                        } : {}),
    ...(opts.telefone ? { mobilePhone: opts.telefone.replace(/\D/g, "") } : {}),
    notificationDisabled: true,
  })
}

export async function criarPix(customerId: string, valor: number, pedidoId: string, split?: AsaasSplit) {
  return call<{ id: string; status: string }>("/payments", "POST", {
    customer:          customerId,
    billingType:       "PIX",
    value:             valor,
    dueDate:           amanha(),
    externalReference: pedidoId,
    description:       "Pedido Chegô",
    ...(split ? { split: [{ walletId: split.walletId, percentualValue: split.percentualValue }] } : {}),
  })
}

export async function getPixQrCode(paymentId: string) {
  return call<{ encodedImage: string; payload: string; expirationDate: string }>(
    `/payments/${paymentId}/pixQrCode`
  )
}

export async function estornarPagamento(paymentId: string, valor?: number) {
  const body = valor != null ? { value: valor } : {}
  return call<{ id: string; status: string }>(`/payments/${paymentId}/refund`, "POST", body)
}

export async function cancelarPagamento(paymentId: string) {
  return call<{ deleted: boolean }>(`/payments/${paymentId}`, "DELETE")
}

export async function criarAssinatura(customerId: string, valor: number, descricao: string) {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const nextDueDate = d.toISOString().split("T")[0]
  return call<{ id: string; status: string }>("/subscriptions", "POST", {
    customer:    customerId,
    billingType: "BOLETO",
    value:       valor,
    nextDueDate,
    cycle:       "MONTHLY",
    description: descricao,
  })
}

export async function cancelarAssinatura(subscriptionId: string) {
  return call<{ deleted: boolean }>(`/subscriptions/${subscriptionId}`, "DELETE")
}

export async function criarCartao(
  customerId: string,
  valor: number,
  pedidoId: string,
  card: { numero: string; nome: string; mes: string; ano: string; cvv: string },
  holder: { nome: string; cpf: string; email: string; cep: string; numeroEndereco: string; telefone: string },
  split?: AsaasSplit
) {
  return call<{ id: string; status: string; creditCard?: { creditCardToken?: string } }>("/payments", "POST", {
    customer:          customerId,
    billingType:       "CREDIT_CARD",
    value:             valor,
    dueDate:           amanha(),
    externalReference: pedidoId,
    description:       "Pedido Chegô",
    creditCard: {
      holderName:  card.nome,
      number:      card.numero.replace(/\D/g, ""),
      expiryMonth: card.mes,
      expiryYear:  card.ano,
      ccv:         card.cvv,
    },
    creditCardHolderInfo: {
      name:          holder.nome,
      email:         holder.email,
      cpfCnpj:       holder.cpf.replace(/\D/g, ""),
      postalCode:    holder.cep.replace(/\D/g, ""),
      addressNumber: holder.numeroEndereco || "S/N",
      phone:         holder.telefone.replace(/\D/g, ""),
    },
    ...(split ? { split: [{ walletId: split.walletId, percentualValue: split.percentualValue }] } : {}),
  })
}

export async function criarCartaoToken(
  customerId: string,
  valor: number,
  pedidoId: string,
  token: string,
  holder: { nome: string; cpf: string; email: string; cep: string; numeroEndereco: string; telefone: string },
  split?: AsaasSplit
) {
  return call<{ id: string; status: string; creditCard?: { creditCardToken?: string } }>("/payments", "POST", {
    customer:          customerId,
    billingType:       "CREDIT_CARD",
    value:             valor,
    dueDate:           amanha(),
    externalReference: pedidoId,
    description:       "Pedido Chegô",
    creditCardToken:   token,
    creditCardHolderInfo: {
      name:          holder.nome,
      email:         holder.email,
      cpfCnpj:       holder.cpf.replace(/\D/g, ""),
      postalCode:    holder.cep.replace(/\D/g, ""),
      addressNumber: holder.numeroEndereco || "S/N",
      phone:         holder.telefone.replace(/\D/g, ""),
    },
    ...(split ? { split: [{ walletId: split.walletId, percentualValue: split.percentualValue }] } : {}),
  })
}

export async function buscarPagamento(paymentId: string) {
  return call<{ id: string; status: string; externalReference: string }>(`/payments/${paymentId}`)
}

export async function criarSubconta(dados: {
  nome: string
  email: string
  cpfCnpj: string
  telefone?: string
  tipoEmpresa?: "MEI" | "LTDA" | "SA" | "INDIVIDUAL"
}) {
  return call<{ id: string; walletId: string; accountNumber: { agency: string; account: string; accountDigit: string } }>(
    "/accounts", "POST", {
      name:        dados.nome,
      email:       dados.email,
      cpfCnpj:     dados.cpfCnpj.replace(/\D/g, ""),
      ...(dados.telefone    ? { mobilePhone:  dados.telefone.replace(/\D/g, "")  } : {}),
      ...(dados.tipoEmpresa ? { companyType:  dados.tipoEmpresa                  } : {}),
    }
  )
}
