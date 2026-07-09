import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// POST /api/chego-ctrl/presencial
// Body: { tipo: "loja" | "motoboy", id: string }
// Marca o contrato como assinado presencialmente (ação do admin)
export async function POST(req: NextRequest) {
  try {
    const { tipo, id } = await req.json()
    if (!tipo || !id) {
      return NextResponse.json({ error: "tipo e id obrigatórios" }, { status: 400 })
    }
    const tabela = tipo === "loja" ? "lojas" : "motoboys"

    const { error } = await admin().from(tabela).update({
      contrato_assinado:     true,
      contrato_assinado_em:  new Date().toISOString(),
      modalidade_assinatura: "presencial",
      status:                "contrato_assinado",
    }).eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
