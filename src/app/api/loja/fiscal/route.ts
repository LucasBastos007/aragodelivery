export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const CAMPOS = [
  "inscricao_estadual",
  "inscricao_municipal",
  "regime_tributario",
  "cnae",
  "nfce_serie",
] as const

export async function GET(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()

  const { data, error } = await sb()
    .from("lojas")
    .select("inscricao_estadual, inscricao_municipal, regime_tributario, cnae, nfce_serie, fiscal_ativo, cnpj")
    .eq("id", sess.loja_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()

  const body = await req.json()

  const update: Record<string, unknown> = {}
  for (const campo of CAMPOS) {
    if (campo in body) update[campo] = body[campo] ?? null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido" }, { status: 400 })
  }

  const regimes = ["mei", "simples", "lucro_presumido", "lucro_real", null]
  if ("regime_tributario" in update && !regimes.includes(update.regime_tributario as string | null)) {
    return NextResponse.json({ error: "Regime tributário inválido" }, { status: 400 })
  }

  const { error } = await sb().from("lojas").update(update).eq("id", sess.loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
