"use client"

// Mapa da operação (admin 2.0, 20/10/2026): motoboys online e lojas com pedido pronto.
// Cores do Chegô: livre = folha, indo pra loja = pequi, em entrega = azul, SOS = pimenta.
// Usado no Ao vivo e no Despacho.
import { useEffect, useRef } from "react"

export const CENTRO: [number, number] = [-16.8972, -49.4528]
export const COR_MB = { livre: "#1E8A4C", loja: "#F5B700", entrega: "#1F5FBF", sos: "#D7261E" }

export function km(a: number, b: number, c: number, d: number) {
  const R = 6371, dL = (c - a) * Math.PI / 180, dG = (d - b) * Math.PI / 180
  const x = Math.sin(dL / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dG / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export type MbMapa = { id: string; nome: string; lat: number | null; lng: number | null; disponivel: boolean; status: string }
export type PinoLoja = { id: string; lat: number | null; lng: number | null; titulo: string; sub?: string; destaque?: boolean }

export function situacaoMb(mb: MbMapa, sos: { motoboy_id: string }[], ativas: { motoboy_id: string; status: string }[]) {
  if (sos.some(a => a.motoboy_id === mb.id)) return { k: "sos" as const, t: "SOS" }
  const e = ativas.find(a => a.motoboy_id === mb.id)
  if (e && ["coletado", "em_rota", "em_rota_entrega"].includes(e.status)) return { k: "entrega" as const, t: "Em entrega" }
  if (e) return { k: "loja" as const, t: "Indo pra loja" }
  return { k: "livre" as const, t: "Livre" }
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))

export default function Mapa({ motoboys, sos, ativas, lojas, altura }: { motoboys: MbMapa[]; sos: { motoboy_id: string }[]; ativas: { motoboy_id: string; status: string }[]; lojas: PinoLoja[]; altura?: number }) {
  const div = useRef<HTMLDivElement>(null), mapa = useRef<any>(null), pinos = useRef<any[]>([]), centrou = useRef(false)

  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const l = document.createElement("link"); l.id = "leaflet-css"; l.rel = "stylesheet"; l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(l)
    }
    let vivo = true
    import("leaflet").then(L => {
      if (!vivo || mapa.current || !div.current) return
      mapa.current = L.map(div.current, { zoomControl: true, attributionControl: true }).setView(CENTRO, 14)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(mapa.current)
      desenhar(L)
    })
    return () => { vivo = false; if (mapa.current) { mapa.current.remove(); mapa.current = null } }
  }, [])

  useEffect(() => { if (mapa.current) import("leaflet").then(desenhar) }, [motoboys, sos, ativas, lojas])

  function desenhar(L: any) {
    if (!mapa.current) return
    pinos.current.forEach(p => p.remove()); pinos.current = []
    const online = motoboys.filter(m => m.lat && m.lng && m.disponivel && m.status === "ativo")
    for (const mb of online) {
      const s = situacaoMb(mb, sos, ativas), cor = COR_MB[s.k], nome = esc((mb.nome ?? "").split(" ")[0].slice(0, 9))
      const icon = L.divIcon({ className: "", iconSize: [90, 44], iconAnchor: [45, 15],
        html: `<div class="pino-mb${s.k === "sos" ? " sos" : ""}"><b style="background:${cor}">${nome}</b><small>${s.t}</small></div>` })
      pinos.current.push(L.marker([mb.lat, mb.lng], { icon }).addTo(mapa.current).bindPopup(`<b>${esc(mb.nome)}</b><br>${s.t}`))
    }
    for (const p of lojas) {
      if (!p.lat || !p.lng) continue
      const icon = L.divIcon({ className: "", iconSize: [30, 30], iconAnchor: [15, 15], html: `<div class="pino-loja${p.destaque ? " on" : ""}"></div>` })
      pinos.current.push(L.marker([p.lat, p.lng], { icon }).addTo(mapa.current).bindPopup(`<b>${esc(p.titulo)}</b>${p.sub ? "<br>" + esc(p.sub) : ""}`))
    }
    if (!centrou.current) {
      const perto = online.filter(m => km(m.lat!, m.lng!, CENTRO[0], CENTRO[1]) < 60)
      if (perto.length === 1) { mapa.current.setView([perto[0].lat, perto[0].lng], 15); centrou.current = true }
      else if (perto.length > 1) { mapa.current.fitBounds(L.latLngBounds(perto.map(m => [m.lat, m.lng])), { padding: [40, 40], maxZoom: 16 }); centrou.current = true }
    }
  }

  return (
    <div className="mapa-op" style={altura ? { height: altura } : undefined}>
      <div ref={div} style={{ position: "absolute", inset: 0 }} />
      <div className="mapa-leg">
        <span><i style={{ background: COR_MB.livre }} />Livre</span>
        <span><i style={{ background: COR_MB.loja }} />Indo pra loja</span>
        <span><i style={{ background: COR_MB.entrega }} />Em entrega</span>
        <span><i className="q" />Pedido pronto</span>
      </div>
    </div>
  )
}
