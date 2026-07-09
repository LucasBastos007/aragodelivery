import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"

export async function GET(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data } = await sb.from("lojas")
    .select("status, plano, mensalidade_dia, mensalidade_paga_em")
    .eq("id", sess.loja_id)
    .single()

  if (!data) return NextResponse.json({ status: "ativo" })
  return NextResponse.json({ status: data.status, plano: data.plano })
}
