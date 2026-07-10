import { NextRequest, NextResponse } from "next/server"

// Proxy server-side — OSRM (gratuito, sem chave, sem restrição)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const origin      = searchParams.get("origin")      // "lat,lng"
  const destination = searchParams.get("destination") // "lat,lng"

  if (!origin || !destination) {
    console.error("[directions] params faltando:", { origin, destination })
    return NextResponse.json({ error: "params" }, { status: 400 })
  }

  const [oLat, oLng] = origin.split(",").map(Number)
  const [dLat, dLng] = destination.split(",").map(Number)

  if (isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) {
    console.error("[directions] coords inválidas:", { oLat, oLng, dLat, dLng })
    return NextResponse.json({ error: "invalid coords" }, { status: 400 })
  }

  // OSRM usa ordem lng,lat
  const url = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=polyline`
  console.log("[directions] OSRM →", url)

  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      console.error("[directions] OSRM HTTP error:", res.status)
      return NextResponse.json({ error: `osrm-${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    console.log("[directions] OSRM code:", data.code, "routes:", data.routes?.length)

    if (data.code !== "Ok" || !data.routes?.[0]?.geometry) {
      console.error("[directions] sem rota:", data.code)
      return NextResponse.json({ error: data.code ?? "no-route" }, { status: 422 })
    }

    const route = data.routes[0]
    console.log("[directions] polyline length:", route.geometry?.length, "dist:", route.distance)

    return NextResponse.json({
      points:   route.geometry,
      duration: route.duration,
      distance: route.distance,
    })
  } catch (err) {
    console.error("[directions] fetch error:", err)
    return NextResponse.json({ error: "fetch-failed" }, { status: 502 })
  }
}
