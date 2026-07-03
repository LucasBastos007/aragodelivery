export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { criarCliente, criarCartao } from "@/lib/asaas"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const { pedido_id, valor, nome, telefone, email, cpf, cep, numero_endereco, card } = await req.json()

  if (!pedido_id || !valor || !nome || !cpf || !card) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  const sb = adminSb()

  try {
    const cliente  = await criarCliente(nome, { cpf, email, telefone })
    const cobranca = await criarCartao(
      cliente.id, valor, pedido_id,
      { numero: card.numero, nome: card.nome, mes: card.mes, ano: card.ano, cvv: card.cvv },
      { nome, cpf, cep: cep || "77000000", numeroEndereco: numero_endereco || "S/N", telefone }
    )

    // Salva payment_id para permitir estorno posterior
    await sb.from("pedidos").update({ asaas_payment_id: cobranca.id }).eq("id", pedido_id)

    const APROVADOS = ["CONFIRMED", "RECEIVED"]
    if (APROVADOS.includes(cobranca.status)) {
      await sb.from("pedidos").update({ status: "pendente" }).eq("id", pedido_id)
      return NextResponse.json({ ok: true })
    }

    // PENDING_WITH_ANALYSIS — aguarda confirmação pelo webhook
    if (cobranca.status === "PENDING") {
      return NextResponse.json({ ok: true, aguardando: true })
    }

    // Recusado
    await sb.from("pedidos").update({ status: "cancelado" }).eq("id", pedido_id)
    return NextResponse.json({ error: "Cartão recusado pela operadora" }, { status: 422 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao processar cartão"
    console.error("[Cartão]", msg)
    await sb.from("pedidos").update({ status: "cancelado" }).eq("id", pedido_id)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
