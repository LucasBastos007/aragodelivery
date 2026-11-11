export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { ehDividido, temForma, valorDaForma, colunaCobranca, confirmarCobranca } from "@/lib/pagamentoDividido"
import { criarCliente, criarPix, getPixQrCode, type AsaasSplit } from "@/lib/asaas"
import { pixNoMercadoPago, criarPixMp } from "@/lib/mercadopago"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const { pedido_id, nome, telefone, email, cpf_cliente, loja_id } = await req.json()

  if (!pedido_id || !nome) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  const sb = adminSb()

  // Valor sempre vem do pedido já validado no servidor — nunca confiar no que o
  // cliente manda no body, senão dá pra gerar um PIX de qualquer valor.
  const { data: pedidoDb } = await sb.from("pedidos")
    .select("total, forma_pagamento, forma_pagamento_2, valor_pagamento_1, valor_pagamento_2")
    .eq("id", pedido_id).single()
  if (!pedidoDb) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
  // Pagamento em 2 formas: cobra só a parte no Pix (ver lib/pagamentoDividido).
  const dividido = ehDividido(pedidoDb)
  if (dividido && !temForma(pedidoDb, "pix")) return NextResponse.json({ error: "Este pedido não tem parte no Pix." }, { status: 400 })
  const valor = dividido ? valorDaForma(pedidoDb, "pix") : pedidoDb.total
  const coluna = colunaCobranca(pedidoDb, "pix")

  const emailFinal = email || `pedido_${pedido_id.replace(/-/g, "").slice(0, 12)}@chegodelivery.com`

  // Pix pelo Mercado Pago (22/10/2026). Nenhuma loja usa subconta/split do Asaas, então não
  // há split a repassar aqui.
  if (pixNoMercadoPago()) {
    try {
      const pix = await criarPixMp(valor, pedido_id, { nome, email: emailFinal, cpf: cpf_cliente ?? undefined }, `pix-${pedido_id}-${coluna}-${valor}`)
      await sb.from("pedidos").update({
        [coluna]: pix.id,
        pix_copia_cola: pix.copiaCola,
        ...(cpf_cliente ? { cpf_cliente: cpf_cliente.replace(/\D/g, "") } : {}),
      }).eq("id", pedido_id)
      return NextResponse.json({ payment_id: pix.id, qrcode: pix.qrcode, copia_cola: pix.copiaCola, expira_em: pix.expiraEm })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar PIX"
      console.error("[PIX MP]", msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

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
    // Asaas exige CPF ou email: emailFinal garante um email válido
    // cpf_cliente é opcional
    const cliente  = await criarCliente(nome, { cpf: cpf_cliente ?? undefined, email: emailFinal, telefone })
    const cobranca = await criarPix(cliente.id, valor, pedido_id, split)
    const qr       = await getPixQrCode(cobranca.id)

    // Salva payment_id, copia_cola e cpf_cliente no pedido para recuperação caso o usuário saia e volte
    await adminSb().from("pedidos").update({
      [coluna]: cobranca.id,
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
