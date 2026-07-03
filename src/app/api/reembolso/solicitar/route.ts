/**
 * POST /api/reembolso/solicitar
 *
 * Cliente solicita reembolso após entrega (ou após cancelamento sem estorno automático).
 * Autenticado via cliente_push_token.
 * Cria registro na tabela reembolsos.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const { pedido_id, cliente_push_token, motivo, descricao, foto_url, valor_solicitado } = await req.json()

  if (!pedido_id || !cliente_push_token || !motivo) {
    return NextResponse.json({ error: "pedido_id, cliente_push_token e motivo obrigatórios" }, { status: 400 })
  }

  const sb = adminSb()

  // Valida token do cliente
  const { data: pedido } = await sb
    .from("pedidos")
    .select("id, status, total, forma_pagamento, asaas_payment_id, loja_id")
    .eq("id", pedido_id)
    .eq("cliente_push_token", cliente_push_token)
    .single()

  if (!pedido) {
    return NextResponse.json({ error: "Pedido não encontrado ou token inválido" }, { status: 404 })
  }

  // Só permite reembolso para pedidos que tiveram pagamento digital
  if (!["pix", "cartao"].includes(pedido.forma_pagamento)) {
    return NextResponse.json({ error: "Reembolso só disponível para pagamentos via PIX ou cartão" }, { status: 422 })
  }

  // Verifica se já existe reembolso pendente para este pedido
  const { data: existing } = await sb
    .from("reembolsos")
    .select("id, status")
    .eq("pedido_id", pedido_id)
    .not("status", "eq", "negado")
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "Já existe uma solicitação de reembolso para este pedido", reembolso_id: existing.id }, { status: 409 })
  }

  const { data: reembolso, error } = await sb
    .from("reembolsos")
    .insert({
      pedido_id,
      solicitado_por: "cliente",
      motivo,
      descricao: descricao ?? "",
      foto_url: foto_url ?? "",
      status: "solicitado",
      valor_solicitado: valor_solicitado ?? null,
    })
    .select("id, status")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notifica a loja sobre a solicitação
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chegodelivery.com"
  const { data: loja } = await sb.from("lojas").select("push_subscription").eq("id", pedido.loja_id).single()
  if (loja?.push_subscription) {
    fetch(`${SITE}/api/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send-loja",
        loja_id: pedido.loja_id,
        pedido_id,
        codigo: "",
        nome_cliente: "Cliente",
        total: 0,
        qtd_itens: 0,
        _override_payload: {
          title: "Solicitação de reembolso",
          body: `Um cliente solicitou reembolso para o pedido. Motivo: ${motivo}`,
          tag: `reembolso-${reembolso!.id}`,
          url: "/loja",
          requireInteraction: true,
        },
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, reembolso_id: reembolso!.id })
}
