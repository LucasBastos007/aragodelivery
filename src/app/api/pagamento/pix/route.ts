export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { criarCliente, criarPix, getPixQrCode } from "@/lib/asaas"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function gerarCpfValido(): string {
  const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9))
  let s = d.reduce((a, v, i) => a + v * (10 - i), 0)
  const c1 = ((s * 10) % 11) % 10
  s = [...d, c1].reduce((a, v, i) => a + v * (11 - i), 0)
  const c2 = ((s * 10) % 11) % 10
  return [...d, c1, c2].join("")
}

export async function POST(req: NextRequest) {
  const { pedido_id, valor, nome, telefone, email } = await req.json()

  if (!pedido_id || !valor || !nome) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  const cpf = gerarCpfValido()

  try {
    const cliente  = await criarCliente(nome, { cpf, email, telefone })
    const cobranca = await criarPix(cliente.id, valor, pedido_id)
    const qr       = await getPixQrCode(cobranca.id)

    // Salva o payment_id no pedido para permitir estorno posterior
    await adminSb().from("pedidos").update({ asaas_payment_id: cobranca.id }).eq("id", pedido_id)

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
