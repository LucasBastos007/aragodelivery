export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { notificarMotoboysDisponiveisAvulsa, avisarMotoboyPerdeuAvulsa } from "@/lib/notificacoesMotoboy"

// Equivalente de src/app/api/escalada/route.ts (pedidos normais), pra entrega avulsa —
// faltava por completo: o Kanban admin (chego-ctrl/pedidos) já tem o botão "🛵 Chamar
// outro" nos cards de pedido normal, mas os cards de entrega avulsa não tinham nada
// parecido — só dava pra esperar o motoboy já designado aceitar/agir, sem jeito de
// admin reabrir a corrida pra outros motoboys se ele sumir. Pedido explícito do
// usuário, 2026-09-24.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const sess = requireAdmin(req)
  if (!sess) return unauthorized()

  const { avulsa_id } = await req.json()
  if (!avulsa_id) return NextResponse.json({ error: "avulsa_id obrigatório" }, { status: 400 })

  const sb = adminClient()
  const { data: entrega, error } = await sb
    .from("entregas_avulsas")
    .select("id, codigo, status, motoboy_id, taxa_entrega")
    .eq("id", avulsa_id)
    .single()
  if (error || !entrega) return NextResponse.json({ error: "Entrega avulsa não encontrada" }, { status: 404 })

  // "aguardando" (ninguém aceitou ainda) e "aceito" (motoboy designado, mas ainda não
  // coletou) são as únicas etapas em que reabrir pra outros motoboys faz sentido — a
  // partir de "coletado" a entrega já está fisicamente com o motoboy (mesma regra já
  // usada em /api/escalada pros pedidos normais).
  if (!["aguardando", "aceito"].includes(entrega.status)) {
    return NextResponse.json({ ok: true, msg: "status não elegível para nova chamada" })
  }

  const motoboyAnterior = entrega.motoboy_id

  // Atômico: só limpa/reabre se ainda estiver no mesmo status lido acima — evita que
  // dois cliques de "chamar outro" (ou um clique + o motoboy aceitando ao mesmo tempo)
  // reabram a mesma entrega duas vezes.
  const { data: atualizado } = await sb
    .from("entregas_avulsas")
    .update({ status: "aguardando", motoboy_id: null, motoboy_nome: null })
    .eq("id", avulsa_id)
    .eq("status", entrega.status)
    .select("id")

  if (!atualizado || atualizado.length === 0) {
    return NextResponse.json({ ok: true, msg: "outro admin já chamou outro motoboy" })
  }

  if (motoboyAnterior) {
    await avisarMotoboyPerdeuAvulsa(sb, motoboyAnterior, entrega.codigo).catch(() => {})
  }

  await notificarMotoboysDisponiveisAvulsa(sb, {
    avulsa_id: entrega.id,
    codigo: entrega.codigo,
    taxa_entrega: entrega.taxa_entrega ?? 0,
    excluirIds: motoboyAnterior ? [motoboyAnterior] : [],
  })

  return NextResponse.json({ ok: true })
}
