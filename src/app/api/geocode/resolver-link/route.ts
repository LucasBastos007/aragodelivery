import { NextRequest, NextResponse } from "next/server"

// Extrai lat/lng de um texto ou link do Google Maps — cobre os formatos mais comuns:
// "@lat,lng" (mapa centrado), "?q=lat,lng", "!3dlat!4dlng" (detalhe de local) e uma
// coordenada solta colada direto (ex: "-16.9215, -49.4490").
function extrairCoordenadas(bruto: string): { lat: number; lng: number } | null {
  // Link de localização do WhatsApp vem codificado ("%2C", "+" no lugar do espaço), ex.
  // /maps/search/-10.188109,+-48.337795. Antes a regex não aceitava o "+" e caía na busca
  // dentro do HTML do Google, que achava lixo (lat 84,24 = Polo Norte) e o frete saía o mínimo
  // (incidente 18/11/2026: entregas avulsas a R$ 4 que deviam ser R$ 15/20).
  let texto = bruto.replace(/\+/g, " ")
  try { texto = decodeURIComponent(texto) } catch {}
  const SEP = String.raw`\s*,\s*`
  const NUM = String.raw`(-?\d{1,3}\.\d+)`
  const padroes = [
    new RegExp(`@${NUM}${SEP}${NUM}`),
    new RegExp(`[?&](?:q|query|ll|daddr|destination|center)=(?:loc:)?${NUM}${SEP}${NUM}`),
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    new RegExp(`/(?:search|place|dir)/${NUM}${SEP}${NUM}`),
    new RegExp(String.raw`(-?\d{1,2}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})`),
  ]
  for (const re of padroes) {
    const m = texto.match(re)
    if (!m) continue
    const lat = parseFloat(m[1]), lng = parseFloat(m[2])
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
  }
  return null
}

// Coordenada só vale se cair no Brasil (evita número solto do HTML do Google virar ponto de entrega)
const noBrasil = (c: { lat: number; lng: number } | null) =>
  c && c.lat > -34 && c.lat < 6 && c.lng > -74 && c.lng < -34 ? c : null

// GET /api/geocode/resolver-link?texto=...
//
// Recebe o texto que o lojista colou (link do Google Maps que o cliente mandou pelo
// WhatsApp, às vezes só a coordenada solta) e devolve lat/lng. Links curtos
// (maps.app.goo.gl, goo.gl/maps) não têm coordenada na URL — precisa seguir o
// redirecionamento pra chegar na URL longa antes de extrair.
export async function GET(req: NextRequest) {
  const texto = req.nextUrl.searchParams.get("texto")
  if (!texto) return NextResponse.json({ error: "texto obrigatório" }, { status: 400 })

  let coords = noBrasil(extrairCoordenadas(texto))

  if (!coords) {
    const linkMatch = texto.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\/\S+/)
    if (linkMatch) {
      try {
        const res = await fetch(linkMatch[0], {
          redirect: "follow",
          headers: { "User-Agent": "Mozilla/5.0 (compatible; AragoDelivery/1.0)" },
        })
        coords = noBrasil(extrairCoordenadas(res.url))
        if (!coords) {
          // Só os formatos inequívocos do HTML (@lat,lng e !3d!4d), nunca número solto
          const html = await res.text()
          const m = html.match(/@(-?\d{1,2}\.\d{4,}),(-?\d{1,3}\.\d{4,})/) ?? html.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
          if (m) coords = noBrasil({ lat: parseFloat(m[1]), lng: parseFloat(m[2]) })
        }
      } catch {}
    }
  }

  if (!coords) {
    return NextResponse.json({ error: "Não consegui identificar a localização nesse link. Tente colar o link completo do Google Maps." }, { status: 422 })
  }
  return NextResponse.json(coords)
}
