import { NextRequest, NextResponse } from "next/server"

// Extrai lat/lng de um texto ou link do Google Maps — cobre os formatos mais comuns:
// "@lat,lng" (mapa centrado), "?q=lat,lng", "!3dlat!4dlng" (detalhe de local) e uma
// coordenada solta colada direto (ex: "-16.9215, -49.4490").
function extrairCoordenadas(texto: string): { lat: number; lng: number } | null {
  let m = texto.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }

  m = texto.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }

  m = texto.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }

  m = texto.match(/(-?\d{1,2}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }

  return null
}

// GET /api/geocode/resolver-link?texto=...
//
// Recebe o texto que o lojista colou (link do Google Maps que o cliente mandou pelo
// WhatsApp, às vezes só a coordenada solta) e devolve lat/lng. Links curtos
// (maps.app.goo.gl, goo.gl/maps) não têm coordenada na URL — precisa seguir o
// redirecionamento pra chegar na URL longa antes de extrair.
export async function GET(req: NextRequest) {
  const texto = req.nextUrl.searchParams.get("texto")
  if (!texto) return NextResponse.json({ error: "texto obrigatório" }, { status: 400 })

  let coords = extrairCoordenadas(texto)

  if (!coords) {
    const linkMatch = texto.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\/\S+/)
    if (linkMatch) {
      try {
        const res = await fetch(linkMatch[0], {
          redirect: "follow",
          headers: { "User-Agent": "Mozilla/5.0 (compatible; AragoDelivery/1.0)" },
        })
        coords = extrairCoordenadas(res.url)
        if (!coords) coords = extrairCoordenadas(await res.text())
      } catch {}
    }
  }

  if (!coords) {
    return NextResponse.json({ error: "Não consegui identificar a localização nesse link. Tente colar o link completo do Google Maps." }, { status: 422 })
  }
  return NextResponse.json(coords)
}
