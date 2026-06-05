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

const PAGAMENTOS: { value: FormaPagamento; label: string; icon: string }[] = [
  { value: "pix",        label: "PIX",        icon: "💠" },
  { value: "cartao",     label: "Cartão",     icon: "💳" },
  { value: "dinheiro",   label: "Dinheiro",   icon: "💵" },
  { value: "maquininha", label: "Maquininha", icon: "📱" },
]

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
        <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 12, padding: "10px 14px" }}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>📡 Detectando sua localização...</p>
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
      <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", position: "relative" }}>
        <MapaPicker lat={lat} lng={lng} onMove={handleMapMove} />
        <div style={{ position: "absolute", bottom: 8, left: 8, right: 8, zIndex: 999, pointerEvents: "none" }}>
          <div style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "7px 12px" }}>
            {geocodando ? (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>📍 Identificando endereço...</p>
            ) : geo?.rua ? (
              <p style={{ color: "white", fontSize: 12, fontWeight: 600 }}>
                📍 {geo.rua}{geo.bairro ? `, ${geo.bairro}` : ""}
              </p>
            ) : (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>📍 Mova o pin para o local de entrega</p>
            )}
          </div>
        </div>
      </div>

      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "center" }}>
        Arraste o pin laranja ou toque no mapa para ajustar o local
      </p>

      {/* Número + Complemento */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <div>
          <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Número *</label>
          <input
            value={numero}
            onChange={e => setNumero(e.target.value)}
            placeholder="42"
            inputMode="numeric"
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
              background: "rgba(255,255,255,0.06)",
              border: numero ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.1)",
              color: "white", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Complemento</label>
          <input
            value={complemento}
            onChange={e => setComplemento(e.target.value)}
            placeholder="Apto 3, casa dos fundos..."
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "white", outline: "none", boxSizing: "border-box",
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

  const geoRef = useRef<{ geo: GeoResult; numero: string; complemento: string } | null>(null)

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

  if (items.length === 0 && !pedidoCodigo) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 40 }}>🛒</p>
        <p style={{ color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Seu carrinho está vazio</p>
        <Link href="/lojas" style={{ color: "#f97316", fontWeight: 700 }}>← Ver lojas</Link>
      </div>
    )
  }

  if (pedidoCodigo) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <h1 style={{ color: "white", fontWeight: 900, fontSize: 24, marginBottom: 8 }}>Pedido realizado!</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>
            Aguarde a confirmação da loja.
          </p>
          <div style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 16, padding: "20px 24px", marginBottom: 20 }}>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 4 }}>Código do pedido</p>
            <p style={{ color: "#f97316", fontWeight: 900, fontSize: 36, letterSpacing: 6 }}>#{pedidoCodigo}</p>
            <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 6 }}>Guarde este código para rastrear e confirmar a entrega</p>
          </div>
          <Link href={`/pedido/${pedidoCodigo}`} style={{
            display: "block", padding: "14px 24px", borderRadius: 14, background: "#f97316",
            color: "white", fontWeight: 700, textDecoration: "none", fontSize: 15, marginBottom: 12,
          }}>
            📍 Acompanhar pedido →
          </Link>
          {user && (
            <Link href="/cliente/perfil" style={{
              display: "block", padding: "13px 24px", borderRadius: 14,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.4)", fontWeight: 700, textDecoration: "none", fontSize: 14, marginBottom: 12,
            }}>
              👤 Ver meu perfil
            </Link>
          )}
          <Link href="/lojas" style={{
            display: "block", padding: "13px 24px", borderRadius: 14,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.3)", fontWeight: 700, textDecoration: "none", fontSize: 14,
          }}>
            Fazer novo pedido
          </Link>
        </div>
      </div>
    )
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

    clear()
    setPedidoCodigo(codigo!)
    setPedidoId(pedido.id)
    setEnviando(false)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>
      {/* Navbar */}
      <nav style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer" }}>←</button>
          <p style={{ color: "white", fontWeight: 800, fontSize: 16, flex: 1 }}>Finalizar pedido</p>
          {user ? (
            <Link href="/cliente/perfil" style={{ color: "#f97316", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>👤 Perfil</Link>
          ) : (
            <Link href="/cliente/entrar" style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Entrar</Link>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Toggle Retirada / Entrega */}
        <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", padding: "18px" }}>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Como você quer receber?</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {([
              { value: "entrega", label: "🛵 Receber em casa", sub: "Motoboy leva até você" },
              { value: "retirada", label: "🏪 Retirar na loja", sub: "Você busca no local · Grátis" },
            ] as const).map(opt => (
              <button key={opt.value} onClick={() => setTipoEntrega(opt.value)} style={{
                padding: "14px", borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                background: tipoEntrega === opt.value ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                border: tipoEntrega === opt.value ? "1px solid rgba(249,115,22,0.5)" : "1px solid rgba(255,255,255,0.08)",
              }}>
                <p style={{ color: tipoEntrega === opt.value ? "#f97316" : "white", fontWeight: 700, fontSize: 14 }}>{opt.label}</p>
                <p style={{ color: tipoEntrega === opt.value ? "rgba(249,115,22,0.7)" : "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 3 }}>{opt.sub}</p>
              </button>
            ))}
          </div>
          {tipoEntrega === "retirada" && lojaData?.endereco && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Endereço da loja</p>
              <p style={{ color: "white", fontSize: 13, fontWeight: 600 }}>📍 {lojaData.endereco}</p>
            </div>
          )}
        </div>

        {/* Resumo */}
        <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>🛒 Resumo do pedido</p>
            {items[0] && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 }}>{items[0].loja_nome}</p>}
          </div>
          <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map(i => (
              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", fontWeight: 700, fontSize: 12, padding: "2px 8px", borderRadius: 6 }}>
                    {i.quantidade}×
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>{i.nome}</span>
                </div>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>R$ {(i.preco * i.quantidade).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
              <span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
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
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: "white", marginTop: 4 }}>
              <span>Total</span><span>R$ {totalFinal.toFixed(2)}</span>
            </div>
          </div>

          {/* Cupom */}
          <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {cupomValido ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <p style={{ color: "#22c55e", fontWeight: 700, fontSize: 13 }}>
                  🎟️ {cupomValido.codigo} — {cupomValido.tipo === "percentual" ? `${cupomValido.valor}% de desconto` : `R$ ${cupomValido.valor.toFixed(2)} de desconto`}
                </p>
                <button onClick={() => { setCupomValido(null); setCupomInput("") }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16 }}>✕</button>
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
                    background: "rgba(255,255,255,0.06)", border: cupomErro ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.1)",
                    color: "white", outline: "none",
                  }}
                />
                <button onClick={aplicarCupom} disabled={!cupomInput.trim() || validandoCupom} style={{
                  padding: "10px 16px", borderRadius: 10, border: "none",
                  background: cupomInput.trim() ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.05)",
                  color: cupomInput.trim() ? "#f97316" : "rgba(255,255,255,0.25)",
                  fontWeight: 700, fontSize: 13, cursor: cupomInput.trim() ? "pointer" : "default",
                }}>
                  {validandoCupom ? "..." : "Aplicar"}
                </button>
              </div>
            )}
            {cupomErro && <p style={{ color: "#f87171", fontSize: 12, marginTop: 6, fontWeight: 600 }}>{cupomErro}</p>}
          </div>
        </div>

        {/* Dados */}
        <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", padding: "18px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>📋 Seus dados</p>
            {!user && (
              <Link href="/cliente/entrar" style={{ color: "#f97316", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                Entrar para salvar dados →
              </Link>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Seu nome *</label>
              <input
                value={nome} onChange={e => setNome(e.target.value)}
                placeholder="João Silva"
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "white", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                WhatsApp *
                <span style={{ color: "rgba(249,115,22,0.6)", marginLeft: 6, fontWeight: 400 }}>(código = últimos 4 dígitos)</span>
              </label>
              <input
                value={telefone} onChange={e => setTelefone(e.target.value)}
                placeholder="(64) 9 9999-1234" inputMode="tel"
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "white", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Endereço com mapa — só para entrega */}
          {tipoEntrega === "entrega" && (
            <div>
              <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                📍 Local de entrega *
              </label>
              <EnderecoMapa
                onResult={(geo, numero, complemento) => {
                  geoRef.current = { geo, numero, complemento }
                }}
              />
            </div>
          )}
        </div>

        {/* Pagamento */}
        <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", padding: "18px 18px" }}>
          <p style={{ color: "white", fontWeight: 700, fontSize: 14, marginBottom: 14 }}>💳 Forma de pagamento</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {PAGAMENTOS.map(p => (
              <button key={p.value} onClick={() => setPagamento(p.value)} style={{
                padding: "12px 14px", borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                background: pagamento === p.value ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                border: pagamento === p.value ? "1px solid rgba(249,115,22,0.5)" : "1px solid rgba(255,255,255,0.08)",
                color: pagamento === p.value ? "#f97316" : "rgba(255,255,255,0.5)",
                fontWeight: 600, fontSize: 13,
              }}>
                <span style={{ marginRight: 6 }}>{p.icon}</span>{p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Observações */}
        <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", padding: "18px 18px" }}>
          <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>💬 Observações (opcional)</label>
          <textarea
            value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Sem cebola, capricha no molho..."
            rows={3}
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 13, resize: "none",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "white", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {erro && (
          <p style={{ color: "#f87171", fontSize: 13, fontWeight: 600, textAlign: "center", padding: "10px 16px", background: "rgba(239,68,68,0.08)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.15)" }}>{erro}</p>
        )}

        <button onClick={confirmar} disabled={enviando} style={{
          width: "100%", padding: "16px", borderRadius: 14, border: "none",
          cursor: enviando ? "not-allowed" : "pointer",
          background: enviando ? "rgba(249,115,22,0.4)" : "#f97316",
          color: "white", fontWeight: 800, fontSize: 16,
        }}>
          {enviando ? "Enviando..." : `✓ Confirmar pedido · R$ ${totalFinal.toFixed(2)}`}
        </button>
      </div>
    </div>
  )
}
