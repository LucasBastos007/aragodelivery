export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { promoAtiva } from "@/lib/promoChego"
import { promoUsados } from "@/lib/promoChegoServidor"

// Promoção Chegô 10% (09/11/2026): produtos da promoção que o cliente LOGADO já usou, pra o app
// mostrar o preço normal nessas lojas. Usa a conta do token, nunca um id ou telefone da URL.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

export async function GET(req: NextRequest) {
  if (!promoAtiva()) return NextResponse.json({ usados: [] })
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!token) return NextResponse.json({ usados: [] }, { status: 401 })
  const { data: u } = await sb.auth.getUser(token)
  if (!u?.user) return NextResponse.json({ usados: [] }, { status: 401 })
  const { data: cli } = await sb.from("clientes").select("telefone").eq("id", u.user.id).maybeSingle()
  return NextResponse.json({ usados: await promoUsados(sb, u.user.id, cli?.telefone ?? null) })
}
