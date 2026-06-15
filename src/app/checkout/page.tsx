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

const PAGAMENTOS: { value: FormaPagamento; label: string; platforms: ("ios"|"android"|"other")[] }[] = [
  { value: "pix",        label: "PIX",        platforms: ["ios","android","other"] },
  { value: "cartao",     label: "Cartão",     platforms: ["ios","android","other"] },
  { value: "apple_pay",  label: "Apple Pay",  platforms: ["ios","other"] },
  { value: "google_pay", label: "Google Pay", platforms: ["android","other"] },
]

function PixLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="pixg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4DD0C4"/>
          <stop offset="100%" stopColor="#1FAF9F"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#pixg)"/>
      {/* 4 quadrilateral "key" shapes forming the Pix cross-diamond */}
      <path d="M50 14 L37 27 L50 40 L63 27 Z" fill="white"/>
      <path d="M50 86 L63 73 L50 60 L37 73 Z" fill="white"/>
      <path d="M14 50 L27 37 L40 50 L27 63 Z" fill="white"/>
      <path d="M86 50 L73 63 L60 50 L73 37 Z" fill="white"/>
    </svg>
  )
}

function CardLogo() {
  return (
    <svg width="30" height="22" viewBox="0 0 120 88" fill="none">
      <rect width="120" height="88" rx="12" fill="#1E293B"/>
      <rect x="0" y="22" width="120" height="18" fill="#2563EB"/>
      <rect x="10" y="52" width="28" height="6" rx="3" fill="rgba(255,255,255,0.45)"/>
      <rect x="10" y="62" width="18" height="4" rx="2" fill="rgba(255,255,255,0.25)"/>
      <rect x="10" y="10" width="22" height="16" rx="3" fill="#F59E0B" opacity="0.9"/>
      <circle cx="96" cy="62" r="11" fill="#EB001B" opacity="0.85"/>
      <circle cx="109" cy="62" r="11" fill="#F79E1B" opacity="0.85"/>
    </svg>
  )
}

function PaymentIcon({ method }: { method: FormaPagamento }) {
  if (method === "pix")    return <PixLogo />
  if (method === "cartao") return <CardLogo />
  if (method === "apple_pay") return (
    <svg width="44" height="18" viewBox="0 0 165 67" fill="currentColor">
      <path d="M31.8 9.7c-1.8 2.1-4.7 3.8-7.6 3.5-.4-3 1.1-6.1 2.8-8 1.9-2.2 5-3.7 7.6-3.8.3 3.1-0.9 6.1-2.8 8.3zm2.7 4.3c-4.2-.2-7.8 2.4-9.8 2.4-2 0-5.1-2.3-8.4-2.2-4.3.1-8.3 2.5-10.5 6.4-4.5 7.8-1.2 19.3 3.2 25.6 2.1 3.1 4.7 6.6 8 6.5 3.2-.1 4.4-2.1 8.3-2.1 3.9 0 5 2.1 8.4 2 3.4-.1 5.6-3.1 7.7-6.2 2.4-3.5 3.4-6.9 3.5-7.1-.1-.1-6.7-2.6-6.7-10.2-.1-6.4 5.2-9.5 5.5-9.7-3-4.5-7.7-5-9.2-5.4z"/>
      <path d="M72.5 4.5h-9.2v47.2h5.6V35.5h7.8c7.1 0 12-4.9 12-15.6 0-9.6-4.8-15.4-16.2-15.4zm1.3 26.2h-4.9V9.4h4.4c7.2 0 10 3.5 10 10.7 0 7.1-3.2 10.6-9.5 10.6zM96.6 52.2c3.5 0 6.7-1.7 8.2-4.5h.1v4.1h5.2V31.4c0-7-4.7-10.1-10.5-10.1-6 0-10.4 3.3-10.6 8.4h5c.5-2.4 2.3-4 5.3-4s4.8 1.5 4.8 4.8v2.4l-7 .4c-6.2.4-9.8 3.2-9.8 8.5-.1 5.4 3.6 10.4 9.3 10.4zm1.5-4.5c-2.9 0-5.1-1.6-5.1-4.5 0-2.7 1.9-4.4 5.8-4.6l6.1-.4v2.5c0 4-2.8 7-6.8 7zM120 64.8c5.2 0 7.7-2 10-8l10.9-29.2h-5.8l-7.2 22.7h-.1L120.5 27.6h-6l10.2 27.1-.6 1.7c-1 2.8-2.5 3.9-5.2 3.9-.5 0-1.5-.1-1.9-.1v4.5c.4 0 2.3.1 3 .1z"/>
    </svg>
  )
  if (method === "google_pay") return (
    <svg width="46" height="18" viewBox="0 0 80 32" fill="none">
      <path d="M38.5 16.1c0 3.9-3 6.7-6.7 6.7s-6.7-2.8-6.7-6.7 3-6.7 6.7-6.7c1.9 0 3.4.7 4.6 1.8L34.2 13c-.7-.6-1.5-1-2.4-1-2.2 0-4 1.8-4 4.1s1.8 4.1 4 4.1c2 0 3.3-1.1 3.6-2.7h-3.6v-2.4h6.6c.1.3.1.7.1 1z" fill="#4285F4"/>
      <path d="M49.1 16.1c0 3.7-2.8 6.7-6.4 6.7-3.6 0-6.4-3-6.4-6.7s2.8-6.7 6.4-6.7 6.4 3 6.4 6.7zm-2.8 0c0-2.3-1.7-3.9-3.6-3.9s-3.6 1.6-3.6 3.9 1.7 3.9 3.6 3.9 3.6-1.6 3.6-3.9z" fill="#EA4335"/>
      <path d="M61.5 16.1c0 3.7-2.8 6.7-6.4 6.7-3.6 0-6.4-3-6.4-6.7s2.8-6.7 6.4-6.7 6.4 3 6.4 6.7zm-2.8 0c0-2.3-1.7-3.9-3.6-3.9s-3.6 1.6-3.6 3.9 1.7 3.9 3.6 3.9 3.6-1.6 3.6-3.9z" fill="#FBBC05"/>
      <path d="M72.5 9.8v11.6c0 4.8-2.8 6.7-6.2 6.7-3.2 0-5.1-2.1-5.8-3.8l2.4-1c.4 1.1 1.4 2.3 3.4 2.3 2.2 0 3.6-1.4 3.6-3.9v-1h-.1c-.7.8-1.9 1.5-3.5 1.5-3.3 0-6.4-2.9-6.4-6.6s3.1-6.7 6.4-6.7c1.6 0 2.8.7 3.5 1.5h.1V9.8h2.6zm-2.4 6.4c0-2.2-1.5-3.8-3.4-3.8-1.9 0-3.5 1.6-3.5 3.8s1.6 3.8 3.5 3.8 3.4-1.6 3.4-3.8z" fill="#4285F4"/>
      <text x="76" y="22" fontFamily="Arial" fontSize="14" fontWeight="700" fill="#5F6368">Pay</text>
    </svg>
  )
  return null
}

