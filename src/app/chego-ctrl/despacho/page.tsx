"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import dynamic from "next/dynamic"

const DEFAULT_LAT = -17.0549
const DEFAULT_LNG = -49.2295

type AbaDespacho = "pedidos" | "motoboys" | "sos"

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dL = (lat2 - lat1) * Math.PI / 180
  const dG = (lng2 - lng1) * Math.PI / 180
  const a  = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dG/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Mapa ao vivo ─────────────────────────────────────────────────────────────
const MapaDespacho = dynamic(() => Promise.resolve(MapaDespachoInner), { ssr: false })

function MapaDespachoInner({
  motoboys, pedidos, alertas,
  pedidoSelecionado,
}: {
  motoboys: any[]
  pedidos: any[]
  alertas: any[]
  pedidoSelecionado: any | null
}) {
  const mapRef     = useRef<any>(null)
  const divRef     = useRef<HTMLDivElement>(null)
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!document.getElementById("leaflet-css-despacho")) {
      const link = document.createElement("link")
      link.id = "leaflet-css-despacho"
      link.rel = "stylesheet"
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      document.head.appendChild(link)
    }
    import("leaflet").then(L => {
      if (mapRef.current || !divRef.current) return
      mapRef.current = L.map(divRef.current, { zoomControl: true }).setView([DEFAULT_LAT, DEFAULT_LNG], 14)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OSM", maxZoom: 19,
      }).addTo(mapRef.current)
    })
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    import("leaflet").then(L => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      // Motoboys
      motoboys.forEach(mb => {
        if (!mb.lat || !mb.lng) return
        const isSOS     = alertas.some(a => a.motoboy_id === mb.id && a.status === "pendente")
        const col       = isSOS ? "#ef4444" : mb.disponivel ? "#22c55e" : "#94a3b8"
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:32px;height:32px;border-radius:50%;
            background:${col};border:3px solid #1a1a1a;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 8px rgba(0,0,0,0.5);
            ${isSOS ? "animation:sosMarkerPulse 1s ease-in-out infinite;" : ""}
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/>
              <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
            </svg>
          </div>`,
          iconSize: [32, 32], iconAnchor: [16, 16],
        })
        const marker = L.marker([mb.lat, mb.lng], { icon })
          .addTo(mapRef.current)
          .bindPopup(`<b>${mb.nome}</b><br>${mb.disponivel ? "Online" : "Offline"}${isSOS ? "<br><span style='color:#ef4444;font-weight:700'>⚠ SOS ATIVO</span>" : ""}`)
        markersRef.current.push(marker)
      })

      // Pedidos prontos
      pedidos.forEach(p => {
        const lojaLat = p.loja?.lat; const lojaLng = p.loja?.lng
        if (!lojaLat || !lojaLng) return
        const sel = pedidoSelecionado?.id === p.id
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:28px;height:28px;border-radius:6px;
            background:${sel ? "#f97316" : "rgba(249,115,22,0.7)"};
            border:3px solid ${sel ? "white" : "#1a1a1a"};
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 8px rgba(0,0,0,0.5);
          ">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/>
            </svg>
          </div>`,
          iconSize: [28, 28], iconAnchor: [14, 14],
        })
        const marker = L.marker([lojaLat, lojaLng], { icon })
          .addTo(mapRef.current)
          .bindPopup(`<b>#${p.codigo}</b><br>${p.loja?.nome ?? "Loja"}<br>R$ ${p.taxa_entrega?.toFixed(2) ?? "—"}`)
        markersRef.current.push(marker)
      })
    })
  }, [motoboys, pedidos, alertas, pedidoSelecionado])

  return <div ref={divRef} style={{ width: "100%", height: "100%" }} />
}

