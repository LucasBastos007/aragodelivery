export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { calcularTaxaEntregaCompleta, coordsPeloHistorico, distanciaEntregaKm, EnderecoForaDoRaioError } from "@/lib/frete"
import { freteGratisAtivo, freteGratisElegivel } from "@/lib/freteGratisCampanha"
import { acrescimoDinamico } from "@/lib/corridaDinamica"

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
  const zona_rural = searchParams.get("zona_rural") === "1"

  if (!loja_id) return NextResponse.json({ error: "loja_id obrigatório" }, { status: 400 })

  const sb = adminClient()
  const { data: loja } = await sb.from("lojas").select("lat, lng, taxa_entrega").eq("id", loja_id).single()
  if (!loja) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 })

  // Endereço de sempre do cliente: usa a coordenada das entregas anteriores (ver coordsPeloHistorico)
  const coords = tipo_entrega === "entrega" ? await coordsPeloHistorico(sb, { cliente_id, bairro, cidade, lat, lng, loja_lat: loja.lat, loja_lng: loja.lng }) : { lat, lng }
  const detalhe: { distancia_km?: number | null; fonte?: string } = {}
  try {
    const taxa = await calcularTaxaEntregaCompleta(sb, {
      loja_id,
      loja_lat: loja.lat,
      loja_lng: loja.lng,
      loja_taxa_base: (loja as any).taxa_entrega,
      tipo_entrega,
      lat_entrega: coords.lat,
      lng_entrega: coords.lng,
      cidade_entrega: cidade,
      bairro_entrega: bairro,
      cliente_id,
      zona_rural,
      exigir_ponto_rural: true,
    }, detalhe)
    // Frete grátis do aniversário de Aragoiânia: mesma regra do /api/pedido/criar (lib/freteGratisCampanha)
    let frete_gratis = false
    if (tipo_entrega === "entrega" && taxa > 0 && freteGratisAtivo()) {
      const dist = detalhe.distancia_km ?? await distanciaEntregaKm(loja.lat, loja.lng, coords.lat, coords.lng)
      frete_gratis = freteGratisElegivel({ distanciaKm: dist, lojaLat: loja.lat, lojaLng: loja.lng, latEntrega: coords.lat, lngEntrega: coords.lng })
    }
    // Corrida dinâmica vem separada pro checkout mostrar a linha própria (mesma regra do criar)
    return NextResponse.json({ taxa_entrega: taxa, frete_gratis, taxa_dinamica: await acrescimoDinamico(sb, tipo_entrega) })
  } catch (e) {
    if (e instanceof EnderecoForaDoRaioError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    throw e
  }
}
