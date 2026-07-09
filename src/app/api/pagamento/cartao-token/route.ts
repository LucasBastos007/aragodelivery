export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { criarCliente, criarCartaoToken, type AsaasSplit } from "@/lib/asaas"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const { pedido_id, valor, nome, telefone, email, cpf, cep, numero_endereco, token, loja_id } = await req.json()

  if (!pedido_id || !valor || !nome || !cpf || !token) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  const sb = adminSb()

  let split: AsaasSplit | undefined
  if (loja_id) {
    const { data: loja } = await sb.from("lojas").select("asaas_wallet_id, comissao").eq("id", loja_id).single()
    if (loja?.asaas_wallet_id) {
      split = {
        walletId:        loja.asaas_wallet_id,
        percentualValue: Math.max(0, 100 - Number(loja.comissao ?? 10)),
      }
    }
  }

  try {
    const emailFinal = email || `pedido_${pedido_id.replace(/-/g, "").slice(0, 12)}@chegodelivery.com`
    const cliente  = await criarCliente(nome, { cpf, email: emailFinal, telefone })
    const cobranca = await criarCartaoToken(
      cliente.id, valor, pedido_id, token,
      { nome, cpf, email: emailFinal, cep: cep || "75370000", numeroEndereco: numero_endereco || "S/N", telefone },
      split
    )

    const APROVADOS = ["CONFIRMED", "RECEIVED"]
    const cardToken = cobranca.creditCard?.creditCardToken ?? token

    if (APROVADOS.includes(cobranca.status)) {
      await sb.from("pedidos").update({ asaas_payment_id: cobranca.id, status: "pendente" }).eq("id", pedido_id)
      return NextResponse.json({ ok: true, cardToken })
    }

    if (cobranca.status === "PENDING") {
      await sb.from("pedidos").update({ asaas_payment_id: cobranca.id }).eq("id", pedido_id)
      return NextResponse.json({ ok: true, aguardando: true, cardToken })
    }

    console.error("[CartãoToken] Status inesperado:", cobranca.status, "id:", cobranca.id)
    await sb.from("pedidos").update({ asaas_payment_id: cobranca.id, status: "cancelado" }).eq("id", pedido_id)
    return NextResponse.json({ error: `Cartão recusado (${cobranca.status})` }, { status: 422 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao processar cartão"
    console.error("[CartãoToken]", msg)
    await sb.from("pedidos").update({ status: "cancelado" }).eq("id", pedido_id)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