// Aragoiânia, GO — coordenadas padrão quando GPS não está disponível
const LAT_DEFAULT = -17.6547
const LNG_DEFAULT = -49.4378

function codigoFromTelefone(tel: string): string {
  const d = tel.replace(/\D/g, "")
  return d.length >= 4 ? d.slice(-4) : Math.random().toString(36).slice(2, 6).toUpperCase()
}

async function inserirPedidoComCodigo(
  base: string,
  payload: Record<string, unknown>,
  tentativa = 0
): Promise<{ data: { id: string } | null; error: unknown; codigo: string }> {
  const codigo = tentativa === 0 ? base : base + String.fromCharCode(64 + tentativa)
  const { data, error } = await (supabase as any)
    .from("pedidos")
    .insert({ ...payload, codigo })
    .select("id")
    .single()
  if ((error as any)?.code === "23505" && tentativa < 5)
    return inserirPedidoComCodigo(base, payload, tentativa + 1)
  return { data, error, codigo }
}

interface GeoResult {
  rua: string; bairro: string; cidade: string; lat: number; lng: number
}

async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-BR`,
    { headers: { "User-Agent": "AragoDelivery/1.0" } }
  )
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
      {/* Status GPS */}
      {gpsStatus === "loading" && (
        <div style={{ background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 12, padding: "10px 14px" }}>
          <p style={{ color: "#6B7280", fontSize: 13 }}>📡 Detectando sua localização...</p>
        </div>
      )}
      {gpsStatus === "denied" && (
        <div style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8, alignItems: "center" }}>
          <span>⚠️</span>
          <p style={{ color: "#eab308", fontSize: 12, fontWeight: 500 }}>
            GPS não disponível — arraste o pin ou clique no mapa para definir o local de entrega.
          </p>
        </div>
      )}

      {/* Mapa */}
      <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #E5E7EB", position: "relative" }}>
        <MapaPicker lat={lat} lng={lng} onMove={handleMapMove} />
        <div style={{ position: "absolute", bottom: 8, left: 8, right: 8, zIndex: 999, pointerEvents: "none" }}>
          <div style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "7px 12px" }}>
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
  const [lgpdConsent,  setLgpdConsent]  = useState(false)
  const [salvarCartao, setSalvarCartao] = useState(false)
  const [cartaoSalvo,  setCartaoSalvo]  = useState<{ last4: string; nome: string; validade: string } | null>(null)
  const [usarSalvo,    setUsarSalvo]    = useState(false)

  // Endereço salvo
  type EnderecoSalvo = { display: string; rua: string; numero: string; bairro: string; cidade: string; complemento: string; lat: number; lng: number }
  const [enderecoSalvo,    setEnderecoSalvo]    = useState<EnderecoSalvo | null>(null)
  const [editandoEndereco, setEditandoEndereco] = useState(false)

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

  // Carrega cartão salvo
  useEffect(() => {
    try {
      const raw = localStorage.getItem("arago_cartao")
      if (raw) {
        const c = JSON.parse(raw)
        if (c?.last4 && c?.nome && c?.validade) {
          setCartaoSalvo(c)
          setUsarSalvo(true)
        }
      }
    } catch {}
  }, [])

  // Pré-preenche do perfil do cliente logado
  useEffect(() => {
    if (perfil?.nome)     setNome(perfil.nome)
    if (perfil?.telefone) setTelefone(perfil.telefone)
  }, [perfil])

  const loja_id    = items[0]?.loja_id ?? null
  const [lojaData, setLojaData] = useState<{ taxa_entrega: number; endereco: string; nome: string } | null>(null)

  useEffect(() => {
    if (!loja_id) return
    supabase.from("lojas").select("taxa_entrega,endereco,nome").eq("id", loja_id).single()
      .then(({ data }) => setLojaData(data as any))
  }, [loja_id])

  const taxa        = tipoEntrega === "retirada" ? 0 : (lojaData?.taxa_entrega ?? 0)
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
    const { data } = await supabase
      .from("cupons")
      .select("id, codigo, tipo, valor, pedido_minimo, validade, ativo")
      .ilike("codigo", cupomInput.trim())
      .or(`loja_id.is.null,loja_id.eq.${loja_id ?? "00000000-0000-0000-0000-000000000000"}`)
      .limit(1)
    const cupom = data?.[0]
    if (!cupom || !cupom.ativo) { setCupomErro("Cupom inválido ou expirado."); setValidandoCupom(false); return }
    if (cupom.validade && new Date(cupom.validade) < new Date()) { setCupomErro("Este cupom expirou."); setValidandoCupom(false); return }
    if (cupom.pedido_minimo > 0 && subtotal < cupom.pedido_minimo) {
      setCupomErro(`Pedido mínimo de R$ ${Number(cupom.pedido_minimo).toFixed(2)} para este cupom.`)
      setValidandoCupom(false); return
    }
    setCupomValido(cupom); setValidandoCupom(false)
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
        <p style={{ fontSize: 40 }}>🛒</p>
        <p style={{ color: "#6B7280", fontWeight: 600 }}>Seu carrinho está vazio</p>
        <Link href="/lojas" style={{ color: "#DC2626", fontWeight: 700 }}>← Ver lojas</Link>
      </div>
    )
  }

  if (pedidoCodigo) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <h1 style={{ color: "#111827", fontWeight: 900, fontSize: 24, marginBottom: 8 }}>Pedido realizado!</h1>
          <p style={{ color: "#6B7280", marginBottom: 24 }}>
            Aguarde a confirmação da loja.
          </p>
          <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 16, padding: "20px 24px", marginBottom: 20 }}>
            <p style={{ color: "#6B7280", fontSize: 12, marginBottom: 4 }}>Código do pedido</p>
            <p style={{ color: "#DC2626", fontWeight: 900, fontSize: 36, letterSpacing: 6 }}>#{pedidoCodigo}</p>
            <p style={{ color: "#D1D5DB", fontSize: 11, marginTop: 6 }}>Guarde este código para rastrear e confirmar a entrega</p>
          </div>
          <Link href={`/pedido/${pedidoCodigo}`} style={{
            display: "block", padding: "14px 24px", borderRadius: 14, background: "#DC2626",
            color: "white", fontWeight: 700, textDecoration: "none", fontSize: 15, marginBottom: 12,
          }}>
            📍 Acompanhar pedido →
          </Link>
          {user && (
            <Link href="/cliente/perfil" style={{
              display: "block", padding: "13px 24px", borderRadius: 14,
              background: "#F9FAFB", border: "1px solid #e5e7eb",
              color: "#6B7280", fontWeight: 700, textDecoration: "none", fontSize: 14, marginBottom: 12,
            }}>
              👤 Ver meu perfil
            </Link>
          )}
          <Link href="/lojas" style={{
            display: "block", padding: "13px 24px", borderRadius: 14,
            background: "#F9FAFB", border: "1px solid #e5e7eb",
            color: "#9CA3AF", fontWeight: 700, textDecoration: "none", fontSize: 14,
          }}>
            Fazer novo pedido
          </Link>
        </div>
      </div>
    )
  }

  async function processWalletPayment(total: number): Promise<boolean> {
    if (typeof window === "undefined" || !("PaymentRequest" in window)) {
      setErro(
        pagamento === "apple_pay"
          ? "Apple Pay requer Safari no iPhone ou Mac com cartão configurado."
          : "Google Pay requer Chrome com um cartão configurado na conta Google."
      )
      setEnviando(false)
      return false
    }
    try {
      const methods: PaymentMethodData[] =
        pagamento === "apple_pay"
          ? [{ supportedMethods: "https://apple.com/apple-pay", data: { version: 3, merchantIdentifier: "merchant.delivery.arago", merchantCapabilities: ["supports3DS"], supportedNetworks: ["visa", "masterCard"], countryCode: "BR" } }]
          : [{ supportedMethods: "https://google.com/pay", data: { environment: "PRODUCTION", apiVersion: 2, apiVersionMinor: 0, allowedPaymentMethods: [{ type: "CARD", parameters: { allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"], allowedCardNetworks: ["MASTERCARD", "VISA", "ELO"] } }], merchantInfo: { merchantName: "Chegô Delivery" } } }]

      const pr = new PaymentRequest(methods, {
        total: { label: "Chegô Delivery", amount: { currency: "BRL", value: total.toFixed(2) } },
      })

      const canMake = await pr.canMakePayment()
      if (!canMake) {
        setErro(
          pagamento === "apple_pay"
            ? "Apple Pay indisponível. Adicione um cartão no Wallet do iPhone ou use PIX/Cartão."
            : "Google Pay indisponível. Adicione um cartão na sua conta Google ou use PIX/Cartão."
        )
        setEnviando(false)
        return false
      }

      const response = await pr.show()
      await response.complete("success")
      return true
    } catch (err: any) {
      if (err?.name === "AbortError") { setEnviando(false); return false }
      // Outro erro (ex: merchant validation) — prossegue sem pagamento eletrônico
      return true
    }
  }

  async function confirmar() {
    if (!nome.trim()) { setErro("Informe seu nome"); return }
    const telDigits = telefone.replace(/\D/g, "")
    if (telDigits.length < 8) { setErro("Informe um telefone válido (com DDD)"); return }

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
    if (pagamento === "apple_pay" || pagamento === "google_pay") {
      const walletOk = await processWalletPayment(totalFinal)
      if (!walletOk) return
    }

    const codigoBase = codigoFromTelefone(telefone)
    const obsCompleta = [
      `Cliente: ${nome.trim()}`,
      `Tel: ${telefone.trim()}`,
      tipoEntrega === "retirada" ? "🏪 RETIRADA NA LOJA" : "",
      obs.trim(),
    ].filter(Boolean).join(" | ")

    const { data: pedido, error: pedidoErr, codigo } = await inserirPedidoComCodigo(codigoBase, {
      loja_id,
      cliente_id:       user?.id ?? null,
      status:           "pendente",
      forma_pagamento:  pagamento,
      subtotal,
      taxa_entrega:     taxa,
      desconto:         desconto,
      cupom_codigo:     cupomValido?.codigo ?? null,
      total:            totalFinal,
      endereco_entrega: enderecoFinal,
      observacao:       obsCompleta,
      lat_entrega:      latFinal,
      lng_entrega:      lngFinal,
    })

    if (pedidoErr || !pedido) {
      setErro("Erro ao enviar pedido. Tente novamente.")
      setEnviando(false)
      return
    }

    await supabase.from("itens_pedido").insert(
      items.map(i => ({
        pedido_id:  pedido.id,
        produto_id: i.id,
        nome:       i.nome,
        preco:      i.preco,
        quantidade: i.quantidade,
        observacao: "",
      }))
    )

    // Incrementar uso do cupom
    if (cupomValido) {
      await supabase.from("cupons").update({ usos: (cupomValido as any).usos + 1 }).eq("id", cupomValido.id)
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

    // Salva cartão (sem CVV) se LGPD consentido
    if (pagamento === "cartao" && salvarCartao && lgpdConsent && !usarSalvo) {
      const digits = cardNumber.replace(/\D/g, "")
      if (digits.length >= 4) {
        localStorage.setItem("arago_cartao", JSON.stringify({
          last4:   digits.slice(-4),
          nome:    cardName.trim(),
          validade: cardExpiry,
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
    setPedidoCodigo(codigo!)
    setPedidoId(pedido.id)
    setEnviando(false)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {([
              { value: "entrega", label: "🛵 Receber em casa", sub: "Motoboy leva até você" },
              { value: "retirada", label: "🏪 Retirar na loja", sub: "Você busca no local · Grátis" },
            ] as const).map(opt => (
              <button key={opt.value} onClick={() => setTipoEntrega(opt.value)} style={{
                padding: "14px", borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                background: tipoEntrega === opt.value ? "rgba(220,38,38,0.08)" : "#F9FAFB",
                border: tipoEntrega === opt.value ? "1px solid rgba(220,38,38,0.4)" : "1px solid #E5E7EB",
              }}>
                <p style={{ color: tipoEntrega === opt.value ? "#DC2626" : "#111827", fontWeight: 700, fontSize: 14 }}>{opt.label}</p>
                <p style={{ color: tipoEntrega === opt.value ? "rgba(220,38,38,0.7)" : "#6B7280", fontSize: 12, marginTop: 3 }}>{opt.sub}</p>
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
              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ background: "rgba(220,38,38,0.10)", color: "#DC2626", fontWeight: 700, fontSize: 12, padding: "2px 8px", borderRadius: 6 }}>
                    {i.quantidade}×
                  </span>
                  <span style={{ color: "#374151", fontSize: 14 }}>{i.nome}</span>
                </div>
                <span style={{ color: "#6B7280", fontSize: 14 }}>R$ {(i.preco * i.quantidade).toFixed(2)}</span>
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
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Seu nome *</label>
                <input
                  value={nome} onChange={e => setNome(e.target.value)}
                  placeholder="João Silva"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#111827", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  WhatsApp *
                  <span style={{ color: "rgba(220,38,38,0.6)", marginLeft: 6, fontWeight: 400 }}>(código = últimos 4 dígitos)</span>
                </label>
                <input
                  value={telefone} onChange={e => setTelefone(e.target.value)}
                  placeholder="(64) 9 9999-1234" inputMode="tel"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#111827", outline: "none", boxSizing: "border-box" }}
                />
              </div>
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
            const isWallet = p.value === "apple_pay" || p.value === "google_pay"
            const isLast = idx === arr.length - 1
            return (
              <button key={p.value} onClick={() => setPagamento(p.value)} style={{
                width: "100%", padding: "14px 18px",
                display: "flex", alignItems: "center", gap: 14,
                background: ativo ? "rgba(220,38,38,0.05)" : "transparent",
                border: "none",
                borderBottom: isLast ? "none" : "1px solid #F3F4F6",
                cursor: "pointer", textAlign: "left",
              }}>
                {/* Ícone */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: ativo ? "rgba(220,38,38,0.08)" : "#F9FAFB",
                  border: ativo ? "1.5px solid rgba(220,38,38,0.25)" : "1px solid #E5E7EB",
                  overflow: "hidden",
                }}>
                  <PaymentIcon method={p.value} />
                </div>

                {/* Texto */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: ativo ? "#DC2626" : "#111827", fontWeight: 700, fontSize: 14 }}>{p.label}</p>
                  <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>
                    {p.value === "pix"        && "Confirmação imediata · sem taxas"}
                    {p.value === "cartao"     && (cartaoSalvo ? `•••• ${cartaoSalvo.last4} — ${cartaoSalvo.nome}` : "Débito ou crédito")}
                    {p.value === "apple_pay"  && "Pay com Touch ID ou Face ID"}
                    {p.value === "google_pay" && "Pay com sua conta Google"}
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

              {/* Cartão salvo */}
              {cartaoSalvo && usarSalvo ? (
                <div style={{ background: "#1E293B", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                  <CardLogo />
                  <div style={{ flex: 1 }}>
                    <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>•••• •••• •••• {cartaoSalvo.last4}</p>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{cartaoSalvo.nome} · {cartaoSalvo.validade}</p>
                  </div>
                  <button
                    onClick={() => { setUsarSalvo(false); setCartaoSalvo(null); localStorage.removeItem("arago_cartao") }}
                    style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    Trocar
                  </button>
                </div>
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
    </div>
  )
}