// ─── Modal de despacho ────────────────────────────────────────────────────────
function ModalDespacho({
  pedido, motoboys, onClose, onDespachado,
}: {
  pedido: any
  motoboys: any[]
  onClose: () => void
  onDespachado: () => void
}) {
  const [despachando, setDespachando] = useState<string | null>(null)
  const [sucesso,     setSucesso]     = useState(false)

  const lojaLat = pedido.loja?.lat as number | null
  const lojaLng = pedido.loja?.lng as number | null

  const candidatos = motoboys
    .filter(m => m.disponivel && m.status === "ativo" && m.lat && m.lng)
    .map(m => ({
      ...m,
      dist: lojaLat && lojaLng ? haversineKm(m.lat, m.lng, lojaLat, lojaLng) : 999,
    }))
    .sort((a, b) => a.dist - b.dist)

  async function despachar(motoboy: any) {
    setDespachando(motoboy.id)
    try {
      const res = await fetch("/api/chego-ctrl/despachar-pedido", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: pedido.id, motoboy_id: motoboy.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(res.status === 409 ? "Pedido já foi despachado por outro admin." : (json.error ?? "Erro ao despachar."))
        onDespachado(); onClose(); return
      }
      // Push notification
      try {
        const itensCount = (pedido.itens ?? []).length
        const distStr = motoboy.dist < 999 ? `${motoboy.dist.toFixed(1)} km até a loja` : ""
        const linhas = [
          `📦 ${itensCount} ${itensCount === 1 ? "item" : "itens"} · R$ ${(pedido.taxa_entrega ?? 0).toFixed(2)}`,
          pedido.loja?.nome ? `🏪 ${pedido.loja.nome}` : "",
          pedido.endereco_entrega ? `📍 ${pedido.endereco_entrega}` : "",
          distStr ? `🛵 ${distStr}` : "",
        ].filter(Boolean).join("\n")
        await fetch("/api/push", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send-motoboy", motoboy_id: motoboy.id,
            title: `🛵 Nova corrida #${pedido.codigo}!`, body: linhas, url: "/motoboy",
          }),
        })
      } catch {}
      setSucesso(true)
      setTimeout(() => { onDespachado(); onClose() }, 1600)
    } finally {
      setDespachando(null)
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "white", borderRadius: 20, padding: "20px 16px", width: "calc(100% - 32px)", maxWidth: 420,
        maxHeight: "85vh", display: "flex", flexDirection: "column",
        boxShadow: "0 8px 48px rgba(0,0,0,0.8)", boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p style={{ color: "#0F172A", fontWeight: 900, fontSize: 15 }}>Despachar pedido #{pedido.codigo}</p>
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
              {pedido.loja?.nome} → R$ {(pedido.taxa_entrega ?? 0).toFixed(2)}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "#F9FAFB", border: "none", borderRadius: 8,
            color: "#64748B", width: 30, height: 30, cursor: "pointer", fontSize: 14,
          }}>✕</button>
        </div>

        {sucesso ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ color: "#22c55e", fontWeight: 900, fontSize: 18 }}>Despachado!</p>
            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>Motoboy notificado com sucesso.</p>
          </div>
        ) : candidatos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Nenhum motoboy disponível no momento.</p>
          </div>
        ) : (
          <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>
              Motoboys disponíveis
            </p>
            {candidatos.map(mb => (
              <div key={mb.id} style={{
                background: "#FAFAFA", border: "1px solid #F1F5F9",
                borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "1.5px solid rgba(34,197,94,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#0F172A", fontWeight: 700, fontSize: 14 }}>{mb.nome}</p>
                  <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>
                    {mb.dist < 999 ? `${mb.dist.toFixed(1)} km da loja` : "Distância desconhecida"}
                    {mb.veiculo && ` · ${mb.veiculo}`}
                  </p>
                </div>
                <button
                  onClick={() => despachar(mb)}
                  disabled={!!despachando}
                  style={{
                    padding: "8px 16px", borderRadius: 10, border: "none",
                    background: despachando === mb.id ? "rgba(249,115,22,0.4)" : "#f97316",
                    color: "#0F172A", fontWeight: 900, fontSize: 12, cursor: "pointer",
                  }}>
                  {despachando === mb.id ? "..." : "Despachar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AdminDespachoPage() {
  const [pedidos,  setPedidos]  = useState<any[]>([])
  const [motoboys, setMotoboys] = useState<any[]>([])
  const [alertas,  setAlertas]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [aba,      setAba]      = useState<AbaDespacho>("pedidos")
  const [pedidoSelecionado, setPedidoSelecionado] = useState<any | null>(null)
  const [resolvendoSOS,     setResolvendoSOS]     = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: ped }, { data: moto }, { data: sos }] = await Promise.all([
      supabase.from("pedidos")
        .select("*, loja:lojas(nome, endereco, lat, lng), itens:itens_pedido(*)")
        .eq("status", "pronto").is("motoboy_id", null)
        .order("criado_em", { ascending: true }),
      supabase.from("motoboys")
        .select("id, nome, disponivel, status, lat, lng, veiculo, last_seen")
        .order("nome"),
      supabase.from("alertas_sos")
        .select("*, motoboy:motoboys(nome, telefone)")
        .eq("status", "pendente")
        .order("criado_em", { ascending: false }),
    ])
    setPedidos(ped ?? [])
    setMotoboys(moto ?? [])
    setAlertas(sos ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 12_000)
    return () => clearInterval(iv)
  }, [load])

  // Realtime — filtra pedidos apenas no status relevante para o despacho
  useEffect(() => {
    const ch = supabase.channel("despacho-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos", filter: "status=eq.pronto" }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos", filter: "status=eq.pronto" }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos", filter: "status=eq.aguardando_aceite" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "motoboys" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "alertas_sos" }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  async function resolverSOS(id: string) {
    setResolvendoSOS(id)
    await supabase.from("alertas_sos").update({ status: "resolvido" }).eq("id", id)
    await load()
    setResolvendoSOS(null)
  }

  const mbOnline  = motoboys.filter(m => m.disponivel && m.status === "ativo")
  const mbOffline = motoboys.filter(m => !m.disponivel || m.status !== "ativo")

  const ABA_LABELS: { key: AbaDespacho; label: string; count: number; alert?: boolean }[] = [
    { key: "pedidos",  label: "Fila",      count: pedidos.length },
    { key: "motoboys", label: "Motoboys",  count: mbOnline.length },
    { key: "sos",      label: "SOS",       count: alertas.length, alert: alertas.length > 0 },
  ]

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#F1F5F9" }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ color: "#0F172A", fontWeight: 900, fontSize: 18 }}>Despacho ao Vivo</h1>
          <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 3 }}>
            {mbOnline.length} online · {pedidos.length} na fila
            {alertas.length > 0 && <span style={{ color: "#ef4444", fontWeight: 700 }}> · {alertas.length} SOS</span>}
          </p>
        </div>
        <button onClick={() => load()} style={{
          background: "#F9FAFB", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, color: "rgba(255,255,255,0.6)", padding: "8px 12px",
          fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Atualizar
        </button>
      </div>

      {/* CSS animação SOS */}
      <style>{`
        @keyframes sosMarkerPulse {
          0%,100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
        @keyframes sosPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          70% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
      `}</style>

      {/* Mapa */}
      <div style={{ flexShrink: 0, height: 300, background: "white", borderBottom: "1px solid #1a1a1a" }}>
        {!loading && (
          <MapaDespacho
            motoboys={motoboys}
            pedidos={pedidos}
            alertas={alertas}
            pedidoSelecionado={pedidoSelecionado}
          />
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, padding: "0", borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
        {ABA_LABELS.map(a => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            style={{
              flex: 1, padding: "12px 8px", background: "none",
              border: "none", borderBottom: aba === a.key ? "2px solid #f97316" : "2px solid transparent",
              color: aba === a.key ? "#f97316" : "#94a3b8",
              fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            {a.label}
            <span style={{
              background: a.alert ? "#ef4444" : aba === a.key ? "rgba(249,115,22,0.2)" : "#F8FAFC",
              color: a.alert ? "white" : aba === a.key ? "#f97316" : "#94a3b8",
              borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 900,
              animation: a.alert ? "sosPulse 1.5s infinite" : "none",
            }}>
              {a.count}
            </span>
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>

        {/* ── Aba: Fila de pedidos ── */}
        {aba === "pedidos" && (
          <>
            {loading ? (
              <p style={{ color: "#94a3b8" }}>Carregando...</p>
            ) : pedidos.length === 0 ? (
              <div style={{ textAlign: "center", paddingTop: 32 }}>
                <p style={{ color: "#CBD5E1", fontSize: 14 }}>Nenhum pedido na fila</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pedidos.map(p => (
                  <div
                    key={p.id}
                    onClick={() => setPedidoSelecionado((s: any) => s?.id === p.id ? null : p)}
                    style={{
                      background: pedidoSelecionado?.id === p.id ? "rgba(249,115,22,0.08)" : "#111",
                      border: `1px solid ${pedidoSelecionado?.id === p.id ? "rgba(249,115,22,0.4)" : "#F8FAFC"}`,
                      borderRadius: 14, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(249,115,22,0.15)", color: "#f97316", fontSize: 11, fontWeight: 800 }}>
                          #{p.codigo}
                        </span>
                        <span style={{ color: "#CBD5E1", fontSize: 11 }}>
                          {new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p style={{ color: "#f97316", fontWeight: 900, fontSize: 16 }}>R$ {(p.taxa_entrega ?? 0).toFixed(2)}</p>
                    </div>
                    <p style={{ color: "#0F172A", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{p.loja?.nome ?? "—"}</p>
                    <p style={{ color: "#94a3b8", fontSize: 12 }}>{p.endereco_entrega}</p>
                    {p.itens?.length > 0 && (
                      <p style={{ color: "#CBD5E1", fontSize: 11, marginTop: 4 }}>
                        {p.itens.map((i: any) => `${i.quantidade}× ${i.nome}`).join(" · ")}
                      </p>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setPedidoSelecionado(p) }}
                      style={{
                        marginTop: 10, width: "100%", padding: "10px", borderRadius: 10, border: "none",
                        background: "#f97316", color: "#0F172A", fontWeight: 900, fontSize: 13, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/>
                        <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
                      </svg>
                      Despachar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Aba: Motoboys ── */}
        {aba === "motoboys" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {mbOnline.length > 0 && (
              <>
                <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>
                  Online ({mbOnline.length})
                </p>
                {mbOnline.map(mb => (
                  <MotoboyStat key={mb.id} mb={mb} online={true} alertas={alertas} />
                ))}
              </>
            )}
            {mbOffline.length > 0 && (
              <>
                <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4, marginTop: 12 }}>
                  Offline ({mbOffline.length})
                </p>
                {mbOffline.map(mb => (
                  <MotoboyStat key={mb.id} mb={mb} online={false} alertas={alertas} />
                ))}
              </>
            )}
            {motoboys.length === 0 && !loading && (
              <p style={{ color: "#CBD5E1", fontSize: 14, textAlign: "center", paddingTop: 32 }}>Nenhum motoboy cadastrado</p>
            )}
          </div>
        )}

        {/* ── Aba: SOS ── */}
        {aba === "sos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alertas.length === 0 ? (
              <div style={{ textAlign: "center", paddingTop: 32 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(34,197,94,0.08)", border: "1.5px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <p style={{ color: "#CBD5E1", fontSize: 14 }}>Nenhum SOS ativo</p>
              </div>
            ) : (
              alertas.map(a => (
                <div key={a.id} style={{
                  background: "rgba(239,68,68,0.07)", border: "1.5px solid rgba(239,68,68,0.35)",
                  borderRadius: 14, padding: "14px 16px",
                  animation: "sosPulse 1.5s infinite",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(239,68,68,0.15)", border: "2px solid #ef4444", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
                        <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "#ef4444", fontWeight: 900, fontSize: 15 }}>SOS — {a.motoboy?.nome ?? "Motoboy"}</p>
                      <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>
                        {new Date(a.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        {a.lat && a.lng && ` · ${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}`}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {a.motoboy?.telefone && (
                      <a href={`tel:${a.motoboy.telefone}`} style={{
                        flex: 1, padding: "9px", borderRadius: 10,
                        border: "1px solid rgba(239,68,68,0.3)", background: "transparent",
                        color: "#ef4444", fontSize: 12, fontWeight: 700, textDecoration: "none", textAlign: "center" as const,
                      }}>
                        Ligar
                      </a>
                    )}
                    {a.lat && a.lng && (
                      <a
                        href={`https://www.google.com/maps?q=${a.lat},${a.lng}`}
                        target="_blank" rel="noreferrer"
                        style={{
                          flex: 1, padding: "9px", borderRadius: 10,
                          border: "1px solid rgba(239,68,68,0.3)", background: "transparent",
                          color: "#ef4444", fontSize: 12, fontWeight: 700, textDecoration: "none", textAlign: "center" as const,
                        }}>
                        Ver no mapa
                      </a>
                    )}
                    <button
                      onClick={() => resolverSOS(a.id)}
                      disabled={resolvendoSOS === a.id}
                      style={{
                        flex: 1, padding: "9px", borderRadius: 10, border: "none",
                        background: "rgba(239,68,68,0.2)", color: "#ef4444",
                        fontWeight: 900, fontSize: 12, cursor: "pointer",
                      }}>
                      {resolvendoSOS === a.id ? "..." : "Resolver"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal despacho */}
      {pedidoSelecionado && (
        <ModalDespacho
          pedido={pedidoSelecionado}
          motoboys={motoboys}
          onClose={() => setPedidoSelecionado(null)}
          onDespachado={() => { load(); setPedidoSelecionado(null) }}
        />
      )}
    </div>
  )
}

function MotoboyStat({ mb, online, alertas }: { mb: any; online: boolean; alertas: any[] }) {
  const isSOS = alertas.some(a => a.motoboy_id === mb.id && a.status === "pendente")
  const lastSeen = mb.last_seen ? new Date(mb.last_seen) : null
  const minsAgo  = lastSeen ? Math.round((Date.now() - lastSeen.getTime()) / 60000) : null

  return (
    <div style={{
      background: "white", border: `1px solid ${isSOS ? "rgba(239,68,68,0.4)" : "#F8FAFC"}`,
      borderRadius: 12, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
        background: isSOS ? "#ef4444" : online ? "#22c55e" : "#444",
        animation: isSOS ? "sosPulse 1.5s infinite" : "none",
      }} />
      <div style={{ flex: 1 }}>
        <p style={{ color: isSOS ? "#ef4444" : "white", fontWeight: 700, fontSize: 13 }}>
          {mb.nome}
          {isSOS && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 900 }}>SOS</span>}
        </p>
        <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>
          {mb.veiculo ?? "—"}
          {minsAgo !== null && ` · ${minsAgo < 1 ? "agora" : `${minsAgo}m atrás`}`}
        </p>
      </div>
      <div style={{
        padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800,
        background: online ? "rgba(34,197,94,0.12)" : "#F9FAFB",
        color: online ? "#22c55e" : "#CBD5E1",
      }}>
        {online ? "Online" : "Offline"}
      </div>
    </div>
  )
}
