"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import type { Pedido, StatusPedido } from "@/types"
import { GoogleMap, useJsApiLoader, OverlayView, DirectionsRenderer } from "@react-google-maps/api"

const GMAPS_LIBS_TRACK: ("geometry" | "places")[] = []

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

// ── Mapa rastreamento — Google Maps com localização em tempo real ──────────────
function MapaRastreamento({
  motoboyId, initialLat, initialLng, enderecoEntrega,
}: {
  motoboyId: string
  initialLat: number; initialLng: number
  enderecoEntrega: string
}) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-tracking",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!,
    libraries: GMAPS_LIBS_TRACK,
  })

  const [motoLat, setMotoLat] = useState(initialLat)
  const [motoLng, setMotoLng] = useState(initialLng)
  const [destLat, setDestLat] = useState<number | null>(null)
  const [destLng, setDestLng] = useState<number | null>(null)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)

  // Rastreamento em tempo real: polling a cada 4s + realtime como reforço
  useEffect(() => {
    async function fetchPos() {
      const { data } = await supabase.from("motoboys").select("lat,lng").eq("id", motoboyId).single()
      if (data?.lat && data?.lng) { setMotoLat(Number(data.lat)); setMotoLng(Number(data.lng)) }
    }
    fetchPos()
    const iv = setInterval(fetchPos, 4000)
    const ch = supabase.channel(`track-motoboy-${motoboyId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "motoboys",
        filter: `id=eq.${motoboyId}`,
      }, payload => {
        const n = payload.new as any
        if (n.lat && n.lng) { setMotoLat(n.lat); setMotoLng(n.lng) }
      })
      .subscribe()
    return () => { clearInterval(iv); supabase.removeChannel(ch) }
  }, [motoboyId])

  // Centraliza só se o motoboy sair da área visível do mapa
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const bounds = map.getBounds()
    if (!bounds || !bounds.contains({ lat: motoLat, lng: motoLng })) {
      map.panTo({ lat: motoLat, lng: motoLng })
    }
  }, [motoLat, motoLng])

  // Geocoding do destino via Google Geocoder
  useEffect(() => {
    if (!isLoaded || !enderecoEntrega) return
    const geocoder = new google.maps.Geocoder()
    geocoder.geocode({ address: `${enderecoEntrega}, Aragoiânia, GO, Brasil` }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const loc = results[0].geometry.location
        setDestLat(loc.lat()); setDestLng(loc.lng())
      }
    })
  }, [isLoaded, enderecoEntrega])

  // Rota via Directions Service
  useEffect(() => {
    if (!isLoaded || !destLat || !destLng) return
    const svc = new google.maps.DirectionsService()
    svc.route({
      origin: { lat: motoLat, lng: motoLng },
      destination: { lat: destLat, lng: destLng },
      travelMode: google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === "OK" && result) setDirections(result)
    })
  }, [isLoaded, motoLat, motoLng, destLat, destLng])

  if (!isLoaded) return (
    <div style={{ width: "100%", height: 260, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#9CA3AF", fontSize: 13 }}>Carregando mapa...</p>
    </div>
  )

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: 260 }}
      center={{ lat: motoLat, lng: motoLng }}
      zoom={15}
      options={{
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: "cooperative",
        clickableIcons: false,
      }}
      onLoad={m => { mapRef.current = m }}
    >
      {/* Motoboy — ponto laranja pulsante */}
      <OverlayView position={{ lat: motoLat, lng: motoLng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
        <div style={{ transform: "translate(-50%,-50%)", position: "relative", width: 24, height: 24 }}>
          <style>{`@keyframes trackPulse{0%{transform:translate(-50%,-50%) scale(1);opacity:.5}100%{transform:translate(-50%,-50%) scale(2.8);opacity:0}}`}</style>
          <div style={{ position: "absolute", top: "50%", left: "50%", width: 24, height: 24, borderRadius: "50%", background: "rgba(249,115,22,0.3)", animation: "trackPulse 2s ease-out infinite", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 20, height: 20, borderRadius: "50%", background: "#f97316", border: "3px solid white", boxShadow: "0 2px 8px rgba(249,115,22,0.6)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
              <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
            </svg>
          </div>
        </div>
      </OverlayView>

      {/* Destino — pin verde */}
      {destLat && destLng && (
        <OverlayView position={{ lat: destLat, lng: destLng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <div style={{ transform: "translate(-50%,-50%)", width: 36, height: 36, borderRadius: "50%", background: "#22c55e", border: "3px solid white", boxShadow: "0 2px 10px rgba(34,197,94,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
            preserveViewport: true,
            polylineOptions: { strokeColor: "#f97316", strokeWeight: 4, strokeOpacity: 0.8 },
          }}
        />
      )}
    </GoogleMap>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

const ETAPAS: { status: StatusPedido; label: string; descricao: string }[] = [
  { status: "pendente",   label: "Pedido recebido",    descricao: "Seu pedido chegou! A loja está sendo notificada." },
  { status: "aceito",     label: "Confirmado pela loja", descricao: "A loja confirmou seu pedido e vai começar a preparar em breve." },
  { status: "preparando", label: "Preparando",          descricao: "A cozinha está preparando seu pedido com todo cuidado." },
  { status: "pronto",     label: "Pronto para entrega", descricao: "Pedido pronto! Estamos aguardando o entregador retirar." },
  { status: "coletado",   label: "Saiu para entrega",   descricao: "O motoboy pegou seu pedido e está a caminho da sua casa!" },
  { status: "entregue",   label: "Entregue!",           descricao: "Pedido entregue com sucesso. Bom apetite!" },
]

function EtapaIcon({ index, size = 56 }: { index: number; size?: number }) {
  if (index === 4) {
    return (
      <img
        src="/moto-entrega.svg"
        alt="Motoboy em rota"
        width={size * 1.8}
        height={size}
        style={{ objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(220,38,38,0.3))" }}
      />
    )
  }
  if (index === 5) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
        <circle cx="28" cy="28" r="26" fill="#dcfce7" stroke="#22c55e" strokeWidth="2"/>
        <path d="M 14 28 L 24 38 L 42 20" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  const icons = [
    // 0 pendente — documento
    <svg key={0} width={size} height={size} viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="26" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="2"/>
      <rect x="16" y="14" width="24" height="28" rx="3" fill="white" stroke="#D1D5DB" strokeWidth="1.5"/>
      <line x1="21" y1="21" x2="35" y2="21" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="21" y1="26" x2="35" y2="26" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="21" y1="31" x2="29" y2="31" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>,
    // 1 aceito — loja com check
    <svg key={1} width={size} height={size} viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="26" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2"/>
      <path d="M 16 38 L 16 26 L 28 18 L 40 26 L 40 38 Z" fill="white" stroke="#3b82f6" strokeWidth="1.5"/>
      <path d="M 23 38 L 23 31 L 33 31 L 33 38" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5"/>
      <path d="M 20 29 L 26 35 L 36 25" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>,
    // 2 preparando — chama/fogo
    <svg key={2} width={size} height={size} viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="26" fill="#fef9c3" stroke="#eab308" strokeWidth="2"/>
      <path d="M 28 38 Q 20 32 22 24 Q 25 26 26 29 Q 28 22 24 16 Q 32 20 34 28 Q 35 26 34 22 Q 40 28 38 35 Q 36 38 28 38 Z" fill="#f97316" stroke="#ea580c" strokeWidth="1"/>
      <path d="M 28 36 Q 24 32 25 27 Q 27 28 27 30 Q 29 26 28 23 Q 32 26 32 30 Q 33 28 32 26 Q 36 30 34 34 Q 32 36 28 36 Z" fill="#fbbf24"/>
    </svg>,
    // 3 pronto — caixa
    <svg key={3} width={size} height={size} viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="26" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="2"/>
      <rect x="16" y="26" width="24" height="16" rx="2" fill="#8b5cf6"/>
      <path d="M 14 22 L 42 22 L 40 26 L 16 26 Z" fill="#7c3aed"/>
      <line x1="28" y1="22" x2="28" y2="16" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/>
      <rect x="24" y="14" width="8" height="6" rx="1" fill="#7c3aed"/>
      <line x1="24" y1="31" x2="32" y2="31" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>,
  ]
  return icons[index] ?? null
}

const STATUS_INDEX: Partial<Record<StatusPedido, number>> = {
  pendente: 0, aceito: 1, preparando: 2, pronto: 3,
  aguardando_aceite: 3, indo_para_loja: 4, na_loja: 4, em_rota: 4,
  coletado: 4, entregue: 5,
}

const PAGAMENTO_LABEL: Record<string, string> = {
  pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha",
}

function StarRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  const active = hover || value
  return (
    <div>
      <p style={{ color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{label}</p>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onTouchStart={() => setHover(n)}
            onTouchEnd={() => { onChange(n); setHover(0) }}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 2,
              fontSize: 36, lineHeight: 1,
              color: n <= active ? "#f59e0b" : "#D1D5DB",
              transition: "color 0.1s, transform 0.1s",
              transform: hover === n ? "scale(1.25)" : "scale(1)",
            }}>
            ★
          </button>
        ))}
      </div>
    </div>
  )
}

function CartaoProcessando({ pedidoId, onConfirmado }: { pedidoId: string; onConfirmado: () => void }) {
  const [verificando, setVerificando] = useState(false)
  const [erro, setErro] = useState("")

  const [cancelado, setCancelado] = useState(false)

  async function verificar() {
    setVerificando(true)
    setErro("")
    try {
      const r = await fetch("/api/pagamento/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: pedidoId }),
      }).then(r => r.json())
      if (r.confirmado) { onConfirmado() }
      else if (r.sem_pagamento) { setCancelado(true) }
      else if (r.status === "cancelado") { setErro("Pagamento recusado pela operadora. Tente com outro cartão.") }
      else { setErro("Pagamento ainda em análise. Aguarde alguns segundos e tente novamente.") }
    } catch { setErro("Erro ao verificar. Tente novamente.") }
    finally { setVerificando(false) }
  }

  if (cancelado) {
    return (
      <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 16, padding: "20px 16px", marginBottom: 16, textAlign: "center" }}>
        <p style={{ fontSize: 28, marginBottom: 8 }}>❌</p>
        <p style={{ color: "#DC2626", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Pagamento não foi processado</p>
        <p style={{ color: "#6B7280", fontSize: 12, marginBottom: 16 }}>Este pedido foi cancelado. Por favor, faça um novo pedido e insira os dados do cartão novamente.</p>
        <a href="/" onClick={() => localStorage.removeItem("arago_pedido_ativo")} style={{ display: "inline-block", background: "#DC2626", color: "#fff", borderRadius: 12, padding: "10px 24px", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
          Fazer novo pedido
        </a>
      </div>
    )
  }

  return (
    <div style={{ background: "#fff", border: "1.5px solid #f97316", borderRadius: 16, padding: "20px 16px", marginBottom: 16, textAlign: "center" }}>
      <p style={{ fontSize: 28, marginBottom: 8 }}>💳</p>
      <p style={{ color: "#111827", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Processando pagamento no cartão</p>
      <p style={{ color: "#6B7280", fontSize: 12, marginBottom: 16 }}>Seu pagamento está sendo analisado. Isso costuma levar alguns segundos.</p>
      {erro && <p style={{ color: "#DC2626", fontSize: 12, marginBottom: 12 }}>{erro}</p>}
      <button
        onClick={verificar}
        disabled={verificando}
        style={{ background: verificando ? "#9CA3AF" : "#f97316", color: "#fff", border: "none", borderRadius: 12, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: verificando ? "not-allowed" : "pointer" }}
      >
        {verificando ? "Verificando..." : "Verificar pagamento"}
      </button>
    </div>
  )
}

function ChatMotoboy({ pedidoId }: { pedidoId: string }) {
  const [msgs, setMsgs]     = useState<{ id: string; remetente: string; texto: string; criado_em: string }[]>([])
  const [texto, setTexto]   = useState("")
  const [enviando, setEnv]  = useState(false)
  const bottomRef           = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from("pedido_chat" as any).select("*").eq("pedido_id", pedidoId).order("criado_em")
      .then(({ data }) => { if (data) setMsgs(data as any) })

    const ch = supabase.channel(`chat-${pedidoId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedido_chat" },
        payload => { if ((payload.new as any).pedido_id === pedidoId) setMsgs(p => [...p, payload.new as any]) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [pedidoId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs])

  async function enviar() {
    if (!texto.trim() || enviando) return
    setEnv(true)
    await supabase.from("pedido_chat" as any).insert({ pedido_id: pedidoId, remetente: "cliente", texto: texto.trim() })
    setTexto("")
    setEnv(false)
  }

  return (
    <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
        <p style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>Chat com o entregador</p>
      </div>
      <div style={{ padding: "12px 16px", minHeight: 120, maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {msgs.length === 0 && (
          <p style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", margin: "auto" }}>
            Nenhuma mensagem ainda. Fale com o entregador!
          </p>
        )}
        {msgs.map(m => (
          <div key={m.id} style={{
            alignSelf: m.remetente === "cliente" ? "flex-end" : "flex-start",
            background: m.remetente === "cliente" ? "#DC2626" : "#F3F4F6",
            color: m.remetente === "cliente" ? "white" : "#111827",
            padding: "8px 12px", borderRadius: m.remetente === "cliente" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
            fontSize: 13, maxWidth: "78%",
          }}>
            {m.texto}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: "10px 12px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 8 }}>
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => e.key === "Enter" && enviar()}
          placeholder="Mensagem..."
          style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, outline: "none", color: "#111827", background: "#F9FAFB" }}
        />
        <button onClick={enviar} disabled={!texto.trim() || enviando} style={{
          padding: "9px 16px", borderRadius: 10, border: "none",
          background: texto.trim() ? "#DC2626" : "#F3F4F6",
          color: texto.trim() ? "white" : "#9CA3AF",
          fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}>
          Enviar
        </button>
      </div>
    </div>
  )
}

export default function AcompanhamentoPedido() {
  const { codigo } = useParams<{ codigo: string }>()
  const [pedido,   setPedido]   = useState<Pedido | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [etapaExpandida, setEtapaExpandida] = useState<number | null>(null)
  const [modalAvaliacao, setModalAvaliacao] = useState(false)
  const [jaAvaliou,      setJaAvaliou]      = useState(false)
  const [notaLoja,       setNotaLoja]       = useState(0)
  const [notaMotoboy,    setNotaMotoboy]    = useState(0)
  const [comentario,     setComentario]     = useState("")
  const [enviandoAval,   setEnviandoAval]   = useState(false)
  const [avaliacaoOk,    setAvaliacaoOk]    = useState(false)

  const prevStatusRef   = useRef<string | null>(null)
  const audioUnlockedRef = useRef(false)
  const pushDoneRef = useState(false)

  const [pixCopiado,        setPixCopiado]         = useState(false)
  const [clienteToken,      setClienteToken]      = useState<string | null>(null)
  const [cancelando,        setCancelando]         = useState(false)
  const [cancelModal,       setCancelModal]        = useState(false)
  const [reembolsoModal,    setReembolsoModal]     = useState(false)
  const [reembolsoMotivo,   setReembolsoMotivo]    = useState("")
  const [reembolsoDesc,     setReembolsoDesc]      = useState("")
  const [reembolsoFoto,     setReembolsoFoto]      = useState<File | null>(null)
  const [envReembolso,      setEnvReembolso]       = useState(false)
  const [reembolsoOk,       setReembolsoOk]        = useState(false)
  const [reembolsoStatus,   setReembolsoStatus]    = useState<string | null>(null)
  const [entregasAntes,     setEntregasAntes]      = useState<number | null>(null)

  async function load() {
    const { data: rows, error } = await supabase
      .from("pedidos")
      .select("*, itens:itens_pedido(*), loja:lojas(nome, telefone), motoboy:motoboys(*)")
      .eq("codigo", codigo.toUpperCase())
      .order("criado_em", { ascending: false })
      .limit(1)

    const data = (error ? null : rows?.[0]) ?? null
    if (!data) {
      const { data: rows2 } = await supabase
        .from("pedidos")
        .select("*, itens:itens_pedido(*), loja:lojas(nome, telefone)")
        .eq("codigo", codigo.toUpperCase())
        .order("criado_em", { ascending: false })
        .limit(1)
      const d2 = rows2?.[0] ?? null
      if (!d2) { setNotFound(true); setLoading(false); return }
      const newStatus = (d2 as any).status
      if (prevStatusRef.current !== "entregue" && newStatus === "entregue") {
        try { const a = new Audio("/splash.mp3"); a.volume = 0.85; a.play().catch(() => {}) } catch {}
      }
      prevStatusRef.current = newStatus
      setPedido(d2 as Pedido); setLoading(false); return
    }
    const newStatus = (data as any).status
    if (prevStatusRef.current !== null && prevStatusRef.current !== "entregue" && newStatus === "entregue") {
      try { const a = new Audio("/splash.mp3"); a.volume = 0.85; a.play().catch(() => {}) } catch {}
    }
    if (newStatus === "cancelado") localStorage.removeItem("arago_pedido_ativo")
    prevStatusRef.current = newStatus
    setPedido(data as Pedido)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`pedido-tracking-${codigo}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos" },
        payload => { if ((payload.new as any).codigo?.toUpperCase() === codigo.toUpperCase()) load() })
      .subscribe()
    const iv = setInterval(load, 5_000)
    return () => { clearInterval(iv); supabase.removeChannel(channel) }
  }, [codigo])

  useEffect(() => {
    if (pedido?.status === "entregue" && !jaAvaliou && !avaliacaoOk) {
      supabase.from("avaliacoes").select("id").eq("pedido_id", pedido.id).limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) { setJaAvaliou(true); return }
          setTimeout(() => setModalAvaliacao(true), 800)
        })
    }
  }, [pedido?.status])

  useEffect(() => {
    if (!pedido || pushDoneRef[0]) return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return
    async function subscribePush() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js")
        const existing = await reg.pushManager.getSubscription()
        const sub = existing ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey!) })
        await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "subscribe", pedido_id: pedido!.id, subscription: sub }) })
        pushDoneRef[0] = true
      } catch {}
    }
    if (Notification.permission === "granted") subscribePush()
    else if (Notification.permission !== "denied") Notification.requestPermission().then(p => { if (p === "granted") subscribePush() })
  }, [pedido?.id])

  // Lê token do cliente do localStorage
  useEffect(() => {
    const t = localStorage.getItem(`arago_tkn_${codigo.toUpperCase()}`)
    setClienteToken(t)
  }, [codigo])

  // Conta entregas antes da sua (quando motoboy tem pedidos ativos antes)
  useEffect(() => {
    if (!pedido?.motoboy_id) { setEntregasAntes(null); return }
    const STATUS_ATIVO = ["indo_para_loja","na_loja","em_rota","coletado","aguardando_aceite"]
    if (!STATUS_ATIVO.includes(pedido.status)) { setEntregasAntes(null); return }
    supabase.from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("motoboy_id", pedido.motoboy_id)
      .neq("id", pedido.id)
      .in("status", STATUS_ATIVO)
      .then(({ count }) => setEntregasAntes(count ?? 0))
  }, [pedido?.motoboy_id, pedido?.status, pedido?.id])

  // Carrega status de reembolso se houver
  useEffect(() => {
    if (!pedido?.id || pedido.status !== "entregue") return
    supabase.from("reembolsos" as any).select("status").eq("pedido_id", pedido.id).order("solicitado_em", { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setReembolsoStatus((data[0] as any).status) })
  }, [pedido?.id, pedido?.status])

  // Desbloqueia áudio no primeiro toque (obrigatório no iOS/Safari)
  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current) return
      audioUnlockedRef.current = true
      // Cria e resume um AudioContext silencioso para liberar o contexto de áudio
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        ctx.resume().then(() => ctx.close())
      } catch {}
    }
    window.addEventListener("pointerdown", unlock, { once: true })
    return () => window.removeEventListener("pointerdown", unlock)
  }, [])

  // Ouve mensagem do SW para tocar som de entregue mesmo com a aba em foco
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "push-received" && (e.data?.isEntregue || e.data?.isCheguei)) {
        try { const a = new Audio("/splash.mp3"); a.volume = 0.9; a.play().catch(() => {}) } catch {}
      }
    }
    navigator.serviceWorker.addEventListener("message", onMsg)
    return () => navigator.serviceWorker.removeEventListener("message", onMsg)
  }, [])

  async function cancelarPedido() {
    if (!pedido || !clienteToken) return
    setCancelando(true)
    const res = await fetch("/api/pedido/cancelar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: pedido.id, cliente_push_token: clienteToken }),
    })
    setCancelando(false)
    setCancelModal(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? "Erro ao cancelar pedido")
    }
    await load()
  }

  async function enviarReembolso() {
    if (!pedido || !clienteToken || !reembolsoMotivo) return
    if (!reembolsoFoto) { alert("Anexe uma foto ou vídeo do problema para continuar."); return }
    setEnvReembolso(true)
    let fotoUrl = ""
    if (reembolsoFoto) {
      const ext = reembolsoFoto.name.split(".").pop()
      const path = `reembolsos/${pedido.id}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from("reembolsos-fotos").upload(path, reembolsoFoto, { upsert: true })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("reembolsos-fotos").getPublicUrl(path)
        fotoUrl = urlData.publicUrl
      }
    }
    const res = await fetch("/api/reembolso/solicitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: pedido.id, cliente_push_token: clienteToken, motivo: reembolsoMotivo, descricao: reembolsoDesc, foto_url: fotoUrl }),
    })
    setEnvReembolso(false)
    if (res.ok) { setReembolsoOk(true); setReembolsoModal(false); setReembolsoStatus("solicitado") }
    else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Erro ao solicitar reembolso") }
  }

  async function enviarAvaliacao() {
    if (!pedido || notaLoja === 0) return
    setEnviandoAval(true)
    const motoboy = (pedido as any).motoboy
    await supabase.from("avaliacoes").upsert({
      pedido_id: pedido.id, loja_id: pedido.loja_id,
      motoboy_id: motoboy?.id ?? null,
      nota_loja: notaLoja, nota_motoboy: notaMotoboy || null,
      comentario: comentario.trim(),
    })
    // Atualiza média da loja
    const { data: avals } = await supabase.from("avaliacoes").select("nota_loja").eq("loja_id", pedido.loja_id)
    if (avals && avals.length > 0) {
      const media = avals.reduce((s, a) => s + a.nota_loja, 0) / avals.length
      await supabase.from("lojas").update({ nota_media: Math.round(media * 10) / 10, total_avaliacoes: avals.length }).eq("id", pedido.loja_id)
    }
    // Atualiza média do motoboy (se foi avaliado)
    if (motoboy?.id && notaMotoboy > 0) {
      const { data: avalsMoto } = await supabase.from("avaliacoes").select("nota_motoboy").eq("motoboy_id", motoboy.id).not("nota_motoboy", "is", null)
      if (avalsMoto && avalsMoto.length > 0) {
        const mediaMoto = avalsMoto.reduce((s, a) => s + (a.nota_motoboy ?? 0), 0) / avalsMoto.length
        await supabase.from("motoboys").update({ nota_media: Math.round(mediaMoto * 10) / 10, total_avaliacoes: avalsMoto.length }).eq("id", motoboy.id)
      }
    }
    setEnviandoAval(false); setModalAvaliacao(false); setAvaliacaoOk(true); setJaAvaliou(true)
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#9CA3AF" }}>Buscando pedido...</p>
    </div>
  )

  if (notFound || !pedido) return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 20 }}>
      <p style={{ fontSize: 40 }}>🔍</p>
      <p style={{ color: "#111827", fontWeight: 700 }}>Pedido não encontrado</p>
      <p style={{ color: "#9CA3AF", fontSize: 13 }}>Código: #{codigo.toUpperCase()}</p>
      <Link href="/" style={{ color: "#DC2626", fontWeight: 700, marginTop: 8 }}>← Ver lojas</Link>
    </div>
  )

  const aguardandoPagamento = pedido.status === "aguardando_pagamento"
  const etapaAtual  = STATUS_INDEX[pedido.status] ?? 0
  const cancelado   = pedido.status === "cancelado"
  const entregue    = pedido.status === "entregue"
  const coletado    = pedido.status === "coletado"
  const emRota      = pedido.status === "em_rota"
  const loja        = (pedido as any).loja
  const motoboy     = (pedido as any).motoboy
  const podeCancelar = clienteToken && ["aguardando_pagamento","pendente"].includes(pedido.status)
  const podeReembolso = clienteToken && entregue && !reembolsoOk && !reembolsoStatus && ["pix","cartao"].includes(pedido.forma_pagamento)
  const MOTIVOS_REEMBOLSO = ["Recebi errado","Item faltando","Comida estragada","Pedido nunca chegou","Outro"]

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", overflowX: "hidden" }}>

      {/* Modal de Avaliação */}
      {modalAvaliacao && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setModalAvaliacao(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#ffffff", borderRadius: "24px 24px 0 0", border: "1px solid #e5e7eb", padding: "24px 16px 36px", width: "100%", maxWidth: "min(520px, 100vw)", animation: "slideUp 0.3s ease" }}>
            {avaliacaoOk ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <p style={{ fontSize: 56, marginBottom: 12 }}>🎉</p>
                <p style={{ color: "#111827", fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Obrigado!</p>
                <p style={{ color: "#6B7280", fontSize: 14 }}>Sua avaliação foi enviada com sucesso.</p>
                <button onClick={() => setModalAvaliacao(false)} style={{ marginTop: 20, padding: "12px 28px", borderRadius: 12, border: "none", background: "#DC2626", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Fechar</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                  <div>
                    <p style={{ color: "#111827", fontWeight: 900, fontSize: 18 }}>Avalie seu pedido</p>
                    <p style={{ color: "#6B7280", fontSize: 13, marginTop: 3 }}>Sua opinião ajuda muito!</p>
                  </div>
                  <button onClick={() => setModalAvaliacao(false)} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, color: "#6B7280", fontSize: 18, cursor: "pointer", padding: "4px 10px" }}>✕</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <StarRow label="Como foi a loja?" value={notaLoja} onChange={setNotaLoja} />
                  {motoboy && <StarRow label="Como foi o motoboy?" value={notaMotoboy} onChange={setNotaMotoboy} />}
                  <div>
                    <p style={{ color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Comentário (opcional)</p>
                    <textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Conte o que achou..." rows={3}
                      style={{ width: "100%", padding: "10px 13px", borderRadius: 10, fontSize: 14, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#111827", outline: "none", resize: "none", boxSizing: "border-box" }} />
                  </div>
                </div>
                <button onClick={enviarAvaliacao} disabled={enviandoAval || notaLoja === 0} style={{ marginTop: 24, width: "100%", padding: "14px", borderRadius: 14, border: "none", background: notaLoja === 0 || enviandoAval ? "rgba(220,38,38,0.4)" : "#DC2626", color: "white", fontWeight: 800, fontSize: 15, cursor: notaLoja === 0 || enviandoAval ? "not-allowed" : "pointer" }}>
                  {enviandoAval ? "Enviando..." : "Enviar avaliação"}
                </button>
                {notaLoja === 0 && <p style={{ color: "#9CA3AF", fontSize: 12, textAlign: "center", marginTop: 8 }}>Selecione ao menos a nota da loja</p>}
              </>
            )}
          </div>
        </div>
      )}

      {/* Botão flutuante avaliar */}
      {entregue && !jaAvaliou && !avaliacaoOk && !modalAvaliacao && (
        <button onClick={() => setModalAvaliacao(true)} style={{ position: "fixed", bottom: 24, right: 16, zIndex: 50, background: "#DC2626", border: "none", borderRadius: 16, padding: "12px 16px", color: "white", fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 20px rgba(220,38,38,0.35)", maxWidth: "calc(100vw - 32px)" }}>
          ⭐ Avaliar pedido
        </button>
      )}

      {/* Modal cancelar pedido */}
      {cancelModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setCancelModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: "min(520px, 100vw)" }}>
            <p style={{ fontWeight: 900, fontSize: 18, color: "#111827", marginBottom: 8 }}>Cancelar pedido?</p>
            <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
              Se o pagamento foi via PIX ou cartão, o valor será estornado automaticamente em até 10 dias úteis.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setCancelModal(false)} style={{ flex: 1, padding: "13px", borderRadius: 13, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Voltar
              </button>
              <button onClick={cancelarPedido} disabled={cancelando} style={{ flex: 1, padding: "13px", borderRadius: 13, border: "none", background: "#EF4444", color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                {cancelando ? "Cancelando..." : "Sim, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal solicitar reembolso */}
      {reembolsoModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setReembolsoModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: "min(520px, 100vw)", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontWeight: 900, fontSize: 18, color: "#111827" }}>Solicitar reembolso</p>
              <button onClick={() => setReembolsoModal(false)} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, color: "#6B7280", fontSize: 18, cursor: "pointer", padding: "4px 10px" }}>✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>Motivo *</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {MOTIVOS_REEMBOLSO.map(m => (
                  <button key={m} onClick={() => setReembolsoMotivo(m)} style={{
                    padding: "8px 14px", borderRadius: 20, border: "1.5px solid",
                    borderColor: reembolsoMotivo === m ? "#DC2626" : "#E5E7EB",
                    background: reembolsoMotivo === m ? "#FEF2F2" : "white",
                    color: reembolsoMotivo === m ? "#DC2626" : "#6B7280",
                    fontWeight: reembolsoMotivo === m ? 700 : 500, fontSize: 13, cursor: "pointer",
                  }}>{m}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Descrição (opcional)</p>
              <textarea value={reembolsoDesc} onChange={e => setReembolsoDesc(e.target.value)}
                placeholder="Descreva o problema em detalhes..." rows={3}
                style={{ width: "100%", padding: "10px 13px", borderRadius: 10, fontSize: 13, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#111827", outline: "none", resize: "none", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Foto ou vídeo *</p>
              <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 10 }}>Obrigatório — mostre o problema claramente</p>
              <label style={{
                display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                padding: "12px 16px", borderRadius: 12, border: `1.5px dashed ${reembolsoFoto ? "#22c55e" : "#E5E7EB"}`,
                background: reembolsoFoto ? "#F0FDF4" : "#F9FAFB",
              }}>
                <span style={{ fontSize: 22 }}>{reembolsoFoto ? "✅" : "📎"}</span>
                <div>
                  <p style={{ color: reembolsoFoto ? "#15803d" : "#374151", fontWeight: 700, fontSize: 13 }}>
                    {reembolsoFoto ? reembolsoFoto.name : "Clique para anexar arquivo"}
                  </p>
                  <p style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>Foto ou vídeo (JPG, PNG, MP4, MOV...)</p>
                </div>
                <input type="file" accept="image/*,video/*" onChange={e => setReembolsoFoto(e.target.files?.[0] ?? null)}
                  style={{ display: "none" }} />
              </label>
            </div>

            <button onClick={enviarReembolso} disabled={!reembolsoMotivo || !reembolsoFoto || envReembolso} style={{
              width: "100%", padding: "14px", borderRadius: 14, border: "none",
              background: !reembolsoMotivo || !reembolsoFoto || envReembolso ? "rgba(220,38,38,0.4)" : "#DC2626",
              color: "white", fontWeight: 800, fontSize: 15, cursor: !reembolsoMotivo || !reembolsoFoto || envReembolso ? "not-allowed" : "pointer",
            }}>
              {envReembolso ? "Enviando..." : "Enviar solicitação"}
            </button>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/" style={{ color: "#9CA3AF", fontSize: 20, textDecoration: "none" }}>←</Link>
        <p style={{ color: "#DC2626", fontWeight: 900, fontSize: 16 }}>Chegô Delivery</p>
      </nav>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px" }}>

        {/* Código */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 6 }}>Pedido</p>
          <p style={{ color: "#DC2626", fontWeight: 900, fontSize: 40, letterSpacing: 4 }}>#{pedido.codigo}</p>
          {loja && <p style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>{loja.nome}</p>}
        </div>

        {cancelado ? (
          <div style={{ borderRadius: 16, padding: "20px 24px", marginBottom: 24, textAlign: "center", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <p style={{ fontSize: 36, marginBottom: 8 }}>❌</p>
            <p style={{ color: "#EF4444", fontWeight: 800, fontSize: 18 }}>Pedido cancelado</p>
            <p style={{ color: "#6B7280", fontSize: 13, marginTop: 6 }}>Entre em contato com a loja para mais informações.</p>
            {loja?.telefone && (
              <a href={`https://wa.me/55${loja.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                style={{ display: "inline-block", marginTop: 14, color: "#16a34a", fontWeight: 700, fontSize: 13 }}>
                Falar com a loja via WhatsApp
              </a>
            )}
          </div>
        ) : aguardandoPagamento ? (
          <div style={{ marginBottom: 24 }}>
            {/* Banner aguardando pagamento */}
            <div style={{ background: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: 20, padding: "24px 20px", marginBottom: 16, textAlign: "center" }}>
              <p style={{ fontSize: 44, marginBottom: 10 }}>⏳</p>
              <p style={{ color: "#92400E", fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Pagamento pendente</p>
              <p style={{ color: "#78350F", fontSize: 13, lineHeight: 1.5 }}>
                Seu pedido foi criado mas ainda não foi pago.<br />
                Finalize o pagamento para confirmar o pedido.
              </p>
            </div>

            {/* PIX copia e cola */}
            {pedido.forma_pagamento === "pix" && (pedido as any).pix_copia_cola && (
              <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "20px 16px", marginBottom: 16 }}>
                <p style={{ color: "#111827", fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Pagar com PIX</p>
                <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 16 }}>Copie o código abaixo e cole no app do seu banco:</p>
                <div style={{
                  background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10,
                  padding: "12px 14px", fontSize: 11, color: "#374151",
                  wordBreak: "break-all", fontFamily: "monospace", marginBottom: 12, lineHeight: 1.6,
                }}>
                  {(pedido as any).pix_copia_cola}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText((pedido as any).pix_copia_cola).then(() => {
                      setPixCopiado(true)
                      setTimeout(() => setPixCopiado(false), 3000)
                    })
                  }}
                  style={{
                    width: "100%", padding: "13px", borderRadius: 12, border: "none",
                    background: pixCopiado ? "#16A34A" : "#111827",
                    color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  {pixCopiado ? "✓ Código copiado!" : "📋 Copiar código PIX"}
                </button>
                <p style={{ color: "#9CA3AF", fontSize: 11, textAlign: "center", marginTop: 10 }}>
                  Esta página atualiza automaticamente após o pagamento
                </p>
              </div>
            )}

            {pedido.forma_pagamento === "cartao" && (
              <CartaoProcessando pedidoId={pedido.id} onConfirmado={load} />
            )}
            {pedido.forma_pagamento !== "pix" && pedido.forma_pagamento !== "cartao" && (
              <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "20px 16px", marginBottom: 16, textAlign: "center" }}>
                <p style={{ color: "#6B7280", fontSize: 13 }}>Volte ao app para finalizar o pagamento com {pedido.forma_pagamento}.</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Progresso */}
            <div style={{ background: "#ffffff", borderRadius: 20, padding: "24px 20px", marginBottom: 20, border: entregue ? "1px solid rgba(34,197,94,0.3)" : "1px solid #e5e7eb", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 12, minHeight: 64 }}>
                  <EtapaIcon index={etapaAtual} size={56} />
                </div>
                <p style={{ color: "#111827", fontWeight: 800, fontSize: 18 }}>{ETAPAS[etapaAtual]?.label}</p>
                <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>Atualiza em tempo real · toque para detalhes</p>
              </div>
              <style>{`
                @keyframes stepPulse { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.4)} 50%{box-shadow:0 0 0 8px rgba(220,38,38,0)} }
                @keyframes descFade { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
              `}</style>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {ETAPAS.map((etapa, i) => {
                  const feita = i < etapaAtual, atual = i === etapaAtual
                  const clicavel = feita || atual
                  const expandida = etapaExpandida === i
                  return (
                    <div key={etapa.status}>
                      <div
                        onClick={() => clicavel && setEtapaExpandida(expandida ? null : i)}
                        style={{ display: "flex", alignItems: "flex-start", gap: 14, cursor: clicavel ? "pointer" : "default", borderRadius: 10, padding: "3px 8px", margin: "0 -8px", background: expandida ? "rgba(220,38,38,0.05)" : "transparent", transition: "background 0.2s" }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 22 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                            background: feita ? "#22c55e" : atual ? "#DC2626" : "#E5E7EB",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, color: "white", fontWeight: 700,
                            animation: atual ? "stepPulse 2s ease-in-out infinite" : "none",
                          }}>
                            {feita ? "✓" : atual ? "●" : ""}
                          </div>
                          {i < ETAPAS.length - 1 && (
                            <div style={{ width: 2, height: expandida ? 36 : 28, marginTop: 2, background: feita ? "#22c55e" : "#E5E7EB", transition: "height 0.25s, background 0.4s" }} />
                          )}
                        </div>
                        <div style={{ flex: 1, paddingBottom: i < ETAPAS.length - 1 ? (expandida ? 0 : 0) : 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 2 }}>
                            <p style={{ fontSize: 13, fontWeight: atual ? 700 : feita ? 600 : 500, color: feita ? "#16a34a" : atual ? "#111827" : "#9CA3AF" }}>
                              {etapa.label}
                            </p>
                            {clicavel && (
                              <span style={{ color: "#D1D5DB", fontSize: 11, marginLeft: 6, transition: "transform 0.2s", display: "inline-block", transform: expandida ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                            )}
                          </div>
                          {expandida && (
                            <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4, marginBottom: 4, lineHeight: 1.5, animation: "descFade 0.2s ease" }}>
                              {etapa.descricao}
                            </p>
                          )}
                        </div>
                      </div>
                      {i < ETAPAS.length - 1 && <div style={{ height: expandida ? 4 : 0 }} />}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Código p/ motoboy */}
            {coletado && (
              <div style={{ background: "#ffffff", border: "2px solid rgba(220,38,38,0.35)", borderRadius: 20, padding: "24px 16px", marginBottom: 16, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflowX: "hidden" }}>
                <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 10 }}>Mostre este código ao entregador:</p>
                <p style={{ color: "#DC2626", fontWeight: 900, fontSize: "clamp(36px, 14vw, 64px)", letterSpacing: "clamp(4px, 2vw, 12px)", lineHeight: 1, marginBottom: 8 }}>{pedido.codigo}</p>
                <p style={{ color: "#9CA3AF", fontSize: 12 }}>O motoboy digita este código ao chegar para confirmar a entrega</p>
              </div>
            )}

            {/* Chat com motoboy */}
            {coletado && <ChatMotoboy pedidoId={pedido.id} />}

            {/* Banner: há entregas antes da sua */}
            {entregasAntes !== null && entregasAntes > 0 && !entregue && !cancelado && (
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>🛵</span>
                <p style={{ color: "#92400e", fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
                  {entregasAntes === 1
                    ? "Há 1 entrega antes da sua. O motoboy está a caminho!"
                    : `Há ${entregasAntes} entregas antes da sua. O motoboy está chegando!`}
                </p>
              </div>
            )}

            {/* Motoboy + mapa Google Maps */}
            {motoboy && (emRota || coletado) && (
              <div style={{ background: "#ffffff", borderRadius: 16, marginBottom: 16, border: "1px solid rgba(220,38,38,0.2)", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#DC2626" }} />
                    <div className="ping-slow" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#DC2626" }} />
                  </div>
                  <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>{motoboy.nome} está a caminho</p>
                </div>
                {motoboy.lat && motoboy.lng ? (
                  <>
                    <MapaRastreamento
                      motoboyId={motoboy.id}
                      initialLat={motoboy.lat}
                      initialLng={motoboy.lng}
                      enderecoEntrega={pedido.endereco_entrega}
                    />
                    <div style={{ padding: "10px 18px", background: "#F9FAFB" }}>
                      <p style={{ color: "#9CA3AF", fontSize: 11 }}>Localização em tempo real · atualiza automaticamente</p>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: "14px 18px", paddingTop: 0 }}>
                    <p style={{ color: "#9CA3AF", fontSize: 13 }}>Aguardando localização GPS do entregador...</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Botão cancelar pedido */}
        {podeCancelar && (
          <button onClick={() => setCancelModal(true)} style={{
            width: "100%", padding: "13px", borderRadius: 14, border: "1.5px solid #fca5a5",
            background: "#FEF2F2", color: "#DC2626", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 12,
          }}>
            Cancelar pedido
          </button>
        )}

        {/* Botão solicitar reembolso */}
        {podeReembolso && (
          <button onClick={() => setReembolsoModal(true)} style={{
            width: "100%", padding: "13px", borderRadius: 14, border: "1.5px solid #fdba74",
            background: "#FFF7ED", color: "#ea580c", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 12,
          }}>
            Solicitar reembolso
          </button>
        )}

        {/* Status do reembolso */}
        {(reembolsoStatus || reembolsoOk) && (
          <div style={{
            background: reembolsoStatus === "negado" ? "#FEF2F2" : "#F0FDF4",
            border: `1px solid ${reembolsoStatus === "negado" ? "#fca5a5" : "#bbf7d0"}`,
            borderRadius: 14, padding: "14px 16px", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>
              {reembolsoStatus === "solicitado" && "🕐"}
              {reembolsoStatus === "aprovado" && "✅"}
              {reembolsoStatus === "processando" && "⏳"}
              {reembolsoStatus === "concluido" && "💸"}
              {reembolsoStatus === "negado" && "❌"}
              {!reembolsoStatus && "✅"}
            </span>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: reembolsoStatus === "negado" ? "#DC2626" : "#15803d" }}>
                {reembolsoStatus === "solicitado" && "Reembolso solicitado"}
                {reembolsoStatus === "aprovado" && "Reembolso aprovado"}
                {reembolsoStatus === "processando" && "Reembolso em processamento"}
                {reembolsoStatus === "concluido" && "Reembolso concluído"}
                {reembolsoStatus === "negado" && "Reembolso negado"}
                {!reembolsoStatus && "Solicitação enviada!"}
              </p>
              <p style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                {reembolsoStatus === "solicitado" && "Em análise pela loja ou administrador"}
                {reembolsoStatus === "aprovado" && "Será processado em breve"}
                {reembolsoStatus === "processando" && "O valor está sendo devolvido"}
                {reembolsoStatus === "concluido" && "Valor devolvido com sucesso"}
                {reembolsoStatus === "negado" && "Entre em contato com a loja para mais informações"}
                {!reembolsoStatus && "Aguarde a análise em breve"}
              </p>
            </div>
          </div>
        )}

        {/* Resumo */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6" }}>
            <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>Resumo do pedido</p>
          </div>
          <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {pedido.itens?.map((item: any) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#374151" }}>{item.quantidade}× {item.nome}</span>
                <span style={{ color: "#6B7280" }}>R$ {(item.preco * item.quantidade).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "12px 18px", borderTop: "1px solid #F3F4F6", display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9CA3AF" }}>
              <span>Subtotal</span><span>R$ {pedido.subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9CA3AF" }}>
              <span>Entrega</span>
              <span style={{ color: pedido.taxa_entrega === 0 ? "#16a34a" : undefined }}>
                {pedido.taxa_entrega === 0 ? "Grátis" : `R$ ${pedido.taxa_entrega.toFixed(2)}`}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: "#111827", fontSize: 15, marginTop: 4 }}>
              <span>Total</span><span>R$ {pedido.total.toFixed(2)}</span>
            </div>
            <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>{PAGAMENTO_LABEL[pedido.forma_pagamento] ?? pedido.forma_pagamento}</p>
          </div>
        </div>

        {/* Endereço */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "14px 18px", marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <p style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 4 }}>Endereço de entrega</p>
          <p style={{ color: "#111827", fontSize: 14 }}>📍 {pedido.endereco_entrega}</p>
        </div>

        <Link href="/" onClick={() => localStorage.removeItem("arago_pedido_ativo")} style={{ display: "block", textAlign: "center", padding: "13px", borderRadius: 12, background: "#ffffff", color: "#6B7280", fontWeight: 700, fontSize: 14, textDecoration: "none", border: "1px solid #e5e7eb" }}>
          Fazer outro pedido
        </Link>
      </div>
    </div>
  )
}
