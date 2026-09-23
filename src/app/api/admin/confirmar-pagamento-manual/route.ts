export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { enviarReciboPagamento } from "@/lib/email"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chegodelivery.com"

// Confirmação manual de pagamento pelo admin (pedido do usuário, 2026-09-19, caso real:
// pedido BB7X82 — cliente mandou comprovante e o admin verificou que o dinheiro caiu,
// mas a Asaas ainda mostrava o pagamento como PENDING e nenhum webhook tinha chegado
// pra esse payment_id específico). Diferente de /api/pagamento/verificar (que consulta a
// Asaas de novo e não ajuda quando a própria Asaas está atrasada), esse endpoint confia
// no admin e dispara o MESMO fluxo real de "pagamento confirmado" — muda status,
// notifica a loja por push e manda o recibo por e-mail pro cliente — em vez de só trocar
// o status no banco e deixar a loja sem saber do pedido.
export async function POST(req: NextRequest) {
  const sess = requireAdmin(req)
  if (!sess) return unauthorized()

  const { pedido_id } = await req.json()
  if (!pedido_id) return NextResponse.json({ error: "pedido_id obrigatório" }, { status: 400 })

  const sb = adminClient()

  const { data: pedido } = await sb
    .from("pedidos")
    .select("id, codigo, status, loja_id, total, subtotal, taxa_entrega, desconto, forma_pagamento, nome_cliente, email_cliente, endereco_entrega, asaas_payment_id, itens:itens_pedido(nome, quantidade, preco)")
    .eq("id", pedido_id)
    .maybeSingle()

  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
  if (pedido.status !== "aguardando_pagamento") {
    return NextResponse.json({ error: "Esse pedido não está aguardando pagamento" }, { status: 422 })
  }

  const { data: atualizado, error } = await sb
    .from("pedidos")
    .update({ status: "pendente" })
    .eq("id", pedido_id)
    .eq("status", "aguardando_pagamento")
    .select("id, codigo, status")
    .single()

  if (error || !atualizado) return NextResponse.json({ error: error?.message ?? "Erro ao confirmar pagamento" }, { status: 500 })

  // Registro de auditoria — mesma tabela usada pra idempotência dos webhooks reais
  // (evita criar tabela nova só pra isso), sinalizado com provider distinto pra deixar
  // claro que essa confirmação NÃO veio da Asaas, foi override manual do admin. Vale
  // conferir depois na conciliação financeira se o pagamento realmente caiu nessa
  // cobrança específica.
  try {
    await sb.from("webhook_events").insert({
      provider: "admin_manual",
      external_event_id: `confirmacao_manual_${pedido_id}_${Date.now()}`,
      payload: { pedido_id, codigo: pedido.codigo, asaas_payment_id: pedido.asaas_payment_id, motivo: "Admin confirmou pagamento manualmente (Asaas/webhook não haviam confirmado ainda)" },
    })
  } catch { /* auditoria não pode bloquear a confirmação em si */ }

  const nomeCliente = (pedido as any).nome_cliente ?? "Cliente"
  fetch(`${SITE}/api/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "send-loja",
      loja_id: pedido.loja_id,
      pedido_id: pedido.id,
      codigo: pedido.codigo,
      nome_cliente: nomeCliente,
      total: pedido.total,
      qtd_itens: 0,
    }),
  }).catch(() => {})

  const emailCliente = (pedido as any).email_cliente
  if (emailCliente) {
    const { data: loja } = await sb.from("lojas").select("nome").eq("id", pedido.loja_id).single()
    enviarReciboPagamento({
      email: emailCliente,
      nomeLoja: loja?.nome ?? "Chegô",
      codigo: pedido.codigo,
      nomeCliente,
      itens: ((pedido as any).itens ?? []) as { nome: string; quantidade: number; preco: number }[],
      subtotal: Number((pedido as any).subtotal ?? 0),
      taxaEntrega: Number((pedido as any).taxa_entrega ?? 0),
      desconto: Number((pedido as any).desconto ?? 0),
      total: Number(pedido.total),
      formaPagamento: (pedido as any).forma_pagamento,
      endereco: (pedido as any).endereco_entrega ?? "",
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, pedido: atualizado })
}
