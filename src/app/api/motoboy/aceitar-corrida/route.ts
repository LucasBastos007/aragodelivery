import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const { pedido_id, motoboy_id } = await req.json()
  if (!pedido_id || !motoboy_id) {
    return NextResponse.json({ error: "pedido_id e motoboy_id obrigatórios" }, { status: 400 })
  }

  const sb = adminClient()

  // Atualização atômica: só aceita se ainda estiver em aguardando_aceite
  const { data, error } = await sb
    .from("pedidos")
    .update({ status: "indo_para_loja", motoboy_id })
    .eq("id", pedido_id)
    .eq("status", "aguardando_aceite")
    .select("id, status")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Se 0 linhas foram atualizadas, outro motoboy já aceitou (ou status mudou)
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Corrida não disponível" }, { status: 409 })
  }

  return NextResponse.json({ ok: true })
}
