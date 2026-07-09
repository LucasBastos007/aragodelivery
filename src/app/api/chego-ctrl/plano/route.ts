import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { criarCliente, criarAssinatura, cancelarAssinatura } from "@/lib/asaas"

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLANO_VALOR: Record<string, number> = {
  select: 149,
  prime:  497,
  black:  997,
}

const PLANO_LABEL: Record<string, string> = {
  select: "Select",
  prime:  "Prime",
  black:  "Black",
}

export async function POST(req: NextRequest) {
  try {
    const { loja_id, plano } = await req.json() as { loja_id: string; plano: string | null }

    const { data: loja, error: lerr } = await admin
      .from("lojas").select("*").eq("id", loja_id).single()
    if (lerr || !loja) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 })

    // Cancela assinatura anterior se houver
    if (loja.asaas_subscription_id) {
      try { await cancelarAssinatura(loja.asaas_subscription_id) } catch {}
    }

    // Remover plano
    if (!plano || plano === "none") {
      await admin.from("lojas").update({
        plano: null,
        plano_ativo_desde: null,
        asaas_subscription_id: null,
      }).eq("id", loja_id)
      return NextResponse.json({ ok: true })
    }

    // Plano Gold: só comissão, sem assinatura
    if (plano === "gold") {
      await admin.from("lojas").update({
        plano: "gold",
        plano_ativo_desde: new Date().toISOString(),
        comissao: 10,
        asaas_subscription_id: null,
      }).eq("id", loja_id)
      return NextResponse.json({ ok: true })
    }

    // Planos com mensalidade fixa (select/prime/black)
    let customerId: string = loja.asaas_customer_id
    if (!customerId) {
      const cliente = await criarCliente(loja.nome_responsavel || loja.nome, {
        cpf:      loja.cpf_responsavel,
        email:    loja.email,
        telefone: loja.telefone,
      })
      customerId = cliente.id
    }

    const valor = PLANO_VALOR[plano]
    const sub = await criarAssinatura(
      customerId,
      valor,
      `Plano ${PLANO_LABEL[plano]} - Chegô Delivery`,
    )

    await admin.from("lojas").update({
      plano,
      plano_ativo_desde:     new Date().toISOString(),
      comissao:              0,
      asaas_customer_id:     customerId,
      asaas_subscription_id: sub.id,
    }).eq("id", loja_id)

    return NextResponse.json({ ok: true, subscription_id: sub.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
