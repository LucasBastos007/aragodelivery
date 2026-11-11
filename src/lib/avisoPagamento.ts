// Processa um aviso de pagamento (Asaas ou Mercado Pago). O aviso chega no formato do Asaas;
// o webhook do Mercado Pago traduz antes de chamar (ver app/api/pagamento/mp-webhook).
import { NextResponse } from "next/server"
import { enviarReciboPagamento } from "@/lib/email"
import { confirmarCobranca, rotuloPagamento } from "@/lib/pagamentoDividido"
import { desfazerCobrancas } from "@/lib/pagamentoDivididoServidor"
import { enviarTexto, zapiOk } from "@/lib/whatsSuporte"

async function avisarPagoNoWhats(sb: any, pedidoId: string, codigo: string) {
  if (!zapiOk()) return
  const { count } = await sb.from("webhook_events").select("id", { count: "exact", head: true }).eq("provider", "whats-bot-pix").like("external_event_id", `${pedidoId}#%`)
  if (!count) return
  const { data: p } = await sb.from("pedidos").select("telefone_cliente, cliente_id").eq("id", pedidoId).maybeSingle()
  let tel: string | null = p?.telefone_cliente ?? null
  if (!tel && p?.cliente_id) tel = (await sb.from("clientes").select("telefone").eq("id", p.cliente_id).maybeSingle()).data?.telefone ?? null
  const dig = (tel ?? "").replace(/\D/g, "")
  if (!dig) return
  await enviarTexto(dig.length <= 11 ? `55${dig}` : dig, `Pagamento confirmado! ✅ O pedido #${codigo} já foi para a loja. Você acompanha tudo pelo app. Obrigado por pedir na Chegô!`)
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chegodelivery.com"

const CONFIRMADOS  = new Set(["CONFIRMED", "RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"])
const CANCELADOS   = new Set(["OVERDUE", "DELETED", "PAYMENT_OVERDUE", "PAYMENT_DELETED"])
const REEMBOLSADOS = new Set(["REFUNDED", "REFUND_IN_PROGRESS", "REFUND_REQUESTED", "PAYMENT_REFUND_IN_PROGRESS"])

export type AvisoPagamento = {
  id?: string
  event?: string
  payment?: { id?: string; externalReference?: string; status?: string }
}

export async function processarAvisoPagamento(sb: any, body: AvisoPagamento | null, provider: "asaas" | "mercadopago") {
  if (!body?.payment?.externalReference) return NextResponse.json({ received: true })

  const { event = "", payment } = body
  const pedidoId = payment.externalReference!
  const status   = payment.status ?? ""

  // Idempotência: deduplicar eventos repetidos pelo ID do evento Asaas
  const externalEventId = body.id ?? `${payment.id}_${event}`
  const { error: dupErr } = await sb.from("webhook_events").insert({
    provider,
    external_event_id: externalEventId,
    payload: body as object,
  })
  if (dupErr?.code === "23505") {
    // Evento já processado — retorna 200 sem processar novamente
    return NextResponse.json({ received: true, duplicate: true })
  }

  // Pedido em 2 formas? (ver lib/pagamentoDividido)
  const { data: pag } = await sb.from("pedidos")
    .select("status, forma_pagamento_2, asaas_payment_id, asaas_payment_id_2, pagamentos_online_confirmados")
    .eq("id", pedidoId).maybeSingle()
  const dividido = !!pag?.forma_pagamento_2

  if (CONFIRMADOS.has(event) || CONFIRMADOS.has(status)) {
    const SEL = "id, codigo, loja_id, total, subtotal, taxa_entrega, desconto, forma_pagamento, forma_pagamento_2, valor_pagamento_1, valor_pagamento_2, observacao, nome_cliente, email_cliente, endereco_entrega, itens:itens_pedido(nome, quantidade, preco)"
    let updated: any = null
    if (dividido) {
      // Só libera pra loja quando todas as partes online estão pagas
      const { liberou } = await confirmarCobranca(sb, pedidoId, payment.id ?? null)
      if (liberou) updated = (await sb.from("pedidos").select(SEL).eq("id", pedidoId).maybeSingle()).data
    } else {
      updated = (await sb
        .from("pedidos")
        .update({ status: "pendente", atualizado_em: new Date().toISOString() })
        .eq("id", pedidoId)
        .eq("status", "aguardando_pagamento")
        .select(SEL)
        .maybeSingle()).data
    }

    if (updated) {
      // Pix gerado pelo robô do WhatsApp: avisa o cliente na mesma conversa que o pagamento
      // caiu (pedido do Lucas, 24/10/2026), sem precisar mandar comprovante.
      await avisarPagoNoWhats(sb, updated.id, updated.codigo).catch(e => console.error("[WHATS BOT] aviso de pago falhou", e))
      const nomeCliente = (updated as any).nome_cliente
        ?? (updated.observacao as string | null)?.match(/Cliente: ([^|]+)/)?.[1]?.trim()
        ?? "Cliente"

      // Push para lojista
      fetch(`${SITE}/api/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:       "send-loja",
          loja_id:      updated.loja_id,
          pedido_id:    updated.id,
          codigo:       updated.codigo,
          nome_cliente: nomeCliente,
          total:        updated.total,
          qtd_itens:    0,
        }),
      }).catch(() => {})

      // Recibo por email ao cliente
      const emailCliente = (updated as any).email_cliente
      if (emailCliente) {
        const { data: loja } = await sb.from("lojas").select("nome").eq("id", updated.loja_id).single()
        enviarReciboPagamento({
          email:          emailCliente,
          nomeLoja:       loja?.nome ?? "Chegô",
          codigo:         updated.codigo,
          nomeCliente,
          itens:          ((updated as any).itens ?? []) as { nome: string; quantidade: number; preco: number }[],
          subtotal:       Number((updated as any).subtotal ?? 0),
          taxaEntrega:    Number((updated as any).taxa_entrega ?? 0),
          desconto:       Number((updated as any).desconto ?? 0),
          total:          Number(updated.total),
          formaPagamento: dividido ? rotuloPagamento(updated) : (updated as any).forma_pagamento,
          endereco:       (updated as any).endereco_entrega ?? "",
        }).catch(() => {})
      }
    }
  } else if (CANCELADOS.has(event) || CANCELADOS.has(status)) {
    // Guarda atômica: só cancela (e só grava cancelado_em) se o pedido ainda não
    // estiver num status final — evita sobrescrever um cancelamento/entrega já
    // registrado por outro caminho (ex: loja já cancelou manualmente antes).
    const { data: cancelou } = await sb.from("pedidos")
      .update({ status: "cancelado", cancelado_em: new Date().toISOString() })
      .eq("id", pedidoId)
      .not("status", "in", '("cancelado","entregue")')
      .select("id")
    // Pix + cartão: o pix venceu mas o cartão já tinha sido cobrado → estorna o cartão
    if (dividido && pag && cancelou?.length) await desfazerCobrancas(pag, pag.status, payment.id ?? null)

  } else if (REEMBOLSADOS.has(event) || REEMBOLSADOS.has(status)) {
    // Marca o pedido como cancelado e o reembolso como concluído
    const paymentId = payment.id
    await sb.from("pedidos")
      .update({ status: "cancelado", cancelado_em: new Date().toISOString() })
      .eq("id", pedidoId)
      .not("status", "in", '("cancelado","entregue")')

    if (paymentId) {
      // Atualiza reembolso associado (pelo asaas_refund_id ou pedido_id)
      const isConcluido = event === "REFUNDED" || status === "REFUNDED"
      const novoStatusRef = isConcluido ? "concluido" : "processando"
      const { data: refunds } = await sb
        .from("reembolsos")
        .select("id")
        .eq("pedido_id", pedidoId)
        .in("status", ["solicitado", "aprovado", "processando"])

      if (refunds && refunds.length > 0) {
        await sb.from("reembolsos")
          .update({ status: novoStatusRef, asaas_refund_id: paymentId, atualizado_em: new Date().toISOString() })
          .in("id", refunds.map((r: any) => r.id))
      }
    }
  }

  return NextResponse.json({ received: true })
}
