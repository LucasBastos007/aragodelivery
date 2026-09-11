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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// GET /api/cupom/validar?codigo=XXX&loja_id=YYY&subtotal=ZZZ&lat=AA&lng=BB
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const codigo   = searchParams.get("codigo")?.trim().toUpperCase()
  const loja_id  = searchParams.get("loja_id")
  const subtotal = parseFloat(searchParams.get("subtotal") ?? "0")
  const lat      = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null
  const lng      = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : null

  if (!codigo) return NextResponse.json({ error: "Código obrigatório" }, { status: 400 })

  const client = sb()

  // Busca só pelo código — elegibilidade por loja/raio é decidida abaixo, porque um cupom
  // pode valer por loja_id único, por uma lista (lojas_ids) ou global.
  const { data: cupom, error } = await client
    .from("cupons")
    .select("id, codigo, tipo, valor, pedido_minimo, validade, ativo, usos, max_usos, loja_id, lojas_ids, centro_lat, centro_lng, raio_km")
    .eq("codigo", codigo)
    .eq("ativo", true)
    .maybeSingle()

  if (error) {
    console.error("[cupom/validar]", error.message)
    return NextResponse.json({ error: "Erro ao consultar cupom." }, { status: 500 })
  }

  if (!cupom || !cupom.ativo) return NextResponse.json({ error: "Cupom inválido ou expirado." }, { status: 404 })

  const valeParaLoja =
    (!cupom.loja_id && !(cupom.lojas_ids?.length)) ||
    cupom.loja_id === loja_id ||
    (loja_id != null && (cupom.lojas_ids ?? []).includes(loja_id))
  if (!valeParaLoja) return NextResponse.json({ error: "Cupom não é válido para esta loja." }, { status: 422 })

  if (cupom.raio_km != null && cupom.centro_lat != null && cupom.centro_lng != null) {
    if (lat == null || lng == null || haversineKm(cupom.centro_lat, cupom.centro_lng, lat, lng) > cupom.raio_km) {
      return NextResponse.json({ error: "Cupom não é válido para o seu endereço de entrega." }, { status: 422 })
    }
  }

  if (cupom.validade && new Date(cupom.validade) < new Date()) return NextResponse.json({ error: "Este cupom expirou." }, { status: 422 })
  if (cupom.max_usos != null && (cupom.usos ?? 0) >= cupom.max_usos) {
    return NextResponse.json({ error: "Este cupom já atingiu o limite de usos." }, { status: 422 })
  }
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
