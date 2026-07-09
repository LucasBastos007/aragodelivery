"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import type { Pedido } from "@/types"
import { GoogleMap, useJsApiLoader, OverlayView, DirectionsRenderer, Circle } from "@react-google-maps/api"

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
  pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha",
}
const PGTO_COLOR: Record<string, string> = {
  pix: "#818cf8", cartao: "#60a5fa", dinheiro: "#34d399", maquininha: "#f472b6",
}

const DEFAULT_LAT = -17.0549
const DEFAULT_LNG = -49.2295

function mascaraTelefone(tel: string): string {
  const d = tel.replace(/\D/g, "")
  if (d.length === 11) return `(${d.slice(0,2)}) ${d[2]}****-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ****-${d.slice(6)}`
  return tel
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw     = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
    const q   = encodeURIComponent(`${address}, Brasil`)
    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), 5000)
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${key}`, { signal: ctrl.signal })
    clearTimeout(tid)
    const data = await res.json()
    if (data.status === "OK" && data.results[0]) {
      const loc = data.results[0].geometry.location
      return [loc.lat, loc.lng]
    }
    return null
  } catch { return null }
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const key  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), 5000)
    const res  = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}&language=pt-BR&result_type=locality|administrative_area_level_2`,
      { signal: ctrl.signal }
    )
    clearTimeout(tid)
    const data = await res.json()
    if (data.status === "OK" && data.results[0]) {
      const c = data.results[0].address_components as { types: string[]; short_name: string }[]
      const city  = c?.find(x => x.types.includes("administrative_area_level_2"))?.short_name
      const state = c?.find(x => x.types.includes("administrative_area_level_1"))?.short_name
      if (city && state) return `${city} · ${state}`
      return data.results[0].formatted_address.split(",")[0]
    }
  } catch {}
  return null
}


function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dL = (lat2 - lat1) * Math.PI / 180
  const dG = (lng2 - lng1) * Math.PI / 180
  const a  = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dG/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const CIRCUM = 2 * Math.PI * 40 // circunferência do timer circular ≈ 251.3

