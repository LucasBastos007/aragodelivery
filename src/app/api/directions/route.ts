import { NextRequest, NextResponse } from "next/server"

// Proxy server-side para Google Directions API.
// Evita bloqueio por restrição de HTTP Referrer na API key do client.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const origin      = searchParams.get("origin")
  const destination = searchParams.get("destination")

  if (!origin || !destination) {
    return NextResponse.json({ error: "params" }, { status: 400 })
  }

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""
  const url =
    `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    `&mode=driving&language=pt-BR&key=${key}`

  const res = await fetch(url, {
    headers: {
      // Forja o referenciador aceito pela chave — chamada server-side ignora restrição
      Referer: "https://chegodelivery.com/",
      Origin:  "https://chegodelivery.com",
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    return NextResponse.json({ error: "upstream" }, { status: 502 })
  }

  const data = await res.json()

  if (data.status !== "OK" || !data.routes?.[0]) {
    return NextResponse.json({ error: data.status }, { status: 422 })
  }

  const route = data.routes[0]
  return NextResponse.json({
    points:   route.overview_polyline.points,
    bounds:   route.bounds,
    duration: route.legs?.[0]?.duration?.value  ?? null,
    distance: route.legs?.[0]?.distance?.value  ?? null,
  })
}
