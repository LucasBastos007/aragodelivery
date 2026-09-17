export const dynamic = "force-dynamic"
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

// Feature "CAIXA" pedida pelo time em 2026-09-17: motoboy declara quanto dinheiro
// tem em mãos ao parar de entregar no dia. Fica gravado pra virar relatório do ADMIN.
export async function POST(req: NextRequest) {
  const sess = requireMotoboy(req)
  if (!sess) return unauthorized()

  const { valor, observacao } = await req.json()
  const v = Number(valor)
  if (!Number.isFinite(v) || v < 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
  }

  const { error } = await adminClient()
    .from("motoboy_caixa")
    .insert({ motoboy_id: sess.motoboy_id, valor: v, observacao: (observacao ?? "").trim() || null })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const sess = requireMotoboy(req)
  if (!sess) return unauthorized()

  const { data, error } = await adminClient()
    .from("motoboy_caixa")
    .select("id, valor, observacao, criado_em")
    .eq("motoboy_id", sess.motoboy_id)
    .order("criado_em", { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ declaracoes: data ?? [] })
}
