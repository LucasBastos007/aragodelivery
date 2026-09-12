"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import type { EntregaAvulsa } from "@/types"

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  aguardando:        { label: "Aguardando motoboy", color: "#d97706", bg: "#FFFBEB" },
  aceito:            { label: "Indo à loja",         color: "#2563eb", bg: "#EFF6FF" },
  coletado:          { label: "Pedido coletado",     color: "#7c3aed", bg: "#F5F3FF" },
  em_rota:           { label: "Em rota",             color: "#7c3aed", bg: "#F5F3FF" },
  entregue:          { label: "Entregue",            color: "#059669", bg: "#ECFDF5" },
  cancelado:         { label: "Cancelado",           color: "#dc2626", bg: "#FEF2F2" },
  aguardando_aceite: { label: "Aguardando aceite",   color: "#d97706", bg: "#FFFBEB" },
}

const PLANOS_COM_AVULSA = ["select", "prime", "black"]

type ClienteAvulso = {
  id: string
  nome: string
  telefone: string | null
  endereco: string | null
  total_pedidos: number
  valor_total: number
}

type SugestaoEndereco = {
  place_id: string | number
  display_name: string
  lat: string
  lon: string
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: "#64748b", bg: "#F1F5F9" }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 50,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 700,
    }}>
      {cfg.label}
    </span>
  )
}

const campoStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1.5px solid #E2E8F0", fontSize: 13, fontWeight: 500,
  color: "#1E293B", background: "white", outline: "none",
  boxSizing: "border-box",
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#64748b",
  textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5,
}

function normalizar(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, "").trim()
}

