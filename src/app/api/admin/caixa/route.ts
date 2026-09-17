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

export async function GET(req: NextRequest) {
  const sess = requireAdmin(req)
  if (!sess) return unauthorized()

  const { searchParams } = new URL(req.url)
  const dias = Number(searchParams.get("dias") ?? "30")

  const desde = new Date()
  desde.setDate(desde.getDate() - dias)

  const { data, error } = await adminClient()
    .from("motoboy_caixa")
    .select("id, valor, observacao, criado_em, motoboy:motoboys(id, nome)")
    .gte("criado_em", desde.toISOString())
    .order("criado_em", { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ declaracoes: data ?? [] })
}
