import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// GET — lista pedidos travados (em_rota, na_loja, indo_para_loja) há mais de 2h
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const sb = adminClient()
  const { data, error } = await sb
    .from("pedidos")
    .select("id, codigo, status, criado_em, motoboy_id")
    .in("status", ["indo_para_loja", "na_loja", "em_rota", "coletado"])
    .order("criado_em", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pedidos: data })
}

// POST — força conclusão pelo codigo ou pelo id
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()

  const body = await req.json()
  const { codigo, pedido_id } = body
  if (!codigo && !pedido_id) return NextResponse.json({ error: "codigo ou pedido_id obrigatório" }, { status: 400 })

  const sb = adminClient()

  let pedido: { id: string; status: string; codigo: string } | null = null

  if (pedido_id) {
    const { data } = await sb.from("pedidos").select("id, status, codigo").eq("id", pedido_id).single()
    pedido = data
  } else {
    // Tenta como texto e como número
    const { data: d1 } = await sb.from("pedidos").select("id, status, codigo").eq("codigo", String(codigo)).maybeSingle()
    pedido = d1
  }

  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })

  const { error } = await sb.from("pedidos").update({ status: "entregue" }).eq("id", pedido.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, pedido_id: pedido.id, codigo: pedido.codigo })
}
