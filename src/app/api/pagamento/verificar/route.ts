export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buscarPagamento } from "@/lib/asaas"
import { enviarReciboPagamento } from "@/lib/email"
import { confirmarCobranca, idsCobranca, partesPagamento, ONLINE, rotuloPagamento } from "@/lib/pagamentoDividido"
import { desfazerCobrancas } from "@/lib/pagamentoDivididoServidor"

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chegodelivery.com"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const CONFIRMADOS = new Set(["CONFIRMED", "RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"])
const RECUSADOS   = new Set(["DECLINED", "OVERDUE", "DELETED", "PAYMENT_OVERDUE", "PAYMENT_DELETED"])

export async function POST(req: NextRequest) {
  const { pedido_id } = await req.json()
  if (!pedido_id) return NextResponse.json({ error: "pedido_id obrigatório" }, { status: 400 })

  const sb = adminSb()

  const { data: pedido } = await sb
    .from("pedidos")
    .select("id, codigo, status, asaas_payment_id, asaas_payment_id_2, pagamentos_online_confirmados, forma_pagamento_2, valor_pagamento_1, valor_pagamento_2, loja_id, total, subtotal, taxa_entrega, desconto, forma_pagamento, nome_cliente, email_cliente, endereco_entrega, itens:itens_pedido(nome, quantidade, preco)")
    .eq("id", pedido_id)
    .maybeSingle()

  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })

  // Já foi confirmado (webhook chegou antes)
  if (pedido.status !== "aguardando_pagamento") {
    return NextResponse.json({ status: pedido.status, confirmado: pedido.status !== "cancelado" })
  }

  // Pagamento em 2 formas: confere cada cobrança online (ver lib/pagamentoDividido)
  if ((pedido as any).forma_pagamento_2) return verificarDividido(sb, pedido as any)

  if (!pedido.asaas_payment_id) {
    // Nenhum pagamento foi iniciado — cancela o pedido para liberar o cliente
    await sb.from("pedidos")
      .update({ status: "cancelado", cancelado_em: new Date().toISOString() })
      .eq("id", pedido_id)
      .eq("status", "aguardando_pagamento")
    return NextResponse.json({ status: "cancelado", confirmado: false, sem_pagamento: true })
  }

  let asaasStatus: string
  try {
    const pagamento = await buscarPagamento(pedido.asaas_payment_id)
    asaasStatus = pagamento.status
  } catch {
    return NextResponse.json({ status: pedido.status, confirmado: false, erro: "Asaas indisponível" })
  }

  if (CONFIRMADOS.has(asaasStatus)) {
    await sb.from("pedidos").update({ status: "pendente", atualizado_em: new Date().toISOString() }).eq("id", pedido_id)

    const nomeCliente = (pedido as any).nome_cliente ?? "Cliente"
    fetch(`${SITE}/api/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action:       "send-loja",
        loja_id:      pedido.loja_id,
        pedido_id:    pedido.id,
        codigo:       pedido.codigo,
        nome_cliente: nomeCliente,
        total:        pedido.total,
        qtd_itens:    0,
      }),
    }).catch(() => {})

    const emailCliente = (pedido as any).email_cliente
    if (emailCliente) {
      const { data: loja } = await sb.from("lojas").select("nome").eq("id", pedido.loja_id).single()
      enviarReciboPagamento({
        email:          emailCliente,
        nomeLoja:       loja?.nome ?? "Chegô",
        codigo:         pedido.codigo,
        nomeCliente,
        itens:          ((pedido as any).itens ?? []) as { nome: string; quantidade: number; preco: number }[],
        subtotal:       Number((pedido as any).subtotal ?? 0),
        taxaEntrega:    Number((pedido as any).taxa_entrega ?? 0),
        desconto:       Number((pedido as any).desconto ?? 0),
        total:          Number(pedido.total),
        formaPagamento: (pedido as any).forma_pagamento,
        endereco:       (pedido as any).endereco_entrega ?? "",
      }).catch(() => {})
    }

    return NextResponse.json({ status: "pendente", confirmado: true })
  }

  if (RECUSADOS.has(asaasStatus)) {
    await sb.from("pedidos")
      .update({ status: "cancelado", cancelado_em: new Date().toISOString() })
      .eq("id", pedido_id)
      .eq("status", "aguardando_pagamento")
    return NextResponse.json({ status: "cancelado", confirmado: false })
  }

  return NextResponse.json({ status: pedido.status, confirmado: false, asaas_status: asaasStatus })
}

// Pedido em 2 formas. "confirmado" = pedido liberado pra loja (todas as partes online pagas);
// "confirmados" = ids de cobrança já pagos (o checkout usa pra saber que o cartão passou).
async function verificarDividido(sb: any, pedido: any) {
  const ids = idsCobranca(pedido)
  const pagos = new Set<string>(pedido.pagamentos_online_confirmados ?? [])
  const precisa = partesPagamento(pedido).filter(x => ONLINE.includes(x.forma)).length
  if (ids.length === 0) {
    return NextResponse.json({ status: pedido.status, confirmado: false, confirmados: [] })
  }
  let liberou = false
  for (const id of ids) {
    if (pagos.has(id)) continue
    let st: string
    try { st = (await buscarPagamento(id)).status } catch {
      return NextResponse.json({ status: pedido.status, confirmado: false, confirmados: [...pagos], erro: "Asaas indisponível" })
    }
    if (CONFIRMADOS.has(st)) {
      pagos.add(id)
      const r = await confirmarCobranca(sb, pedido.id, id)
      if (r.liberou) liberou = true
    } else if (RECUSADOS.has(st)) {
      const { data: cancelou } = await sb.from("pedidos")
        .update({ status: "cancelado", cancelado_em: new Date().toISOString() })
        .eq("id", pedido.id).eq("status", "aguardando_pagamento").select("id")
      if (cancelou?.length) await desfazerCobrancas({ ...pedido, pagamentos_online_confirmados: [...pagos] }, "aguardando_pagamento", id)
      return NextResponse.json({ status: "cancelado", confirmado: false, confirmados: [...pagos] })
    }
  }
  if (liberou) {
    fetch(`${SITE}/api/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send-loja", loja_id: pedido.loja_id, pedido_id: pedido.id, codigo: pedido.codigo, nome_cliente: pedido.nome_cliente ?? "Cliente", total: pedido.total, qtd_itens: 0 }),
    }).catch(() => {})
    if (pedido.email_cliente) {
      const { data: loja } = await sb.from("lojas").select("nome").eq("id", pedido.loja_id).single()
      enviarReciboPagamento({
        email: pedido.email_cliente, nomeLoja: loja?.nome ?? "Chegô", codigo: pedido.codigo, nomeCliente: pedido.nome_cliente ?? "Cliente",
        itens: (pedido.itens ?? []) as { nome: string; quantidade: number; preco: number }[],
        subtotal: Number(pedido.subtotal ?? 0), taxaEntrega: Number(pedido.taxa_entrega ?? 0), desconto: Number(pedido.desconto ?? 0),
        total: Number(pedido.total), formaPagamento: rotuloPagamento(pedido), endereco: pedido.endereco_entrega ?? "",
      }).catch(() => {})
    }
    return NextResponse.json({ status: "pendente", confirmado: true, confirmados: [...pagos] })
  }
  const completo = ids.filter(id => pagos.has(id)).length >= precisa
  return NextResponse.json({ status: pedido.status, confirmado: completo && pedido.status !== "aguardando_pagamento", confirmados: [...pagos] })
}
