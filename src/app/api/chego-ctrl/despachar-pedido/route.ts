export const dynamic = "force-dynamic"
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

// Faltava — a tela de Despacho ao Vivo (chego-ctrl/despacho) já tinha o botão "Despachar"
// e o modal de escolha de motoboy prontos, mas chamavam essa rota, que nunca foi criada
// (achado real: pedido TSB96B precisou ser atribuído manualmente por script em 2026-09-24
// porque o botão dava 404). Mesmo efeito de quando o motoboy aceita uma oferta sozinho —
// só que aqui é o admin quem escolhe direto, por isso "aguardando_aceite" (não
// "indo_para_loja"): o motoboy ainda recebe o push e confirma no próprio app, entra pelo
// mesmo fluxo de sempre (ver STATUSES_ATIVO/OR em /api/motoboy/aceitar-corrida, que já
// aceita pedido "designado a este motoboy_id").
export async function POST(req: NextRequest) {
  const sess = requireAdmin(req)
  if (!sess) return unauthorized()

  const { pedido_id, motoboy_id } = await req.json()
  if (!pedido_id || !motoboy_id) {
    return NextResponse.json({ error: "pedido_id e motoboy_id obrigatórios" }, { status: 400 })
  }

  const sb = adminClient()

  // Atômico: só despacha se o pedido ainda estiver "pronto" e sem motoboy — evita dois
  // admins despachando o mesmo pedido pra pessoas diferentes ao mesmo tempo (a tela
  // já trata 409 como "outro admin despachou primeiro").
  const { data, error } = await sb
    .from("pedidos")
    .update({ status: "aguardando_aceite", motoboy_id })
    .eq("id", pedido_id)
    .eq("status", "pronto")
    .is("motoboy_id", null)
    .select("id, codigo")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Pedido não está mais disponível pra despacho" }, { status: 409 })
  }

  return NextResponse.json({ ok: true })
}
