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

// Avança as etapas que normalmente dependem do lojista (pendente → aceito → preparando →
// pronto) — pra admin destravar um pedido quando a loja está lenta/off. As etapas seguintes
// (aguardando_aceite em diante) dependem de um motoboy de verdade e usam /api/escalada e
// /api/admin/completar-pedido, não este endpoint.
const PROXIMO_STATUS: Record<string, string> = {
  pendente:   "aceito",
  aceito:     "preparando",
  preparando: "pronto",
}

export async function POST(req: NextRequest) {
  const sess = requireAdmin(req)
  if (!sess) return unauthorized()

  const { pedido_id } = await req.json()
  if (!pedido_id) return NextResponse.json({ error: "pedido_id obrigatório" }, { status: 400 })

  const sb = adminClient()

  const { data: pedidoAtual } = await sb.from("pedidos").select("id, status").eq("id", pedido_id).single()
  if (!pedidoAtual) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })

  const proximo = PROXIMO_STATUS[pedidoAtual.status]
  if (!proximo) return NextResponse.json({ error: "Pedido não está numa etapa que pode ser avançada manualmente" }, { status: 422 })

  const extras: Record<string, any> = {}
  if (proximo === "aceito")  extras.aceito_em = new Date().toISOString()
  if (proximo === "pronto")  extras.pronto_em = new Date().toISOString()

  const { data, error } = await sb
    .from("pedidos")
    .update({ status: proximo, ...extras })
    .eq("id", pedido_id)
    .eq("status", pedidoAtual.status)
    .select("id, codigo, status")
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erro ao avançar pedido" }, { status: 500 })

  return NextResponse.json({ ok: true, pedido: data })
}
