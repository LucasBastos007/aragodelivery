export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { criarCliente, criarPix, getPixQrCode } from "@/lib/asaas"

export async function POST(req: NextRequest) {
  const { pedido_id, valor, nome, telefone, email } = await req.json()

  if (!pedido_id || !valor || !nome) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  try {
    const cliente  = await criarCliente(nome, { email, telefone })
    const cobranca = await criarPix(cliente.id, valor, pedido_id)
    const qr       = await getPixQrCode(cobranca.id)

    return NextResponse.json({
      payment_id: cobranca.id,
      qrcode:     qr.encodedImage,  // PNG em base64
      copia_cola: qr.payload,
      expira_em:  qr.expirationDate,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar PIX"
    console.error("[PIX]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
