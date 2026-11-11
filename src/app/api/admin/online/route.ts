export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"

// Quem avisou nos últimos 2 min (ver /api/online), separado pela tela em que está.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const { data, error } = await sb.from("online_agora").select("tela").gte("visto_em", new Date(Date.now() - 120_000).toISOString()).limit(5000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const por = { lojas: 0, checkout: 0, pedido: 0 } as Record<string, number>
  for (const r of data ?? []) por[r.tela ?? "lojas"] = (por[r.tela ?? "lojas"] ?? 0) + 1
  return NextResponse.json({ total: data?.length ?? 0, ...por })
}
