const BASE = process.env.ASAAS_BASE_URL ?? "https://api.asaas.com/v3"
const KEY  = process.env.ASAAS_API_KEY!

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
    const errs = err.errors as { description?: string }[] | undefined
    const msg = errs?.[0]?.description ?? `Asaas HTTP ${res.status}`
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

export async function criarPix(customerId: string, valor: number, pedidoId: string) {
  return call<{ id: string; status: string }>("/payments", "POST", {
    customer:          customerId,
    billingType:       "PIX",
    value:             valor,
    dueDate:           amanha(),
    externalReference: pedidoId,
    description:       "Pedido Chegô",
  })
}

export async function getPixQrCode(paymentId: string) {
  return call<{ encodedImage: string; payload: string; expirationDate: string }>(
    `/payments/${paymentId}/pixQrCode`
  )
}

export async function criarCartao(
  customerId: string,
  valor: number,
  pedidoId: string,
  card: { numero: string; nome: string; mes: string; ano: string; cvv: string },
  holder: { nome: string; cpf: string; cep: string; numeroEndereco: string; telefone: string }
) {
  return call<{ id: string; status: string }>("/payments", "POST", {
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
      cpfCnpj:       holder.cpf.replace(/\D/g, ""),
      postalCode:    holder.cep.replace(/\D/g, ""),
      addressNumber: holder.numeroEndereco || "S/N",
      phone:         holder.telefone.replace(/\D/g, ""),
    },
  })
}
