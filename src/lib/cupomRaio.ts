import { haversineKm, mesmaCidade } from "@/lib/frete"

type CupomRaio = { centro_lat: number | null; centro_lng: number | null; raio_km: number | null }
type LojaPos = { lat: number | null; lng: number | null; cidade: string | null }

// Acima disso, loja e cliente com coordenada são tratados como cidades diferentes
// (Guapó ↔ Aragoiânia ficam a ~13,5km; dentro da mesma cidade as entregas são bem menores).
const DIST_MAX_MESMA_AREA_KM = 10

/**
 * Cupom com raio (centro + raio_km) vale quando o cliente está dentro do círculo — regra de
 * sempre — E a loja é da mesma cidade da entrega. Antes só o cliente era checado: cupom
 * CHEGOFRETE (centro em Aragoiânia, 8km, global) zerava o frete de pedido de loja de Guapó
 * (~14km) pra cliente de Aragoiânia — pedidos SSEW3V e EPM899, 2026-10-03, R$26 cada.
 *
 * De propósito NÃO exige a loja dentro do círculo: vários cupons têm raio de 2–5km pensado
 * pra um bairro de clientes, com a loja fora dele — isso continuaria valendo.
 * Loja com coordenada → compara pela distância real loja↔cliente; sem coordenada → pela
 * cidade da loja vs. cidade da entrega; sem nenhum dos dois, comportamento antigo.
 */
export function cupomValeNoRaio(cupom: CupomRaio, loja: LojaPos | null, entrega: { lat: number | null; lng: number | null; cidade?: string | null }): boolean {
  if (cupom.raio_km == null || cupom.centro_lat == null || cupom.centro_lng == null) return true
  // Sem a localização do cliente (ex.: Sacola antes de escolher o endereço, primeiro pedido):
  // vale se a LOJA está dentro da área do cupom e, quando dá pra saber, a entrega é na mesma
  // cidade. Antes recusava com "fora da área" até cliente do Centro de Aragoiânia (31/10/2026).
  // A finalização e o /api/pedido/criar conferem de novo com o endereço de verdade.
  if (entrega.lat == null || entrega.lng == null) {
    if (!loja || loja.lat == null || loja.lng == null) return false
    if (haversineKm(cupom.centro_lat, cupom.centro_lng, loja.lat, loja.lng) > cupom.raio_km) return false
    return !(loja.cidade && entrega.cidade) || mesmaCidade(loja.cidade, entrega.cidade)
  }
  if (haversineKm(cupom.centro_lat, cupom.centro_lng, entrega.lat, entrega.lng) > cupom.raio_km) return false
  if (!loja) return true
  // Coordenada real primeiro — o nome de cidade vindo do geocoder não é confiável (endereços
  // do Jardim Imperial, Aragoiânia, já vieram rotulados como "Guapó" e até "Aloândia").
  if (loja.lat != null && loja.lng != null) return haversineKm(loja.lat, loja.lng, entrega.lat, entrega.lng) <= DIST_MAX_MESMA_AREA_KM
  if (loja.cidade && entrega.cidade) return mesmaCidade(loja.cidade, entrega.cidade)
  return true
}
