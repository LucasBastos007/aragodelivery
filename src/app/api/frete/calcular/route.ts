export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { calcularTaxaEntregaCompleta, EnderecoForaDoRaioError } from "@/lib/frete"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// GET /api/frete/calcular?loja_id=X&tipo_entrega=entrega&lat=Y&lng=Z&cidade=W&bairro=V
//
// Prévia da taxa de entrega pro checkout mostrar antes de confirmar o pedido — usa a MESMA
// função de /api/pedido/criar, então o valor mostrado aqui é sempre igual ao que será
// cobrado de fato (nunca diverge entre prévia e cobrança real).
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const loja_id = searchParams.get("loja_id")
  const tipo_entrega = searchParams.get("tipo_entrega") === "retirada" ? "retirada" : "entrega"
  const lat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null
  const lng = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : null
  const cidade = searchParams.get("cidade")
  const bairro = searchParams.get("bairro")
  const cliente_id = searchParams.get("cliente_id")

  if (!loja_id) return NextResponse.json({ error: "loja_id obrigatório" }, { status: 400 })

  const sb = adminClient()
  const { data: loja } = await sb.from("lojas").select("lat, lng, taxa_entrega").eq("id", loja_id).single()
  if (!loja) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 })

  try {
    const taxa = await calcularTaxaEntregaCompleta(sb, {
      loja_id,
      loja_lat: loja.lat,
      loja_lng: loja.lng,
      loja_taxa_base: (loja as any).taxa_entrega,
      tipo_entrega,
      lat_entrega: lat,
      lng_entrega: lng,
      cidade_entrega: cidade,
      bairro_entrega: bairro,
      cliente_id,
    })
    return NextResponse.json({ taxa_entrega: taxa })
  } catch (e) {
    if (e instanceof EnderecoForaDoRaioError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    throw e
  }
}
