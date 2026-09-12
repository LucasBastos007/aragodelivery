// Distância real de rota (dirigindo), via Mapbox Directions API — usada no cálculo da taxa
// de entrega em vez de linha reta (haversine), que subestima rotas indiretas. Se a API
// falhar por qualquer motivo (sem token, fora do ar, timeout), retorna null e quem chamou
// deve cair pro cálculo de linha reta — nunca deve travar a criação do pedido.
export async function distanciaRotaKm(
  origem: { lat: number; lng: number },
  destino: { lat: number; lng: number }
): Promise<number | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN
  if (!token) return null

  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origem.lng},${origem.lat};${destino.lng},${destino.lat}` +
      `?overview=false&access_token=${token}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) return null
    const data = await res.json()
    if (data.code !== "Ok" || !data.routes?.[0]) return null

    return data.routes[0].distance / 1000 // metros → km
  } catch {
    return null
  }
}
