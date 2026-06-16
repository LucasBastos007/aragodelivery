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
  pix: "PIX", cartao: "CartÃÂ£o", dinheiro: "Dinheiro", maquininha: "Maquininha",
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
    const q   = encodeURIComponent(`${address}, AragoiÃÂ¢nia, GO, Brasil`)
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${key}`)
    const data = await res.json()
    if (data.status === "OK" && data.results[0]) {
      const loc = data.results[0].geometry.location
      return [loc.lat, loc.lng]
    }
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

const CIRCUM = 2 * Math.PI * 40 // circunferÃÂªncia do timer circular Ã¢ÂÂ 251.3

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Mapa fullscreen com rota (Google Maps) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
function MapaMotoboy({
  myLat, myLng,
  destinoLat, destinoLng,
  lojaLat, lojaLng,
  raioKm,
}: {
  myLat: number; myLng: number
  destinoLat?: number | null; destinoLng?: number | null
  lojaLat?: number | null; lojaLng?: number | null
  raioKm?: number | null
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-motoboy",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "",
    libraries: GMAPS_LIBS,
  })

  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const followRef      = useRef(true)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)

  // Pan quando posiÃÂ§ÃÂ£o muda
  useEffect(() => {
    if (!mapInstanceRef.current || !followRef.current) return
    mapInstanceRef.current.panTo({ lat: myLat, lng: myLng })
  }, [myLat, myLng])

  // Rota via Directions Service
  useEffect(() => {
    if (!isLoaded || !destinoLat || !destinoLng) { setDirections(null); return }
    const svc = new google.maps.DirectionsService()
    svc.route({
      origin:      { lat: myLat,      lng: myLng      },
      destination: { lat: destinoLat, lng: destinoLng },
      travelMode:  google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === "OK" && result) {
        setDirections(result)
        followRef.current = false
      }
    })
  }, [isLoaded, destinoLat, destinoLng, myLat, myLng])

  if (loadError) return (
    <div style={{ position: "absolute", inset: 0, background: "#1a1a2e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(249,115,22,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>Mapa indisponÃÂ­vel</p>
    </div>
  )

  if (!isLoaded) return (
    <div style={{ position: "absolute", inset: 0, background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Carregando mapa...</p>
    </div>
  )

  return (
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
      }}
      onLoad={m => { mapInstanceRef.current = m }}
      onDragStart={() => { followRef.current = false }}
    >
      {/* Marcador do motoboy Ã¢ÂÂ ponto azul estilo Google Maps */}
      <OverlayView position={{ lat: myLat, lng: myLng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
        <div style={{ transform: "translate(-50%,-50%)", position: "relative", width: 24, height: 24 }}>
          <style>{`@keyframes gpsPulse{0%{transform:translate(-50%,-50%) scale(1);opacity:.6}100%{transform:translate(-50%,-50%) scale(2.8);opacity:0}}`}</style>
          {/* Anel pulsante */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            width: 24, height: 24, borderRadius: "50%",
            background: "rgba(66,133,244,0.3)",
            animation: "gpsPulse 2s ease-out infinite",
            pointerEvents: "none",
          }} />
          {/* Ponto principal */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            width: 20, height: 20, borderRadius: "50%",
            background: "#4285F4", border: "3px solid white",
            boxShadow: "0 2px 8px rgba(66,133,244,0.7)",
          }} />
        </div>
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

      {/* Rota */}
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true,
            polylineOptions: { strokeColor: "#f97316", strokeWeight: 5, strokeOpacity: 0.85 },
          }}
        />
      )}

      {/* CÃÂ­rculo de raio */}
      {raioKm && raioKm > 0 && (
        <Circle
          center={{ lat: myLat, lng: myLng }}
          radius={raioKm * 1000}
          options={{
            strokeColor: "#f97316", strokeOpacity: 0.25, strokeWeight: 1.5,
            fillColor: "#f97316", fillOpacity: 0.05,
          }}
        />
      )}
    </GoogleMap>
  )
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ PÃÂ¡gina principal Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
export default function MotoboyPage() {
  const { sessao } = useAuth()
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null

  const [disponivel,     setDisponivel]     = useState(false)
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

  const [myLat,  setMyLat]  = useState(DEFAULT_LAT)
  const [myLng,  setMyLng]  = useState(DEFAULT_LNG)
  const [compartilhando, setCompartilhando] = useState(false)
  const watchIdRef = useRef<number | null>(null)

  const [destinoLat, setDestinoLat] = useState<number | null>(null)
  const [destinoLng, setDestinoLng] = useState<number | null>(null)
  const [lojaLat,    setLojaLat]    = useState<number | null>(null)
  const [lojaLng,    setLojaLng]    = useState<number | null>(null)

  // Bottom sheet
  const SHEET_PEEK = 220
  const SHEET_MID  = 380
  const SHEET_FULL = typeof window !== "undefined" ? Math.round(window.innerHeight * 0.82) : 660
  const [sheetH, setSheetH] = useState(SHEET_PEEK)
  const dragStartY  = useRef(0)
  const dragStartH  = useRef(0)
  const isDragging  = useRef(false)

  const prevProntosRef = useRef<Set<string>>(new Set())
  const isFirstLoad    = useRef(true)

  // Ã¢ÂÂÃ¢ÂÂ Oferta de corrida (TÃÂ³pico 02) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  const [pedidoOferta,    setPedidoOferta]    = useState<any | null>(null)
  const [timerOferta,     setTimerOferta]     = useState(30)
  const [distKmOferta,    setDistKmOferta]    = useState<number | null>(null)
  const [aceitandoCorrida, setAceitandoCorrida] = useState(false)
  const [toastMsg,        setToastMsg]        = useState<string | null>(null)
  const [corridaConcluida, setCorridaConcluida] = useState<any | null>(null)
  const [avancandoEtapa,   setAvancandoEtapa]   = useState(false)
  const [raioKm,           setRaioKm]           = useState<number>(5)
  const [salvandoRaio,     setSalvandoRaio]     = useState(false)
  const [fotoMotoboy,      setFotoMotoboy]      = useState<string | null>(null)

  // Ã¢ÂÂÃ¢ÂÂ Carrega motoboy Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  useEffect(() => {
    if (!motoboy_id) return
    supabase.from("motoboys").select("disponivel, lat, lng, raio_km, foto").eq("id", motoboy_id).single()
      .then(({ data }) => {
        if (data) {
          setDisponivel(data.disponivel)
          if (data.lat)     setMyLat(data.lat)
          if (data.lng)     setMyLng(data.lng)
          if (data.raio_km) setRaioKm(data.raio_km)
          if (data.foto)    setFotoMotoboy(data.foto)
        }
        setDispLoading(false)
      })
  }, [motoboy_id])

  // Ã¢ÂÂÃ¢ÂÂ Ganhos do dia Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  useEffect(() => {
    if (!motoboy_id) return
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    supabase.from("pedidos")
      .select("taxa_entrega")
      .eq("motoboy_id", motoboy_id)
      .eq("status", "entregue")
      .gte("criado_em", hoje.toISOString())
      .then(({ data }) => {
        setGanhosDia((data ?? []).reduce((s: number, p: any) => s + (p.taxa_entrega ?? 0), 0))
      })
  }, [motoboy_id, emAndamento.length])

  // Ã¢ÂÂÃ¢ÂÂ Injeta CSS de animaÃÂ§ÃÂ£o pulse (uma vez) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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

  // Ã¢ÂÂÃ¢ÂÂ Marca offline ao fechar o browser Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  useEffect(() => {
    if (!motoboy_id) return
    const handle = () => {
      const data = JSON.stringify({ motoboy_id })
      navigator.sendBeacon?.("/api/motoboy-offline", new Blob([data], { type: "application/json" }))
    }
    window.addEventListener("beforeunload", handle)
    return () => window.removeEventListener("beforeunload", handle)
  }, [motoboy_id])

  // Ã¢ÂÂÃ¢ÂÂ Raio de atuaÃÂ§ÃÂ£o Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  async function salvarRaio(km: number) {
    if (!motoboy_id) return
    setSalvandoRaio(true)
    setRaioKm(km)
    await supabase.from("motoboys").update({ raio_km: km }).eq("id", motoboy_id)
    setSalvandoRaio(false)
  }

  // Ã¢ÂÂÃ¢ÂÂ Toggle disponÃÂ­vel Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  async function toggleDisponivel() {
    if (!motoboy_id) return
    setTogglingDisp(true)
    const novo = !disponivel
    const now  = new Date().toISOString()
    // Tenta salvar last_seen junto; se a coluna nÃÂ£o existir, faz update separado
    const { error } = await supabase
      .from("motoboys")
      .update({ disponivel: novo, last_seen: now })
      .eq("id", motoboy_id)
    if (error) {
      // Coluna last_seen pode nÃÂ£o existir Ã¢ÂÂ salva sÃÂ³ disponivel
      await supabase.from("motoboys").update({ disponivel: novo }).eq("id", motoboy_id)
    }
    setDisponivel(novo)
    setTogglingDisp(false)
    if (novo) setSheetH(SHEET_PEEK)
  }

  // Ã¢ÂÂÃ¢ÂÂ Pedidos Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  async function loadPedidos() {
    if (!motoboy_id) return
    const [{ data: prontosData }, { data: andamentoData }] = await Promise.all([
      supabase.from("pedidos")
        .select("*, itens:itens_pedido(*), loja:lojas(nome, endereco, telefone, lat, lng)")
        .eq("status", "pronto").is("motoboy_id", null)
        .order("criado_em", { ascending: true }),
      supabase.from("pedidos")
        .select("*, itens:itens_pedido(*), loja:lojas(nome, endereco, telefone, lat, lng), nome_cliente, telefone_cliente")
        .in("status", ["indo_para_loja", "na_loja", "em_rota", "coletado"])
        .eq("motoboy_id", motoboy_id)
        .order("criado_em", { ascending: true }),
    ])

    const novosProntos = (prontosData as Pedido[]) ?? []
    const novosIds = new Set(novosProntos.map(p => p.id))
    if (!isFirstLoad.current) {
      const chegaram = [...novosIds].filter(id => !prevProntosRef.current.has(id))
      if (chegaram.length > 0) { beep(); setSheetH(SHEET_MID) }
    }
    prevProntosRef.current = novosIds
    isFirstLoad.current    = false
    setProntos(novosProntos)
    setEmAndamento((andamentoData as Pedido[]) ?? [])
    setPedidosLoading(false)
    // Auto-expande o sheet quando hÃÂ¡ pedidos
    if (novosProntos.length > 0 || (andamentoData ?? []).length > 0) {
      setSheetH(h => Math.max(h, SHEET_MID))
    }
  }

  useEffect(() => {
    if (!motoboy_id) return
    loadPedidos()
    const iv = setInterval(loadPedidos, 15_000)
    return () => clearInterval(iv)
  }, [motoboy_id])

  // Ã¢ÂÂÃ¢ÂÂ Supabase Realtime Ã¢ÂÂ escuta oferta de corrida Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  useEffect(() => {
    if (!motoboy_id || !disponivel) return

    // Verifica oferta pendente jÃÂ¡ existente ao entrar
    supabase.from("pedidos")
      .select("*, loja:lojas(nome, endereco, telefone, lat, lng), itens:itens_pedido(*)")
      .eq("motoboy_id", motoboy_id)
      .eq("status", "aguardando_aceite")
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPedidoOferta(data[0]); setTimerOferta(30); setDistKmOferta(null)
        }
      })

    const ch = supabase.channel(`oferta-${motoboy_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, payload => {
        const novo = payload.new as any
        if (novo?.motoboy_id === motoboy_id && novo?.status === "aguardando_aceite") {
          supabase.from("pedidos")
            .select("*, loja:lojas(nome, endereco, telefone, lat, lng), itens:itens_pedido(*)")
            .eq("id", novo.id).single()
            .then(({ data }) => {
              if (data) { beep(); setPedidoOferta(data); setTimerOferta(30); setDistKmOferta(null) }
            })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [motoboy_id, disponivel])

  // Ã¢ÂÂÃ¢ÂÂ Timer regressivo da oferta Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  useEffect(() => {
    if (!pedidoOferta) return
    if (timerOferta <= 0) {
      // Timeout Ã¢ÂÂ escalada para prÃÂ³ximo motoboy
      const ofertaId = pedidoOferta.id
      setPedidoOferta(null)
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

  // Ã¢ÂÂÃ¢ÂÂ Geocoding da entrega para calcular distÃÂ¢ncia Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  useEffect(() => {
    if (!pedidoOferta || !myLat || !myLng) return
    geocodeAddress(pedidoOferta.endereco_entrega ?? "").then(ll => {
      if (ll) setDistKmOferta(haversineKm(myLat, myLng, ll[0], ll[1]))
    })
  }, [pedidoOferta?.id])

  // Ã¢ÂÂÃ¢ÂÂ Coordenadas do destino e da loja Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  useEffect(() => {
    if (emAndamento.length === 0) {
      setDestinoLat(null); setDestinoLng(null)
      setLojaLat(null);    setLojaLng(null)
      return
    }
    const p = emAndamento[0]
    const loja = (p as any).loja

    // Destino do cliente: usa coords salvas no pedido, senÃÂ£o geocoda o endereÃÂ§o
    if ((p as any).lat_entrega && (p as any).lng_entrega) {
      setDestinoLat((p as any).lat_entrega)
      setDestinoLng((p as any).lng_entrega)
    } else if (p.endereco_entrega) {
      geocodeAddress(p.endereco_entrega).then(ll => {
        if (ll) { setDestinoLat(ll[0]); setDestinoLng(ll[1]) }
      })
    }

    // LocalizaÃÂ§ÃÂ£o da loja: usa lat/lng da tabela lojas, senÃÂ£o geocoda o endereÃÂ§o
    if (loja?.lat && loja?.lng) {
      setLojaLat(loja.lat)
      setLojaLng(loja.lng)
    } else if (loja?.endereco) {
      geocodeAddress(loja.endereco).then(ll => {
        if (ll) { setLojaLat(ll[0]); setLojaLng(ll[1]) }
      })
    }

    setSheetH(SHEET_MID)
  }, [emAndamento.length])

  // Ã¢ÂÂÃ¢ÂÂ GPS tracking Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  const iniciarRastreamento = useCallback(() => {
    if (!motoboy_id || !navigator.geolocation) return
    if (watchIdRef.current !== null) return
    setCompartilhando(true)
    watchIdRef.current = navigator.geolocation.watchPosition(
      async ({ coords }) => {
        setMyLat(coords.latitude); setMyLng(coords.longitude)
        await supabase.from("motoboys")
          .update({ lat: coords.latitude, lng: coords.longitude })
          .eq("id", motoboy_id)
      },
      () => setCompartilhando(false),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
  }, [motoboy_id])

  const pararRastreamento = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setCompartilhando(false)
    if (motoboy_id) supabase.from("motoboys").update({ lat: null, lng: null }).eq("id", motoboy_id)
  }, [motoboy_id])

  // Pede localizaÃÂ§ÃÂ£o imediatamente ao carregar Ã¢ÂÂ centraliza o mapa na posiÃÂ§ÃÂ£o real
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setMyLat(coords.latitude)
        setMyLng(coords.longitude)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  useEffect(() => {
    if (emAndamento.length > 0 && disponivel) iniciarRastreamento()
    else pararRastreamento()
  }, [emAndamento.length, disponivel, iniciarRastreamento, pararRastreamento])

  useEffect(() => () => pararRastreamento(), [pararRastreamento])

  // Ã¢ÂÂÃ¢ÂÂ Push Ã¢ÂÂ registrar SW + salvar subscription do motoboy Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  useEffect(() => {
    if (!motoboy_id) return
    async function registerPush() {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
        const reg = await navigator.serviceWorker.register("/sw.js")
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

  // Ã¢ÂÂÃ¢ÂÂ Push Ã¢ÂÂ enviar notificaÃÂ§ÃÂ£o ao cliente Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  async function enviarPush(pedido_id: string, status: string, codigo: string) {
    try {
      await fetch("/api/push", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", pedido_id, status, codigo }),
      })
    } catch {}
  }

  // Ã¢ÂÂÃ¢ÂÂ Aceitar / Entregar Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  async function aceitarEntrega(pedido: Pedido) {
    if (!motoboy_id) return
    setAtualizando(pedido.id)
    await supabase.from("pedidos").update({ status: "indo_para_loja", motoboy_id }).eq("id", pedido.id)
    await loadPedidos()
    setAtualizando(null)
  }

  async function marcarEntregue(pedido: Pedido) {
    setAtualizando(pedido.id)
    await supabase.from("pedidos").update({ status: "entregue" }).eq("id", pedido.id)
    enviarPush(pedido.id, "entregue", pedido.codigo)
    await loadPedidos()
    setAtualizando(null)
    setConfirmandoId(null); setCodigoInput(""); setErroConfirm("")
  }

  // Ã¢ÂÂÃ¢ÂÂ Aceitar corrida (atÃÂ´mico Ã¢ÂÂ protege contra dois motoboys) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  async function aceitarCorrida() {
    if (!pedidoOferta || !motoboy_id) return
    setAceitandoCorrida(true)
    const { data: updated, error } = await supabase
      .from("pedidos")
      .update({ status: "indo_para_loja", motoboy_id })
      .eq("id", pedidoOferta.id)
      .eq("status", "aguardando_aceite")
      .select("id")
    setAceitandoCorrida(false)
    if (error || !updated || updated.length === 0) {
      setToastMsg("Corrida nÃÂ£o disponÃÂ­vel Ã¢ÂÂ jÃÂ¡ foi aceita por outro motoboy")
      setPedidoOferta(null)
      setTimeout(() => setToastMsg(null), 3500)
      return
    }
    setPedidoOferta(null)
    await loadPedidos()
  }

  // Ã¢ÂÂÃ¢ÂÂ Recusar corrida Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  async function recusarCorrida() {
    if (!pedidoOferta || !motoboy_id) return
    const ofertaId = pedidoOferta.id
    setPedidoOferta(null)
    // Escalada: tenta prÃÂ³ximo motoboy (ou fila geral se atingiu limite)
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

  // Ã¢ÂÂÃ¢ÂÂ AvanÃÂ§ar etapa da corrida ativa (TÃÂ³pico 03) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  async function avancarEtapa(fotoUrl?: string) {
    // Se jÃÂ¡ estÃÂ¡ concluÃÂ­da, volta para o estado normal
    if (corridaConcluida) {
      setCorridaConcluida(null)
      setSheetH(SHEET_PEEK)
      await loadPedidos()
      return
    }
    const ativa = emAndamento.find(p => ["indo_para_loja","na_loja","em_rota","coletado"].includes(p.status))
    if (!ativa) return
    setAvancandoEtapa(true)
    const NEXT: Record<string, string> = {
      "indo_para_loja": "na_loja",
      "na_loja":        "em_rota",
      "em_rota":        "entregue",
      "coletado":       "entregue",
    }
    const nextStatus = NEXT[ativa.status]
    if (!nextStatus) { setAvancandoEtapa(false); return }

    const updates: Record<string, any> = { status: nextStatus }
    if (nextStatus === "entregue") {
      updates.ganho_motoboy = ativa.taxa_entrega ?? 0
      if (fotoUrl) updates.foto_entrega = fotoUrl
    }

    const { error } = await supabase.from("pedidos").update(updates).eq("id", ativa.id)
    if (error) await supabase.from("pedidos").update({ status: nextStatus }).eq("id", ativa.id)

    if (nextStatus === "entregue") {
      setCorridaConcluida(ativa)
      enviarPush(ativa.id, "entregue", ativa.codigo)
    }
    await loadPedidos()
    setAvancandoEtapa(false)
  }

  function confirmarCodigo(pedido: Pedido) {
    if (codigoInput.trim().toUpperCase() !== pedido.codigo.toUpperCase()) {
      setErroConfirm("CÃÂ³digo incorreto. PeÃÂ§a ao cliente para mostrar o cÃÂ³digo na tela.")
      return
    }
    marcarEntregue(pedido)
  }

  // Ã¢ÂÂÃ¢ÂÂ Bottom sheet drag Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  function onDragStart(y: number) { isDragging.current = true; dragStartY.current = y; dragStartH.current = sheetH }
  function onDragMove(y: number) {
    if (!isDragging.current) return
    setSheetH(Math.max(SHEET_PEEK, Math.min(SHEET_FULL, dragStartH.current + (dragStartY.current - y))))
  }
  function onDragEnd() {
    if (!isDragging.current) return
    isDragging.current = false
    const snaps = [SHEET_PEEK, SHEET_MID, SHEET_FULL]
    setSheetH(snaps.reduce((a, b) => Math.abs(b - sheetH) < Math.abs(a - sheetH) ? b : a))
  }

  const entregaAtiva = emAndamento[0] ?? null
  const corridaAtiva = emAndamento.find(p =>
    ["indo_para_loja","na_loja","em_rota","coletado"].includes(p.status)
  ) ?? null

  // Quando indo ÃÂ  loja, rota aponta para a loja; nas demais etapas, para o cliente
  const efetDestinoLat = corridaAtiva?.status === "indo_para_loja" ? lojaLat : destinoLat
  const efetDestinoLng = corridaAtiva?.status === "indo_para_loja" ? lojaLng : destinoLng

  return (
    <div style={{ position: "fixed", top: 52, left: 0, right: 0, bottom: 60, background: "#1a1a2e" }}>

      {/* Mapa */}
      <MapaMotoboy
        myLat={myLat} myLng={myLng}
        destinoLat={efetDestinoLat} destinoLng={efetDestinoLng}
        lojaLat={lojaLat} lojaLng={lojaLng}
        raioKm={raioKm}
      />

      {/* Ã¢ÂÂÃ¢ÂÂ Toast de erro Ã¢ÂÂÃ¢ÂÂ */}
      {/* ── Banner de status no mapa ── */}
      {corridaAtiva && !corridaConcluida && (
        <div style={{
          position: "absolute",
          bottom: sheetH + 12, left: 12, right: 12, zIndex: 30,
          borderRadius: 16, padding: "14px 18px",
          background: corridaAtiva.status === "indo_para_loja"
            ? "rgba(30,15,0,0.88)"
            : corridaAtiva.status === "na_loja"
            ? "rgba(0,30,10,0.88)"
            : "rgba(10,5,30,0.88)",
          border: "1.5px solid " + (corridaAtiva.status === "indo_para_loja" ? "rgba(249,115,22,0.6)" : corridaAtiva.status === "na_loja" ? "rgba(34,197,94,0.6)" : "rgba(99,102,241,0.6)"),
          backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
          animation: "slideUpCard 0.3s ease-out",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
            background: corridaAtiva.status === "indo_para_loja" ? "rgba(249,115,22,0.2)" : corridaAtiva.status === "na_loja" ? "rgba(34,197,94,0.2)" : "rgba(99,102,241,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}>
            {corridaAtiva.status === "indo_para_loja" ? "🏪" : corridaAtiva.status === "na_loja" ? "📦" : "🏠"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "white", fontWeight: 900, fontSize: 14, margin: 0 }}>
              {corridaAtiva.status === "indo_para_loja" && "Indo buscar o pedido"}
              {corridaAtiva.status === "na_loja" && "Na loja — pegue o pedido"}
              {corridaAtiva.status === "em_rota" && "Em rota de entrega"}
            </p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, margin: 0, marginTop: 2 }}>
              {corridaAtiva.status === "indo_para_loja" && "Rota até a loja exibida no mapa"}
              {corridaAtiva.status === "na_loja" && "Deslize para cima e clique no botão"}
              {corridaAtiva.status === "em_rota" && "Rota até o cliente exibida no mapa"}
            </p>
          </div>
          <div style={{ color: corridaAtiva.status === "indo_para_loja" ? "#f97316" : corridaAtiva.status === "na_loja" ? "#22c55e" : "#818cf8", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
            #{corridaAtiva.codigo}
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

      {/* Ã¢ÂÂÃ¢ÂÂ Card de oferta de corrida (TÃÂ³pico 02) Ã¢ÂÂÃ¢ÂÂ */}
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

      {/* Ã¢ÂÂÃ¢ÂÂ Ganhos do dia Ã¢ÂÂ badge central no topo Ã¢ÂÂÃ¢ÂÂ */}
      <div style={{
        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 20,
        background: "rgba(0,0,0,0.78)", backdropFilter: "blur(10px)",
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
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, fontWeight: 600 }}>hoje</span>
      </div>

      {/* Ã¢ÂÂÃ¢ÂÂ Toggle online/offline Ã¢ÂÂ canto superior direito Ã¢ÂÂÃ¢ÂÂ */}
      <div
        onClick={!dispLoading && !togglingDisp && !corridaAtiva && !corridaConcluida ? toggleDisponivel : undefined}
        style={{
          position: "absolute", top: 12, right: 12, zIndex: 20,
          background: disponivel ? "rgba(34,197,94,0.14)" : "rgba(0,0,0,0.72)",
          backdropFilter: "blur(10px)",
          border: "1.5px solid " + (disponivel ? "rgba(34,197,94,0.55)" : "rgba(255,255,255,0.12)"),
          borderRadius: 999, padding: "8px 16px 8px 12px",
          display: "flex", alignItems: "center", gap: 8,
          cursor: dispLoading || togglingDisp || corridaAtiva || corridaConcluida ? "not-allowed" : "pointer",
          opacity: togglingDisp || corridaAtiva || corridaConcluida ? 0.45 : 1,
          transition: "all 0.3s ease",
          userSelect: "none",
        }}
      >
        {/* ÃÂcone: raio (online) ou lua (offline) */}
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

      {/* Ã¢ÂÂÃ¢ÂÂ GPS badge Ã¢ÂÂ canto superior esquerdo Ã¢ÂÂÃ¢ÂÂ */}
      {compartilhando && (
        <div style={{
          position: "absolute", top: 12, left: 12, zIndex: 20,
          background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)",
          borderRadius: 999, padding: "6px 11px",
          border: "1px solid rgba(34,197,94,0.3)",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          <span style={{ color: "#22c55e", fontSize: 10, fontWeight: 700 }}>GPS</span>
        </div>
      )}

      {/* Ã¢ÂÂÃ¢ÂÂ Legenda rota (sÃÂ³ quando NÃÂO tem corrida ativa no painel) Ã¢ÂÂÃ¢ÂÂ */}
      {!corridaAtiva && !corridaConcluida && entregaAtiva && destinoLat && (
        <div style={{
          position: "absolute", bottom: sheetH + 12, left: 12, zIndex: 20,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
          borderRadius: 12, padding: "8px 14px",
          border: "1px solid rgba(249,115,22,0.3)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <div style={{ width: 16, height: 3, borderRadius: 2, background: "#f97316", borderTop: "2px dashed #f97316" }} />
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 700 }}>Rota atÃÂ© o cliente</span>
          </div>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>{entregaAtiva.endereco_entrega?.split(",")[0]}</p>
        </div>
      )}

      {/* Ã¢ÂÂÃ¢ÂÂ Painel de corrida ativa (TÃÂ³pico 03) Ã¢ÂÂÃ¢ÂÂ */}
      {(corridaAtiva || corridaConcluida) && (
        <CorridaAtivaPanel
          pedido={corridaAtiva}
          corridaConcluida={corridaConcluida}
          avancando={avancandoEtapa}
          onAvancar={avancarEtapa}
          onConcluir={avancarEtapa}
          motoboyId={motoboy_id ?? undefined}
          myLat={myLat}
          myLng={myLng}
        />
      )}

      {/* Ã¢ÂÂÃ¢ÂÂ Bottom Sheet (sÃÂ³ quando sem corrida ativa) Ã¢ÂÂÃ¢ÂÂ */}
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
        {/* Drag handle */}
        <div
          style={{ padding: "12px 0 8px", cursor: "grab", flexShrink: 0, touchAction: "none" }}
          onMouseDown={e => onDragStart(e.clientY)}
          onMouseMove={e => onDragMove(e.clientY)}
          onMouseUp={onDragEnd}
          onMouseLeave={onDragEnd}
          onTouchStart={e => onDragStart(e.touches[0].clientY)}
          onTouchMove={e => { e.preventDefault(); onDragMove(e.touches[0].clientY) }}
          onTouchEnd={onDragEnd}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto" }} />
        </div>

        {/* Header sheet Ã¢ÂÂ clicÃÂ¡vel para expandir/recolher */}
        <div
          onClick={() => setSheetH(h => h === SHEET_PEEK ? SHEET_MID : h === SHEET_MID ? SHEET_FULL : SHEET_PEEK)}
          style={{ padding: "0 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, cursor: "pointer", userSelect: "none" }}
        >
          <div>
            {!disponivel ? (
              <p style={{ color: "rgba(255,255,255,0.4)", fontWeight: 700, fontSize: 14 }}>VocÃÂª estÃÂ¡ offline</p>
            ) : pedidosLoading ? (
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Carregando...</p>
            ) : emAndamento.length > 0 ? (
              <p style={{ color: "#60a5fa", fontWeight: 800, fontSize: 14 }}>
                {emAndamento.length} entrega{emAndamento.length > 1 ? "s" : ""} em andamento
              </p>
            ) : prontos.length > 0 ? (
              <p style={{ color: "#f97316", fontWeight: 800, fontSize: 14 }}>
                {prontos.length} pedido{prontos.length > 1 ? "s" : ""} disponÃÂ­ve{prontos.length > 1 ? "is" : "l"}
              </p>
            ) : (
              <p style={{ color: "rgba(255,255,255,0.3)", fontWeight: 600, fontSize: 14 }}>Aguardando pedidos...</p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {disponivel && (prontos.length > 0 || emAndamento.length > 0) && (
              <span style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, color: "rgba(255,255,255,0.4)", fontSize: 11, padding: "4px 10px" }}>
                {sheetH <= SHEET_PEEK ? "Ver Ã¢ÂÂ²" : sheetH >= SHEET_FULL ? "Recolher Ã¢ÂÂ¼" : "Ã¢ÂÂ²"}
              </span>
            )}
          </div>
        </div>

        {/* ConteÃÂºdo scrollÃÂ¡vel */}
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
              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, marginBottom: 18 }}>
                Fique online para receber pedidos
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

              {/* Controle de raio de atuaÃÂ§ÃÂ£o */}
              <div style={{ marginTop: 16 }}>
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>
                  Raio de atuaÃÂ§ÃÂ£o
                  {salvandoRaio && <span style={{ color: "#f97316", marginLeft: 8 }}>salvando...</span>}
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  {[2, 3, 5, 8, 10, 15].map(r => (
                    <button key={r} onClick={() => salvarRaio(r)} style={{
                      flex: 1, padding: "9px 4px", borderRadius: 10, border: "none",
                      background: raioKm === r ? "#f97316" : "rgba(255,255,255,0.07)",
                      color: raioKm === r ? "white" : "rgba(255,255,255,0.4)",
                      fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>
                      {r}km
                    </button>
                  ))}
                </div>
                <p style={{ color: "rgba(255,255,255,0.18)", fontSize: 10, marginTop: 6 }}>
                  Pedidos dentro de {raioKm}km serÃÂ£o priorizados para vocÃÂª
                </p>
              </div>
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
              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Novos pedidos aparecerÃÂ£o aqui</p>
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
                <p style={{ color: "white", fontWeight: 900, fontSize: 18 }}>R$ {p.total.toFixed(2)}</p>
              </div>

              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f97316", flexShrink: 0, marginTop: 5 }} />
                    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.4 }}>
                      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>Coletar em </span>
                      <strong style={{ color: "white" }}>{(p as any).loja?.nome ?? "Ã¢ÂÂ"}</strong>
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
                )}                )}
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
                    DisponÃÂ­veis
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
                        DisponÃÂ­vel
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
                        #{p.codigo} ÃÂ· {new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p style={{ color: "white", fontWeight: 900, fontSize: 17 }}>R$ {p.total.toFixed(2)}</p>
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f97316", flexShrink: 0, marginTop: 4 }} />
                        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
                          {(p as any).loja?.nome ?? "Ã¢ÂÂ"}
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
                          {p.itens.map((i: any) => `${i.quantidade}x ${i.nome}`).join(" ÃÂ· ")}
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

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Modal SOS de emergÃÂªncia Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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
      await supabase.from("alertas_sos").insert({
        motoboy_id: motoboyId,
        pedido_id:  pedidoId || null,
        lat, lng,
        status:     "pendente",
        criado_em:  new Date().toISOString(),
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
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 24 }}>O administrador foi alertado com sua localizaÃÂ§ÃÂ£o atual.</p>
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
                <p style={{ color: "#ef4444", fontWeight: 900, fontSize: 17 }}>Acionar SOS de emergÃÂªncia?</p>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 }}>Seu admin serÃÂ¡ alertado com sua localizaÃÂ§ÃÂ£o</p>
              </div>
            </div>

            <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.5 }}>
                Pressione o botÃÂ£o abaixo para enviar um alerta de emergÃÂªncia com sua posiÃÂ§ÃÂ£o GPS atual. Use somente em situaÃÂ§ÃÂµes de risco real.
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

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Painel de corrida ativa Ã¢ÂÂ stepper 4 etapas (TÃÂ³pico 03) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
function CorridaAtivaPanel({
  pedido, corridaConcluida, avancando, onAvancar, onConcluir,
  motoboyId, myLat, myLng,
}: {
  pedido: any | null
  corridaConcluida: any | null
  avancando: boolean
  onAvancar: (fotoUrl?: string) => void
  onConcluir: () => void
  motoboyId?: string
  myLat?: number
  myLng?: number
}) {
  const [navDestino, setNavDestino] = useState<string | null>(null)
  const [fotoModal,  setFotoModal]  = useState(false)
  const [sosModal,   setSOSModal]   = useState(false)

  const p    = corridaConcluida ?? pedido
  const loja = p?.loja
  const STATUS_TO_ETAPA: Record<string, number> = {
    "indo_para_loja": 0, "na_loja": 1, "em_rota": 2, "coletado": 2, "entregue": 3,
  }
  const etapa  = corridaConcluida ? 3 : (STATUS_TO_ETAPA[pedido?.status ?? ""] ?? 0)
  const ETAPAS = ["Indo ÃÂ  loja", "Na loja", "Em rota", "Entregue!"]

  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      height: "45%", background: "#1C1C1E",
      borderRadius: "20px 20px 0 0",
      boxShadow: "0 -4px 32px rgba(0,0,0,0.7)",
      zIndex: 35, display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Modal de navegaÃÂ§ÃÂ£o */}
      {navDestino && <NavModal destino={navDestino} onClose={() => setNavDestino(null)} />}

      {/* Modal SOS */}
      {sosModal && motoboyId && (
        <SOSModal
          motoboyId={motoboyId}
          pedidoId={pedido?.id ?? ""}
          lat={myLat ?? DEFAULT_LAT}
          lng={myLng ?? DEFAULT_LNG}
          onClose={() => setSOSModal(false)}
        />
      )}

      {/* Handle + SOS */}
      <div style={{ padding: "10px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", flex: 1, marginRight: 8 }} />
        {!corridaConcluida && (
          <button
            onClick={() => setSOSModal(true)}
            style={{
              padding: "5px 12px", borderRadius: 999,
              border: "1.5px solid rgba(239,68,68,0.6)", background: "rgba(239,68,68,0.12)",
              color: "#ef4444", fontWeight: 900, fontSize: 11, cursor: "pointer",
              letterSpacing: 0.5, flexShrink: 0,
            }}>
            SOS
          </button>
        )}
      </div>

      {/* Stepper */}
      <div style={{ padding: "10px 16px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {ETAPAS.map((label, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", flex: i < 3 ? 1 : undefined }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: i < etapa ? "#22C55E" : i === etapa ? "#FF8C00" : "#3A3A3C",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.35s",
                }}>
                  {i < etapa ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <span style={{ color: "white", fontSize: 9, fontWeight: 900 }}>{i + 1}</span>
                  )}
                </div>
                <p style={{
                  color: i <= etapa ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.25)",
                  fontSize: 8, fontWeight: i === etapa ? 800 : 500,
                  textAlign: "center", maxWidth: 48, lineHeight: 1.2,
                }}>
                  {label}
                </p>
              </div>
              {i < 3 && (
                <div style={{
                  flex: 1, height: 2, marginTop: 12,
                  background: i < etapa ? "#22C55E" : "#3A3A3C",
                  transition: "background 0.35s",
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ConteÃÂºdo */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 20px 16px" }}>

        {/* ETAPA 4 Ã¢ÂÂ Entregue */}
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

        {/* ETAPA 1 Ã¢ÂÂ Indo ÃÂ  loja */}
        {etapa === 0 && (
          <>
            <div style={{ marginBottom: 12 }}>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Buscar pedido em</p>
              <p style={{ color: "white", fontWeight: 800, fontSize: 16 }}>{loja?.nome ?? "Ã¢ÂÂ"}</p>
              {loja?.endereco && <p style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{loja.endereco}</p>}
            </div>
            <button onClick={() => onAvancar()} disabled={avancando} style={{
              width: "100%", padding: "14px", borderRadius: 14, border: "none",
              background: "#FF8C00", color: "white", fontWeight: 900, fontSize: 14,
              cursor: "pointer", marginBottom: 8,
            }}>
              {avancando ? "Salvando..." : "Cheguei na loja"}
            </button>
            <button onClick={() => setNavDestino(loja?.endereco ?? loja?.nome ?? "")} style={{
              width: "100%", padding: "13px", borderRadius: 14,
              border: "1.5px solid rgba(255,255,255,0.18)", background: "transparent",
              color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>
              Navegar atÃÂ© a loja
            </button>
          </>
        )}

        {/* ETAPA 2 Ã¢ÂÂ Na loja */}
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
                      {item.quantidade}ÃÂ {item.nome}
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

        {/* ETAPA 3 Ã¢ÂÂ Em rota */}
        {etapa === 2 && (
          <>
            {/* Modal de foto comprovante */}
            {fotoModal && (
              <FotoModal
                pedidoId={p?.id ?? ""}
                onConfirmar={(url) => { setFotoModal(false); onAvancar(url) }}
                onPular={() => { setFotoModal(false); onAvancar() }}
              />
            )}
            <div style={{ marginBottom: 12 }}>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Entregar em</p>
              <p style={{ color: "white", fontWeight: 800, fontSize: 14, lineHeight: 1.4 }}>{p?.endereco_entrega}</p>
              {p?.observacao && (
                <p style={{ color: "#888", fontSize: 12, marginTop: 4, fontStyle: "italic" }}>"{p.observacao}"</p>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button onClick={() => setFotoModal(true)} disabled={avancando} style={{
                flex: 1, padding: "14px 10px", borderRadius: 14, border: "none",
                background: "#FF8C00", color: "white", fontWeight: 900, fontSize: 13,
                cursor: "pointer",
              }}>
                {avancando ? "Salvando..." : "Confirmar entrega"}
              </button>
              <button onClick={() => setNavDestino(p?.endereco_entrega ?? "")} style={{
                padding: "14px 16px", borderRadius: 14,
                border: "1.5px solid rgba(255,255,255,0.18)", background: "transparent",
                color: "rgba(255,255,255,0.7)", fontSize: 12, cursor: "pointer", fontWeight: 700,
              }}>
                Nav
              </button>
            </div>
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
                      href={`https://wa.me/55${p.telefone_cliente.replace(/\D/g, "")}?text=${encodeURIComponent(`OlÃÂ¡! Sou o entregador do pedido #${p?.codigo}. Estou a caminho!`)}`}
                      target="_blank" rel="noreferrer"
                      style={{
                        padding: "9px 14px", borderRadius: 10,
                        border: "1px solid rgba(37,211,102,0.3)", background: "transparent",
                        color: "#25D366", fontSize: 11, fontWeight: 700,
                        textDecoration: "none",
                      }}>
                      WA
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
      </div>
    </div>
  )
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Card de aceitar corrida Ã¢ÂÂ estilo iFood Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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

        {/* Header: tÃÂ­tulo + valor + timer */}
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
                {pedido.itens.length} iten{pedido.itens.length > 1 ? "s" : ""} ÃÂ· {pedido.forma_pagamento?.toUpperCase()}
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
            <p style={{ color: "white", fontSize: 15, fontWeight: 700 }}>{loja?.nome ?? "Ã¢ÂÂ"}</p>
            {loja?.endereco && <p style={{ color: "#888", fontSize: 12, marginTop: 2, lineHeight: 1.3 }}>{loja.endereco}</p>}
          </div>
        </div>

        {/* Seta intermediÃÂ¡ria */}
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
                ? `~${distKm.toFixed(1).replace(".", ",")} km de vocÃÂª`
                : "Calculando distÃÂ¢ncia..."}
            </p>
          </div>
        </div>

        {/* Separator */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 20px 16px" }} />

        {/* BotÃÂµes */}
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

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Modal de foto comprovante de entrega (TÃÂ³pico 07) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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
        <button onClick={onPular} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>Ã¢ÂÂ</button>
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
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, fontWeight: 700 }}>Toque para abrir cÃÂ¢mera</p>
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

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Modal de seleÃÂ§ÃÂ£o de app de navegaÃÂ§ÃÂ£o (TÃÂ³pico 04) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
function NavModal({ destino, onClose }: { destino: string; onClose: () => void }) {
  const enc = encodeURIComponent(destino)
  const APPS = [
    {
      label: "Google Maps",
      color: "#4285F4",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
      ),
      url: `https://www.google.com/maps/dir/?api=1&destination=${enc}`,
    },
    {
      label: "Waze",
      color: "#00C6FF",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
        </svg>
      ),
      url: `https://waze.com/ul?q=${enc}&navigate=yes`,
    },
    {
      label: "Apple Maps",
      color: "#555",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l19-9-9 19-2-8-8-2z"/>
        </svg>
      ),
      url: `https://maps.apple.com/?daddr=${enc}`,
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
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Navegar atÃÂ©</p>
        <p style={{ color: "white", fontWeight: 700, fontSize: 14, marginBottom: 20, lineHeight: 1.3 }}>{destino}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
