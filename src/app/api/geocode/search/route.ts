import { NextRequest, NextResponse } from "next/server"

interface PhotonFeature {
  type: string
  properties: {
    osm_type?: string
    osm_id?: number
    osm_key?: string
    osm_value?: string
    type?: string
    name?: string
    city?: string
    state?: string
    country?: string
    countrycode?: string
    postcode?: string
    street?: string
    housenumber?: string
    district?: string
    county?: string
  }
  geometry: {
    type: string
    coordinates: [number, number] // [lng, lat]
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")
  if (!q || q.trim().length < 2) return NextResponse.json([])

  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q.trim())}&limit=8`

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AragoDelivery/1.0" },
      next: { revalidate: 60 },
    })
    if (!res.ok) return NextResponse.json([])
    const data = await res.json()

    const features: PhotonFeature[] = data.features ?? []

    // Filtra apenas Brasil, prioriza cidades/municípios
    const brasileiras = features.filter(
      f => f.properties.countrycode?.toUpperCase() === "BR"
    )
    const resultados = (brasileiras.length > 0 ? brasileiras : features).slice(0, 5)

    // Converte para formato compatível com o componente
    const saida = resultados.map(f => {
      const p   = f.properties
      const lat = f.geometry.coordinates[1]
      const lng = f.geometry.coordinates[0]
      // Monta display_name legível
      const partes = [p.name, p.city, p.state, p.country].filter(Boolean)
      return {
        place_id:     f.properties.osm_id ?? Math.random(),
        display_name: partes.join(", "),
        name:         p.name ?? "",
        lat:          String(lat),
        lon:          String(lng),
        address: {
          road:         p.street,
          city:         p.city,
          town:         undefined as string | undefined,
          village:      undefined as string | undefined,
          municipality: p.name,
          county:       p.county,
          state:        p.state,
        },
      }
    })

    return NextResponse.json(saida)
  } catch {
    return NextResponse.json([])
  }
}
