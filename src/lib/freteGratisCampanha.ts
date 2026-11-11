// Frete grátis do aniversário de Aragoiânia (pedido do Lucas, 10/11/2026): entrega grátis em todas
// as lojas, até sábado 14/11 às 23h (Brasília), para quem está a até 7 km da loja. Pago pelo Chegô.
//
// Como fica no pedido: taxa_entrega continua com o valor calculado (o motoboy ganha igual), o
// cliente não paga (total sem a taxa), frete_gratis = true e frete_absorvido_por = "app". O
// financeiro (lib/regrasFinanceiras) já lança essa diferença como custo do Chegô; a loja não perde.
//
// Só dá frete grátis com distância MEDIDA (rota da Mapbox, ou linha reta se ela falhar) e pontos
// confiáveis. Na dúvida, cobra o frete normal:
// - sem ponto do cliente no mapa (ou ponto em cima da loja, ou no centro padrão da cidade) → cobra;
// - loja que nunca marcou o ponto (coordenada padrão) → cobra;
// - acima de 7 km → cobra normal;
// - pedido feito pela loja (tipo "loja") e retirada → fora.
// Sem importar lib/frete (que puxa a rota da Mapbox): este arquivo também roda na tela da loja
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const FRETE_GRATIS_INICIO = "2026-11-10T00:00:00-03:00"
// Automático só até a meia-noite de 10/11: dali em diante vira o cupom ARAGO68 (abaixo)
export const FRETE_GRATIS_FIM = "2026-11-11T00:00:00-03:00"
export const FRETE_GRATIS_RAIO_KM = 7
export const FRETE_GRATIS_TEXTO = "Frete grátis até 7 km no aniversário de Aragoiânia, até hoje à meia-noite"

// Cupom de frete grátis do aniversário (pedido do Lucas, 10/11/2026), no lugar do automático:
// de 11/11 00h até sábado 14/11 23h, até 5 km medidos, mesmas regras de ponto confiável e pago
// pelo Chegô do mesmo jeito (taxa cheia gravada pro motoboy, fora do total do cliente).
export const CUPOM_FRETE_ANIVERSARIO = {
  codigo: "ARAGO68",
  inicio: "2026-11-11T00:00:00-03:00",
  fim: "2026-11-14T23:00:00-03:00",
  raioKm: 5,
}
export const ehCupomFreteAniversario = (codigo: unknown) => String(codigo ?? "").trim().toUpperCase() === CUPOM_FRETE_ANIVERSARIO.codigo
export function cupomFreteAniversarioNoPrazo(agora: number = Date.now()): boolean {
  return agora >= new Date(CUPOM_FRETE_ANIVERSARIO.inicio).getTime() && agora < new Date(CUPOM_FRETE_ANIVERSARIO.fim).getTime()
}
export const MSG_CUPOM_FORA_DO_PRAZO = "O cupom ARAGO68 vale de 11/11 à 0h até sábado (14/11) às 23h."
export const MSG_CUPOM_FORA_DO_RAIO = "O cupom ARAGO68 dá frete grátis só para entregas até 5 km da loja, com o endereço marcado no mapa."

/** Linha reta loja↔cliente (prévia do cupom na Sacola; o pedido confere pela rota). */
export const distanciaRetaKm = haversineKm

// Coordenada padrão de loja sem ponto (motoboy/page.tsx) e centro usado pelo checkout quando o
// endereço não foi achado (checkout/page.tsx LAT_DEFAULT). Ponto perto delas não prova nada.
const LOJA_SEM_PONTO = { lat: -16.9146388, lng: -49.4499148 }
const CENTRO_PADRAO = { lat: -16.9214, lng: -49.4497 }

/** Loja marcou o próprio ponto no mapa? Sem isso não dá pra medir os 7 km. */
export function lojaComPonto(lat: unknown, lng: unknown): boolean {
  const a = Number(lat), b = Number(lng)
  return !!a && !!b && haversineKm(a, b, LOJA_SEM_PONTO.lat, LOJA_SEM_PONTO.lng) >= 0.01
}

export function freteGratisAtivo(agora: number = Date.now()): boolean {
  return agora >= new Date(FRETE_GRATIS_INICIO).getTime() && agora < new Date(FRETE_GRATIS_FIM).getTime()
}

export function freteGratisElegivel(p: {
  distanciaKm: number | null | undefined
  lojaLat: number | null | undefined; lojaLng: number | null | undefined
  latEntrega: number | null | undefined; lngEntrega: number | null | undefined
  agora?: number
  raioKm?: number
  /** Cupom ARAGO68: o prazo é conferido por quem chama (cupomFreteAniversarioNoPrazo) */
  porCupom?: boolean
}): boolean {
  const raio = p.raioKm ?? FRETE_GRATIS_RAIO_KM
  if (!p.porCupom && !freteGratisAtivo(p.agora)) return false
  const lLat = Number(p.lojaLat), lLng = Number(p.lojaLng), cLat = Number(p.latEntrega), cLng = Number(p.lngEntrega)
  if (!lLat || !lLng || !cLat || !cLng) return false
  if (!lojaComPonto(lLat, lLng)) return false
  if (haversineKm(cLat, cLng, CENTRO_PADRAO.lat, CENTRO_PADRAO.lng) < 0.05) return false
  if (haversineKm(cLat, cLng, lLat, lLng) < 0.03) return false
  const d = p.distanciaKm
  if (d == null || !Number.isFinite(Number(d))) return false
  // a distância de rota nunca é menor que a linha reta; se vier menor, algo está errado
  return Number(d) <= raio && haversineKm(lLat, lLng, cLat, cLng) <= raio
}
