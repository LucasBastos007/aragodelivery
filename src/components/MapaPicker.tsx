"use client"

import { useEffect, useRef, useState } from "react"

interface Props {
  lat: number
  lng: number
  onMove: (lat: number, lng: number) => void
}

export default function MapaPicker({ lat, lng, onMove }: Props) {
  const divRef    = useRef<HTMLDivElement>(null)
  const mapRef    = useRef<any>(null)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  const [localizando, setLocalizando] = useState(false)

  useEffect(() => {
    if (!divRef.current || mapRef.current) return

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link")
      link.id = "leaflet-css"
      link.rel = "stylesheet"
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      document.head.appendChild(link)
    }

    import("leaflet").then((L) => {
      if (!divRef.current || mapRef.current) return

      const map = L.map(divRef.current, { zoomControl: true })
        .setView([lat, lng], 17)

      const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
        crossOrigin: "",
      }).addTo(map)

      let tilesOk = false
      tileLayer.on("tileload", () => { tilesOk = true })
      setTimeout(() => {
        if (!tilesOk && mapRef.current) {
          tileLayer.setUrl("https://tile.openstreetmap.org/{z}/{x}/{y}.png")
        }
      }, 4000)

      setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize() }, 100)
      setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize() }, 500)

      // Emite coordenadas do centro sempre que o mapa para de mover
      map.on("moveend", () => {
        const { lat, lng } = map.getCenter()
        onMoveRef.current(lat, lng)
      })

      mapRef.current = map
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Sincroniza quando lat/lng muda externamente (GPS)
  useEffect(() => {
    if (!mapRef.current) return
    const center = mapRef.current.getCenter()
    if (Math.abs(center.lat - lat) > 0.00001 || Math.abs(center.lng - lng) > 0.00001) {
      mapRef.current.panTo([lat, lng])
    }
  }, [lat, lng])

  function usarMinhaLocalizacao() {
    if (!navigator.geolocation) return
    setLocalizando(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        mapRef.current?.setView([latitude, longitude], 17)
        onMoveRef.current(latitude, longitude)
        setLocalizando(false)
      },
      () => setLocalizando(false),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  return (
    <div style={{ position: "relative", width: "100%", height: 260, borderRadius: 14, overflow: "hidden" }}>
      {/* Mapa */}
      <div ref={divRef} style={{ width: "100%", height: "100%" }} />

      {/* Pino fixo no centro */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -100%)",
        pointerEvents: "none", zIndex: 1000,
      }}>
        <div style={{
          width: 22, height: 30,
          background: "#f97316",
          borderRadius: "50% 50% 50% 0",
          transform: "rotate(-45deg)",
          border: "3px solid white",
          boxShadow: "0 2px 12px rgba(0,0,0,0.45)",
        }} />
      </div>

      {/* Sombra do pino no chão */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, 2px)",
        width: 10, height: 5,
        background: "rgba(0,0,0,0.25)",
        borderRadius: "50%",
        pointerEvents: "none", zIndex: 1000,
      }} />

      {/* Botão GPS */}
      <button
        onClick={usarMinhaLocalizacao}
        disabled={localizando}
        style={{
          position: "absolute", bottom: 12, right: 12, zIndex: 1001,
          background: "white",
          border: "none",
          borderRadius: 8,
          width: 40, height: 40,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          cursor: localizando ? "wait" : "pointer",
        }}
        title="Usar minha localização"
      >
        {localizando ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
            </circle>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="2" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
        )}
      </button>
    </div>
  )
}
