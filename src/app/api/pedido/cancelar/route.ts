/**
 * POST /api/pedido/cancelar
 *
 * Cliente cancela o próprio pedido antes de a loja aceitar.
 * Autenticado via cliente_push_token (gerado ao criar o pedido).
 * Só permite cancelamento nos status: aguardando_pagamento | pendente
 * Estorno automático se o pagamento já foi confirmado (pix/cartao).
 */
import { NextRequest, NextResponse } from "next/server"
import { desfazerCobrancas } from "@/lib/pagamentoDivididoServidor"
import { createClient } from "@supabase/supabase-js"

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
    .select("id, status, asaas_payment_id, asaas_payment_id_2, pagamentos_online_confirmados, forma_pagamento, total, cliente_push_token")
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
    .update({ status: "cancelado", cancelado_em: new Date().toISOString() })
    .eq("id", pedido_id)
    .in("status", [...CANCELAVEIS])
    .select("id, status")

  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "Pedido já não pode mais ser cancelado", status: "erro" }, { status: 409 })
  }

  // Estorno automático via Asaas
  // Ainda não pago → cancela a cobrança; já pago → estorna. Pedido em 2 formas (pix + cartão)
  // pode ter as duas cobranças, e o cartão já pago mesmo com o pix pendente.
  // Falha não impede o cancelamento — equipe admin verá e fará manualmente.
  await desfazerCobrancas(pedido, pedido.status)

  return NextResponse.json({ ok: true, status: "cancelado" })
}
