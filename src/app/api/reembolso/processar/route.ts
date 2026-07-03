/**
 * POST /api/reembolso/processar
 *
 * Admin ou lojista aprova ou nega uma solicitação de reembolso.
 * Aprovação aciona o estorno via Asaas (imediatamente, valor parcial ou total).
 * Requer sessão de admin ou loja (que seja a loja do pedido).
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, requireLoja, unauthorized } from "@/lib/session"
import { estornarPagamento } from "@/lib/asaas"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const sessAdmin = requireAdmin(req)
  const sessLoja  = !sessAdmin ? requireLoja(req) : null

  if (!sessAdmin && !sessLoja) return unauthorized()

  const { reembolso_id, acao, valor_aprovado, negado_motivo } = await req.json()
  // acao: "aprovar" | "negar"

  if (!reembolso_id || !["aprovar", "negar"].includes(acao)) {
    return NextResponse.json({ error: "reembolso_id e acao (aprovar|negar) obrigatórios" }, { status: 400 })
  }

  const sb = adminSb()

  // Busca o reembolso com os dados do pedido
  const { data: reembolso } = await sb
    .from("reembolsos")
    .select("*, pedido:pedidos(id, total, asaas_payment_id, loja_id, forma_pagamento)")
    .eq("id", reembolso_id)
    .single()

  if (!reembolso) {
    return NextResponse.json({ error: "Reembolso não encontrado" }, { status: 404 })
  }

  if (reembolso.status !== "solicitado") {
    return NextResponse.json({ error: `Reembolso já está ${reembolso.status}` }, { status: 409 })
  }

  // Loja só pode aprovar/negar seus próprios pedidos
  if (sessLoja && (reembolso.pedido as any).loja_id !== sessLoja.loja_id) {
    return unauthorized("Este reembolso não é do seu estabelecimento")
  }

  const aprovadoPor = sessAdmin ? "admin" : "loja"

  if (acao === "negar") {
    await sb.from("reembolsos").update({
      status: "negado",
      aprovado_por: aprovadoPor,
      aprovado_em: new Date().toISOString(),
      negado_motivo: negado_motivo ?? "",
      atualizado_em: new Date().toISOString(),
    }).eq("id", reembolso_id)

    return NextResponse.json({ ok: true, status: "negado" })
  }

  // acao === "aprovar"
  const pedido = reembolso.pedido as any
  const valorTotal = Number(pedido.total)
  const valorEstorno = valor_aprovado != null ? Number(valor_aprovado) : null

  if (valorEstorno != null && (valorEstorno <= 0 || valorEstorno > valorTotal)) {
    return NextResponse.json({ error: `Valor deve ser entre R$ 0,01 e R$ ${valorTotal.toFixed(2)}` }, { status: 400 })
  }

  // Tenta o estorno imediatamente se há asaas_payment_id
  let asaasRefundId: string | null = null
  let novoStatus = "aprovado"

  if (pedido.asaas_payment_id) {
    try {
      const refund = await estornarPagamento(pedido.asaas_payment_id, valorEstorno ?? undefined)
      asaasRefundId = refund.id
      novoStatus = "processando"
    } catch (e: any) {
      console.error("[reembolso/processar] falha Asaas:", e.message)
      // Aprova mesmo assim — admin/financeiro processa manualmente
    }
  }

  await sb.from("reembolsos").update({
    status: novoStatus,
    aprovado_por: aprovadoPor,
    aprovado_em: new Date().toISOString(),
    valor_aprovado: valorEstorno,
    asaas_refund_id: asaasRefundId,
    atualizado_em: new Date().toISOString(),
  }).eq("id", reembolso_id)

  return NextResponse.json({ ok: true, status: novoStatus, asaas_refund_id: asaasRefundId })
}

// GET — busca reembolso por ID (admin ou loja dona do pedido)
export async function GET(req: NextRequest) {
  const sessAdmin = requireAdmin(req)
  const sessLoja  = !sessAdmin ? requireLoja(req) : null
  if (!sessAdmin && !sessLoja) return unauthorized()

  const { searchParams } = new URL(req.url)
  const reembolso_id = searchParams.get("id")
  const pedido_id    = searchParams.get("pedido_id")

  const sb = adminSb()
  let query = sb
    .from("reembolsos")
    .select("*, pedido:pedidos(id, codigo, total, loja_id, forma_pagamento, nome_cliente)")
    .order("solicitado_em", { ascending: false })

  if (reembolso_id) query = query.eq("id", reembolso_id) as any
  else if (pedido_id) query = query.eq("pedido_id", pedido_id) as any

  if (sessLoja) {
    // Filtra só reembolsos da loja da sessão
    query = query.eq("pedido.loja_id", sessLoja.loja_id) as any
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reembolsos: data ?? [] })
}
