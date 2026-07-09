export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { enviarReciboPagamento } from "@/lib/email"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chegodelivery.com"

const CONFIRMADOS  = new Set(["CONFIRMED", "RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"])
const CANCELADOS   = new Set(["OVERDUE", "DELETED", "PAYMENT_OVERDUE", "PAYMENT_DELETED"])
const REEMBOLSADOS = new Set(["REFUNDED", "REFUND_IN_PROGRESS", "REFUND_REQUESTED", "PAYMENT_REFUND_IN_PROGRESS"])

// GET — responde 200 para o teste de ativação do Asaas
export async function GET() {
  return NextResponse.json({ received: true })
}

export async function POST(req: NextRequest) {
  // Valida token de autenticação do Asaas (header asaas-access-token)
  // SEMPRE exige o token — se não estiver configurado, rejeita com erro de servidor
  const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN
  if (!WEBHOOK_TOKEN) {
    console.error("[WEBHOOK] ASAAS_WEBHOOK_TOKEN não configurado! Configure a variável de ambiente.")
    return NextResponse.json({ error: "Webhook não configurado no servidor." }, { status: 500 })
  }
  const token = req.headers.get("asaas-access-token") ?? req.headers.get("authorization")
  if (token !== WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as {
    id?: string
    event?: string
    payment?: { id?: string; externalReference?: string; status?: string }
  } | null

  if (!body?.payment?.externalReference) return NextResponse.json({ received: true })

  const { event = "", payment } = body
  const pedidoId = payment.externalReference!
  const status   = payment.status ?? ""
  const sb       = adminSb()

  // Idempotência: deduplicar eventos repetidos pelo ID do evento Asaas
  const externalEventId = body.id ?? `${payment.id}_${event}`
  const { error: dupErr } = await sb.from("webhook_events").insert({
    provider: "asaas",
    external_event_id: externalEventId,
    payload: body as object,
  })
  if (dupErr?.code === "23505") {
    // Evento já processado — retorna 200 sem processar novamente
    return NextResponse.json({ received: true, duplicate: true })
  }

  if (CONFIRMADOS.has(event) || CONFIRMADOS.has(status)) {
    const { data: updated } = await sb
      .from("pedidos")
      .update({ status: "pendente" })
      .eq("id", pedidoId)
      .eq("status", "aguardando_pagamento")
      .select("id, codigo, loja_id, total, subtotal, taxa_entrega, desconto, forma_pagamento, observacao, nome_cliente, email_cliente, endereco_entrega, itens:itens_pedido(nome, quantidade, preco)")
      .maybeSingle()

    if (updated) {
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
          formaPagamento: (updated as any).forma_pagamento,
          endereco:       (updated as any).endereco_entrega ?? "",
        }).catch(() => {})
      }
    }
  } else if (CANCELADOS.has(event) || CANCELADOS.has(status)) {
    await sb.from("pedidos").update({ status: "cancelado" }).eq("id", pedidoId)

  } else if (REEMBOLSADOS.has(event) || REEMBOLSADOS.has(status)) {
    // Marca o pedido como cancelado e o reembolso como concluído
    const paymentId = payment.id
    await sb.from("pedidos").update({ status: "cancelado" }).eq("id", pedidoId)

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
