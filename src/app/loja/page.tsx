"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import type { Pedido, StatusPedido } from "@/types"

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const play = (freq: number, start: number, dur: number) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = "sine"
      o.frequency.value = freq
      g.gain.setValueAtTime(0.4, ctx.currentTime + start)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      o.start(ctx.currentTime + start)
      o.stop(ctx.currentTime + start + dur)
    }
    play(880, 0, 0.15)
    play(1100, 0.18, 0.15)
    play(880, 0.36, 0.2)
  } catch {}
}

type DiaSemana = "dom" | "seg" | "ter" | "qua" | "qui" | "sex" | "sab"
type DiaConfig = { aberto: boolean; inicio: string; fim: string }
type Horarios = { tipo: "sempre_aberto" | "por_horario"; dias: Record<DiaSemana, DiaConfig> }

function deveEstarAberto(horarios: Horarios | null): boolean | null {
  if (!horarios) return null
  if (horarios.tipo === "sempre_aberto") return true
  const diasSemana: DiaSemana[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"]
  const agora = new Date()
  const diaAtual = diasSemana[agora.getDay()]
  const config = horarios.dias?.[diaAtual]
  if (!config || !config.aberto) return false
  const [hIni, mIni] = config.inicio.split(":").map(Number)
  const [hFim, mFim] = config.fim.split(":").map(Number)
  const minutos = agora.getHours() * 60 + agora.getMinutes()
  return minutos >= hIni * 60 + mIni && minutos < hFim * 60 + mFim
}

function imprimirPedido(pedido: Pedido) {
  const now  = new Date(pedido.criado_em)
  const data = now.toLocaleDateString("pt-BR")
  const hora = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

  const PGTO: Record<string, string> = {
    pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro",
    maquininha: "Maquininha", apple_pay: "Apple Pay", google_pay: "Google Pay",
  }

  const itensHtml = (pedido.itens ?? []).map((i: any) => `
    <tr>
      <td>${i.quantidade}x ${i.nome}</td>
      <td class="r">R$ ${(i.preco * i.quantidade).toFixed(2).replace(".", ",")}</td>
    </tr>
    ${i.observacao ? `<tr><td colspan="2" class="obs">  obs: ${i.observacao}</td></tr>` : ""}
  `).join("")

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Pedido #${pedido.codigo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      width: 76mm;
      padding: 3mm 4mm;
      color: #000;
    }
    h1 { font-size: 15px; text-align: center; letter-spacing: 1px; margin-bottom: 2px; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .r { text-align: right; white-space: nowrap; }
    .dash { border-top: 1px dashed #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1.5px 0; vertical-align: top; }
    .obs { color: #555; font-size: 10px; }
    .total-row td { font-size: 13px; font-weight: bold; padding-top: 4px; }
    .section { font-weight: bold; margin: 4px 0 2px; font-size: 11px; text-transform: uppercase; }
    @media print {
      body { margin: 0; }
      @page { margin: 2mm; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <h1>CHEGÔ</h1>
  <p class="center" style="font-size:10px;margin-bottom:4px;">DELIVERY</p>
  <div class="dash"></div>
  <p class="bold" style="font-size:14px;">PEDIDO #${pedido.codigo}</p>
  <p>${data} às ${hora}</p>
  <div class="dash"></div>
  <p class="section">Itens</p>
  <table>${itensHtml}</table>
  <div class="dash"></div>
  <table>
    <tr><td>Subtotal</td><td class="r">R$ ${(pedido.subtotal ?? 0).toFixed(2).replace(".", ",")}</td></tr>
    <tr><td>Taxa de entrega</td><td class="r">R$ ${(pedido.taxa_entrega ?? 0).toFixed(2).replace(".", ",")}</td></tr>
    <tr class="total-row"><td>TOTAL</td><td class="r">R$ ${pedido.total.toFixed(2).replace(".", ",")}</td></tr>
  </table>
  <div class="dash"></div>
  <p><span class="bold">PAGAMENTO:</span> ${PGTO[pedido.forma_pagamento] ?? pedido.forma_pagamento}</p>
  ${pedido.nome_cliente ? `<div class="dash"></div><p class="section">Cliente</p><p>${pedido.nome_cliente}</p>${pedido.telefone_cliente ? `<p>Tel: ${pedido.telefone_cliente}</p>` : ""}` : ""}
  ${pedido.endereco_entrega ? `<div class="dash"></div><p class="section">Endereço de entrega</p><p>${pedido.endereco_entrega}</p>` : ""}
  ${pedido.observacao ? `<div class="dash"></div><p class="section">Observação</p><p>${pedido.observacao}</p>` : ""}
  <div class="dash"></div>
  <p class="center bold" style="font-size:13px;">*** CHEGÔ DELIVERY ***</p>
</body>
</html>`

  const win = window.open("", "_blank", "width=420,height=600,menubar=no,toolbar=no")
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }
}

const STATUS_LABEL: Record<StatusPedido, string> = {
  pendente:          "Novo pedido",
  aceito:            "Aceito",
  preparando:        "Preparando",
  pronto:            "Pronto para entrega",
  aguardando_aceite: "Aguardando motoboy",
  indo_para_loja:    "Motoboy a caminho",
  na_loja:           "Motoboy na loja",
  em_rota:           "Em rota de entrega",
  coletado:          "Coletado",
  entregue:          "Entregue",
  cancelado:         "Cancelado",
}
const PROXIMO_STATUS: Partial<Record<StatusPedido, StatusPedido>> = {
  pendente:   "aceito",
  aceito:     "preparando",
  preparando: "pronto",
}
const PROXIMO_LABEL: Partial<Record<StatusPedido, string>> = {
  pendente:   "✓ Aceitar pedido",
  aceito:     "Iniciar preparo e chamar motoboy",
  preparando: "Marcar como pronto",
}

export default function LojaDashboard() {
  const { sessao } = useAuth()
  const loja_id = sessao?.role === "lojista" ? sessao.loja_id : null

  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [contadorClientes, setContadorClientes] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [atualizando, setAtualizando] = useState<string | null>(null)
  const [reembolsosPendentes, setReembolsosPendentes] = useState<any[]>([])
  const [processandoReemb, setProcessandoReemb] = useState<string | null>(null)
  const [aberto, setAberto] = useState<boolean | null>(null)
  const [togglingAberto, setTogglingAberto] = useState(false)
  const prevPendentesRef = useRef<Set<string>>(new Set())
  const isFirstLoad = useRef(true)
  const horariosRef = useRef<Horarios | null>(null)

  // ── Entrega manual ──────────────────────────────────────────────────────
  const [modalManual, setModalManual]   = useState(false)
  const [manualNome, setManualNome]     = useState("")
  const [manualEndereco, setManualEndereco] = useState("")
  const [manualObs, setManualObs]       = useState("")
  const [manualTaxa, setManualTaxa]     = useState("")
  const [enviandoManual, setEnviandoManual] = useState(false)
  const [erroManual, setErroManual]     = useState("")
  const [sucessoManual, setSucessoManual] = useState(false)

  async function criarEntregaManual() {
    if (!manualNome.trim()) { setErroManual("Informe o nome do cliente"); return }
    if (!manualEndereco.trim()) { setErroManual("Informe o endereço de entrega"); return }
    setErroManual(""); setEnviandoManual(true)
    const res = await fetch("/api/loja/entrega-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome_cliente:     manualNome.trim(),
        endereco_entrega: manualEndereco.trim(),
        observacao:       manualObs.trim(),
        taxa_entrega:     parseFloat(manualTaxa) || 0,
      }),
    })
    const data = await res.json()
    setEnviandoManual(false)
    if (!res.ok) { setErroManual(data.error ?? "Erro ao criar entrega"); return }
    setManualNome(""); setManualEndereco(""); setManualObs(""); setManualTaxa("")
    setModalManual(false)
    setSucessoManual(true); setTimeout(() => setSucessoManual(false), 5000)
    load()
  }

  // ── Rastreio motoboy ────────────────────────────────────────────────────
  const [lojaCoords, setLojaCoords]   = useState<{ lat: number; lng: number } | null>(null)
  const [trackPedido, setTrackPedido] = useState<Pedido | null>(null)
  const [motoboyPos, setMotoboyPos]   = useState<{ lat: number; lng: number } | null>(null)
  const mapDivRef    = useRef<HTMLDivElement>(null)
  const leafletRef   = useRef<any>(null)
  const mbMarkerRef  = useRef<any>(null)
  const routeLayerRef = useRef<any>(null)

  async function load() {
    if (!loja_id) return
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const [{ data }, { data: historico }] = await Promise.all([
      supabase
        .from("pedidos")
        .select("*, itens:itens_pedido(*)")
        .eq("loja_id", loja_id)
        .not("status", "in", '("coletado","entregue","cancelado")')
        .gte("criado_em", hoje.toISOString())
        .order("criado_em", { ascending: false }),
      supabase
        .from("pedidos")
        .select("telefone_cliente")
        .eq("loja_id", loja_id)
        .eq("status", "entregue")
        .not("telefone_cliente", "is", null),
    ])

    const resultado = (data as Pedido[]) ?? []
    const novosPendentes = new Set(resultado.filter(p => p.status === "pendente").map(p => p.id))

    if (!isFirstLoad.current) {
      const chegaram = [...novosPendentes].filter(id => !prevPendentesRef.current.has(id))
      if (chegaram.length > 0) beep()
    }

    // Monta mapa telefone → quantidade de pedidos entregues
    const contador: Record<string, number> = {}
    for (const row of (historico ?? [])) {
      const tel = row.telefone_cliente
      if (tel) contador[tel] = (contador[tel] ?? 0) + 1
    }

    prevPendentesRef.current = novosPendentes
    isFirstLoad.current = false
    setPedidos(resultado)
    setContadorClientes(contador)
    setLoading(false)

    // Auto-cancelamento: pedidos pendentes há mais de 5 minutos
    const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000)
    const expirados = resultado.filter(
      p => p.status === "pendente" && new Date(p.criado_em) < cincoMinAtras
    )
    for (const p of expirados) {
      fetch("/api/loja/status-pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: p.id, status: "cancelado", loja_id }),
      }).catch(() => {})
    }
  }

  // Carregar status aberto/fechado da loja ao entrar
  useEffect(() => {
    if (!loja_id) return
    supabase.from("lojas").select("aberto").eq("id", loja_id).single()
      .then(({ data }) => { if (data) setAberto(data.aberto ?? false) })
  }, [loja_id])

  async function toggleAberto() {
    if (!loja_id || togglingAberto) return
    const novoStatus = !aberto
    setTogglingAberto(true)
    setAberto(novoStatus)
    await fetch("/api/loja/atualizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aberto: novoStatus }),
    })
    setTogglingAberto(false)
  }

  useEffect(() => {
    if (!loja_id) return
    load()
    const interval = setInterval(load, 15_000)
    // Realtime: detecta novos pedidos e mudanças de status instantaneamente
    const ch = supabase.channel(`loja-pedidos-${loja_id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "pedidos",
        filter: `loja_id=eq.${loja_id}`,
      }, () => load())
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "pedidos",
        filter: `loja_id=eq.${loja_id}`,
      }, () => load())
      .subscribe()
    return () => { clearInterval(interval); supabase.removeChannel(ch) }
  }, [loja_id])

  // Carrega coordenadas da loja uma vez
  useEffect(() => {
    if (!loja_id) return
    supabase.from("lojas").select("lat,lng").eq("id", loja_id).single()
      .then(({ data }) => { if (data?.lat) setLojaCoords({ lat: Number(data.lat), lng: Number(data.lng) }) })
  }, [loja_id])

  // Subscrição realtime na posição do motoboy quando modal está aberto
  useEffect(() => {
    if (!trackPedido?.motoboy_id) return
    supabase.from("motoboys").select("lat,lng").eq("id", trackPedido.motoboy_id).single()
      .then(({ data }) => { if (data?.lat) setMotoboyPos({ lat: Number(data.lat), lng: Number(data.lng) }) })
    const ch = supabase.channel(`mb-track-${trackPedido.motoboy_id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "motoboys", filter: `id=eq.${trackPedido.motoboy_id}` },
        ({ new: n }: any) => { if (n.lat && n.lng) setMotoboyPos({ lat: Number(n.lat), lng: Number(n.lng) }) })
      .subscribe()
    return () => { supabase.removeChannel(ch); setMotoboyPos(null) }
  }, [trackPedido?.motoboy_id])

  // Inicializa mapa Leaflet ao abrir modal
  useEffect(() => {
    if (!trackPedido || !mapDivRef.current || !lojaCoords) return
    let cancelled = false
    import("leaflet").then(L => {
      if (cancelled || !mapDivRef.current) return
      if (!document.getElementById("leaflet-css-loja")) {
        const link = document.createElement("link")
        link.id = "leaflet-css-loja"; link.rel = "stylesheet"
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        document.head.appendChild(link)
      }
      if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null }
      mbMarkerRef.current = null; routeLayerRef.current = null
      const map = (L as any).map(mapDivRef.current, { zoomControl: false, attributionControl: false })
      ;(L as any).tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map)
      leafletRef.current = map
      const lojaIcon = (L as any).divIcon({
        className: "",
        html: `<div style="width:36px;height:36px;background:#DC2626;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 3px 10px rgba(0,0,0,0.35)">🏪</div>`,
        iconSize: [36, 36], iconAnchor: [18, 18],
      })
      ;(L as any).marker([lojaCoords.lat, lojaCoords.lng], { icon: lojaIcon }).addTo(map).bindPopup("Sua loja")
      map.setView([lojaCoords.lat, lojaCoords.lng], 14)
    })
    return () => {
      cancelled = true
      if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null }
      mbMarkerRef.current = null; routeLayerRef.current = null
    }
  }, [trackPedido?.id, lojaCoords])

  // Atualiza marcador + rota quando posição do motoboy muda
  const fetchRota = useCallback(async (mbLat: number, mbLng: number, lojaLat: number, lojaLng: number) => {
    try {
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${mbLng},${mbLat};${lojaLng},${lojaLat}?overview=full&geometries=geojson`)
      const d = await r.json()
      return d.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined
    } catch { return undefined }
  }, [])

  useEffect(() => {
    if (!leafletRef.current || !motoboyPos) return
    import("leaflet").then(async L => {
      if (!leafletRef.current) return
      if (mbMarkerRef.current) {
        mbMarkerRef.current.setLatLng([motoboyPos.lat, motoboyPos.lng])
      } else {
        const mbIcon = (L as any).divIcon({
          className: "",
          html: `<div style="width:40px;height:40px;background:#f97316;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 10px rgba(0,0,0,0.4)">🛵</div>`,
          iconSize: [40, 40], iconAnchor: [20, 20],
        })
        mbMarkerRef.current = (L as any).marker([motoboyPos.lat, motoboyPos.lng], { icon: mbIcon })
          .addTo(leafletRef.current).bindPopup("Entregador")
      }
      if (lojaCoords) {
        leafletRef.current.fitBounds([[motoboyPos.lat, motoboyPos.lng], [lojaCoords.lat, lojaCoords.lng]], { padding: [50, 50], maxZoom: 16 })
        const coords = await fetchRota(motoboyPos.lat, motoboyPos.lng, lojaCoords.lat, lojaCoords.lng)
        if (coords && leafletRef.current) {
          if (routeLayerRef.current) leafletRef.current.removeLayer(routeLayerRef.current)
          routeLayerRef.current = (L as any).polyline(coords.map(([lng, lat]) => [lat, lng]), { color: "#f97316", weight: 4, opacity: 0.8 }).addTo(leafletRef.current)
        }
      }
    })
  }, [motoboyPos, lojaCoords, fetchRota])

  async function enviarPush(id: string, status: StatusPedido) {
    try {
      const { data } = await supabase.from("pedidos").select("codigo").eq("id", id).single()
      if (data) {
        await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send", pedido_id: id, status, codigo: data.codigo }),
        })
      }
    } catch {}
  }

  async function avancarStatus(id: string, statusAtual: StatusPedido) {
    const proximo = PROXIMO_STATUS[statusAtual]
    if (!proximo || !loja_id) return
    setAtualizando(id)
    await fetch("/api/loja/status-pedido", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: id, status: proximo, loja_id }),
    })
    enviarPush(id, proximo)

    // Ao iniciar preparo, aciona motoboy imediatamente
    if (statusAtual === "aceito") {
      await fetch("/api/escalada", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: id }),
      }).catch(() => {})
    }

    await load()
    setAtualizando(null)
  }

  async function cancelar(id: string) {
    if (!confirm("Cancelar este pedido?") || !loja_id) return
    setAtualizando(id)
    await fetch("/api/loja/status-pedido", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: id, status: "cancelado", loja_id }),
    })
    enviarPush(id, "cancelado")
    await load()
    setAtualizando(null)
  }

  async function chamarMotoboy(id: string) {
    setAtualizando(id)
    await fetch("/api/escalada", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: id }),
    })
    await load()
    setAtualizando(null)
  }

  // Pendentes primeiro, depois os em andamento (ambos já vêm do DB ordenados por criado_em DESC)
  const STATUS_PRIORITY: Record<string, number> = {
    pendente: 0, aceito: 1, preparando: 2, pronto: 3,
    aguardando_aceite: 4, indo_para_loja: 5, na_loja: 6, em_rota: 7, coletado: 8,
  }
  const pendentes   = pedidos.filter(p => p.status === "pendente")
  const emAndamento = pedidos
    .filter(p => p.status !== "pendente")
    .sort((a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9))

  useEffect(() => {
    if (pendentes.length === 0) return
    const id = setInterval(() => beep(), 30_000)
    return () => clearInterval(id)
  }, [pendentes.length])

  // Carrega reembolsos pendentes para esta loja
  useEffect(() => {
    if (!loja_id) return
    async function loadReembolsos() {
      const res = await fetch("/api/reembolso/listar")
      if (!res.ok) return
      const j = await res.json()
      setReembolsosPendentes((j.reembolsos ?? []).filter((r: any) => r.status === "solicitado"))
    }
    loadReembolsos()
    const iv = setInterval(loadReembolsos, 15_000)
    return () => clearInterval(iv)
  }, [loja_id])

  async function processarReembolso(reembolsoId: string, acao: "aprovar" | "negar", valorAprovado?: number) {
    setProcessandoReemb(reembolsoId)
    const res = await fetch("/api/reembolso/processar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reembolso_id: reembolsoId, acao, valor_aprovado: valorAprovado }),
    })
    setProcessandoReemb(null)
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? "Erro"); return }
    setReembolsosPendentes(prev => prev.filter(r => r.id !== reembolsoId))
  }

  const PAGAMENTO_ICON: Record<string, string> = {
    pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha",
  }

  function ClienteInfo({ pedido }: { pedido: Pedido }) {
    if (!pedido.nome_cliente && !pedido.endereco_entrega) return null
    const totalPedidos = pedido.telefone_cliente ? (contadorClientes[pedido.telefone_cliente] ?? 0) : 0
    const isPrimeiro = totalPedidos === 0
    return (
      <div style={{
        background: "#F8FAFC", borderRadius: 12, padding: "10px 13px", marginBottom: 12,
        border: "1px solid #E5E7EB", display: "flex", flexDirection: "column", gap: 5,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 14 }}>👤</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
              {pedido.nome_cliente ?? "—"}
            </span>
            {pedido.telefone_cliente && (
              <span style={{ fontSize: 12, color: "#6B7280" }}>{pedido.telefone_cliente}</span>
            )}
          </div>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap",
            background: isPrimeiro ? "rgba(249,115,22,0.12)" : "rgba(34,197,94,0.1)",
            color: isPrimeiro ? "#ea580c" : "#15803d",
          }}>
            {isPrimeiro ? "1º pedido" : `${totalPedidos + 1}º pedido`}
          </span>
        </div>
        {pedido.endereco_entrega && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>📍</span>
            <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>{pedido.endereco_entrega}</span>
          </div>
        )}
      </div>
    )
  }

  function BotaoImprimir({ pedido }: { pedido: Pedido }) {
    return (
      <button
        onClick={() => imprimirPedido(pedido)}
        title="Imprimir comanda"
        style={{
          padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb",
          background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
          color: "#6B7280", fontSize: 12, fontWeight: 600,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Imprimir
      </button>
    )
  }

  return (
    <div style={{ minHeight: "100vh", padding: "20px 16px", maxWidth: 600, margin: "0 auto" }}>

      {/* ── Modal de rastreio do motoboy ────────────────────────────────── */}
      {trackPedido && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.55)", display: "flex", flexDirection: "column",
          WebkitBackdropFilter: "blur(4px)", backdropFilter: "blur(4px)",
        }}>
          {/* Header */}
          <div style={{
            background: "#111827", padding: "16px 20px",
            display: "flex", alignItems: "center", gap: 12,
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
          }}>
            <button onClick={() => { setTrackPedido(null); setMotoboyPos(null) }} style={{
              background: "rgba(255,255,255,0.1)", border: "none", color: "white",
              width: 36, height: 36, borderRadius: "50%", cursor: "pointer", fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>←</button>
            <div style={{ flex: 1 }}>
              <p style={{ color: "white", fontWeight: 800, fontSize: 15 }}>
                {trackPedido.status === "indo_para_loja" ? "🛵 Motoboy a caminho" : "🏪 Motoboy na loja"}
              </p>
              <p style={{ color: "#9CA3AF", fontSize: 12 }}>Pedido #{trackPedido.codigo}</p>
            </div>
            {motoboyPos
              ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
                  <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 700 }}>Ao vivo</span>
                </div>
              : <span style={{ color: "#9CA3AF", fontSize: 12 }}>Aguardando GPS...</span>
            }
          </div>

          {/* Mapa */}
          <div ref={mapDivRef} style={{ flex: 1, background: "#1a1a2e" }} />

          {/* Footer info */}
          <div style={{
            background: "#111827", padding: "14px 20px",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f97316", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🛵</div>
            <div style={{ flex: 1 }}>
              <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>
                {trackPedido.status === "indo_para_loja" ? "Entregador indo até sua loja" : "Entregador chegou na loja"}
              </p>
              {motoboyPos
                ? <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>Localização atualizada em tempo real</p>
                : <p style={{ color: "#eab308", fontSize: 12, marginTop: 2 }}>GPS do motoboy ainda não disponível</p>
              }
            </div>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#DC2626", border: "2px solid white" }} />
            <span style={{ color: "#9CA3AF", fontSize: 11 }}>Loja</span>
          </div>
        </div>
      )}

      {/* ── Toggle abrir/fechar loja ─────────────────────────────────── */}
      <div style={{
        background: aberto ? "rgba(22,163,74,0.07)" : "rgba(239,68,68,0.07)",
        border: `1.5px solid ${aberto ? "rgba(22,163,74,0.25)" : "rgba(239,68,68,0.25)"}`,
        borderRadius: 16,
        padding: "18px 20px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 13, height: 13, borderRadius: "50%", flexShrink: 0,
            background: aberto ? "#16a34a" : "#9CA3AF",
            boxShadow: aberto ? "0 0 0 4px rgba(22,163,74,0.18)" : "none",
          }} />
          <div>
            <p style={{ fontWeight: 800, fontSize: 17, color: aberto ? "#15803d" : "#374151", margin: 0 }}>
              {aberto === null ? "Carregando..." : aberto ? "Loja aberta" : "Loja fechada"}
            </p>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
              {aberto ? "Aceitando pedidos agora" : "Toque para abrir e receber pedidos"}
            </p>
          </div>
        </div>

        {/* Switch */}
        <button
          onClick={toggleAberto}
          disabled={togglingAberto || aberto === null}
          style={{
            position: "relative", width: 58, height: 32, borderRadius: 16,
            border: "none", cursor: togglingAberto ? "not-allowed" : "pointer",
            background: aberto ? "#16a34a" : "#D1D5DB",
            transition: "background 0.25s",
            flexShrink: 0,
            opacity: aberto === null ? 0.5 : 1,
          }}
        >
          <div style={{
            position: "absolute", top: 4,
            left: aberto ? 30 : 4,
            width: 24, height: 24, borderRadius: "50%",
            background: "white",
            boxShadow: "0 1px 4px rgba(0,0,0,0.22)",
            transition: "left 0.25s",
          }} />
        </button>
      </div>

      {/* Modal entrega manual */}
      {modalManual && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", WebkitBackdropFilter: "blur(4px)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setModalManual(false) }}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", padding: "24px 20px", paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 24px)", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontWeight: 900, fontSize: 18, color: "#111827" }}>🛵 Chamar motoboy</h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF" }}>Entrega sem pedido no app — taxa descontada do repasse</p>
              </div>
              <button onClick={() => setModalManual(false)} style={{ background: "#F3F4F6", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Nome do cliente *</label>
                <input value={manualNome} onChange={e => setManualNome(e.target.value)} placeholder="Ex: João Silva"
                  style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, color: "#111827", outline: "none", boxSizing: "border-box" as const }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Endereço de entrega *</label>
                <input value={manualEndereco} onChange={e => setManualEndereco(e.target.value)} placeholder="Rua, número, bairro"
                  style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, color: "#111827", outline: "none", boxSizing: "border-box" as const }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Taxa de entrega (R$)</label>
                <input type="number" step="0.50" min="0" value={manualTaxa} onChange={e => setManualTaxa(e.target.value)} placeholder="0,00"
                  style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, color: "#111827", outline: "none", boxSizing: "border-box" as const }} />
                <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>Cobrada do cliente por fora. Será descontada do seu repasse.</p>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Observação (opcional)</label>
                <input value={manualObs} onChange={e => setManualObs(e.target.value)} placeholder="Ex: Fragil, interfone 201..."
                  style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, color: "#111827", outline: "none", boxSizing: "border-box" as const }} />
              </div>
              {erroManual && <p style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>{erroManual}</p>}
              <button onClick={criarEntregaManual} disabled={enviandoManual} style={{
                width: "100%", padding: "13px", borderRadius: 12, border: "none",
                background: enviandoManual ? "rgba(249,115,22,0.4)" : "#f97316",
                color: "white", fontWeight: 800, fontSize: 15, cursor: "pointer", marginTop: 4,
              }}>
                {enviandoManual ? "Chamando motoboy..." : "🛵 Confirmar e chamar motoboy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: sucessoManual ? 8 : 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#111827", margin: 0 }}>Pedidos de hoje</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Atualiza a cada 15 segundos</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setModalManual(true); setErroManual("") }}
            style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid rgba(249,115,22,0.4)", background: "rgba(249,115,22,0.07)", color: "#ea580c", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            + Entrega
          </button>
          <button onClick={() => { setLoading(true); load() }} className="btn-ghost" style={{ fontSize: 12, padding: "8px 14px" }}>
            ↻
          </button>
        </div>
      </div>

      {sucessoManual && (
        <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
          <p style={{ color: "#16a34a", fontWeight: 700, fontSize: 13 }}>✅ Motoboy sendo buscado! Pedido criado com sucesso.</p>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: "center", marginTop: 48, color: "#9CA3AF" }}>Carregando pedidos...</p>
      ) : pedidos.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 64 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px" }}><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
          <p style={{ fontWeight: 700, color: "#111827" }}>Nenhum pedido hoje</p>
          <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>Novos pedidos aparecerão aqui automaticamente</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Reembolsos pendentes */}
          {reembolsosPendentes.length > 0 && (
            <div style={{ background: "#FFF7ED", border: "1.5px solid #fed7aa", borderRadius: 16, padding: "14px 16px" }}>
              <p style={{ fontWeight: 800, fontSize: 14, color: "#9a3412", marginBottom: 10 }}>
                🔄 {reembolsosPendentes.length} reembolso{reembolsosPendentes.length > 1 ? "s" : ""} aguardando análise
              </p>
              {reembolsosPendentes.map(r => (
                <div key={r.id} style={{ background: "white", borderRadius: 12, padding: "12px 14px", marginBottom: 8, border: "1px solid #fde68a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{r.motivo}</p>
                      <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Pedido #{r.pedido?.codigo ?? "—"} · R$ {(r.valor_solicitado ?? r.pedido?.total ?? 0).toFixed(2)}</p>
                    </div>
                    <span style={{ fontSize: 11, color: "#ea580c", fontWeight: 700, background: "#FFF7ED", padding: "3px 8px", borderRadius: 8 }}>
                      {r.solicitado_por}
                    </span>
                  </div>
                  {r.descricao && <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>{r.descricao}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => processarReembolso(r.id, "negar")} disabled={processandoReemb === r.id} style={{
                      flex: 1, padding: "9px", borderRadius: 10, border: "1px solid #fca5a5",
                      background: "#FEF2F2", color: "#DC2626", fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}>Negar</button>
                    <button onClick={() => processarReembolso(r.id, "aprovar")} disabled={processandoReemb === r.id} style={{
                      flex: 1, padding: "9px", borderRadius: 10, border: "none",
                      background: "#22c55e", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}>
                      {processandoReemb === r.id ? "..." : "Aprovar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Novos pedidos - destaque */}
          {pendentes.map(p => (
            <div key={p.id} className="card" style={{ padding: "18px 16px", border: "1px solid rgba(249,115,22,0.5)", background: "rgba(249,115,22,0.05)", animation: "pulse 2s infinite" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <span className="badge badge-orange" style={{ fontSize: 11 }}>NOVO PEDIDO</span>
                  <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                    #{p.codigo} · {new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <p style={{ fontSize: 20, fontWeight: 900, color: "#111827", flexShrink: 0 }}>R$ {p.total.toFixed(2)}</p>
              </div>

              {p.itens && p.itens.length > 0 && (
                <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                  {p.itens.map((item: any) => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <span style={{ color: "#374151" }}>{item.quantidade}x {item.nome}</span>
                      <span style={{ color: "#9CA3AF" }}>R$ {(item.preco * item.quantidade).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9CA3AF" }}>
                <span style={{ fontWeight: 600 }}>{PAGAMENTO_ICON[p.forma_pagamento] ?? p.forma_pagamento}</span>
              </div>

              <ClienteInfo pedido={p} />

              {p.observacao && (
                <p style={{ fontSize: 12, fontStyle: "italic", marginBottom: 14, padding: "8px 12px", borderRadius: 10, background: "#F3F4F6", color: "#6B7280" }}>
                  💬 {p.observacao}
                </p>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => avancarStatus(p.id, p.status)} disabled={!!atualizando}
                  className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                  {atualizando === p.id ? "..." : PROXIMO_LABEL[p.status]}
                </button>
                <BotaoImprimir pedido={p} />
                <button onClick={() => cancelar(p.id)} disabled={!!atualizando}
                  className="btn-ghost" style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)", padding: "11px 16px" }}>
                  ✕
                </button>
              </div>
            </div>
          ))}

          {/* Em andamento */}
          {emAndamento.map(p => (
            <div key={p.id} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="badge badge-blue">{STATUS_LABEL[p.status]}</span>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>#{p.codigo}</span>
                </div>
                <p style={{ fontWeight: 700, color: "#111827" }}>R$ {p.total.toFixed(2)}</p>
              </div>

              {p.itens && (
                <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>
                  {p.itens.map((i: any) => `${i.quantidade}x ${i.nome}`).join(", ")}
                </p>
              )}

              <ClienteInfo pedido={p} />

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PROXIMO_STATUS[p.status] && (
                  <button onClick={() => avancarStatus(p.id, p.status)} disabled={!!atualizando}
                    className="btn-ghost" style={{ flex: 1, justifyContent: "center", fontSize: 12 }}>
                    {atualizando === p.id ? "..." : PROXIMO_LABEL[p.status]}
                  </button>
                )}

                {(p.status === "pronto" || p.status === "preparando") && !p.motoboy_id && (
                  <button onClick={() => chamarMotoboy(p.id)} disabled={!!atualizando}
                    className="btn-primary" style={{ flex: 1, justifyContent: "center", fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}>
                    {atualizando === p.id ? "Chamando..." : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/>
                          <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
                        </svg>
                        Chamar motoboy
                      </>
                    )}
                  </button>
                )}

                {p.status === "aguardando_aceite" && (
                  <div style={{ flex: 1, padding: "12px 16px", borderRadius: 12, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ position: "relative", width: 36, height: 36, flexShrink: 0 }}>
                      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(234,179,8,0.25)", animation: "pulse 1.2s ease-out infinite" }} />
                      <div style={{ position: "absolute", inset: 4, borderRadius: "50%", background: "rgba(234,179,8,0.4)", animation: "pulse 1.2s ease-out infinite", animationDelay: "0.3s" }} />
                      <div style={{ position: "absolute", inset: 8, borderRadius: "50%", background: "#eab308" }} />
                      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🛵</span>
                    </div>
                    <div>
                      <p style={{ color: "#ca8a04", fontSize: 13, fontWeight: 800 }}>Buscando motoboy...</p>
                      <p style={{ color: "#a16207", fontSize: 11, marginTop: 2 }}>Aguardando um entregador aceitar</p>
                    </div>
                  </div>
                )}

                {(p.status === "indo_para_loja" || p.status === "na_loja") && (
                  <button onClick={() => setTrackPedido(p)} style={{
                    flex: 1, padding: "10px 14px", borderRadius: 12, border: "1.5px solid rgba(249,115,22,0.4)",
                    background: "rgba(249,115,22,0.08)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ fontSize: 18 }}>📍</span>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ color: "#ea580c", fontSize: 13, fontWeight: 800 }}>
                        {p.status === "indo_para_loja" ? "Motoboy a caminho" : "Motoboy na loja"}
                      </p>
                      <p style={{ color: "#9a3412", fontSize: 11, marginTop: 1 }}>Toque para ver no mapa</p>
                    </div>
                    <div style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                  </button>
                )}

                <BotaoImprimir pedido={p} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}