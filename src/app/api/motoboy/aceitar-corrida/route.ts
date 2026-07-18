import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireMotoboy, unauthorized } from "@/lib/session"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const STATUSES_ATIVO = ["indo_para_loja", "na_loja", "em_rota", "coletado", "aguardando_aceite"]

export async function POST(req: NextRequest) {
  const _sess = requireMotoboy(req)
  if (!_sess) return unauthorized()
  const motoboy_id = _sess.motoboy_id

  const { pedido_id } = await req.json()
  if (!pedido_id) {
    return NextResponse.json({ error: "pedido_id obrigatório" }, { status: 400 })
  }

  const sb = adminClient()

  // Busca o limite de pedidos simultâneos configurado
  const { data: cfgRow } = await sb
    .from("configuracoes")
    .select("valor")
    .eq("chave", "max_pedidos_motoboy")
    .single()
  const maxPedidos = cfgRow ? parseInt(cfgRow.valor, 10) : 2

  // Conta pedidos ativos do motoboy
  const { count } = await sb
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("motoboy_id", motoboy_id)
    .in("status", STATUSES_ATIVO)

  if ((count ?? 0) >= maxPedidos) {
    return NextResponse.json({
      error: `Você já tem ${count} entrega${(count ?? 0) > 1 ? "s" : ""} ativa${(count ?? 0) > 1 ? "s" : ""}. Limite: ${maxPedidos}.`,
    }, { status: 422 })
  }

  // Bloqueia aceitação de pedidos de retirada
  const { data: chk } = await sb.from("pedidos").select("endereco_entrega").eq("id", pedido_id).single()
  if (chk?.endereco_entrega?.includes("Retirada")) {
    return NextResponse.json({ error: "Pedido de retirada — sem entregador necessário" }, { status: 422 })
  }

  // Atualização atômica: aceita se ainda aguardando E (broadcast sem dono OU designado a este motoboy)
  const { data, error } = await sb
    .from("pedidos")
    .update({ status: "indo_para_loja", motoboy_id })
    .eq("id", pedido_id)
    .eq("status", "aguardando_aceite")
    .or(`motoboy_id.is.null,motoboy_id.eq.${motoboy_id}`)
    .select("id, status")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Corrida não disponível" }, { status: 409 })
  }

  return NextResponse.json({ ok: true })
}
