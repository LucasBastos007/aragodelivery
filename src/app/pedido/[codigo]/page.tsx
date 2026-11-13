"use client"

import AjudaPagamentoWhats from "@/components/AjudaPagamentoWhats"
import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import type { Pedido, StatusPedido } from "@/types"
import { brl } from "@/lib/precoExibicao"
import { partesPagamento, rotuloPagamento, temForma, valorDaForma, ehDividido } from "@/lib/pagamentoDividido"
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

  // Rota via Directions Service. Cada chamada é cobrada pelo Google: antes recalculava a cada
  // posição nova do motoboy (a cada 4s) e chegou a R$ 1.143 em 40 dias (10/11/2026). Agora calcula
  // uma vez e só refaz quando o motoboy andou mais de 400 m e já passaram 2 minutos.
  const ultimaRota = useRef<{ lat: number; lng: number; t: number; dLat: number; dLng: number } | null>(null)
  useEffect(() => {
    if (!isLoaded || !destLat || !destLng) return
    const u = ultimaRota.current
    const mesmoDestino = u && u.dLat === destLat && u.dLng === destLng
    if (mesmoDestino) {
      const dLat = (motoLat - u.lat) * 111.32, dLng = (motoLng - u.lng) * 111.32 * Math.cos(motoLat * Math.PI / 180)
      if (Math.hypot(dLat, dLng) < 0.4 || Date.now() - u.t < 120_000) return
    }
    ultimaRota.current = { lat: motoLat, lng: motoLng, t: Date.now(), dLat: destLat, dLng: destLng }
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
// Layout novo (proposta aprovada em 19/10/2026): 5 etapas como na proposta.
// Os status do banco não mudam; só o jeito de mostrar.
const ETAPAS = [
  { t: "Pedido enviado", d: "A loja recebeu seu pedido", tit: "Pedido enviado" },
  { t: "Loja aceitou", d: "Seu pedido foi confirmado", tit: "A loja aceitou seu pedido" },
  { t: "Preparando", d: "Está sendo feito agora", tit: "Preparando com carinho" },
  { t: "Saiu para entrega", d: "O entregador está a caminho", tit: "Saiu para entrega" },
  { t: "Entregue", d: "Bom apetite!", tit: "Pedido entregue" },
]
const STATUS_ETAPA: Partial<Record<StatusPedido, number>> = {
  aguardando_pagamento: 0, pendente: 0, aceito: 1, preparando: 2, pronto: 2,
  aguardando_aceite: 2, indo_para_loja: 2, na_loja: 2, em_rota: 3, coletado: 3, entregue: 4,
}
const DETALHE_STATUS: Partial<Record<StatusPedido, string>> = {
  pronto: "Pronto, esperando o entregador",
  aguardando_aceite: "Pronto, chamando um entregador",
  indo_para_loja: "O entregador está indo buscar",
  na_loja: "O entregador chegou na loja",
}
const POSICAO_MOTO = [6, 22, 38, 70, 94]

const PAGAMENTO_LABEL: Record<string, string> = {
  pix: "Pix", cartao: "Cartão de crédito", dinheiro: "Dinheiro", maquininha: "Maquininha", pix_loja: "Pix (pago à loja)",
}
const SUPORTE_WHATS = "5562985845621"
const MOTIVOS_BONS = ["Comida quentinha", "Bem servido", "Saboroso", "Embalagem caprichada"]
const MOTIVOS_RUINS = ["Demorou pra preparar", "Veio frio", "Faltou item", "Pedido errado", "Embalagem ruim"]

function horaBrt(d: Date) { return d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) }

function copiarTexto(t: string, ok: () => void) {
  const antigo = () => {
    // iPhone sem permissão de área de transferência: copia pelo jeito antigo, que o Safari aceita
    const x = document.createElement("textarea")
    x.value = t; x.setAttribute("readonly", ""); x.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px"
    document.body.appendChild(x); x.focus(); x.select(); x.setSelectionRange(0, t.length)
    let r = false; try { r = document.execCommand("copy") } catch {}
    x.remove(); if (r) ok()
  }
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(ok, antigo)
  else antigo()
}

function Estrelas({ value, onChange, rotulo }: { value: number; onChange: (v: number) => void; rotulo: string }) {
  return (
    <div className="estrelas" role="radiogroup" aria-label={rotulo}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" className={value >= n ? "on" : ""} onClick={() => onChange(n)} aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}>★</button>
      ))}
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
      else { setErro("Pagamento ainda em análise. Aguarde alguns segundos e tente de novo.") }
    } catch { setErro("Não deu pra verificar agora. Tente de novo.") }
    finally { setVerificando(false) }
  }

  if (cancelado) {
    return (
      <div className="cartao" style={{ padding: "20px 16px", textAlign: "center" }}>
        <div className="h3">O pagamento não foi processado</div>
        <p className="mut" style={{ fontSize: 13.5, margin: "6px 0 14px", lineHeight: 1.5 }}>Este pedido foi cancelado. Faça um novo pedido e digite os dados do cartão de novo.</p>
        <a className="btn btn-p" href="/" onClick={() => localStorage.removeItem("arago_pedido_ativo")}>Fazer novo pedido</a>
      </div>
    )
  }

  return (
    <div className="cartao" style={{ padding: "20px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 30 }}>💳</div>
      <div className="h3" style={{ marginTop: 6 }}>Processando o pagamento no cartão</div>
      <p className="mut" style={{ fontSize: 13.5, margin: "6px 0 14px" }}>Costuma levar alguns segundos.</p>
      {erro && <p className="erro-linha" style={{ marginBottom: 10 }}>{erro}</p>}
      <button className="btn btn-g" onClick={verificar} disabled={verificando}>{verificando ? "Verificando…" : "Verificar pagamento"}</button>
    </div>
  )
}

function ChatMotoboy({ pedidoId, nome, veiculo, onFechar }: { pedidoId: string; nome: string; veiculo?: string; onFechar: () => void }) {
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
    <div className="cn-veu on" onClick={onFechar}>
      <div className="cn folha on chat-folha" onClick={e => e.stopPropagation()}>
        {/* Conversa em tela cheia, igual à proposta */}
        <div className="topo branco">
          <div className="linha-topo">
            <button className="voltar" onClick={onFechar} aria-label="Voltar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
            <span className="chat-av">{nome.trim().split(/\s+/).map(x => x[0]).slice(0, 2).join("").toUpperCase()}</span>
            <span style={{ flex: 1, minWidth: 0 }}><b className="h3" style={{ display: "block" }}>{nome}</b><small className="mut">Seu entregador{veiculo ? ` · ${veiculo}` : ""}</small></span>
          </div>
        </div>
        <div className="chat">
          {msgs.length === 0 && <p className="mut" style={{ textAlign: "center", fontSize: 13.5, margin: "24px 0" }}>Nenhuma mensagem ainda. Mande um oi pro entregador.</p>}
          {msgs.map(m => <div key={m.id} className={`bal ${m.remetente === "cliente" ? "eu" : "ele"}`}>{m.texto}</div>)}
          <div ref={bottomRef} />
        </div>
        <div className="chat-in">
          <input value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => e.key === "Enter" && enviar()} placeholder="Escreva uma mensagem" />
          <button onClick={enviar} disabled={!texto.trim() || enviando} aria-label="Enviar"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 12 20 4l-4 16-4-7z" /></svg></button>
        </div>
      </div>
    </div>
  )
}

