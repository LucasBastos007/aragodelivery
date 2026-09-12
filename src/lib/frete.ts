import type { SupabaseClient } from "@supabase/supabase-js"
import { distanciaRotaKm } from "@/lib/rota"

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Distância real de rota (Mapbox) sempre que disponível — cai pra linha reta se a API
// falhar, não tiver token configurado, ou responder fora do tempo. Nunca bloqueia o pedido.
async function calcularTaxaPorDistancia(latLoja: number | null, lngLoja: number | null, latCliente: number | null, lngCliente: number | null, base = 6.00): Promise<number> {
  if (!latLoja || !lngLoja || !latCliente || !lngCliente) return base
  const distRota = await distanciaRotaKm({ lat: latLoja, lng: lngLoja }, { lat: latCliente, lng: lngCliente })
  const dist = distRota ?? haversineKm(latLoja, lngLoja, latCliente, lngCliente)
  if (dist <= 6) return base
  return Math.round((base + (dist - 6) * 1.00) * 100) / 100
}

// Sem tabela fixa pro município, um endereço geocodificado errado (nome de rua comum
// casando com outra cidade distante, bias de busca ruim, GPS impreciso etc.) pode gerar
// uma distância absurda e cobrar uma taxa gigante do cliente sem ninguém perceber até o
// motoboy reclamar — foi exatamente o que aconteceu no pedido JZ89NC (2026-09-12): R$79,89
// de frete pra um endereço que devia ser R$4,00, por causa de uma coordenada de viés de
// geocodificação errada (ver LAT_DEFAULT em checkout/page.tsx). Acima desse raio sem tabela
// fixa cadastrada, rejeita em vez de cobrar.
export const RAIO_MAXIMO_KM = 30
export class EnderecoForaDoRaioError extends Error {
  constructor(public distanciaKm: number) {
    super(`Endereço fora da área de entrega (${distanciaKm.toFixed(0)}km da loja). Confira se o endereço está correto.`)
  }
}

function normalizar(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
}

function buscarTabelaFrete(tabela: { municipio: string; taxa: number }[], nome: string): number | null {
  if (!nome) return null
  const n = normalizar(nome)
  for (const entry of tabela) {
    const e = normalizar(entry.municipio)
    if (n.includes(e) || e.includes(n)) return entry.taxa
  }
  return null
}

/**
 * Calcula a taxa de entrega final — mesma fórmula usada tanto na prévia do checkout
 * (/api/frete/calcular) quanto na criação real do pedido (/api/pedido/criar), pra nunca
 * divergir entre o que o cliente vê antes de confirmar e o que é cobrado de fato.
 *
 * Prioridade: retirada (R$0) > tabela fixa por município > distância de rota real
 * (com fallback pra linha reta) > nunca negativa.
 */
export async function calcularTaxaEntregaCompleta(
  sb: SupabaseClient,
  params: {
    loja_id: string
    loja_lat: number | null
    loja_lng: number | null
    loja_taxa_base?: number | null
    tipo_entrega: "entrega" | "retirada"
    lat_entrega: number | null
    lng_entrega: number | null
    cidade_entrega?: string | null
    bairro_entrega?: string | null
  }
): Promise<number> {
  if (params.tipo_entrega === "retirada") return 0

  const { data: tabelaFrete } = await sb
    .from("tabela_frete")
    .select("municipio, taxa")
    .eq("loja_id", params.loja_id)

  const taxaFixa = buscarTabelaFrete(tabelaFrete ?? [], params.cidade_entrega ?? "")
    ?? buscarTabelaFrete(tabelaFrete ?? [], params.bairro_entrega ?? "")

  if (taxaFixa === null && params.loja_lat && params.loja_lng && params.lat_entrega && params.lng_entrega) {
    const distKm = haversineKm(params.loja_lat, params.loja_lng, params.lat_entrega, params.lng_entrega)
    if (distKm > RAIO_MAXIMO_KM) throw new EnderecoForaDoRaioError(distKm)
  }

  const taxa = taxaFixa !== null
    ? taxaFixa
    : await calcularTaxaPorDistancia(params.loja_lat, params.loja_lng, params.lat_entrega, params.lng_entrega, params.loja_taxa_base ?? 6.00)

  // Nunca negativa — loja com taxa_entrega cadastrada errada (< 0) não pode reduzir o total.
  return Math.max(0, taxa)
}
