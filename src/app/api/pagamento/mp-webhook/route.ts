export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { processarAvisoPagamento } from "@/lib/avisoPagamento"
import { assinaturaValida, buscarPagamentoMp, PREFIXO_MP } from "@/lib/mercadopago"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function GET() {
  return NextResponse.json({ received: true })
}

// Aviso do Mercado Pago. O corpo só diz "o pagamento X mudou"; a situação de verdade é
// sempre lida na API com o nosso token, e então tratada igual a um aviso do Asaas.
export async function POST(req: NextRequest) {
  if (!process.env.MP_ACCESS_TOKEN) {
    return NextResponse.json({ error: "Mercado Pago não configurado no servidor." }, { status: 500 })
  }
  const url = new URL(req.url)
  const body = await req.json().catch(() => null) as { type?: string; topic?: string; data?: { id?: string | number } } | null
  const tipo = body?.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic")
  const dataId = String(body?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "")
  if (tipo !== "payment" || !/^\d+$/.test(dataId)) return NextResponse.json({ received: true })

  if (!assinaturaValida(req.headers.get("x-signature"), req.headers.get("x-request-id"), url.searchParams.get("data.id") ?? dataId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let pag: Awaited<ReturnType<typeof buscarPagamentoMp>>
  try {
    pag = await buscarPagamentoMp(PREFIXO_MP + dataId)
  } catch (e) {
    // Pagamento que não existe na nossa conta (ex.: "Simular notificação" do painel do
    // Mercado Pago manda ids inventados): não há o que fazer, e 500 faria ele reenviar à toa.
    if (e instanceof Error && /not found/i.test(e.message)) {
      console.warn("[MP WEBHOOK] pagamento não existe na conta, ignorado", dataId)
      return NextResponse.json({ received: true, ignorado: "pagamento não encontrado" })
    }
    console.error("[MP WEBHOOK] não consegui ler o pagamento", dataId, e)
    // 500 faz o Mercado Pago reenviar o aviso mais tarde
    return NextResponse.json({ error: "Falha ao consultar o pagamento" }, { status: 500 })
  }

  return processarAvisoPagamento(adminSb(), {
    id: `${pag.id}_${pag.statusMp}`,
    event: pag.status,
    payment: { id: pag.id, externalReference: pag.externalReference, status: pag.status },
  }, "mercadopago")
}
