export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, requireLoja } from "@/lib/session"
import { emitirNfcePedido } from "@/lib/emitir-nfce"

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// POST /api/pedido/emitir-nfce
// Body: { pedido_id }
// Acessível por admin ou pelo próprio lojista (para reemissão)
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req)
  const loja  = requireLoja(req)
  if (!admin && !loja) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { pedido_id } = await req.json()
  if (!pedido_id) return NextResponse.json({ error: "pedido_id obrigatório" }, { status: 400 })

  const client = sb()

  // Lojista só pode emitir nota dos próprios pedidos
  if (loja && !admin) {
    const { data: ped } = await client
      .from("pedidos")
      .select("loja_id")
      .eq("id", pedido_id)
      .single()
    if (ped?.loja_id !== loja.loja_id) {
      return NextResponse.json({ error: "Pedido não pertence à sua loja" }, { status: 403 })
    }
  }

  const result = await emitirNfcePedido(pedido_id, client)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({ ok: true, ref: result.ref })
}
