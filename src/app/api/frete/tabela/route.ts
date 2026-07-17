import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function GET(req: NextRequest) {
  const loja_id = req.nextUrl.searchParams.get("loja_id")
  if (!loja_id) return NextResponse.json([])

  const { data } = await adminClient()
    .from("tabela_frete")
    .select("municipio, taxa")
    .eq("loja_id", loja_id)

  return NextResponse.json(data ?? [])
}
