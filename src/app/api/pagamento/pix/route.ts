export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { criarCliente, criarPix, getPixQrCode, type AsaasSplit } from "@/lib/asaas"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const { pedido_id, valor, nome, telefone, email, cpf_cliente, loja_id } = await req.json()

  if (!pedido_id || !valor || !nome) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  const sb = adminSb()

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
      console.warn("[PIX] Loja sem subconta Asaas — split não aplicado:", loja_id)
    }
  }

  try {
    // Garante email válido para Asaas (exige CPF ou email)
    const emailFinal = email || `pedido_${pedido_id.replace(/-/g, "").slice(0, 12)}@chegodelivery.com`
    // cpf_cliente é opcional
    const cliente  = await criarCliente(nome, { cpf: cpf_cliente ?? undefined, email: emailFinal, telefone })
    const cobranca = await criarPix(cliente.id, valor, pedido_id, split)
    const qr       = await getPixQrCode(cobranca.id)

    // Salva payment_id, copia_cola e cpf_cliente no pedido para recuperação caso o usuário saia e volte
    await adminSb().from("pedidos").update({
      asaas_payment_id: cobranca.id,
      pix_copia_cola:   qr.payload,
      ...(cpf_cliente ? { cpf_cliente: cpf_cliente.replace(/\D/g, "") } : {}),
    }).eq("id", pedido_id)

    return NextResponse.json({
      payment_id: cobranca.id,
      qrcode:     qr.encodedImage,
      copia_cola: qr.payload,
      expira_em:  qr.expirationDate,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar PIX"
    console.error("[PIX]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
