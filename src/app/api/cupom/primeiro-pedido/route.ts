export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { jaFezPedido } from "@/lib/primeiroPedido"

// Faixa "primeiro pedido com frete grátis" da tela inicial (31/10/2026): diz se o cliente
// LOGADO ainda não tem pedido. Usa o telefone da própria conta (token do login), nunca um
// telefone vindo da URL, pra não virar consulta de "esse número já pediu?".
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!token) return NextResponse.json({ elegivel: false }, { status: 401 })
  const { data: u } = await sb.auth.getUser(token)
  if (!u?.user) return NextResponse.json({ elegivel: false }, { status: 401 })
  const { data: cli } = await sb.from("clientes").select("id, telefone").eq("id", u.user.id).maybeSingle()
  const tel = String(cli?.telefone ?? "").replace(/\D/g, "")
  if (tel.length < 10) return NextResponse.json({ elegivel: false })
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
  const { data: cupom } = await sb.from("cupons").select("codigo, pedido_minimo, validade").eq("so_primeiro_pedido", true).eq("ativo", true)
    .or(`validade.is.null,validade.gte.${hoje}`).order("criado_em", { ascending: false }).limit(1).maybeSingle()
  if (!cupom) return NextResponse.json({ elegivel: false })
  if (await jaFezPedido(sb, tel, cli?.id)) return NextResponse.json({ elegivel: false })
  return NextResponse.json({ elegivel: true, codigo: cupom.codigo, minimo: Number(cupom.pedido_minimo ?? 0) })
}
