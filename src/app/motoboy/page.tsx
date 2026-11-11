"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { useAuth } from "@/lib/auth"
import { ganhoMotoboy, ganhoMotoboyPedido } from "@/lib/comissao"

// Calcula o valor líquido que o motoboy recebe após a taxa da plataforma
function ganhoLiquido(taxa: number, criadoEm?: string | null): number {
  return ganhoMotoboy(taxa, criadoEm)
}

// Crédito/débito da maquininha não tem coluna própria — vem embutido na observação do
// pedido (checkout grava "💳 Maquininha: Crédito/Débito" ali). Extrai pra exibir separado.
function extrairTipoMaquininha(observacao?: string | null): string | null {
  if (!observacao) return null
  const m = observacao.match(/Maquininha:\s*(Crédito|Débito)/i)
  return m ? m[1] : null
}

// Quanto o motoboy precisa cobrar do cliente na entrega — só relevante pra dinheiro/maquininha
// (PIX e cartão salvo já foram cobrados no app). Mostrado tanto na oferta quanto na corrida ativa.
function DetalheCobranca({ pedido }: { pedido: any }) {
  // Layout novo: texto escuro sobre fundo amarelo-claro (cartões) — o conteúdo é o mesmo.
  // Pagamento em 2 formas (20/10/2026): cobra só as partes de dinheiro/maquininha, cada uma
  // com o próprio valor, e avisa quanto já foi pago no app.
  const partes = partesPagamento(pedido)
  const reais = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`
  const linhas = partes.filter(x => x.forma === "dinheiro" || x.forma === "maquininha").map(x => {
    if (x.forma === "dinheiro") return `Cobrar ${reais(x.valor)} em dinheiro${pedido.troco_para ? `, troco pra ${reais(Number(pedido.troco_para))}` : ", sem troco"}`
    const tipo = extrairTipoMaquininha(pedido.observacao)
    return `Cobrar ${reais(x.valor)} na maquininha${tipo ? ` (${tipo})` : ""}`
  })
  if (!linhas.length) return null
  const pagoNoApp = partes.filter(x => x.forma === "pix" || x.forma === "cartao")
  return (
    <span style={{ color: "#6B5100", fontSize: 13, fontWeight: 800, display: "block" }}>
      {linhas.map((l, k) => <span key={k} style={{ display: "block" }}>{l}</span>)}
      {pagoNoApp.length > 0 && <span style={{ display: "block", fontWeight: 600 }}>{pagoNoApp.map(x => `${reais(x.valor)} já pago no ${x.forma === "pix" ? "Pix" : "cartão"}`).join(", ")}</span>}
    </span>
  )
}
import type { Pedido } from "@/types"
import { partesPagamento, cobraNaEntrega, rotuloPagamento } from "@/lib/pagamentoDividido"
import { useJsApiLoader } from "@react-google-maps/api"

const GMAPS_LIBS: ("geometry" | "places")[] = []

const DARK_MAP_STYLE = [
  { elementType: "geometry",           stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill",   stylers: [{ color: "#8a96b5" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.icon",        stylers: [{ visibility: "off" }] },
  { featureType: "road",               elementType: "geometry.fill",   stylers: [{ color: "#2c2c44" }] },
  { featureType: "road.highway",       elementType: "geometry",        stylers: [{ color: "#f97316" }, { lightness: -60 }] },
  { featureType: "road.arterial",      elementType: "geometry",        stylers: [{ color: "#3a3a5c" }] },
  { featureType: "road.local",         elementType: "geometry",        stylers: [{ color: "#232336" }] },
  { featureType: "road",               elementType: "labels.text.fill",stylers: [{ color: "#9e9fb5" }] },
  { featureType: "water",              elementType: "geometry",        stylers: [{ color: "#0e1626" }] },
  { featureType: "poi",                elementType: "geometry",        stylers: [{ color: "#1e1e30" }] },
  { featureType: "poi.park",           elementType: "geometry",        stylers: [{ color: "#162020" }] },
  { featureType: "administrative",     elementType: "geometry.stroke", stylers: [{ color: "#2c2c44" }] },
  { featureType: "landscape",          elementType: "geometry",        stylers: [{ color: "#16162a" }] },
  { featureType: "transit",            elementType: "geometry",        stylers: [{ color: "#1a1a2e" }] },
]

const PGTO: Record<string, string> = {
  pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha", pix_loja: "Pix (já pago)",
}
const PGTO_COLOR: Record<string, string> = {
  pix: "#818cf8", cartao: "#60a5fa", dinheiro: "#34d399", maquininha: "#f472b6", pix_loja: "#818cf8",
}

const DEFAULT_LAT = -17.0549
const DEFAULT_LNG = -49.2295

function mascaraTelefone(tel: string): string {
  const d = tel.replace(/\D/g, "")
  if (d.length === 11) return `(${d.slice(0,2)}) ${d[2]}****-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ****-${d.slice(6)}`
  return tel
}

// Código de entrega (o que o motoboy pede ao cliente pra confirmar a entrega) — os 4
// últimos dígitos do telefone do cliente, não mais o código do pedido (esse continua sendo
// só do lojista/pedido). Mais fácil do cliente lembrar/falar do que ler um código na tela.
// Sem telefone cadastrado (pedido antigo, cadastro incompleto), cai pro código do pedido.
function codigoEntregaCliente(pedido: Pedido): string {
  const digitos = (pedido.telefone_cliente ?? "").replace(/\D/g, "")
  return digitos.length >= 4 ? digitos.slice(-4) : pedido.codigo
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw     = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// Aragoiânia-GO — mesmo centro usado no checkout (LAT_DEFAULT/LNG_DEFAULT). Sem esse viés
// geográfico, um endereço com nome de rua comum (ex: "Rua 15") pode geocodificar pra uma
// via de mesmo nome numa cidade bem maior e mais "importante" no resto do Brasil, jogando
// o pino do motoboy pro lugar errado no mapa.
// ATENÇÃO: valor anterior (-17.6547, -49.4378) era Aloândia-GO, ~82km de Aragoiânia — o
// viés geográfico estava, ele mesmo, jogando os resultados pro lugar errado. Corrigido.
const GEOCODE_BIAS_LAT = -16.9214
const GEOCODE_BIAS_LNG = -49.4497

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    // Não força a cidade no texto da busca (a região atendida não é só Aragoiânia — ver
    // tabela_frete por município) — só empurra o resultado pra perto via bias de lat/lon.
    const q   = encodeURIComponent(`${address}, Brasil`)
    const res = await fetch(`/api/geocode/search?q=${q}&lat=${GEOCODE_BIAS_LAT}&lon=${GEOCODE_BIAS_LNG}`)
    const data = await res.json()
    if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
    }
    return null
  } catch { return null }
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lng}`)
    const data = await res.json()
    const a = data?.address ?? {}
    const city  = a.city || a.town || a.village || a.municipality || ""
    const state = a.state_code || a.state || ""
    if (city) return state ? `${city} · ${state}` : city
    return null
  } catch { return null }
}


function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dL = (lat2 - lat1) * Math.PI / 180
  const dG = (lng2 - lng1) * Math.PI / 180
  const a  = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dG/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const CIRCUM = 2 * Math.PI * 40 // circunferência do timer circular ≈ 251.3

// ─── Mapa fullscreen com rota (Google Maps — API imperativa) ──────────────────
type PinExtra = { lat: number; lng: number; type: "loja" | "destino"; label?: string }

