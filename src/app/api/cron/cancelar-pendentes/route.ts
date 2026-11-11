export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { desfazerCobrancas } from "@/lib/pagamentoDivididoServidor"
import { createClient } from "@supabase/supabase-js"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sb = adminSb()
  // Loja tem 15 min pra aceitar (Lucas, 19/10/2026; antes eram 5 min mas o cron só rodava
  // uma vez por dia, então na prática não cancelava). O cron agora roda a cada 2 min.
  const LIMITE_MIN = 15
  const limite = new Date(Date.now() - LIMITE_MIN * 60 * 1000).toISOString()

  // Busca pedidos pendentes (aguardando aceite do lojista) há mais de 15 minutos
  const { data: pendentes } = await sb
    .from("pedidos")
    .select("id, asaas_payment_id, asaas_payment_id_2, pagamentos_online_confirmados, status, forma_pagamento")
    .eq("status", "pendente")
    .lt("criado_em", limite)
    // Pix/cartão: o relógio começa quando o pagamento caiu (atualizado_em é gravado nessa hora
    // pelo webhook, pela verificação e pela confirmação manual), não quando o pedido foi criado.
    .lt("atualizado_em", limite)

  if (!pendentes?.length) return NextResponse.json({ ok: true, cancelados: 0 })

  let cancelados = 0
  for (const p of pendentes) {
    // Guarda atômica: só cancela (e só estorna) se o pedido ainda estiver "pendente"
    // no momento do UPDATE — evita cancelar/estornar em dobro se a loja aceitou o
    // pedido bem nesse intervalo, ou se o cron rodar em paralelo consigo mesmo.
    const { data: atualizado } = await sb.from("pedidos")
      .update({ status: "cancelado", cancelado_em: new Date().toISOString() })
      .eq("id", p.id)
      .eq("status", "pendente")
      .select("id")
      .maybeSingle()

    if (!atualizado) continue
    cancelados++

    // Estorna pagamentos feitos via PIX/cartão
    await desfazerCobrancas(p, "pendente")
  }

  console.log(`[cron] ${cancelados} pedido(s) cancelados por timeout`)
  return NextResponse.json({ ok: true, cancelados })
}
