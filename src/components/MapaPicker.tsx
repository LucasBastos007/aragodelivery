"use client"

import { useEffect, useRef } from "react"

interface Props {
  lat: number
  lng: number
  onMove: (lat: number, lng: number) => void
}

export default function MapaPicker({ lat, lng, onMove }: Props) {
  const divRef   = useRef<HTMLDivElement>(null)
  const mapRef   = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  useEffect(() => {
    if (!divRef.current || mapRef.current) return

    // Injeta CSS do Leaflet uma vez
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link")
      link.id = "leaflet-css"
      link.rel = "stylesheet"
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      document.head.appendChild(link)
    }

    import("leaflet").then((L) => {
      if (!divRef.current || mapRef.current) return

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      const map = L.map(divRef.current, { zoomControl: true })
        .setView([lat, lng], 17)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map)

      // Pin laranja customizado
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:22px;height:30px;
          background:#f97316;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:3px solid white;
          box-shadow:0 2px 12px rgba(0,0,0,0.45);
        "></div>`,
        iconSize:   [22, 30],
        iconAnchor: [11, 30],
      })

      const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map)

      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng()
        onMoveRef.current(lat, lng)
      })

      map.on("click", (e: any) => {
        marker.setLatLng(e.latlng)
        onMoveRef.current(e.latlng.lat, e.latlng.lng)
      })

      mapRef.current   = map
      markerRef.current = marker
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current   = null
      markerRef.current = null
    }
  }, [])

  // Sincroniza pin quando lat/lng muda externamente (GPS)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return
    import("leaflet").then((L) => {
      const ll = L.latLng(lat, lng)
      markerRef.current.setLatLng(ll)
      mapRef.current.panTo(ll)
    })
  }, [lat, lng])

  return (
    <div
      ref={divRef}
      style={{ width: "100%", height: 260, borderRadius: 14, overflow: "hidden", position: "relative" }}
    />
  )
}