// ─── Mapa fullscreen com rota (Google Maps) ───────────────────────────────────
type PinExtra = { lat: number; lng: number; type: "loja" | "destino"; label?: string }

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

  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const followRef      = useRef(true)
  const [following, setFollowing] = useState(true)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)

  // Refs para posição atual — evitam que o efeito de rota re-execute a cada update de GPS
  const myLatRef = useRef(myLat)
  const myLngRef = useRef(myLng)
  useEffect(() => { myLatRef.current = myLat; myLngRef.current = myLng }, [myLat, myLng])

  // Navegação estilo Waze: heading e posição prévia
  const headingRef  = useRef(0)
  const prevNavPos  = useRef<{ lat: number; lng: number } | null>(null)
  const navMode     = !!(destinoLat && destinoLng)

  function calcBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLng = (lng2 - lng1) * Math.PI / 180
    const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180)
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180)
           - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng)
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
  }

  // Segue o motoboy — em navMode usa heading-up + perspectiva 3D
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !followRef.current) return

    if (!navMode) {
      map.panTo({ lat: myLat, lng: myLng })
      return
    }

    // Calcula heading a partir do deslocamento (só atualiza se moveu > 5m)
    const prev = prevNavPos.current
    if (prev) {
      const dLat = (myLat - prev.lat) * 111000
      const dLng = (myLng - prev.lng) * 111000
      if (dLat * dLat + dLng * dLng > 25) {
        headingRef.current = calcBearing(prev.lat, prev.lng, myLat, myLng)
      }
    }
    prevNavPos.current = { lat: myLat, lng: myLng }

    // Desloca o centro ~250m à frente para o motoboy aparecer no terço inferior
    const hr = headingRef.current * Math.PI / 180
    const AHEAD = 0.0022
    map.setCenter({ lat: myLat + AHEAD * Math.cos(hr), lng: myLng + AHEAD * Math.sin(hr) })
    map.setHeading(headingRef.current)
    map.setTilt(45)
  }, [myLat, myLng, navMode])

  // Configura zoom e perspectiva ao entrar/sair do modo navegação
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    if (navMode) {
      map.setZoom(17)
      map.setTilt(45)
      followRef.current = true
      setFollowing(true)
    } else {
      map.setTilt(0)
      map.setHeading(0)
    }
  }, [navMode])

  // Mostra rota completa ao clicar "Chegô — Ver no mapa"
  useEffect(() => {
    if (!fitBoundsTrigger || !mapInstanceRef.current) return
    const map = mapInstanceRef.current
    map.setTilt(0)
    map.setHeading(0)
    const b = new google.maps.LatLngBounds()
    b.extend({ lat: myLatRef.current, lng: myLngRef.current })
    if (destinoLat && destinoLng) b.extend({ lat: destinoLat, lng: destinoLng })
    if (lojaLat && lojaLng) b.extend({ lat: lojaLat, lng: lojaLng })
    map.fitBounds(b, { top: 80, right: 32, bottom: 300, left: 32 })
    followRef.current = false
    setFollowing(false)
    // Volta para o modo seguimento após 6s
    const t = setTimeout(() => {
      if (navMode) {
        map.setZoom(17)
        map.setTilt(45)
        map.setHeading(headingRef.current)
      }
      followRef.current = true
      setFollowing(true)
    }, 6000)
    return () => clearTimeout(t)
  }, [fitBoundsTrigger])

  // Recalcula rota APENAS quando o destino ou loja mudam — não a cada update de GPS
  useEffect(() => {
    if (!isLoaded || !destinoLat || !destinoLng) {
      setDirections(null)
      return
    }

    const lat = myLatRef.current
    const lng = myLngRef.current

    // Em modo navegação mantém o seguimento — sem fitBounds que quebraria a perspectiva
    if (!navMode && mapInstanceRef.current) {
      followRef.current = false
      setFollowing(false)
      const b = new google.maps.LatLngBounds()
      b.extend({ lat, lng })
      b.extend({ lat: destinoLat, lng: destinoLng })
      if (lojaLat && lojaLng) b.extend({ lat: lojaLat, lng: lojaLng })
      mapInstanceRef.current.fitBounds(b, { top: 60, right: 24, bottom: 320, left: 24 })
    }

    const svc = new google.maps.DirectionsService()
    svc.route({
      origin:      { lat, lng },
      destination: { lat: destinoLat, lng: destinoLng },
      travelMode:  google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === "OK" && result) {
        setDirections(result)
        if (!navMode && mapInstanceRef.current && result.routes[0]?.bounds) {
          mapInstanceRef.current.fitBounds(result.routes[0].bounds, {
            top: 60, right: 24, bottom: 320, left: 24,
          })
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, destinoLat, destinoLng, lojaLat, lojaLng])

  if (loadError) return (
    <div style={{ position: "absolute", inset: 0, background: "#1a1a2e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(249,115,22,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>Mapa indisponível</p>
    </div>
  )

  if (!isLoaded) return (
    <div style={{ position: "absolute", inset: 0, background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Carregando mapa...</p>
    </div>
  )

  return (
    <>
    <GoogleMap
      mapContainerStyle={{ position: "absolute", inset: 0 } as React.CSSProperties}
      center={{ lat: myLat, lng: myLng }}
      zoom={16}
      options={{
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: "greedy",
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        clickableIcons: false,
        tilt: navMode ? 45 : 0,
        heading: navMode ? headingRef.current : 0,
        styles: navMode ? [
          { elementType: "geometry",              stylers: [{ color: "#0f1428" }] },
          { elementType: "labels.text.fill",      stylers: [{ color: "#8899bb" }] },
          { elementType: "labels.text.stroke",    stylers: [{ color: "#0f1428" }] },
          { featureType: "road",           elementType: "geometry",        stylers: [{ color: "#1e2d5a" }] },
          { featureType: "road",           elementType: "geometry.stroke", stylers: [{ color: "#0a0f24" }] },
          { featureType: "road",           elementType: "labels.text.fill",stylers: [{ color: "#cdd5e0" }] },
          { featureType: "road.highway",   elementType: "geometry",        stylers: [{ color: "#2a3d7c" }] },
          { featureType: "road.highway",   elementType: "labels.text.fill",stylers: [{ color: "#e2e8f0" }] },
          { featureType: "water",          elementType: "geometry",        stylers: [{ color: "#071020" }] },
          { featureType: "poi",            stylers: [{ visibility: "off" }] },
          { featureType: "transit",        stylers: [{ visibility: "off" }] },
          { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#1e2d5a" }] },
        ] : undefined,
      }}
      onLoad={m => { mapInstanceRef.current = m }}
      onDragStart={() => { followRef.current = false; setFollowing(false) }}
    >
      {/* Marcador do motoboy */}
      <OverlayView position={{ lat: myLat, lng: myLng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
        {navMode ? (
          /* Modo navegação: seta direcional apontando para cima (o mapa já gira com o heading) */
          <div style={{ transform: "translate(-50%,-50%)" }}>
            <svg width="44" height="44" viewBox="0 0 44 44" style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.55))" }}>
              <circle cx="22" cy="22" r="20" fill="rgba(15,20,40,0.75)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"/>
              <polygon points="22,7 31,34 22,28 13,34" fill="#22d3ee" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
          </div>
        ) : (
          /* Modo normal: ponto GPS azul pulsante */
          <div style={{ transform: "translate(-50%,-50%)", position: "relative", width: 24, height: 24 }}>
            <style>{`@keyframes gpsPulse{0%{transform:translate(-50%,-50%) scale(1);opacity:.6}100%{transform:translate(-50%,-50%) scale(2.8);opacity:0}}`}</style>
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              width: 24, height: 24, borderRadius: "50%",
              background: "rgba(66,133,244,0.3)",
              animation: "gpsPulse 2s ease-out infinite",
              pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%,-50%)",
              width: 20, height: 20, borderRadius: "50%",
              background: "#4285F4", border: "3px solid white",
              boxShadow: "0 2px 8px rgba(66,133,244,0.7)",
            }} />
          </div>
        )}
      </OverlayView>

      {/* Marcador da loja */}
      {lojaLat && lojaLng && (
        <OverlayView position={{ lat: lojaLat, lng: lojaLng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <div style={{ transform: "translate(-50%,-50%)", width: 38, height: 38, borderRadius: "50%", background: "#f97316", border: "3px solid white", boxShadow: "0 2px 10px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        </OverlayView>
      )}

      {/* Marcador do destino */}
      {destinoLat && destinoLng && (
        <OverlayView position={{ lat: destinoLat, lng: destinoLng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <div style={{ transform: "translate(-50%,-50%)", width: 38, height: 38, borderRadius: "50%", background: "#22c55e", border: "3px solid white", boxShadow: "0 2px 10px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        </OverlayView>
      )}

      {/* Pins extras — lojas do 2º pedido */}
      {extrasLoja?.map((p, i) => p.lat && p.lng && (
        <OverlayView key={`el-${i}`} position={{ lat: p.lat, lng: p.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <div style={{ transform: "translate(-50%,-50%)", width: 34, height: 34, borderRadius: "50%", background: "#fb923c", border: "2px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontWeight: 900, fontSize: 11 }}>2</span>
          </div>
        </OverlayView>
      ))}

      {/* Pins extras — destinos do 2º pedido */}
      {extrasDestino?.map((p, i) => p.lat && p.lng && (
        <OverlayView key={`ed-${i}`} position={{ lat: p.lat, lng: p.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <div style={{ transform: "translate(-50%,-50%)", width: 34, height: 34, borderRadius: "50%", background: "#4ade80", border: "2px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontWeight: 900, fontSize: 11 }}>2</span>
          </div>
        </OverlayView>
      ))}

      {/* Rota */}
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor:   navMode ? "#22d3ee" : "#f97316",
              strokeWeight:  navMode ? 7 : 5,
              strokeOpacity: 0.9,
            },
          }}
        />
      )}

      {/* Círculo de raio — sempre visível */}
      <Circle
        center={{ lat: myLat, lng: myLng }}
        radius={raioDisplay * 1000}
        options={{
          strokeColor: "#f97316",
          strokeOpacity: raioOpen ? 0.7 : 0.2,
          strokeWeight: raioOpen ? 2 : 1.5,
          fillColor: "#f97316",
          fillOpacity: raioOpen ? 0.1 : 0.04,
        }}
      />

    </GoogleMap>

    {/* Botão Centralizar — overlay sobre o mapa */}
    {!following && (
      <button
        onClick={() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.panTo({ lat: myLat, lng: myLng })
            mapInstanceRef.current.setZoom(16)
          }
          followRef.current = true
          setFollowing(true)
        }}
        style={{
          position: "absolute",
          bottom: 24,
          right: 16,
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 16px",
          background: "rgba(26,26,46,0.92)",
          border: "1.5px solid rgba(249,115,22,0.6)",
          borderRadius: 24,
          color: "white",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
        Centralizar
      </button>
    )}
  </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function MotoboyPage() {
  const { sessao } = useAuth()
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null

  const [disponivel,     setDisponivel]     = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("motoboy_online") === "1"
    return false
  })
  const [dispLoading,    setDispLoading]    = useState(true)
  const [togglingDisp,   setTogglingDisp]   = useState(false)

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

  const prevProntosRef  = useRef<Set<string>>(new Set())
  const isFirstLoad     = useRef(true)
  const justAcceptedRef  = useRef(false)
  const dismissedIdsRef  = useRef<Set<string>>(new Set())
  const isLoadingPedidosRef = useRef(false)

  // ── Oferta de corrida (Tópico 02) ─────────────────────────────────────────
  const [pedidoOferta,    setPedidoOferta]    = useState<any | null>(null)
  const [timerOferta,     setTimerOferta]     = useState(30)
  const [distKmOferta,    setDistKmOferta]    = useState<number | null>(null)
  const [aceitandoCorrida, setAceitandoCorrida] = useState(false)
  const [toastMsg,        setToastMsg]        = useState<string | null>(null)
  const [corridaConcluida, setCorridaConcluida] = useState<any | null>(null)
  const [avancandoEtapa,   setAvancandoEtapa]   = useState(false)
  const [raioKm,           setRaioKm]           = useState<number>(20)
  const [salvandoRaio,     setSalvandoRaio]     = useState(false)
  const [raioOpen,         setRaioOpen]         = useState(false)
  const [raioDisplay,      setRaioDisplay]      = useState<number>(20)
  const [fotoMotoboy,      setFotoMotoboy]      = useState<string | null>(null)
  const [sosModal,         setSosModal]         = useState(false)
  const [maxPedidos,       setMaxPedidos]       = useState(2)
  const [segundoAberto,    setSegundoAberto]    = useState(false)
  const [disponiveisAberto, setDisponiveisAberto] = useState(false)

  // ── Carrega config de max pedidos ──────────────────────────────────────────
  useEffect(() => {
    supabase.from("configuracoes")
      .select("valor")
      .eq("chave", "max_pedidos_motoboy")
      .single()
      .then(({ data }) => { if (data?.valor) setMaxPedidos(parseInt(data.valor, 10)) })
  }, [])

  // ── Carrega motoboy ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!motoboy_id) return
    supabase.from("motoboys").select("disponivel, lat, lng, raio_km, foto").eq("id", motoboy_id).single()
      .then(({ data }) => {
        if (data) {
          setDisponivel(data.disponivel)
          sessionStorage.setItem("motoboy_online", data.disponivel ? "1" : "0")
          if (data.lat)     setMyLat(data.lat)
          if (data.lng)     setMyLng(data.lng)
          if (data.raio_km) { setRaioKm(data.raio_km); setRaioDisplay(data.raio_km) }
          if (data.foto)    setFotoMotoboy(data.foto)
        }
        setDispLoading(false)
      })
  }, [motoboy_id])

  // ── Ganhos do dia ──────────────────────────────────────────────────────────
  // Só recarrega do banco na montagem — avancarEtapa atualiza otimisticamente ao entregar
  useEffect(() => {
    if (!motoboy_id) return
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    supabase.from("pedidos")
      .select("taxa_entrega")
      .eq("motoboy_id", motoboy_id)
      .eq("status", "entregue")
      .gte("criado_em", hoje.toISOString())
      .then(({ data }) => {
        const entregas = data ?? []
        setGanhosDia(entregas.reduce((s: number, p: any) => s + (p.taxa_entrega ?? 0), 0))
        setCorridasDia(entregas.length)
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

  // ── Marca offline ao fechar o browser ─────────────────────────────────────
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
  async function salvarRaio(km: number) {
    if (!motoboy_id) return
    setSalvandoRaio(true)
    setRaioKm(km)
    await fetch("/api/motoboy/status", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motoboy_id, raio_km: km }),
    })
    setSalvandoRaio(false)
  }

  // ── Toggle disponível ──────────────────────────────────────────────────────
  async function toggleDisponivel() {
    if (!motoboy_id) return
    setTogglingDisp(true)
    const novo = !disponivel
    await fetch("/api/motoboy/status", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motoboy_id, disponivel: novo }),
    })
    setDisponivel(novo)
    sessionStorage.setItem("motoboy_online", novo ? "1" : "0")
    setTogglingDisp(false)
    if (novo) setSheetH(SHEET_PEEK)
  }

  // ── Pedidos ────────────────────────────────────────────────────────────────
  async function loadPedidos() {
    if (!motoboy_id || isLoadingPedidosRef.current) return
    isLoadingPedidosRef.current = true
    const [
      { data: prontosData },
      { data: andamentoData, error: andamentoError },
    ] = await Promise.all([
      supabase.from("pedidos")
        .select("*, itens:itens_pedido(*), loja:lojas(nome, endereco, telefone, lat, lng)")
        .eq("status", "pronto").is("motoboy_id", null)
        .order("criado_em", { ascending: true }),
      supabase.from("pedidos")
        .select("*, itens:itens_pedido(*), loja:lojas(nome, endereco, telefone, lat, lng)")
        .in("status", ["indo_para_loja", "na_loja", "em_rota", "coletado"])
        .eq("motoboy_id", motoboy_id)
        .order("criado_em", { ascending: true }),
    ])

    const novosProntos = (prontosData as Pedido[]) ?? []
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
      const dados = (andamentoData as Pedido[]) ?? []
      if (dados.length > 0 || !justAcceptedRef.current) {
        setEmAndamento(dados)
      }
    }
    setPedidosLoading(false)
    // Auto-expande o sheet quando há pedidos
    if (novosProntos.length > 0 || (andamentoData ?? []).length > 0) {
      setSheetH(h => Math.max(h, SHEET_MID))
    }
    isLoadingPedidosRef.current = false
  }

  useEffect(() => {
    if (!motoboy_id) return
    loadPedidos()
    const iv = setInterval(loadPedidos, 15_000)
    return () => clearInterval(iv)
  }, [motoboy_id])

  // ── Supabase Realtime — escuta oferta de corrida ───────────────────────────
  useEffect(() => {
    if (!motoboy_id || !disponivel) return

    // Verifica oferta pendente já existente ao entrar
    supabase.from("pedidos")
      .select("*, loja_lat, loja_lng, loja:lojas(nome, endereco, telefone, lat, lng), itens:itens_pedido(*)")
      .eq("motoboy_id", motoboy_id)
      .eq("status", "aguardando_aceite")
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0 && !dismissedIdsRef.current.has(data[0].id)) {
          setPedidoOferta(data[0]); setTimerOferta(30); setDistKmOferta(null)
        }
      })

    const ch = supabase.channel(`oferta-${motoboy_id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "pedidos",
        filter: `motoboy_id=eq.${motoboy_id}`,
      }, payload => {
        const novo = payload.new as any
        if (novo?.status === "aguardando_aceite" && !dismissedIdsRef.current.has(novo.id)) {
          supabase.from("pedidos")
            .select("*, loja_lat, loja_lng, loja:lojas(nome, endereco, telefone, lat, lng), itens:itens_pedido(*)")
            .eq("id", novo.id).single()
            .then(({ data }) => {
              if (data && !dismissedIdsRef.current.has(data.id)) {
                playNotificationSound(); setPedidoOferta(data); setTimerOferta(30); setDistKmOferta(null)
              }
            })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [motoboy_id, disponivel])

  // ── Timer regressivo da oferta ─────────────────────────────────────────────
  useEffect(() => {
    if (!pedidoOferta) return
    if (timerOferta <= 0) {
      // Timeout — escalada para próximo motoboy
      const ofertaId = pedidoOferta.id
      setPedidoOferta(null)
      dismissedIdsRef.current.add(ofertaId)
      fetch("/api/escalada", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: ofertaId, motoboy_recusou_id: motoboy_id }),
      }).catch(() => {
        supabase.from("pedidos")
          .update({ motoboy_id: null, status: "pronto" })
          .eq("id", ofertaId).eq("status", "aguardando_aceite")
          .then(() => {})
      })
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

  // ── Coordenadas do destino e da loja ──────────────────────────────────────
  useEffect(() => {
    if (emAndamento.length === 0) {
      setDestinoLat(null); setDestinoLng(null)
      setLojaLat(null);    setLojaLng(null)
      return
    }
    const p = emAndamento[0]

    // Destino do cliente: usa coords salvas no pedido, senão geocoda o endereço
    if ((p as any).lat_entrega && (p as any).lng_entrega) {
      setDestinoLat((p as any).lat_entrega)
      setDestinoLng((p as any).lng_entrega)
    } else if (p.endereco_entrega) {
      geocodeAddress(p.endereco_entrega).then(ll => {
        if (ll) { setDestinoLat(ll[0]); setDestinoLng(ll[1]) }
      })
    }

    // Localização da loja: usa loja_lat/loja_lng gravados no pedido pela escalada
    if ((p as any).loja_lat && (p as any).loja_lng) {
      setLojaLat((p as any).loja_lat)
      setLojaLng((p as any).loja_lng)
    } else {
      // Fallback: busca direto na tabela lojas (pedidos antigos sem loja_lat/loja_lng)
      const lojaId = (p as any).loja_id
      if (lojaId) {
        supabase.from("lojas").select("lat, lng, endereco").eq("id", lojaId).single()
          .then(({ data: loja }) => {
            if (loja?.lat && loja?.lng) {
              setLojaLat(loja.lat)
              setLojaLng(loja.lng)
            } else if (loja?.endereco) {
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
  const sendLocation = useCallback((lat: number, lng: number) => {
    fetch("/api/motoboy/update-location", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    }).catch(() => {})
    // Armazena no SW para envio em background sync
    navigator.serviceWorker?.controller?.postMessage({ type: "store-location", lat, lng })
  }, [])

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
        setMyLat(coords.latitude); setMyLng(coords.longitude)
        lastPosRef.current = { lat: coords.latitude, lng: coords.longitude }
        setGpsReady(true)
        sendLocation(coords.latitude, coords.longitude)
        if (firstGeoRef.current) {
          firstGeoRef.current = false
          reverseGeocode(coords.latitude, coords.longitude).then(c => { if (c) setCidadeAtual(c) })
        }
      },
      () => setCompartilhando(false),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
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
    if (motoboy_id) supabase.from("motoboys").update({ lat: null, lng: null }).eq("id", motoboy_id)
  }, [motoboy_id])

  // Pede localização imediatamente ao carregar — centraliza o mapa na posição real
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setMyLat(coords.latitude)
        setMyLng(coords.longitude)
        setGpsReady(true)
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

  // Heartbeat: atualiza last_seen a cada 30s quando online (cobre motoboys estacionários)
  useEffect(() => {
    if (!motoboy_id || !disponivel) return
    const iv = setInterval(() => {
      fetch("/api/motoboy/status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motoboy_id }),
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
    async function registerPush() {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
        const reg = await navigator.serviceWorker.register("/sw.js")
        await reg.update()
        const perm = await Notification.requestPermission()
        if (perm !== "granted") return
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) return
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })
        await fetch("/api/push", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "subscribe-motoboy", motoboy_id, subscription: sub }),
        })
      } catch {}
    }
    registerPush()
  }, [motoboy_id])

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
        method: "POST", headers: { "Content-Type": "application/json" },
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
    const { error } = await supabase.from("pedidos")
      .update({ status: "indo_para_loja", motoboy_id })
      .eq("id", pedido.id)
      .eq("status", "pronto")  // race condition guard
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

  async function marcarEntregue(pedido: Pedido) {
    setAtualizando(pedido.id)
    await supabase.from("pedidos").update({ status: "entregue" }).eq("id", pedido.id)
    enviarPush(pedido.id, "entregue", pedido.codigo)
    setGanhosDia(prev => prev + (pedido.taxa_entrega ?? 0))
    setCorridasDia(prev => prev + 1)
    await loadPedidos()
    setAtualizando(null)
    setConfirmandoId(null); setCodigoInput(""); setErroConfirm("")
  }

  // ── Aceitar corrida (atômico — protege contra dois motoboys) ──────────────
  async function aceitarCorrida() {
    if (!pedidoOferta || !motoboy_id) return
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
    const ofertaId = pedidoOferta.id
    setPedidoOferta(null)
    dismissedIdsRef.current.add(ofertaId)
    // Escalada: tenta próximo motoboy (ou fila geral se atingiu limite)
    try {
      await fetch("/api/escalada", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: ofertaId, motoboy_recusou_id: motoboy_id }),
      })
    } catch {
      // Fallback: devolve para fila geral
      await supabase.from("pedidos")
        .update({ motoboy_id: null, status: "pronto" })
        .eq("id", ofertaId).eq("status", "aguardando_aceite")
    }
    // Incrementa campo recusas (se existir)
    try {
      const { data: mb } = await supabase.from("motoboys").select("recusas").eq("id", motoboy_id).single()
      await supabase.from("motoboys").update({ recusas: (mb?.recusas ?? 0) + 1 }).eq("id", motoboy_id)
    } catch {}
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
      setGanhosDia(prev => prev + (ativa.taxa_entrega ?? 0))
      setCorridasDia(prev => prev + 1)
      setSegundoAberto(false)
      enviarPush(ativa.id, "entregue", ativa.codigo)
    } else {
      setEmAndamento(prev => prev.map(p => p.id === ativa.id ? { ...p, status: nextStatus as any } : p))
    }

    setAvancandoEtapa(false)
    loadPedidos()
  }

  function confirmarCodigo(pedido: Pedido) {
    if (codigoInput.trim().toUpperCase() !== pedido.codigo.toUpperCase()) {
      setErroConfirm("Código incorreto. Peça ao cliente para mostrar o código na tela.")
      return
    }
    marcarEntregue(pedido)
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
  const segundaEntrega = corridasAtivas[1] ?? null
  const ETAPA_MAP: Record<string, number> = { "indo_para_loja": 0, "na_loja": 1, "em_rota": 2, "coletado": 2, "entregue": 3 }
  const etapaAtual = corridaConcluida ? 3 : (ETAPA_MAP[corridaAtiva?.status ?? ""] ?? 0)
  const ETAPAS_LABEL = ["Indo à loja", "Na loja", "Em rota", "Entregue!"]

  // Quando indo à loja, rota aponta para a loja; nas demais etapas, para o cliente
  const efetDestinoLat = corridaAtiva?.status === "indo_para_loja" ? (lojaLat ?? destinoLat) : destinoLat
  const efetDestinoLng = corridaAtiva?.status === "indo_para_loja" ? (lojaLng ?? destinoLng) : destinoLng

  // Pins extras do 2º pedido para o mapa
  const extrasLojaMap: PinExtra[] = segundaEntrega
    ? [{ lat: (segundaEntrega as any).loja?.lat ?? (segundaEntrega as any).loja_lat, lng: (segundaEntrega as any).loja?.lng ?? (segundaEntrega as any).loja_lng, type: "loja" as const }].filter(p => p.lat && p.lng)
    : []
  const extrasDestinoMap: PinExtra[] = segundaEntrega && ["em_rota","coletado"].includes(segundaEntrega.status)
    ? [{ lat: (segundaEntrega as any).lat_entrega, lng: (segundaEntrega as any).lng_entrega, type: "destino" as const }].filter(p => p.lat && p.lng)
    : []

  return (
    <div style={{ position: "fixed", top: 52, left: 0, right: 0, bottom: 60, background: "#1a1a2e" }}>

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

      {/* ── Toast de erro ── */}
      {/* ── Banner de status no mapa ── */}
      {(corridaAtiva || corridaConcluida) && (
        <div style={{
          position: "absolute",
          top: 12, left: 12, right: 12, zIndex: 30,
          borderRadius: 14, padding: "10px 14px",
          background: "rgba(0,0,0,0.78)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            {ETAPAS_LABEL.map((label, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", flex: i < 3 ? 1 : undefined }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: i < etapaAtual ? "#22C55E" : i === etapaAtual ? "#FF8C00" : "#3A3A3C",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.35s",
                  }}>
                    {i < etapaAtual ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <span style={{ color: "white", fontSize: 8, fontWeight: 900 }}>{i + 1}</span>
                    )}
                  </div>
                  <p style={{
                    color: i <= etapaAtual ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)",
                    fontSize: 8, fontWeight: i === etapaAtual ? 800 : 500,
                    textAlign: "center", maxWidth: 44, lineHeight: 1.2, margin: 0,
                  }}>
                    {label}
                  </p>
                </div>
                {i < 3 && (
                  <div style={{
                    flex: 1, height: 2, marginTop: 10,
                    background: i < etapaAtual ? "#22C55E" : "#3A3A3C",
                    transition: "background 0.35s",
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {toastMsg && (
        <div style={{
          position: "absolute", top: 60, left: 12, right: 12, zIndex: 60,
          background: "#1C1C1E", border: "1px solid rgba(255,68,68,0.45)",
          borderRadius: 14, padding: "12px 16px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
          animation: "slideUpCard 0.2s ease-out",
        }}>
          <p style={{ color: "#FF4444", fontWeight: 700, fontSize: 14 }}>{toastMsg}</p>
        </div>
      )}

      {/* ── Card de oferta de corrida (Tópico 02) ── */}
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

      {/* ── Ganhos do dia — badge central no topo ── */}
      <div style={{
        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 20,
        background: "rgba(0,0,0,0.78)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        borderRadius: 999, padding: "8px 18px",
        border: "1px solid rgba(255,255,255,0.12)",
        display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
        whiteSpace: "nowrap",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ganhosDia > 0 ? "#22c55e" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        <span style={{ color: ganhosDia > 0 ? "#22c55e" : "rgba(255,255,255,0.5)", fontWeight: 900, fontSize: 16, letterSpacing: 0.3 }}>
          R$ {ganhosDia.toFixed(2)}
        </span>
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, fontWeight: 600 }}>
          {corridasDia > 0 ? `${corridasDia}x · hoje` : "hoje"}
        </span>
      </div>

      {/* ── Toggle online/offline — canto superior direito ── */}
      <div
        onClick={!dispLoading && !togglingDisp && !corridaAtiva && !corridaConcluida ? toggleDisponivel : undefined}
        style={{
          position: "absolute", top: 12, right: 12, zIndex: 20,
          background: disponivel ? "rgba(34,197,94,0.14)" : "rgba(0,0,0,0.72)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          border: "1.5px solid " + (disponivel ? "rgba(34,197,94,0.55)" : "rgba(255,255,255,0.12)"),
          borderRadius: 999, padding: "8px 16px 8px 12px",
          display: "flex", alignItems: "center", gap: 8,
          cursor: dispLoading || togglingDisp || corridaAtiva || corridaConcluida ? "not-allowed" : "pointer",
          opacity: togglingDisp || corridaAtiva || corridaConcluida ? 0.45 : 1,
          transition: "all 0.3s ease",
          userSelect: "none",
        }}
      >
        {/* Ícone: raio (online) ou lua (offline) */}
        {disponivel ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}

        {/* Dot com pulse quando online */}
        <div style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
          {disponivel && (
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "#22c55e",
              animation: "motoPulse 1.8s ease-out infinite",
            }} />
          )}
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: disponivel ? "#22c55e" : "#444",
            position: "relative",
          }} />
        </div>

        <span style={{
          color: disponivel ? "#22c55e" : "rgba(255,255,255,0.45)",
          fontSize: 12, fontWeight: 800, letterSpacing: 0.2,
        }}>
          {togglingDisp ? "..." : disponivel ? "Online" : "Offline"}
        </span>
      </div>

      {/* ── Botão de raio de atuação — canto inferior direito sobre o mapa ── */}
      {!corridaAtiva && !corridaConcluida && (
        <div style={{
          position: "absolute", bottom: sheetH + 16, right: 14, zIndex: 25,
          display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10,
        }}>
          {/* Painel do slider */}
          {raioOpen && (
            <div style={{
              background: "rgba(10,10,10,0.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
              borderRadius: 18, padding: "16px 18px",
              border: "1px solid rgba(249,115,22,0.35)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
              width: 220,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <p style={{ color: "white", fontWeight: 800, fontSize: 13 }}>Raio de atuação</p>
                <span style={{ color: "#f97316", fontWeight: 900, fontSize: 20 }}>{raioDisplay} km</span>
              </div>
              <input
                type="range"
                min={1} max={40} step={1}
                value={raioDisplay}
                onChange={e => setRaioDisplay(Number(e.target.value))}
                onMouseUp={() => salvarRaio(raioDisplay)}
                onTouchEnd={() => salvarRaio(raioDisplay)}
                style={{
                  width: "100%", accentColor: "#f97316",
                  cursor: "pointer", height: 4,
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>1 km</span>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>40 km</span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, marginTop: 8, textAlign: "center" }}>
                {salvandoRaio ? "Salvando..." : `Pedidos em até ${raioDisplay} km`}
              </p>
            </div>
          )}

          {/* Botão raio */}
          <button
            onClick={() => setRaioOpen(o => !o)}
            style={{
              width: 48, height: 48, borderRadius: "50%", border: "none",
              background: raioOpen ? "#f97316" : "rgba(10,10,10,0.82)",
              backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              boxShadow: raioOpen ? "0 0 0 3px rgba(249,115,22,0.4), 0 4px 16px rgba(0,0,0,0.5)" : "0 2px 14px rgba(0,0,0,0.5)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}
          >
            {/* Ícone de radar/raio */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={raioOpen ? "white" : "rgba(249,115,22,0.9)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="2"/>
              <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── GPS badge + cidade — canto superior esquerdo ── */}
      {disponivel && (
        <div style={{
          position: "absolute", top: 12, left: 12, zIndex: 20,
          background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          borderRadius: 999, padding: "6px 11px",
          border: `1px solid ${compartilhando ? "rgba(34,197,94,0.3)" : "rgba(249,115,22,0.3)"}`,
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: compartilhando ? "#22c55e" : "#f97316", display: "inline-block", flexShrink: 0 }} />
          {compartilhando ? (
            <>
              <span style={{ color: "#22c55e", fontSize: 10, fontWeight: 700 }}>GPS</span>
              {cidadeAtual && (
                <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: 600 }}>· {cidadeAtual}</span>
              )}
            </>
          ) : (
            <span style={{ color: "#f97316", fontSize: 10, fontWeight: 700 }}>Sem GPS · ative a localização</span>
          )}
        </div>
      )}

      {/* ── Legenda rota (só quando NÃO tem corrida ativa no painel) ── */}
      {!corridaAtiva && !corridaConcluida && entregaAtiva && destinoLat && (
        <div style={{
          position: "absolute", bottom: sheetH + 12, left: 12, zIndex: 20,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          borderRadius: 12, padding: "8px 14px",
          border: "1px solid rgba(249,115,22,0.3)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <div style={{ width: 16, height: 3, borderRadius: 2, background: "#f97316", borderTop: "2px dashed #f97316" }} />
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 700 }}>Rota até o cliente</span>
          </div>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>{entregaAtiva.endereco_entrega?.split(",")[0]}</p>
        </div>
      )}

      {/* ── Modal SOS — renderizado no nível raiz para escapar do overflow:hidden do painel ── */}
      {sosModal && motoboy_id && (
        <SOSModal
          motoboyId={motoboy_id}
          pedidoId={corridaAtiva?.id ?? emAndamento[0]?.id ?? ""}
          lat={myLat}
          lng={myLng}
          onClose={() => setSosModal(false)}
        />
      )}

      {/* ── Badge do 2º pedido ativo (botão flutuante) ── */}
      {segundaEntrega && !corridaConcluida && (
        <button
          onClick={() => setSegundoAberto(o => !o)}
          style={{
            position: "absolute", top: 62, left: 12, zIndex: 36,
            background: segundoAberto ? "#f97316" : "rgba(10,10,10,0.85)",
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            border: `1.5px solid ${segundoAberto ? "transparent" : "rgba(249,115,22,0.6)"}`,
            borderRadius: 999, padding: "7px 14px",
            display: "flex", alignItems: "center", gap: 7,
            color: "white", fontWeight: 800, fontSize: 12,
            cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
          }}>
          <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 999, padding: "1px 7px", fontSize: 10, fontWeight: 900 }}>2</span>
          2° pedido #{segundaEntrega.codigo}
          <span style={{ fontSize: 10, opacity: 0.7 }}>
            {segundaEntrega.status === "indo_para_loja" ? "• indo à loja" : segundaEntrega.status === "na_loja" ? "• na loja" : "• em rota"}
          </span>
        </button>
      )}

      {/* ── Botão aceitar pedido disponível (quando carregando 1 de max=2) ── */}
      {corridaAtiva && !corridaConcluida && !segundaEntrega && prontos.length > 0 && emAndamento.length < maxPedidos && (
        <button
          onClick={() => setDisponiveisAberto(o => !o)}
          style={{
            position: "absolute", top: 62, left: 12, zIndex: 36,
            background: disponiveisAberto ? "#22c55e" : "rgba(10,10,10,0.85)",
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            border: `1.5px solid ${disponiveisAberto ? "transparent" : "rgba(34,197,94,0.6)"}`,
            borderRadius: 999, padding: "7px 14px",
            display: "flex", alignItems: "center", gap: 7,
            color: "white", fontWeight: 800, fontSize: 12,
            cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
          }}>
          <span style={{ fontSize: 14 }}>+</span>
          {prontos.length} pedido{prontos.length > 1 ? "s" : ""} disponível{prontos.length > 1 ? "is" : ""}
        </button>
      )}

      {/* ── Mini-sheet do 2º pedido ativo ── */}
      {segundoAberto && segundaEntrega && !corridaConcluida && (
        <div style={{
          position: "absolute", top: 100, left: 10, right: 10, zIndex: 37,
          background: "rgba(10,10,10,0.96)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          borderRadius: 20, padding: "16px",
          border: "1px solid rgba(249,115,22,0.4)",
          boxShadow: "0 4px 32px rgba(0,0,0,0.6)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <p style={{ color: "#f97316", fontWeight: 900, fontSize: 13 }}>
                2° pedido — #{segundaEntrega.codigo}
              </p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>
                R$ {(segundaEntrega.taxa_entrega ?? 0).toFixed(2)} • {(segundaEntrega as any).loja?.nome ?? "—"}
              </p>
            </div>
            <button onClick={() => setSegundoAberto(false)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer" }}>×</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
              {segundaEntrega.status === "indo_para_loja" && `🏪 Indo buscar em ${(segundaEntrega as any).loja?.nome}`}
              {segundaEntrega.status === "na_loja" && "📦 Aguardando coleta na loja"}
              {["em_rota","coletado"].includes(segundaEntrega.status) && `🏠 Entregando em ${segundaEntrega.endereco_entrega}`}
            </p>
          </div>

          {segundaEntrega.status === "indo_para_loja" && (
            <button onClick={() => { avancarEtapa(segundaEntrega); setSegundoAberto(false) }} disabled={avancandoEtapa} style={{
              width: "100%", padding: "12px", borderRadius: 12, border: "none",
              background: "#f97316", color: "white", fontWeight: 900, fontSize: 13, cursor: "pointer",
            }}>
              {avancandoEtapa ? "..." : "Cheguei na loja"}
            </button>
          )}
          {segundaEntrega.status === "na_loja" && (
            <button onClick={() => { avancarEtapa(segundaEntrega); setSegundoAberto(false) }} disabled={avancandoEtapa} style={{
              width: "100%", padding: "12px", borderRadius: 12, border: "none",
              background: "#22c55e", color: "white", fontWeight: 900, fontSize: 13, cursor: "pointer",
            }}>
              {avancandoEtapa ? "..." : "Coletei o pedido"}
            </button>
          )}
          {["em_rota","coletado"].includes(segundaEntrega.status) && (
            <button onClick={() => { avancarEtapa(segundaEntrega); setSegundoAberto(false) }} disabled={avancandoEtapa} style={{
              width: "100%", padding: "12px", borderRadius: 12, border: "none",
              background: "#818cf8", color: "white", fontWeight: 900, fontSize: 13, cursor: "pointer",
            }}>
              {avancandoEtapa ? "..." : "Confirmar entrega"}
            </button>
          )}
        </div>
      )}

      {/* ── Mini-sheet de pedidos disponíveis (para aceitar 2° pedido) ── */}
      {disponiveisAberto && !corridaConcluida && (
        <div style={{
          position: "absolute", top: 100, left: 10, right: 10, zIndex: 37,
          background: "rgba(10,10,10,0.96)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          borderRadius: 20, padding: "16px",
          border: "1px solid rgba(34,197,94,0.4)",
          boxShadow: "0 4px 32px rgba(0,0,0,0.6)",
          maxHeight: "40vh", overflowY: "auto",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ color: "#22c55e", fontWeight: 900, fontSize: 13 }}>Pedidos disponíveis</p>
            <button onClick={() => setDisponiveisAberto(false)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer" }}>×</button>
          </div>
          {prontos.map(p => (
            <div key={p.id} style={{
              background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "12px",
              marginBottom: 10, border: "1px solid rgba(34,197,94,0.2)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
                  #{p.codigo} · {(p as any).loja?.nome ?? "—"}
                </p>
                <p style={{ color: "#22c55e", fontWeight: 900, fontSize: 15 }}>R$ {(p.taxa_entrega ?? 0).toFixed(2)}</p>
              </div>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 10 }}>{p.endereco_entrega}</p>
              <button onClick={() => aceitarEntrega(p)} disabled={!!atualizando} style={{
                width: "100%", padding: "10px", borderRadius: 10, border: "none",
                background: atualizando === p.id ? "rgba(34,197,94,0.3)" : "#22c55e",
                color: "white", fontWeight: 900, fontSize: 13, cursor: "pointer",
              }}>
                {atualizando === p.id ? "..." : "Aceitar 2° pedido"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Painel de corrida ativa (Tópico 03) ── */}
      {(corridaAtiva || corridaConcluida) && (
        <CorridaAtivaPanel
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
          onSOSOpen={() => setSosModal(true)}
          onSetDestino={(lat, lng) => { setDestinoLat(lat); setDestinoLng(lng); setFitBoundsTrigger(n => n + 1) }}
        />
      )}

      {/* ── Bottom Sheet (só quando sem corrida ativa) ── */}
      {!corridaAtiva && !corridaConcluida && <div
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          height: sheetH, background: "#111",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.6)",
          zIndex: 30, display: "flex", flexDirection: "column",
          transition: isDragging.current ? "none" : "height 0.3s cubic-bezier(0.32,0.72,0,1)",
          overflow: "hidden",
        }}
      >
        {/* Drag handle — Pointer Capture garante captura fora do elemento */}
        <div
          style={{ padding: "16px 0 10px", cursor: "grab", flexShrink: 0, touchAction: "none", userSelect: "none" }}
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto" }} />
        </div>

        {/* Header sheet — clicável para expandir/recolher */}
        <div
          onClick={() => setSheetH(h => h === SHEET_PEEK ? SHEET_MID : h === SHEET_MID ? SHEET_FULL : SHEET_PEEK)}
          style={{ padding: "0 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, cursor: "pointer", userSelect: "none" }}
        >
          <div>
            {!disponivel ? (
              <p style={{ color: "rgba(255,255,255,0.4)", fontWeight: 700, fontSize: 14 }}>Você está offline</p>
            ) : pedidosLoading ? (
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Carregando...</p>
            ) : emAndamento.length > 0 ? (
              <p style={{ color: "#60a5fa", fontWeight: 800, fontSize: 14 }}>
                {emAndamento.length} entrega{emAndamento.length > 1 ? "s" : ""} em andamento
              </p>
            ) : prontos.length > 0 ? (
              <p style={{ color: "#f97316", fontWeight: 800, fontSize: 14 }}>
                {prontos.length} pedido{prontos.length > 1 ? "s" : ""} disponíve{prontos.length > 1 ? "is" : "l"}
              </p>
            ) : (
              <p style={{ color: "rgba(255,255,255,0.3)", fontWeight: 600, fontSize: 14 }}>Aguardando pedidos...</p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {disponivel && (prontos.length > 0 || emAndamento.length > 0) && (
              <span style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, color: "rgba(255,255,255,0.4)", fontSize: 11, padding: "4px 10px" }}>
                {sheetH <= SHEET_PEEK ? "Ver ▲" : sheetH >= SHEET_FULL ? "Recolher ▼" : "▲"}
              </span>
            )}
          </div>
        </div>

        {/* Conteúdo scrollável */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 14px", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>

          {/* Offline */}
          {!disponivel && (
            <div style={{ textAlign: "center", paddingTop: 6 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                {fotoMotoboy ? (
                  <img src={fotoMotoboy} alt="Foto" style={{
                    width: 56, height: 56, borderRadius: "50%", objectFit: "cover",
                    border: "2px solid rgba(255,255,255,0.15)", opacity: 0.7,
                  }} />
                ) : (
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%", opacity: 0.25,
                    background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Localização atual */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 999, padding: "5px 12px", marginBottom: 14,
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={cidadeAtual ? "#22c55e" : "rgba(255,255,255,0.2)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <span style={{ fontSize: 11, fontWeight: 700, color: cidadeAtual ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)" }}>
                  {cidadeAtual ?? "Detectando localização..."}
                </span>
              </div>

              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, marginBottom: 18 }}>
                Fique online para receber pedidos na sua região
              </p>
              <button onClick={toggleDisponivel} disabled={togglingDisp || dispLoading} style={{
                width: "100%", padding: "16px", borderRadius: 16, border: "none",
                background: "#22c55e", color: "white", fontWeight: 900, fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                {togglingDisp ? "..." : "Ficar Online"}
              </button>

            </div>
          )}

          {/* Online sem pedidos */}
          {disponivel && !pedidosLoading && prontos.length === 0 && emAndamento.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, opacity: 0.25 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
                </svg>
              </div>
              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Novos pedidos aparecerão aqui</p>
            </div>
          )}

          {/* Entregas em andamento */}
          {disponivel && emAndamento.map(p => (
            <div key={p.id} style={{
              background: "#0d1117", borderRadius: 16,
              border: "1px solid rgba(59,130,246,0.35)", marginBottom: 12, overflow: "hidden",
            }}>
              <div style={{ background: "rgba(59,130,246,0.08)", padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: "rgba(59,130,246,0.2)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }}>
                    Em andamento
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>#{p.codigo}</span>
                </div>
                <p style={{ color: "white", fontWeight: 900, fontSize: 18 }}>R$ {(p.taxa_entrega ?? 0).toFixed(2)}</p>
              </div>

              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f97316", flexShrink: 0, marginTop: 5 }} />
                    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.4 }}>
                      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>Coletar em </span>
                      <strong style={{ color: "white" }}>{(p as any).loja?.nome ?? "—"}</strong>
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0, marginTop: 5 }} />
                    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.4 }}>
                      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>Entregar em </span>
                      {p.endereco_entrega}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: PGTO_COLOR[p.forma_pagamento] ?? "#818cf8", flexShrink: 0 }} />
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{PGTO[p.forma_pagamento] ?? p.forma_pagamento}</p>
                  </div>
                  {p.observacao && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.15)", flexShrink: 0, marginTop: 4 }} />
                      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, fontStyle: "italic" }}>{p.observacao}</p>
                    </div>
                  )}
                </div>

                {/* ── Botão de ação baseado no status ── */}
                {p.status === "indo_para_loja" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f97316", flexShrink: 0, animation: "gpsPulse 1.5s ease-out infinite" }} />
                      <p style={{ color: "#f97316", fontSize: 13, fontWeight: 700 }}>🏪 A caminho da loja — rota no mapa</p>
                    </div>
                    <button
                      onClick={() => avancarEtapa()}
                      disabled={!!atualizando}
                      style={{
                        width: "100%", padding: "16px", borderRadius: 14, border: "none",
                        background: atualizando === p.id ? "rgba(249,115,22,0.4)" : "#f97316",
                        color: "white", fontWeight: 900, fontSize: 16, cursor: atualizando ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                        boxShadow: "0 4px 16px rgba(249,115,22,0.35)",
                      }}>
                      {atualizando === p.id ? "..." : "📦 Cheguei na loja — Pedido recebido"}
                    </button>
                  </div>
                )}

                {p.status === "na_loja" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                      <p style={{ color: "#22c55e", fontSize: 13, fontWeight: 700 }}>✅ Na loja — pegue o pedido e clique abaixo</p>
                    </div>
                    <button
                      onClick={() => avancarEtapa()}
                      disabled={!!atualizando}
                      style={{
                        width: "100%", padding: "16px", borderRadius: 14, border: "none",
                        background: atualizando === p.id ? "rgba(34,197,94,0.4)" : "#22c55e",
                        color: "white", fontWeight: 900, fontSize: 16, cursor: atualizando ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                        boxShadow: "0 4px 16px rgba(34,197,94,0.35)",
                      }}>
                      {atualizando === p.id ? "..." : "🛵 Peguei o pedido — Saindo para entrega"}
                    </button>
                  </div>
                )}

                {(p.status === "em_rota" || p.status === "coletado") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#818cf8", flexShrink: 0, animation: "gpsPulse 1.5s ease-out infinite" }} />
                      <p style={{ color: "#818cf8", fontSize: 13, fontWeight: 700 }}>🏠 A caminho do cliente — rota no mapa</p>
                    </div>
                    {confirmandoId === p.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600 }}>Peça o código ao cliente:</p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            value={codigoInput}
                            onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setErroConfirm("") }}
                            onKeyDown={e => e.key === "Enter" && confirmarCodigo(p)}
                            placeholder="0000" maxLength={8} autoFocus
                            style={{
                              flex: 1, padding: "12px 14px", borderRadius: 12, fontSize: 26,
                              fontWeight: 900, letterSpacing: 10, textAlign: "center",
                              background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.18)",
                              color: "white", outline: "none",
                            }}
                          />
                          <button onClick={() => confirmarCodigo(p)} disabled={!codigoInput.trim() || !!atualizando} style={{
                            padding: "12px 18px", borderRadius: 12, border: "none", fontSize: 22,
                            background: codigoInput.trim() ? "#22c55e" : "rgba(34,197,94,0.15)",
                            color: "white", fontWeight: 900, cursor: codigoInput.trim() ? "pointer" : "not-allowed",
                          }}>
                            {atualizando === p.id ? "..." : "✓"}
                          </button>
                          <button onClick={() => setConfirmandoId(null)} style={{
                            padding: "12px 14px", borderRadius: 12,
                            background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16,
                          }}>×</button>
                        </div>
                        {erroConfirm && (
                          <p style={{ color: "#f87171", fontSize: 12, fontWeight: 600, padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.15)" }}>
                            {erroConfirm}
                          </p>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => { setConfirmandoId(p.id); setCodigoInput(""); setErroConfirm("") }}
                        disabled={!!atualizando}
                        style={{
                          width: "100%", padding: "14px", borderRadius: 14, border: "none",
                          background: atualizando === p.id ? "rgba(34,197,94,0.3)" : "#22c55e",
                          color: "white", fontWeight: 900, fontSize: 15, cursor: "pointer",
                        }}>
                        {atualizando === p.id ? "..." : "✓ Confirmar entrega com código"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Pedidos prontos */}
          {disponivel && prontos.length > 0 && (
            <>
              {emAndamento.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 10px" }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                  <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                    Disponíveis
                  </span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                </div>
              )}
              {prontos.map(p => (
                <div key={p.id} style={{
                  background: "#0d1117", borderRadius: 16,
                  border: "1px solid rgba(249,115,22,0.35)", marginBottom: 10, overflow: "hidden",
                }}>
                  <div style={{ background: "rgba(249,115,22,0.08)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: "rgba(249,115,22,0.18)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }}>
                        Disponível
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
                        #{p.codigo} · {new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p style={{ color: "white", fontWeight: 900, fontSize: 17 }}>R$ {(p.taxa_entrega ?? 0).toFixed(2)}</p>
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f97316", flexShrink: 0, marginTop: 4 }} />
                        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
                          {(p as any).loja?.nome ?? "—"}
                          {(p as any).loja?.endereco && (
                            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, display: "block" }}>{(p as any).loja.endereco}</span>
                          )}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0, marginTop: 4 }} />
                        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>{p.endereco_entrega}</p>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ width: 7, height: 7, borderRadius: 2, background: PGTO_COLOR[p.forma_pagamento] ?? "#818cf8", flexShrink: 0 }} />
                        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{PGTO[p.forma_pagamento] ?? p.forma_pagamento}</p>
                      </div>
                      {p.itens && p.itens.length > 0 && (
                        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginLeft: 21 }}>
                          {p.itens.map((i: any) => `${i.quantidade}x ${i.nome}`).join(" · ")}
                        </p>
                      )}
                    </div>
                    <button onClick={() => aceitarEntrega(p)} disabled={!!atualizando} style={{
                      width: "100%", padding: "14px", borderRadius: 14, border: "none",
                      background: atualizando === p.id ? "rgba(249,115,22,0.4)" : "#f97316",
                      color: "white", fontWeight: 900, fontSize: 15, cursor: "pointer",
                    }}>
                      {atualizando === p.id ? "..." : "Aceitar entrega"}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>}
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
function CorridaAtivaPanel({
  pedido, corridaConcluida, avancando, onAvancar, onConcluir,
  motoboyId, myLat, myLng, lojaLat, lojaLng, destinoLat, destinoLng,
  onSOSOpen, onSetDestino,
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
  onSOSOpen: () => void
  onSetDestino?: (lat: number, lng: number) => void
}) {
  const [navDestino,      setNavDestino]      = useState<{ texto: string; lat?: number; lng?: number } | null>(null)
  const [codigoInput,     setCodigoInput]     = useState("")
  const [erroConfirm,     setErroConfirm]     = useState("")
  const [chegueiEnviado,  setChegueiEnviado]  = useState(false)
  const [enviandoCheguei, setEnviandoCheguei] = useState(false)
  const [collapsed,       setCollapsed]       = useState(false)

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
    if (codigoInput.trim().toUpperCase() !== (p?.codigo ?? "").toUpperCase()) {
      setErroConfirm("Código incorreto. Peça ao cliente para mostrar novamente.")
      return
    }
    setErroConfirm("")
    onAvancar()
  }

  const expandedH = etapa === 2 && !chegueiEnviado ? "38%" : "52%"
  const STATUS_LABEL: Record<string, string> = {
    "indo_para_loja": "🏪 Indo à loja",
    "na_loja":        "📦 Na loja",
    "em_rota":        "🏠 Em rota",
    "coletado":       "🛵 Em rota",
    "entregue":       "✅ Entregue",
  }
  const statusLabel = corridaConcluida ? "✅ Entregue" : STATUS_LABEL[pedido?.status ?? ""] ?? "Em andamento"

  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      height: collapsed ? 52 : expandedH, background: "#1C1C1E",
      borderRadius: "20px 20px 0 0",
      boxShadow: "0 -4px 32px rgba(0,0,0,0.7)",
      zIndex: 35, display: "flex", flexDirection: "column",
      overflow: "hidden", boxSizing: "border-box",
      transition: "height 0.3s cubic-bezier(0.32,0.72,0,1)",
    }}>
      {/* Modal de navegação */}
      {navDestino && (
        <NavModal
          destino={navDestino}
          onClose={() => setNavDestino(null)}
          onNavApp={(lat, lng) => {
            if (lat && lng && onSetDestino) onSetDestino(lat, lng)
            setNavDestino(null)
          }}
        />
      )}

      {/* Handle + toggle */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ padding: "8px 16px 4px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, cursor: "pointer", userSelect: "none" }}
      >
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
        </div>
      </div>

      {/* Barra de status colapsada */}
      {collapsed && (
        <div
          onClick={() => setCollapsed(false)}
          style={{ padding: "0 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        >
          <span style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{statusLabel}</span>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>▲ expandir</span>
        </div>
      )}

      {/* Conteúdo */}
      {!collapsed && <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "2px 16px 16px", width: "100%", boxSizing: "border-box" }}>

        {/* ETAPA 4 — Entregue */}
        {etapa === 3 && (
          <div style={{ textAlign: "center", paddingTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "2px solid #22C55E", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            </div>
            <p style={{ color: "#22C55E", fontWeight: 900, fontSize: 17, marginBottom: 3 }}>Entrega confirmada!</p>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginBottom: 10 }}>
              Pedido #{p?.codigo} entregue com sucesso
            </p>
            <p style={{ color: "#FF8C00", fontWeight: 900, fontSize: 26, marginBottom: 14 }}>
              + R$ {((p?.taxa_entrega ?? 0) as number).toFixed(2).replace(".", ",")}
            </p>
            <button onClick={onConcluir} style={{
              width: "100%", padding: "15px", borderRadius: 14,
              border: "none", background: "#FF8C00", color: "white",
              fontWeight: 900, fontSize: 15, cursor: "pointer",
            }}>
              Voltar para pedidos
            </button>
          </div>
        )}

        {/* ETAPA 1 — Indo à loja */}
        {etapa === 0 && (
          <>
            <div style={{ marginBottom: 12 }}>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Buscar pedido em</p>
              <p style={{ color: "white", fontWeight: 800, fontSize: 16 }}>{loja?.nome ?? "—"}</p>
              {loja?.endereco && <p style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{loja.endereco}</p>}
            </div>
            <button onClick={() => onAvancar()} disabled={avancando} style={{
              width: "100%", padding: "14px", borderRadius: 14, border: "none",
              background: "#FF8C00", color: "white", fontWeight: 900, fontSize: 14,
              cursor: "pointer", marginBottom: 8,
            }}>
              {avancando ? "Salvando..." : "Cheguei na loja"}
            </button>
            <button onClick={() => setNavDestino({ texto: loja?.endereco ?? loja?.nome ?? "", lat: lojaLat ?? (p as any).loja_lat ?? undefined, lng: lojaLng ?? (p as any).loja_lng ?? undefined })} style={{
              width: "100%", padding: "13px", borderRadius: 14,
              border: "1.5px solid rgba(255,255,255,0.18)", background: "transparent",
              color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>
              Navegar até a loja
            </button>
          </>
        )}

        {/* ETAPA 2 — Na loja */}
        {etapa === 1 && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Pedido #{p?.codigo}</p>
                {loja?.telefone && (
                  <a href={`tel:${loja.telefone}`} style={{
                    color: "#FF8C00", fontSize: 11, fontWeight: 700, textDecoration: "none",
                    padding: "3px 10px", borderRadius: 8, border: "1px solid rgba(255,140,0,0.3)",
                  }}>
                    Ligar para loja
                  </a>
                )}
              </div>
              {p?.itens?.length > 0 && (
                <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px" }}>
                  {p.itens.map((item: any, i: number) => (
                    <p key={item.id ?? i} style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, marginBottom: i < p.itens.length - 1 ? 4 : 0 }}>
                      {item.quantidade}× {item.nome}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => onAvancar()} disabled={avancando} style={{
              width: "100%", padding: "14px", borderRadius: 14, border: "none",
              background: "#FF8C00", color: "white", fontWeight: 900, fontSize: 14,
              cursor: "pointer",
            }}>
              {avancando ? "Salvando..." : "Coletei o pedido"}
            </button>
          </>
        )}

        {/* ETAPA 3 — Em rota */}
        {etapa === 2 && (
          <>
            <div style={{ marginBottom: 10 }}>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Entregar em</p>
              <p style={{ color: "white", fontWeight: 800, fontSize: 14, lineHeight: 1.4, wordBreak: "break-word", overflowWrap: "anywhere" }}>{p?.endereco_entrega}</p>
              {p?.observacao && (
                <p style={{ color: "#aaa", fontSize: 12, marginTop: 4, wordBreak: "break-word" }}>{p.observacao}</p>
              )}
            </div>

            {/* Input de código — só aparece após "Cheguei no local" */}
            {chegueiEnviado && (
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
                  Peça o código ao cliente:
                </p>
                <input
                  value={codigoInput}
                  onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setErroConfirm("") }}
                  onKeyDown={e => { if (e.key === "Enter") confirmarEntrega() }}
                  placeholder="Digite o código"
                  maxLength={8}
                  inputMode="text"
                  autoComplete="off"
                  autoFocus
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "14px", borderRadius: 12,
                    fontSize: 26, fontWeight: 900, letterSpacing: 10, textAlign: "center",
                    background: "rgba(255,255,255,0.07)",
                    border: erroConfirm ? "1.5px solid rgba(239,68,68,0.6)" : "1.5px solid rgba(255,255,255,0.15)",
                    color: "white", outline: "none",
                  }}
                />
                {erroConfirm && (
                  <p style={{ color: "#f87171", fontSize: 11, fontWeight: 600, marginTop: 8, padding: "6px 10px", background: "rgba(239,68,68,0.08)", borderRadius: 8 }}>
                    {erroConfirm}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() => setNavDestino({ texto: p?.endereco_entrega ?? "", lat: destinoLat ?? (p as any).lat_entrega ?? undefined, lng: destinoLng ?? (p as any).lng_entrega ?? undefined })}
              style={{
                width: "100%", padding: "11px", borderRadius: 12, marginBottom: 8,
                border: "1.5px solid rgba(255,255,255,0.14)", background: "transparent",
                color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", fontWeight: 700,
              }}>
              🗺 Navegar até o cliente
            </button>

            {!chegueiEnviado ? (
              <button
                onClick={avisarCheguei}
                disabled={enviandoCheguei}
                style={{
                  width: "100%", padding: "14px", borderRadius: 14, border: "none",
                  background: enviandoCheguei ? "rgba(34,211,238,0.3)" : "#0891b2",
                  color: "white", fontWeight: 900, fontSize: 14,
                  cursor: enviandoCheguei ? "not-allowed" : "pointer", marginBottom: 8,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                {enviandoCheguei ? "Avisando..." : "📍 Cheguei no local"}
              </button>
            ) : (
              <button
                onClick={confirmarEntrega}
                disabled={avancando}
                style={{
                  width: "100%", padding: "14px", borderRadius: 14, border: "none",
                  background: codigoInput.trim() ? "#22c55e" : "rgba(34,197,94,0.2)",
                  color: "white", fontWeight: 900, fontSize: 14,
                  cursor: avancando ? "not-allowed" : "pointer", marginBottom: 8,
                }}>
                {avancando ? "Confirmando..." : "✓ Confirmar entrega"}
              </button>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Contato do cliente (mascarado) */}
              {p?.telefone_cliente && (
                <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
                    Cliente{p?.nome_cliente ? `: ${p.nome_cliente}` : ""}
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a href={`tel:${p.telefone_cliente}`} style={{
                      flex: 1, padding: "9px", borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
                      color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700,
                      textDecoration: "none", textAlign: "center" as const,
                    }}>
                      {mascaraTelefone(p.telefone_cliente)}
                    </a>
                    <a
                      href={`https://wa.me/55${p.telefone_cliente.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Sou o entregador da Chegô Delivery com o seu pedido #${p?.codigo}. Estou a caminho!`)}`}
                      target="_blank" rel="noreferrer"
                      style={{
                        padding: "9px 14px", borderRadius: 10,
                        border: "1px solid rgba(37,211,102,0.4)", background: "rgba(37,211,102,0.12)",
                        color: "#25D366", fontSize: 12, fontWeight: 800,
                        textDecoration: "none", display: "flex", alignItems: "center", gap: 5,
                      }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.122 1.532 5.855L.057 23.885l6.174-1.618A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.9 9.9 0 01-5.031-1.374l-.361-.214-3.741.981.999-3.647-.235-.374A9.861 9.861 0 012.1 12C2.1 6.533 6.533 2.1 12 2.1c5.467 0 9.9 4.433 9.9 9.9 0 5.467-4.433 9.9-9.9 9.9z"/></svg>
                      WhatsApp
                    </a>
                  </div>
                </div>
              )}
              {/* Contato da loja */}
              {loja?.telefone && (
                <div style={{ display: "flex", gap: 8 }}>
                  <a href={`tel:${loja.telefone}`} style={{
                    flex: 1, padding: "9px", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.08)", background: "transparent",
                    color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700,
                    textDecoration: "none", textAlign: "center" as const,
                  }}>
                    Ligar para loja
                  </a>
                  <a
                    href={`https://wa.me/55${loja.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(`Sou o entregador do pedido #${p?.codigo}. Estou a caminho!`)}`}
                    target="_blank" rel="noreferrer"
                    style={{
                      flex: 1, padding: "9px", borderRadius: 10,
                      border: "1px solid rgba(37,211,102,0.2)", background: "transparent",
                      color: "#25D366", fontSize: 10, fontWeight: 700,
                      textDecoration: "none", textAlign: "center" as const,
                    }}>
                    WhatsApp loja
                  </a>
                </div>
              )}
            </div>
          </>
        )}
      </div>}
    </div>
  )
}

// ─── Card de aceitar corrida — estilo iFood ───────────────────────────────────
function CardCorrida({
  pedido, timer, distKm, onAceitar, onRecusar, carregando,
}: {
  pedido: any; timer: number; distKm: number | null
  onAceitar: () => void; onRecusar: () => void; carregando: boolean
}) {
  const loja        = pedido.loja
  const dashOffset  = CIRCUM * (1 - timer / 30)
  const timerColor  = timer <= 10 ? "#FF4444" : "#FF8C00"

  return (
    <>
      {/* Overlay escurece o mapa */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", zIndex: 40 }} />

      {/* Card */}
      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 60, zIndex: 50,
        background: "#1C1C1E", borderRadius: "24px 24px 0 0",
        boxShadow: "0 -8px 48px rgba(0,0,0,0.8)",
        animation: "slideUpCard 300ms ease-out",
        overflow: "hidden",
      }}>
        {/* Handle */}
        <div style={{ padding: "12px 0 0", display: "flex", justifyContent: "center" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Header: título + valor + timer */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 20px 14px" }}>
          <div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, marginBottom: 6, letterSpacing: 0.3 }}>
              Nova corrida!
            </p>
            <p style={{ color: "#FF8C00", fontWeight: 900, fontSize: 34, lineHeight: 1, letterSpacing: -0.5 }}>
              R$ {(pedido.taxa_entrega ?? 0).toFixed(2).replace(".", ",")}
            </p>
            {pedido.itens?.length > 0 && (
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 6 }}>
                {pedido.itens.length} iten{pedido.itens.length > 1 ? "s" : ""} · {pedido.forma_pagamento?.toUpperCase()}
              </p>
            )}
          </div>

          {/* Timer circular SVG */}
          <div style={{ position: "relative", width: 68, height: 68, flexShrink: 0 }}>
            <svg width="68" height="68" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#2C2C2E" strokeWidth="7" />
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke={timerColor} strokeWidth="7"
                strokeDasharray={CIRCUM}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
              />
            </svg>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{
                color: timerColor, fontWeight: 900, fontSize: 22,
                animation: timer <= 10 ? "timerPulse 0.7s ease-in-out infinite" : "none",
              }}>
                {timer}
              </span>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 20px 16px" }} />

        {/* Bloco COLETA */}
        <div style={{ padding: "0 20px 12px", display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
            background: "rgba(255,140,0,0.12)", border: "1.5px solid rgba(255,140,0,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Coleta</p>
            <p style={{ color: "white", fontSize: 15, fontWeight: 700 }}>{loja?.nome ?? "—"}</p>
            {loja?.endereco && <p style={{ color: "#888", fontSize: 12, marginTop: 2, lineHeight: 1.3 }}>{loja.endereco}</p>}
          </div>
        </div>

        {/* Seta intermediária */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px", marginBottom: 12 }}>
          <div style={{ width: 38, display: "flex", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
            </svg>
          </div>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
        </div>

        {/* Bloco ENTREGA */}
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
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Entrega</p>
            <p style={{ color: "white", fontSize: 15, fontWeight: 700 }}>{pedido.endereco_entrega}</p>
            <p style={{ color: "#888", fontSize: 12, marginTop: 2 }}>
              {distKm !== null
                ? `~${distKm.toFixed(1).replace(".", ",")} km de você`
                : "Calculando distância..."}
            </p>
          </div>
        </div>

        {/* Separator */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 20px 16px" }} />

        {/* Botões */}
        <div style={{ display: "flex", gap: 10, padding: "0 20px 20px" }}>
          <button
            onClick={onRecusar} disabled={carregando}
            style={{
              flex: 1, padding: "16px 0", borderRadius: 14,
              border: "1.5px solid rgba(255,255,255,0.22)",
              background: "transparent", color: "white",
              fontWeight: 800, fontSize: 15, cursor: "pointer",
            }}
          >
            Recusar
          </button>
          <button
            onClick={onAceitar} disabled={carregando}
            style={{
              flex: 2, padding: "16px 0", borderRadius: 14,
              border: "none", background: "#FF8C00", color: "white",
              fontWeight: 900, fontSize: 15, cursor: "pointer",
              opacity: carregando ? 0.7 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {carregando ? "Aceitando..." : "Aceitar corrida"}
          </button>
        </div>
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

function playNotificationSound() {
  try {
    const audio = new Audio("/splash.mp3")
    audio.volume = 1
    audio.play().catch(() => beep())
  } catch { beep() }
}

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
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
