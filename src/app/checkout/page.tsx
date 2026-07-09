"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useCart } from "@/lib/cart"
import { useClienteAuth } from "@/lib/auth-cliente"
import { useIsMobile } from "@/lib/use-mobile"
import type { FormaPagamento } from "@/types"

// Leaflet não funciona no SSR — importa só no client
const MapaPicker = dynamic(() => import("@/components/MapaPicker"), { ssr: false })

const PAGAMENTOS: { value: FormaPagamento; label: string; platforms: ("ios"|"android"|"other")[]; breve?: boolean }[] = [
  { value: "pix",        label: "PIX",        platforms: ["ios","android","other"] },
  { value: "cartao",     label: "Cartão",     platforms: ["ios","android","other"] },
  { value: "google_pay", label: "Google Pay", platforms: ["android"] },
]

// Logo PIX — diamante arredondado + 2 lentes diagonais brancas (padrão oficial BCB)
function PixLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <defs>
        <clipPath id="pix-clip">
          <rect x="7" y="7" width="22" height="22" rx="5" transform="rotate(45 18 18)"/>
        </clipPath>
      </defs>
      <rect x="7" y="7" width="22" height="22" rx="5" transform="rotate(45 18 18)" fill="#32BCAD"/>
      {/* Lente diagonal NW→SE (cria pétalas N e S) */}
      <path d="M10,10 C22,8 28,14 26,26 C14,28 8,22 10,10 Z"
            fill="white" clipPath="url(#pix-clip)"/>
      {/* Lente diagonal NE→SW (cria pétalas L e O) */}
      <path d="M26,10 C28,22 22,28 10,26 C8,14 14,8 26,10 Z"
            fill="white" clipPath="url(#pix-clip)"/>
    </svg>
  )
}

// Cartão com chip dourado + Mastercard
function CardLogo() {
  return (
    <svg width="42" height="28" viewBox="0 0 84 56" fill="none">
      <rect width="84" height="56" rx="7" fill="#1A1F36"/>
      <rect y="14" width="84" height="11" fill="#2D3561"/>
      <rect x="7" y="6" width="14" height="10" rx="2" fill="#F5B800"/>
      <line x1="7" y1="11" x2="21" y2="11" stroke="#C49800" strokeWidth="0.8"/>
      <line x1="14" y1="6" x2="14" y2="16" stroke="#C49800" strokeWidth="0.8"/>
      <circle cx="57" cy="39" r="9" fill="#EB001B"/>
      <circle cx="68" cy="39" r="9" fill="#F79E1B"/>
      <path d="M62.5 32.5 A9 9 0 0 1 62.5 45.5 A9 9 0 0 1 62.5 32.5" fill="#FF5F00"/>
    </svg>
  )
}

// Google Pay: G oficial (paths do "Sign in with Google") + "Pay" em HTML
function GooglePayLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#3C4043", fontFamily: "Arial, sans-serif" }}>Pay</span>
    </div>
  )
}

function PaymentIcon({ method }: { method: FormaPagamento }) {
  if (method === "pix")        return <PixLogo />
  if (method === "cartao")     return <CardLogo />
  if (method === "google_pay") return <GooglePayLogo />
  return null
}

// Aragoiânia, GO — coordenadas padrão quando GPS não está disponível
const LAT_DEFAULT = -17.6547
const LNG_DEFAULT = -49.4378


interface GeoResult {
  rua: string; bairro: string; cidade: string; lat: number; lng: number
}

