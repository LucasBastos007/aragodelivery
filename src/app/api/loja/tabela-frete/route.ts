import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function GET(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()

  const { data, error } = await adminClient()
    .from("tabela_frete")
    .select("municipio, taxa, tipo")
    .eq("loja_id", sess.loja_id)
    .order("municipio")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// Frete é definido pelo Chegô, não pelo lojista (pedido do Lucas, 20/10/2026). A loja só
// consulta a tabela (GET, usado como sugestão de bairro na entrega avulsa).
const SO_CHEGO = "A taxa de entrega é definida pelo Chegô. Fale com o suporte pra mudar."
export async function POST(req: NextRequest) {
  if (!requireLoja(req)) return unauthorized()
  return NextResponse.json({ error: SO_CHEGO }, { status: 403 })
}

export async function DELETE(req: NextRequest) {
  if (!requireLoja(req)) return unauthorized()
  return NextResponse.json({ error: SO_CHEGO }, { status: 403 })
}
