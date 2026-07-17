import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const TIPOS = ["acesso", "cadastro", "pedido"] as const

export async function POST(req: NextRequest) {
  try {
    const { tipo } = await req.json()
    if (!TIPOS.includes(tipo)) return NextResponse.json({ ok: false })
    await sb.from("acessos_app").insert({ tipo })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