// Decodifica polyline encoding do Google (algoritmo padrão)
function decodePolyline(enc: string): { lat: number; lng: number }[] {
  const pts: { lat: number; lng: number }[] = []
  let i = 0, lat = 0, lng = 0
  while (i < enc.length) {
    let b, s = 0, r = 0
    do { b = enc.charCodeAt(i++) - 63; r |= (b & 31) << s; s += 5 } while (b >= 32)
    lat += r & 1 ? ~(r >> 1) : (r >> 1)
    s = 0; r = 0
    do { b = enc.charCodeAt(i++) - 63; r |= (b & 31) << s; s += 5 } while (b >= 32)
    lng += r & 1 ? ~(r >> 1) : (r >> 1)
    pts.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return pts
}

// Lazy singleton: estende google.maps.OverlayView só depois que a API carrega
let _HtmlOverlayClass: any = null
function getHtmlOverlayClass() {
  if (_HtmlOverlayClass) return _HtmlOverlayClass
  class HtmlOverlay extends google.maps.OverlayView {
    div: HTMLDivElement
    pos: google.maps.LatLng
    constructor(lat: number, lng: number, html: string) {
      super()
      this.pos = new google.maps.LatLng(lat, lng)
      this.div = document.createElement("div")
      this.div.style.position = "absolute"
      this.div.innerHTML = html
    }
    onAdd() { this.getPanes()?.overlayMouseTarget.appendChild(this.div) }
    draw() {
      const p = this.getProjection()?.fromLatLngToDivPixel(this.pos)
      if (!p) return
      this.div.style.left = `${p.x}px`
      this.div.style.top  = `${p.y}px`
    }
    onRemove() { this.div.parentNode?.removeChild(this.div) }
    move(lat: number, lng: number) { this.pos = new google.maps.LatLng(lat, lng); this.draw() }
    setHtml(html: string) { this.div.innerHTML = html }
  }
  _HtmlOverlayClass = HtmlOverlay
  return HtmlOverlay
}

// Puck de navegação: cone aponta para frente (mapa já rotaciona heading-up, cone fica fixo para cima)
function markerMotoboyNav() {
  return `<div style="transform:translate(-50%,-50%);filter:drop-shadow(0 4px 14px rgba(0,0,0,0.55))"><svg width="50" height="64" viewBox="0 0 50 64"><path d="M25,1 L14,30 L25,23 L36,30 Z" fill="rgba(34,211,238,0.82)" stroke="rgba(255,255,255,0.5)" stroke-width="1" stroke-linejoin="round"/><circle cx="25" cy="44" r="19" fill="rgba(34,211,238,0.14)" stroke="rgba(34,211,238,0.32)" stroke-width="1.5"/><circle cx="25" cy="44" r="13" fill="#1e40af" stroke="white" stroke-width="2.5"/><circle cx="25" cy="44" r="5" fill="white" opacity="0.9"/></svg></div>`
}

// Bússola: agulha norte (ciano) + sul (cinza), rotaciona pelo heading do dispositivo/GPS
function markerMotoboyGps(heading: number) {
  return `<div style="transform:translate(-50%,-50%);position:relative;width:32px;height:32px"><style>@keyframes gpsPulse{0%{transform:translate(-50%,-50%) scale(1);opacity:.5}100%{transform:translate(-50%,-50%) scale(3.2);opacity:0}}</style><div style="position:absolute;top:50%;left:50%;width:32px;height:32px;border-radius:50%;background:rgba(66,133,244,0.2);animation:gpsPulse 2s ease-out infinite;pointer-events:none"></div><svg width="32" height="32" viewBox="0 0 32 32" style="position:absolute;top:0;left:0;transform-origin:16px 16px;transform:rotate(${heading}deg)"><polygon points="16,3 13,16 16,14 19,16" fill="#22d3ee" stroke="rgba(255,255,255,0.7)" stroke-width="0.8" stroke-linejoin="round"/><polygon points="16,29 13,16 16,18 19,16" fill="rgba(180,180,195,0.75)" stroke="rgba(255,255,255,0.3)" stroke-width="0.5" stroke-linejoin="round"/></svg><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:17px;height:17px;border-radius:50%;background:#4285F4;border:2.5px solid white;box-shadow:0 2px 8px rgba(66,133,244,0.7)"></div></div>`
}
const MARKER_LOJA   = `<div style="transform:translate(-50%,-50%);width:38px;height:38px;border-radius:50%;background:#f97316;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`
const MARKER_DESTINO = `<div style="transform:translate(-50%,-50%);width:38px;height:38px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`
const MARKER_EXTRA_LOJA   = `<div style="transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;background:#fb923c;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center"><span style="color:white;font-weight:900;font-size:11px">2</span></div>`
const MARKER_EXTRA_DESTINO= `<div style="transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;background:#4ade80;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center"><span style="color:white;font-weight:900;font-size:11px">2</span></div>`

function MapaMotoboy({
  myLat, myLng,
  destinoLat, destinoLng,
  lojaLat, lojaLng,
  raioDisplay, raioOpen,
  extrasLoja, extrasDestino,
  fitBoundsTrigger,
}: {
  myLat: number; myLng: number
  destinoLat?: number | null; destinoLng?: number | null
  lojaLat?: number | null; lojaLng?: number | null
  raioDisplay: number; raioOpen: boolean
  extrasLoja?: PinExtra[]
  extrasDestino?: PinExtra[]
  fitBoundsTrigger?: number
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-motoboy",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "",
    libraries: GMAPS_LIBS,
  })

  const containerRef      = useRef<HTMLDivElement>(null)
  const mapInstanceRef    = useRef<google.maps.Map | null>(null)
  const routePolyRef      = useRef<google.maps.Polyline | null>(null)   // rota seguindo ruas
  const fallbackPolyRef   = useRef<google.maps.Polyline | null>(null)   // linha reta de fallback
  const circleRef         = useRef<google.maps.Circle | null>(null)
  const motoboyOvRef      = useRef<any>(null)
  const lojaOvRef         = useRef<any>(null)
  const destinoOvRef      = useRef<any>(null)
  const extrasOvRef       = useRef<any[]>([])
  const routeAbortRef     = useRef<AbortController | null>(null)

  const followRef    = useRef(true)
  const headingRef   = useRef(0)
  const compassRef   = useRef(0)          // heading real do dispositivo (bússola)
  const navModeRef   = useRef(false)      // ref de navMode para uso nos listeners
  const prevNavPos   = useRef<{ lat: number; lng: number } | null>(null)
  const myLatRef     = useRef(myLat)
  const myLngRef     = useRef(myLng)
  const gpsRealRef   = useRef(false)
  const destinoLatRef = useRef(destinoLat)
  const destinoLngRef = useRef(destinoLng)
  const lojaLatRef    = useRef(lojaLat)
  const lojaLngRef    = useRef(lojaLng)

  const [following, setFollowing] = useState(true)
  const [hasRoute,  setHasRoute]  = useState(false)   // true quando rota por ruas está ativa

  const navMode = !!(destinoLat && destinoLng)

  useEffect(() => { myLatRef.current = myLat; myLngRef.current = myLng }, [myLat, myLng])
  useEffect(() => { destinoLatRef.current = destinoLat; destinoLngRef.current = destinoLng }, [destinoLat, destinoLng])
  useEffect(() => { lojaLatRef.current = lojaLat; lojaLngRef.current = lojaLng }, [lojaLat, lojaLng])
  useEffect(() => { navModeRef.current = navMode }, [navMode])

  // ── Bússola do dispositivo (DeviceOrientationEvent) ───────────────────────────
  useEffect(() => {
    let rafId: number | null = null
    function onOrientation(e: DeviceOrientationEvent) {
      // iOS: webkitCompassHeading (0=norte, clockwise, absoluto)
      // Android: alpha cresce anti-horário → inverte para clockwise
      const wkh = (e as any).webkitCompassHeading as number | undefined
      const h   = wkh != null ? wkh : e.alpha != null ? (360 - e.alpha + 360) % 360 : null
      if (h == null) return
      compassRef.current = h
      headingRef.current = h
      // Atualiza o marcador do motoboy somente quando não há rota ativa (mapa north-up)
      if (!navModeRef.current && !rafId) {
        rafId = requestAnimationFrame(() => {
          motoboyOvRef.current?.setHtml(markerMotoboyGps(compassRef.current))
          rafId = null
        })
      }
    }
    // deviceorientationabsolute é mais preciso no Android; deviceorientation como fallback
    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener, true)
    window.addEventListener("deviceorientation",         onOrientation as EventListener, true)
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener, true)
      window.removeEventListener("deviceorientation",         onOrientation as EventListener, true)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  function calcBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLng = (lng2 - lng1) * Math.PI / 180
    const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180)
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180)
           - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng)
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
  }

  // ── Cria o mapa imperativamente — garante renderingType VECTOR no construtor ──
  useEffect(() => {
    if (!isLoaded || !containerRef.current || mapInstanceRef.current) return
    const Ov = getHtmlOverlayClass()

    const map = new google.maps.Map(containerRef.current, {
      center: { lat: myLat, lng: myLng },
      zoom: 16,
      mapTypeId: "roadmap",
      disableDefaultUI: true,
      gestureHandling: "greedy",
      clickableIcons: false,
    })
    mapInstanceRef.current = map
    map.addListener("dragstart", () => { followRef.current = false; setFollowing(false) })

    // Polyline para rota calculada (seguindo ruas) — path definido via fetchRoute
    routePolyRef.current = new google.maps.Polyline({
      strokeColor: "#22d3ee", strokeWeight: 8, strokeOpacity: 0.9,
      zIndex: 5,
    })

    // Polyline de fallback (linha reta) — só aparece quando fetchRoute falha
    fallbackPolyRef.current = new google.maps.Polyline({
      strokeColor: "#22d3ee", strokeWeight: 5, strokeOpacity: 0.6,
      zIndex: 4,
    })

    circleRef.current = new google.maps.Circle({
      map, center: { lat: myLat, lng: myLng }, radius: raioDisplay * 1000,
      strokeColor: "#f97316", strokeOpacity: 0.2, strokeWeight: 1.5,
      fillColor: "#f97316", fillOpacity: 0.04,
    })

    motoboyOvRef.current = new Ov(myLat, myLng, markerMotoboyGps(0))
    motoboyOvRef.current.setMap(map)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded])

  // ── Atualiza posição e ícone do motoboy ───────────────────────────────────────
  useEffect(() => {
    motoboyOvRef.current?.move(myLat, myLng)
    // navMode: puck com cone (mapa rotaciona, cone aponta para frente automaticamente)
    // GPS: bússola com agulha rotacionando pelo heading atual
    motoboyOvRef.current?.setHtml(navMode ? markerMotoboyNav() : markerMotoboyGps(compassRef.current))
    circleRef.current?.setCenter({ lat: myLat, lng: myLng })
  }, [myLat, myLng, navMode])

  // ── Atualiza pin da loja ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current; if (!map) return
    lojaOvRef.current?.setMap(null)
    if (lojaLat && lojaLng) {
      const Ov = getHtmlOverlayClass()
      lojaOvRef.current = new Ov(lojaLat, lojaLng, MARKER_LOJA)
      lojaOvRef.current.setMap(map)
    }
  }, [lojaLat, lojaLng])

  // ── Atualiza pin do destino ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current; if (!map) return
    destinoOvRef.current?.setMap(null)
    if (destinoLat && destinoLng) {
      const Ov = getHtmlOverlayClass()
      destinoOvRef.current = new Ov(destinoLat, destinoLng, MARKER_DESTINO)
      destinoOvRef.current.setMap(map)
    }
  }, [destinoLat, destinoLng])

  // ── Atualiza pins extras ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current; if (!map) return
    extrasOvRef.current.forEach(o => o?.setMap(null))
    extrasOvRef.current = []
    const Ov = getHtmlOverlayClass()
    extrasLoja?.forEach(p => { if (p.lat && p.lng) { const o = new Ov(p.lat, p.lng, MARKER_EXTRA_LOJA); o.setMap(map); extrasOvRef.current.push(o) } })
    extrasDestino?.forEach(p => { if (p.lat && p.lng) { const o = new Ov(p.lat, p.lng, MARKER_EXTRA_DESTINO); o.setMap(map); extrasOvRef.current.push(o) } })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extrasLoja, extrasDestino])

  // ── fetchRoute: proxy /api/directions → OSRM server-side ─────────────────────
  async function fetchRoute(oLat: number, oLng: number, dLat: number, dLng: number) {
    routeAbortRef.current?.abort()
    const ctrl = new AbortController()
    routeAbortRef.current = ctrl

    try {
      const res = await fetch(
        `/api/directions?origin=${oLat},${oLng}&destination=${dLat},${dLng}`,
        { signal: ctrl.signal, credentials: "include" }
      )
      if (!res.ok) throw new Error(`directions-${res.status}`)
      const data = await res.json()
      if (!data.points) throw new Error("no-points")

      const path = decodePolyline(data.points as string)
      if (path.length < 2) throw new Error("path-too-short")

      const map = mapInstanceRef.current
      const rp  = routePolyRef.current
      if (!rp || !map) throw new Error("map-not-ready")

      rp.setPath(path)
      rp.setOptions({ strokeColor: "#22d3ee", strokeWeight: 8, strokeOpacity: 0.9 })
      rp.setMap(map)
      fallbackPolyRef.current?.setMap(null)
      setHasRoute(true)

      const b = new google.maps.LatLngBounds()
      path.forEach(p => b.extend(p))
      return b
    } catch (e: any) {
      if (e?.name === "AbortError") return null
      console.warn("[fetchRoute] falhou:", e?.message)
      clearRoute()
    }
    return null
  }

  function clearRoute() {
    routePolyRef.current?.setMap(null)
    setHasRoute(false)
  }

  // ── Fallback (linha reta) quando não há rota calculada ────────────────────────
  useEffect(() => {
    const color = navMode ? "#22d3ee" : "#f97316"
    routePolyRef.current?.setOptions({ strokeColor: color })
    fallbackPolyRef.current?.setOptions({ strokeColor: color, strokeWeight: navMode ? 5 : 4 })
    const pl = fallbackPolyRef.current
    if (!pl) return
    if (!hasRoute && destinoLat && destinoLng) {
      pl.setPath([{ lat: myLat, lng: myLng }, { lat: destinoLat, lng: destinoLng }])
      pl.setMap(mapInstanceRef.current)
    } else {
      pl.setMap(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRoute, destinoLat, destinoLng, navMode, myLat, myLng])

  // ── Atualiza círculo de raio ──────────────────────────────────────────────────
  useEffect(() => {
    circleRef.current?.setOptions({
      radius: raioDisplay * 1000,
      strokeOpacity: raioOpen ? 0.7 : 0.2,
      strokeWeight: raioOpen ? 2 : 1.5,
      fillOpacity: raioOpen ? 0.1 : 0.04,
    })
  }, [raioDisplay, raioOpen])

  // ── GPS real: recalcula rota quando sai do ponto padrão ───────────────────────
  useEffect(() => {
    if (gpsRealRef.current) return
    if (Math.abs(myLat - DEFAULT_LAT) < 0.001 && Math.abs(myLng - DEFAULT_LNG) < 0.001) return
    gpsRealRef.current = true
    const dLat = destinoLatRef.current; const dLng = destinoLngRef.current
    if (!isLoaded || !dLat || !dLng || !mapInstanceRef.current) return
    fetchRoute(myLat, myLng, dLat, dLng)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myLat, myLng, isLoaded])

  // ── Segue o motoboy com heading-up + tilt ────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !followRef.current) return
    if (!navMode) { map.panTo({ lat: myLat, lng: myLng }); return }

    const prev = prevNavPos.current
    if (prev) {
      const dLat = (myLat - prev.lat) * 111000
      const dLng = (myLng - prev.lng) * 111000
      if (dLat * dLat + dLng * dLng > 25)
        headingRef.current = calcBearing(prev.lat, prev.lng, myLat, myLng)
    }
    prevNavPos.current = { lat: myLat, lng: myLng }

    const hr = headingRef.current * Math.PI / 180
    const AHEAD = 0.0022
    map.setCenter({ lat: myLat + AHEAD * Math.cos(hr), lng: myLng + AHEAD * Math.sin(hr) })
    map.setHeading(headingRef.current)
    map.setTilt(45)
  }, [myLat, myLng, navMode])

  // ── Entra/sai do navMode — muda zoom, heading e estilo do mapa ─────────────────
  useEffect(() => {
    // Layout novo (19/10/2026): mapa claro também no modo navegação (o Lucas preferiu o
    // mapa claro na proposta); só esconde os ícones de comércio pra não poluir a rota.
    const NAV_STYLES: google.maps.MapTypeStyle[] = [
      { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      { featureType: "poi.business", stylers: [{ visibility: "off" }] },
    ]
    const apply = () => {
      const map = mapInstanceRef.current; if (!map) return
      if (navMode) {
        map.setZoom(17); map.setTilt(45); map.setHeading(headingRef.current)
        map.set("styles", NAV_STYLES)
        followRef.current = true; setFollowing(true)
      } else {
        map.setTilt(0); map.setHeading(0)
        map.set("styles", [])
      }
    }
    apply()
    const t = setTimeout(apply, 800)
    // Ao sair do navMode, restaura bússola com heading atual
    if (!navMode) motoboyOvRef.current?.setHtml(markerMotoboyGps(compassRef.current))
    return () => clearTimeout(t)
  }, [navMode])

  // ── Chegô — Ver no mapa (fitBoundsTrigger) ────────────────────────────────────
  useEffect(() => {
    if (!fitBoundsTrigger || !mapInstanceRef.current) return
    const map = mapInstanceRef.current
    const dLat = destinoLatRef.current; const dLng = destinoLngRef.current
    const lLat = lojaLatRef.current;   const lLng = lojaLngRef.current
    const oLat = myLatRef.current;     const oLng = myLngRef.current

    if (dLat && dLng) fetchRoute(oLat, oLng, dLat, dLng)

    map.setTilt(0); map.setHeading(0)
    const b = new google.maps.LatLngBounds()
    b.extend({ lat: oLat, lng: oLng })
    if (dLat && dLng) b.extend({ lat: dLat, lng: dLng })
    if (lLat && lLng) b.extend({ lat: lLat, lng: lLng })
    map.fitBounds(b, { top: 80, right: 32, bottom: 300, left: 32 })
    followRef.current = false; setFollowing(false)
    const isNav = !!(dLat && dLng)
    const t = setTimeout(() => {
      if (isNav) { map.setZoom(17); map.setTilt(45); map.setHeading(headingRef.current) }
      followRef.current = true; setFollowing(true)
    }, 6000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitBoundsTrigger])

  // ── Recalcula rota quando destino muda ───────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !destinoLat || !destinoLng) { clearRoute(); return }
    const lat = myLatRef.current; const lng = myLngRef.current
    // Não chama clearRoute() antes — mantém rota anterior visível até nova chegar
    fetchRoute(lat, lng, destinoLat, destinoLng)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, destinoLat, destinoLng])

  if (loadError) return (
    <div style={{ position: "absolute", inset: 0, background: "#1a1a2e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(249,115,22,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>Mapa indisponível</p>
    </div>
  )

  return (
    <>
      <div ref={containerRef} style={{ position: "absolute", inset: 0, background: "#E9E7E2" }} />
      {!isLoaded && (
        <div style={{ position: "absolute", inset: 0, background: "#E9E7E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#77736B", fontSize: 13 }}>Carregando mapa…</p>
        </div>
      )}

      {/* Botão Centralizar — sempre visível */}
      <button
        onClick={() => {
          const map = mapInstanceRef.current
          if (map) {
            map.panTo({ lat: myLat, lng: myLng })
            map.setZoom(navMode ? 17 : 16)
            if (navMode) { map.setTilt(45); map.setHeading(headingRef.current) }
          }
          followRef.current = true
          setFollowing(true)
        }}
        aria-label="Centralizar no meu local"
        style={{
          // Layout novo: botão redondo no canto de cima (antes ficava embaixo e cobria o painel)
          position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 66px)", right: 12, zIndex: 21,
          width: 44, height: 44, borderRadius: "50%", border: 0,
          display: "grid", placeItems: "center",
          background: following ? "#fff" : "#22201C",
          color: following ? "#22201C" : "#fff",
          boxShadow: "0 1px 2px rgba(34,32,28,.06),0 4px 14px rgba(34,32,28,.08)",
          cursor: "pointer", transition: "all 0.2s",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
      </button>
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function MotoboyPage() {
  const { sessao, logout } = useAuth()
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null

  // Destrava o áudio de notificação no primeiro toque na tela — ver comentário em
  // desbloquearAudioNotificacao() mais abaixo no arquivo.
  useEffect(() => {
    const destravar = () => { desbloquearAudioNotificacao(); document.removeEventListener("pointerdown", destravar) }
    document.addEventListener("pointerdown", destravar, { once: true })
    return () => document.removeEventListener("pointerdown", destravar)
  }, [])

  const [disponivel,     setDisponivel]     = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("motoboy_online") === "1"
    return false
  })
  // Corrida dinâmica (chuva, 25/10/2026): aviso enquanto vale + R$ X por entrega
  const [dinamica, setDinamica] = useState<{ valor: number; ate: string } | null>(null)
  useEffect(() => {
    const ler = () => fetch("/api/corrida-dinamica").then(r => r.ok ? r.json() : null).then(j => setDinamica(j?.ativa ? { valor: j.valor, ate: j.ate } : null)).catch(() => {})
    ler(); const t = setInterval(ler, 60000); return () => clearInterval(t)
  }, [])
  const [dispLoading,    setDispLoading]    = useState(true)
  const [togglingDisp,   setTogglingDisp]   = useState(false)
  const [pushStatus,     setPushStatus]     = useState<"granted"|"denied"|"default"|"unsupported">("default")
  // Android entrega a notificação pro Chrome (confirmado repetidas vezes — o FCM aceita e
  // loga sucesso 201), mas o próprio sistema pode suprimir a notificação em segundo plano:
  // (1) otimização de bateria do fabricante (Xiaomi/Samsung/Motorola são os piores nisso),
  // e (2) rodar como aba solta do Chrome em vez de app instalado — instalado, o Android
  // trata o processo como app próprio nas configurações de bateria, o que ajuda bastante.
  // iOS não sofre disso porque o Safari roda push com prioridade de sistema. Aviso avulso,
  // fechável, só pra Android — não some sozinho porque depende de ação fora do app.
  const [avisoBateriaFechado, setAvisoBateriaFechado] = useState(true)
  const [appInstalado, setAppInstalado] = useState(true)
  useEffect(() => {
    const isAndroid = /Android/i.test(navigator.userAgent)
    const jaFechou = localStorage.getItem("arago_aviso_bateria_fechado") === "1"
    setAvisoBateriaFechado(!isAndroid || jaFechou)
    setAppInstalado(window.matchMedia("(display-mode: standalone)").matches)
  }, [])
  function fecharAvisoBateria() {
    localStorage.setItem("arago_aviso_bateria_fechado", "1")
    setAvisoBateriaFechado(true)
  }

  const [prontos,        setProntos]        = useState<Pedido[]>([])
  const [emAndamento,    setEmAndamento]    = useState<Pedido[]>([])
  const [pedidosLoading, setPedidosLoading] = useState(true)
  const [atualizando,    setAtualizando]    = useState<string | null>(null)

  const [confirmandoId,  setConfirmandoId]  = useState<string | null>(null)
  const [codigoInput,    setCodigoInput]    = useState("")
  const [erroConfirm,    setErroConfirm]    = useState("")

  const [ganhosDia,      setGanhosDia]      = useState(0)
  const [corridasDia,    setCorridasDia]    = useState(0)

  const [myLat,  setMyLat]  = useState(DEFAULT_LAT)
  const [myLng,  setMyLng]  = useState(DEFAULT_LNG)
  const [gpsReady, setGpsReady] = useState(false)
  const [compartilhando, setCompartilhando] = useState(false)
  const [cidadeAtual, setCidadeAtual] = useState<string | null>(null)
  const watchIdRef    = useRef<number | null>(null)
  const firstGeoRef   = useRef(true)
  const forceIvRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPosRef    = useRef<{lat:number;lng:number}|null>(null)
  const wakeLockRef   = useRef<any>(null)

  const [destinoLat,       setDestinoLat]       = useState<number | null>(null)
  const [destinoLng,       setDestinoLng]       = useState<number | null>(null)
  const [lojaLat,          setLojaLat]          = useState<number | null>(null)
  const [lojaLng,          setLojaLng]          = useState<number | null>(null)
  const [fitBoundsTrigger, setFitBoundsTrigger] = useState(0)

  // Bottom sheet
  const SHEET_PEEK = 220
  const SHEET_MID  = 380
  const SHEET_FULL = typeof window !== "undefined" ? Math.round(window.innerHeight * 0.82) : 660
  const [sheetH, setSheetH] = useState(SHEET_PEEK)
  const dragStartY  = useRef(0)
  const dragStartH  = useRef(0)
  const isDragging  = useRef(false)

  const [fullscreenMap, setFullscreenMap] = useState(false)

  const prevProntosRef  = useRef<Set<string>>(new Set())
  const isFirstLoad     = useRef(true)
  const justAcceptedRef  = useRef(false)
  const dismissedIdsRef  = useRef<Set<string>>(new Set())
  const buscouOfertaRef  = useRef<Map<string, number>>(new Map()) // última busca de cada oferta (anti-rajada)
  const isLoadingPedidosRef = useRef(false)
  const pedidoOfertaRef  = useRef<any>(null)
  // Ordem manual escolhida em "Priorizar esta entrega" — sem isso, o polling de 15s
  // (loadPedidos) reescrevia emAndamento sempre em ordem de criado_em, desfazendo a
  // priorização escolhida assim que o próximo ciclo rodava. Bug real reportado, 2026-09-17.
  const prioridadeManualRef = useRef<string[]>([])

  // ── Oferta de corrida (Tópico 02) ─────────────────────────────────────────
  const [pedidoOferta,    setPedidoOferta]    = useState<any | null>(null)
  const [timerOferta,     setTimerOferta]     = useState(30)
  const [distKmOferta,    setDistKmOferta]    = useState<number | null>(null)
  const [aceitandoCorrida, setAceitandoCorrida] = useState(false)
  useEffect(() => { pedidoOfertaRef.current = pedidoOferta }, [pedidoOferta])

  // ── Oferta de entrega avulsa ───────────────────────────────────────────────
  const [avulsaOferta,     setAvulsaOferta]     = useState<any | null>(null)
  const avulsaOfertaRef    = useRef<any>(null)
  const [timerAvulsa,      setTimerAvulsa]      = useState(30)
  const [aceitandoAvulsa,  setAceitandoAvulsa]  = useState(false)
  const [emAndamentoAvulsa, setEmAndamentoAvulsa] = useState<any[]>([])
  const [toastMsg,        setToastMsg]        = useState<string | null>(null)
  const [corridaConcluida, setCorridaConcluida] = useState<any | null>(null)
  const [avancandoEtapa,   setAvancandoEtapa]   = useState(false)
  const [raioKm,           setRaioKm]           = useState<number>(12)
  const [salvandoRaio,     setSalvandoRaio]     = useState(false)
  const [raioOpen,         setRaioOpen]         = useState(false)
  const [raioDisplay,      setRaioDisplay]      = useState<number>(12)
  const [fotoMotoboy,      setFotoMotoboy]      = useState<string | null>(null)
  const [sosModal,         setSosModal]         = useState(false)
  const [maxPedidosGlobal, setMaxPedidosGlobal] = useState(2)
  const [limitePedidosMotoboy, setLimitePedidosMotoboy] = useState<number | null>(null)
  const maxPedidos = limitePedidosMotoboy ?? maxPedidosGlobal

  // loadPedidos é criada uma vez e reusada pelo setInterval de 15s (efeito só depende de
  // motoboy_id) — sem refs, ela ficaria presa nos valores de myLat/myLng/raioKm do
  // primeiro render pra sempre. Mesmo padrão já usado pra myLatRef no mapa.
  const myLatPedidosRef = useRef(myLat)
  const myLngPedidosRef = useRef(myLng)
  const raioKmRef       = useRef(raioKm)
  // cidade_fixa (2026-09-26): motoboy que sempre atende uma cidade específica, mesmo
  // fisicamente fora dela no momento (ex: Amanda Bastos ↔ Aragoiânia) — ver
  // migration-motoboy-cidade-fixa.sql e a mesma regra em escalada/route.ts e
  // loja/status-pedido/route.ts.
  const cidadeFixaRef   = useRef<string | null>(null)
  useEffect(() => { myLatPedidosRef.current = myLat; myLngPedidosRef.current = myLng }, [myLat, myLng])
  useEffect(() => { raioKmRef.current = raioKm }, [raioKm])
  const [segundoAberto,    setSegundoAberto]    = useState(false)
  const [disponiveisAberto, setDisponiveisAberto] = useState(false)
  // Antes, entregas avulsas em andamento só apareciam na gaveta de baixo — que fica
  // completamente oculta enquanto existe uma corrida ativa (pedido normal). Resultado: o
  // motoboy aceitava um pedido normal + uma avulsa e a avulsa "sumia" até ele terminar o
  // pedido normal. Esse badge flutuante mostra a avulsa mesmo com corrida ativa.
  const [avulsaFlutuanteAberta, setAvulsaFlutuanteAberta] = useState(false)

  // ── Carrega config de max pedidos (usada só se o motoboy não tiver limite próprio) ──
  useEffect(() => {
    supabase.from("configuracoes")
      .select("valor")
      .eq("chave", "max_pedidos_motoboy")
      .single()
      .then(({ data }) => { if (data?.valor) setMaxPedidosGlobal(parseInt(data.valor, 10)) })
  }, [])

  // ── Carrega motoboy ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!motoboy_id) return
    // "foto" ainda não existe na tabela motoboys (coluna nunca migrada — ver AGENTS.md);
    // incluí-la aqui faz o select inteiro falhar. "raio_km" já existe (migration rodada
    // em 2026-09-23).
    supabase.from("motoboys").select("disponivel, lat, lng, limite_pedidos_simultaneos, raio_km, cidade_fixa").eq("id", motoboy_id).single()
      .then(({ data }) => {
        if (data) {
          setLimitePedidosMotoboy(data.limite_pedidos_simultaneos ?? null)
          // Só sincroniza o estado do DB se não houver preferência local salva
          // (garante que a preferência do usuário não seja sobrescrita ao trocar de aba)
          const localPref = localStorage.getItem("motoboy_online")
          if (localPref === null) setDisponivel(data.disponivel)
          // App mostra "disponível" mas o banco está desligado (incidente real, 21/10/2026: lojista via
          // "nenhum motoboy disponível" com motoboy rodando): grava de novo pro despacho enxergar ele.
          if (localPref === "1" && !data.disponivel) {
            fetch("/api/motoboy/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motoboy_id, disponivel: true }) }).catch(() => {})
          }
          localStorage.setItem("motoboy_online", (localPref !== null ? localPref === "1" : data.disponivel) ? "1" : "0")
          if (data.lat)     setMyLat(data.lat)
          if (data.lng)     setMyLng(data.lng)
          if (data.raio_km) { setRaioKm(data.raio_km); setRaioDisplay(data.raio_km) }
          cidadeFixaRef.current = (data as any).cidade_fixa ?? null
        }
        setDispLoading(false)
      })
  }, [motoboy_id])

  // ── Auto-confirmação de teste de notificação ──────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (!params.get("confirmar_teste")) return
    fetch("/api/motoboy/confirmar-teste", { method: "POST", credentials: "include" }).catch(() => {})
    const url = new URL(window.location.href)
    url.searchParams.delete("confirmar_teste")
    window.history.replaceState({}, "", url.toString())
  }, [])

  // ── Teste de corrida (notificação fictícia) ───────────────────────────────
  const [mostrarObrigadoTeste, setMostrarObrigadoTeste] = useState(false)

  function mostrarFakeCorrida() {
    setPedidoOferta({
      _isTeste: true,
      id: "corrida-teste",
      codigo: "TESTE1",
      taxa_entrega: 8.50,
      forma_pagamento: "pix",
      endereco_entrega: "Quadra 14 Lote 24, Sonia Rodrigues — Aragoiânia",
      itens: [{ id: "1" }, { id: "2" }, { id: "3" }],
      loja: {
        nome: "Loja Teste",
        endereco: "Rua Pedro Nestor Pereira, 01 — Aragoiânia",
      },
    })
    setTimerOferta(30)
    setDistKmOferta(2.3)
  }

  // Verifica URL param corrida_teste (funciona no mount e no visibilitychange)
  function checkCorridaTesteUrl() {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (!params.get("corrida_teste")) return
    const url = new URL(window.location.href)
    url.searchParams.delete("corrida_teste")
    window.history.replaceState({}, "", url.toString())
    mostrarFakeCorrida()
  }

  // Verifica URL param pedido_id (corrida real vinda de notificação)
  function checkPedidoUrl() {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const pedidoId = params.get("pedido_id")
    if (!pedidoId || dismissedIdsRef.current.has(pedidoId)) return
    const url = new URL(window.location.href)
    url.searchParams.delete("pedido_id")
    window.history.replaceState({}, "", url.toString())
    supabase.from("pedidos")
      .select("*, loja_lat, loja_lng, loja:lojas(nome, endereco, telefone, lat, lng), itens:itens_pedido(*)")
      .eq("id", pedidoId)
      .single()
      .then(({ data }) => {
        if (data && !dismissedIdsRef.current.has(data.id)) {
          setPedidoOferta(data); setTimerOferta(30); setDistKmOferta(null)
        }
      })
  }

  // Checa na montagem (corrida_teste + pedido_id)
  useEffect(() => { checkCorridaTesteUrl(); checkPedidoUrl() }, [])

  // Checa quando o app volta ao foco (iOS: SW navega para URL com param)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== "visible") return
      checkCorridaTesteUrl()
      checkPedidoUrl()
    }
    document.addEventListener("visibilitychange", handler)
    return () => document.removeEventListener("visibilitychange", handler)
  }, [])

  // Listener SW para postMessage "corrida-teste" — sem dep de motoboy_id
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "corrida-teste") mostrarFakeCorrida()
    }
    navigator.serviceWorker?.addEventListener("message", handler)
    return () => navigator.serviceWorker?.removeEventListener("message", handler)
  }, [])

  // ── Ganhos do dia ──────────────────────────────────────────────────────────
  // Soma pedidos regulares + entregas avulsas entregues hoje
  useEffect(() => {
    if (!motoboy_id) return
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const desde = hoje.toISOString()
    Promise.all([
      supabase.from("pedidos")
        .select("taxa_entrega, taxa_dinamica, criado_em")
        .eq("motoboy_id", motoboy_id)
        .eq("status", "entregue")
        .gte("criado_em", desde),
      supabase.from("entregas_avulsas")
        .select("taxa_entrega, criado_em")
        .eq("motoboy_id", motoboy_id)
        .eq("status", "entregue")
        .gte("criado_em", desde),
    ]).then(([{ data: pedidosData }, { data: avulsasData }]) => {
      const pedidos = pedidosData ?? []
      const avulsas = avulsasData ?? []
      setGanhosDia([...pedidos, ...avulsas].reduce((s: number, p: any) => s + ganhoMotoboyPedido(p), 0))
      setCorridasDia(pedidos.length + avulsas.length)
    })
  }, [motoboy_id])

  // ── Injeta CSS de animação pulse (uma vez) ────────────────────────────────
  useEffect(() => {
    if (document.getElementById("moto-pulse-css")) return
    const s = document.createElement("style")
    s.id = "moto-pulse-css"
    s.textContent = `
      @keyframes motoPulse {
        0%   { transform: scale(1);   opacity: 0.8; }
        50%  { transform: scale(2.2); opacity: 0;   }
        100% { transform: scale(1);   opacity: 0.8; }
      }
      @keyframes slideUpCard {
        from { transform: translateY(100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
      @keyframes timerPulse {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.4; }
      }
    `
    document.head.appendChild(s)
  }, [])

  // ── Mensagem do SW: "nova-corrida" ao clicar na notificação ─────────────
  useEffect(() => {
    if (!motoboy_id) return
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "nova-corrida") return
      const pedidoId = event.data.pedido_id
      if (!pedidoId || dismissedIdsRef.current.has(pedidoId)) return
      supabase.from("pedidos")
        .select("*, loja_lat, loja_lng, loja:lojas(nome, endereco, telefone, lat, lng), itens:itens_pedido(*)")
        .eq("id", pedidoId)
        .single()
        .then(({ data }) => {
          if (data && !dismissedIdsRef.current.has(data.id)) {
            setPedidoOferta(data); setTimerOferta(30); setDistKmOferta(null)
          }
        })
    }
    navigator.serviceWorker?.addEventListener("message", handler)
    return () => navigator.serviceWorker?.removeEventListener("message", handler)
  }, [motoboy_id])

  // ── Limpa GPS ao fechar o browser (não altera disponivel) ────────────────
  useEffect(() => {
    if (!motoboy_id) return
    const handle = () => {
      const data = JSON.stringify({ motoboy_id })
      navigator.sendBeacon?.("/api/motoboy-offline", new Blob([data], { type: "application/json" }))
    }
    window.addEventListener("beforeunload", handle)
    return () => window.removeEventListener("beforeunload", handle)
  }, [motoboy_id])

  // ── Raio de atuação ────────────────────────────────────────────────────────
  // Mesmo cuidado do toggleDisponivel logo abaixo: se essa gravação falhar, o raio_km
  // usado pelo despacho ativo (escalada) e pelo push continua sendo o ANTIGO no banco,
  // divergindo do que o app mostra/usa localmente pro filtro da lista passiva.
  async function salvarRaio(km: number) {
    if (!motoboy_id) return
    const anterior = raioKm
    setSalvandoRaio(true)
    setRaioKm(km)
    try {
      const res = await fetch("/api/motoboy/status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motoboy_id, raio_km: km }),
      })
      if (!res.ok) throw new Error("status " + res.status)
    } catch {
      setRaioKm(anterior)
      setToastMsg("Não foi possível salvar o raio. Verifique sua conexão e tente de novo.")
      setTimeout(() => setToastMsg(null), 3500)
    } finally {
      setSalvandoRaio(false)
    }
  }

  // ── Toggle disponível ──────────────────────────────────────────────────────
  // O request pra API é o que persiste "disponivel" no banco — e é esse campo que
  // escalada/route.ts e os avisos de push (avisarMotoboysPedidoAceito/Pronto) usam pra
  // decidir quem é candidato a receber uma corrida. Antes, o código atualizava o
  // estado local (e a UI mostrava "online") mesmo se essa requisição falhasse — bug
  // real encontrado, 2026-09-27: uma falha de rede nesse exato momento deixava o
  // motoboy com o toggle mostrando "disponível" no aparelho dele, mas "indisponível"
  // no banco, invisível pra escalada ativa e pra push, mesmo abrindo o app numa
  // conexão melhor depois (a lista passiva de "pronto" continuava funcionando
  // normalmente pra ele, então nada parecia errado — só ele nunca era chamado/avisado).
  async function toggleDisponivel() {
    if (!motoboy_id) return
    setTogglingDisp(true)
    const novo = !disponivel
    try {
      const res = await fetch("/api/motoboy/status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motoboy_id, disponivel: novo }),
      })
      // Sessão vencida (o login vale 30 dias): manda entrar de novo em vez de pedir pra
      // tentar de novo pra sempre (Gustavo Alves, 31/10/2026, parado desde 05/09).
      if (res.status === 401) { setToastMsg("Seu acesso venceu. Entre de novo para ficar online."); await logout(); window.location.href = "/entrar/motoboy"; return }
      if (!res.ok) throw new Error("status " + res.status)
      setDisponivel(novo)
      localStorage.setItem("motoboy_online", novo ? "1" : "0")
      if (novo) setSheetH(SHEET_PEEK)
    } catch {
      // Não confirma a mudança — mantém o estado (local e no banco) como estava antes,
      // e avisa: sem isso, o toggle "mentiria" mostrando um estado que o banco não tem.
      setToastMsg("Não foi possível atualizar. Verifique sua conexão e tente de novo.")
      setTimeout(() => setToastMsg(null), 3500)
    } finally {
      setTogglingDisp(false)
    }
  }

  // ── Pedidos ────────────────────────────────────────────────────────────────
  // try/finally em volta de tudo: sem isso, uma falha de rede em QUALQUER uma das 3
  // queries (timeout, instabilidade) derrubava uma exceção não tratada no meio da
  // função e isLoadingPedidosRef.current nunca voltava pra false — a guarda do topo
  // então bloqueava silenciosamente TODO polling seguinte pro resto da sessão do app,
  // travando o motoboy vendo só a corrida que já tinha aceito, sem nunca mais receber
  // as próximas "pronto" (só resolvia fechando e reabrindo o app). Bug real reportado.
  async function loadPedidos() {
    if (!motoboy_id || isLoadingPedidosRef.current) return
    isLoadingPedidosRef.current = true
    try {
      const [
        { data: prontosData },
        { data: andamentoData, error: andamentoError },
        { data: ofertaData },
      ] = await Promise.all([
        supabase.from("pedidos")
          .select("*, itens:itens_pedido(*), loja:lojas(nome, endereco, telefone, lat, lng, cidade)")
          .eq("status", "pronto").is("motoboy_id", null)
          .not("endereco_entrega", "ilike", "%Retirada%") // retirada na loja nunca precisa de motoboy
          .order("criado_em", { ascending: true }),
        supabase.from("pedidos")
          .select("*, itens:itens_pedido(*), loja:lojas(nome, endereco, telefone, lat, lng, cidade)")
          .in("status", ["indo_para_loja", "na_loja", "em_rota", "coletado"])
          .eq("motoboy_id", motoboy_id)
          .order("criado_em", { ascending: true }),
        // Polling de fallback: busca oferta de corrida mesmo sem realtime ativo
        // Inclui a corrida que o admin despachou direto pra ele (21/10/2026): antes só chegava pela
        // notificação; se ele fechasse e reabrisse o app, a oferta sumia.
        supabase.from("pedidos")
          .select("*, loja_lat, loja_lng, loja:lojas(nome, endereco, telefone, lat, lng, cidade), itens:itens_pedido(*)")
          .eq("status", "aguardando_aceite").or(`motoboy_id.is.null,motoboy_id.eq.${motoboy_id}`)
          .limit(5),
      ])

      // Filtra pela distância até o raio configurado pelo motoboy — mesma regra do
      // despacho ativo (escalada), só que aplicada no lado do cliente aqui porque é uma
      // lista que o motoboy vê e aceita sozinho (sem escalada envolvida). Só filtra
      // quando já temos GPS real do motoboy e coordenada real da loja; sem isso, mostra
      // tudo (mesmo fallback seguro usado em escalada/route.ts).
      const temGpsReal = myLatPedidosRef.current !== DEFAULT_LAT || myLngPedidosRef.current !== DEFAULT_LNG
      const todosProntos = (prontosData as Pedido[]) ?? []
      const novosProntos = temGpsReal
        ? todosProntos.filter(p => {
            const ll = (p as any).loja
            if (cidadeFixaRef.current && ll?.cidade && ll.cidade === cidadeFixaRef.current) return true
            if (!ll?.lat || !ll?.lng) return true
            const dist = haversineKm(myLatPedidosRef.current, myLngPedidosRef.current, ll.lat, ll.lng)
            return dist <= (raioKmRef.current || 12)
          })
        : todosProntos
      const novosIds = new Set(novosProntos.map(p => p.id))
      if (!isFirstLoad.current) {
        const chegaram = [...novosIds].filter(id => !prevProntosRef.current.has(id))
        if (chegaram.length > 0) { playNotificationSound(); setSheetH(SHEET_MID) }
      }
      prevProntosRef.current = novosIds
      isFirstLoad.current    = false
      setProntos(novosProntos)
      // Só atualiza emAndamento se não retornou erro E (tem dados OU não acabamos de aceitar)
      if (!andamentoError) {
        let dados = (andamentoData as Pedido[]) ?? []
        // Reaplica a ordem escolhida em "Priorizar esta entrega" — a query sempre volta
        // ordenada por criado_em, então sem isso a próxima atualização (a cada 15s)
        // desfazia a priorização manual do motoboy.
        const ordem = prioridadeManualRef.current
        if (ordem.length > 0) {
          const porId = new Map(dados.map(p => [p.id, p]))
          const ordenados = ordem.map(id => porId.get(id)).filter((p): p is Pedido => !!p)
          const restantes = dados.filter(p => !ordem.includes(p.id))
          dados = [...ordenados, ...restantes]
          prioridadeManualRef.current = dados.map(p => p.id)
        }
        if (dados.length > 0 || !justAcceptedRef.current) {
          setEmAndamento(dados)
        }
      }
      // Polling fallback: exibe oferta se realtime perdeu o evento — toca o mesmo
      // som de alerta do caminho realtime, senão a corrida aparece muda quando o
      // WebSocket cai (comum com o app em segundo plano ou rede instável).
      if (!pedidoOfertaRef.current && ofertaData && ofertaData.length > 0) {
        const oferta = ofertaData.find((o: any) => o.motoboy_id === motoboy_id && !dismissedIdsRef.current.has(o.id)) ?? ofertaData[0]
        const designada = (oferta as any).motoboy_id === motoboy_id
        const ofertaLl = (oferta as any).loja
        const ofertaDentroDoRaio = (cidadeFixaRef.current && ofertaLl?.cidade && ofertaLl.cidade === cidadeFixaRef.current)
          || !temGpsReal || !ofertaLl?.lat || !ofertaLl?.lng
          || haversineKm(myLatPedidosRef.current, myLngPedidosRef.current, ofertaLl.lat, ofertaLl.lng) <= (raioKmRef.current || 12)
        if (!dismissedIdsRef.current.has(oferta.id) && (designada || ofertaDentroDoRaio)) {
          playNotificationSound()
          setPedidoOferta(oferta); setTimerOferta(30); setDistKmOferta(null)
        }
      }
      setPedidosLoading(false)
      // Auto-expande o sheet quando há pedidos
      if (novosProntos.length > 0 || (andamentoData ?? []).length > 0) {
        setSheetH(h => Math.max(h, SHEET_MID))
      }
    } catch (e) {
      console.error("[loadPedidos] falhou, tentando de novo no próximo ciclo:", e)
    } finally {
      isLoadingPedidosRef.current = false
    }
  }

  useEffect(() => {
    if (!motoboy_id) return
    loadPedidos()
    const iv = setInterval(loadPedidos, 15_000)
    return () => clearInterval(iv)
  }, [motoboy_id])

  // Ref sempre atualizado pra loadPedidos — os dois handlers abaixo (visibilitychange e
  // online) rodam num efeito de montagem única (sem depender de motoboy_id), então
  // chamar a função direto pegaria uma closure presa no motoboy_id da primeira renderização.
  const loadPedidosRef = useRef(loadPedidos)
  useEffect(() => { loadPedidosRef.current = loadPedidos })

  // "Catch-up" ao voltar de segundo plano ou reconectar a rede — sem isso, se o socket
  // do Realtime ou o polling de 15s morrerem silenciosamente enquanto o app fica em
  // segundo plano (o navegador pode suspender timers/rede nesse estado), o motoboy só
  // recuperava a lista certa no próximo ciclo de 15s (se o polling tivesse sobrevivido)
  // ou nunca (se o Realtime não reconectasse sozinho). Isso busca o estado real assim
  // que há qualquer sinal de que a conexão pode ter voltado — não substitui o polling
  // nem o Realtime, só fecha o intervalo entre "voltou" e "o próximo ciclo agendado".
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") loadPedidosRef.current()
    }
    function onOnline() { loadPedidosRef.current() }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", onOnline)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", onOnline)
    }
  }, [])

  // ── Supabase Realtime — escuta oferta de corrida (broadcast) ──────────────
  useEffect(() => {
    if (!motoboy_id || !disponivel) return

    // Fora do raio configurado pelo motoboy, ignora a oferta — mesma regra do despacho
    // ativo (escalada) e da lista passiva de "pronto", aplicada aqui pro caminho de
    // realtime/broadcast, que é o principal (loadPedidos é só o fallback de polling).
    function dentroDoRaio(pedido: any): boolean {
      const ll = pedido?.loja
      if (cidadeFixaRef.current && ll?.cidade && ll.cidade === cidadeFixaRef.current) return true
      const temGpsReal = myLatPedidosRef.current !== DEFAULT_LAT || myLngPedidosRef.current !== DEFAULT_LNG
      if (!temGpsReal || !ll?.lat || !ll?.lng) return true
      return haversineKm(myLatPedidosRef.current, myLngPedidosRef.current, ll.lat, ll.lng) <= (raioKmRef.current || 12)
    }

    // Verifica oferta pendente já existente ao entrar (broadcast: motoboy_id null)
    supabase.from("pedidos")
      .select("*, loja_lat, loja_lng, loja:lojas(nome, endereco, telefone, lat, lng, cidade), itens:itens_pedido(*)")
      .or(`motoboy_id.is.null,motoboy_id.eq.${motoboy_id}`)
      .eq("status", "aguardando_aceite")
      .limit(5)
      .then(({ data }) => {
        // A despachada direto pra ele vem primeiro e não depende do raio
        const o = (data ?? []).find((x: any) => x.motoboy_id === motoboy_id && !dismissedIdsRef.current.has(x.id))
          ?? (data ?? []).find((x: any) => !x.motoboy_id && !dismissedIdsRef.current.has(x.id) && dentroDoRaio(x))
        if (o) {
          playNotificationSound()
          setPedidoOferta(o); setTimerOferta(30); setDistKmOferta(null)
        }
      })

    const ch = supabase.channel(`oferta-broadcast-${motoboy_id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "pedidos",
        filter: `status=eq.aguardando_aceite`,
      }, payload => {
        const novo = payload.new as any
        // Pedidos broadcast (sem motoboy) ou despachados direto pra ele
        if (novo?.motoboy_id !== null && novo?.motoboy_id !== motoboy_id) return
        if (dismissedIdsRef.current.has(novo.id)) return
        // Mesmo pedido reoferecido várias vezes seguidas: busca no máximo 1x a cada 20 s
        const agoraMs = Date.now(), ultimaBusca = buscouOfertaRef.current.get(novo.id) ?? 0
        if (agoraMs - ultimaBusca < 20_000) return
        buscouOfertaRef.current.set(novo.id, agoraMs)
        supabase.from("pedidos")
          .select("*, loja_lat, loja_lng, loja:lojas(nome, endereco, telefone, lat, lng, cidade), itens:itens_pedido(*)")
          .eq("id", novo.id).single()
          .then(({ data }) => {
            if (data && !dismissedIdsRef.current.has(data.id) && (data.motoboy_id === motoboy_id || dentroDoRaio(data))) {
              playNotificationSound(); setPedidoOferta(data); setTimerOferta(30); setDistKmOferta(null)
            }
          })
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [motoboy_id, disponivel])

  // ── Realtime: nova corrida "pronto" (lista passiva) ────────────────────────
  // Até 2026-09-27 essa lista só era atualizada pelo polling de 15s (loadPedidos) —
  // sem nenhum caminho em tempo real. Bug real reportado: corrida apareceu num
  // celular e não em outro, mesmo com a tela aberta esperando — se o polling travar
  // (rede instável, throttling do browser em segundo plano) num aparelho específico,
  // não existia nenhum outro sinal pra corrigir isso. loadPedidos() continua rodando
  // como fallback (mesmo princípio já usado no caminho de oferta/aguardando_aceite).
  useEffect(() => {
    if (!motoboy_id || !disponivel) return

    function dentroDoRaio(loja: any): boolean {
      if (cidadeFixaRef.current && loja?.cidade && loja.cidade === cidadeFixaRef.current) return true
      const temGpsReal = myLatPedidosRef.current !== DEFAULT_LAT || myLngPedidosRef.current !== DEFAULT_LNG
      if (!temGpsReal || !loja?.lat || !loja?.lng) return true
      return haversineKm(myLatPedidosRef.current, myLngPedidosRef.current, loja.lat, loja.lng) <= (raioKmRef.current || 12)
    }

    const ch = supabase.channel(`pronto-broadcast-${motoboy_id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "pedidos",
        filter: `status=eq.pronto`,
      }, payload => {
        const novo = payload.new as any
        if (novo?.motoboy_id !== null) return
        if (novo?.endereco_entrega?.toLowerCase?.().includes("retirada")) return
        supabase.from("pedidos")
          .select("*, itens:itens_pedido(*), loja:lojas(nome, endereco, telefone, lat, lng, cidade)")
          .eq("id", novo.id).single()
          .then(({ data }) => {
            // Reconfirma no momento da busca — pode ter mudado de novo enquanto buscava
            if (!data || data.status !== "pronto" || data.motoboy_id) return
            if (!dentroDoRaio((data as any).loja)) return
            setProntos(prev => {
              if (prev.some(p => p.id === data.id)) return prev
              return [...prev, data as Pedido]
            })
            // Sincroniza com o rastreador do polling — senão o próximo ciclo de loadPedidos
            // acha que essa corrida "acabou de chegar" de novo e toca o som duplicado.
            prevProntosRef.current = new Set([...prevProntosRef.current, data.id])
            playNotificationSound()
            setSheetH(h => Math.max(h, SHEET_MID))
          })
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [motoboy_id, disponivel])

  // ── Realtime: remove da lista "pronto" assim que outro motoboy aceita ──────
  // Um canal por corrida atualmente exibida (mesmo padrão de "oferta-aceita" abaixo,
  // aplicado por item) — sincroniza a remoção pros demais motoboys quase instantaneamente,
  // em vez de esperar até 15s pro próximo polling perceber que ela sumiu.
  const prontosIdsKey = prontos.map(p => p.id).join(",")
  useEffect(() => {
    if (!disponivel || prontos.length === 0) return
    const canais = prontos.map(p => supabase.channel(`pronto-sai-${p.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "pedidos",
        filter: `id=eq.${p.id}`,
      }, payload => {
        const novo = payload.new as any
        if (novo.status !== "pronto" || novo.motoboy_id) {
          setProntos(prev => prev.filter(x => x.id !== novo.id))
        }
      })
      .subscribe()
    )
    return () => { canais.forEach(ch => supabase.removeChannel(ch)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prontosIdsKey já resume os ids presentes; usar `prontos` na lista causaria recriar os canais a cada poll (mesmo conteúdo, array novo) sem mudar o resultado.
  }, [disponivel, prontosIdsKey])

  // ── Detecta quando outro motoboy aceita a oferta exibida ──────────────────
  useEffect(() => {
    if (!pedidoOferta || !motoboy_id) return
    const pedidoId = pedidoOferta.id
    const ch = supabase.channel(`oferta-aceita-${pedidoId}-${motoboy_id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "pedidos",
        filter: `id=eq.${pedidoId}`,
      }, payload => {
        const novo = payload.new as any
        if (novo?.status !== "aguardando_aceite") {
          setPedidoOferta(null)
          dismissedIdsRef.current.add(pedidoId)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [pedidoOferta?.id, motoboy_id])

  // ── Timer regressivo da oferta ─────────────────────────────────────────────
  useEffect(() => {
    if (!pedidoOferta) return
    if (timerOferta <= 0) {
      // Timeout — escalada para próximo motoboy
      const ofertaId = pedidoOferta.id
      setPedidoOferta(null)
      dismissedIdsRef.current.add(ofertaId)
      fetch("/api/motoboy/recusar-corrida", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: ofertaId, por_tempo: true }),
      }).catch(() => {})
      return
    }
    const iv = setInterval(() => setTimerOferta(t => t - 1), 1000)
    return () => clearInterval(iv)
  }, [pedidoOferta, timerOferta])

  // ── Geocoding da entrega para calcular distância ───────────────────────────
  useEffect(() => {
    if (!pedidoOferta || !myLat || !myLng) return
    geocodeAddress(pedidoOferta.endereco_entrega ?? "").then(ll => {
      if (ll) setDistKmOferta(haversineKm(myLat, myLng, ll[0], ll[1]))
    })
  }, [pedidoOferta?.id])

  // Mantém ref sincronizado para uso nos callbacks do Realtime
  useEffect(() => { avulsaOfertaRef.current = avulsaOferta }, [avulsaOferta])

  // ── Verifica avulsa pendente ao abrir o app + polling a cada 10s ────────
  useEffect(() => {
    if (!motoboy_id) return
    async function checkAvulsa() {
      const { data } = await supabase.from("entregas_avulsas")
        .select("*").eq("status", "aguardando").order("criado_em", { ascending: false }).limit(1)
      if (data && data.length > 0 && !dismissedIdsRef.current.has(data[0].id) && !avulsaOfertaRef.current) {
        setAvulsaOferta(data[0]); setTimerAvulsa(30); playNotificationSound()
      }
    }
    checkAvulsa()
    const iv = setInterval(checkAvulsa, 10_000)
    return () => clearInterval(iv)
  }, [motoboy_id])

  // ── Supabase Realtime — broadcast de entrega avulsa ───────────────────────
  useEffect(() => {
    if (!motoboy_id || !disponivel) return

    // Carrega avulsas em andamento deste motoboy
    supabase.from("entregas_avulsas")
      .select("*")
      .eq("motoboy_id", motoboy_id)
      .in("status", ["aceito", "coletado", "em_rota"])
      .then(({ data }) => { setEmAndamentoAvulsa(data ?? []) })

    const ch = supabase.channel(`avulsa-all-${motoboy_id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "entregas_avulsas",
      }, payload => {
        const novo = payload.new as any
        if (novo?.status === "aguardando" && !dismissedIdsRef.current.has(novo.id)) {
          playNotificationSound(); setAvulsaOferta(novo); setTimerAvulsa(30)
        }
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "entregas_avulsas",
      }, payload => {
        const novo = payload.new as any
        if (novo?.status === "aceito") {
          if (novo.motoboy_id === motoboy_id) {
            // Este motoboy aceitou
            setEmAndamentoAvulsa(prev => [...prev.filter((a: any) => a.id !== novo.id), novo])
            if (avulsaOfertaRef.current?.id === novo.id) setAvulsaOferta(null)
          } else if (avulsaOfertaRef.current?.id === novo.id) {
            // Outro motoboy aceitou antes
            setAvulsaOferta(null)
            setToastMsg("Entrega aceita por outro motoboy.")
            setTimeout(() => setToastMsg(null), 3000)
          }
        } else if (["coletado", "em_rota"].includes(novo?.status) && novo.motoboy_id === motoboy_id) {
          setEmAndamentoAvulsa(prev => {
            const sem = prev.filter((a: any) => a.id !== novo.id)
            return [...sem, novo]
          })
        } else if (novo?.status === "entregue" && novo.motoboy_id === motoboy_id) {
          setEmAndamentoAvulsa(prev => prev.filter((a: any) => a.id !== novo.id))
          setGanhosDia(g => g + ganhoMotoboyPedido(novo))
          setCorridasDia(c => c + 1)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [motoboy_id, disponivel])

  // ── Timer regressivo da oferta avulsa ─────────────────────────────────────
  useEffect(() => {
    if (!avulsaOferta) return
    if (timerAvulsa <= 0) {
      // Broadcast: dismiss local apenas — a avulsa continua aguardando para outros motoboys
      dismissedIdsRef.current.add(avulsaOferta.id)
      setAvulsaOferta(null)
      return
    }
    const iv = setInterval(() => setTimerAvulsa(t => t - 1), 1000)
    return () => clearInterval(iv)
  }, [avulsaOferta, timerAvulsa])

  // ── Coordenadas do destino e da loja ──────────────────────────────────────
  useEffect(() => {
    if (emAndamento.length === 0) {
      setDestinoLat(null); setDestinoLng(null)
      setLojaLat(null);    setLojaLng(null)
      return
    }
    const p = emAndamento[0]

    // Destino do cliente: usa SEMPRE as coords salvas no pedido — nunca um re-geocode
    // independente aqui. Antes, sem lat_entrega/lng_entrega, o app geocodificava o texto
    // do endereço sozinho (com viés fixo pro centro de Aragoiânia, ver GEOCODE_BIAS_LAT/LNG
    // acima) — pra endereço de Guapó (ou qualquer imprecisão de geocode) isso podia
    // colocar o pino longe do endereço real, e ainda diferente da coordenada que o
    // cliente efetivamente confirmou no checkout. Bug real reportado, 2026-09-27: pino
    // no mapa do motoboy não correspondia ao endereço do cliente. Sem coordenada salva,
    // o motoboy já cai automaticamente no fallback de busca por texto (ver modal de
    // apps de navegação, `coords ? ... : q=endereço`) em vez de um pino inventado.
    if ((p as any).lat_entrega && (p as any).lng_entrega) {
      setDestinoLat((p as any).lat_entrega)
      setDestinoLng((p as any).lng_entrega)
    } else {
      setDestinoLat(null); setDestinoLng(null)
    }

    // Localização da loja: usa loja_lat/loja_lng gravados no pedido pela escalada
    // Coordenada default (-16.9146388, -49.4499148) = nunca foi configurada → geocodifica
    const DEFAULT_LAT = -16.9146388
    const isDefaultCoord = (lat: number) => Math.abs(lat - DEFAULT_LAT) < 0.0001
    const pLat = (p as any).loja_lat
    const pLng = (p as any).loja_lng
    if (pLat && pLng && !isDefaultCoord(pLat)) {
      setLojaLat(pLat)
      setLojaLng(pLng)
    } else {
      // Fallback: busca direto na tabela lojas
      const lojaId = (p as any).loja_id
      if (lojaId) {
        supabase.from("lojas").select("lat, lng, endereco").eq("id", lojaId).single()
          .then(({ data: loja }) => {
            if (loja?.lat && loja?.lng && !isDefaultCoord(loja.lat)) {
              setLojaLat(loja.lat)
              setLojaLng(loja.lng)
            } else if (loja?.endereco) {
              // Geocodifica pelo endereço quando coordenadas não foram configuradas
              geocodeAddress(loja.endereco).then(ll => {
                if (ll) { setLojaLat(ll[0]); setLojaLng(ll[1]) }
              })
            }
          })
      }
    }

    setSheetH(SHEET_MID)
  }, [emAndamento[0]?.id])

  // ── GPS tracking ───────────────────────────────────────────────────────────
  // Leituras de baixa precisão (comum logo ao abrir o app, antes do GPS "assentar" —
  // o navegador pode devolver uma posição por triangulação de rede/wifi, com erro de
  // centenas a milhares de metros) nunca substituem a última posição confiável, nem são
  // enviadas ao servidor. Sem isso, uma leitura ruim podia derrubar o filtro de raio
  // (12km) e o "disponivel"/lat/lng gravado no banco pro despacho ativo, excluindo o
  // motoboy de corridas reais até o GPS acertar de verdade — o que pode nunca acontecer
  // se o motoboy ficar parado num local com sinal ruim a sessão inteira.
  const ACCURACY_MAX_M = 500
  const sendLocation = useCallback((lat: number, lng: number) => {
    fetch("/api/motoboy/update-location", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    }).then(res => {
      if (res.status === 401) { logout().then(() => { window.location.href = "/entrar/motoboy" }) }
    }).catch(() => {})
    // Armazena no SW para envio em background sync
    navigator.serviceWorker?.controller?.postMessage({ type: "store-location", lat, lng })
  }, [logout])

  const iniciarRastreamento = useCallback(() => {
    if (!motoboy_id || !navigator.geolocation) return
    if (watchIdRef.current !== null) return
    setCompartilhando(true)
    firstGeoRef.current = true
    // Wake Lock: impede que a tela desligue e o browser suspenda a aba
    if ("wakeLock" in navigator) {
      (navigator as any).wakeLock.request("screen").then((wl: any) => {
        wakeLockRef.current = wl
        // Reaquire automaticamente se o sistema liberar (ex: bateria fraca)
        wl.addEventListener("release", () => {
          if (watchIdRef.current !== null && "wakeLock" in navigator) {
            (navigator as any).wakeLock.request("screen")
              .then((w2: any) => { wakeLockRef.current = w2 })
              .catch(() => {})
          }
        })
      }).catch(() => {})
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setGpsReady(true)
        // Descarta a leitura (não atualiza estado nem envia ao servidor) se a precisão
        // for pior que ACCURACY_MAX_M — mantém a última posição confiável até chegar
        // uma leitura melhor, em vez de confiar numa coordenada possivelmente errada.
        if (coords.accuracy != null && coords.accuracy > ACCURACY_MAX_M) return
        const { latitude: lat, longitude: lng } = coords
        const prev = lastPosRef.current
        // Ignora jitter: só atualiza estado se moveu mais de 8 metros
        const movedM = prev ? haversineKm(prev.lat, prev.lng, lat, lng) * 1000 : 999
        lastPosRef.current = { lat, lng }
        sendLocation(lat, lng)
        if (movedM > 8) {
          setMyLat(lat); setMyLng(lng)
        }
        if (firstGeoRef.current) {
          firstGeoRef.current = false
          reverseGeocode(lat, lng).then(c => { if (c) setCidadeAtual(c) })
        }
      },
      () => setCompartilhando(false),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    )
    // Envio forçado a cada 8s para garantir atualização mesmo sem mudança de GPS
    forceIvRef.current = setInterval(() => {
      if (lastPosRef.current) sendLocation(lastPosRef.current.lat, lastPosRef.current.lng)
    }, 8000)
  }, [motoboy_id, sendLocation])

  const pararRastreamento = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (forceIvRef.current !== null) { clearInterval(forceIvRef.current); forceIvRef.current = null }
    // Libera Wake Lock ao parar
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
    setCompartilhando(false)
    setCidadeAtual(null)
    if (motoboy_id) fetch("/api/motoboy/update-location", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limpar: true }) }).catch(() => {})
  }, [motoboy_id])

  // Toque no aviso "Sem GPS" (pedido do Lucas, 20/10/2026): pede a permissão de localização
  // ali mesmo e religa o rastreamento. Se o celular bloqueou, mostra como liberar — o navegador
  // não consegue abrir os Ajustes do aparelho sozinho.
  const [ajudaGps, setAjudaGps] = useState(false)
  const [ligandoGps, setLigandoGps] = useState(false)
  function ativarGps() {
    if (!navigator.geolocation) { setAjudaGps(true); return }
    setLigandoGps(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLigandoGps(false); setAjudaGps(false); setGpsReady(true)
        if (coords.accuracy == null || coords.accuracy <= ACCURACY_MAX_M) { setMyLat(coords.latitude); setMyLng(coords.longitude) }
        // Reinicia o acompanhamento (o anterior pode ter parado por erro de permissão)
        if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
        if (forceIvRef.current !== null) { clearInterval(forceIvRef.current); forceIvRef.current = null }
        iniciarRastreamento()
      },
      err => { setLigandoGps(false); if (err.code === 1) setAjudaGps(true); else { setToastMsg("Não achamos o sinal do GPS. Vá pra um lugar aberto e toque de novo."); setTimeout(() => setToastMsg(null), 3500) } },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  // Pede localização imediatamente ao carregar — centraliza o mapa na posição real.
  // Mesma guarda de precisão do watchPosition acima: uma primeira leitura ruim (comum
  // antes do GPS assentar) não deve virar a posição usada pro filtro de raio.
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGpsReady(true)
        if (coords.accuracy != null && coords.accuracy > ACCURACY_MAX_M) return
        setMyLat(coords.latitude)
        setMyLng(coords.longitude)
        reverseGeocode(coords.latitude, coords.longitude).then(c => { if (c) setCidadeAtual(c) })
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // Inicia GPS sempre que ficar online (não só durante entrega ativa)
  useEffect(() => {
    if (disponivel) iniciarRastreamento()
    else pararRastreamento()
  }, [disponivel, iniciarRastreamento, pararRastreamento])

  // Heartbeat a cada 30s quando online: também regrava disponivel=true, pra o banco nunca ficar
  // "desligado" enquanto o app mostra "disponível" (senão o despacho não chama esse motoboy)
  useEffect(() => {
    if (!motoboy_id || !disponivel) return
    const iv = setInterval(() => {
      fetch("/api/motoboy/status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motoboy_id, disponivel: true }),
      }).catch(() => {})
    }, 30_000)
    return () => clearInterval(iv)
  }, [motoboy_id, disponivel])

  useEffect(() => () => pararRastreamento(), [pararRastreamento])

  // ── Background: reinicia GPS e reaquire WakeLock ao voltar para a aba ──────
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        // Registra Background Sync para enviar última posição enquanto em background
        navigator.serviceWorker?.ready.then(sw => {
          (sw as any).sync?.register("bg-location").catch(() => {})
        }).catch(() => {})
      } else {
        // Voltou para a aba: reaquire wake lock e reinicia GPS se necessário
        if (disponivel && watchIdRef.current === null) {
          iniciarRastreamento()
        }
        if (disponivel && !wakeLockRef.current && "wakeLock" in navigator) {
          (navigator as any).wakeLock.request("screen")
            .then((wl: any) => { wakeLockRef.current = wl })
            .catch(() => {})
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [disponivel, iniciarRastreamento])

  // ── Push — registrar SW + salvar subscription do motoboy ─────────────────
  useEffect(() => {
    if (!motoboy_id) return
    // Checa status atual sem pedir permissão
    if (!("Notification" in window)) { setPushStatus("unsupported"); return }
    setPushStatus(Notification.permission as any)
    if (Notification.permission === "granted") registerPush(motoboy_id)
  }, [motoboy_id])

  async function registerPush(mid: string) {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
      const reg = await navigator.serviceWorker.register("/sw.js")
      await reg.update()
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) return
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      await fetch("/api/push", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subscribe-motoboy", motoboy_id: mid, subscription: sub }),
      })
    } catch {}
  }

  async function ativarPush() {
    if (!motoboy_id) return
    if (!("Notification" in window)) return
    const perm = await Notification.requestPermission()
    setPushStatus(perm as any)
    if (perm === "granted") await registerPush(motoboy_id)
  }

  // ── Permissões ao entrar (pedido do Lucas, 20/10/2026) ─────────────────────
  // Celular só deixa pedir notificação e liberar som depois de um toque da pessoa; por isso
  // uma tela com "Permitir tudo" que, num toque, pede localização, notificação e destrava o som.
  type EstadoPerm = "ok" | "negado" | "pendente" | "sem_suporte"
  const [perm, setPerm] = useState<{ loc: EstadoPerm; notif: EstadoPerm; som: EstadoPerm }>({ loc: "pendente", notif: "pendente", som: "pendente" })
  const [telaPerm, setTelaPerm] = useState(false)
  const [pedindoPerm, setPedindoPerm] = useState(false)
  const [erroLoc, setErroLoc] = useState<string | null>(null)
  const ehIphone = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)
  useEffect(() => {
    let vivo = true
    async function conferir() {
      let loc: EstadoPerm = "pendente"
      try {
        const st = await (navigator as any).permissions?.query({ name: "geolocation" })
        if (st?.state === "granted") loc = "ok"; else if (st?.state === "denied") loc = "negado"
      } catch {}
      const notif: EstadoPerm = !("Notification" in window) ? "sem_suporte" : Notification.permission === "granted" ? "ok" : Notification.permission === "denied" ? "negado" : "pendente"
      const som: EstadoPerm = sessionStorage.getItem("mb_som_ok") === "1" ? "ok" : "pendente"
      if (!vivo) return
      setPerm({ loc, notif, som })
      const dispensou = sessionStorage.getItem("mb_perm_agora_nao") === "1"
      if (!dispensou && (loc !== "ok" || notif === "pendente" || notif === "negado")) setTelaPerm(true)
    }
    conferir()
    return () => { vivo = false }
  }, [])
  // Cada permissão também pode ser ativada sozinha pelo botão "Ativar" (layout da proposta).
  const [ativando, setAtivando] = useState<null | "loc" | "notif" | "som">(null)
  function ativarSom() {
    try { desbloquearAudioNotificacao(); beep(); sessionStorage.setItem("mb_som_ok", "1") } catch {}
    setPerm(p => ({ ...p, som: "ok" }))
  }
  function permitirTudo(so?: "loc" | "notif" | "som") {
    if (so === "som") { ativarSom(); return }
    setPedindoPerm(true); setAtivando(so ?? null)
    // 1) som: destrava dentro do toque e toca um bipe curto pra confirmar
    if (!so) ativarSom()
    // 2) notificação primeiro, ainda dentro do toque (Safari exige o toque pra perguntar).
    // 3) localização SÓ DEPOIS da resposta: o iPhone mostra uma pergunta por vez e, se as duas
    //    vinham juntas, recusava sozinho a de localização (bug achado pelo Lucas, 20/10/2026).
    const pedirNotif = (): Promise<void> => ("Notification" in window && Notification.permission === "default")
      ? Notification.requestPermission().then(r => {
          setPushStatus(r as any)
          setPerm(p => ({ ...p, notif: r === "granted" ? "ok" : r === "denied" ? "negado" : "pendente" }))
          if (r === "granted" && motoboy_id) registerPush(motoboy_id)
        }).catch(() => {})
      : Promise.resolve().then(() => {
          // já respondida antes: só atualiza a lista (e garante a inscrição do push)
          if (!("Notification" in window)) return
          const r = Notification.permission
          setPushStatus(r as any)
          setPerm(p => ({ ...p, notif: r === "granted" ? "ok" : r === "denied" ? "negado" : "pendente" }))
          if (r === "granted" && motoboy_id) registerPush(motoboy_id)
        })
    const pedirLoc = () => new Promise<void>(res => {
      if (!navigator.geolocation) { setPerm(p => ({ ...p, loc: "sem_suporte" })); return res() }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          setPerm(p => ({ ...p, loc: "ok" })); setErroLoc(null); setGpsReady(true)
          if (coords.accuracy == null || coords.accuracy <= ACCURACY_MAX_M) { setMyLat(coords.latitude); setMyLng(coords.longitude) }
          if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
          if (forceIvRef.current !== null) { clearInterval(forceIvRef.current); forceIvRef.current = null }
          if (disponivel) iniciarRastreamento()
          res()
        },
        err => { setErroLoc(`${err.code}: ${err.message}`); setPerm(p => ({ ...p, loc: err.code === 1 ? "negado" : "pendente" })); res() },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      )
    })
    const fim = () => { setPedindoPerm(false); setAtivando(null) }
    if (so === "notif") { pedirNotif().finally(fim); return }
    if (so === "loc") { pedirLoc().finally(fim); return }
    pedirNotif().then(pedirLoc).finally(fim)
  }

  // ── Push — ouvir mensagem do SW para tocar som em segundo plano ───────────
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    function onSwMsg(e: MessageEvent) {
      if (e.data?.type === "push-received" && e.data?.isMotoboy) {
        playNotificationSound()
      }
    }
    navigator.serviceWorker.addEventListener("message", onSwMsg)
    return () => navigator.serviceWorker.removeEventListener("message", onSwMsg)
  }, [])

  // ── Push — enviar notificação ao cliente ──────────────────────────────────
  async function enviarPush(pedido_id: string, status: string, codigo: string) {
    try {
      await fetch("/api/push", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", pedido_id, status, codigo }),
      })
    } catch {}
  }

  // ── Aceitar / Entregar ─────────────────────────────────────────────────────
  async function aceitarEntrega(pedido: Pedido) {
    if (!motoboy_id) return
    // Verifica limite antes de tentar aceitar
    const ativos = emAndamento.filter(p =>
      ["indo_para_loja","na_loja","em_rota","coletado","aguardando_aceite"].includes(p.status)
    )
    if (ativos.length >= maxPedidos) {
      setToastMsg(`Limite de ${maxPedidos} entregas simultâneas atingido`)
      setTimeout(() => setToastMsg(null), 3000)
      return
    }
    setAtualizando(pedido.id)
    // Mesma rota da oferta: o servidor confere limite, retirada e se ninguém pegou antes
    const res = await fetch("/api/motoboy/aceitar-corrida", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: pedido.id, da_lista: true }),
    }).catch(() => null)
    const error = !res || !res.ok
    if (!error) {
      justAcceptedRef.current = true
      setTimeout(() => { justAcceptedRef.current = false }, 30_000)
      setEmAndamento(prev => [...prev, { ...pedido, status: "indo_para_loja" as any, motoboy_id }])
      setDisponiveisAberto(false)
      setSheetH(SHEET_MID)
    } else {
      setToastMsg("Pedido já foi aceito por outro motoboy")
      setTimeout(() => setToastMsg(null), 3000)
    }
    loadPedidos()
    setAtualizando(null)
  }

  // ── Aceitar corrida (atômico — protege contra dois motoboys) ──────────────
  async function aceitarCorrida() {
    if (!pedidoOferta || !motoboy_id) return
    if (pedidoOferta._isTeste) {
      setPedidoOferta(null)
      setMostrarObrigadoTeste(true)
      setTimeout(() => setMostrarObrigadoTeste(false), 6000)
      return
    }
    setAceitandoCorrida(true)
    const res = await fetch("/api/motoboy/aceitar-corrida", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: pedidoOferta.id, motoboy_id }),
    })
    setAceitandoCorrida(false)
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) {
      setToastMsg(res.status === 409 ? "Corrida já foi aceita por outro motoboy." : (json.error ?? "Erro ao aceitar corrida."))
      dismissedIdsRef.current.add(pedidoOferta.id)
      setPedidoOferta(null)
      setTimeout(() => setToastMsg(null), 3500)
      return
    }
    // Atualiza estado local imediatamente (optimistic)
    justAcceptedRef.current = true
    setTimeout(() => { justAcceptedRef.current = false }, 30_000)
    const pedidoAceito = { ...pedidoOferta, status: "indo_para_loja" as any, motoboy_id }
    setEmAndamento([pedidoAceito])
    setSheetH(SHEET_MID)
    setPedidoOferta(null)
    loadPedidos()
  }

  // ── Recusar corrida ────────────────────────────────────────────────────────
  async function recusarCorrida() {
    if (!pedidoOferta || !motoboy_id) return
    if (pedidoOferta._isTeste) { setPedidoOferta(null); return }
    const ofertaId = pedidoOferta.id
    setPedidoOferta(null)
    dismissedIdsRef.current.add(ofertaId)
    // Servidor conta a recusa, oferece ao próximo motoboy ou devolve pra fila
    await fetch("/api/motoboy/recusar-corrida", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: ofertaId }),
    }).catch(() => {})
  }

  // ── Aceitar entrega avulsa ────────────────────────────────────────────────
  async function aceitarAvulsa() {
    if (!avulsaOferta || !motoboy_id) return
    setAceitandoAvulsa(true)
    const res = await fetch("/api/motoboy/aceitar-avulsa", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avulsa_id: avulsaOferta.id, motoboy_id }),
    })
    setAceitandoAvulsa(false)
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) {
      setToastMsg(res.status === 409 ? "Entrega já foi atribuída a outro motoboy." : (json.error ?? "Erro ao aceitar entrega."))
      dismissedIdsRef.current.add(avulsaOferta.id)
      setAvulsaOferta(null)
      setTimeout(() => setToastMsg(null), 3500)
      return
    }
    const aceita = { ...avulsaOferta, status: "aceito" }
    setEmAndamentoAvulsa(prev => [...prev, aceita])
    setAvulsaOferta(null)
    setSheetH(SHEET_MID)
  }

  // ── Recusar entrega avulsa ────────────────────────────────────────────────
  function recusarAvulsa() {
    if (!avulsaOferta) return
    // Broadcast: dismiss local apenas — a avulsa continua aguardando para outros
    dismissedIdsRef.current.add(avulsaOferta.id)
    setAvulsaOferta(null)
  }

  // ── Avançar etapa da entrega avulsa ──────────────────────────────────────
  async function avancarAvulsa(avulsa: any) {
    const res = await fetch("/api/motoboy/avancar-avulsa", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avulsa_id: avulsa.id, motoboy_id, status_atual: avulsa.status }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) {
      setToastMsg(json.error ?? "Erro ao atualizar. Tente novamente.")
      setTimeout(() => setToastMsg(null), 3500)
      return
    }
    const next: string = json.nextStatus
    if (next === "entregue") {
      setEmAndamentoAvulsa(prev => prev.filter((a: any) => a.id !== avulsa.id))
      setGanhosDia(g => g + ganhoMotoboyPedido(avulsa))
      setCorridasDia(c => c + 1)
    } else {
      setEmAndamentoAvulsa(prev => prev.map((a: any) => a.id === avulsa.id ? { ...a, status: next } : a))
    }
  }

  // ── Priorizar 2ª entrega (troca posição no array emAndamento) ───────────────
  function priorizarSegundaEntrega(segundaId: string) {
    setEmAndamento(prev => {
      const idx = prev.findIndex(p => p.id === segundaId)
      if (idx <= 0) return prev
      const arr = [...prev]
      ;[arr[0], arr[idx]] = [arr[idx], arr[0]]
      prioridadeManualRef.current = arr.map(p => p.id)
      return arr
    })
    // Não fecha o painel — com mais de 2 corridas ativas, as outras extras continuam
    // aparecendo depois que esta vira a principal.
  }

  // ── Avançar etapa da corrida ativa (Tópico 03) ────────────────────────────
  async function avancarEtapa(pedidoAlvo?: Pedido, fotoUrl?: string) {
    // Se já está concluída, volta para o estado normal
    if (corridaConcluida) {
      setCorridaConcluida(null)
      setSheetH(SHEET_PEEK)
      await loadPedidos()
      return
    }
    const ativa = pedidoAlvo ?? emAndamento.find(p => ["indo_para_loja","na_loja","em_rota","coletado"].includes(p.status))
    if (!ativa) {
      await loadPedidos()
      setAvancandoEtapa(false)
      return
    }
    setAvancandoEtapa(true)

    const res = await fetch("/api/motoboy/avancar-etapa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pedido_id:   ativa.id,
        motoboy_id,
        status_atual: ativa.status,
        taxa_entrega: ativa.taxa_entrega ?? 0,
      }),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) {
      setToastMsg(json.error ?? "Erro ao atualizar. Tente novamente.")
      setTimeout(() => setToastMsg(null), 3500)
      setAvancandoEtapa(false)
      return
    }

    const nextStatus: string = json.nextStatus

    if (nextStatus === "entregue") {
      setCorridaConcluida(ativa)
      setEmAndamento(prev => prev.filter(p => p.id !== ativa.id))
      setGanhosDia(prev => prev + ganhoMotoboyPedido(ativa))
      setCorridasDia(prev => prev + 1)
      setSegundoAberto(false)
      enviarPush(ativa.id, "entregue", ativa.codigo)
    } else {
      setEmAndamento(prev => prev.map(p => p.id === ativa.id ? { ...p, status: nextStatus as any } : p))
    }

    setAvancandoEtapa(false)
    loadPedidos()
  }


  // ── Bottom sheet drag — Pointer Capture para captura confiável no mobile ──
  function onDragPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDragging.current = true
    dragStartY.current = e.clientY
    dragStartH.current = sheetH
  }
  function onDragPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return
    setSheetH(Math.max(SHEET_PEEK, Math.min(SHEET_FULL, dragStartH.current + (dragStartY.current - e.clientY))))
  }
  function onDragPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    isDragging.current = false
    const snaps = [SHEET_PEEK, SHEET_MID, SHEET_FULL]
    setSheetH(snaps.reduce((a, b) => Math.abs(b - sheetH) < Math.abs(a - sheetH) ? b : a))
  }

  const entregaAtiva = emAndamento[0] ?? null
  const corridasAtivas = emAndamento.filter(p =>
    ["indo_para_loja","na_loja","em_rota","coletado"].includes(p.status)
  )
  const corridaAtiva = corridasAtivas[0] ?? null
  // Todas as corridas ativas além da 1ª (que ocupa o painel principal/mapa) — o
  // motoboy pode ter mais de uma aceita ao mesmo tempo (limite configurável em
  // "configuracoes.max_pedidos_motoboy" ou por motoboy em "limite_pedidos_simultaneos",
  // hoje até 7) e todas precisam aparecer aqui, não só a 2ª (bug real: 2026-09-26,
  // motoboy com 3+ corridas só via a 1ª e a 2ª, a 3ª ficava invisível no app).
  const entregasExtras = corridasAtivas.slice(1)
  const segundaEntrega = entregasExtras[0] ?? null

  // Distância do motoboy até o PRÓXIMO ponto de cada corrida (loja antes de coletar,
  // cliente depois) — pra ele escolher qual priorizar com várias aceitas ao mesmo tempo
  // (pedido real, 2026-10-03: 3 avulsas + 1 normal, só a 1ª avulsa aparecia na tela).
  const distAte = (lat: any, lng: any): number | null =>
    lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng)) ? haversineKm(myLat, myLng, Number(lat), Number(lng)) : null
  const distPedido = (p: any) => ["em_rota", "coletado"].includes(p.status)
    ? distAte(p.lat_entrega, p.lng_entrega)
    : distAte(p.loja?.lat ?? p.loja_lat, p.loja?.lng ?? p.loja_lng)
  const distAvulsa = (a: any) => ["coletado", "em_rota"].includes(a.status)
    ? distAte(a.cliente_lat, a.cliente_lng)
    : distAte(a.loja_lat, a.loja_lng)
  const porDistancia = <T,>(lista: T[], dist: (x: T) => number | null) => lista
    .map(item => ({ item, km: dist(item) }))
    .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity))
  const extrasPorDistancia = porDistancia(entregasExtras, distPedido)
  const avulsasPorDistancia = porDistancia(emAndamentoAvulsa, distAvulsa)
  const fmtKm = (km: number) => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`
  const ETAPA_MAP: Record<string, number> = { "indo_para_loja": 0, "na_loja": 1, "em_rota": 2, "coletado": 2, "entregue": 3 }
  const etapaAtual = corridaConcluida ? 3 : (ETAPA_MAP[corridaAtiva?.status ?? ""] ?? 0)
  const ETAPAS_LABEL = ["Indo à loja", "Na loja", "Em rota", "Entregue!"]

  // Quando indo à loja, rota aponta para a loja; nas demais etapas, para o cliente
  // Indo à loja: a rota vai SÓ pra loja. Antes, sem coordenada da loja, caía no destino do
  // cliente e o mapa levava o motoboy direto pra casa do cliente (teste do Lucas, 20/10/2026).
  const efetDestinoLat = corridaAtiva?.status === "indo_para_loja" ? lojaLat : destinoLat
  const efetDestinoLng = corridaAtiva?.status === "indo_para_loja" ? lojaLng : destinoLng

  // Pins extras de TODAS as corridas além da 1ª para o mapa (não só a 2ª)
  const extrasLojaMap: PinExtra[] = entregasExtras
    .map(e => ({ lat: (e as any).loja?.lat ?? (e as any).loja_lat, lng: (e as any).loja?.lng ?? (e as any).loja_lng, type: "loja" as const }))
    .filter(p => p.lat && p.lng)
  const extrasDestinoMap: PinExtra[] = entregasExtras
    .filter(e => ["em_rota","coletado"].includes(e.status))
    .map(e => ({ lat: (e as any).lat_entrega, lng: (e as any).lng_entrega, type: "destino" as const }))
    .filter(p => p.lat && p.lng)

  const temOferta = !!(pedidoOferta || avulsaOferta)

  const navOffset = "var(--nav-h)"
  const statusTxt = (s: string) => s === "indo_para_loja" ? "indo à loja" : s === "na_loja" ? "na loja" : "em rota"
  const kmTxt = (p: any) => { const km = distPedido(p); return km != null ? fmtKm(km) : null }
  const iniciais = (sessao?.role === "motoboy" ? (sessao as any).motoboy_nome ?? "" : "").trim().split(/\s+/).map((x: string) => x[0]).slice(0, 2).join("").toUpperCase()

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0,
      bottom: fullscreenMap ? 0 : navOffset,
      background: "#E9E7E2",
      // Corrida nova cobre a barra de baixo (o "Agora não" ficava por trás dela)
      zIndex: fullscreenMap || temOferta || telaPerm ? 999 : "auto" as any,
      transition: "bottom 0.25s",
    }}>

      {/* Toast de teste de notificação */}
      {mostrarObrigadoTeste && (
        <div className="mb-toast" style={{ top: 70, background: "var(--folha)" }}>
          <b style={{ display: "block", fontSize: 16 }}>Obrigado pelo teste!</b>
          <span style={{ opacity: .9, fontSize: 13 }}>Notificação, cartão e aceite funcionando.</span>
        </div>
      )}

      {/* ── Permissões ao entrar ── */}
      {telaPerm && (
        <div className="mb-perm" role="dialog" aria-label="Permissões do app">
          {/* Layout da proposta (tela "Pronto pra rodar"): progresso + "Ativar" em cada item */}
          <h1 className="t28">Antes de ficar online</h1>
          <p className="mut" style={{ fontSize: 15, margin: "8px 0 6px" }}>Ative as 3 permissões pra receber corrida com o celular no bolso.</p>
          {(() => { const n = (["loc", "notif", "som"] as const).filter(k => perm[k] === "ok" || perm[k] === "sem_suporte").length; return <>
            <div className="mb-perm-prog"><i style={{ width: `${n / 3 * 100}%` }} /></div>
            <small className="mut" style={{ fontSize: 12 }}>{n} de 3 ativadas</small>
          </> })()}
          <div className="mb-perm-lista">
            {([
              ["loc", <><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg></>, "Localização", "Pra receber corrida perto e a loja e o cliente verem você chegando"],
              ["notif", <><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg></>, "Notificações", ehIphone && perm.notif === "sem_suporte" ? "No iPhone só funciona com o app instalado na tela de início" : "Corrida nova toca mesmo com o app fechado"],
              ["som", <><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg></>, "Som alto de corrida", "Pra tocar alto quando aparecer corrida"],
            ] as const).map(([k, ic, nome, desc]) => {
              const st = perm[k]
              const ok = st === "ok" || st === "sem_suporte"
              return (
                <div key={k} className={`mb-perm-item ${ok ? "feita" : ""}`}>
                  <span className="mb-perm-ic">{ic}</span>
                  <span style={{ flex: 1, minWidth: 0 }}><b className="t16" style={{ display: "block" }}>{nome}</b><small className="mut">{desc}</small></span>
                  {st === "ok" ? <span className="mb-perm-ok">✓</span>
                    : ativando === k ? <span className="mb-perm-gira" />
                    : st === "negado" ? <button className="mb-perm-bt" disabled={pedindoPerm} onClick={() => permitirTudo(k)} aria-label={`Tentar de novo: ${nome}`}>Tentar</button>
                    : st === "sem_suporte" ? <span className="mb-perm-st">—</span>
                    : <button className="mb-perm-bt" disabled={pedindoPerm} onClick={() => permitirTudo(k)}>Ativar</button>}
                </div>
              )
            })}
          </div>
          <div className="mb-perm-dica">Dica: desligue a economia de bateria pro Chegô. Senão o celular pode fechar o app no meio da rua.</div>
          {(perm.loc === "negado" || perm.notif === "negado") && (
            <div className="mb-perm-ajuda">
              <b>Algo ficou bloqueado. Pra liberar:</b>
              {erroLoc && <small style={{ opacity: .75 }}>Motivo da localização: {erroLoc}</small>}
              {ehIphone
                ? <span>
                    1. Ajustes, Privacidade e Segurança, Serviços de Localização, <b>Sites do Safari</b>: Durante o Uso.<br />
                    2. Ajustes, <b>Apps</b>, <b>Safari</b>, <b>Localização</b>: Permitir.<br />
                    3. Se continuar bloqueado, o iPhone guardou o “Não permitir” só pro Chegô: segure o ícone do Chegô na tela de início, toque em <b>Remover</b>, abra chegodelivery.com no Safari, toque em <b>Compartilhar</b>, <b>Adicionar à Tela de Início</b>, entre de novo e toque em Permitir.
                  </span>
                : <span>No Chrome, toque no <b>cadeado</b> ao lado do endereço, depois <b>Permissões</b>, e libere <b>Local</b> e <b>Notificações</b>. Se instalou o app: segure o ícone, <b>Informações do app</b>, <b>Permissões</b>.</span>}
            </div>
          )}
          <div style={{ marginTop: "auto", paddingTop: 16 }}>
            {perm.loc === "ok" && perm.notif !== "pendente" && perm.notif !== "negado" && perm.som === "ok"
              ? <button className="mb-btn verde" onClick={() => setTelaPerm(false)}>Tudo pronto, ir pro mapa</button>
              : <button className="mb-btn verm" onClick={() => permitirTudo()} disabled={pedindoPerm}>{pedindoPerm ? "Ativando…" : perm.loc === "negado" || perm.notif === "negado" ? "Tentar de novo" : perm.loc === "ok" || perm.notif === "ok" || perm.som === "ok" ? "Ativar o que falta" : "Ativar tudo"}</button>}
            <button className="mb-btn claro" style={{ marginTop: 8 }} onClick={() => { sessionStorage.setItem("mb_perm_agora_nao", "1"); setTelaPerm(false) }}>Agora não</button>
          </div>
        </div>
      )}

      {/* Mapa */}
      <MapaMotoboy
        myLat={myLat} myLng={myLng}
        destinoLat={gpsReady ? efetDestinoLat : null}
        destinoLng={gpsReady ? efetDestinoLng : null}
        lojaLat={gpsReady ? lojaLat : null}
        lojaLng={gpsReady ? lojaLng : null}
        raioDisplay={raioDisplay} raioOpen={raioOpen}
        extrasLoja={extrasLojaMap}
        extrasDestino={extrasDestinoMap}
        fitBoundsTrigger={fitBoundsTrigger}
      />

      {toastMsg && <div className="mb-toast" role="alert" style={{ top: 70 }}>{toastMsg}</div>}

      {/* ── Corrida nova ── */}
      {pedidoOferta && (
        <CardCorrida
          pedido={pedidoOferta}
          timer={timerOferta}
          distKm={distKmOferta}
          onAceitar={aceitarCorrida}
          onRecusar={recusarCorrida}
          carregando={aceitandoCorrida}
        />
      )}
      {avulsaOferta && !pedidoOferta && (
        <CardAvulsa
          avulsa={avulsaOferta}
          timer={timerAvulsa}
          onAceitar={aceitarAvulsa}
          onRecusar={recusarAvulsa}
          carregando={aceitandoAvulsa}
        />
      )}

      {/* ── Topo: perfil, ganhos de hoje e SOS ── */}
      {!fullscreenMap && !temOferta && (
        <>
          <Link className="mb-redondo" href="/motoboy/perfil" aria-label="Perfil" style={{ left: 12, fontFamily: "var(--display)", fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
            {fotoMotoboy ? <img src={fotoMotoboy} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} /> : (iniciais || "?")}
          </Link>
          <Link className="mb-pilula" href="/motoboy/financeiro" style={{ textDecoration: "none" }}>
            <b>R$ {ganhosDia.toFixed(2).replace(".", ",")}</b><span>{corridasDia > 0 && !dinamica ? `${corridasDia} ${corridasDia === 1 ? "corrida" : "corridas"} hoje` : "hoje"}</span>
            {dinamica && <em className="mb-pilula-din" title="Corrida dinâmica (chuva)">🌧️ + R$ {dinamica.valor.toFixed(2).replace(".", ",")}</em>}
          </Link>
          <button className="mb-redondo mb-sos" style={{ right: 12 }} onClick={() => setSosModal(true)} aria-label="SOS de emergência">SOS</button>
        </>
      )}

      {/* ── Aviso: notificação desligada ── */}
      {pushStatus !== "granted" && pushStatus !== "unsupported" && !fullscreenMap && !temOferta && (
        <div className="mb-aviso" style={{ top: 66, background: "var(--pimenta)", color: "#fff" }}>
          <span style={{ fontSize: 20 }}>🔕</span>
          <span style={{ flex: 1 }}><b>Notificações desligadas</b><small>{pushStatus === "denied" ? "Libere nas configurações do celular pra não perder corridas." : "Sem elas você pode perder corridas."}</small></span>
          {pushStatus !== "denied" && <button onClick={ativarPush} style={{ background: "#fff", color: "var(--pimenta)" }}>Ativar</button>}
        </div>
      )}

      {/* ── Aviso: bateria do Android ── */}
      {!avisoBateriaFechado && pushStatus === "granted" && !fullscreenMap && !temOferta && (
        <div className="mb-aviso" style={{ top: 66, background: "var(--pequi-claro)", color: "#6B5100" }}>
          <span style={{ fontSize: 20 }}>🔋</span>
          <span style={{ flex: 1 }}>
            <b>Corrida pode não avisar com o app fechado</b>
            <small>Configurações, Apps, Chrome, Bateria: “Sem restrições”. Em Xiaomi, Redmi ou Poco, ative também “Início automático” pro Chrome.{!appInstalado && <> No Chrome, toque em ⋮ e escolha “Instalar aplicativo”.</>}</small>
          </span>
          <button onClick={fecharAvisoBateria} style={{ background: "#6B5100", color: "#fff" }}>Entendi</button>
        </div>
      )}

      {/* ── GPS: tocar no aviso liga a localização ── */}
      {disponivel && !fullscreenMap && !temOferta && !corridaAtiva && !corridaConcluida && (
        compartilhando
          ? <div className="mb-gps" style={{ top: 66 + (pushStatus !== "granted" && pushStatus !== "unsupported" ? 74 : 0) }}>
              <i style={{ background: "var(--folha)" }} /><span>GPS ligado{cidadeAtual ? `, ${cidadeAtual}` : ""}</span>
            </div>
          : <button className="mb-gps" onClick={ativarGps} disabled={ligandoGps} style={{ top: 66 + (pushStatus !== "granted" && pushStatus !== "unsupported" ? 74 : 0), border: "1.5px solid var(--pequi)", cursor: "pointer" }}>
              <i style={{ background: "var(--pequi)" }} />
              <span style={{ color: "#8a6d00" }}>{ligandoGps ? "Ligando o GPS…" : "Sem GPS, toque pra ativar"}</span>
            </button>
      )}

      {ajudaGps && (
        <div className="mb-folha-modal" onClick={() => setAjudaGps(false)}>
          <div onClick={e => e.stopPropagation()}>
            <span className="t20">Libere a localização</span>
            <p className="mut" style={{ fontSize: 14, margin: "6px 0 14px", lineHeight: 1.5 }}>A localização está bloqueada neste celular. Sem ela você não recebe corridas perto de você.</p>
            {/iPhone|iPad|iPod/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "") ? (
              // No iPhone o app da tela de início não aparece na lista de apps: ele usa a
              // permissão de localização do Safari ("Sites do Safari").
              <ol style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.7, color: "var(--grafite)" }}>
                <li>Abra <b>Ajustes</b> do iPhone, toque em <b>Privacidade e Segurança</b> e depois em <b>Serviços de Localização</b>. Deixe ligado.</li>
                <li>Role a lista até <b>Sites do Safari</b>, escolha <b>Durante o Uso</b> e ligue <b>Localização Precisa</b>. O app do Chegô usa essa permissão, por isso ele não aparece com o próprio nome.</li>
                <li>Volte em <b>Ajustes</b>, toque em <b>Apps</b>, depois <b>Safari</b> e <b>Localização</b>, e escolha <b>Permitir</b> ou <b>Perguntar</b>.</li>
                <li>Feche o app do Chegô (arraste pra cima), abra de novo e toque em <b>Tentar de novo</b>.</li>
                <li>Se continuar bloqueado, o iPhone guardou o “Não permitir” só pro Chegô: segure o ícone do Chegô na tela de início, <b>Remover</b>, abra chegodelivery.com no Safari, <b>Compartilhar</b>, <b>Adicionar à Tela de Início</b> e entre de novo.</li>
              </ol>
            ) : (
              <ol style={{ paddingLeft: 20, fontSize: 14.5, lineHeight: 1.7, color: "var(--grafite)" }}>
                <li>Puxe a barra de cima do celular e ligue a <b>Localização</b>.</li>
                <li>No Chrome, toque no <b>cadeado</b> ao lado do endereço, depois <b>Permissões</b> e libere <b>Local</b>.</li>
                <li>Volte aqui e toque em <b>Tentar de novo</b>.</li>
              </ol>
            )}
            <button className="mb-btn verde" style={{ marginTop: 14 }} onClick={ativarGps} disabled={ligandoGps}>{ligandoGps ? "Ligando…" : "Tentar de novo"}</button>
            <button className="mb-btn claro" style={{ marginTop: 8 }} onClick={() => setAjudaGps(false)}>Fechar</button>
          </div>
        </div>
      )}

      {/* ── Raio de atuação ── */}
      {!corridaAtiva && !corridaConcluida && !temOferta && (
        <div className="mb-raio" style={{ bottom: sheetH + 16 }}>
          {raioOpen && (
            <div className="mb-raio-painel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <b className="t16">Raio de atuação</b>
                <b style={{ fontFamily: "var(--display)", fontSize: 20, color: "var(--pimenta)" }}>{raioDisplay} km</b>
              </div>
              <input type="range" min={1} max={40} step={1} value={raioDisplay}
                onChange={e => setRaioDisplay(Number(e.target.value))}
                onMouseUp={() => salvarRaio(raioDisplay)} onTouchEnd={() => salvarRaio(raioDisplay)} aria-label="Raio de atuação em km" />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }} className="mut"><span>1 km</span><span>40 km</span></div>
              <p className="mut" style={{ fontSize: 12, marginTop: 8, textAlign: "center" }}>{salvandoRaio ? "Salvando…" : `Corridas em até ${raioDisplay} km de você`}</p>
            </div>
          )}
          <button className="mb-redondo" style={{ position: "static", width: 48, height: 48, background: raioOpen ? "var(--pimenta)" : "#fff", color: raioOpen ? "#fff" : "var(--pimenta)" }} onClick={() => setRaioOpen(o => !o)} aria-label="Raio de atuação">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" /></svg>
          </button>
        </div>
      )}

      {/* ── Mapa em tela cheia ── */}
      {corridaAtiva && !corridaConcluida && (
        <button className="mb-redondo" onClick={() => { setFullscreenMap(f => { if (!f) setSheetH(0); else setSheetH(SHEET_MID); return !f }) }}
          aria-label={fullscreenMap ? "Voltar pro painel" : "Mapa em tela cheia"}
          style={{ top: "auto", bottom: fullscreenMap ? 24 : "calc(72% + 12px)", left: 12, zIndex: 40, background: fullscreenMap ? "var(--pimenta)" : "#fff", color: fullscreenMap ? "#fff" : "var(--grafite)" }}>
          {fullscreenMap
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="10" y1="14" x2="3" y2="21" /><line x1="21" y1="3" x2="14" y2="10" /></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>}
        </button>
      )}

      {/* ── SOS ── */}
      {sosModal && motoboy_id && (
        <SOSModal
          motoboyId={motoboy_id}
          pedidoId={corridaAtiva?.id ?? emAndamento[0]?.id ?? ""}
          lat={myLat}
          lng={myLng}
          onClose={() => setSosModal(false)}
        />
      )}

      {/* ── Outras entregas aceitas (todas, não só a 2ª) ── */}
      {entregasExtras.length > 0 && !corridaConcluida && !fullscreenMap && !temOferta && (
        <button className="mb-flutua" onClick={() => setSegundoAberto(o => !o)} style={{ top: 66, left: 12, background: segundoAberto ? "var(--grafite)" : "#fff", color: segundoAberto ? "#fff" : "var(--grafite)" }}>
          <span className="n">{entregasExtras.length}</span>
          {entregasExtras.length === 1 ? `2º pedido #${segundaEntrega!.codigo}, ${statusTxt(segundaEntrega!.status)}` : `${entregasExtras.length} outras entregas`}
        </button>
      )}

      {/* ── Avulsas em andamento (visível mesmo com corrida ativa) ── */}
      {corridaAtiva && !corridaConcluida && !fullscreenMap && !temOferta && emAndamentoAvulsa.length > 0 && (
        <button className="mb-flutua" onClick={() => setAvulsaFlutuanteAberta(o => !o)} style={{ top: 66, right: 12, background: avulsaFlutuanteAberta ? "var(--grafite)" : "#fff", color: avulsaFlutuanteAberta ? "#fff" : "var(--grafite)" }}>
          {emAndamentoAvulsa.length > 1 && <span className="n">{emAndamentoAvulsa.length}</span>}
          {emAndamentoAvulsa.length > 1 ? `${emAndamentoAvulsa.length} avulsas` : `Avulsa #${emAndamentoAvulsa[0].codigo}`}
        </button>
      )}

      {avulsaFlutuanteAberta && emAndamentoAvulsa.length > 0 && !corridaConcluida && (
        <div className="mb-folha-modal" onClick={() => setAvulsaFlutuanteAberta(false)}>
          <div onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="t20">{emAndamentoAvulsa.length === 1 ? "Entrega avulsa" : `${emAndamentoAvulsa.length} entregas avulsas`}</span>
              <button className="mb-redondo" style={{ position: "static", boxShadow: "none", background: "var(--pedra)" }} onClick={() => setAvulsaFlutuanteAberta(false)} aria-label="Fechar">✕</button>
            </div>
            {avulsasPorDistancia.length > 1 && <p className="mut" style={{ fontSize: 13, marginBottom: 10 }}>A mais perto aparece primeiro.</p>}
            {avulsasPorDistancia.map(({ item: a, km }) => <AvulsaAndamento key={a.id} a={a} km={km != null ? fmtKm(km) : null} onAvancar={() => avancarAvulsa(a)} />)}
          </div>
        </div>
      )}

      {/* ── Pegar outra corrida durante a atual ── */}
      {corridaAtiva && !corridaConcluida && entregasExtras.length === 0 && prontos.length > 0 && emAndamento.length < maxPedidos && !fullscreenMap && !temOferta && (
        <button className="mb-flutua" onClick={() => setDisponiveisAberto(o => !o)} style={{ top: 66, left: 12, background: disponiveisAberto ? "var(--folha)" : "#fff", color: disponiveisAberto ? "#fff" : "var(--folha)" }}>
          <span className="n" style={{ background: "var(--folha)" }}>+{prontos.length}</span>
          {prontos.length === 1 ? "corrida no caminho" : "corridas no caminho"}
        </button>
      )}

      {segundoAberto && entregasExtras.length > 0 && !corridaConcluida && (
        <div className="mb-folha-modal" onClick={() => setSegundoAberto(false)}>
          <div onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="t20">{entregasExtras.length === 1 ? "2º pedido" : `${entregasExtras.length} outras entregas`}</span>
              <button className="mb-redondo" style={{ position: "static", boxShadow: "none", background: "var(--pedra)" }} onClick={() => setSegundoAberto(false)} aria-label="Fechar">✕</button>
            </div>
            {extrasPorDistancia.map(({ item: entrega, km }, idx) => (
              <div key={entrega.id} className="mb-disp">
                <div className="l1">
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b className="t16">#{entrega.codigo}, {(entrega as any).loja?.nome ?? ""}</b>
                    <p>{entrega.status === "indo_para_loja" ? "Indo buscar na loja" : entrega.status === "na_loja" ? "Esperando pegar na loja" : `Entregar em ${entrega.endereco_entrega}`}</p>
                  </span>
                  <span className="v">R$ {ganhoMotoboyPedido(entrega).toFixed(2).replace(".", ",")}{km != null && <small>{idx === 0 && extrasPorDistancia.length > 1 ? "mais perto, " : ""}{fmtKm(km)}</small>}</span>
                </div>
                <button className="mb-btn claro peq" style={{ marginTop: 10 }} onClick={() => priorizarSegundaEntrega(entrega.id)}>Fazer esta primeiro</button>
                {entrega.status === "indo_para_loja" && <button className="mb-btn verm peq" style={{ marginTop: 8 }} onClick={() => avancarEtapa(entrega)} disabled={avancandoEtapa}>{avancandoEtapa ? "Salvando…" : "Cheguei na loja"}</button>}
                {entrega.status === "na_loja" && <button className="mb-btn verde peq" style={{ marginTop: 8 }} onClick={() => avancarEtapa(entrega)} disabled={avancandoEtapa}>{avancandoEtapa ? "Salvando…" : "Peguei o pedido"}</button>}
                {["em_rota", "coletado"].includes(entrega.status) && <button className="mb-btn escuro peq" style={{ marginTop: 8 }} onClick={() => avancarEtapa(entrega)} disabled={avancandoEtapa}>{avancandoEtapa ? "Salvando…" : "Confirmar entrega"}</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {disponiveisAberto && !corridaConcluida && (
        <div className="mb-folha-modal" onClick={() => setDisponiveisAberto(false)}>
          <div onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="t20">Corridas disponíveis</span>
              <button className="mb-redondo" style={{ position: "static", boxShadow: "none", background: "var(--pedra)" }} onClick={() => setDisponiveisAberto(false)} aria-label="Fechar">✕</button>
            </div>
            {prontos.map(p => <CorridaDisponivel key={p.id} p={p} km={kmTxt(p)} ocupado={atualizando === p.id} bloqueado={!!atualizando} rotulo="Aceitar 2º pedido" onAceitar={() => aceitarEntrega(p)} />)}
          </div>
        </div>
      )}

      {/* ── Corrida em andamento ── */}
      {(corridaAtiva || corridaConcluida) && !fullscreenMap && (
        <CorridaAtivaPanel
          // key força remontar o painel ao trocar de pedido (concluída -> próxima já
          // aceita) — sem isso, estado interno (código digitado, "cheguei" enviado,
          // colapsado) ficava herdado da corrida anterior. Bug real reportado, 2026-09-23.
          key={(corridaConcluida?.id ?? corridaAtiva?.id) ?? "none"}
          pedido={corridaAtiva}
          corridaConcluida={corridaConcluida}
          avancando={avancandoEtapa}
          onAvancar={(fotoUrl) => avancarEtapa(corridaAtiva ?? undefined, fotoUrl)}
          onConcluir={() => avancarEtapa()}
          motoboyId={motoboy_id ?? undefined}
          myLat={myLat}
          myLng={myLng}
          lojaLat={lojaLat ?? undefined}
          lojaLng={lojaLng ?? undefined}
          destinoLat={destinoLat ?? undefined}
          destinoLng={destinoLng ?? undefined}
          ganhosDia={ganhosDia}
          corridasDia={corridasDia}
          onSOSOpen={() => setSosModal(true)}
          onSetDestino={(lat, lng) => { setDestinoLat(lat); setDestinoLng(lng) }}
          onShowRoute={() => setFitBoundsTrigger(n => n + 1)}
          temOutraCorrida={emAndamento.some(x => x.id !== corridaConcluida?.id && ["indo_para_loja","na_loja","em_rota","coletado"].includes(x.status))}
          onPararHoje={async () => { await avancarEtapa(); if (disponivel) await toggleDisponivel() }}
        />
      )}

      {/* ── Folha de baixo (sem corrida ativa) ── */}
      {!corridaAtiva && !corridaConcluida && !fullscreenMap && (
        <div className="mb-folha" style={{ height: sheetH, transition: isDragging.current ? "none" : "height 0.3s cubic-bezier(0.32,0.72,0,1)", overflow: disponivel ? "hidden" : "visible" }}>
          {!disponivel && (
            <button className="mb-online-btn" onClick={toggleDisponivel} disabled={togglingDisp || dispLoading} aria-label="Ficar online">
              {togglingDisp ? <b>…</b> : <><span>Ficar</span><b>online</b></>}
            </button>
          )}
          <div className="mb-pega" onPointerDown={onDragPointerDown} onPointerMove={onDragPointerMove} onPointerUp={onDragPointerUp} onPointerCancel={onDragPointerUp}
            onClick={() => setSheetH(h => h === SHEET_PEEK ? SHEET_MID : h === SHEET_MID ? SHEET_FULL : SHEET_PEEK)}><i /></div>

          <div className="mb-rolagem">
            {/* Offline */}
            {!disponivel && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 12px" }}>
                  <span className="mb-estado off">Offline</span>
                  <span className="mut" style={{ fontSize: 13.5, flex: 1 }}>Raio de {raioKm} km{cidadeAtual ? `, ${cidadeAtual}` : ""}</span>
                  <button onClick={() => setRaioOpen(o => !o)} style={{ background: "none", border: 0, color: "var(--pimenta)", fontWeight: 800, fontSize: 13.5 }}>Mudar raio</button>
                </div>
                <div className="mb-stats">
                  <div><b>R$ {ganhosDia.toFixed(2).replace(".", ",")}</b><span>hoje</span></div>
                  <div><b>{corridasDia}</b><span>{corridasDia === 1 ? "corrida" : "corridas"}</span></div>
                  <div><b>{raioKm} km</b><span>de raio</span></div>
                </div>
              </>
            )}

            {dinamica && (
              <div className="mb-dinamica">
                <b>🌧️ Corrida dinâmica: + R$ {dinamica.valor.toFixed(2).replace(".", ",")} por entrega</b>
                <small>Vale até {new Date(dinamica.ate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(":", "h")}, em todas as lojas. O valor já aparece somado em cada corrida.</small>
              </div>
            )}

            {/* Online */}
            {disponivel && (
              <>
                <div className="mb-procurando" style={{ marginTop: 2 }}>
                  <span className="radar" />
                  <span style={{ flex: 1 }}>
                    <b className="t16">{pedidosLoading ? "Carregando…" : "Procurando corridas"}</b>
                    <p className="mut" style={{ fontSize: 13 }}>Raio de {raioKm} km. Corrida nova toca e abre sozinha.</p>
                  </span>
                  <span className="mb-estado on">Online</span>
                </div>

                {emAndamento.length > 0 && (
                  <>
                    <div className="mb-sec"><b className="t16">Em andamento</b></div>
                    {emAndamento.map(p => (
                      <div key={p.id} className="mb-disp">
                        <div className="l1">
                          <span style={{ flex: 1, minWidth: 0 }}><b className="t16">#{p.codigo}, {(p as any).loja?.nome ?? ""}</b><p>{statusTxt(p.status)}, {p.endereco_entrega}</p></span>
                          <span className="v">R$ {ganhoMotoboyPedido(p).toFixed(2).replace(".", ",")}</span>
                        </div>
                        <DetalheCobranca pedido={p} />
                      </div>
                    ))}
                  </>
                )}

                {emAndamentoAvulsa.length > 0 && (
                  <>
                    <div className="mb-sec"><b className="t16">Avulsas em andamento</b></div>
                    {emAndamentoAvulsa.map(a => <AvulsaAndamento key={a.id} a={a} km={null} onAvancar={() => avancarAvulsa(a)} />)}
                  </>
                )}

                <div className="mb-sec"><b className="t16">Rotas disponíveis</b><span className="mut" style={{ fontSize: 13 }}>{prontos.length === 0 ? "nenhuma agora" : `${prontos.length} perto de você`}</span></div>
                {!pedidosLoading && prontos.length === 0 && (
                  <p className="mut" style={{ fontSize: 13.5, textAlign: "center", padding: "6px 0 10px" }}>Quando a loja deixar um pedido pronto, ele aparece aqui.</p>
                )}
                {prontos.map(p => <CorridaDisponivel key={p.id} p={p} km={kmTxt(p)} ocupado={atualizando === p.id} bloqueado={!!atualizando} rotulo="Aceitar corrida" onAceitar={() => aceitarEntrega(p)} />)}


                <button className="mb-btn claro" style={{ marginTop: 10 }} onClick={toggleDisponivel} disabled={togglingDisp || dispLoading}>{togglingDisp ? "…" : "Ficar offline"}</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Cartão de corrida pronta (lista e "2º pedido") ─────────────────────────
function CorridaDisponivel({ p, km, ocupado, bloqueado, rotulo, onAceitar }: { p: any; km: string | null; ocupado: boolean; bloqueado: boolean; rotulo: string; onAceitar: () => void }) {
  const ganho = ganhoMotoboyPedido(p)
  return (
    <div className="mb-disp">
      <div className="l1">
        <span className="logo">🏪</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b className="t16" style={{ display: "block" }}>{p.loja?.nome ?? "Loja"}</b>
          <p>{km ? `${km} de você, ` : ""}#{p.codigo}, {new Date(p.criado_em).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}</p>
        </span>
        <span className="v">R$ {ganho.toFixed(2).replace(".", ",")}</span>
      </div>
      <p style={{ marginTop: 8 }}>Entregar em {p.endereco_entrega}</p>
      <p style={{ fontSize: 12.5 }}>{p.forma_pagamento_2 ? rotuloPagamento(p) : PGTO[p.forma_pagamento] ?? p.forma_pagamento}{p.itens?.length ? `, ${p.itens.length} ${p.itens.length === 1 ? "item" : "itens"}` : ""}</p>
      <DetalheCobranca pedido={p} />
      <button className="mb-btn verde peq" style={{ marginTop: 10 }} onClick={onAceitar} disabled={bloqueado}>{ocupado ? "Aceitando…" : rotulo}</button>
    </div>
  )
}

// ─── Entrega avulsa em andamento ─────────────────────────────────────────────
function AvulsaAndamento({ a, km, onAvancar }: { a: any; km: string | null; onAvancar: () => void }) {
  return (
    <div className="mb-disp">
      <div className="l1">
        <span style={{ flex: 1, minWidth: 0 }}>
          <b className="t16" style={{ display: "block" }}>Avulsa #{a.codigo}{a.loja_nome ? `, ${a.loja_nome}` : ""}</b>
          <p>{a.status === "aceito" ? "Ir buscar na loja" : a.status === "coletado" ? "Na loja" : "Em rota"}{km ? `, ${km}` : ""}</p>
        </span>
        <span className="v">R$ {ganhoMotoboyPedido(a).toFixed(2).replace(".", ",")}</span>
      </div>
      <p style={{ marginTop: 8 }}>Cliente <b style={{ color: "var(--grafite)" }}>{a.cliente_nome}</b>, entregar em {a.endereco}</p>
      {a.observacao && <p style={{ fontStyle: "italic" }}>{a.observacao}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {a.loja_lat && a.loja_lng && <a className="mb-btn claro peq" style={{ textDecoration: "none" }} href={`https://waze.com/ul?ll=${a.loja_lat},${a.loja_lng}&navigate=yes`} target="_blank" rel="noreferrer">Ir à loja</a>}
        <a className="mb-btn claro peq" style={{ textDecoration: "none" }} href={`https://waze.com/ul?q=${encodeURIComponent(a.endereco)}&navigate=yes`} target="_blank" rel="noreferrer">Ir ao cliente</a>
      </div>
      {a.status === "aceito" && <button className="mb-btn verm peq" style={{ marginTop: 8 }} onClick={onAvancar}>Cheguei na loja</button>}
      {a.status === "coletado" && <button className="mb-btn verm peq" style={{ marginTop: 8 }} onClick={onAvancar}>Saindo para entrega</button>}
      {a.status === "em_rota" && <button className="mb-btn verde peq" style={{ marginTop: 8 }} onClick={onAvancar}>Confirmar entrega</button>}
    </div>
  )
}

// ─── Modal SOS de emergência ──────────────────────────────────────────────────
function SOSModal({
  motoboyId, pedidoId, lat, lng, onClose,
}: {
  motoboyId: string; pedidoId: string; lat: number; lng: number; onClose: () => void
}) {
  const [countdown,  setCountdown]  = useState(3)
  const [enviando,   setEnviando]   = useState(false)
  const [confirmado, setConfirmado] = useState(false)
  const [pronto,     setPronto]     = useState(false)

  useEffect(() => {
    if (confirmado || pronto) return
    const iv = setInterval(() => setCountdown(c => {
      if (c <= 1) { clearInterval(iv); return 0 }
      return c - 1
    }), 1000)
    return () => clearInterval(iv)
  }, [confirmado, pronto])

  async function enviarSOS() {
    setEnviando(true)
    try {
      await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motoboy_id: motoboyId, pedido_id: pedidoId || null, lat, lng }),
      })
    } catch {}
    setEnviando(false)
    setPronto(true)
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end",
    }}>
      <div style={{
        width: "100%", background: "#1C1C1E", borderRadius: "24px 24px 0 0",
        padding: "28px 24px 36px", boxShadow: "0 -8px 48px rgba(0,0,0,0.9)",
        animation: "slideUpCard 0.25s ease-out",
      }}>
        {pronto ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(239,68,68,0.15)", border: "2px solid #ef4444", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <p style={{ color: "#ef4444", fontWeight: 900, fontSize: 18, marginBottom: 6 }}>SOS enviado!</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 24 }}>O administrador foi alertado com sua localização atual.</p>
            <button onClick={onClose} style={{
              width: "100%", padding: "15px", borderRadius: 14, border: "none",
              background: "rgba(239,68,68,0.15)", color: "#ef4444",
              fontWeight: 900, fontSize: 15, cursor: "pointer",
            }}>
              Fechar
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(239,68,68,0.15)", border: "2px solid #ef4444", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div>
                <p style={{ color: "#ef4444", fontWeight: 900, fontSize: 17 }}>Acionar SOS de emergência?</p>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 }}>Seu admin será alertado com sua localização</p>
              </div>
            </div>

            <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.5 }}>
                Pressione o botão abaixo para enviar um alerta de emergência com sua posição GPS atual. Use somente em situações de risco real.
              </p>
            </div>

            <button
              onClick={enviarSOS}
              disabled={countdown > 0 || enviando}
              style={{
                width: "100%", padding: "16px", borderRadius: 14, border: "none",
                background: countdown > 0 ? "rgba(239,68,68,0.25)" : "#ef4444",
                color: countdown > 0 ? "rgba(255,255,255,0.4)" : "white",
                fontWeight: 900, fontSize: 16, cursor: countdown > 0 ? "not-allowed" : "pointer",
                marginBottom: 10, transition: "all 0.3s",
              }}>
              {enviando ? "Enviando..." : countdown > 0 ? `Aguarde ${countdown}s para confirmar` : "Confirmar SOS"}
            </button>
            <button onClick={onClose} style={{
              width: "100%", padding: "14px", borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
              color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Painel de corrida ativa — stepper 4 etapas (Tópico 03) ─────────────────
// ─── Botão de deslizar (aceitar / avançar etapa) ─────────────────────────────
// Deslizar evita aceite ou avanço por toque sem querer no bolso ou no guidão. Teclado:
// Enter ou espaço também confirmam (acessibilidade).
function Desliza({ rotulo, onConfirmar, cor = "verde", ocupado = false }: { rotulo: string; onConfirmar: () => void; cor?: "verde" | "escuro" | "verm"; ocupado?: boolean }) {
  const trilho = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(0)
  const ini = useRef<number | null>(null)
  const max = () => (trilho.current?.clientWidth ?? 300) - 64
  function fim() {
    if (ini.current === null) return
    ini.current = null
    if (x >= max() * 0.82 && !ocupado) { setX(max()); onConfirmar(); setTimeout(() => setX(0), 600) }
    else setX(0)
  }
  return (
    <div ref={trilho} className={`mb-desliza ${cor} ${ocupado ? "ocupado" : ""}`} role="button" tabIndex={0} aria-label={rotulo}
      onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && !ocupado) { e.preventDefault(); onConfirmar() } }}
      onPointerDown={e => { if (ocupado) return; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); ini.current = e.clientX - x }}
      onPointerMove={e => { if (ini.current === null) return; setX(Math.max(0, Math.min(max(), e.clientX - ini.current))) }}
      onPointerUp={fim} onPointerCancel={fim}>
      <span className="rot" style={{ opacity: 1 - Math.min(1, x / Math.max(1, max())) * 0.8 }}>{ocupado ? "Salvando…" : rotulo}</span>
      <span className="bola" style={{ transform: `translateX(${x}px)`, transition: ini.current === null ? "transform .25s" : "none" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </span>
    </div>
  )
}

function CorridaAtivaPanel({
  pedido, corridaConcluida, avancando, onAvancar, onConcluir,
  motoboyId, myLat, myLng, lojaLat, lojaLng, destinoLat, destinoLng,
  ganhosDia, corridasDia,
  onSOSOpen, onSetDestino, onShowRoute, temOutraCorrida, onPararHoje,
}: {
  pedido: any | null
  corridaConcluida: any | null
  avancando: boolean
  onAvancar: (fotoUrl?: string) => void
  onConcluir: () => void
  motoboyId?: string
  myLat?: number
  myLng?: number
  lojaLat?: number
  lojaLng?: number
  destinoLat?: number
  destinoLng?: number
  ganhosDia?: number
  corridasDia?: number
  onSOSOpen: () => void
  onSetDestino?: (lat: number, lng: number) => void
  onShowRoute?: () => void
  temOutraCorrida?: boolean
  onPararHoje?: () => Promise<void>
}) {
  const [verMapaNaLoja,   setVerMapaNaLoja]   = useState(false)
  const [parando,         setParando]         = useState(false)
  const [navDestino,      setNavDestino]      = useState<{ texto: string; lat?: number; lng?: number } | null>(null)
  const [codigoInput,     setCodigoInput]     = useState("")
  const [erroConfirm,     setErroConfirm]     = useState("")
  const [chegueiEnviado,  setChegueiEnviado]  = useState(false)
  const [enviandoCheguei, setEnviandoCheguei] = useState(false)
  const [collapsed,       setCollapsed]       = useState(false)
  const [conferidos,      setConferidos]      = useState<Set<number>>(new Set())

  const p    = corridaConcluida ?? pedido
  const loja = p?.loja
  const STATUS_TO_ETAPA: Record<string, number> = {
    "indo_para_loja": 0, "na_loja": 1, "em_rota": 2, "coletado": 2, "entregue": 3,
  }
  const etapa  = corridaConcluida ? 3 : (STATUS_TO_ETAPA[pedido?.status ?? ""] ?? 0)

  async function avisarCheguei() {
    if (!p?.id) return
    setEnviandoCheguei(true)
    try {
      await fetch("/api/push", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", pedido_id: p.id, status: "cheguei", codigo: p.codigo }),
      })
    } catch {}
    setChegueiEnviado(true)
    setEnviandoCheguei(false)
  }

  function confirmarEntrega() {
    if (!codigoInput.trim()) { setErroConfirm("Digite o código do cliente."); return }
    if (!p || codigoInput.trim() !== codigoEntregaCliente(p)) {
      setErroConfirm("Código incorreto. Peça os 4 últimos dígitos do telefone do cliente.")
      return
    }
    setErroConfirm("")
    onAvancar()
  }

  const km = (lat?: number | null, lng?: number | null) =>
    myLat != null && myLng != null && lat != null && lng != null && !isNaN(Number(lat)) ? haversineKm(myLat, myLng, Number(lat), Number(lng)) : null
  const fmt = (v: number | null) => v == null ? "" : v < 1 ? `, ${Math.round(v * 1000)} m` : `, ${v.toFixed(1).replace(".", ",")} km`
  // -16.9146388 é a coordenada padrão de loja que nunca marcou o ponto no mapa (centro de
  // Aragoiânia). Ela não pode virar destino do Waze/Maps: sem ponto real, os apps buscam
  // pelo texto do endereço e o painel avisa o motoboy pra confirmar com a loja.
  const coordLojaReal = (lat: any) => lat != null && Math.abs(Number(lat) + 16.9146388) >= 0.0001
  const lojaFallbackLat = coordLojaReal(p?.loja?.lat) ? p?.loja?.lat : coordLojaReal(p?.loja_lat) ? p?.loja_lat : null
  const lojaFallbackLng = coordLojaReal(p?.loja?.lat) ? p?.loja?.lng : coordLojaReal(p?.loja_lat) ? p?.loja_lng : null
  const lojaLatEf = lojaLat ?? lojaFallbackLat
  const lojaLngEf = lojaLng ?? lojaFallbackLng
  const destLatEf = destinoLat ?? p?.lat_entrega
  const destLngEf = destinoLng ?? p?.lng_entrega
  const zap = (tel: string, texto: string) => `https://wa.me/55${tel.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`
  const IcNav = <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 11 21 3l-8 18-2-8-8-2z" /></svg>
  const IcFone = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>
  const IcMsg = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>

  // ETAPA 4 — Entregue: tela verde cheia, como na proposta
  if (etapa === 3) {
    return (
      <div className="mb-feito" role="status">
        <div className="ok"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></div>
        <div className="v">+ R$ {ganhoMotoboyPedido(p ?? {}).toFixed(2).replace(".", ",")}</div>
        <p style={{ opacity: .9, marginTop: 8, fontSize: 15 }}>Pedido #{p?.codigo} entregue. Mandou bem!</p>
        {ganhosDia != null && (
          <div style={{ width: "100%", maxWidth: 380, background: "rgba(255,255,255,.14)", borderRadius: 16, padding: "12px 16px", margin: "22px 0", textAlign: "left", fontSize: 14.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Hoje</span><b>R$ {ganhosDia.toFixed(2).replace(".", ",")}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Corridas hoje</span><b>{corridasDia}</b></div>
          </div>
        )}
        <button className="mb-btn" style={{ background: "#fff", color: "var(--folha)", maxWidth: 380 }} onClick={onConcluir} disabled={parando}>{temOutraCorrida ? "Seguir pra próxima entrega" : "Procurar a próxima"}</button>
        {/* "Parar por hoje" (proposta): fecha a corrida e fica offline pela mesma rota do botão Online */}
        {!temOutraCorrida && onPararHoje && (
          <button className="mb-btn" style={{ background: "transparent", color: "#fff", maxWidth: 380, marginTop: 6, minHeight: 48 }} disabled={parando}
            onClick={async () => { setParando(true); try { await onPararHoje() } finally { setParando(false) } }}>{parando ? "Saindo…" : "Parar por hoje"}</button>
        )}
      </div>
    )
  }

  const enderecoRaw = p?.endereco_entrega ?? ""
  const refIdx = enderecoRaw.indexOf(" — Ref: ")
  const enderecoLimpo = refIdx >= 0 ? enderecoRaw.substring(0, refIdx) : enderecoRaw
  const pontoRef = refIdx >= 0 ? enderecoRaw.substring(refIdx + 8) : ""
  const cobra = p && cobraNaEntrega(p)
  const tituloEtapa = etapa === 0 ? `Indo à loja${fmt(km(lojaLatEf, lojaLngEf))}` : etapa === 1 ? "Na loja" : `Indo ao cliente${fmt(km(destLatEf, destLngEf))}`

  // ETAPA 2 — Na loja: "Conferir pedido" em tela cheia, como na proposta. Só a tela muda:
  // conferir os itens não grava nada e o "Peguei o pedido" chama a mesma etapa de antes.
  // A seta de voltar mostra o painel de sempre, em cima do mapa.
  if (etapa === 1 && !verMapaNaLoja) {
    const itens: any[] = p?.itens ?? []
    const tudo = itens.length === 0 || conferidos.size >= itens.length
    return (
      <div className="mb-conferir" role="dialog" aria-label="Conferir pedido">
        <div className="mb-topo-pag" style={{ paddingTop: "calc(env(safe-area-inset-top,0px) + 12px)" }}>
          <button className="mb-redondo-peq" onClick={() => setVerMapaNaLoja(true)} aria-label="Ver no mapa"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
          <h1 className="t20" style={{ flex: 1 }}>Conferir pedido</h1>
          <span className="mb-selo-cod">{p?.codigo}</span>
        </div>
        <div className="mb-conferir-corpo">
          <div className="mb-passos" aria-hidden="true">{[0, 1, 2, 3].map(i => <i key={i} className={i < 1 ? "feito" : i === 1 ? "agora" : ""} />)}</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6 }}>
            {loja?.logo_url ? <img src={loja.logo_url} alt="" style={{ width: 46, height: 46, borderRadius: 12, objectFit: "cover", flex: "none" }} />
              : <span style={{ width: 46, height: 46, borderRadius: 12, background: "var(--pedra)", display: "grid", placeItems: "center", fontSize: 22, flex: "none" }}>🏪</span>}
            <span style={{ minWidth: 0 }}><b className="t16" style={{ display: "block", fontWeight: 700 }}>{loja?.nome ?? "Loja"}</b><span className="mut" style={{ fontSize: 14 }}>Peça o pedido {p?.codigo} no balcão</span></span>
          </div>
          {itens.length > 0 && <>
            <p className="mut" style={{ fontSize: 14, marginTop: 16, lineHeight: 1.45 }}>Toque em cada item pra conferir antes de sair. Faltou algo? Avise a loja agora, depois fica difícil.</p>
            <div className="mb-itens" style={{ marginTop: 10 }}>
              {itens.map((item: any, i: number) => (
                <div key={item.id ?? i} role="checkbox" aria-checked={conferidos.has(i)} tabIndex={0} style={{ cursor: "pointer", alignItems: "center", padding: "14px 0" }}
                  onClick={() => setConferidos(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })}>
                  <b>{item.quantidade}×</b><span style={{ flex: 1, fontWeight: 600 }}>{item.nome}</span>
                  <span style={{ width: 26, height: 26, borderRadius: 8, border: "2px solid " + (conferidos.has(i) ? "var(--folha)" : "#C9C6C0"), background: conferidos.has(i) ? "var(--folha)" : "#fff", color: "#fff", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 900 }}>{conferidos.has(i) ? "✓" : ""}</span>
                </div>
              ))}
            </div>
          </>}
          {cobra && <div className="mb-cobrar" style={{ marginTop: 14 }}><span className="ic">R$</span><span style={{ flex: 1 }}><DetalheCobranca pedido={p} /></span></div>}
          {loja?.telefone
            ? <a className="mb-btn" style={{ marginTop: 14, background: "#fff", color: "var(--grafite)", border: "1.5px solid var(--linha)" }} href={zap(loja.telefone, `Cheguei pra buscar o pedido #${p?.codigo}.`)} target="_blank" rel="noreferrer">Falar com a loja</a>
            : null}
        </div>
        <div className="mb-conferir-rodape">
          {tudo ? <Desliza rotulo="Peguei o pedido, saindo" cor="verde" ocupado={avancando} onConfirmar={() => onAvancar()} />
            : <button className="mb-btn verm" disabled style={{ opacity: .5 }}>Confira os {itens.length} itens</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-corrida" style={{ maxHeight: collapsed ? 92 : "72%" }}>
      {navDestino && (
        <NavModal
          destino={navDestino}
          onClose={() => setNavDestino(null)}
          onNavApp={() => {
            // A rota do mapa já segue a etapa (loja ou cliente). Antes isto gravava a
            // coordenada da loja como destino do cliente e bagunçava a etapa seguinte.
            onShowRoute?.()
            setNavDestino(null)
          }}
        />
      )}

      <div className="mb-pega" onClick={() => setCollapsed(c => !c)} role="button" aria-label={collapsed ? "Abrir painel" : "Recolher painel"}><i /></div>

      <div className="mb-rolagem" style={{ paddingBottom: 18 }}>
        <div className="mb-passos" aria-hidden="true">
          {[0, 1, 2, 3].map(i => <i key={i} className={i < etapa ? "feito" : i === etapa ? "agora" : ""} />)}
        </div>
        <p className="mut" style={{ fontSize: 13.5 }}>{tituloEtapa}</p>

        {collapsed ? null : etapa === 0 ? (
          <>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6 }}>
              <span className="mb-disp-logo" style={{ width: 46, height: 46, borderRadius: 12, background: "var(--pedra)", display: "grid", placeItems: "center", fontSize: 22, flex: "none" }}>🏪</span>
              <span style={{ minWidth: 0 }}><b className="t20" style={{ display: "block" }}>{loja?.nome ?? "Loja"}</b><span className="mut" style={{ fontSize: 13.5 }}>Pedido {p?.codigo}{loja?.endereco ? `, ${loja.endereco}` : ""}</span></span>
            </div>
            {lojaLatEf == null && <p style={{ background: "var(--pequi-claro)", color: "var(--texto)", borderRadius: 12, padding: "10px 12px", fontSize: 13.5, marginTop: 10, lineHeight: 1.45 }}>Esta loja ainda não marcou o ponto no mapa. O GPS vai pelo endereço escrito: confirme com a loja antes de sair.</p>}
            <div className="mb-acoes">
              <button onClick={() => setNavDestino({ texto: loja?.endereco ?? loja?.nome ?? "", lat: lojaLatEf ?? undefined, lng: lojaLngEf ?? undefined })}>{IcNav}Navegar</button>
              {loja?.telefone ? <a href={zap(loja.telefone, `Sou o entregador do pedido #${p?.codigo}. Estou a caminho!`)} target="_blank" rel="noreferrer">{IcMsg}Loja</a> : <button disabled style={{ opacity: .4 }}>{IcMsg}Loja</button>}
              {loja?.telefone ? <a href={`tel:${loja.telefone}`}>{IcFone}Ligar</a> : <button disabled style={{ opacity: .4 }}>{IcFone}Ligar</button>}
            </div>
          </>
        ) : etapa === 1 ? (
          <>
            <b className="t20" style={{ display: "block", marginTop: 4 }}>{loja?.nome ?? "Loja"}</b>
            <span className="mut" style={{ fontSize: 13.5 }}>Peça o pedido {p?.codigo} no balcão</span>
            <button className="mb-btn" style={{ marginTop: 10, background: "var(--grafite)", color: "#fff", minHeight: 48 }} onClick={() => setVerMapaNaLoja(false)}>Conferir pedido</button>
            {p?.itens?.length > 0 && (
              <>
                <p className="mut" style={{ fontSize: 13, marginTop: 10 }}>Toque em cada item pra conferir antes de sair.</p>
                <div className="mb-itens">
                  {p.itens.map((item: any, i: number) => (
                    <div key={item.id ?? i} role="checkbox" aria-checked={conferidos.has(i)} tabIndex={0} style={{ cursor: "pointer", alignItems: "center" }}
                      onClick={() => setConferidos(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })}>
                      <b>{item.quantidade}×</b><span style={{ flex: 1 }}>{item.nome}</span>
                      <span style={{ width: 24, height: 24, borderRadius: 7, border: "2px solid " + (conferidos.has(i) ? "var(--folha)" : "#C9C6C0"), background: conferidos.has(i) ? "var(--folha)" : "#fff", color: "#fff", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 900 }}>{conferidos.has(i) ? "✓" : ""}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {cobra && <div className="mb-cobrar"><span className="ic">R$</span><span style={{ flex: 1 }}><DetalheCobranca pedido={p} /></span></div>}
            <div className="mb-acoes">
              <button onClick={() => setNavDestino({ texto: p?.endereco_entrega ?? "", lat: destLatEf ?? undefined, lng: destLngEf ?? undefined })}>{IcNav}Ver cliente</button>
              {loja?.telefone ? <a href={zap(loja.telefone, `Cheguei pra buscar o pedido #${p?.codigo}.`)} target="_blank" rel="noreferrer">{IcMsg}Loja</a> : <button disabled style={{ opacity: .4 }}>{IcMsg}Loja</button>}
              {loja?.telefone ? <a href={`tel:${loja.telefone}`}>{IcFone}Ligar</a> : <button disabled style={{ opacity: .4 }}>{IcFone}Ligar</button>}
            </div>
          </>
        ) : (
          <>
            <b className="t20" style={{ display: "block", marginTop: 4, wordBreak: "break-word" }}>{enderecoLimpo}</b>
            {pontoRef && <div className="mb-nota">📍 {pontoRef}</div>}
            {p?.observacao && <p className="mut" style={{ fontSize: 13, marginTop: 8, wordBreak: "break-word" }}>{p.observacao}</p>}
            {cobra && <div className="mb-cobrar"><span className="ic">R$</span><span style={{ flex: 1 }}><DetalheCobranca pedido={p} /></span></div>}
            <div className="mb-acoes">
              <button onClick={() => setNavDestino({ texto: p?.endereco_entrega ?? "", lat: destLatEf ?? undefined, lng: destLngEf ?? undefined })}>{IcNav}Navegar</button>
              {p?.telefone_cliente ? <a href={zap(p.telefone_cliente, `Olá! Sou o entregador do Chegô com o seu pedido #${p?.codigo}. Estou a caminho!`)} target="_blank" rel="noreferrer">{IcMsg}Cliente</a> : <button disabled style={{ opacity: .4 }}>{IcMsg}Cliente</button>}
              {p?.telefone_cliente ? <a href={`tel:${p.telefone_cliente}`} aria-label={`Ligar pro cliente ${mascaraTelefone(p.telefone_cliente)}`}>{IcFone}Ligar</a> : <button disabled style={{ opacity: .4 }}>{IcFone}Ligar</button>}
            </div>

          </>
        )}
      </div>

      {/* Ação da etapa sempre visível no rodapé do painel */}
      {!collapsed && (
        <div className="mb-rodape-acao">
          {etapa === 0 && <Desliza rotulo="Cheguei na loja" cor="escuro" ocupado={avancando} onConfirmar={() => onAvancar()} />}
          {etapa === 1 && <Desliza rotulo="Peguei o pedido, saindo" cor="verde" ocupado={avancando} onConfirmar={() => onAvancar()} />}
          {etapa === 2 && (!chegueiEnviado ? (
            <Desliza rotulo={enviandoCheguei ? "Avisando o cliente…" : "Cheguei no endereço"} cor="escuro" ocupado={enviandoCheguei} onConfirmar={avisarCheguei} />
          ) : (
            <>
              <p className="t16" style={{ margin: "0 0 8px" }}>Peça os 4 últimos números do telefone do cliente</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className={`mb-codigo ${erroConfirm ? "erro" : ""}`}
                  value={codigoInput}
                  onChange={e => { setCodigoInput(e.target.value.replace(/\D/g, "")); setErroConfirm("") }}
                  onKeyDown={e => { if (e.key === "Enter") confirmarEntrega() }}
                  placeholder="0000" maxLength={4} inputMode="numeric" autoComplete="off" autoFocus aria-label="Código de entrega"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button className="mb-btn verde" style={{ width: 120, height: 64 }} onClick={confirmarEntrega} disabled={avancando || codigoInput.length < 4}>{avancando ? "…" : "Confirmar entrega"}</button>
              </div>
              {erroConfirm && <p style={{ color: "var(--pimenta)", fontSize: 13.5, fontWeight: 700, marginTop: 8 }}>{erroConfirm}</p>}
            </>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Card de aceitar entrega avulsa ──────────────────────────────────────────
function CardAvulsa({
  avulsa, timer, onAceitar, onRecusar, carregando,
}: {
  avulsa: any; timer: number
  onAceitar: () => void; onRecusar: () => void; carregando: boolean
}) {
  const dashOffset = CIRCUM * (1 - timer / 30)
  const timerColor = timer <= 10 ? "#FF4444" : "#FF8C00"

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", zIndex: 40 }} />
      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 60, zIndex: 50,
        background: "#1C1C1E", borderRadius: "24px 24px 0 0",
        boxShadow: "0 -8px 48px rgba(0,0,0,0.8)",
        animation: "slideUpCard 300ms ease-out",
        overflow: "hidden",
      }}>
        <div style={{ padding: "12px 0 0", display: "flex", justifyContent: "center" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 20px 14px" }}>
          <div>
            <p style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, marginBottom: 4, letterSpacing: 0.3 }}>
              Entrega avulsa!
            </p>
            {avulsa.loja_nome && (
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                🏪 {avulsa.loja_nome}
              </p>
            )}
            <p style={{ color: "#FF8C00", fontWeight: 900, fontSize: 34, lineHeight: 1, letterSpacing: -0.5 }}>
              R$ {ganhoMotoboyPedido(avulsa).toFixed(2).replace(".", ",")}
            </p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 6 }}>
              {avulsa.codigo} · {avulsa.cliente_nome}
            </p>
          </div>
          <div style={{ position: "relative", width: 68, height: 68, flexShrink: 0 }}>
            <svg width="68" height="68" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#2C2C2E" strokeWidth="7" />
              <circle cx="50" cy="50" r="40" fill="none" stroke={timerColor} strokeWidth="7"
                strokeDasharray={CIRCUM} strokeDashoffset={dashOffset} strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: timerColor, fontWeight: 900, fontSize: 22, animation: timer <= 10 ? "timerPulse 0.7s ease-in-out infinite" : "none" }}>
                {timer}
              </span>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 20px 16px" }} />

        <div style={{ padding: "0 20px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
            background: "rgba(34,197,94,0.1)", border: "1.5px solid rgba(34,197,94,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Entregar em</p>
            <p style={{ color: "white", fontSize: 15, fontWeight: 700 }}>{avulsa.endereco}</p>
            {avulsa.observacao && (
              <p style={{ color: "#888", fontSize: 12, marginTop: 4, fontStyle: "italic" }}>{avulsa.observacao}</p>
            )}
          </div>
        </div>

        {/* Botões Waze */}
        <div style={{ display: "flex", gap: 8, padding: "0 20px 16px" }}>
          {avulsa.loja_lat && avulsa.loja_lng && (
            <a
              href={`https://waze.com/ul?ll=${avulsa.loja_lat},${avulsa.loja_lng}&navigate=yes`}
              target="_blank" rel="noreferrer"
              style={{
                flex: 1, padding: "10px 0", borderRadius: 12, textDecoration: "none",
                border: "1.5px solid rgba(0,170,255,0.3)", background: "rgba(0,170,255,0.08)",
                color: "#00aaff", fontWeight: 800, fontSize: 12, textAlign: "center",
              }}
            >
              🗺 Waze → Loja
            </a>
          )}
          <a
            href={`https://waze.com/ul?q=${encodeURIComponent(avulsa.endereco)}&navigate=yes`}
            target="_blank" rel="noreferrer"
            style={{
              flex: 1, padding: "10px 0", borderRadius: 12, textDecoration: "none",
              border: "1.5px solid rgba(0,170,255,0.3)", background: "rgba(0,170,255,0.08)",
              color: "#00aaff", fontWeight: 800, fontSize: 12, textAlign: "center",
            }}
          >
            🗺 Waze → Cliente
          </a>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 20px 16px" }} />

        <div style={{ display: "flex", gap: 10, padding: "0 20px 20px" }}>
          <button onClick={onRecusar} disabled={carregando} style={{
            flex: 1, padding: "16px 0", borderRadius: 14,
            border: "1.5px solid rgba(255,255,255,0.22)",
            background: "transparent", color: "white",
            fontWeight: 800, fontSize: 15, cursor: "pointer",
          }}>
            Recusar
          </button>
          <button onClick={onAceitar} disabled={carregando} style={{
            flex: 2, padding: "16px 0", borderRadius: 14,
            border: "none", background: "#FF8C00", color: "white",
            fontWeight: 900, fontSize: 15, cursor: "pointer",
            opacity: carregando ? 0.7 : 1, transition: "opacity 0.2s",
          }}>
            {carregando ? "Aceitando..." : "Aceitar entrega"}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Card de aceitar corrida — estilo iFood ───────────────────────────────────
function CardCorrida({
  pedido, timer, distKm, onAceitar, onRecusar, carregando,
}: {
  pedido: any; timer: number; distKm: number | null
  onAceitar: () => void; onRecusar: () => void; carregando: boolean
}) {
  const loja  = pedido.loja
  const ganho = ganhoMotoboyPedido(pedido)
  const enderecoRaw = pedido.endereco_entrega ?? ""
  const refIdx = enderecoRaw.indexOf(" — Ref: ")
  const enderecoLimpo = refIdx >= 0 ? enderecoRaw.substring(0, refIdx) : enderecoRaw
  const pontoRef = refIdx >= 0 ? enderecoRaw.substring(refIdx + 8) : ""
  const cobra = cobraNaEntrega(pedido)
  // Igual à proposta: distância até a loja, da loja até o cliente, total e R$/km.
  // Loja sem ponto marcado (coordenada padrão) não entra no cálculo.
  const lojaReal = loja?.lat != null && Math.abs(Number(loja.lat) + 16.9146388) >= 0.0001
  const kmEntrega = lojaReal && pedido.lat_entrega && pedido.lng_entrega ? haversineKm(Number(loja.lat), Number(loja.lng), Number(pedido.lat_entrega), Number(pedido.lng_entrega)) : null
  const kmTotal = distKm != null && kmEntrega != null ? distKm + kmEntrega : null
  const km1 = (v: number) => v.toFixed(1).replace(".", ",")
  return (
    <>
      <div className="mb-oferta-veu" />
      <div className="mb-oferta-topo"><span>Nova corrida</span><b className={timer <= 10 ? "fim" : ""} aria-live="polite">{timer}s</b></div>
      <div className="mb-oferta" role="dialog" aria-label="Corrida nova">
        <div style={{ padding: "18px 0 0" }}>
          <span className="valor">R$ {ganho.toFixed(2).replace(".", ",")}</span>
          {kmTotal != null && kmTotal > 0.2 ? <span className="kmchip">R$ {(ganho / kmTotal).toFixed(2).replace(".", ",")}/km</span>
            : distKm != null && distKm > 0 && <span className="kmchip">{km1(distKm)} km de você</span>}
          <p className="sub">{kmTotal != null ? `${km1(kmTotal)} km no total, uns ${Math.max(5, Math.round(kmTotal / 22 * 60 + 4))} min` : <>{pedido.itens?.length ? `${pedido.itens.length} ${pedido.itens.length === 1 ? "item" : "itens"}, ` : ""}{pedido.forma_pagamento_2 ? rotuloPagamento(pedido) : PGTO[pedido.forma_pagamento] ?? pedido.forma_pagamento}</>}</p>
        </div>
        <div className="mb-trajeto">
          <div><small>Coletar{distKm != null && distKm > 0 ? ` a ${km1(distKm)} km` : ""}</small><b>{loja?.nome ?? "Loja"}</b>{loja?.endereco && <span>{loja.endereco}</span>}</div>
          <div className="fim"><small>Entregar{kmEntrega != null ? ` a ${km1(kmEntrega)} km da loja` : ""}</small><b style={{ wordBreak: "break-word" }}>{enderecoLimpo}</b>{pontoRef && <span>📍 {pontoRef}</span>}</div>
        </div>
        <div className="mb-chips">
          {cobra && <span className="am"><DetalheCobranca pedido={pedido} /></span>}
          {pedido.itens?.length > 0 && <span>{pedido.itens.length} {pedido.itens.length === 1 ? "item" : "itens"}</span>}
        </div>
        <button className="mb-btn verde" style={{ height: 64, borderRadius: 999 }} onClick={onAceitar} disabled={carregando}>{carregando ? "Aceitando…" : "Aceitar corrida"}</button>
        <button className="mb-agora-nao" onClick={onRecusar} disabled={carregando}>Agora não</button>
      </div>
    </>
  )
}

// ─── Modal de foto comprovante de entrega (Tópico 07) ────────────────────────
function FotoModal({
  pedidoId, onConfirmar, onPular,
}: {
  pedidoId: string
  onConfirmar: (fotoUrl?: string) => void
  onPular: () => void
}) {
  const [file,      setFile]      = useState<File | null>(null)
  const [preview,   setPreview]   = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function confirmar() {
    if (!file) { onPular(); return }
    setUploading(true)
    try {
      const ext  = file.name.split(".").pop() || "jpg"
      const path = `${pedidoId}/${Date.now()}.${ext}`
      const { data, error } = await supabase.storage
        .from("entregas")
        .upload(path, file, { contentType: file.type, upsert: true })
      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage.from("entregas").getPublicUrl(data.path)
        onConfirmar(publicUrl)
      } else {
        onPular()
      }
    } catch {
      onPular()
    }
    setUploading(false)
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: "white", fontWeight: 900, fontSize: 16 }}>Comprovante de entrega</p>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 }}>Foto do local (opcional)</p>
        </div>
        <button onClick={onPular} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
        {preview ? (
          <img src={preview} alt="Comprovante" style={{ maxWidth: "100%", maxHeight: "55vh", borderRadius: 16, objectFit: "cover", border: "2px solid rgba(255,140,0,0.3)" }} />
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            style={{
              width: "100%", height: 260,
              border: "2px dashed rgba(255,255,255,0.15)", borderRadius: 20,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 14, cursor: "pointer",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, fontWeight: 700 }}>Toque para abrir câmera</p>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
      </div>

      <div style={{ padding: "16px 20px 36px", display: "flex", flexDirection: "column", gap: 10 }}>
        {preview && (
          <button onClick={() => { setFile(null); setPreview(null); setTimeout(() => inputRef.current?.click(), 50) }} style={{
            padding: "12px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
            color: "rgba(255,255,255,0.45)", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}>
            Tirar outra foto
          </button>
        )}
        <button onClick={confirmar} disabled={uploading} style={{
          padding: "16px", borderRadius: 14, border: "none",
          background: "#FF8C00", color: "white", fontWeight: 900, fontSize: 15, cursor: "pointer",
          opacity: uploading ? 0.7 : 1,
        }}>
          {uploading ? "Enviando foto..." : file ? "Confirmar entrega com foto" : "Confirmar entrega sem foto"}
        </button>
        {!file && (
          <button onClick={onPular} style={{
            padding: "12px", borderRadius: 12, border: "none",
            background: "transparent", color: "rgba(255,255,255,0.3)",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}>
            Pular e confirmar
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Modal de seleção de app de navegação (Tópico 04) ────────────────────────
function NavModal({ destino, onClose, onNavApp }: { destino: { texto: string; lat?: number; lng?: number }; onClose: () => void; onNavApp?: (lat?: number, lng?: number) => void }) {
  const lat    = destino.lat
  const lng    = destino.lng
  const coords = lat && lng ? `${lat},${lng}` : null
  const enc    = encodeURIComponent(destino.texto)
  const APPS = [
    {
      label: "Google Maps",
      color: "#4285F4",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
      ),
      url: coords
        ? `https://maps.google.com/?daddr=${lat},${lng}&directionsmode=driving`
        : `https://maps.google.com/?q=${enc}`,
    },
    {
      label: "Waze",
      color: "#00C6FF",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
        </svg>
      ),
      url: coords
        ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
        : `https://waze.com/ul?q=${enc}&navigate=yes`,
    },
    {
      label: "Apple Maps",
      color: "#555",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l19-9-9 19-2-8-8-2z"/>
        </svg>
      ),
      url: coords
        ? `https://maps.apple.com/?daddr=${coords}`
        : `https://maps.apple.com/?daddr=${enc}`,
    },
  ]

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: "#1C1C1E", borderRadius: "24px 24px 0 0",
          padding: "20px 20px 32px",
          animation: "slideUpCard 220ms ease-out",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)", margin: "0 auto 20px" }} />
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Navegar até</p>
        <p style={{ color: "white", fontWeight: 700, fontSize: 14, marginBottom: 20, lineHeight: 1.3 }}>{destino.texto}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {onNavApp && (
            <button
              onClick={() => { onNavApp(lat ?? undefined, lng ?? undefined); onClose() }}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 18px", borderRadius: 16, border: "none",
                background: "linear-gradient(135deg, #0891b2, #0e7490)",
                cursor: "pointer", width: "100%",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
              <span style={{ color: "white", fontWeight: 800, fontSize: 15 }}>Chegô — Ver no mapa</span>
            </button>
          )}
          {APPS.map(app => (
            <a
              key={app.label}
              href={app.url}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 18px", borderRadius: 16,
                background: app.color, textDecoration: "none",
              }}
            >
              {app.icon}
              <span style={{ color: "white", fontWeight: 800, fontSize: 15 }}>{app.label}</span>
            </a>
          ))}
        </div>
        <button onClick={onClose} style={{
          width: "100%", marginTop: 14, padding: "13px",
          borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)",
          background: "transparent", color: "rgba(255,255,255,0.4)",
          fontWeight: 700, fontSize: 14, cursor: "pointer",
        }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// Instâncias reutilizadas (módulo, não por chamada) — navegadores bloqueiam play() de
// Audio/AudioContext fora de um gesto direto do usuário, e o alerta de nova corrida
// sempre dispara de um callback assíncrono (polling, WebSocket, push), nunca de um
// clique. Criar um Audio/AudioContext NOVO a cada notificação (como era antes) nunca
// tinha chance de ser "destravado" — ficava sujeito ao autoplay bloqueado toda vez.
// `desbloquearAudioNotificacao()` é chamada uma vez no primeiro toque na tela (ver
// efeito de mount abaixo) tocando/pausando essa MESMA instância, que os navegadores
// então deixam tocar de novo depois via chamada assíncrona. Bug real reportado,
// 2026-09-27: som de nova corrida não tocava de forma consistente.
let audioNotificacao: HTMLAudioElement | null = null
let audioCtxNotificacao: AudioContext | null = null

function desbloquearAudioNotificacao() {
  try {
    if (!audioNotificacao) { audioNotificacao = new Audio("/splash.mp3"); audioNotificacao.volume = 1 }
    audioNotificacao.play().then(() => {
      audioNotificacao!.pause()
      audioNotificacao!.currentTime = 0
    }).catch(() => {})
  } catch {}
  try {
    if (!audioCtxNotificacao) audioCtxNotificacao = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (audioCtxNotificacao.state === "suspended") audioCtxNotificacao.resume().catch(() => {})
  } catch {}
}

function playNotificationSound() {
  try {
    if (!audioNotificacao) { audioNotificacao = new Audio("/splash.mp3"); audioNotificacao.volume = 1 }
    audioNotificacao.currentTime = 0
    audioNotificacao.play().catch(() => beep())
  } catch { beep() }
  // Vibração longa + pausa + duas curtas (padrão "atenção")
  try { navigator.vibrate?.([600, 200, 300, 200, 300]) } catch {}
}

function beep() {
  try {
    if (!audioCtxNotificacao) audioCtxNotificacao = new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = audioCtxNotificacao
    if (ctx.state === "suspended") ctx.resume().catch(() => {})
    const play = (freq: number, start: number, dur: number) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = freq
      g.gain.setValueAtTime(0.35, ctx.currentTime + start)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur)
    }
    play(660, 0, 0.15); play(880, 0.18, 0.2)
  } catch {}
}