async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  const ctrl = new AbortController()
  const tid  = setTimeout(() => ctrl.abort(), 5000)
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-BR`,
    { headers: { "User-Agent": "AragoDelivery/1.0" }, signal: ctrl.signal }
  )
  clearTimeout(tid)
  const d = await res.json()
  const a = d.address ?? {}
  return {
    rua:    a.road || a.pedestrian || a.path || "",
    bairro: a.suburb || a.neighbourhood || a.city_district || a.quarter || "",
    cidade: a.city || a.town || a.village || a.municipality || "",
    lat, lng,
  }
}

// ── Componente de endereço com mapa ────────────────────────────────────────

function EnderecoMapa({ onResult }: {
  onResult: (geo: GeoResult, numero: string, complemento: string) => void
}) {
  const [lat, setLat]             = useState(LAT_DEFAULT)
  const [lng, setLng]             = useState(LNG_DEFAULT)
  const [geo, setGeo]             = useState<GeoResult | null>(null)
  const [gpsStatus, setGpsStatus] = useState<"loading" | "ok" | "denied">("loading")
  const [geocodando, setGeocodando] = useState(false)
  const [numero, setNumero]         = useState("")
  const [complemento, setComplemento] = useState("")
  const geocodingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tenta GPS ao montar
  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus("denied"); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setGpsStatus("ok")
        geocodePonto(pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        setGpsStatus("denied")
        geocodePonto(LAT_DEFAULT, LNG_DEFAULT)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    )
  }, [])

  // Notifica pai quando geo/numero/complemento mudam
  useEffect(() => {
    if (geo) onResult(geo, numero, complemento)
  }, [geo, numero, complemento])

  async function geocodePonto(lt: number, ln: number) {
    setGeocodando(true)
    try {
      const result = await reverseGeocode(lt, ln)
      setGeo(result)
    } catch {}
    setGeocodando(false)
  }

  function handleMapMove(newLat: number, newLng: number) {
    setLat(newLat)
    setLng(newLng)
    // Debounce leve para não geocodificar a cada pixel arrastado
    if (geocodingTimer.current) clearTimeout(geocodingTimer.current)
    geocodingTimer.current = setTimeout(() => geocodePonto(newLat, newLng), 600)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Status GPS — só mostra enquanto detecta */}
      {gpsStatus === "loading" && (
        <div style={{ background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 12, padding: "10px 14px" }}>
          <p style={{ color: "#6B7280", fontSize: 13 }}>📡 Detectando sua localização...</p>
        </div>
      )}

      {/* Mapa */}
      <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #E5E7EB", position: "relative" }}>
        <MapaPicker lat={lat} lng={lng} onMove={handleMapMove} />
        <div style={{ position: "absolute", bottom: 8, left: 8, right: 8, zIndex: 999, pointerEvents: "none" }}>
          <div style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderRadius: 10, padding: "7px 12px" }}>
            {geocodando ? (
              <p style={{ color: "#6B7280", fontSize: 12 }}>📍 Identificando endereço...</p>
            ) : geo?.rua ? (
              <p style={{ color: "#111827", fontSize: 12, fontWeight: 600 }}>
                📍 {geo.rua}{geo.bairro ? `, ${geo.bairro}` : ""}
              </p>
            ) : (
              <p style={{ color: "#6B7280", fontSize: 12 }}>📍 Mova o pin para o local de entrega</p>
            )}
          </div>
        </div>
      </div>

      <p style={{ color: "#9CA3AF", fontSize: 11, textAlign: "center" }}>
        Arraste o pin laranja ou toque no mapa para ajustar o local
      </p>

      {/* Número + Complemento */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <div>
          <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Número *</label>
          <input
            value={numero}
            onChange={e => setNumero(e.target.value)}
            placeholder="42"
            inputMode="numeric"
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
              background: "#F9FAFB",
              border: numero ? "1px solid rgba(34,197,94,0.4)" : "1px solid #E5E7EB",
              color: "#111827", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Complemento</label>
          <input
            value={complemento}
            onChange={e => setComplemento(e.target.value)}
            placeholder="Apto 3, casa dos fundos..."
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
              background: "#F9FAFB", border: "1px solid #E5E7EB",
              color: "#111827", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter()
  const { items, total, clear } = useCart()
  const { perfil, user } = useClienteAuth()
  const isMobile = useIsMobile()

  const [nome, setNome]           = useState("")
  const [telefone, setTelefone]   = useState("")
  const [cpf, setCpf]             = useState("")
  const [pagamento, setPagamento] = useState<FormaPagamento>("pix")
  const [obs, setObs]             = useState("")
  const [enviando, setEnviando]   = useState(false)
  const [pedidoCodigo, setPedidoCodigo] = useState<string | null>(null)
  const [pedidoId,     setPedidoId]     = useState<string | null>(null)
  const [erro, setErro]           = useState("")
  const [tipoEntrega, setTipoEntrega] = useState<"entrega" | "retirada">("entrega")

  const [cupomInput,   setCupomInput]   = useState("")
  const [cupomValido,  setCupomValido]  = useState<{ id: string; codigo: string; tipo: "percentual" | "fixo"; valor: number } | null>(null)
  const [cupomErro,    setCupomErro]    = useState("")
  const [validandoCupom, setValidandoCupom] = useState(false)
  const [plataforma, setPlataforma]    = useState<"ios"|"android"|"other">("other")

  // Cartão
  const [cardNumber,   setCardNumber]   = useState("")
  const [cardName,     setCardName]     = useState("")
  const [cardExpiry,   setCardExpiry]   = useState("")
  const [cardCvv,      setCardCvv]      = useState("")
  const [cardCpf,      setCardCpf]      = useState("")
  const [lgpdConsent,  setLgpdConsent]  = useState(false)
  const [salvarCartao, setSalvarCartao] = useState(false)
  const [cartaoSalvo,  setCartaoSalvo]  = useState<{ last4: string; nome: string; validade: string; token?: string } | null>(null)
  const [cardToken,    setCardToken]    = useState<string | null>(null)
  const [usarSalvo,    setUsarSalvo]    = useState(false)

  // PIX modal
  const [pixModal,     setPixModal]     = useState(false)
  const [pixQrcode,    setPixQrcode]    = useState("")
  const [pixCopiaECola,setPixCopiaECola]= useState("")
  const [pixCopiado,   setPixCopiado]   = useState(false)

  // Endereço salvo
  type EnderecoSalvo = { display: string; rua: string; numero: string; bairro: string; cidade: string; complemento: string; lat: number; lng: number }
  const [enderecoSalvo,    setEnderecoSalvo]    = useState<EnderecoSalvo | null>(null)
  const [editandoEndereco, setEditandoEndereco] = useState(false)
  // Coordenadas do cliente vindas do mapa (usadas quando não há endereço salvo)
  const [clienteCoords, setClienteCoords] = useState<{lat:number;lng:number}|null>(null)

  const geoRef = useRef<{ geo: GeoResult; numero: string; complemento: string } | null>(null)

  // Detecta plataforma para mostrar o método de pagamento correto
  useEffect(() => {
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(ua)) setPlataforma("ios")
    else if (/Android/.test(ua))     setPlataforma("android")
  }, [])

  // Carrega endereço salvo — localStorage primeiro, depois perfil do cadastro
  useEffect(() => {
    try {
      const raw = localStorage.getItem("arago_endereco_salvo")
      if (raw) {
        const addr: EnderecoSalvo = JSON.parse(raw)
        setEnderecoSalvo(addr)
        geoRef.current = {
          geo: { rua: addr.rua, bairro: addr.bairro, cidade: addr.cidade, lat: addr.lat, lng: addr.lng },
          numero: addr.numero,
          complemento: addr.complemento,
        }
      }
    } catch {}
  }, [])

  // Se não há endereço salvo mas o perfil tem endereço cadastrado, usa-o
  useEffect(() => {
    if (!perfil?.endereco_rua || enderecoSalvo) return
    const addr: EnderecoSalvo = {
      display: [perfil.endereco_rua, perfil.endereco_numero, perfil.endereco_bairro, perfil.endereco_cidade].filter(Boolean).join(", "),
      rua:         perfil.endereco_rua        ?? "",
      numero:      perfil.endereco_numero     ?? "",
      bairro:      perfil.endereco_bairro     ?? "",
      cidade:      perfil.endereco_cidade     ?? "",
      complemento: perfil.endereco_complemento ?? "",
      lat: 0, lng: 0,
    }
    setEnderecoSalvo(addr)
    geoRef.current = {
      geo: { rua: addr.rua, bairro: addr.bairro, cidade: addr.cidade, lat: 0, lng: 0 },
      numero: addr.numero,
      complemento: addr.complemento,
    }
  }, [perfil, enderecoSalvo])

  // Carrega cartão salvo — se tiver token, habilita pagamento sem re-digitar número
  useEffect(() => {
    try {
      const raw = localStorage.getItem("arago_cartao")
      if (raw) {
        const c = JSON.parse(raw)
        if (c?.last4 && c?.nome && c?.validade) {
          setCartaoSalvo(c)
          setCardName(c.nome)
          setCardExpiry(c.validade)
          if (c.token) { setCardToken(c.token); setUsarSalvo(true) }
        }
      }
    } catch {}
  }, [])

  // Pré-preenche do perfil do cliente logado (DB ou metadados Auth como fallback)
  useEffect(() => {
    if (perfil?.nome)     setNome(perfil.nome)
    if (perfil?.telefone) setTelefone(perfil.telefone)
    const cpfCarregado = perfil?.cpf || user?.user_metadata?.cpf
    if (cpfCarregado)     setCpf(cpfCarregado)
  }, [perfil, user])

  const loja_id    = items[0]?.loja_id ?? null
  const [lojaData, setLojaData] = useState<{ lat: number | null; lng: number | null; endereco: string; nome: string; taxa_entrega: number | null } | null>(null)

  useEffect(() => {
    if (!loja_id) return
    supabase.from("lojas").select("lat,lng,endereco,nome,taxa_entrega").eq("id", loja_id).single()
      .then(({ data }) => setLojaData(data as any))
  }, [loja_id])

  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  function calcularTaxa(): number {
    if (tipoEntrega === "retirada") return 0
    const base = lojaData?.taxa_entrega ?? 6.00
    const latL = lojaData?.lat, lngL = lojaData?.lng
    const latC = enderecoSalvo?.lat || clienteCoords?.lat
    const lngC = enderecoSalvo?.lng || clienteCoords?.lng
    if (!latL || !lngL || !latC || !lngC) return base
    const dist = haversineKm(latL, lngL, latC, lngC)
    if (dist <= 6) return base
    return Math.round((base + (dist - 6) * 1.00) * 100) / 100
  }

  // Polling PIX — verifica a cada 4s se o pagamento foi confirmado
  useEffect(() => {
    if (!pixModal || !pedidoId) return
    const interval = setInterval(async () => {
      const { data } = await supabase.from("pedidos").select("status").eq("id", pedidoId).single()
      if (data?.status && data.status !== "aguardando_pagamento") {
        clearInterval(interval)
        setPixModal(false)
        clear()
        router.push(`/pedido/${pedidoId}`)
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [pixModal, pedidoId]) // eslint-disable-line react-hooks/exhaustive-deps

  const taxa        = calcularTaxa()
  const subtotal    = total
  const desconto    = cupomValido
    ? cupomValido.tipo === "percentual"
      ? Math.round(subtotal * (cupomValido.valor / 100) * 100) / 100
      : Math.min(cupomValido.valor, subtotal)
    : 0
  const totalFinal  = Math.max(0, subtotal - desconto) + taxa

  async function aplicarCupom() {
    if (!cupomInput.trim()) return
    setValidandoCupom(true); setCupomErro(""); setCupomValido(null)
    const params = new URLSearchParams({
      codigo:   cupomInput.trim().toUpperCase(),
      subtotal: String(subtotal),
      ...(loja_id ? { loja_id } : {}),
    })
    const res  = await fetch(`/api/cupom/validar?${params}`)
    const json = await res.json()
    if (!res.ok) { setCupomErro(json.error ?? "Cupom inválido."); setValidandoCupom(false); return }
    setCupomValido(json); setValidandoCupom(false)
  }

  function fmtCardNumber(v: string) {
    return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim()
  }
  function fmtExpiry(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 4)
    return d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d
  }

  if (items.length === 0 && !pedidoCodigo) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <circle cx="36" cy="36" r="34" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="2"/>
          <path d="M 20 24 L 24 24 L 30 46 L 50 46 L 54 30 L 28 30" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <circle cx="31" cy="50" r="3" fill="#9CA3AF"/>
          <circle cx="47" cy="50" r="3" fill="#9CA3AF"/>
          <line x1="24" y1="24" x2="19" y2="20" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        <p style={{ color: "#6B7280", fontWeight: 600 }}>Seu carrinho está vazio</p>
        <Link href="/" style={{ color: "#DC2626", fontWeight: 700 }}>← Ver lojas</Link>
      </div>
    )
  }

  if (pedidoCodigo) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <style>{`
          @keyframes confettiFall0{0%{transform:translateY(-10px) rotate(0deg);opacity:1}100%{transform:translateY(80px) rotate(360deg);opacity:0}}
          @keyframes confettiFall1{0%{transform:translateY(-10px) rotate(0deg);opacity:1}100%{transform:translateY(70px) rotate(-270deg);opacity:0}}
          @keyframes confettiFall2{0%{transform:translateY(-8px) rotate(0deg);opacity:1}100%{transform:translateY(90px) rotate(400deg);opacity:0}}
          @keyframes confettiFall3{0%{transform:translateY(-12px) rotate(45deg);opacity:1}100%{transform:translateY(75px) rotate(-330deg);opacity:0}}
          @keyframes confettiFall4{0%{transform:translateY(-6px) rotate(20deg);opacity:1}100%{transform:translateY(85px) rotate(300deg);opacity:0}}
          @keyframes floatIcon{0%,100%{transform:translateY(0px) rotate(-5deg)}50%{transform:translateY(-8px) rotate(3deg)}}
          @keyframes successPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.3)}50%{box-shadow:0 0 0 12px rgba(220,38,38,0)}}
        `}</style>
        <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>

          {/* Ícone de celebração — confete + corneta ultrarrealista */}
          <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
            {/* Partículas de confete animadas */}
            {[
              { color: "#f97316", shape: "rect", x: -28, delay: "0s", dur: "2.2s", anim: 0 },
              { color: "#3b82f6", shape: "circle", x: 30, delay: "0.3s", dur: "2.5s", anim: 1 },
              { color: "#a855f7", shape: "rect", x: -42, delay: "0.6s", dur: "1.9s", anim: 2 },
              { color: "#ec4899", shape: "star", x: 48, delay: "0.1s", dur: "2.8s", anim: 3 },
              { color: "#22c55e", shape: "rect", x: 14, delay: "0.8s", dur: "2.1s", anim: 4 },
              { color: "#eab308", shape: "circle", x: -16, delay: "0.4s", dur: "2.4s", anim: 1 },
              { color: "#DC2626", shape: "rect", x: 38, delay: "0.9s", dur: "2.3s", anim: 0 },
            ].map((p, i) => (
              <div key={i} style={{
                position: "absolute", top: 0, left: "50%",
                marginLeft: p.x, marginTop: -18,
                animation: `confettiFall${p.anim} ${p.dur} ${p.delay} ease-in infinite`,
                pointerEvents: "none",
              }}>
                {p.shape === "rect" && <div style={{ width: 7, height: 10, background: p.color, borderRadius: 2, transform: `rotate(${i * 37}deg)` }} />}
                {p.shape === "circle" && <div style={{ width: 8, height: 8, background: p.color, borderRadius: "50%" }} />}
                {p.shape === "star" && (
                  <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,1 6.2,4 9.5,4 7,6 8,9 5,7 2,9 3,6 0.5,4 3.8,4" fill={p.color}/></svg>
                )}
              </div>
            ))}

            {/* Corneta de festa SVG ultrarrealista */}
            <div style={{ animation: "floatIcon 3s ease-in-out infinite", display: "inline-block" }}>
              <svg width="96" height="96" viewBox="0 0 100 100" fill="none">
                <defs>
                  <linearGradient id="coneGold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FFD700"/>
                    <stop offset="40%" stopColor="#FFC107"/>
                    <stop offset="100%" stopColor="#F59E0B"/>
                  </linearGradient>
                  <linearGradient id="coneShad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(0,0,0,0.18)"/>
                    <stop offset="100%" stopColor="transparent"/>
                  </linearGradient>
                  <linearGradient id="ribbonBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa"/>
                    <stop offset="100%" stopColor="#2563eb"/>
                  </linearGradient>
                  <linearGradient id="ribbonPink" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f472b6"/>
                    <stop offset="100%" stopColor="#db2777"/>
                  </linearGradient>
                </defs>

                {/* Sombra da corneta */}
                <ellipse cx="42" cy="88" rx="20" ry="5" fill="rgba(0,0,0,0.12)"/>

                {/* Corpo da corneta (cone) */}
                <path d="M 18 78 L 62 32 L 72 42 Z" fill="url(#coneGold)"/>
                {/* Listras da corneta */}
                <path d="M 24 72 L 58 38" stroke="#B8860B" strokeWidth="3.5" strokeLinecap="round" opacity="0.4"/>
                <path d="M 32 80 L 66 46" stroke="#B8860B" strokeWidth="3.5" strokeLinecap="round" opacity="0.4"/>
                <path d="M 40 85 L 70 55" stroke="#B8860B" strokeWidth="3" strokeLinecap="round" opacity="0.3"/>
                {/* Sombra lateral */}
                <path d="M 18 78 L 62 32 L 72 42 Z" fill="url(#coneShad)"/>
                {/* Boca da corneta */}
                <ellipse cx="67" cy="37" rx="8" ry="8" fill="#E6B800" stroke="#B8860B" strokeWidth="1.5"/>
                <ellipse cx="67" cy="37" rx="5" ry="5" fill="#FFD700"/>
                {/* Ponta da corneta */}
                <circle cx="19" cy="79" r="4" fill="#F59E0B" stroke="#D97706" strokeWidth="1"/>
                <circle cx="19" cy="79" r="2" fill="#FFD700"/>

                {/* Fitas saindo */}
                {/* Fita azul */}
                <path d="M 62 28 Q 50 15 58 5 Q 66 -2 72 8" stroke="url(#ribbonBlue)" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
                {/* Fita rosa */}
                <path d="M 68 32 Q 82 18 76 8 Q 70 0 80 5" stroke="url(#ribbonPink)" strokeWidth="3" fill="none" strokeLinecap="round"/>
                {/* Fita laranja */}
                <path d="M 72 38 Q 88 28 85 16 Q 83 8 92 12" stroke="#f97316" strokeWidth="2.5" fill="none" strokeLinecap="round"/>

                {/* Confetes explodindo da boca */}
                {/* Quadrado laranja */}
                <rect x="55" y="14" width="7" height="7" rx="1" fill="#f97316" transform="rotate(25 58 17)"/>
                {/* Círculo verde */}
                <circle cx="76" cy="16" r="4.5" fill="#22c55e"/>
                {/* Losango azul */}
                <rect x="82" y="22" width="6" height="6" rx="1" fill="#3b82f6" transform="rotate(45 85 25)"/>
                {/* Círculo rosa */}
                <circle cx="52" cy="8" r="3.5" fill="#ec4899"/>
                {/* Estrela amarela */}
                <polygon points="88,8 89.5,12.5 94,12.5 90.5,15 92,19.5 88,17 84,19.5 85.5,15 82,12.5 86.5,12.5" fill="#eab308"/>
                {/* Pontinhos de brilho */}
                <circle cx="46" cy="20" r="2" fill="white" opacity="0.9"/>
                <circle cx="79" cy="28" r="2" fill="white" opacity="0.8"/>
                <circle cx="60" cy="6" r="1.5" fill="white" opacity="0.7"/>
              </svg>
            </div>
          </div>

          <h1 style={{ color: "#111827", fontWeight: 900, fontSize: 26, marginBottom: 8 }}>Pedido realizado!</h1>
          <p style={{ color: "#6B7280", marginBottom: 28, fontSize: 15 }}>
            Aguarde a confirmação da loja.
          </p>

          {/* Card do código */}
          <div style={{
            background: "linear-gradient(135deg, rgba(220,38,38,0.05), rgba(220,38,38,0.08))",
            border: "1.5px solid rgba(220,38,38,0.2)", borderRadius: 20,
            padding: "22px 28px", marginBottom: 20,
            boxShadow: "0 4px 20px rgba(220,38,38,0.08)",
          }}>
            <p style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 600, letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>Código do pedido</p>
            <p style={{ color: "#DC2626", fontWeight: 900, fontSize: "clamp(28px, 9vw, 42px)", letterSpacing: "clamp(4px, 2vw, 10px)", lineHeight: 1, marginBottom: 8 }}>#{pedidoCodigo}</p>
            <div style={{ height: 1, background: "rgba(220,38,38,0.12)", marginBottom: 10 }} />
            <p style={{ color: "#D1D5DB", fontSize: 11 }}>Guarde este código para rastrear e confirmar a entrega</p>
          </div>

          {/* Botão acompanhar */}
          <Link href={`/pedido/${pedidoCodigo}`} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "15px 24px", borderRadius: 16, background: "#DC2626",
            color: "white", fontWeight: 800, textDecoration: "none", fontSize: 15, marginBottom: 10,
            boxShadow: "0 4px 16px rgba(220,38,38,0.35)",
            animation: "successPulse 2.5s ease-in-out infinite",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3" fill="white" stroke="none"/>
            </svg>
            Acompanhar pedido →
          </Link>

          {user && (
            <Link href="/cliente/perfil" style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "14px 24px", borderRadius: 16,
              background: "#ffffff", border: "1.5px solid #e5e7eb",
              color: "#374151", fontWeight: 700, textDecoration: "none", fontSize: 14, marginBottom: 10,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
              Ver meu perfil
            </Link>
          )}

          <Link href="/" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "14px 24px", borderRadius: 16,
            background: "#F9FAFB", border: "1.5px solid #e5e7eb",
            color: "#9CA3AF", fontWeight: 600, textDecoration: "none", fontSize: 14,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/>
              <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/>
              <line x1="12" y1="12" x2="12" y2="19"/>
            </svg>
            Fazer novo pedido
          </Link>
        </div>
      </div>
    )
  }

  async function processWalletPayment(total: number): Promise<boolean> {
    if (typeof window === "undefined" || !("PaymentRequest" in window)) {
      setErro("Google Pay requer Chrome com um cartão configurado na conta Google.")
      setEnviando(false)
      return false
    }
    try {
      const methods: PaymentMethodData[] = [{ supportedMethods: "https://google.com/pay", data: { environment: "PRODUCTION", apiVersion: 2, apiVersionMinor: 0, allowedPaymentMethods: [{ type: "CARD", parameters: { allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"], allowedCardNetworks: ["MASTERCARD", "VISA", "ELO"] } }], merchantInfo: { merchantName: "Chegô Delivery" } } }]

      const pr = new PaymentRequest(methods, {
        total: { label: "Chegô Delivery", amount: { currency: "BRL", value: total.toFixed(2) } },
      })

      const canMake = await pr.canMakePayment()
      if (!canMake) {
        setErro("Google Pay indisponível. Adicione um cartão na sua conta Google ou use PIX/Cartão.")
        setEnviando(false)
        return false
      }

      const response = await pr.show()
      await response.complete("success")
      return true
    } catch (err: any) {
      if (err?.name === "AbortError") { setEnviando(false); return false }
      setErro("Erro ao processar Google Pay. Use PIX ou Cartão.")
      setEnviando(false)
      return false
    }
  }

  async function confirmar() {
    if (!nome.trim()) { setErro("Informe seu nome"); return }
    const telDigits = telefone.replace(/\D/g, "")
    if (telDigits.length < 8) { setErro("Informe um telefone válido (com DDD)"); return }

    // CPF: estado local → perfil DB → metadados auth → busca no banco
    let cpfFinal = cpf.replace(/\D/g, "")
    if (cpfFinal.length !== 11) cpfFinal = (perfil?.cpf ?? "").replace(/\D/g, "")
    if (cpfFinal.length !== 11) cpfFinal = (user?.user_metadata?.cpf ?? "").replace(/\D/g, "")
    if (cpfFinal.length !== 11 && user?.id) {
      const { data: dbCliente } = await supabase.from("clientes").select("cpf").eq("id", user.id).maybeSingle()
      if (dbCliente?.cpf) { cpfFinal = dbCliente.cpf.replace(/\D/g, ""); setCpf(dbCliente.cpf) }
    }

    // PIX exige CPF (obrigação Asaas/Banco Central para pagamentos PIX)
    if (pagamento === "pix" && cpfFinal.length !== 11) {
      setErro("Informe seu CPF para pagar via PIX (obrigatório pelo Banco Central)")
      return
    }

    let enderecoFinal = ""
    let latFinal: number | null = null
    let lngFinal: number | null = null

    if (tipoEntrega === "retirada") {
      enderecoFinal = `🏪 Retirada na loja — ${lojaData?.endereco ?? ""}`
    } else {
      const geo    = geoRef.current?.geo
      const numero = geoRef.current?.numero ?? ""
      const comp   = geoRef.current?.complemento ?? ""

      if (!numero.trim()) { setErro("Informe o número da sua casa/apto no campo Número"); return }

      if (geo && geo.lat !== 0) {
        enderecoFinal = [
          [geo.rua, numero.trim()].filter(Boolean).join(", "),
          comp.trim(),
          [geo.bairro, geo.cidade].filter(Boolean).join(", "),
        ].filter(Boolean).join(" — ")
      } else {
        enderecoFinal = `Nº ${numero.trim()}${comp ? `, ${comp}` : ""}`
      }
      latFinal = geo?.lat && geo.lat !== 0 ? geo.lat : null
      lngFinal = geo?.lng && geo.lng !== 0 ? geo.lng : null
    }

    if (!loja_id) { setErro("Erro: loja não identificada"); return }
    setErro("")
    setEnviando(true)

    // Carteiras digitais: tenta abrir UI nativa antes de salvar o pedido
    if (pagamento === "google_pay") {
      const walletOk = await processWalletPayment(totalFinal)
      if (!walletOk) { setEnviando(false); return }
    }

    const obsCompleta = [
      `Cliente: ${nome.trim()}`,
      `Tel: ${telefone.trim()}`,
      tipoEntrega === "retirada" ? "🏪 RETIRADA NA LOJA" : "",
      obs.trim(),
    ].filter(Boolean).join(" | ")

    // Cria pedido via API server-side — preços validados no servidor, nunca no cliente
    const criarRes = await fetch("/api/pedido/criar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loja_id,
        cliente_id:       user?.id ?? null,
        items:            items.map(i => ({ produto_id: i.produto_id ?? i.id, quantidade: i.quantidade, observacao: i.observacao ?? "", adicionais: i.adicionais ?? [] })),
        forma_pagamento:  pagamento,
        tipo_entrega:     tipoEntrega,
        endereco_entrega: enderecoFinal,
        lat_entrega:      latFinal,
        lng_entrega:      lngFinal,
        observacao:       obsCompleta,
        cupom_codigo:     cupomValido?.codigo ?? null,
        nome_cliente:     nome.trim() || null,
        telefone_cliente: telefone.trim() || null,
        email_cliente:    user?.email ?? null,
        cpf_cliente:      cpfFinal || null,
      }),
    }).then(r => r.json())

    if (criarRes.error || !criarRes.pedido_id) {
      setErro(criarRes.error ?? "Erro ao criar pedido. Tente novamente.")
      setEnviando(false)
      return
    }

    const { pedido_id: pedidoIdNovo, codigo, total: totalServidor, cliente_push_token } = criarRes
    const pedido = { id: pedidoIdNovo }
    if (cliente_push_token) localStorage.setItem(`arago_tkn_${codigo}`, cliente_push_token)

    // ─── PIX: gera QR code e abre modal ──────────────────────────────────
    if (pagamento === "pix") {
      const pixRes = await fetch("/api/pagamento/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido_id:   pedido.id,
          valor:       totalServidor,
          nome:        nome.trim(),
          telefone:    telefone.trim(),
          email:       user?.email,
          cpf_cliente: cpfFinal || null,
          loja_id,
        }),
      }).then(r => r.json())

      if (pixRes.error) {
        setErro("Erro ao gerar PIX: " + pixRes.error)
        setEnviando(false)
        return
      }

      setPedidoId(pedido.id)
      localStorage.setItem("arago_pedido_ativo", JSON.stringify({ codigo, id: pedido.id }))
      setPixQrcode(pixRes.qrcode)
      setPixCopiaECola(pixRes.copia_cola)
      setPixModal(true)
      setEnviando(false)
      return
    }

    // ─── Cartão: processa via Asaas ──────────────────────────────────────
    if (pagamento === "cartao") {
      const cpfCartao = (usarSalvo && cardToken) ? (cardCpf || cpfFinal) : cardCpf
      if (cpfCartao.replace(/\D/g, "").length !== 11) {
        setErro("Informe o CPF do titular do cartão")
        setEnviando(false)
        return
      }

      let cartaoRes: any

      if (usarSalvo && cardToken) {
        // Pagamento com token — não precisa de número completo
        cartaoRes = await fetch("/api/pagamento/cartao-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pedido_id:      pedido.id,
            valor:          totalServidor,
            nome:           nome.trim(),
            telefone:       telefone.trim(),
            email:          user?.email || `cliente_${cpfCartao.replace(/\D/g, "")}@chegodelivery.com`,
            cpf:            cpfCartao,
            cep:            ((enderecoSalvo as any)?.cep || "75370000").replace(/\D/g, ""),
            numero_endereco:(enderecoSalvo as any)?.numero || geoRef.current?.numero || "S/N",
            token:          cardToken,
            loja_id,
          }),
        }).then(r => r.json())
      } else {
        if (!cardCvv) { setErro("Informe o CVV do cartão"); setEnviando(false); return }
        const [mes, anoShort] = cardExpiry.split("/")
        cartaoRes = await fetch("/api/pagamento/cartao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pedido_id:      pedido.id,
            valor:          totalServidor,
            nome:           nome.trim(),
            telefone:       telefone.trim(),
            email:          user?.email || `cliente_${cpfCartao.replace(/\D/g, "")}@chegodelivery.com`,
            cpf:            cpfCartao,
            cep:            ((enderecoSalvo as any)?.cep || (geoRef.current as any)?.cep || "75370000").replace(/\D/g, ""),
            numero_endereco:(enderecoSalvo as any)?.numero || geoRef.current?.numero || "S/N",
            card: {
              numero: cardNumber,
              nome:   cardName,
              mes,
              ano:    (anoShort?.length === 2 ? "20" : "") + anoShort,
              cvv:    cardCvv,
            },
            loja_id,
          }),
        }).then(r => r.json())
      }

      if (cartaoRes.error) {
        setErro(cartaoRes.error)
        setEnviando(false)
        return
      }

      // Atualiza token se Asaas retornou um novo
      if (cartaoRes.cardToken) setCardToken(cartaoRes.cardToken)

      // Se Asaas retornou PENDING (análise antifraude), aguarda confirmação por até 30s
      if (cartaoRes.aguardando) {
        let confirmado = false
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 3000))
          const verificar = await fetch("/api/pagamento/verificar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pedido_id: pedido.id }),
          }).then(r => r.json()).catch(() => ({}))
          if (verificar.confirmado) { confirmado = true; break }
          if (verificar.status === "cancelado") {
            setErro("Pagamento recusado. Verifique os dados do cartão e tente novamente.")
            setEnviando(false)
            return
          }
        }
        if (!confirmado) {
          router.push(`/pedido/${codigo}`)
          return
        }
      }
    }

    if (tipoEntrega === "entrega" && geoRef.current?.geo?.rua) {
      const g   = geoRef.current.geo
      const num = geoRef.current.numero
      const cmp = geoRef.current.complemento
      const addr = [g.rua, num, g.bairro].filter(Boolean).join(", ")
      localStorage.setItem("arago_last_address", addr)
      localStorage.setItem("arago_endereco_salvo", JSON.stringify({
        display: enderecoFinal,
        rua: g.rua, numero: num, bairro: g.bairro,
        cidade: g.cidade, complemento: cmp,
        lat: g.lat, lng: g.lng,
      }))
    }

    // Salva cartão (sem CVV, com token se disponível) se LGPD consentido
    if (pagamento === "cartao" && salvarCartao && lgpdConsent) {
      const digits = cardNumber.replace(/\D/g, "")
      const last4  = digits.length >= 4 ? digits.slice(-4) : cartaoSalvo?.last4 ?? ""
      if (last4) {
        localStorage.setItem("arago_cartao", JSON.stringify({
          last4,
          nome:    (cardName || cartaoSalvo?.nome || "").trim(),
          validade: cardExpiry || cartaoSalvo?.validade || "",
          token:   cardToken ?? undefined,
        }))
      }
    }
    // Dispara push para o lojista
    try {
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send-loja",
          loja_id,
          pedido_id: pedido.id,
          codigo,
          nome_cliente: nome.trim() || "Cliente",
          total: totalFinal,
          qtd_itens: items.reduce((s, i) => s + i.quantidade, 0),
        }),
      })
    } catch {}

    clear()
    setPedidoCodigo(codigo)
    setPedidoId(pedido.id)
    setEnviando(false)
    // Salva referência do pedido ativo para o cliente conseguir voltar ao rastreamento
    localStorage.setItem("arago_pedido_ativo", JSON.stringify({ codigo, id: pedido.id }))
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", overflowX: "hidden" }}>
      {/* Navbar */}
      <nav style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#6B7280", fontSize: 20, cursor: "pointer" }}>←</button>
          <p style={{ color: "#111827", fontWeight: 800, fontSize: 16, flex: 1 }}>Finalizar pedido</p>
          {user ? (
            <Link href="/cliente/perfil" style={{ color: "#DC2626", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>👤 Perfil</Link>
          ) : (
            <Link href="/cliente/entrar" style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Entrar</Link>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Toggle Retirada / Entrega */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "18px" }}>
          <p style={{ color: "#6B7280", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Como você quer receber?</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            {([
              { value: "entrega", label: "🛵 Receber em casa", sub: "Motoboy leva até você" },
              { value: "retirada", label: "🏪 Retirar na loja", sub: "Você busca no local · Grátis" },
            ] as const).map(opt => (
              <button key={opt.value} onClick={() => setTipoEntrega(opt.value)} style={{
                padding: "12px", borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                background: tipoEntrega === opt.value ? "rgba(220,38,38,0.08)" : "#F9FAFB",
                border: tipoEntrega === opt.value ? "1px solid rgba(220,38,38,0.4)" : "1px solid #E5E7EB",
              }}>
                <p style={{ color: tipoEntrega === opt.value ? "#DC2626" : "#111827", fontWeight: 700, fontSize: 13 }}>{opt.label}</p>
                <p style={{ color: tipoEntrega === opt.value ? "rgba(220,38,38,0.7)" : "#6B7280", fontSize: 11, marginTop: 3 }}>{opt.sub}</p>
              </button>
            ))}
          </div>
          {tipoEntrega === "retirada" && lojaData?.endereco && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.2)" }}>
              <p style={{ color: "#6B7280", fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Endereço da loja</p>
              <p style={{ color: "#111827", fontSize: 13, fontWeight: 600 }}>📍 {lojaData.endereco}</p>
            </div>
          )}
        </div>

        {/* Resumo */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6" }}>
            <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>🛒 Resumo do pedido</p>
            {items[0] && <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>{items[0].loja_nome}</p>}
          </div>
          <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map(i => (
              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0, flex: 1 }}>
                  <span style={{ background: "rgba(220,38,38,0.10)", color: "#DC2626", fontWeight: 700, fontSize: 12, padding: "2px 8px", borderRadius: 6, flexShrink: 0 }}>
                    {i.quantidade}×
                  </span>
                  <span style={{ color: "#374151", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.nome}</span>
                </div>
                <span style={{ color: "#6B7280", fontSize: 14, flexShrink: 0 }}>R$ {(i.preco * i.quantidade).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "12px 18px", borderTop: "1px solid #F3F4F6", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#9CA3AF" }}>
              <span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#9CA3AF" }}>
              <span>{tipoEntrega === "retirada" ? "Taxa de entrega" : "Taxa de entrega"}</span>
              <span style={{ color: taxa === 0 ? "#22c55e" : undefined }}>
                {tipoEntrega === "retirada" ? "🏪 Retirada · Grátis" : taxa === 0 ? "Grátis" : `R$ ${taxa.toFixed(2)}`}
              </span>
            </div>
            {desconto > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#22c55e" }}>
                <span>🎟️ Cupom {cupomValido?.codigo}</span>
                <span>− R$ {desconto.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: "#111827", marginTop: 4 }}>
              <span>Total</span><span>R$ {totalFinal.toFixed(2)}</span>
            </div>
          </div>

          {/* Cupom */}
          <div style={{ padding: "14px 18px", borderTop: "1px solid #F3F4F6" }}>
            {cupomValido ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <p style={{ color: "#22c55e", fontWeight: 700, fontSize: 13 }}>
                  🎟️ {cupomValido.codigo} — {cupomValido.tipo === "percentual" ? `${cupomValido.valor}% de desconto` : `R$ ${cupomValido.valor.toFixed(2)} de desconto`}
                </p>
                <button onClick={() => { setCupomValido(null); setCupomInput("") }} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={cupomInput}
                  onChange={e => { setCupomInput(e.target.value.toUpperCase()); setCupomErro("") }}
                  onKeyDown={e => e.key === "Enter" && aplicarCupom()}
                  placeholder="Código do cupom"
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 10, fontSize: 14, fontFamily: "monospace", letterSpacing: 1,
                    background: "#F9FAFB", border: cupomErro ? "1px solid rgba(239,68,68,0.4)" : "1px solid #E5E7EB",
                    color: "#111827", outline: "none",
                  }}
                />
                <button onClick={aplicarCupom} disabled={!cupomInput.trim() || validandoCupom} style={{
                  padding: "10px 16px", borderRadius: 10, border: "1px solid #E5E7EB",
                  background: cupomInput.trim() ? "rgba(220,38,38,0.08)" : "#F5F5F5",
                  color: cupomInput.trim() ? "#DC2626" : "#9CA3AF",
                  fontWeight: 700, fontSize: 13, cursor: cupomInput.trim() ? "pointer" : "default",
                }}>
                  {validandoCupom ? "..." : "Aplicar"}
                </button>
              </div>
            )}
            {cupomErro && <p style={{ color: "#EF4444", fontSize: 12, marginTop: 6, fontWeight: 600 }}>{cupomErro}</p>}
          </div>
        </div>

        {/* Dados */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "18px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>📋 Seus dados</p>
            {!user && (
              <Link href="/cliente/entrar" style={{ color: "#DC2626", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                Entrar para salvar dados →
              </Link>
            )}
          </div>

          {user && (nome || perfil?.nome) ? (
            /* Usuário logado — mostra dados do perfil, sem redigitar */
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 16px", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(220,38,38,0.08)", border: "2px solid rgba(220,38,38,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {user.user_metadata?.avatar_url
                  ? <img src={user.user_metadata.avatar_url} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>{nome || perfil?.nome}</p>
                <p style={{ color: "#9CA3AF", fontSize: 12 }}>{telefone || perfil?.telefone || user.email}</p>
              </div>
              <Link href="/cliente/alterar-dados" style={{ color: "#DC2626", fontSize: 12, fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>
                Editar
              </Link>
            </div>
          ) : (
            /* Não logado — pede os dados */
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Seu nome *</label>
                  <input
                    value={nome} onChange={e => setNome(e.target.value)}
                    placeholder="João Silva"
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 16, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#111827", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    WhatsApp *
                  </label>
                  <input
                    value={telefone} onChange={e => setTelefone(e.target.value)}
                    placeholder="(64) 9 9999-1234" inputMode="tel"
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 16, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#111827", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>
              {/* CPF: oculta quando já está no perfil OU nos metadados auth */}
              {!(user && (perfil?.cpf || user?.user_metadata?.cpf)) && (
                <div>
                  <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    CPF{pagamento === "pix"
                      ? <span style={{ color: "#DC2626", fontWeight: 600 }}> * obrigatório para PIX</span>
                      : <span style={{ color: "#9CA3AF", fontWeight: 400 }}> (opcional)</span>
                    }
                  </label>
                  <input
                    value={cpf} onChange={e => setCpf(e.target.value)}
                    placeholder="000.000.000-00" inputMode="numeric" maxLength={14}
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 16, background: "#F9FAFB", border: `1px solid ${pagamento === "pix" && !cpf ? "#FCA5A5" : "#E5E7EB"}`, color: "#111827", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Endereço — só para entrega */}
          {tipoEntrega === "entrega" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ color: "#6B7280", fontSize: 12, fontWeight: 600 }}>📍 Local de entrega *</label>
                {enderecoSalvo && !editandoEndereco && (
                  <button
                    onClick={() => setEditandoEndereco(true)}
                    style={{ background: "none", border: "none", color: "#DC2626", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                    Editar
                  </button>
                )}
              </div>

              {enderecoSalvo && !editandoEndereco ? (
                /* Card do endereço salvo */
                <div style={{
                  background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12,
                  padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 10,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "#111827", fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
                      {enderecoSalvo.rua}{enderecoSalvo.numero ? `, ${enderecoSalvo.numero}` : ""}
                    </p>
                    <p style={{ color: "#6B7280", fontSize: 12 }}>
                      {[enderecoSalvo.complemento, enderecoSalvo.bairro, enderecoSalvo.cidade].filter(Boolean).join(" · ")}
                    </p>
                    <p style={{ color: "#22c55e", fontSize: 11, fontWeight: 600, marginTop: 4 }}>
                      ✓ Endereço salvo
                    </p>
                  </div>
                </div>
              ) : (
                /* Mapa completo */
                <EnderecoMapa
                  onResult={(geo, numero, complemento) => {
                    geoRef.current = { geo, numero, complemento }
                    if (geo.lat && geo.lng) setClienteCoords({ lat: geo.lat, lng: geo.lng })
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Pagamento */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <p style={{ color: "#111827", fontWeight: 700, fontSize: 14, padding: "16px 18px 12px" }}>Forma de pagamento</p>

          {/* Lista vertical estilo iFood */}
          {PAGAMENTOS.filter(p => p.platforms.includes(plataforma)).map((p, idx, arr) => {
            const ativo = pagamento === p.value
            const isLast = idx === arr.length - 1
            return (
              <button key={p.value} onClick={() => { if (!p.breve) setPagamento(p.value) }} disabled={p.breve} style={{
                width: "100%", padding: "14px 18px",
                display: "flex", alignItems: "center", gap: 14,
                background: ativo ? "rgba(220,38,38,0.05)" : "transparent",
                border: "none",
                borderBottom: isLast ? "none" : "1px solid #F3F4F6",
                cursor: p.breve ? "default" : "pointer", textAlign: "left",
                opacity: p.breve ? 0.5 : 1,
              }}>
                {/* Ícone */}
                <div style={{
                  width: p.value === "google_pay" ? 72 : 44,
                  height: 44, borderRadius: 12, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: ativo ? "rgba(220,38,38,0.08)" : "#F9FAFB",
                  border: ativo ? "1.5px solid rgba(220,38,38,0.25)" : "1px solid #E5E7EB",
                  overflow: "hidden",
                  padding: p.value === "google_pay" ? "0 8px" : 0,
                }}>
                  <PaymentIcon method={p.value} />
                </div>

                {/* Texto */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <p style={{ color: ativo ? "#DC2626" : "#111827", fontWeight: 700, fontSize: 14 }}>{p.label}</p>
                    {p.breve && <span style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", background: "#F3F4F6", borderRadius: 6, padding: "2px 6px" }}>Em breve</span>}
                  </div>
                  <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>
                    {p.value === "pix"        && "Confirmação imediata · sem taxas"}
                    {p.value === "cartao"     && (cartaoSalvo ? `•••• ${cartaoSalvo.last4} — ${cartaoSalvo.nome}` : "Crédito ou débito")}
                    {p.value === "google_pay" && "Pague com sua conta Google"}
                  </p>
                </div>

                {/* Radio */}
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  border: ativo ? "6px solid #DC2626" : "2px solid #D1D5DB",
                  background: "white",
                }} />
              </button>
            )
          })}

          {/* Form de cartão — aparece quando selecionado */}
          {pagamento === "cartao" && (
            <div style={{ padding: "16px 18px", borderTop: "1px solid #F3F4F6", display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Cartão salvo com token — UI compacta */}
              {cartaoSalvo && usarSalvo && cardToken ? (
                <>
                  <div style={{ background: "#1E293B", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <CardLogo />
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>•••• •••• •••• {cartaoSalvo.last4}</p>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{cartaoSalvo.nome} · {cartaoSalvo.validade}</p>
                    </div>
                    <button onClick={() => { setCartaoSalvo(null); setCardToken(null); setUsarSalvo(false); localStorage.removeItem("arago_cartao") }}
                      style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                      Trocar
                    </button>
                  </div>
                  {/* CPF do titular só se ainda não tiver */}
                  {cardCpf.replace(/\D/g, "").length !== 11 && cpf.replace(/\D/g, "").length !== 11 && (perfil?.cpf ?? "").replace(/\D/g, "").length !== 11 && (
                    <div>
                      <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>CPF do titular *</label>
                      <input value={cardCpf} onChange={e => {
                        const d = e.target.value.replace(/\D/g, "").slice(0, 11)
                        setCardCpf(d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4").replace(/(\d{3})(\d{3})(\d{1,3})$/, "$1.$2.$3"))
                      }} placeholder="000.000.000-00" inputMode="numeric"
                        style={{ width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#111827", outline: "none", boxSizing: "border-box", fontFamily: "monospace" }} />
                    </div>
                  )}
                </>
              ) : (
              <>
                  {/* Número */}
                  <div>
                    <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Número do cartão *</label>
                    <input
                      value={cardNumber}
                      onChange={e => setCardNumber(fmtCardNumber(e.target.value))}
                      placeholder="0000 0000 0000 0000"
                      inputMode="numeric"
                      style={{ width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 15, letterSpacing: 2, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#111827", outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
                    />
                  </div>

                  {/* Nome */}
                  <div>
                    <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Nome no cartão *</label>
                    <input
                      value={cardName}
                      onChange={e => setCardName(e.target.value.toUpperCase())}
                      placeholder="JOÃO A SILVA"
                      autoCapitalize="characters"
                      style={{ width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#111827", outline: "none", boxSizing: "border-box", letterSpacing: 1 }}
                    />
                  </div>

                  {/* Validade + CVV */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Validade *</label>
                      <input
                        value={cardExpiry}
                        onChange={e => setCardExpiry(fmtExpiry(e.target.value))}
                        placeholder="MM/AA"
                        inputMode="numeric"
                        style={{ width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#111827", outline: "none", boxSizing: "border-box", fontFamily: "monospace", letterSpacing: 2 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>CVV *</label>
                      <input
                        value={cardCvv}
                        onChange={e => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="•••"
                        type="password"
                        inputMode="numeric"
                        style={{ width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#111827", outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {/* CPF do titular */}
                  <div>
                    <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>CPF do titular *</label>
                    <input
                      value={cardCpf}
                      onChange={e => {
                        const d = e.target.value.replace(/\D/g, "").slice(0, 11)
                        setCardCpf(d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4").replace(/(\d{3})(\d{3})(\d{1,3})$/, "$1.$2.$3"))
                      }}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      style={{ width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#111827", outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
                    />
                  </div>

                  {/* LGPD */}
                  <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", padding: "12px 14px", borderRadius: 10, background: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.12)" }}>
                    <input
                      type="checkbox"
                      checked={lgpdConsent}
                      onChange={e => { setLgpdConsent(e.target.checked); if (!e.target.checked) setSalvarCartao(false) }}
                      style={{ width: 16, height: 16, marginTop: 2, accentColor: "#2563EB", flexShrink: 0 }}
                    />
                    <span style={{ color: "#374151", fontSize: 12, lineHeight: 1.5 }}>
                      Autorizo o armazenamento seguro dos dados do cartão para compras futuras, em conformidade com a <strong>LGPD</strong>. O CVV nunca é armazenado.
                    </span>
                  </label>

                  {/* Salvar */}
                  {lgpdConsent && (
                    <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={salvarCartao}
                        onChange={e => setSalvarCartao(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: "#DC2626" }}
                      />
                      <span style={{ color: "#374151", fontSize: 13, fontWeight: 600 }}>Salvar cartão para compras futuras</span>
                    </label>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Observações */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "18px 18px" }}>
          <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>💬 Observações (opcional)</label>
          <textarea
            value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Sem cebola, capricha no molho..."
            rows={3}
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 13, resize: "none",
              background: "#F9FAFB", border: "1px solid #E5E7EB",
              color: "#111827", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {erro && (
          <p style={{ color: "#EF4444", fontSize: 13, fontWeight: 600, textAlign: "center", padding: "10px 16px", background: "rgba(239,68,68,0.08)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.15)" }}>{erro}</p>
        )}

        <button onClick={confirmar} disabled={enviando} style={{
          width: "100%", padding: "16px", borderRadius: 14, border: "none",
          cursor: enviando ? "not-allowed" : "pointer",
          background: enviando ? "rgba(220,38,38,0.5)" : "#DC2626",
          color: "white", fontWeight: 800, fontSize: 16,
        }}>
          {enviando ? "Enviando..." : `✓ Confirmar pedido · R$ ${totalFinal.toFixed(2)}`}
        </button>
      </div>

      {/* ═══ MODAL PIX ═══════════════════════════════════════════════════ */}
      {pixModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "28px 24px 40px", width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            {/* Cabeçalho */}
            <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontWeight: 800, fontSize: 18, color: "#111827" }}>Pagar com PIX</p>
              <div style={{ background: "#4DD0C4", borderRadius: 8, padding: "4px 10px" }}>
                <p style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>R$ {totalFinal.toFixed(2)}</p>
              </div>
            </div>

            <p style={{ color: "#6B7280", fontSize: 13, textAlign: "center" }}>
              Escaneie o QR Code ou copie o código PIX.<br />O pagamento é confirmado automaticamente.
            </p>

            {/* QR Code */}
            {pixQrcode ? (
              <img
                src={`data:image/png;base64,${pixQrcode}`}
                alt="QR Code PIX"
                style={{ width: 220, height: 220, borderRadius: 12, border: "2px solid #E5E7EB" }}
              />
            ) : (
              <div style={{ width: 220, height: 220, borderRadius: 12, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#9CA3AF", fontSize: 13 }}>Gerando QR Code…</p>
              </div>
            )}

            {/* Copia e Cola */}
            {pixCopiaECola && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pixCopiaECola).then(() => {
                    setPixCopiado(true)
                    setTimeout(() => setPixCopiado(false), 3000)
                  })
                }}
                style={{
                  width: "100%", padding: "14px 16px", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 15,
                  background: pixCopiado ? "#16A34A" : "#111827", color: "#fff", border: "none", transition: "background 0.2s",
                }}
              >
                {pixCopiado ? "✓ Código copiado!" : "📋 Copiar código PIX"}
              </button>
            )}

            <p style={{ color: "#9CA3AF", fontSize: 12, textAlign: "center" }}>
              Aguardando confirmação do pagamento…
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
