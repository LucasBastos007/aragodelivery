export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, requireLoja, unauthorized } from "@/lib/session"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function GET(req: NextRequest) {
  const sessAdmin = requireAdmin(req)
  const sessLoja  = !sessAdmin ? requireLoja(req) : null
  if (!sessAdmin && !sessLoja) return unauthorized()

  const { searchParams } = new URL(req.url)
  const status     = searchParams.get("status")
  const pedido_id  = searchParams.get("pedido_id")

  const sb = adminSb()

  if (sessLoja) {
    // Loja: busca pedidos da loja e depois reembolsos desses pedidos
    const { data: pedidosLoja } = await sb
      .from("pedidos")
      .select("id")
      .eq("loja_id", sessLoja.loja_id)

    const pedidoIds = (pedidosLoja ?? []).map((p: any) => p.id)
    if (pedidoIds.length === 0) return NextResponse.json({ reembolsos: [] })

    let q = sb
      .from("reembolsos")
      .select("*, pedido:pedidos(id, codigo, total, nome_cliente, forma_pagamento)")
      .in("pedido_id", pedidoIds)
      .order("solicitado_em", { ascending: false })
      .limit(100)

    if (status) q = q.eq("status", status) as any
    if (pedido_id) q = q.eq("pedido_id", pedido_id) as any

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ reembolsos: data ?? [] })
  }

  // Admin: vê todos
  let q = sb
    .from("reembolsos")
    .select("*, pedido:pedidos(id, codigo, total, nome_cliente, forma_pagamento, loja:lojas(nome))")
    .order("solicitado_em", { ascending: false })
    .limit(200)

  if (status) q = q.eq("status", status) as any
  if (pedido_id) q = q.eq("pedido_id", pedido_id) as any

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reembolsos: data ?? [] })
}
