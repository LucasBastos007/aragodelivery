import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"
import { estornarPagamento, cancelarPagamento } from "@/lib/asaas"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const STATUS_VALIDOS = ["aceito", "preparando", "pronto", "cancelado"]

export async function POST(req: NextRequest) {
  const _sess = requireLoja(req)
  if (!_sess) return unauthorized()
  const sessLojaId = _sess.loja_id

  const { pedido_id, status } = await req.json()
  const loja_id = sessLojaId
  if (!pedido_id || !status || !loja_id) {
    return NextResponse.json({ error: "pedido_id, status e loja_id obrigatórios" }, { status: 400 })
  }
  if (!STATUS_VALIDOS.includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 })
  }

  const sb = adminClient()

  // Busca pedido antes para ter o asaas_payment_id e status atual
  const { data: pedidoAtual } = await sb
    .from("pedidos")
    .select("id, codigo, status, asaas_payment_id, forma_pagamento")
    .eq("id", pedido_id)
    .eq("loja_id", loja_id)
    .single()

  if (!pedidoAtual) {
    return NextResponse.json({ error: "Pedido não encontrado ou não pertence à loja" }, { status: 404 })
  }

  const { data, error } = await sb
    .from("pedidos")
    .update({ status })
    .eq("id", pedido_id)
    .eq("loja_id", loja_id)
    .select("id, codigo, status")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Estorno automático ao cancelar pedidos pagos via PIX ou cartão
  if (status === "cancelado" && pedidoAtual.asaas_payment_id) {
    const pid = pedidoAtual.asaas_payment_id
    const statusAtual = pedidoAtual.status
    try {
      // Se ainda não confirmado → cancela. Se já pago → estorna.
      if (statusAtual === "aguardando_pagamento") {
        await cancelarPagamento(pid)
      } else {
        await estornarPagamento(pid)
      }
    } catch (e) {
      console.error("[estorno] falha:", e)
    }
  }

  return NextResponse.json({ ok: true, pedido: data?.[0] })
}