export default function AcompanhamentoPedido() {
  const { codigo } = useParams<{ codigo: string }>()
  const [pedido,   setPedido]   = useState<Pedido | null>(null)
  const [loading,  setLoading]  = useState(true)
  // Aviso de chuva forte/demanda alta, ligado pelo admin em configuracoes.aviso_chuva (31/10/2026)
  const [avisoChuva, setAvisoChuva] = useState(false)
  useEffect(() => { fetch("/api/corrida-dinamica").then(r => r.ok ? r.json() : null).then(j => setAvisoChuva(!!j?.aviso_chuva)).catch(() => {}) }, [])
  const [notFound, setNotFound] = useState(false)

  const [etapaExpandida, setEtapaExpandida] = useState<number | null>(null)
  const [modalAvaliacao, setModalAvaliacao] = useState(false)
  const [jaAvaliou,      setJaAvaliou]      = useState(false)
  const [notaLoja,       setNotaLoja]       = useState(0)
  const [notaMotoboy,    setNotaMotoboy]    = useState(0)
  const [comentario,     setComentario]     = useState("")
  const [enviandoAval,   setEnviandoAval]   = useState(false)
  const [avaliacaoOk,    setAvaliacaoOk]    = useState(false)
  const [motivosLoja,    setMotivosLoja]    = useState<Set<string>>(new Set())
  const [chatAberto,     setChatAberto]     = useState(false)

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
      .select("*, itens:itens_pedido(*), loja:lojas(nome, telefone, logo_url, tempo_min, tempo_max), motoboy:motoboys(*)")
      .eq("codigo", codigo.toUpperCase())
      .order("criado_em", { ascending: false })
      .limit(1)

    const data = (error ? null : rows?.[0]) ?? null
    if (!data) {
      const { data: rows2 } = await supabase
        .from("pedidos")
        .select("*, itens:itens_pedido(*), loja:lojas(nome, telefone, logo_url, tempo_min, tempo_max)")
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
        // Sem o token do pedido a API recusava (400) e nenhuma inscrição era gravada — cliente
        // nunca recebia aviso de status no celular (achado em 31/10/2026).
        const token = localStorage.getItem(`arago_tkn_${codigo.toUpperCase()}`)
        if (!token) return
        await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "subscribe", pedido_id: pedido!.id, subscription: sub, cliente_push_token: token }) })
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
    // Grava pelo servidor, que também recalcula a nota da loja e do motoboy (20/10/2026)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch("/api/pedido/avaliar", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify({
        pedido_id: pedido.id, cliente_push_token: clienteToken,
        nota_loja: notaLoja, nota_motoboy: notaMotoboy || null,
        // Motivos tocados na avaliação vão junto no comentário (a tabela não tem campo próprio)
        comentario: [[...motivosLoja].join(", "), comentario.trim()].filter(Boolean).join(". "),
      }),
    }).catch(() => null)
    setEnviandoAval(false)
    if (!res || !res.ok) { const j = await res?.json().catch(() => ({})); alert(j?.error ?? "Não foi possível enviar a avaliação. Tente de novo."); return }
    setModalAvaliacao(false); setAvaliacaoOk(true); setJaAvaliou(true)
  }

  if (loading) return (
    <div className="cn" style={{ display: "grid", placeItems: "center" }}><p className="mut">Buscando o pedido…</p></div>
  )

  if (notFound || !pedido) return (
    <div className="cn" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, padding: 20, textAlign: "center" }}>
      <div style={{ fontSize: 40 }}>🔍</div>
      <div className="h2">Pedido não encontrado</div>
      <p className="mut">Código #{codigo.toUpperCase()}</p>
      <Link className="btn btn-p" href="/" style={{ marginTop: 10, maxWidth: 280 }}>Ver lojas</Link>
    </div>
  )

  const aguardandoPagamento = pedido.status === "aguardando_pagamento"
  const etapaAtual  = STATUS_ETAPA[pedido.status] ?? 0
  const cancelado   = pedido.status === "cancelado"
  const entregue    = pedido.status === "entregue"
  const coletado    = pedido.status === "coletado"
  const emRota      = pedido.status === "em_rota"
  const loja        = (pedido as any).loja
  const motoboy     = (pedido as any).motoboy
  const podeCancelar = clienteToken && ["aguardando_pagamento","pendente"].includes(pedido.status)
  const podeReembolso = clienteToken && entregue && !reembolsoOk && !reembolsoStatus && (temForma(pedido, "pix") || temForma(pedido, "cartao"))
  const MOTIVOS_REEMBOLSO = ["Recebi errado","Item faltando","Comida estragada","Pedido nunca chegou","Outro"]

  const retirada  = (pedido as any).tipo_entrega === "retirada" || (pedido.endereco_entrega ?? "").includes("Retirada na loja")
  const etapa     = STATUS_ETAPA[pedido.status] ?? 0
  const etapas    = retirada ? ETAPAS.map((x, i) => i === 3 ? { t: "Pronto pra retirar", d: "Pode buscar na loja", tit: "Pronto pra retirar" } : i === 4 ? { t: "Retirado", d: "Bom apetite!", tit: "Pedido retirado" } : x) : ETAPAS
  const etapaRet  = retirada && ["pronto", "aguardando_aceite"].includes(pedido.status) ? 3 : etapa
  const ativo     = !cancelado && !entregue && !aguardandoPagamento
  const temMoto   = !!motoboy && !retirada && ["indo_para_loja", "na_loja", "em_rota", "coletado"].includes(pedido.status)
  const codigoEntrega = ((pedido as any).telefone_cliente ?? "").replace(/\D/g, "").slice(-4)
  const criado    = new Date((pedido as any).criado_em ?? Date.now())
  const janela    = loja?.tempo_min && loja?.tempo_max
    ? `${horaBrt(new Date(criado.getTime() + loja.tempo_min * 60000))} e ${horaBrt(new Date(criado.getTime() + loja.tempo_max * 60000))}` : null
  const titulo    = cancelado ? "Pedido cancelado" : aguardandoPagamento ? "Falta pagar" : entregue ? etapas[4].tit : etapas[etapaRet].tit
  const zap       = (num: string, texto: string) => `https://wa.me/${num}?text=${encodeURIComponent(texto)}`

  return (
    <div className="cn acomp-novo">
      <div className={`acomp-topo ${cancelado ? "cancelado" : ""}`}>
        <Link className="voltar" href="/" aria-label="Voltar" style={{ background: "rgba(255,255,255,.12)", color: "#fff", boxShadow: "none" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <div className="h1" style={{ marginTop: 14 }}>{titulo}</div>
        <div className="prev">
          {cancelado ? "Fale com a loja pra saber mais"
            : aguardandoPagamento ? "O pedido vai pra loja assim que o pagamento cair"
            : entregue ? "✓ Bom apetite!"
            : retirada ? `🏪 Retirada em ${loja?.nome ?? "loja"}`
            : DETALHE_STATUS[pedido.status] ?? (janela ? `🕐 Chega entre ${janela}` : "Acompanhe aqui")}
        </div>
        {!retirada && !cancelado && !aguardandoPagamento && (
          <div className="estrada" aria-hidden="true">
            <div className="via" /><div className="tracos" />
            <div className="feito" style={{ width: `calc((100% - 48px) * ${POSICAO_MOTO[etapa] / 100})` }} />
            <div className="ponto" style={{ left: 24 }}>🏪</div><div className="ponto" style={{ left: "calc(100% - 24px)" }}>🏠</div>
            <div className={`moto ${etapa === 3 ? "anda" : ""}`} style={{ left: `calc(24px + (100% - 48px) * ${POSICAO_MOTO[etapa] / 100})` }}>🛵</div>
            <span className="rot" style={{ left: 24 }}>{(loja?.nome ?? "Loja").length > 16 ? (loja?.nome ?? "").slice(0, 15) + "…" : loja?.nome ?? "Loja"}</span>
            <span className="rot" style={{ left: "calc(100% - 24px)" }}>Você</span>
          </div>
        )}
      </div>

      <div style={{ padding: "16px 12px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
        {entregue && !jaAvaliou && !avaliacaoOk && <button className="btn btn-p" onClick={() => setModalAvaliacao(true)}>Avaliar pedido</button>}

        {avisoChuva && !cancelado && !entregue && (
          <div className="cartao" role="status" style={{ padding: 16, background: "#EAF2FB", border: "1px solid #B9D3EE", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden="true">🌧️</span>
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 16, color: "#123B66" }}>Tá chovendo por aqui!</b>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: "#1F3A57", marginTop: 4 }}>
                Seu pedido já está com a gente, mas o motoboy vai com mais cuidado na pista molhada. Pode demorar um pouquinho a mais, mas chega quentinho! 💛
              </p>
            </div>
          </div>
        )}

        {aguardandoPagamento && temForma(pedido, "pix") && (pedido as any).pix_copia_cola && (
          <div className="cartao" style={{ padding: 16 }}>
            <span className="h3">Pagar {ehDividido(pedido) ? brl(valorDaForma(pedido, "pix")) + " " : ""}com Pix</span>
            <p className="mut" style={{ fontSize: 13.5, margin: "4px 0 12px" }}>Copie o código e cole no app do seu banco.</p>
            <div className="copia">
              <span style={{ flex: 1 }}>{String((pedido as any).pix_copia_cola).slice(0, 70)}…</span>
              <button onClick={() => copiarTexto((pedido as any).pix_copia_cola, () => { setPixCopiado(true); setTimeout(() => setPixCopiado(false), 3000) })} style={{ background: pixCopiado ? "var(--folha)" : undefined }}>{pixCopiado ? "Copiado" : "Copiar"}</button>
            </div>
            <p className="mut" style={{ fontSize: 12.5, marginTop: 10, textAlign: "center" }}>Esta tela atualiza sozinha depois do pagamento.</p>
            <AjudaPagamentoWhats codigo={pedido.codigo} />
          </div>
        )}
        {aguardandoPagamento && temForma(pedido, "cartao") && !temForma(pedido, "pix") && <CartaoProcessando pedidoId={pedido.id} onConfirmado={load} />}

        {temMoto && (
          <div className="cartao mb">
            <span className="av">{String(motoboy.nome ?? "?").trim().split(/\s+/).map((x: string) => x[0]).slice(0, 2).join("").toUpperCase()}</span>
            <span style={{ flex: 1, minWidth: 0 }}><b className="h3">{String(motoboy.nome ?? "").split(" ")[0]}, seu entregador</b><br /><small className="mut">{[motoboy.veiculo, motoboy.placa].filter(Boolean).join(", placa ")}</small></span>
            <span className="ac"><button onClick={() => setChatAberto(true)} aria-label="Conversar com o entregador">💬</button></span>
          </div>
        )}

        {temMoto && codigoEntrega && (
          <div className="cartao cod-entrega">
            <span><b className="h3">Código de entrega</b><br /><small className="mut">Fale pro entregador quando ele chegar</small></span>
            <span className="dg">{codigoEntrega}</span>
          </div>
        )}

        {entregasAntes !== null && entregasAntes > 0 && ativo && (
          <p className="aviso-amarelo" style={{ margin: 0 }}>🛵 {entregasAntes === 1 ? "Tem 1 entrega antes da sua. O entregador já está a caminho." : `Tem ${entregasAntes} entregas antes da sua. O entregador já está chegando.`}</p>
        )}

        {motoboy && (emRota || coletado) && (
          <div className="cartao" style={{ overflow: "hidden" }}>
            {motoboy.lat && motoboy.lng
              ? <><MapaRastreamento motoboyId={motoboy.id} initialLat={motoboy.lat} initialLng={motoboy.lng} enderecoEntrega={pedido.endereco_entrega} />
                <p className="mut" style={{ fontSize: 12, padding: "8px 14px" }}>Localização do entregador ao vivo</p></>
              : <p className="mut" style={{ fontSize: 13.5, padding: 14 }}>Esperando a localização do entregador…</p>}
          </div>
        )}

        {cancelado && (
          <div className="cartao" style={{ padding: 16 }}>
            <span className="h3">O pedido foi cancelado</span>
            <p className="mut" style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.5 }}>Se você pagou por Pix ou cartão, o valor volta automaticamente em até 10 dias úteis.</p>
          </div>
        )}

        {!cancelado && !aguardandoPagamento && (
          <div className="cartao" style={{ padding: 16 }}>
            <div className="etapas">
              {etapas.map((x, i) => {
                const atual = entregue ? 5 : etapaRet
                return (
                  <div key={x.t} className={`etapa ${i < atual || entregue ? "feita" : i === atual ? "agora" : ""}`}>
                    <span className="b" />
                    <span className="t"><b>{x.t}</b><small>{i === 0 ? `às ${horaBrt(criado)}` : i <= atual ? x.d : ""}</small></span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {(reembolsoStatus || reembolsoOk) && (
          <div className="cartao" style={{ padding: 16 }}>
            <b className="h3">{reembolsoStatus === "aprovado" ? "Reembolso aprovado" : reembolsoStatus === "processando" ? "Reembolso em andamento" : reembolsoStatus === "concluido" ? "Reembolso concluído" : reembolsoStatus === "negado" ? "Reembolso negado" : "Reembolso pedido"}</b>
            <p className="mut" style={{ fontSize: 13.5, marginTop: 4 }}>{reembolsoStatus === "aprovado" ? "O valor vai ser devolvido em breve." : reembolsoStatus === "processando" ? "O valor está sendo devolvido." : reembolsoStatus === "concluido" ? "O valor já foi devolvido." : reembolsoStatus === "negado" ? "Fale com a loja pra saber mais." : "A loja ou o Chegô vai analisar."}</p>
          </div>
        )}

        <div className="cartao contas" style={{ padding: "14px 16px" }}>
          <div style={{ paddingBottom: 10, alignItems: "baseline" }}><b className="h3">{loja?.nome ?? ""}</b><span className="mut" style={{ fontSize: 13 }}>Pedido #{pedido.codigo}</span></div>
          {pedido.itens?.map((item: any) => (
            <div key={item.id} style={{ flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 0 }}>{item.quantidade}× {item.nome}{item.adicionais?.length ? <small className="mut" style={{ display: "block", fontSize: 12.5 }}>{item.adicionais.map((a: any) => a.nome).join(", ")}</small> : null}</span>
              <span>{item.preco > 0 ? brl(item.preco * item.quantidade) : ""}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--linha)", marginTop: 6, paddingTop: 10 }}><span>Subtotal</span><span>{brl(pedido.subtotal)}</span></div>
          <div><span>{retirada ? "Retirada" : "Entrega"}</span><span className={pedido.taxa_entrega === 0 || (pedido as any).frete_gratis ? "verde" : ""}>{pedido.taxa_entrega === 0 ? "Grátis" : (pedido as any).frete_gratis ? <>Grátis <s className="mut">{brl(pedido.taxa_entrega)}</s></> : brl(pedido.taxa_entrega)}</span></div>
          {Number(pedido.taxa_dinamica ?? 0) > 0 && <div><span>Corrida dinâmica (chuva)</span><span>+ {brl(Number(pedido.taxa_dinamica))}</span></div>}
          <div className="tot"><span>Total</span><span>{brl(pedido.total)}</span></div>
          {ehDividido(pedido)
            ? partesPagamento(pedido).map(x => <div key={x.forma}><span className="mut">{PAGAMENTO_LABEL[x.forma] ?? x.forma}</span><span className="mut">{brl(x.valor)}</span></div>)
            : <p className="mut" style={{ fontSize: 13, marginTop: 6 }}>{PAGAMENTO_LABEL[pedido.forma_pagamento] ?? pedido.forma_pagamento}{["pix", "cartao"].includes(pedido.forma_pagamento) && pedido.status !== "aguardando_pagamento" && pedido.status !== "cancelado" ? " · pago" : ""}</p>}
        </div>

        <div className="cartao end-card">
          <span className="ic">{retirada ? "🏪" : "📍"}</span>
          <span style={{ flex: 1, minWidth: 0 }}><small className="mut">{retirada ? "Retirada na loja" : "Endereço de entrega"}</small><br /><b style={{ color: "var(--grafite)", fontSize: 14.5 }}>{pedido.endereco_entrega}</b></span>
        </div>

        <div className="cartao menu-l">
          {podeCancelar && <button onClick={() => setCancelModal(true)}><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg></span>Cancelar pedido</button>}
          {podeReembolso && <button onClick={() => setReembolsoModal(true)}><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg></span>Algo deu errado? Pedir reembolso</button>}
          {/* Só o suporte do Chegô (Lucas, 20/10/2026): o cliente não fala direto com a loja por aqui. */}
          <a href={`/cliente/suporte?pedido=${pedido.codigo}`}><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></svg></span>Ajuda do Chegô pelo chat</a>
        </div>

        <Link className="btn btn-s" href="/" onClick={() => localStorage.removeItem("arago_pedido_ativo")}>Fazer outro pedido</Link>
      </div>

      {chatAberto && motoboy && <ChatMotoboy pedidoId={pedido.id} nome={String(motoboy.nome ?? "Entregador").split(" ")[0]} veiculo={motoboy.veiculo ? String(motoboy.veiculo) : undefined} onFechar={() => setChatAberto(false)} />}

      {/* Avaliação */}
      {modalAvaliacao && (
        <div className="cn-veu on" onClick={() => setModalAvaliacao(false)}>
          {/* Tela cheia "Avaliar pedido", igual à proposta */}
          <div className="cn folha on tela-cheia" onClick={e => e.stopPropagation()}>
            <div className="topo branco">
              <div className="linha-topo">
                <button className="voltar" onClick={() => setModalAvaliacao(false)} aria-label="Voltar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
                <span className="h2" style={{ flex: 1 }}>Avaliar pedido</span>
              </div>
            </div>
            <div className="folha-rolagem" style={{ padding: "14px 14px 10px" }}>
              {avaliacaoOk ? (
                <div className="cartao aval-card ok"><span className="ok-ic">✓</span><b className="h3">Avaliação enviada</b><small className="mut">Obrigado! Isso ajuda muito a loja e o entregador.</small></div>
              ) : (
                <>
                  <p className="mut" style={{ textAlign: "center", fontSize: 14, lineHeight: 1.45, margin: "0 6px 12px" }}>Cada avaliação vai separada: a da loja para a loja, a do entregador para o entregador.</p>
                  <div className="cartao aval-card">
                    <div className="aval-cab">{loja?.logo_url ? <img className="aval-foto" src={loja.logo_url} alt="" /> : <span className="aval-foto" />}<span><b className="h3" style={{ display: "block" }}>{loja?.nome ?? "Loja"}</b><small className="mut">Comida, embalagem e preparo</small></span></div>
                    <Estrelas value={notaLoja} onChange={n => { setNotaLoja(n); setMotivosLoja(new Set()) }} rotulo="Nota da loja" />
                    {notaLoja > 0 && (
                      <>
                        <p className="mut" style={{ fontSize: 13, marginBottom: 6 }}>{notaLoja >= 4 ? "O que foi bom?" : "O que pode melhorar?"}</p>
                        <div className="motivos">{(notaLoja >= 4 ? MOTIVOS_BONS : MOTIVOS_RUINS).map(t => (
                          <button key={t} className="chip" aria-pressed={motivosLoja.has(t)} onClick={() => setMotivosLoja(s => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n })}>{t}</button>
                        ))}</div>
                      </>
                    )}
                  </div>
                  {motoboy && !retirada && (
                    <div className="cartao aval-card">
                      <div className="aval-cab"><span className="aval-foto av-texto">{String(motoboy.nome ?? "?").trim().split(/\s+/).map((x: string) => x[0]).slice(0, 2).join("").toUpperCase()}</span><span><b className="h3" style={{ display: "block" }}>{String(motoboy.nome ?? "").split(" ")[0]}, seu entregador</b><small className="mut">Entrega, cuidado e educação</small></span></div>
                      <Estrelas value={notaMotoboy} onChange={setNotaMotoboy} rotulo="Nota do entregador" />
                    </div>
                  )}
                  <label className="campo" style={{ marginTop: 4 }}><span>Comentário (opcional)</span>
                    <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3} placeholder="Conte como foi" /></label>
                  {podeReembolso && <button style={{ display: "block", margin: "14px auto 0", color: "var(--pimenta)", fontWeight: 700, fontSize: 14.5 }} onClick={() => { setModalAvaliacao(false); setReembolsoModal(true) }}>Algo deu errado? Pedir reembolso</button>}
                  <a style={{ display: "block", textAlign: "center", margin: "12px auto 4px", color: "var(--suave)", fontWeight: 700, fontSize: 14.5 }} href={`/cliente/suporte?pedido=${pedido.codigo}`}>Falar com o suporte pelo chat</a>
                </>
              )}
            </div>
            <div className="rodape-fixo">
              {avaliacaoOk
                ? <button className="btn btn-p" onClick={() => setModalAvaliacao(false)}>Fechar</button>
                : <button className="btn btn-p" onClick={enviarAvaliacao} disabled={enviandoAval || notaLoja === 0}>{enviandoAval ? "Enviando…" : notaLoja === 0 ? "Dê uma nota pra loja" : "Enviar avaliação"}</button>}
            </div>
          </div>
        </div>
      )}

      {/* Cancelar */}
      {cancelModal && (
        <div className="cn-veu on" onClick={() => setCancelModal(false)}>
          <div className="cn folha on" onClick={e => e.stopPropagation()} style={{ padding: "22px 20px calc(env(safe-area-inset-bottom,0px) + 22px)" }}>
            <div className="h2">Cancelar o pedido?</div>
            <p className="mut" style={{ margin: "8px 0 20px", lineHeight: 1.5 }}>Se você pagou por Pix ou cartão, o valor volta automaticamente em até 10 dias úteis.</p>
            <button className="btn btn-p" onClick={cancelarPedido} disabled={cancelando}>{cancelando ? "Cancelando…" : "Sim, cancelar"}</button>
            <button className="btn btn-s" style={{ marginTop: 10 }} onClick={() => setCancelModal(false)}>Manter o pedido</button>
          </div>
        </div>
      )}

      {/* Reembolso */}
      {reembolsoModal && (
        <div className="cn-veu on" onClick={() => setReembolsoModal(false)}>
          <div className="cn folha on" onClick={e => e.stopPropagation()}>
            <div className="folha-rolagem" style={{ padding: "18px 16px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span className="h2">Pedir reembolso</span>
                <button className="voltar" onClick={() => setReembolsoModal(false)} aria-label="Fechar">✕</button>
              </div>
              <span className="h3">O que aconteceu? *</span>
              <div className="motivos" style={{ justifyContent: "flex-start" }}>{MOTIVOS_REEMBOLSO.map(m => <button key={m} className="chip" aria-pressed={reembolsoMotivo === m} onClick={() => setReembolsoMotivo(m)}>{m}</button>)}</div>
              <label className="campo" style={{ marginTop: 6 }}><span>Conte mais (opcional)</span>
                <textarea value={reembolsoDesc} onChange={e => setReembolsoDesc(e.target.value)} rows={3} placeholder="Descreva o problema" /></label>
              <label className={`anexar ${reembolsoFoto ? "ok" : ""}`} style={{ marginTop: 14 }}>
                <span style={{ fontSize: 22 }}>{reembolsoFoto ? "✅" : "📷"}</span>
                <span style={{ flex: 1, minWidth: 0 }}><b>{reembolsoFoto ? reembolsoFoto.name : "Anexar foto ou vídeo *"}</b><small className="mut" style={{ display: "block" }}>Mostre o problema com clareza</small></span>
                <input type="file" accept="image/*,video/*" onChange={e => setReembolsoFoto(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
              </label>
            </div>
            <div className="rodape-fixo">
              <button className="btn btn-p" onClick={enviarReembolso} disabled={!reembolsoMotivo || !reembolsoFoto || envReembolso}>{envReembolso ? "Enviando…" : "Enviar pedido de reembolso"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
