export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const sb = adminSb()
  const { data } = await sb.from("configuracoes").select("chave, valor")
  const cfg: Record<string, string> = {}
  for (const row of data ?? []) cfg[row.chave] = row.valor
  return NextResponse.json({ configuracoes: cfg })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const updates = await req.json() as Record<string, string>
  const sb = adminSb()

  const rows = Object.entries(updates).map(([chave, valor]) => ({
    chave,
    valor: String(valor),
    atualizado_em: new Date().toISOString(),
  }))

  const { error } = await sb.from("configuracoes").upsert(rows, { onConflict: "chave" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
