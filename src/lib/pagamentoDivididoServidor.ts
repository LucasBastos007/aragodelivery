// Só servidor (usa a chave do Asaas). Desfaz as cobranças de um pedido cancelado,
// inclusive as duas de um pedido pix + cartão (ver lib/pagamentoDividido).
import { estornarPagamento, cancelarPagamento } from "@/lib/asaas"
import { idsCobranca } from "@/lib/pagamentoDividido"

type P = {
  asaas_payment_id?: string | null
  asaas_payment_id_2?: string | null
  pagamentos_online_confirmados?: string[] | null
}

/**
 * statusAntes = status do pedido antes do cancelamento. Cobrança já paga (pedido saiu de
 * aguardando_pagamento, ou a parte está em pagamentos_online_confirmados) → estorna; ainda
 * não paga → cancela. Se a primeira tentativa falhar, tenta a outra.
 * `exceto`: id que não deve ser mexido (ex.: o pix que acabou de vencer no webhook).
 */
export async function desfazerCobrancas(p: P, statusAntes: string, exceto?: string | null): Promise<void> {
  const pagos = new Set(p.pagamentos_online_confirmados ?? [])
  for (const id of idsCobranca(p)) {
    if (id === exceto) continue
    const pago = statusAntes !== "aguardando_pagamento" || pagos.has(id)
    try {
      if (pago) await estornarPagamento(id)
      else await cancelarPagamento(id)
    } catch (e) {
      try {
        if (pago) await cancelarPagamento(id)
        else await estornarPagamento(id)
      } catch {
        console.error("[desfazerCobrancas] falhou:", id, e)
      }
    }
  }
}