function buscarTabelaFrete(tabela: { municipio: string; taxa: number }[], nome: string): number | null {
  const n = normalizar(nome)
  for (const entry of tabela) {
    const e = normalizar(entry.municipio)
    if (n.includes(e) || e.includes(n)) return entry.taxa
  }
  return null
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calcularFrete(distKm: number, taxaBase: number): number {
  if (distKm <= 6) return taxaBase
  return Math.round((taxaBase + (distKm - 6) * 1.00) * 100) / 100
}

// Mesmo layout de comanda usado em loja/page.tsx (imprimirPedido), adaptado pra entrega
// avulsa — sem lista de itens (é só um valor total do pedido) e sem forma de pagamento
// (não é rastreada aqui, o pagamento é combinado direto com o cliente por fora do app).
function imprimirEntregaAvulsa(entrega: EntregaAvulsa, largura: "80mm" | "58mm" = "80mm") {
  const now  = new Date(entrega.criado_em)
  const data = now.toLocaleDateString("pt-BR")
  const hora = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

  const bodyW  = largura === "58mm" ? "54mm" : "76mm"
  const pageW  = largura
  const fsBase = largura === "58mm" ? "11px" : "12px"
  const fsBig  = largura === "58mm" ? "13px" : "14px"

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Entrega #${entrega.codigo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fsBase};
      font-weight: 700;
      width: ${bodyW};
      padding: 3mm 3mm;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .center { text-align: center; }
    .r { text-align: right; white-space: nowrap; }
    .dash { border-top: 2px solid #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 2px 0; vertical-align: top; }
    .total-row td { font-size: ${fsBig}; padding-top: 5px; border-top: 2px solid #000; }
    .section { margin: 5px 0 3px; font-size: ${fsBig}; text-transform: uppercase; letter-spacing: 0.5px; }
    .codigo { font-size: 16px; letter-spacing: 1px; }
    @media print {
      body { margin: 0; }
      @page { margin: 2mm; size: ${pageW} auto; }
    }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom:6px;">
    <img src="https://chegodelivery.com/logo-chego.jpg" alt="Chegô" style="width:64px;height:64px;object-fit:contain;border-radius:8px;" />
  </div>
  <div class="dash"></div>
  <p class="codigo">ENTREGA AVULSA #${entrega.codigo}</p>
  <p>${data} às ${hora}</p>
  <div class="dash"></div>
  <table>
    <tr><td>Valor do pedido</td><td class="r">R$ ${entrega.valor_pedido.toFixed(2).replace(".", ",")}</td></tr>
    <tr><td>Taxa de entrega</td><td class="r">R$ ${entrega.taxa_entrega.toFixed(2).replace(".", ",")}</td></tr>
    <tr class="total-row"><td>TOTAL</td><td class="r">R$ ${(entrega.valor_pedido + entrega.taxa_entrega).toFixed(2).replace(".", ",")}</td></tr>
  </table>
  <div class="dash"></div>
  <p class="section">CLIENTE</p>
  <p>${entrega.cliente_nome}</p>
  ${entrega.cliente_tel ? `<p>Tel: ${entrega.cliente_tel}</p>` : ""}
  <div class="dash"></div>
  <p class="section">ENDEREÇO DE ENTREGA</p>
  <p>${entrega.endereco}</p>
  ${entrega.observacao ? `<div class="dash"></div><p class="section">OBSERVAÇÃO</p><p>${entrega.observacao}</p>` : ""}
  <div class="dash"></div>
  <p class="center" style="font-size:13px;">*** CHEGÔ DELIVERY ***</p>
  <br><br>
</body>
</html>`

  const win = window.open("", "_blank", "width=420,height=600,menubar=no,toolbar=no")
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
    const img = win.document.querySelector("img")
    if (img && !img.complete) {
      img.onload = () => { win.print(); win.close() }
      img.onerror = () => { win.print(); win.close() }
      setTimeout(() => { win.print(); win.close() }, 3000)
    } else {
      setTimeout(() => { win.print(); win.close() }, 400)
    }
  }
}

export default function EntregaAvulsaPage() {
  const { sessao, logout } = useAuth()
  const loja_id = sessao?.role === "lojista" ? (sessao as any).loja_id : null

  const [plano, setPlano]         = useState<string | null>(null)
  const [avulsaLiberada, setAvulsaLiberada] = useState(false)
  const [lojaCoords, setLojaCoords] = useState<{ lat: number | null; lng: number | null; taxa_entrega: number | null } | null>(null)
  const [loading, setLoading]     = useState(true)
  const [enviando, setEnviando]   = useState(false)
  const [entregas, setEntregas]   = useState<EntregaAvulsa[]>([])
  const [sucesso, setSucesso]     = useState(false)

  // Clientes salvos
  const [clientes, setClientes]     = useState<ClienteAvulso[]>([])
  const [busca, setBusca]           = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const buscaRef = useRef<HTMLDivElement>(null)

  // Autocomplete endereço
  const [endBusca, setEndBusca]           = useState("")
  const [endCompl, setEndCompl]           = useState("")
  const [endRef2,  setEndRef2]            = useState("")
  const [sugestoes, setSugestoes]         = useState<SugestaoEndereco[]>([])
  const [showSug, setShowSug]             = useState(false)
  const [endSelecionado, setEndSelecionado] = useState<SugestaoEndereco | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tabela de preços fixos por município
  const [tabelaFrete, setTabelaFrete] = useState<{ municipio: string; taxa: number }[]>([])

  // Distância/taxa
  const [distInfo, setDistInfo] = useState<{ km: number; taxa: number } | null>(null)
  const [geocodando, setGeocodando] = useState(false)
  const [erroGeocode, setErroGeocode] = useState<string | null>(null)

  // Localização colada do WhatsApp (link do Google Maps que o cliente mandou)
  const [linkMaps, setLinkMaps]           = useState("")
  const [resolvendoLink, setResolvendoLink] = useState(false)
  const [erroLink, setErroLink]           = useState<string | null>(null)
  const [clienteCoords, setClienteCoords] = useState<{ lat: number; lng: number } | null>(null)

  const [larguraPapel] = useState<"80mm" | "58mm">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("print_largura") as "80mm" | "58mm") ?? "80mm"
    return "80mm"
  })

  const [form, setForm] = useState({
    cliente_nome:  "",
    cliente_tel:   "",
    valor_pedido:  "",
    observacao:    "",
  })

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function carregar() {
    if (!loja_id) return
    const [{ data: lojaData }, { data: entregasData }] = await Promise.all([
      supabase.from("lojas").select("plano, lat, lng, taxa_entrega, entrega_avulsa_liberada").eq("id", loja_id).single(),
      supabase.from("entregas_avulsas").select("*").eq("loja_id", loja_id).order("criado_em", { ascending: false }).limit(50),
    ])
    setPlano(lojaData?.plano ?? null)
    setAvulsaLiberada(lojaData?.entrega_avulsa_liberada ?? false)
    setLojaCoords({ lat: lojaData?.lat ?? null, lng: lojaData?.lng ?? null, taxa_entrega: lojaData?.taxa_entrega ?? null })
    setEntregas(entregasData ?? [])
    setLoading(false)
  }

  async function carregarClientes() {
    if (!loja_id) return
    try {
      const res = await fetch("/api/loja/clientes-avulsos", { credentials: "include" })
      if (res.ok) setClientes(await res.json())
    } catch {}
  }

  async function carregarTabelaFrete() {
    if (!loja_id) return
    try {
      const res = await fetch("/api/loja/tabela-frete", { credentials: "include" })
      if (res.ok) setTabelaFrete(await res.json())
    } catch {}
  }

  useEffect(() => { carregar(); carregarClientes(); carregarTabelaFrete() }, [loja_id])

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) setShowDropdown(false)
      if (endRef.current && !endRef.current.contains(e.target as Node)) setShowSug(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Autocomplete endereço: busca sugestões com debounce 600ms e calcula distância automaticamente
  useEffect(() => {
    const q = endBusca.trim()
    if (q.length < 3) { setSugestoes([]); setDistInfo(null); setErroGeocode(null); return }
    if (endSelecionado?.lat) return
    if (endTimer.current) clearTimeout(endTimer.current)
    endTimer.current = setTimeout(async () => {
      setGeocodando(true)
      setErroGeocode(null)
      try {
        const latL = lojaCoords?.lat
        const lngL = lojaCoords?.lng
        if (!latL || !lngL) {
          setErroGeocode("Loja sem coordenadas cadastradas — configure no perfil da loja.")
          setGeocodando(false)
          return
        }
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}&lat=${latL}&lon=${lngL}`)
        const data: SugestaoEndereco[] = await res.json()
        setSugestoes(data)
        setShowSug(data.length > 0)
        if (!data[0]) {
          // Sem geocoder → tenta tabela fixa pelo texto digitado
          const taxaFixa = buscarTabelaFrete(tabelaFrete, q)
          if (taxaFixa !== null) {
            setDistInfo({ km: 0, taxa: taxaFixa })
          } else {
            setErroGeocode("Município não encontrado. Tente digitar de outra forma.")
            setDistInfo(null)
          }
        } else {
          const latC = parseFloat(data[0].lat)
          const lngC = parseFloat(data[0].lon)
          if (!isNaN(latC) && !isNaN(lngC)) {
            const dist = haversineKm(latL, lngL, latC, lngC)
            // Tabela fixa tem prioridade sobre cálculo por distância
            const taxaFixa = buscarTabelaFrete(tabelaFrete, q) ?? buscarTabelaFrete(tabelaFrete, data[0].display_name)
            const taxaBase = lojaCoords?.taxa_entrega ?? 6.00
            setDistInfo({ km: dist, taxa: taxaFixa ?? calcularFrete(dist, taxaBase) })
          } else {
            setErroGeocode(`Coord inválida: lat=${data[0].lat} lon=${data[0].lon}`)
            setDistInfo(null)
          }
        }
      } catch (err: any) {
        setErroGeocode("Erro ao buscar: " + (err?.message ?? "desconhecido"))
      } finally {
        setGeocodando(false)
      }
    }, 600)
    return () => { if (endTimer.current) clearTimeout(endTimer.current) }
  }, [endBusca, endSelecionado, lojaCoords, tabelaFrete])

  function selecionarSugestao(s: SugestaoEndereco) {
    setEndSelecionado(s)
    setEndBusca(s.display_name)
    setSugestoes([])
    setShowSug(false)
    const latL = lojaCoords?.lat
    const lngL = lojaCoords?.lng
    if (latL && lngL) {
      const latC = parseFloat(s.lat)
      const lngC = parseFloat(s.lon)
      if (!isNaN(latC) && !isNaN(lngC)) {
        const dist = haversineKm(latL, lngL, latC, lngC)
        const taxaFixa = buscarTabelaFrete(tabelaFrete, s.display_name) ?? buscarTabelaFrete(tabelaFrete, endBusca)
        const taxaBase = lojaCoords?.taxa_entrega ?? 6.00
        setDistInfo({ km: dist, taxa: taxaFixa ?? calcularFrete(dist, taxaBase) })
      }
    }
  }

  function limparEndereco() {
    setEndBusca("")
    setEndCompl("")
    setEndRef2("")
    setEndSelecionado(null)
    setSugestoes([])
    setDistInfo(null)
    setErroGeocode(null)
    setClienteCoords(null)
    setLinkMaps("")
    setErroLink(null)
  }

  // Cliente manda a localização pelo WhatsApp (geralmente um link do Google Maps) — em vez
  // de digitar o endereço manualmente, o lojista cola o link aqui. Resolve a coordenada real
  // (segue redirecionamento se for link curto), faz reverse geocode pra preencher os campos
  // de texto, e calcula a taxa direto pela distância real — mais preciso que a busca textual.
  async function usarLinkMaps() {
    if (!linkMaps.trim()) return
    setResolvendoLink(true)
    setErroLink(null)
    try {
      const res = await fetch(`/api/geocode/resolver-link?texto=${encodeURIComponent(linkMaps.trim())}`)
      const data = await res.json()
      if (!res.ok || typeof data.lat !== "number") {
        setErroLink(data.error ?? "Não consegui identificar a localização nesse link.")
        return
      }
      setClienteCoords({ lat: data.lat, lng: data.lng })

      const revRes = await fetch(`/api/geocode/reverse?lat=${data.lat}&lon=${data.lng}`)
      const revData = await revRes.json().catch(() => ({}))
      const addr = revData.address ?? {}
      const cidade = addr.city || addr.town || addr.village || addr.municipality || ""
      const rua = [addr.road, addr.house_number].filter(Boolean).join(", ")

      if (cidade) {
        setEndBusca(cidade)
        setEndSelecionado({ place_id: "link-maps", display_name: cidade, lat: String(data.lat), lon: String(data.lng) })
      }
      if (rua) setEndCompl(rua)

      const latL = lojaCoords?.lat
      const lngL = lojaCoords?.lng
      if (latL && lngL) {
        const dist = haversineKm(latL, lngL, data.lat, data.lng)
        const taxaFixa = cidade ? buscarTabelaFrete(tabelaFrete, cidade) : null
        const taxaBase = lojaCoords?.taxa_entrega ?? 6.00
        setDistInfo({ km: dist, taxa: taxaFixa ?? calcularFrete(dist, taxaBase) })
      }
    } catch {
      setErroLink("Erro ao processar o link. Tente colar de novo.")
    } finally {
      setResolvendoLink(false)
    }
  }

  async function geocodificarMunicipio(municipio: string) {
    if (!municipio || municipio.length < 3) return
    const latL = lojaCoords?.lat
    const lngL = lojaCoords?.lng
    if (!latL || !lngL) return
    try {
      const bias = `&lat=${latL}&lon=${lngL}`
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(municipio)}${bias}`)
      const data: SugestaoEndereco[] = await res.json()
      if (data[0]) {
        const latC = parseFloat(data[0].lat)
        const lngC = parseFloat(data[0].lon)
        if (!isNaN(latC) && !isNaN(lngC)) {
          const dist = haversineKm(latL, lngL, latC, lngC)
          const taxaFixa = buscarTabelaFrete(tabelaFrete, municipio) ?? buscarTabelaFrete(tabelaFrete, data[0].display_name)
          const taxaBase = lojaCoords?.taxa_entrega ?? 6.00
          setDistInfo({ km: dist, taxa: taxaFixa ?? calcularFrete(dist, taxaBase) })
          setEndSelecionado(data[0])
        }
      } else {
        // Geocoder não encontrou, mas pode estar na tabela
        const taxaFixa = buscarTabelaFrete(tabelaFrete, municipio)
        if (taxaFixa !== null) setDistInfo({ km: 0, taxa: taxaFixa })
      }
    } catch {}
  }

  function selecionarCliente(c: ClienteAvulso) {
    setForm(f => ({
      ...f,
      cliente_nome: c.nome,
      cliente_tel:  c.telefone ?? "",
    }))
    if (c.endereco) {
      // Separa endereço salvo de volta nos 3 campos
      const parts = c.endereco.split(" — ")
      const municipio = parts[0]?.trim() ?? ""
      const end       = parts[1]?.trim() ?? ""
      const ref       = parts[2]?.trim() ?? ""
      setEndBusca(municipio)
      setEndCompl(end)
      setEndRef2(ref)
      setEndSelecionado({ place_id: "saved", display_name: municipio, lat: "", lon: "" })
      setDistInfo(null)
      geocodificarMunicipio(municipio)
    }
    setBusca(c.nome)
    setShowDropdown(false)
  }

  function limparForm() {
    setForm({ cliente_nome: "", cliente_tel: "", valor_pedido: "", observacao: "" })
    setBusca("")
    limparEndereco()
  }

  // Endereço completo para salvar
  const enderecoFinal = [endBusca.trim(), endCompl.trim(), endRef2.trim()].filter(Boolean).join(" — ")

  const clientesFiltrados = busca.trim().length >= 1
    ? clientes.filter(c =>
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (c.telefone ?? "").includes(busca)
      ).slice(0, 6)
    : clientes.slice(0, 6)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!loja_id) return
    if (!endBusca.trim()) { alert("Informe o endereço de entrega"); return }
    if (!form.cliente_tel.trim()) { alert("Informe o telefone do cliente"); return }
    setEnviando(true)
    try {
      const res = await fetch("/api/entrega-avulsa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          loja_id,
          cliente_nome:  form.cliente_nome,
          cliente_tel:   form.cliente_tel,
          endereco:      enderecoFinal,
          valor_pedido:  parseFloat(form.valor_pedido || "0"),
          taxa_entrega:  distInfo?.taxa ?? 0,
          observacao:    form.observacao,
          cliente_lat:   clienteCoords?.lat ?? null,
          cliente_lng:   clienteCoords?.lng ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      // Salva/atualiza cliente automaticamente
      await fetch("/api/loja/clientes-avulsos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nome:         form.cliente_nome,
          telefone:     form.cliente_tel,
          endereco:     enderecoFinal,
          valor_pedido: parseFloat(form.valor_pedido || "0"),
        }),
      })

      limparForm()
      setSucesso(true)
      setTimeout(() => setSucesso(false), 5000)
      await Promise.all([carregar(), carregarClientes()])
    } catch (err: any) {
      if (err.message === "Não autorizado") {
        await logout()
        window.location.href = "/entrar"
        return
      }
      alert("Erro: " + err.message)
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <p style={{ color: "#9CA3AF" }}>Carregando…</p>
      </div>
    )
  }

  if (!avulsaLiberada && (!plano || !PLANOS_COM_AVULSA.includes(plano))) {
    return (
      <div style={{ padding: "40px 24px", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🛵</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", marginBottom: 8 }}>
          Entrega Avulsa
        </h2>
        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          A entrega avulsa permite acionar um motoboy para clientes que pediram pelo WhatsApp, sem precisar do app.
          Disponível nos planos <strong>Select, Prime e Black</strong>.
        </p>
        <div style={{
          background: "linear-gradient(135deg, #f97316, #dc2626)",
          borderRadius: 14, padding: "20px 24px", color: "white", textAlign: "left",
        }}>
          <p style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Faça upgrade do seu plano</p>
          <p style={{ fontSize: 12, opacity: 0.85 }}>Entre em contato com o suporte para assinar o plano Select (R$ 149/mês) e liberar este recurso.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: "24px 20px", maxWidth: 680, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Loja
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.3px" }}>
          Solicitar Motoboy
        </h1>
        <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 3 }}>
          Para pedidos recebidos fora do app (WhatsApp, telefone etc.)
        </p>
      </div>

      {/* Busca de cliente salvo */}
      {clientes.length > 0 && (
        <div ref={buscaRef} style={{ position: "relative", marginBottom: 16 }}>
          <p style={labelStyle}>Buscar cliente salvo</p>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
            <input
              value={busca}
              onChange={e => { setBusca(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Nome ou telefone do cliente…"
              style={{ ...campoStyle, paddingLeft: 34 }}
            />
            {busca && (
              <button
                type="button"
                onClick={limparForm}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16, padding: 4 }}
              >×</button>
            )}
          </div>
          {showDropdown && clientesFiltrados.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, marginTop: 4,
              background: "white", borderRadius: 12, border: "1.5px solid #E2E8F0",
              boxShadow: "0 8px 24px rgba(0,0,0,0.10)", overflow: "hidden",
            }}>
              {clientesFiltrados.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selecionarCliente(c)}
                  style={{
                    width: "100%", textAlign: "left", padding: "10px 14px",
                    background: "none", border: "none", borderBottom: "1px solid #F1F5F9",
                    cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = "#F8FAFC")}
                  onMouseOut={e => (e.currentTarget.style.background = "none")}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0 }}>{c.nome}</p>
                    <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
                      {c.telefone && <span>{c.telefone} · </span>}
                      {c.endereco && <span style={{ maxWidth: 200, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>{c.endereco}</span>}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#f97316", margin: 0 }}>{c.total_pedidos}x</p>
                    <p style={{ fontSize: 10, color: "#94a3b8", margin: 0 }}>
                      med. R$ {(c.valor_total / c.total_pedidos).toFixed(0)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Formulário */}
      <form onSubmit={enviar} style={{
        background: "white", borderRadius: 16, border: "1.5px solid #F1F5F9",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)", padding: "20px 20px", marginBottom: 24,
      }}>

        {/* Localização enviada pelo cliente no WhatsApp (link do Google Maps) */}
        <div style={{ marginBottom: 14 }}>
          <p style={labelStyle}>Localização do WhatsApp (opcional)</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={linkMaps}
              onChange={e => setLinkMaps(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); usarLinkMaps() } }}
              placeholder="Cole aqui o link do Google Maps que o cliente mandou"
              style={{ ...campoStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={usarLinkMaps}
              disabled={resolvendoLink || !linkMaps.trim()}
              style={{
                flexShrink: 0, padding: "0 16px", borderRadius: 10, border: "none",
                background: resolvendoLink || !linkMaps.trim() ? "#e5e7eb" : "#f97316",
                color: resolvendoLink || !linkMaps.trim() ? "#9ca3af" : "white",
                fontWeight: 700, fontSize: 13, cursor: resolvendoLink || !linkMaps.trim() ? "not-allowed" : "pointer",
              }}
            >
              {resolvendoLink ? "..." : "📍 Usar"}
            </button>
          </div>
          {erroLink && <p style={{ fontSize: 11, color: "#dc2626", marginTop: 6 }}>⚠ {erroLink}</p>}
          {clienteCoords && !erroLink && (
            <p style={{ fontSize: 11, color: "#16a34a", marginTop: 6 }}>✓ Localização identificada — endereço preenchido abaixo</p>
          )}
        </div>

        {/* 1. Endereço com autocomplete */}
        <div ref={endRef} style={{ marginBottom: 14, position: "relative" }}>
          <p style={labelStyle}>Município *</p>
          <div style={{ position: "relative" }}>
            <input
              value={endBusca}
              onChange={e => { setEndBusca(e.target.value); setEndSelecionado(null); setDistInfo(null) }}
              onFocus={() => { if (sugestoes.length > 0) setShowSug(true) }}
              onBlur={() => {
                // Fallback: geocodifica se o usuário digitou sem selecionar do dropdown
                if (!endSelecionado?.lat && endBusca.trim().length >= 3) {
                  geocodificarMunicipio(endBusca.trim())
                }
              }}
              placeholder="Digite o município para buscar…"
              style={campoStyle}
              autoComplete="off"
            />
            {endBusca && (
              <button type="button" onClick={limparEndereco} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18, padding: 4,
              }}>×</button>
            )}
          </div>

          {/* Dropdown de sugestões */}
          {showSug && sugestoes.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 60, marginTop: 4,
              background: "white", borderRadius: 12, border: "1.5px solid #E2E8F0",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden",
            }}>
              {sugestoes.map(s => (
                <button
                  key={s.place_id}
                  type="button"
                  onClick={() => selecionarSugestao(s)}
                  style={{
                    width: "100%", textAlign: "left", padding: "10px 14px",
                    background: "none", border: "none", borderBottom: "1px solid #F8FAFC",
                    cursor: "pointer", fontSize: 12, color: "#1E293B", lineHeight: 1.4,
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = "#F8FAFC")}
                  onMouseOut={e => (e.currentTarget.style.background = "none")}
                >
                  📍 {s.display_name}
                </button>
              ))}
            </div>
          )}

          {/* Buscando... */}
          {geocodando && (
            <p style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>Buscando localização…</p>
          )}

          {/* Erro de geocoding */}
          {erroGeocode && !geocodando && (
            <p style={{ fontSize: 11, color: "#dc2626", marginTop: 6 }}>⚠ {erroGeocode}</p>
          )}

          {/* Resultado da distância / taxa fixa */}
          {distInfo && !geocodando && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginTop: 8,
              background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 12px",
            }}>
              <span style={{ fontSize: 15 }}>📍</span>
              <div>
                {distInfo.km > 0 && (
                  <p style={{ fontSize: 12, fontWeight: 800, color: "#15803d", margin: 0 }}>
                    {distInfo.km.toFixed(1)} km de distância
                  </p>
                )}
                <p style={{ fontSize: 11, color: "#16a34a", margin: 0 }}>
                  Taxa de entrega: <strong>R$ {distInfo.taxa.toFixed(2).replace(".", ",")}</strong>
                  {distInfo.km === 0 && <span style={{ opacity: 0.7 }}> · taxa fixa</span>}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Endereço (rua e número) */}
        <div style={{ marginBottom: 14 }}>
          <p style={labelStyle}>Endereço</p>
          <input
            value={endCompl}
            onChange={e => setEndCompl(e.target.value)}
            placeholder="Rua, quadra, lote, número…"
            style={campoStyle}
          />
        </div>

        {/* Ponto de referência */}
        <div style={{ marginBottom: 14 }}>
          <p style={labelStyle}>Ponto de referência</p>
          <input
            value={endRef2}
            onChange={e => setEndRef2(e.target.value)}
            placeholder="Ex: próx. ao supermercado, em frente à escola…"
            style={campoStyle}
          />
        </div>

        {/* 2. Nome e telefone */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <p style={labelStyle}>Nome do cliente *</p>
            <input
              required value={form.cliente_nome}
              onChange={e => set("cliente_nome", e.target.value)}
              placeholder="Ex: João Silva"
              style={campoStyle}
            />
          </div>
          <div>
            <p style={labelStyle}>Telefone *</p>
            <input
              required
              value={form.cliente_tel}
              onChange={e => set("cliente_tel", e.target.value)}
              placeholder="(99) 99999-9999"
              style={campoStyle}
            />
          </div>
        </div>

        {/* 3. Valor do pedido */}
        <div style={{ marginBottom: 14 }}>
          <p style={labelStyle}>Valor do pedido (R$)</p>
          <input
            type="number" min="0" step="0.01"
            value={form.valor_pedido}
            onChange={e => set("valor_pedido", e.target.value)}
            placeholder="0,00"
            style={campoStyle}
          />
        </div>

        {/* 4. Observação */}
        <div style={{ marginBottom: 18 }}>
          <p style={labelStyle}>Observação</p>
          <textarea
            value={form.observacao}
            onChange={e => set("observacao", e.target.value)}
            placeholder="Ponto de referência, instruções especiais…"
            rows={2}
            style={{ ...campoStyle, resize: "none", fontFamily: "inherit" }}
          />
        </div>

        <button type="submit" disabled={enviando} style={{
          width: "100%", padding: "13px", borderRadius: 12, border: "none",
          background: enviando ? "#e5e7eb" : "linear-gradient(135deg, #f97316, #dc2626)",
          color: enviando ? "#9ca3af" : "white",
          fontWeight: 800, fontSize: 14, cursor: enviando ? "not-allowed" : "pointer",
          boxShadow: enviando ? "none" : "0 4px 16px rgba(249,115,22,0.35)",
        }}>
          {enviando ? "Solicitando…" : sucesso ? "✓ Motoboy solicitado!" : "🛵 Solicitar motoboy"}
        </button>
      </form>

      {/* Clientes recorrentes */}
      {clientes.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 12 }}>
            Clientes salvos ({clientes.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clientes.slice(0, 8).map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => { selecionarCliente(c); window.scrollTo({ top: 0, behavior: "smooth" }) }}
                style={{
                  background: "white", borderRadius: 12, border: "1.5px solid #F1F5F9",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "12px 16px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  cursor: "pointer", textAlign: "left", width: "100%",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0 }}>{c.nome}</p>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.telefone && <>{c.telefone} · </>}
                    {c.endereco}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#f97316", margin: 0 }}>{c.total_pedidos}x</p>
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>
                    med. R$ {(c.valor_total / c.total_pedidos).toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Histórico de avulsas */}
      {entregas.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 12 }}>
            Histórico ({entregas.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entregas.map(e => (
              <div key={e.id} style={{
                background: "white", borderRadius: 12, border: "1.5px solid #F1F5F9",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "12px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#f97316" }}>#{e.codigo}</span>
                    <StatusBadge status={e.status} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>
                      {new Date(e.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <button
                      type="button"
                      onClick={() => imprimirEntregaAvulsa(e, larguraPapel)}
                      title="Imprimir comanda"
                      style={{
                        display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 7,
                        border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748b",
                        fontSize: 11, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      🖨️ Imprimir
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>{e.cliente_nome}</p>
                <p style={{ fontSize: 12, color: "#64748b" }}>{e.endereco}</p>
                {(e.valor_pedido > 0 || e.taxa_entrega > 0) && (
                  <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                    Pedido: R$ {e.valor_pedido.toFixed(2)}
                    {e.taxa_entrega > 0 && ` · Entrega: R$ ${e.taxa_entrega.toFixed(2)}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
