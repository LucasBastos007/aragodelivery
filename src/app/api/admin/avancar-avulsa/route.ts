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

// Mesmas transições que o motoboy já usa em /api/motoboy/avancar-avulsa, só que sem exigir
// motoboy_id (admin pode destravar mesmo sem ser o motoboy responsável) — equivalente ao
// /api/admin/avancar-pedido que já existe pros pedidos normais.
const NEXT_STATUS: Record<string, string> = {
  aceito:   "coletado",
  coletado: "em_rota",
  em_rota:  "entregue",
}

export async function POST(req: NextRequest) {
  const sess = requireAdmin(req)
  if (!sess) return unauthorized()

  const { avulsa_id } = await req.json()
  if (!avulsa_id) return NextResponse.json({ error: "avulsa_id obrigatório" }, { status: 400 })

  const sb = adminClient()

  const { data: atual } = await sb.from("entregas_avulsas").select("id, status").eq("id", avulsa_id).single()
  if (!atual) return NextResponse.json({ error: "Entrega avulsa não encontrada" }, { status: 404 })

  const proximo = NEXT_STATUS[atual.status]
  if (!proximo) return NextResponse.json({ error: "Entrega não está numa etapa que pode ser avançada manualmente" }, { status: 422 })

  const { data, error } = await sb
    .from("entregas_avulsas")
    .update({ status: proximo })
    .eq("id", avulsa_id)
    .eq("status", atual.status)
    .select("id, codigo, status")
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erro ao avançar entrega" }, { status: 500 })

  return NextResponse.json({ ok: true, avulsa: data })
}
