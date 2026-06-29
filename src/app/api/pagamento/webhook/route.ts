export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chegodelivery.com"

const CONFIRMADOS = new Set(["CONFIRMED", "RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"])
const CANCELADOS  = new Set(["REFUNDED", "OVERDUE", "DELETED", "REFUND_REQUESTED", "PAYMENT_OVERDUE", "PAYMENT_DELETED"])

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
    event?: string
    payment?: { id?: string; externalReference?: string; status?: string }
  } | null

  if (!body?.payment?.externalReference) return NextResponse.json({ received: true })

  const { event = "", payment } = body
  const pedidoId = payment.externalReference!
  const status   = payment.status ?? ""
  const sb       = adminSb()

  if (CONFIRMADOS.has(event) || CONFIRMADOS.has(status)) {
    const { data: updated } = await sb
      .from("pedidos")
      .update({ status: "pendente" })
      .eq("id", pedidoId)
      .eq("status", "aguardando_pagamento")
      .select("id, codigo, loja_id, total, observacao")
      .maybeSingle()

    if (updated) {
      const nomeCliente = (updated.observacao as string | null)
        ?.match(/Cliente: ([^|]+)/)?.[1]?.trim() ?? "Cliente"

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
    }
  } else if (CANCELADOS.has(event) || CANCELADOS.has(status)) {
    await sb.from("pedidos").update({ status: "cancelado" }).eq("id", pedidoId)
  }

  return NextResponse.json({ received: true })
}
