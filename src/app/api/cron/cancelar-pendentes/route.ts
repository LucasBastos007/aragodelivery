export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { estornarPagamento, cancelarPagamento } from "@/lib/asaas"

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
  const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  // Busca pedidos pendentes (aguardando aceite do lojista) há mais de 5 minutos
  const { data: pendentes } = await sb
    .from("pedidos")
    .select("id, asaas_payment_id, status, forma_pagamento")
    .eq("status", "pendente")
    .lt("criado_em", cincoMinAtras)

  if (!pendentes?.length) return NextResponse.json({ ok: true, cancelados: 0 })

  let cancelados = 0
  for (const p of pendentes) {
    await sb.from("pedidos").update({ status: "cancelado" }).eq("id", p.id)
    cancelados++

    // Estorna pagamentos feitos via PIX/cartão
    if (p.asaas_payment_id) {
      try {
        await estornarPagamento(p.asaas_payment_id)
      } catch {
        try { await cancelarPagamento(p.asaas_payment_id) } catch {}
      }
    }
  }

  console.log(`[cron] ${cancelados} pedido(s) cancelados por timeout`)
  return NextResponse.json({ ok: true, cancelados })
}
