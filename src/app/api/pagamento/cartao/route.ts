export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { ehDividido, temForma, valorDaForma, colunaCobranca, confirmarCobranca } from "@/lib/pagamentoDividido"
import { criarCliente, criarCartao, type AsaasSplit } from "@/lib/asaas"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const { pedido_id, nome, telefone, email, cpf, cep, numero_endereco, card, loja_id } = await req.json()

  if (!pedido_id || !nome || !cpf || !card) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  const sb = adminSb()

  // Valor sempre vem do pedido já validado no servidor — nunca confiar no que o
  // cliente manda no body, senão dá pra cobrar qualquer valor no cartão.
  const { data: pedidoDb } = await sb.from("pedidos")
    .select("total, forma_pagamento, forma_pagamento_2, valor_pagamento_1, valor_pagamento_2")
    .eq("id", pedido_id).single()
  if (!pedidoDb) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
  // Pagamento em 2 formas: cobra só a parte no cartão (ver lib/pagamentoDividido).
  const dividido = ehDividido(pedidoDb)
  if (dividido && !temForma(pedidoDb, "cartao")) return NextResponse.json({ error: "Este pedido não tem parte no cartão." }, { status: 400 })
  const valor = dividido ? valorDaForma(pedidoDb, "cartao") : pedidoDb.total
  const coluna = colunaCobranca(pedidoDb, "cartao")

  // Monta split se a loja tiver subconta Asaas
  let split: AsaasSplit | undefined
  if (loja_id) {
    const { data: loja } = await sb
      .from("lojas")
      .select("asaas_wallet_id, comissao")
      .eq("id", loja_id)
      .single()
    if (loja?.asaas_wallet_id) {
      split = {
        walletId:        loja.asaas_wallet_id,
        percentualValue: Math.max(0, 100 - Number(loja.comissao ?? 10)),
      }
    } else if (loja_id) {
      console.warn("[Cartão] Loja sem subconta Asaas — split não aplicado:", loja_id)
    }
  }

  try {
    const emailFinal = email || `pedido_${pedido_id.replace(/-/g, "").slice(0, 12)}@chegodelivery.com`
    const cliente  = await criarCliente(nome, { cpf, email: emailFinal, telefone })
    const cobranca = await criarCartao(
      cliente.id, valor, pedido_id,
      { numero: card.numero, nome: card.nome, mes: card.mes, ano: card.ano, cvv: card.cvv },
      { nome, cpf, email: emailFinal, cep: cep || "75370000", numeroEndereco: numero_endereco || "S/N", telefone },
      split
    )

    const APROVADOS = ["CONFIRMED", "RECEIVED"]

    const cardToken = cobranca.creditCard?.creditCardToken ?? null

    if (APROVADOS.includes(cobranca.status)) {
      if (dividido) {
        // Dividido: grava a cobrança e só libera pra loja se não faltar outra parte online (pix)
        await sb.from("pedidos").update({ [coluna]: cobranca.id }).eq("id", pedido_id)
        const { completo } = await confirmarCobranca(sb, pedido_id, cobranca.id)
        return NextResponse.json({ ok: true, cardToken, payment_id: cobranca.id, falta_pix: !completo })
      }
      await sb.from("pedidos").update({ asaas_payment_id: cobranca.id, status: "pendente" }).eq("id", pedido_id)
      return NextResponse.json({ ok: true, cardToken, payment_id: cobranca.id })
    }

    // PENDING — salva ID e aguarda confirmação via webhook
    if (cobranca.status === "PENDING") {
      await sb.from("pedidos").update({ [coluna]: cobranca.id }).eq("id", pedido_id)
      return NextResponse.json({ ok: true, aguardando: true, cardToken, payment_id: cobranca.id })
    }

    // Recusado
    console.error("[Cartão] Status inesperado:", cobranca.status, "id:", cobranca.id)
    await sb.from("pedidos")
      .update({ [coluna]: cobranca.id, status: "cancelado", cancelado_em: new Date().toISOString() })
      .eq("id", pedido_id)
      .not("status", "in", '("cancelado","entregue")')
    return NextResponse.json({ error: `Cartão recusado (${cobranca.status})` }, { status: 422 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao processar cartão"
    console.error("[Cartão]", msg)
    await sb.from("pedidos")
      .update({ status: "cancelado", cancelado_em: new Date().toISOString() })
      .eq("id", pedido_id)
      .not("status", "in", '("cancelado","entregue")')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
