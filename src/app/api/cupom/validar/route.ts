export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// GET /api/cupom/validar?codigo=XXX&loja_id=YYY&subtotal=ZZZ
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const codigo   = searchParams.get("codigo")?.trim().toUpperCase()
  const loja_id  = searchParams.get("loja_id")
  const subtotal = parseFloat(searchParams.get("subtotal") ?? "0")

  if (!codigo) return NextResponse.json({ error: "Código obrigatório" }, { status: 400 })

  const client = sb()

  // Busca cupom global (loja_id nulo) ou da loja específica
  const queries = [
    client.from("cupons").select("id, codigo, tipo, valor, pedido_minimo, validade, ativo").eq("codigo", codigo).is("loja_id", null).eq("ativo", true).limit(1),
    ...(loja_id ? [client.from("cupons").select("id, codigo, tipo, valor, pedido_minimo, validade, ativo").eq("codigo", codigo).eq("loja_id", loja_id).eq("ativo", true).limit(1)] : []),
  ]
  const results = await Promise.all(queries)
  if (results.some(r => r.error)) {
    const err = results.find(r => r.error)?.error
    console.error("[cupom/validar]", err?.message)
    return NextResponse.json({ error: "Erro ao consultar cupom." }, { status: 500 })
  }
  const data = results.flatMap(r => r.data ?? [])

  const cupom = data?.[0]

  if (!cupom || !cupom.ativo) return NextResponse.json({ error: "Cupom inválido ou expirado." }, { status: 404 })
  if (cupom.validade && new Date(cupom.validade) < new Date()) return NextResponse.json({ error: "Este cupom expirou." }, { status: 422 })
  if (cupom.pedido_minimo > 0 && subtotal < cupom.pedido_minimo) {
    return NextResponse.json({ error: `Pedido mínimo de R$ ${Number(cupom.pedido_minimo).toFixed(2)} para este cupom.` }, { status: 422 })
  }

  return NextResponse.json({
    id:     cupom.id,
    codigo: cupom.codigo,
    tipo:   cupom.tipo,
    valor:  cupom.valor,
  })
}
