/**
 * POST /api/pedido/cancelar
 *
 * Cliente cancela o próprio pedido antes de a loja aceitar.
 * Autenticado via cliente_push_token (gerado ao criar o pedido).
 * Só permite cancelamento nos status: aguardando_pagamento | pendente
 * Estorno automático se o pagamento já foi confirmado (pix/cartao).
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { estornarPagamento, cancelarPagamento } from "@/lib/asaas"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const CANCELAVEIS = new Set(["aguardando_pagamento", "pendente"])

export async function POST(req: NextRequest) {
  const { pedido_id, cliente_push_token } = await req.json()

  if (!pedido_id || !cliente_push_token) {
    return NextResponse.json({ error: "pedido_id e cliente_push_token obrigatórios" }, { status: 400 })
  }

  const sb = adminSb()

  // Valida que o token pertence ao pedido (prova de posse do cliente)
  const { data: pedido } = await sb
    .from("pedidos")
    .select("id, status, asaas_payment_id, forma_pagamento, total, cliente_push_token")
    .eq("id", pedido_id)
    .eq("cliente_push_token", cliente_push_token)
    .single()

  if (!pedido) {
    return NextResponse.json({ error: "Pedido não encontrado ou token inválido" }, { status: 404 })
  }

  if (!CANCELAVEIS.has(pedido.status)) {
    return NextResponse.json({
      error: "Este pedido já foi aceito pela loja e não pode ser cancelado aqui. Solicite reembolso.",
      status: pedido.status,
    }, { status: 422 })
  }

  // Cancela o pedido atomicamente (só se ainda cancelável)
  const { data: updated } = await sb
    .from("pedidos")
    .update({ status: "cancelado" })
    .eq("id", pedido_id)
    .in("status", [...CANCELAVEIS])
    .select("id, status")

  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "Pedido já não pode mais ser cancelado", status: "erro" }, { status: 409 })
  }

  // Estorno automático via Asaas
  if (pedido.asaas_payment_id) {
    try {
      if (pedido.status === "aguardando_pagamento") {
        await cancelarPagamento(pedido.asaas_payment_id)
      } else {
        // Já pago (pendente) — estorna imediatamente
        await estornarPagamento(pedido.asaas_payment_id)
      }
    } catch (e) {
      console.error("[cancelar] falha no estorno Asaas:", e)
      // Pedido cancelado mesmo assim — equipe admin verá e fará manualmente
    }
  }

  return NextResponse.json({ ok: true, status: "cancelado" })
}
