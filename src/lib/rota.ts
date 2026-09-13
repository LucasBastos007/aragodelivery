// Distância real de rota (dirigindo), via Mapbox Directions API — usada no cálculo da taxa
// de entrega em vez de linha reta (haversine), que subestima rotas indiretas. Se a API
// falhar por qualquer motivo (sem token, fora do ar, timeout), retorna null e quem chamou
// deve cair pro cálculo de linha reta — nunca deve travar a criação do pedido.
//
// Pede alternatives=true e usa a rota MAIS LONGA entre as retornadas, não a "mais rápida"
// (padrão da API) — caso real confirmado (pedidos ZHPVTV/MNRFMC, 2026-09-13): a rota padrão
// da Mapbox pra um trajeto rural deu 12,04km, mas o Waze mostrava a viagem real em ~16km.
// Pedindo alternativas, a Mapbox tinha uma segunda opção de 15,10km/28,3min — quase igual
// ao Waze e só 2min mais lenta que a "mais rápida" — ou seja, a rota mais realista já
// existia nos dados dela, só não estava sendo pedida. Mais preciso que aplicar uma margem
// genérica em cima da distância, já que é uma rota real específica pra cada endereço.
export async function distanciaRotaKm(
  origem: { lat: number; lng: number },
  destino: { lat: number; lng: number }
): Promise<number | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN
  if (!token) return null

  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origem.lng},${origem.lat};${destino.lng},${destino.lat}` +
      `?alternatives=true&overview=false&access_token=${token}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) return null
    const data = await res.json()
    if (data.code !== "Ok" || !data.routes?.length) return null

    const distancias: number[] = data.routes.map((r: any) => r.distance)
    return Math.max(...distancias) / 1000 // metros → km
  } catch {
    return null
  }
}
