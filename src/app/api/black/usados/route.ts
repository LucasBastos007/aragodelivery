export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { blackAtiva } from "@/lib/blackFriday"
import { blackLojasCheias, blackSuspensa } from "@/lib/blackFridayServidor"

// Black Friday Chegô: (1) se a campanha foi suspensa pelo admin (vale pra todos, até sem login) e
// (2) lojas em que o cliente LOGADO já usou as 2 compras promocionais. Usa a conta do token, nunca
// id/telefone da URL.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

export async function GET(req: NextRequest) {
  if (!blackAtiva()) return NextResponse.json({ cheias: [], suspensa: false })
  const suspensa = await blackSuspensa(sb)
  if (suspensa) return NextResponse.json({ cheias: [], suspensa: true })
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!token) return NextResponse.json({ cheias: [], suspensa: false })
  const { data: u } = await sb.auth.getUser(token)
  if (!u?.user) return NextResponse.json({ cheias: [], suspensa: false })
  const { data: cli } = await sb.from("clientes").select("telefone").eq("id", u.user.id).maybeSingle()
  const cheias = await blackLojasCheias(sb, u.user.id, cli?.telefone ?? null)
  return NextResponse.json({ cheias: [...cheias], suspensa: false })
}
