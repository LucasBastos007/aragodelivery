"use client"

import { descontoPromo, PROMO_PRODUTOS } from "@/lib/promoChego"
import { usePromoUsados, recarregarPromoUsados } from "@/components/cliente/PrecoPromo"
import AjudaPagamentoWhats from "@/components/AjudaPagamentoWhats"
import { useEffect, useRef, useState } from "react"
import { lerCupomSacola, limparCupomSacola, validarCupom, descricaoCupom } from "@/lib/cupomSacola"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useCart } from "@/lib/cart"
import { useClienteAuth } from "@/lib/auth-cliente"
import { useIsMobile } from "@/lib/use-mobile"
import type { FormaPagamento } from "@/types"
import { brl } from "@/lib/precoExibicao"

// Leaflet não funciona no SSR — importa só no client
const MapaPicker = dynamic(() => import("@/components/MapaPicker"), { ssr: false })

const PAGAMENTOS: { value: FormaPagamento; label: string; platforms: ("ios"|"android"|"other")[]; breve?: boolean }[] = [
  { value: "pix",        label: "PIX",        platforms: ["ios","android","other"] },
  { value: "cartao",     label: "Cartão",     platforms: ["ios","android","other"] },
  { value: "google_pay", label: "Google Pay", platforms: ["android"] },
  { value: "dinheiro",   label: "Dinheiro",   platforms: ["ios","android","other"] },
  { value: "maquininha", label: "Maquininha", platforms: ["ios","android","other"] },
]

// Máscara de dinheiro ao digitar: "1234" → "12,34", "123456" → "1.234,56"
function mascaraBRL(v: string): string {
  const d = v.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9)
  if (!d) return ""
  const n = Number(d) / 100
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Logo PIX — diamante arredondado + 2 lentes diagonais brancas (padrão oficial BCB)
// Símbolo oficial do Pix (o mesmo arquivo da proposta aprovada, public/pix-icone.svg).
function PixLogo({ t = 24 }: { t?: number }) {
  return <img src="/pix-icone.svg" alt="Pix" width={t} height={t} style={{ display: "inline-block", verticalAlign: "middle" }} />
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

// Ícones de traço da proposta (cartão, dinheiro, maquininha, loja); Pix e Google Pay com a marca.
const ICO_PG: Record<string, React.ReactNode> = {
  cartao: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h4" /></>,
  dinheiro: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.8" /><path d="M6 9v.01M18 15v.01" /></>,
  maquininha: <><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><rect x="8.5" y="5" width="7" height="4.5" rx="1" /><path d="M9 13h.01M12 13h.01M15 13h.01M9 16h.01M12 16h.01M15 16h.01" /></>,
  loja: <><path d="M4 10v10h16V10" /><path d="M3 10l1.5-6h15L21 10a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" /><path d="M10 20v-5h4v5" /></>,
}
function PaymentIcon({ method, naLoja, pequeno }: { method: FormaPagamento; naLoja?: boolean; pequeno?: boolean }) {
  const t = pequeno ? 20 : 22
  if (method === "pix")        return <PixLogo t={pequeno ? 20 : 24} />
  if (method === "google_pay") return <GooglePayLogo />
  const ic = ICO_PG[method === "maquininha" && naLoja ? "loja" : method]
  if (!ic) return null
  return <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--grafite)" }}>{ic}</svg>
}

// Aragoiânia, GO — coordenadas padrão quando GPS não está disponível.
// ATENÇÃO: valor anterior (-17.6547, -49.4378) era na verdade Aloândia-GO, ~82km daqui —
// causou pelo menos um pedido real cobrando R$79,89 de frete pra um endereço que devia
// ser R$4,00 (pedido JZ89NC, 2026-09-12). Corrigido pro centro real de Aragoiânia.
const LAT_DEFAULT = -16.9214
const LNG_DEFAULT = -49.4497



interface GeoResult {
  rua: string; bairro: string; cidade: string; lat: number; lng: number
}

