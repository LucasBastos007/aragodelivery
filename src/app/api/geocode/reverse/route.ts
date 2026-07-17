import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat")
  const lon = req.nextUrl.searchParams.get("lon")
  if (!lat || !lon) return NextResponse.json({ error: "lat e lon obrigatórios" }, { status: 400 })

  const url = new URL("https://nominatim.openstreetmap.org/reverse")
  url.searchParams.set("lat", lat)
  url.searchParams.set("lon", lon)
  url.searchParams.set("format", "json")
  url.searchParams.set("accept-language", "pt-BR")

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "AragoDelivery/1.0 (contato@aragodelivery.com.br)",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      next: { revalidate: 0 },
    })
    if (!res.ok) return NextResponse.json({})
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({})
  }
}
