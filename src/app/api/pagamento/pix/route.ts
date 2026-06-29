export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { criarCliente, criarPix, getPixQrCode } from "@/lib/asaas"

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