async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lng}`)
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

// Sem GPS, o mapa precisa centralizar em algo — usar sempre as coordenadas da PRÓPRIA
// loja (fallbackLat/Lng, vindas de `lojas.lat/lng`) em vez de uma cidade fixa. Antes disso
// o fallback era hardcoded pro centro de Aragoiânia, que fazia sentido enquanto todas as
// lojas eram de lá — mas quebraria silenciosamente pra qualquer loja de outra cidade (ex:
// Guapó): sem GPS, o pino cairia em Aragoiânia e o cliente podia nem notar antes de
// confirmar, gerando endereço/frete errados (mesma classe de risco do pedido JZ89NC, ver
// LAT_DEFAULT abaixo, que fica só como fallback de último caso se a loja não tiver
// lat/lng cadastrado).
function EnderecoMapa({ onResult, fallbackLat, fallbackLng }: {
  onResult: (geo: GeoResult, numero: string, complemento: string) => void
  fallbackLat?: number | null
  fallbackLng?: number | null
}) {
  const latFallback = fallbackLat ?? LAT_DEFAULT
  const lngFallback = fallbackLng ?? LNG_DEFAULT
  const [lat, setLat]             = useState(latFallback)
  const [lng, setLng]             = useState(lngFallback)
  const [geo, setGeo]             = useState<GeoResult | null>(null)
  const [gpsStatus, setGpsStatus] = useState<"loading" | "ok" | "denied">("loading")
  const [geocodando, setGeocodando] = useState(false)
  const [numero, setNumero]         = useState("")
  const [complemento, setComplemento] = useState("")
  // Rua/bairro digitados pelo cliente quando o mapa não identifica (condomínio, zona rural,
  // rua nova). Pedido #5VKMCR (2026-10-06) saiu só com "00 — Condomínio" e o motoboy não achou.
  const [ruaManual, setRuaManual]       = useState("")
  const [bairroManual, setBairroManual] = useState("")
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
        // Sem GPS o pino começa na loja: não vale como endereço até o cliente arrastar até a casa dele
        // (antes o ponto da loja virava o endereço e o frete saía no mínimo, ex. H9E3AA)
        setGpsStatus("denied")
        setLat(latFallback)
        setLng(lngFallback)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    )
  }, [])

  // Notifica pai quando geo/numero/complemento mudam
  useEffect(() => {
    if (geo) onResult({ ...geo, rua: geo.rua || ruaManual.trim(), bairro: geo.bairro || bairroManual.trim() }, numero, complemento)
  }, [geo, numero, complemento, ruaManual, bairroManual])

  async function geocodePonto(lt: number, ln: number) {
    setGeocodando(true)
    try {
      const result = await reverseGeocode(lt, ln)
      setGeo(result)
    } catch {
      // Sem resposta do mapa: abre os campos de rua e bairro pro cliente digitar
      setGeo({ rua: "", bairro: "", cidade: "", lat: lt, lng: ln })
    }
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {gpsStatus === "loading" && <p className="mut" style={{ fontSize: 13.5 }}>📡 Procurando sua localização…</p>}
      {gpsStatus === "denied" && !geo && <p style={{ fontSize: 13.5, fontWeight: 700, color: "#B01D16", background: "#FDECEB", borderRadius: 10, padding: "10px 12px" }}>Não conseguimos sua localização. Arraste o pino até a sua casa ou toque no mapa onde é a entrega.</p>}

      <div className="mapa-ck">
        <MapaPicker lat={lat} lng={lng} onMove={handleMapMove} />
        <div className="mapa-ck-rotulo">
          {geocodando ? <span className="mut">📍 Identificando endereço…</span>
            : geo?.rua ? <b>📍 {geo.rua}{geo.bairro ? `, ${geo.bairro}` : ""}</b>
            : <span className="mut">📍 Mova o pino até o local da entrega</span>}
        </div>
      </div>
      <p className="mut" style={{ fontSize: 12.5, textAlign: "center" }}>Arraste o pino ou toque no mapa pra ajustar o local</p>

      {/* Rua / bairro — só aparecem quando o mapa não identificou */}
      {geo && !geocodando && (!geo.rua || !geo.bairro) && (
        <div style={{ display: "grid", gridTemplateColumns: !geo.rua && !geo.bairro ? "1fr 1fr" : "1fr", gap: 10 }}>
          {!geo.rua && (
            <label className={`campo ${ruaManual.trim() ? "" : "falta"}`}><span>Rua *</span>
              <input value={ruaManual} onChange={e => setRuaManual(e.target.value)} placeholder="Rua, avenida ou quadra" /></label>
          )}
          {!geo.bairro && (
            <label className={`campo ${bairroManual.trim() ? "" : "falta"}`}><span>Bairro ou condomínio *</span>
              <input value={bairroManual} onChange={e => setBairroManual(e.target.value)} placeholder="Ex.: Cond. Quintas do Lago" /></label>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <label className="campo"><span>Número *</span>
          <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="42 ou S/N" /></label>
        <label className="campo"><span>Complemento ou referência *</span>
          <input value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Qd 5 Lt 10, casa azul…" /></label>
      </div>
    </div>
  )
}

/** Endereço de entrega completo o bastante pro motoboy achar o cliente — rua, bairro,
 * número real (não "0"/"00"; "S/N" vale) e complemento/ponto de referência. Retorna a
 * mensagem de erro, ou null se estiver ok. */
function erroEnderecoEntrega(rua: string, bairro: string, numero: string, complemento: string): string | null {
  const n = numero.trim().toUpperCase().replace(/\s+/g, "")
  if (!rua.trim()) return "Informe o nome da rua do endereço de entrega"
  if (!bairro.trim()) return "Informe o bairro ou condomínio do endereço de entrega"
  if (!n) return "Informe o número da sua casa/apto no campo Número (ou S/N se não tiver)"
  const semNumero = n === "S/N" || n === "SN" || n === "S.N."
  if (!semNumero && (!/\d/.test(n) || /^0+$/.test(n))) return "Número inválido — informe o número real da casa (ou S/N se não tiver)"
  if (complemento.trim().length < 3) return "Informe o complemento ou um ponto de referência (ex: Qd 5 Lt 10, casa azul, perto da praça)"
  return null
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter()
  const { items, total, clear } = useCart()
  const { perfil, user, salvarPerfil } = useClienteAuth()
  const isMobile = useIsMobile()

  const [nome, setNome]           = useState("")
  const [telefone, setTelefone]   = useState("")
  const [cpf, setCpf]             = useState("")
  const [pagamento, setPagamento] = useState<FormaPagamento>("pix")
  const [precisaTroco, setPrecisaTroco] = useState(false)
  const [trocoPara, setTrocoPara]       = useState("")
  const [tipoMaquininha, setTipoMaquininha] = useState<"credito" | "debito">("credito")
  const promoUsadosConta = usePromoUsados()
  const [usadosPromo, setUsadosPromo] = useState<string[]>([])
  useEffect(() => { setUsadosPromo(u => Array.from(new Set([...u, ...promoUsadosConta]))) }, [promoUsadosConta])
  // Pagamento em 2 formas (20/10/2026): 1ª forma = `pagamento`, com o valor digitado; o resto
  // vai na 2ª forma. O servidor recalcula a 2ª parte (total − 1ª).
  const [dividir, setDividir] = useState(false)
  const [pagamento2, setPagamento2] = useState<FormaPagamento | null>(null)
  const [valor1Txt, setValor1Txt] = useState("")
  const [obs, setObs]             = useState("")
  const [enviando, setEnviando]   = useState(false)
  const [pedidoCodigo, setPedidoCodigo] = useState<string | null>(null)
  const [pedidoId,     setPedidoId]     = useState<string | null>(null)
  const [erro, setErro]           = useState("")
  const [tipoEntrega, setTipoEntrega] = useState<"entrega" | "retirada">("entrega")
  // "Mora em zona rural / estrada de chão?" — obrigatória na entrega (2026-10-06). null =
  // ainda não respondeu. "Sim" soma R$5 + R$1/km acima de 5km na taxa (lib/frete.ts).
  const [zonaRural, setZonaRural] = useState<boolean | null>(null)
  // Detalhes de como chegar (só quando "Sim") — vai na observação do pedido, que o motoboy vê.
  const [detalheRural, setDetalheRural] = useState("")

  const [cupomValido,  setCupomValido]  = useState<{ id: string; codigo: string; tipo: "percentual" | "fixo" | "frete_gratis" | "frete_percentual"; valor: number } | null>(null)
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

  // Proteção contra pedido duplicado
  const [pedidoAtivoModal, setPedidoAtivoModal] = useState(false)
  const [pedidoAtivoCodigo, setPedidoAtivoCodigo] = useState("")

  // Endereço salvo
  type EnderecoSalvo = { display: string; rua: string; numero: string; bairro: string; cidade: string; complemento: string; lat: number; lng: number }
  const [enderecoSalvo,    setEnderecoSalvo]    = useState<EnderecoSalvo | null>(null)
  const [editandoEndereco, setEditandoEndereco] = useState(false)
  // Coordenadas do cliente vindas do mapa (usadas quando não há endereço salvo)
  const [clienteCoords, setClienteCoords] = useState<{lat:number;lng:number}|null>(null)

  const geoRef = useRef<{ geo: GeoResult; numero: string; complemento: string } | null>(null)
  // O que o cliente marcou/digitou no mapa. Separado do geoRef porque o perfil recarrega sozinho
  // quando o app volta pra tela (renovação do login no Supabase) e os efeitos do endereço salvo
  // regravavam o geoRef com o endereço antigo incompleto: o checkout pedia tudo de novo mesmo com
  // o mapa preenchido (Bar do Marcão 21/10 e cliente do Monte Sinai 22/10).
  const mapaRef = useRef<{ geo: GeoResult; numero: string; complemento: string } | null>(null)
  const editandoRef = useRef(false)
  useEffect(() => {
    editandoRef.current = editandoEndereco
    if (editandoEndereco) mapaRef.current = null  // mapa novo na tela: vale só o que for marcado nele
  }, [editandoEndereco])

  // Detecta plataforma para mostrar o método de pagamento correto
  useEffect(() => {
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(ua)) setPlataforma("ios")
    else if (/Android/.test(ua))     setPlataforma("android")
  }, [])

  // Carrega endereço salvo — localStorage primeiro, depois perfil do cadastro.
  // Se o perfil já tem um endereço cadastrado E ele diverge do que está em cache
  // (rua/número/bairro diferentes), o cache é descartado — sem essa checagem, um
  // cliente que atualizasse o endereço no cadastro continuava tendo pedidos criados
  // com as coordenadas do endereço ANTIGO, porque nada aqui comparava um com o outro.
  // Bug real reportado, 2026-09-27: pino no mapa do motoboy não batia com o endereço
  // do pedido. Roda de novo quando `perfil` carrega (pode vir depois do mount).
  useEffect(() => {
    let cache: EnderecoSalvo | null = null
    try {
      const raw = localStorage.getItem("arago_endereco_salvo")
      if (raw) cache = JSON.parse(raw)
    } catch {}
    if (!cache || editandoRef.current) return

    const norm = (s?: string) => (s ?? "").trim().toLowerCase()
    const perfilTemEndereco = !!perfil?.endereco_rua
    const bateComPerfil = !perfilTemEndereco || (
      norm(cache.rua)    === norm(perfil?.endereco_rua) &&
      norm(cache.numero) === norm(perfil?.endereco_numero) &&
      norm(cache.bairro) === norm(perfil?.endereco_bairro)
    )

    if (!bateComPerfil) {
      // Cache de um endereço diferente do cadastrado agora — descarta e deixa o efeito
      // abaixo (que depende de `perfil`/`enderecoSalvo`) geocodificar o endereço atual.
      try { localStorage.removeItem("arago_endereco_salvo") } catch {}
      setEnderecoSalvo(null)
      geoRef.current = null
      return
    }

    setEnderecoSalvo(cache)
    geoRef.current = {
      geo: { rua: cache.rua, bairro: cache.bairro, cidade: cache.cidade, lat: cache.lat, lng: cache.lng },
      numero: cache.numero,
      complemento: cache.complemento,
    }
  }, [perfil])

  // Se não há endereço salvo mas o perfil tem endereço cadastrado, geocodifica para obter lat/lng
  useEffect(() => {
    if (!perfil?.endereco_rua || enderecoSalvo || editandoRef.current) return
    const addrBase: EnderecoSalvo = {
      display: [perfil.endereco_rua, perfil.endereco_numero, perfil.endereco_bairro, perfil.endereco_cidade].filter(Boolean).join(", "),
      rua:         perfil.endereco_rua        ?? "",
      numero:      perfil.endereco_numero     ?? "",
      bairro:      perfil.endereco_bairro     ?? "",
      cidade:      perfil.endereco_cidade     ?? "",
      complemento: perfil.endereco_complemento ?? "",
      lat: 0, lng: 0,
    }
    // Seta imediatamente para mostrar o endereço, depois geocodifica para obter coords reais
    setEnderecoSalvo(addrBase)
    geoRef.current = { geo: { rua: addrBase.rua, bairro: addrBase.bairro, cidade: addrBase.cidade, lat: 0, lng: 0 }, numero: addrBase.numero, complemento: addrBase.complemento }

    // Geocodifica para obter coordenadas reais e permitir cálculo de frete — bias pela região
    // atendida (coordenadas da própria loja, quando já carregadas; nunca uma cidade fixa —
    // mesmo raciocínio do fallback de EnderecoMapa acima), senão um nome de rua comum pode
    // resolver pra outra cidade bem mais populosa.
    const biasLat = lojaData?.lat ?? LAT_DEFAULT
    const biasLng = lojaData?.lng ?? LNG_DEFAULT
    const query = [perfil.endereco_rua, perfil.endereco_numero, perfil.endereco_bairro, perfil.endereco_cidade].filter(Boolean).join(", ")
    fetch(`/api/geocode/search?q=${encodeURIComponent(query)}&lat=${biasLat}&lon=${biasLng}`)
      .then(r => r.json())
      .then(results => {
        if (!results[0]) return
        const lat = parseFloat(results[0].lat)
        const lng = parseFloat(results[0].lon)
        if (isNaN(lat) || isNaN(lng)) return
        console.log("[FRETE-DEBUG] perfil geocoded:", { lat, lng })
        const addr: EnderecoSalvo = { ...addrBase, lat, lng }
        setEnderecoSalvo(addr)
        geoRef.current = { geo: { rua: addrBase.rua, bairro: addrBase.bairro, cidade: addrBase.cidade, lat, lng }, numero: addrBase.numero, complemento: addrBase.complemento }
      })
      .catch(() => {/* geocoding opcional — sem coords usa taxa base */})
    // `lojaData` de propósito fora das deps: `enderecoSalvo` já é setado (síncrono, linha
    // acima) na primeira execução, então adicionar `lojaData` só faria o efeito rodar de
    // novo e sair pelo early-return sem refazer o geocode — não corrige nada, só confunde.
    // Esse bias é best-effort mesmo (evita não regredir o path principal, que é
    // EnderecoMapa/fallbackLat abaixo); se `lojaData` ainda não carregou aqui, cai no
    // fallback de Aragoiânia mesmo — aceitável pra esse caminho secundário.
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
  const [lojaData, setLojaData]   = useState<{ lat: number | null; lng: number | null; endereco: string; nome: string; taxa_entrega: number | null } | null>(null)
  const [taxaCalculando, setTaxaCalculando] = useState(false)
  const [clienteCidade, setClienteCidade] = useState("")
  const [clienteBairro, setClienteBairro] = useState("")

  useEffect(() => {
    if (!loja_id) return
    supabase.from("lojas").select("lat,lng,endereco,nome,taxa_entrega").eq("id", loja_id).single()
      .then(({ data }) => setLojaData(data as any))
  }, [loja_id])

  // Coordenadas/cidade/bairro do cliente que valem no momento (edição em aberto ou endereço salvo)
  const clienteLatAtual = editandoEndereco
    ? (clienteCoords?.lat && clienteCoords.lat !== 0 ? clienteCoords.lat : null)
    : (enderecoSalvo?.lat && enderecoSalvo.lat !== 0) ? enderecoSalvo.lat
      : (clienteCoords?.lat && clienteCoords.lat !== 0) ? clienteCoords.lat : null
  const clienteLngAtual = editandoEndereco
    ? (clienteCoords?.lng && clienteCoords.lng !== 0 ? clienteCoords.lng : null)
    : (enderecoSalvo?.lng && enderecoSalvo.lng !== 0) ? enderecoSalvo.lng
      : (clienteCoords?.lng && clienteCoords.lng !== 0) ? clienteCoords.lng : null
  const clienteCidadeAtual = editandoEndereco ? clienteCidade : (enderecoSalvo?.cidade || clienteCidade)
  const clienteBairroAtual = editandoEndereco ? clienteBairro : (enderecoSalvo?.bairro || clienteBairro)

  const [taxaEntrega, setTaxaEntrega] = useState<number>(6.00)
  // Frete grátis do aniversário de Aragoiânia (lib/freteGratisCampanha): o servidor decide pela distância
  const [freteCampanha, setFreteCampanha] = useState(false)
  const [taxaDinamica, setTaxaDinamica] = useState<number>(0)

  // Guarda a escolha "Retirar na loja" enquanto o checkout está aberto — sair pra "Editar"
  // dados/Perfil e voltar (ou o celular recarregar o app) remontava a página com o padrão
  // "entrega" sem o cliente perceber, e o pedido saía como entrega com taxa e motoboy
  // (pedidos BZEX48 e LTM77H, 2026-10-02).
  const tipoEntregaRestaurado = useRef(false)
  useEffect(() => {
    if (!loja_id || tipoEntregaRestaurado.current) return
    tipoEntregaRestaurado.current = true
    try {
      const salvo = sessionStorage.getItem(`checkout_tipo_entrega_${loja_id}`)
      if (salvo === "retirada" || salvo === "entrega") setTipoEntrega(salvo)
    } catch {}
  }, [loja_id])
  useEffect(() => {
    if (!loja_id || !tipoEntregaRestaurado.current) return
    try { sessionStorage.setItem(`checkout_tipo_entrega_${loja_id}`, tipoEntrega) } catch {}
  }, [loja_id, tipoEntrega])

  // Prévia da taxa de entrega — sempre pelo mesmo cálculo do servidor usado na criação
  // real do pedido (rota real via Mapbox, com fallback), pra nunca divergir do que é cobrado.
  // `cancelado`: troca entrega→retirada com o cálculo de frete da entrega ainda em
  // andamento fazia a resposta atrasada sobrescrever o R$0 da retirada — tela mostrava
  // "Retirada · Grátis" mas o total somava a taxa (bug real reportado, 2026-10-02).
  useEffect(() => {
    if (!loja_id) return
    if (tipoEntrega === "retirada") { setTaxaEntrega(0); setTaxaCalculando(false); return }
    let cancelado = false
    setTaxaCalculando(true)
    const params = new URLSearchParams({ loja_id, tipo_entrega: tipoEntrega })
    if (clienteLatAtual && clienteLngAtual) {
      params.set("lat", String(clienteLatAtual))
      params.set("lng", String(clienteLngAtual))
    }
    if (clienteCidadeAtual) params.set("cidade", clienteCidadeAtual)
    if (clienteBairroAtual) params.set("bairro", clienteBairroAtual)
    if (user?.id) params.set("cliente_id", user.id)
    if (zonaRural) params.set("zona_rural", "1")
    fetch(`/api/frete/calcular?${params}`)
      .then(r => r.json().catch(() => null))
      .then(json => {
        if (cancelado || !json) return
        if (typeof json.taxa_entrega === "number") { setTaxaEntrega(json.taxa_entrega); setFreteCampanha(json.frete_gratis === true); setTaxaDinamica(Number(json.taxa_dinamica) || 0) }
        // Ponto de entrega incoerente / zona rural sem ponto: avisa antes do cliente tentar pagar (2026-10-28)
        else if (typeof json.error === "string" && json.error.includes("marque no mapa")) setErro(json.error)
      })
      .catch(() => {})
      .finally(() => { if (!cancelado) setTaxaCalculando(false) })
    return () => { cancelado = true }
  }, [loja_id, tipoEntrega, clienteLatAtual, clienteLngAtual, clienteCidadeAtual, clienteBairroAtual, user?.id, zonaRural])

  // Polling PIX — verifica a cada 4s se o pagamento foi confirmado
  useEffect(() => {
    if (!pixModal || !pedidoId) return
    const interval = setInterval(async () => {
      const { data } = await supabase.from("pedidos").select("status").eq("id", pedidoId).single()
      if (data?.status && data.status !== "aguardando_pagamento") {
        clearInterval(interval)
        setPixModal(false)
        clear(); limparCupomSacola()
        try { localStorage.removeItem("arago_pix_pendente") } catch {}
        const stored = JSON.parse(localStorage.getItem("arago_pedido_ativo") ?? "{}")
        router.push(`/pedido/${stored.codigo || pedidoId}`)
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [pixModal, pedidoId]) // eslint-disable-line react-hooks/exhaustive-deps

  const taxaBase       = taxaEntrega
  const freteGratis    = cupomValido?.tipo === "frete_gratis" || (freteCampanha && tipoEntrega !== "retirada")
  const freteComDesconto = !freteGratis && cupomValido?.tipo === "frete_percentual"
  const taxa           = freteGratis ? 0
    : freteComDesconto ? Math.round(taxaBase * (1 - cupomValido!.valor / 100) * 100) / 100
    : taxaBase
  const subtotal    = total
  const desconto    = cupomValido && !freteGratis && !freteComDesconto
    ? cupomValido.tipo === "percentual"
      ? Math.round(subtotal * (cupomValido.valor / 100) * 100) / 100
      : Math.min(cupomValido.valor, subtotal)
    : 0
  const dinamica    = tipoEntrega === "retirada" ? 0 : taxaDinamica
  // Promoção Chegô 10% (lib/promoChego): o servidor confere e devolve 409 se o cadastro já usou
  const promo       = descontoPromo(items.map(i => ({ produto_id: i.produto_id ?? i.id, preco: i.preco, quantidade: i.quantidade })), usadosPromo)
  const descPromo   = Math.min(promo.total, Math.max(0, subtotal - desconto))
  const totalFinal  = Math.max(0, subtotal - desconto - descPromo) + taxa + dinamica
  const divide      = dividir && !!pagamento2 && pagamento !== "google_pay"
  const valor1      = divide ? Number(valor1Txt.replace(/\./g, "").replace(",", ".")) || 0 : totalFinal
  const valor2      = divide ? Math.round((totalFinal - valor1) * 100) / 100 : 0
  const usaForma    = (f: string) => pagamento === f || (divide && pagamento2 === f)
  const valorDe     = (f: string) => !divide ? (pagamento === f ? totalFinal : 0) : (pagamento === f ? valor1 : 0) + (pagamento2 === f ? valor2 : 0)

  // Cupom vem da Sacola (layout da proposta). Aqui só confere de novo com o endereço escolhido
  // e com o subtotal atual; se não valer mais, avisa e o pedido segue sem desconto.
  const codigoSacola = typeof window !== "undefined" ? lerCupomSacola(loja_id) : null
  useEffect(() => {
    if (!codigoSacola || !loja_id || subtotal <= 0) { setCupomValido(null); setCupomErro(""); return }
    let cancelado = false
    setValidandoCupom(true)
    validarCupom({ codigo: codigoSacola, lojaId: loja_id, subtotal, lat: clienteLatAtual, lng: clienteLngAtual, cidade: clienteCidadeAtual})
      .then(r => {
        if (cancelado) return
        if (r.ok) { setCupomValido(r.cupom); setCupomErro("") }
        else { setCupomValido(null); setCupomErro(`O cupom ${codigoSacola} não vale neste pedido: ${r.erro}`) }
      })
      .finally(() => { if (!cancelado) setValidandoCupom(false) })
    return () => { cancelado = true }
  }, [codigoSacola, loja_id, subtotal, clienteLatAtual, clienteLngAtual, clienteCidadeAtual])


  function fmtCardNumber(v: string) {
    return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim()
  }
  function fmtExpiry(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 4)
    return d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d
  }

  if (items.length === 0 && !pedidoCodigo) {
    return (
      <div className="cn checkout-novo">
        <div className="vazio" style={{ paddingTop: 120 }}>
          <div style={{ fontSize: 52 }}>🛍️</div>
          <div className="h2" style={{ margin: "12px 0 6px" }}>Sua sacola está vazia</div>
          <Link className="btn btn-p" href="/" style={{ marginTop: 18 }}>Ver lojas</Link>
        </div>
      </div>
    )
  }

  if (pedidoCodigo) {
    return (
      <div className="cn checkout-novo" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}>
        <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
          <div className="ok-ic grande">✓</div>
          <h1 className="h1" style={{ marginTop: 14 }}>Pedido feito!</h1>
          <p className="mut" style={{ marginTop: 6, fontSize: 15 }}>A loja vai confirmar em instantes.</p>
          <div className="cartao" style={{ padding: "20px 18px", margin: "22px 0 18px" }}>
            <p className="mut" style={{ fontSize: 13 }}>Código do pedido</p>
            <p className="codigo-grande">#{pedidoCodigo}</p>
            <p className="mut" style={{ fontSize: 12.5, marginTop: 6 }}>Guarde pra acompanhar e confirmar a entrega.</p>
          </div>
          <Link className="btn btn-p" href={`/pedido/${pedidoCodigo}`}>Acompanhar pedido</Link>
          <Link className="btn btn-s" href="/" style={{ marginTop: 10 }}>Voltar pro início</Link>
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
    // Verifica se já existe um pedido ativo em andamento
    const storedAtivo = localStorage.getItem("arago_pedido_ativo")
    if (storedAtivo) {
      try {
        const { codigo: codigoAtivo, id: idAtivo } = JSON.parse(storedAtivo)
        if (idAtivo) {
          const { data } = await supabase.from("pedidos").select("status").eq("id", idAtivo).maybeSingle()
          // Qualquer status em andamento. A lista antiga tinha "em_preparo" (não existe; o certo é
          // "preparando") e não avisava com o pedido em preparo: foi assim que saiu o #CNW8GC
          // repetindo o #ZT62CC já pago (Dudu Lanches, 05/11/2026).
          if (data?.status && !["entregue", "cancelado"].includes(data.status)) {
            setPedidoAtivoCodigo(codigoAtivo || idAtivo)
            setPedidoAtivoModal(true)
            return
          }
        }
      } catch { /* localStorage corrompido — ignora */ }
    }

    if (tipoEntrega === "entrega" && zonaRural === null) { setErro("Informe se você mora em zona rural ou estrada de chão"); return }
    if (tipoEntrega === "entrega" && zonaRural && detalheRural.trim().length < 5) { setErro("Descreva como chegar no seu endereço (zona rural)"); return }
    if (nome.trim().length < 5) { setErro("Informe seu nome completo"); return }
    const telDigits = telefone.replace(/\D/g, "")
    if (telDigits.length < 10) { setErro("Informe seu telefone com DDD (ex: 62 9 9999-9999)"); return }

    // CPF: estado local → perfil DB → metadados auth → busca no banco
    let cpfFinal = cpf.replace(/\D/g, "")
    if (cpfFinal.length !== 11) cpfFinal = (perfil?.cpf ?? "").replace(/\D/g, "")
    if (cpfFinal.length !== 11) cpfFinal = (user?.user_metadata?.cpf ?? "").replace(/\D/g, "")
    if (cpfFinal.length !== 11 && user?.id) {
      const { data: dbCliente } = await supabase.from("clientes").select("cpf").eq("id", user.id).maybeSingle()
      if (dbCliente?.cpf) { cpfFinal = dbCliente.cpf.replace(/\D/g, ""); setCpf(dbCliente.cpf) }
    }

    // PIX exige CPF (obrigação Asaas/Banco Central para pagamentos PIX)
    if (usaForma("pix") && cpfFinal.length !== 11) {
      setErro("Informe seu CPF para pagar via PIX (obrigatório pelo Banco Central)")
      return
    }

    let enderecoFinal = ""
    let latFinal: number | null = null
    let lngFinal: number | null = null

    if (tipoEntrega === "retirada") {
      enderecoFinal = `🏪 Retirada na loja — ${lojaData?.endereco ?? ""}`
    } else {
      const fonte  = (editandoEndereco || !enderecoSalvo) && mapaRef.current ? mapaRef.current : geoRef.current
      if (fonte !== geoRef.current) geoRef.current = fonte
      const geo    = fonte?.geo
      const numero = fonte?.numero ?? ""
      const comp   = fonte?.complemento ?? ""

      const erroEnd = erroEnderecoEntrega(geo?.rua ?? "", geo?.bairro ?? "", numero, comp)
      if (erroEnd) {
        // Endereço salvo incompleto → abre o mapa pra completar
        if (enderecoSalvo && !editandoEndereco) { setEditandoEndereco(true); setErro(`${erroEnd}. Complete o endereço abaixo.`) }
        else setErro(erroEnd)
        return
      }

      if (geo && geo.lat !== 0) {
        enderecoFinal = [
          [geo.rua, numero.trim()].filter(Boolean).join(", "),
          comp.trim(),
          [geo.bairro, geo.cidade].filter(Boolean).join(", "),
        ].filter(Boolean).join(" — ")
      } else {
        enderecoFinal = [
          [geo?.rua, numero.trim()].filter(Boolean).join(", "),
          comp.trim(),
          [geo?.bairro, geo?.cidade].filter(Boolean).join(", "),
        ].filter(Boolean).join(" — ")
      }
      latFinal = geo?.lat && geo.lat !== 0 ? geo.lat : null
      lngFinal = geo?.lng && geo.lng !== 0 ? geo.lng : null
    }

    if (!loja_id) { setErro("Erro: loja não identificada"); return }

    if (dividir && pagamento === "google_pay") { setErro("Google Pay não pode ser dividido. Escolha outra forma."); return }
    if (dividir && !pagamento2) { setErro("Escolha a segunda forma de pagamento."); return }
    if (divide && (valor1 < 1 || valor2 < 1)) { setErro(`Cada forma precisa ser de pelo menos R$ 1,00. O total é ${brl(totalFinal)}.`); return }

    if (usaForma("dinheiro") && precisaTroco) {
      const valor = parseFloat(trocoPara.replace(/\./g, "").replace(",", "."))
      const emDinheiro = valorDe("dinheiro")
      if (!valor || valor <= emDinheiro) { setErro(`Informe um valor maior que ${brl(emDinheiro)} pra calcular o troco`); return }
    }

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
      usaForma("maquininha") ? `💳 Maquininha: ${tipoMaquininha === "credito" ? "Crédito" : "Débito"}` : "",
      tipoEntrega === "entrega" && zonaRural ? `🚜 Zona rural / estrada de chão — Como chegar: ${detalheRural.trim()}` : "",
      obs.trim(),
    ].filter(Boolean).join(" | ")

    const trocoParaEnviar = usaForma("dinheiro") && precisaTroco && trocoPara
      ? parseFloat(trocoPara.replace(/\./g, "").replace(",", "."))
      : null

    // Cria pedido via API server-side — preços validados no servidor, nunca no cliente
    const criarRes = await fetch("/api/pedido/criar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loja_id,
        cliente_id:       user?.id ?? null,
        items:            items.map(i => ({ produto_id: i.produto_id ?? i.id, quantidade: i.quantidade, observacao: i.observacao ?? "", adicionais: i.adicionais ?? [] })),
        forma_pagamento:  pagamento,
        forma_pagamento_2: divide ? pagamento2 : null,
        valor_pagamento_1: divide ? valor1 : null,
        tipo_entrega:     tipoEntrega,
        zona_rural:       tipoEntrega === "entrega" ? zonaRural === true : false,
        endereco_entrega: enderecoFinal,
        lat_entrega:      latFinal,
        lng_entrega:      lngFinal,
        cidade_entrega:   enderecoSalvo?.cidade || geoRef.current?.geo?.cidade || "",
        bairro_entrega:   enderecoSalvo?.bairro || geoRef.current?.geo?.bairro || "",
        observacao:       obsCompleta,
        troco_para:       trocoParaEnviar,
        cupom_codigo:     cupomValido?.codigo ?? null,
        desconto_promo_visto: descPromo,
        nome_cliente:     nome.trim() || null,
        telefone_cliente: telefone.trim() || null,
        email_cliente:    user?.email ?? null,
        cpf_cliente:      cpfFinal || null,
      }),
    }).then(r => r.json())

    if (criarRes.error || !criarRes.pedido_id) {
      // Promoção Chegô: cadastro já usou ou a campanha acabou; recalcula o total na tela
      if (Array.isArray(criarRes.promo_usados)) setUsadosPromo(Number(criarRes.promo_desconto) === 0 ? Object.keys(PROMO_PRODUTOS) : criarRes.promo_usados)
      // Ponto de entrega incoerente ou zona rural sem ponto: abre o mapa pra marcar (2026-10-28)
      if (typeof criarRes.error === "string" && criarRes.error.includes("marque no mapa") && tipoEntrega === "entrega") setEditandoEndereco(true)
      setErro(criarRes.error ?? "Erro ao criar pedido. Tente novamente.")
      setEnviando(false)
      return
    }

    const { pedido_id: pedidoIdNovo, codigo, total: totalServidor, cliente_push_token } = criarRes
    if (Number(criarRes.desconto_promo ?? descPromo) > 0) recarregarPromoUsados()
    const pedido = { id: pedidoIdNovo }
    if (cliente_push_token) localStorage.setItem(`arago_tkn_${codigo}`, cliente_push_token)

    // ─── Cartão: processa via Asaas ──────────────────────────────────────
    if (usaForma("cartao")) {
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
          if (verificar.confirmado || (cartaoRes.payment_id && verificar.confirmados?.includes(cartaoRes.payment_id))) { confirmado = true; break }
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

    // ─── PIX: gera QR code e abre modal (depois do cartão quando o pedido tem os dois) ──────────────────────────────────
    if (usaForma("pix")) {
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
      // Salva no histórico de pedidos de visitantes
      try {
        const rawGuest = localStorage.getItem("arago_pedidos_guest")
        const pedidosGuest: Array<{ codigo: string; id: string; loja_nome: string; total: number; criado_em: string }> =
          rawGuest ? JSON.parse(rawGuest) : []
        pedidosGuest.unshift({
          codigo,
          id: pedido.id,
          loja_nome: items[0]?.loja_nome ?? "",
          total: totalServidor,
          criado_em: new Date().toISOString(),
        })
        localStorage.setItem("arago_pedidos_guest", JSON.stringify(pedidosGuest.slice(0, 20)))
      } catch {}
      // Sacola só esvazia quando o Pix for pago; se o cliente sair desta tela (foi pagar no app do
      // banco), o CartProvider confere isso quando ele voltar (lib/cart.tsx)
      try { localStorage.setItem("arago_pix_pendente", pedido.id) } catch {}
      setPixQrcode(pixRes.qrcode)
      setPixCopiaECola(pixRes.copia_cola)
      setPixModal(true)
      setEnviando(false)
      return
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
      // Persiste no perfil do banco para outros dispositivos
      if (user && perfil) {
        salvarPerfil(perfil.nome, perfil.telefone, {
          rua: g.rua, numero: num, bairro: g.bairro,
          cidade: g.cidade, complemento: cmp,
        }).catch(() => {})
      }
    }

    // Cadastro antigo sem telefone — como o campo apareceu no checkout e foi preenchido
    // agora, salva no perfil pra não pedir de novo nos próximos pedidos.
    if (user && perfil && !perfil.telefone && telDigits.length >= 10) {
      salvarPerfil(perfil.nome, telefone).catch(() => {})
    }

    // Salva cartão (sem CVV, com token se disponível) se LGPD consentido
    if (usaForma("cartao") && salvarCartao && lgpdConsent) {
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

    clear(); limparCupomSacola()
    setPedidoCodigo(codigo)
    setPedidoId(pedido.id)
    setEnviando(false)
    // Salva referência do pedido ativo para o cliente conseguir voltar ao rastreamento
    localStorage.setItem("arago_pedido_ativo", JSON.stringify({ codigo, id: pedido.id }))
    // Salva no histórico de pedidos de visitantes (sem login) para rastreamento posterior
    try {
      const rawGuest = localStorage.getItem("arago_pedidos_guest")
      const pedidosGuest: Array<{ codigo: string; id: string; loja_nome: string; total: number; criado_em: string }> =
        rawGuest ? JSON.parse(rawGuest) : []
      pedidosGuest.unshift({
        codigo,
        id: pedido.id,
        loja_nome: items[0]?.loja_nome ?? "",
        total: totalFinal,
        criado_em: new Date().toISOString(),
      })
      // Mantém apenas os últimos 20 pedidos
      localStorage.setItem("arago_pedidos_guest", JSON.stringify(pedidosGuest.slice(0, 20)))
    } catch {}
  }

  const naLoja = tipoEntrega === "retirada"
  const descPagamento: Record<string, string> = {
    pix: "Aprovação na hora",
    cartao: cartaoSalvo ? `Final ${cartaoSalvo.last4}, pelo app` : "Crédito, pelo app",
    google_pay: "Pague com sua conta Google",
    dinheiro: naLoja ? "Pague quando retirar" : "Pague ao entregador",
    maquininha: naLoja ? "Crédito ou débito, na retirada" : "O entregador leva",
  }
  const nomePagamento: Record<string, string> = {
    pix: "Pix", cartao: "Cartão de crédito", google_pay: "Google Pay",
    dinheiro: naLoja ? "Dinheiro no balcão" : "Dinheiro",
    maquininha: naLoja ? "Cartão no balcão" : "Maquininha na entrega",
  }
  const opcoesPg = PAGAMENTOS.filter(p => p.platforms.includes(plataforma))
  // Detalhes de cada forma (layout da proposta, 20/10/2026): aparecem embaixo da forma escolhida,
  // tanto na lista normal quanto nos blocos de "Pagar com 2 formas".
  const detalheCartao = (
        <div className="sub-op" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {cartaoSalvo && usarSalvo && cardToken ? (
            <>
              <div className="cartao-salvo">
                <CardLogo />
                <span style={{ flex: 1 }}><b>•••• •••• •••• {cartaoSalvo.last4}</b><small>{cartaoSalvo.nome}, validade {cartaoSalvo.validade}</small></span>
                <button onClick={() => { setCartaoSalvo(null); setCardToken(null); setUsarSalvo(false); localStorage.removeItem("arago_cartao") }}>Trocar</button>
              </div>
              {cardCpf.replace(/\D/g, "").length !== 11 && cpf.replace(/\D/g, "").length !== 11 && (perfil?.cpf ?? "").replace(/\D/g, "").length !== 11 && (
                <label className="campo"><span>CPF do titular *</span>
                  <input value={cardCpf} onChange={e => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 11)
                    setCardCpf(d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4").replace(/(\d{3})(\d{3})(\d{1,3})$/, "$1.$2.$3"))
                  }} placeholder="000.000.000-00" inputMode="numeric" /></label>
              )}
            </>
          ) : (
            <>
              <label className="campo"><span>Número do cartão *</span>
                <input value={cardNumber} onChange={e => setCardNumber(fmtCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" inputMode="numeric" autoComplete="cc-number" /></label>
              <label className="campo"><span>Nome no cartão *</span>
                <input value={cardName} onChange={e => setCardName(e.target.value.toUpperCase())} placeholder="JOÃO A SILVA" autoCapitalize="characters" autoComplete="cc-name" /></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label className="campo"><span>Validade *</span>
                  <input value={cardExpiry} onChange={e => setCardExpiry(fmtExpiry(e.target.value))} placeholder="MM/AA" inputMode="numeric" autoComplete="cc-exp" /></label>
                <label className="campo"><span>CVV *</span>
                  <input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="•••" type="password" inputMode="numeric" autoComplete="cc-csc" /></label>
              </div>
              <label className="campo"><span>CPF do titular *</span>
                <input value={cardCpf} onChange={e => {
                  const d = e.target.value.replace(/\D/g, "").slice(0, 11)
                  setCardCpf(d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4").replace(/(\d{3})(\d{3})(\d{1,3})$/, "$1.$2.$3"))
                }} placeholder="000.000.000-00" inputMode="numeric" /></label>
              <label className="marca-linha">
                <input type="checkbox" checked={lgpdConsent} onChange={e => { setLgpdConsent(e.target.checked); if (!e.target.checked) setSalvarCartao(false) }} />
                <span>Autorizo guardar os dados do cartão com segurança pra próximas compras (LGPD). O CVV nunca fica salvo.</span>
              </label>
              {lgpdConsent && (
                <label className="marca-linha">
                  <input type="checkbox" checked={salvarCartao} onChange={e => setSalvarCartao(e.target.checked)} />
                  <span><b>Salvar cartão pra próximas compras</b></span>
                </label>
              )}
            </>
          )}
        </div>
  )
  const detalheMaquininha = (
        <div className="sub-op">
          <div className="modo" style={{ margin: 0 }}>
            {(["credito", "debito"] as const).map(t => (
              <button key={t} type="button" aria-pressed={tipoMaquininha === t} onClick={() => setTipoMaquininha(t)}>{t === "credito" ? "Crédito" : "Débito"}</button>
            ))}
          </div>
        </div>
  )
  const detalheDinheiro = (
    <div className="sub-op">
      <label className="campo" style={{ margin: 0 }}><span>Troco pra quanto? <small className="mut">(deixe vazio se não precisar)</small></span>
        <input value={trocoPara} onChange={e => { const v = mascaraBRL(e.target.value); setTrocoPara(v); setPrecisaTroco(!!v) }} placeholder="Ex.: R$ 100,00" inputMode="numeric" /></label>
    </div>
  )
  const detalheDe = (f: string) => f === "cartao" ? detalheCartao : f === "dinheiro" ? detalheDinheiro : f === "maquininha" && !naLoja ? detalheMaquininha : null

  const opcaoPagamento = (p: typeof PAGAMENTOS[number]) => (
    <div key={p.value}>
      <button className="pg" role="radio" aria-checked={pagamento === p.value} disabled={p.breve} onClick={() => { if (!p.breve) setPagamento(p.value) }}>
        <span className="ic"><PaymentIcon method={p.value} naLoja={naLoja} /></span>
        <span className="n"><b>{nomePagamento[p.value]}{p.breve ? " (em breve)" : ""}</b><small>{descPagamento[p.value]}</small></span>
        <span className="radio" />
      </button>
      {pagamento === p.value && detalheDe(p.value)}
    </div>
  )

  // Pagar com 2 formas (proposta): bloco "Primeira forma" e "Segunda forma"
  const FORMAS_DIV: { f: FormaPagamento; n: string }[] = [
    { f: "pix", n: "Pix" }, { f: "cartao", n: "Cartão" },
    { f: "maquininha", n: naLoja ? "Cartão balcão" : "Maquininha" }, { f: "dinheiro", n: "Dinheiro" },
  ]
  const nomeCurto = (f: string) => FORMAS_DIV.find(x => x.f === f)?.n ?? f
  const noNa = (f: string) => `${f === "maquininha" && !naLoja ? "na" : "no"} ${f === "pix" ? "Pix" : nomeCurto(f).toLowerCase()}`
  const blocoParte = (k: 1 | 2) => {
    const fx = k === 1 ? pagamento : pagamento2
    const outro = k === 1 ? pagamento2 : pagamento
    return (
      <div className="cartao parte">
        <div className="rot">
          <b className="h3">{k === 1 ? "Primeira forma" : "Segunda forma"}</b>
          {k === 1 && <button type="button" style={{ color: "var(--pimenta)", fontWeight: 700, fontSize: 13.5 }} onClick={() => setValor1Txt(mascaraBRL(String(Math.round(totalFinal * 50))))}>Dividir na metade</button>}
        </div>
        <div className="formas3">
          {FORMAS_DIV.map(({ f, n }) => (
            <button key={f} type="button" aria-pressed={fx === f} disabled={outro === f}
              onClick={() => k === 1 ? setPagamento(f) : setPagamento2(f)}>
              <span><PaymentIcon method={f} naLoja={naLoja} pequeno /></span>{n}
            </button>
          ))}
        </div>
        {k === 1
          ? <label className="campo" style={{ margin: 0 }}><span>Quanto {noNa(pagamento)}?</span>
              <input value={valor1Txt} onChange={e => setValor1Txt(mascaraBRL(e.target.value))} placeholder="R$ 0,00" inputMode="numeric" /></label>
          : <div className="resto"><span>Restante {fx ? noNa(fx) : ""}</span><b>{brl(Math.max(0, Math.round((totalFinal - valor1) * 100) / 100))}</b></div>}
        {fx && detalheDe(fx)}
      </div>
    )
  }


  const copiarPix = () => {
    const ok = () => { setPixCopiado(true); setTimeout(() => setPixCopiado(false), 3000) }
    const antigo = () => {
      // iPhone sem permissão de área de transferência: copia pelo jeito antigo, que o Safari aceita
      const x = document.createElement("textarea")
      x.value = pixCopiaECola; x.setAttribute("readonly", ""); x.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px"
      document.body.appendChild(x); x.focus(); x.select(); x.setSelectionRange(0, pixCopiaECola.length)
      let r = false; try { r = document.execCommand("copy") } catch {}
      x.remove(); if (r) ok()
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(pixCopiaECola).then(ok, antigo)
    else antigo()
  }

  return (
    <div className="cn checkout-novo">
      <div className="topo branco">
        <div className="linha-topo">
          <button className="voltar" onClick={() => router.back()} aria-label="Voltar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
          <span className="h2" style={{ flex: 1 }}>Finalizar pedido</span>
          {!user && <Link href="/cliente/entrar" style={{ color: "var(--pimenta)", fontWeight: 700, fontSize: 14 }}>Entrar</Link>}
        </div>
      </div>

      <div style={{ padding: "14px 12px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

        <div className="modo" style={{ margin: 0, background: "#E6E5E1" }}>
          <button aria-pressed={tipoEntrega === "entrega"} onClick={() => setTipoEntrega("entrega")}>Entrega</button>
          <button aria-pressed={tipoEntrega === "retirada"} onClick={() => setTipoEntrega("retirada")}>Retirar na loja</button>
        </div>

        {/* Onde */}
        {naLoja ? (
          <div className="cartao end-card">
            <span className="ic">🏪</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b className="h3">{lojaData?.nome ?? items[0]?.loja_nome}</b><br />
              <small className="mut">{lojaData?.endereco ?? ""}</small><br />
              <small className="verde" style={{ fontWeight: 700 }}>Retirada grátis</small>
            </span>
          </div>
        ) : enderecoSalvo && !editandoEndereco ? (
          <div className="cartao end-card">
            <span className="ic">📍</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b className="h3">{enderecoSalvo.rua}{enderecoSalvo.numero ? `, ${enderecoSalvo.numero}` : ""}</b><br />
              <small className="mut">{[enderecoSalvo.complemento, enderecoSalvo.bairro, enderecoSalvo.cidade].filter(Boolean).join(", ")}</small>
            </span>
            <button style={{ color: "var(--pimenta)", fontWeight: 700, fontSize: 13.5, flex: "none" }} onClick={() => setEditandoEndereco(true)}>Trocar</button>
          </div>
        ) : (
          <div className="cartao" style={{ padding: 14 }}>
            <span className="h3" style={{ display: "block", marginBottom: 10 }}>Onde entregar?</span>
            <EnderecoMapa
              fallbackLat={lojaData?.lat}
              fallbackLng={lojaData?.lng}
              onResult={(geo, numero, complemento) => {
                geoRef.current = mapaRef.current = { geo, numero, complemento }
                if (geo.lat && geo.lng) setClienteCoords({ lat: geo.lat, lng: geo.lng })
                if (geo.cidade) setClienteCidade(geo.cidade)
                if (geo.bairro) setClienteBairro(geo.bairro)
              }}
            />
            {editandoEndereco && (
              <button className="btn btn-g" style={{ marginTop: 12 }}
                onClick={() => {
                  const g = mapaRef.current ?? geoRef.current
                  if (g) {
                    geoRef.current = g
                    const erroEnd = erroEnderecoEntrega(g.geo.rua, g.geo.bairro, g.numero, g.complemento)
                    if (erroEnd) { setErro(erroEnd); return }
                    setErro("")
                    const novoEndereco: EnderecoSalvo = {
                      display: [g.geo.rua, g.numero, g.geo.bairro, g.geo.cidade].filter(Boolean).join(", "),
                      rua: g.geo.rua,
                      numero: g.numero,
                      bairro: g.geo.bairro,
                      cidade: g.geo.cidade,
                      complemento: g.complemento,
                      lat: g.geo.lat,
                      lng: g.geo.lng,
                    }
                    setEnderecoSalvo(novoEndereco)
                    localStorage.setItem("arago_endereco_salvo", JSON.stringify(novoEndereco))
                    // Persiste no banco para outros dispositivos
                    if (user && perfil) {
                      salvarPerfil(perfil.nome, perfil.telefone, {
                        rua: g.geo.rua, numero: g.numero, bairro: g.geo.bairro,
                        cidade: g.geo.cidade, complemento: g.complemento,
                      }).catch(() => {})
                    }
                  }
                  setEditandoEndereco(false)
                }}>
                Usar este endereço
              </button>
            )}
            {editandoEndereco && erro && <p className="erro-linha">{erro}</p>}
          </div>
        )}

        {/* Zona rural / estrada de chão — obrigatória na entrega */}
        {!naLoja && (
          <div className={`cartao ${zonaRural === null ? "pede" : ""}`} style={{ padding: 16 }}>
            <span className="h3" style={{ display: "block", marginBottom: 10 }}>Você mora em zona rural ou estrada de chão? *</span>
            <div className="modo" style={{ margin: 0 }}>
              {([[true, "Sim"], [false, "Não"]] as const).map(([v, label]) => (
                <button key={label} type="button" aria-pressed={zonaRural === v} onClick={() => setZonaRural(v)}>{label}</button>
              ))}
            </div>
            {zonaRural && (
              <label className={`campo ${detalheRural.trim().length < 5 ? "falta" : ""}`} style={{ marginTop: 12 }}>
                <span>Como chegar no seu endereço? *</span>
                <textarea value={detalheRural} onChange={e => setDetalheRural(e.target.value)} maxLength={400} rows={3}
                  placeholder="Ex.: saindo da GO-040, entrar na estrada de chão depois do posto, 2ª porteira à direita, casa amarela" />
              </label>
            )}
          </div>
        )}

        {/* Seus dados */}
        <div className="cartao" style={{ padding: 16 }}>
          <span className="h3" style={{ display: "block", marginBottom: 10 }}>Seus dados</span>
          {user && (nome || perfil?.nome) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="avatar-ck">{(nome || perfil?.nome || "?").trim().charAt(0).toUpperCase()}</span>
                <span style={{ flex: 1, minWidth: 0 }}><b style={{ color: "var(--grafite)" }}>{nome || perfil?.nome}</b>{(telefone || perfil?.telefone) && <small className="mut" style={{ display: "block", fontSize: 13 }}>{telefone || perfil?.telefone}</small>}</span>
                <Link href="/cliente/alterar-dados" style={{ color: "var(--pimenta)", fontWeight: 700, fontSize: 13.5 }}>Editar</Link>
              </div>
              {!(telefone || perfil?.telefone) && (
                <label className="campo"><span>Seu WhatsApp * <small className="mut">(seu cadastro está sem telefone)</small></span>
                  <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(62) 9 9999-1234" inputMode="tel" /></label>
              )}
              {usaForma("pix") && !(user && (perfil?.cpf || user?.user_metadata?.cpf)) && (
                <label className={`campo ${cpf.replace(/\D/g, "").length !== 11 ? "falta" : ""}`}><span>CPF * <small className="mut">obrigatório pro Pix</small></span>
                  <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} /></label>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label className="campo"><span>Seu nome *</span>
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome e sobrenome" autoComplete="name" /></label>
              <label className="campo"><span>WhatsApp *</span>
                <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(62) 9 9999-1234" inputMode="tel" autoComplete="tel" /></label>
              {(usaForma("pix") || !(user && (perfil?.cpf || user?.user_metadata?.cpf))) && (
                <label className={`campo ${usaForma("pix") && cpf.replace(/\D/g, "").length !== 11 ? "falta" : ""}`}>
                  <span>CPF {usaForma("pix") ? <small style={{ color: "var(--pimenta)" }}>obrigatório pro Pix</small> : <small className="mut">(opcional)</small>}</span>
                  <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} /></label>
              )}
            </div>
          )}
        </div>

        {/* Pagamento (layout da proposta): interruptor "Pagar com 2 formas" antes das formas */}
        <div>
          <div className="cartao dividir">
            <span><b className="h3">Pagar com 2 formas</b><small>Ex.: parte no Pix e parte no cartão ou no dinheiro</small></span>
            <button type="button" className="sw" role="switch" aria-checked={dividir} aria-label="Pagar com 2 formas" onClick={() => {
              const liga = !dividir
              setDividir(liga)
              if (liga) {
                const f1 = pagamento === "google_pay" ? "pix" : pagamento
                setPagamento(f1)
                if (!pagamento2 || pagamento2 === f1) setPagamento2(f1 === "dinheiro" ? "pix" : "dinheiro")
                if (!valor1Txt) setValor1Txt(mascaraBRL(String(Math.round(totalFinal * 50))))
              }
            }} />
          </div>
          {dividir ? (
            <>
              {blocoParte(1)}
              {blocoParte(2)}
              <p className="mut" style={{ fontSize: 12.5, margin: "2px 4px 0", lineHeight: 1.5 }}>
                {usaForma("pix") || usaForma("cartao")
                  ? `A parte ${usaForma("pix") && usaForma("cartao") ? "do Pix e a do cartão são pagas" : usaForma("pix") ? "do Pix é paga" : "do cartão é paga"} agora pelo app${usaForma("dinheiro") || usaForma("maquininha") ? `; o resto, ${naLoja ? "no balcão" : "quando o entregador chegar"}.` : "."}`
                  : `As duas partes são pagas ${naLoja ? "no balcão" : "ao entregador"}.`}
              </p>
              {valor1 >= totalFinal && <p className="erro-linha">O valor da primeira forma precisa ser menor que o total ({brl(totalFinal)}).</p>}
            </>
          ) : (
            <>
              <div className="sec"><span className="h2">Pagar pelo app</span></div>
              {opcoesPg.filter(p => ["pix", "cartao", "google_pay"].includes(p.value)).map(opcaoPagamento)}
              <div className="sec"><span className="h2">{naLoja ? "Pagar na loja" : "Pagar na entrega"}</span></div>
              {["maquininha", "dinheiro"].map(v => opcoesPg.find(p => p.value === v)).filter((p): p is typeof PAGAMENTOS[number] => !!p).map(opcaoPagamento)}
            </>
          )}
        </div>

        <label className="campo">
          <span>💬 Observação pra loja (opcional)</span>
          <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} placeholder="Ex.: capricha no molho, mandar talheres, interfone quebrado" />
        </label>



        {/* Resumo */}
        <div className="cartao contas" style={{ padding: "14px 16px" }}>
          {items.map(i => <div key={i.id}><span>{i.quantidade}× {i.nome}</span><span>{brl(i.preco * i.quantidade)}</span></div>)}
          <div style={{ borderTop: "1px solid var(--linha)", marginTop: 6, paddingTop: 10 }}><span>Subtotal</span><span>{brl(subtotal)}</span></div>
          <div>
            <span>{naLoja ? "Retirada" : "Entrega"}</span>
            <span className={taxa === 0 || freteComDesconto ? "verde" : ""}>
              {naLoja ? "Grátis"
                : freteGratis ? <>Grátis <s className="mut">{brl(taxaBase)}</s></>
                : taxaCalculando ? "Calculando…"
                : freteComDesconto ? <>{brl(taxa)} <s className="mut">{brl(taxaBase)}</s></>
                : taxa === 0 ? "Grátis"
                : brl(taxa)}
            </span>
          </div>
          {freteCampanha && !naLoja && !taxaCalculando && <p className="verde" style={{ fontSize: 13, marginTop: 2 }}>Frete grátis no aniversário de Aragoiânia, pago pelo Chegô.</p>}
          {dinamica > 0 && !taxaCalculando && <div><span>Corrida dinâmica (chuva)</span><span>+ {brl(dinamica)}</span></div>}
          {desconto > 0 && <div><span>Desconto ({cupomValido?.codigo})</span><span className="verde">− {brl(desconto)}</span></div>}
          {descPromo > 0 && <div><span>DESCONTO PROMOCIONAL — CUSTEADO PELO CHEGÔ</span><span className="verde">− {brl(descPromo)}</span></div>}
          {descPromo > 0 && <p className="verde" style={{ fontSize: 13, marginTop: 4 }}>Você economiza {brl(descPromo)} nesse pedido. O desconto vale em 1 unidade de cada produto da promoção e é pago pelo Chegô, não pela loja.</p>}
          {cupomValido && desconto === 0 && <p className="verde" style={{ fontSize: 13, marginTop: 4 }}>Cupom {cupomValido.codigo}: {descricaoCupom(cupomValido, brl)}</p>}
          {cupomErro && <p className="aviso-amarelo" style={{ margin: "8px 0 0" }}>{cupomErro}</p>}
          <div className="tot"><span>Total</span><span>{brl(totalFinal)}</span></div>
        </div>

      </div>

      <div className="rodape-fixo grudado" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
        {/* O aviso também aparece aqui, colado no botão: lá embaixo da página ele ficava fora da
            tela e parecia que "Fazer pedido" não fazia nada (Lucas, 20/10/2026). */}
        {erro && !editandoEndereco && <p role="alert" className="aviso-vermelho" style={{ margin: 0, fontSize: 14 }}>{erro}</p>}
        <button className="btn btn-p" style={{ flex: "none" }} onClick={confirmar} disabled={enviando || taxaCalculando || validandoCupom}>
          {enviando ? "Enviando…"
            : taxaCalculando ? "Calculando a entrega…"
            : `Fazer pedido · ${brl(totalFinal)}`}
        </button>
      </div>

      {/* Pedido em andamento */}
      {pedidoAtivoModal && (
        <div className="cn-veu on centro">
          <div className="cn caixa" style={{ textAlign: "center", gap: 12 }}>
            <div style={{ fontSize: 40 }}>🛵</div>
            <div className="h2">Você já tem um pedido em andamento</div>
            <p className="mut" style={{ lineHeight: 1.5, fontSize: 14 }}>O pedido <b style={{ color: "var(--pimenta)" }}>#{pedidoAtivoCodigo}</b> ainda está em andamento. Quer fazer outro pedido mesmo assim?</p>
            <button className="btn btn-p" onClick={() => { setPedidoAtivoModal(false); router.push(`/pedido/${pedidoAtivoCodigo}`) }}>Ver meu pedido</button>
            <button className="btn btn-s" onClick={() => { localStorage.removeItem("arago_pedido_ativo"); setPedidoAtivoModal(false); confirmar() }}>Fazer outro pedido</button>
          </div>
        </div>
      )}

      {/* Pix */}
      {pixModal && (
        // Tela cheia "Pagamento Pix", igual à proposta (antes era uma folha por cima do Finalizar)
        <div className="cn pix-tela">
          <div className="topo branco">
            <div className="linha-topo">
              <button className="voltar" aria-label="Ver meu pedido" onClick={() => {
                const cod = (() => { try { return JSON.parse(localStorage.getItem("arago_pedido_ativo") ?? "{}").codigo } catch { return null } })()
                router.push(cod ? `/pedido/${cod}` : "/cliente/historico")
              }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
              <span className="h2" style={{ flex: 1 }}>Pagamento Pix</span>
            </div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            <div style={{ padding: "18px 22px calc(env(safe-area-inset-bottom,0px) + 40px)", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><PixLogo t={44} /></div>
              <div className="h1" style={{ fontSize: 24 }}>Pague {brl(valorDe("pix") || totalFinal)} com Pix</div>
              {divide && (usaForma("dinheiro") || usaForma("maquininha")) && <p className="mut" style={{ marginTop: 4 }}>O restante, {brl(valorDe("dinheiro") + valorDe("maquininha"))}, você paga {naLoja ? "no balcão" : "na entrega"} ({usaForma("dinheiro") ? "dinheiro" : "maquininha"}).</p>}
              <p className="mut" style={{ marginTop: 6 }}>{divide && usaForma("cartao") ? "O cartão já foi aprovado. O pedido vai pra loja assim que o Pix cair." : "O pedido vai pra loja assim que o pagamento cair."}</p>
              <div className="qr">
                {pixQrcode ? <img src={`data:image/png;base64,${pixQrcode}`} alt="QR Code do Pix" /> : <span className="mut" style={{ display: "grid", placeItems: "center", height: "100%" }}>Gerando o QR Code…</span>}
              </div>
              {pixCopiaECola && (
                <div className="copia" style={{ margin: "4px 0 16px" }}>
                  <span style={{ flex: 1 }}>{pixCopiaECola.slice(0, 70)}…</span>
                  <button onClick={copiarPix} style={{ background: pixCopiado ? "var(--folha)" : undefined }}>{pixCopiado ? "Copiado" : "Copiar"}</button>
                </div>
              )}
              <ol className="passos-pix">
                <li>Abra o app do seu banco e escolha Pix copia e cola.</li>
                <li>Cole o código e confira o valor.</li>
                <li>Pronto. Esta tela atualiza sozinha.</li>
              </ol>
              <p className="mut" style={{ fontSize: 13 }}>Aguardando a confirmação do pagamento…</p>
              <AjudaPagamentoWhats codigo={(() => { try { return JSON.parse(localStorage.getItem("arago_pedido_ativo") ?? "{}").codigo } catch { return null } })()} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
