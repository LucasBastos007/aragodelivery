"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import type { EntregaAvulsa, Pedido } from "@/types"
import { imprimirPedido } from "@/lib/impressao"

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  aguardando:        { label: "Aguardando motoboy", color: "#d97706", bg: "var(--pequi-claro)" },
  aceito:            { label: "Indo à loja",         color: "#2563eb", bg: "#EFF6FF" },
  coletado:          { label: "Pedido coletado",     color: "#7c3aed", bg: "#F5F3FF" },
  em_rota:           { label: "Em rota",             color: "#7c3aed", bg: "#F5F3FF" },
  entregue:          { label: "Entregue",            color: "var(--folha)", bg: "var(--folha-claro)" },
  cancelado:         { label: "Cancelado",           color: "var(--pimenta)", bg: "var(--pimenta-claro)" },
  aguardando_aceite: { label: "Aguardando aceite",   color: "#d97706", bg: "var(--pequi-claro)" },
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
  const cfg = STATUS_CFG[status] ?? { label: status, color: "var(--suave)", bg: "var(--pedra)" }
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
  border: "1.5px solid var(--linha)", fontSize: 13, fontWeight: 500,
  color: "var(--grafite)", background: "white", outline: "none",
  boxSizing: "border-box",
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "var(--suave)",
  textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5,
}

function normalizar(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, "").trim()
}

function esc(s: string) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") }

type ProdutoCardapio = { id: string; nome: string; preco: number; categoria: string; adicionais: any[] }
type GrupoAdic = { id: string; nome: string; obrigatorio: boolean; minimo: number; maximo: number; itens: { id: string; nome: string; preco: number }[] }
type ItemCarrinho = { key: string; produto_id: string; nome: string; preco: number; quantidade: number; adicionais: { id: string; nome: string; preco: number }[]; observacao: string }

/** adicionais do produto normalizados em grupos (formato antigo = lista solta vira 1 grupo opcional) */
function gruposDoProduto(adicionais: any[]): GrupoAdic[] {
  const grupos: GrupoAdic[] = []
  const soltos: { id: string; nome: string; preco: number }[] = []
  for (const a of adicionais ?? []) {
    if (Array.isArray(a?.itens)) grupos.push({ id: a.id, nome: a.nome, obrigatorio: !!a.obrigatorio, minimo: Number(a.minimo ?? 0), maximo: Number(a.maximo ?? a.itens.length), itens: a.itens.map((i: any) => ({ id: i.id, nome: i.nome, preco: Number(i.preco ?? 0) })) })
    else if (a?.id) soltos.push({ id: a.id, nome: a.nome, preco: Number(a.preco ?? 0) })
  }
  if (soltos.length) grupos.push({ id: "_soltos", nome: "Adicionais", obrigatorio: false, minimo: 0, maximo: soltos.length, itens: soltos })
  return grupos
}
const precoItem = (i: { preco: number; quantidade: number; adicionais: { preco: number }[] }) =>
  (i.preco + i.adicionais.reduce((t, a) => t + a.preco, 0)) * i.quantidade
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

// Taxa da avulsa: calculada pela MESMA função dos pedidos normais
// (lib/frete.ts::calcularTaxaEntregaCompleta), via /api/frete/calcular pra prévia e de novo
// no servidor ao criar (/api/entrega-avulsa). Antes esta página tinha uma cópia própria
// da fórmula que geocodificava só o NOME do município (centro da cidade) — dentro da
// própria cidade a distância dava sempre < 6km e a taxa saía sempre a mínima, qualquer
// que fosse o endereço real; e buscava bairro e município misturados na mesma tabela.

/** "Aragoiânia, Goiás, Brasil" -> "Aragoiânia" */
function soCidade(s: string) { return s.split(",")[0].trim() }

/** Endereço salvo "Município — Bairro X — Rua… — Referência" de volta nos campos (bairro opcional, formato antigo sem bairro continua funcionando). */
function separarEnderecoSalvo(endereco: string) {
  const parts = endereco.split(" — ").map(p => p.trim())
  const municipio = parts.shift() ?? ""
  const iBairro = parts.findIndex(p => p.startsWith("Bairro "))
  const bairro = iBairro >= 0 ? parts.splice(iBairro, 1)[0].slice("Bairro ".length) : ""
  return { municipio, bairro, end: parts[0] ?? "", ref: parts[1] ?? "" }
}

// Mesmo layout de comanda usado em loja/page.tsx (imprimirPedido), adaptado pra entrega
// avulsa — sem lista de itens (é só um valor total do pedido) e sem forma de pagamento
// (não é rastreada aqui, o pagamento é combinado direto com o cliente por fora do app).
// `janela`: aberta já no clique de "Solicitar motoboy" (antes da chamada ao servidor) —
// abrir depois do await faz o navegador bloquear como pop-up e o cupom não sai.
function imprimirEntregaAvulsa(entrega: EntregaAvulsa, largura: "80mm" | "58mm" = "80mm", janela?: Window | null) {
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
    ${(entrega.itens ?? []).length > 0
      ? (entrega.itens ?? []).map(i => `<tr><td>${i.quantidade}x ${esc(i.nome)}${i.adicionais.length ? `<br><span style="font-weight:400">+ ${i.adicionais.map(a => esc(a.nome)).join(", ")}</span>` : ""}${i.observacao ? `<br><span style="font-weight:400">Obs: ${esc(i.observacao)}</span>` : ""}</td><td class="r">R$ ${((i.preco + i.adicionais.reduce((t, a) => t + a.preco, 0)) * i.quantidade).toFixed(2).replace(".", ",")}</td></tr>`).join("")
        + `<tr><td>Subtotal</td><td class="r">R$ ${entrega.valor_pedido.toFixed(2).replace(".", ",")}</td></tr>`
      : `<tr><td>Valor do pedido</td><td class="r">R$ ${entrega.valor_pedido.toFixed(2).replace(".", ",")}</td></tr>`}
    <tr><td>Taxa de entrega</td><td class="r">R$ ${entrega.taxa_entrega.toFixed(2).replace(".", ",")}</td></tr>
    <tr class="total-row"><td>TOTAL</td><td class="r">R$ ${(entrega.valor_pedido + entrega.taxa_entrega).toFixed(2).replace(".", ",")}</td></tr>
  </table>
  <div class="dash"></div>
  <p class="section">CLIENTE</p>
  <p>${entrega.cliente_nome}</p>
  ${entrega.cliente_tel ? `<p>Tel: ${entrega.cliente_tel}</p>` : ""}
  <div class="dash"></div>
  <p class="section">ENDEREÇO DE ENTREGA</p>
  <p>${esc(entrega.endereco)}</p>
  ${entrega.referencia ? `<p>Ref: ${esc(entrega.referencia)}</p>` : ""}
  ${entrega.observacao ? `<div class="dash"></div><p class="section">OBSERVAÇÃO</p><p>${entrega.observacao}</p>` : ""}
  <div class="dash"></div>
  <p class="center" style="font-size:13px;">*** CHEGÔ DELIVERY ***</p>
  <br><br>
</body>
</html>`

  const win = janela ?? window.open("", "_blank", "width=420,height=600,menubar=no,toolbar=no")
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
  const [tabelaFrete, setTabelaFrete] = useState<{ municipio: string; taxa: number; tipo?: string }[]>([])
  const [endBairro, setEndBairro] = useState("")

  // Taxa (prévia calculada no servidor, mesma regra dos pedidos)
  const [taxaInfo, setTaxaInfo] = useState<{ taxa: number } | null>(null)
  const [calculandoTaxa, setCalculandoTaxa] = useState(false)
  const [erroTaxa, setErroTaxa] = useState<string | null>(null)
  // Coordenada do endereço digitado (rua + bairro + cidade) — nunca do centro da cidade
  const [enderecoCoords, setEnderecoCoords] = useState<{ lat: number; lng: number } | null>(null)

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
    observacao:    "",
  })

  // Carrinho com itens do próprio cardápio — o valor do pedido (e a comissão da Chegô)
  // sai dos preços cadastrados, não mais de um campo digitado à mão.
  const [cardapio, setCardapio] = useState<ProdutoCardapio[]>([])
  const [buscaItem, setBuscaItem] = useState("")
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [produtoEscolhendo, setProdutoEscolhendo] = useState<ProdutoCardapio | null>(null)
  const [selAdic, setSelAdic] = useState<Record<string, string[]>>({})
  const [obsItem, setObsItem] = useState("")
  const subtotalCarrinho = carrinho.reduce((s, i) => s + precoItem(i), 0)
  // Pagamento — o motoboy precisa saber se cobra (dinheiro/maquininha) ou se já está pago
  // (Pix direto na conta da loja); também entra no fechamento/relatório.
  const [formaPgto, setFormaPgto] = useState<"" | "dinheiro" | "maquininha" | "pix_loja">("")
  const [precisaTroco, setPrecisaTroco] = useState(false)
  const [trocoPara, setTrocoPara] = useState("")
  const [tipoMaquininha, setTipoMaquininha] = useState<"" | "credito" | "debito">("")
  const [ultimoPedido, setUltimoPedido] = useState<string | null>(null)
  const totalPedido = subtotalCarrinho + (taxaInfo?.taxa ?? 0)

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

  async function carregarCardapio() {
    if (!loja_id) return
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from("produtos").select("id, nome, preco, adicionais, categoria_id, ordem").eq("loja_id", loja_id).eq("disponivel", true),
      supabase.from("categorias_produto").select("id, nome, ordem").eq("loja_id", loja_id),
    ])
    const catPor = new Map((cats ?? []).map((c: any) => [c.id, c]))
    setCardapio((prods ?? [])
      .map((p: any) => ({ id: p.id, nome: p.nome, preco: Number(p.preco), adicionais: p.adicionais ?? [], categoria: (catPor.get(p.categoria_id) as any)?.nome ?? "Outros", _o: [(catPor.get(p.categoria_id) as any)?.ordem ?? 999, p.ordem ?? 999] }))
      .sort((a: any, b: any) => a._o[0] - b._o[0] || a._o[1] - b._o[1] || a.nome.localeCompare(b.nome)))
  }

  function escolherProduto(p: ProdutoCardapio) {
    if (gruposDoProduto(p.adicionais).length === 0) { adicionarAoCarrinho(p, [], ""); return }
    setProdutoEscolhendo(p); setSelAdic({}); setObsItem("")
  }
  function adicionarAoCarrinho(p: ProdutoCardapio, adicionais: { id: string; nome: string; preco: number }[], observacao: string) {
    setCarrinho(prev => {
      const key = `${p.id}|${adicionais.map(a => a.id).sort().join(",")}|${observacao}`
      const ja = prev.find(i => i.key === key)
      if (ja) return prev.map(i => i.key === key ? { ...i, quantidade: i.quantidade + 1 } : i)
      return [...prev, { key, produto_id: p.id, nome: p.nome, preco: p.preco, quantidade: 1, adicionais, observacao }]
    })
  }
  function alterarQtd(key: string, delta: number) {
    setCarrinho(prev => prev.flatMap(i => i.key !== key ? [i] : i.quantidade + delta <= 0 ? [] : [{ ...i, quantidade: i.quantidade + delta }]))
  }

  useEffect(() => { carregar(); carregarClientes(); carregarTabelaFrete(); carregarCardapio() }, [loja_id])

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) setShowDropdown(false)
      if (endRef.current && !endRef.current.contains(e.target as Node)) setShowSug(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Autocomplete do município: só sugere nomes de cidade, não calcula taxa.
  useEffect(() => {
    const q = endBusca.trim()
    if (q.length < 3 || endSelecionado) { setSugestoes([]); return }
    if (endTimer.current) clearTimeout(endTimer.current)
    endTimer.current = setTimeout(async () => {
      try {
        const bias = lojaCoords?.lat && lojaCoords?.lng ? `&lat=${lojaCoords.lat}&lon=${lojaCoords.lng}` : ""
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}${bias}`)
        const data: SugestaoEndereco[] = await res.json()
        setSugestoes(data)
        setShowSug(data.length > 0)
      } catch {}
    }, 600)
    return () => { if (endTimer.current) clearTimeout(endTimer.current) }
  }, [endBusca, endSelecionado, lojaCoords])

  // Geocodifica o endereço completo (rua + bairro + cidade) pra ter a coordenada real da
  // entrega — só quando não veio coordenada exata do link do WhatsApp. Resultado em outra
  // cidade é descartado (nome de rua comum casando com cidade distante).
  useEffect(() => {
    setEnderecoCoords(null)
    const cidade = soCidade(endBusca)
    if (clienteCoords || endCompl.trim().length < 4 || cidade.length < 3) return
    const t = setTimeout(async () => {
      try {
        const q = [endCompl.trim(), endBairro.trim(), cidade].filter(Boolean).join(", ")
        const bias = lojaCoords?.lat && lojaCoords?.lng ? `&lat=${lojaCoords.lat}&lon=${lojaCoords.lng}` : ""
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}${bias}`)
        const data: (SugestaoEndereco & { address?: { city?: string } })[] = await res.json()
        const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
        const r = data.find(d => d.address?.city && n(d.address.city) === n(cidade))
        const lat = r ? parseFloat(r.lat) : NaN, lng = r ? parseFloat(r.lon) : NaN
        if (!isNaN(lat) && !isNaN(lng)) setEnderecoCoords({ lat, lng })
      } catch {}
    }, 800)
    return () => clearTimeout(t)
  }, [endCompl, endBairro, endBusca, clienteCoords, lojaCoords])

  // Prévia da taxa — mesma função/rota usada no checkout dos pedidos normais.
  useEffect(() => {
    setTaxaInfo(null); setErroTaxa(null)
    const cidade = soCidade(endBusca)
    if (!loja_id || cidade.length < 3) return
    const coords = clienteCoords ?? enderecoCoords
    const t = setTimeout(async () => {
      setCalculandoTaxa(true)
      try {
        const params = new URLSearchParams({ loja_id, tipo_entrega: "entrega", cidade, bairro: endBairro.trim() })
        if (coords) { params.set("lat", String(coords.lat)); params.set("lng", String(coords.lng)) }
        const res = await fetch(`/api/frete/calcular?${params}`)
        const json = await res.json().catch(() => null)
        if (res.ok && typeof json?.taxa_entrega === "number") setTaxaInfo({ taxa: json.taxa_entrega })
        else setErroTaxa(json?.error ?? "Não foi possível calcular a taxa.")
      } catch {
        setErroTaxa("Não foi possível calcular a taxa.")
      } finally {
        setCalculandoTaxa(false)
      }
    }, 500)
    return () => clearTimeout(t)
  }, [loja_id, endBusca, endBairro, clienteCoords, enderecoCoords])

  function selecionarSugestao(s: SugestaoEndereco) {
    setEndSelecionado(s)
    setEndBusca(soCidade((s as any).address?.city || s.display_name))
    setSugestoes([])
    setShowSug(false)
  }

  function limparEndereco() {
    setEndBusca("")
    setEndBairro("")
    setEndCompl("")
    setEndRef2("")
    setEndSelecionado(null)
    setSugestoes([])
    setTaxaInfo(null)
    setErroTaxa(null)
    setEnderecoCoords(null)
    setClienteCoords(null)
    setLinkMaps("")
    setErroLink(null)
  }

  // Cliente manda a localização pelo WhatsApp (geralmente um link do Google Maps) — em vez
  // de digitar o endereço manualmente, o lojista cola o link aqui. Resolve a coordenada real
  // (segue redirecionamento se for link curto), faz reverse geocode pra preencher os campos
  // de texto; a taxa sai pela coordenada exata (efeito de prévia acima).
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
      const bairro = addr.suburb || addr.neighbourhood || addr.quarter || ""

      if (cidade) {
        setEndBusca(cidade)
        setEndSelecionado({ place_id: "link-maps", display_name: cidade, lat: String(data.lat), lon: String(data.lng) })
      }
      if (rua) setEndCompl(rua)
      if (bairro && !endBairro) setEndBairro(bairro)
    } catch {
      setErroLink("Erro ao processar o link. Tente colar de novo.")
    } finally {
      setResolvendoLink(false)
    }
  }

  function selecionarCliente(c: ClienteAvulso) {
    setForm(f => ({
      ...f,
      cliente_nome: c.nome,
      cliente_tel:  c.telefone ?? "",
    }))
    if (c.endereco) {
      const { municipio, bairro, end, ref } = separarEnderecoSalvo(c.endereco)
      setEndBusca(municipio)
      setEndBairro(bairro)
      setEndCompl(end)
      setEndRef2(ref)
      setEndSelecionado({ place_id: "saved", display_name: municipio, lat: "", lon: "" })
    }
    setBusca(c.nome)
    setShowDropdown(false)
  }

  function limparForm() {
    setFormaPgto(""); setPrecisaTroco(false); setTrocoPara(""); setTipoMaquininha("")
    setForm({ cliente_nome: "", cliente_tel: "", observacao: "" })
    setCarrinho([])
    setBusca("")
    limparEndereco()
  }

  // Endereço completo para salvar
  const enderecoFinal = [soCidade(endBusca), endBairro.trim() ? `Bairro ${endBairro.trim()}` : "", endCompl.trim(), endRef2.trim()].filter(Boolean).join(" — ")
  const bairrosTabela = tabelaFrete.filter(t => t.tipo === "bairro").map(t => t.municipio)

  const clientesFiltrados = busca.trim().length >= 1
    ? clientes.filter(c =>
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (c.telefone ?? "").includes(busca)
      ).slice(0, 6)
    : clientes.slice(0, 6)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!loja_id) return
    if (carrinho.length === 0) { alert("Adicione os itens do pedido"); return }
    if (!form.cliente_nome.trim()) { alert("Informe o nome do cliente"); return }
    if (form.cliente_tel.replace(/\D/g, "").length < 10) { alert("Informe o telefone do cliente com DDD"); return }
    if (!endBusca.trim()) { alert("Informe o município"); return }
    if (!endCompl.trim()) { alert("Informe o endereço (rua, quadra, lote, número)"); return }
    if (!endRef2.trim()) { alert("Informe o ponto de referência"); return }
    if (!formaPgto) { alert("Informe a forma de pagamento"); return }
    if (formaPgto === "maquininha" && !tipoMaquininha) { alert("Informe se a maquininha é crédito ou débito"); return }
    const trocoNum = parseFloat(trocoPara.replace(/\./g, "").replace(",", "."))
    if (formaPgto === "dinheiro" && precisaTroco && !(trocoNum > totalPedido)) { alert(`Informe um valor de troco maior que o total (${brl(totalPedido)})`); return }
    // Abre a janela do cupom AGORA (ainda dentro do clique) — senão o navegador bloqueia.
    const janelaCupom = window.open("", "_blank", "width=420,height=600,menubar=no,toolbar=no")
    setEnviando(true)
    try {
      const res = await fetch("/api/loja/pedido-loja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cliente_nome:  form.cliente_nome,
          cliente_tel:   form.cliente_tel,
          endereco:      endCompl.trim(),
          referencia:    endRef2.trim(),
          forma_pagamento: formaPgto,
          tipo_maquininha: formaPgto === "maquininha" ? tipoMaquininha : null,
          troco_para:    formaPgto === "dinheiro" && precisaTroco ? trocoNum : null,
          itens:         carrinho.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade, adicionais: i.adicionais.map(a => a.id), observacao: i.observacao })),
          cidade:        soCidade(endBusca),
          bairro:        endBairro.trim(),
          observacao:    form.observacao,
          cliente_lat:   (clienteCoords ?? enderecoCoords)?.lat ?? null,
          cliente_lng:   (clienteCoords ?? enderecoCoords)?.lng ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      if (json.pedido) { imprimirPedido(json.pedido as Pedido, larguraPapel, false, janelaCupom); setUltimoPedido(json.pedido.codigo) }
      else janelaCupom?.close()

      // Salva/atualiza cliente automaticamente
      await fetch("/api/loja/clientes-avulsos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nome:         form.cliente_nome,
          telefone:     form.cliente_tel,
          endereco:     enderecoFinal,
          valor_pedido: json.pedido?.subtotal ?? subtotalCarrinho,
        }),
      })

      limparForm()
      setSucesso(true)
      setTimeout(() => setSucesso(false), 8000)
      await Promise.all([carregar(), carregarClientes()])
    } catch (err: any) {
      janelaCupom?.close()
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
        <p style={{ color: "var(--suave)" }}>Carregando…</p>
      </div>
    )
  }

  if (!avulsaLiberada && (!plano || !PLANOS_COM_AVULSA.includes(plano))) {
    return (
      <div style={{ padding: "40px 24px", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🛵</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--grafite)", marginBottom: 8 }}>
          Entrega Avulsa
        </h2>
        <p style={{ color: "var(--suave)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          A entrega avulsa permite acionar um motoboy para clientes que pediram pelo WhatsApp, sem precisar do app.
          Disponível nos planos <strong>Select, Prime e Black</strong>.
        </p>
        <div style={{
          background: "linear-gradient(135deg, var(--pimenta), var(--pimenta))",
          borderRadius: 14, padding: "20px 24px", color: "white", textAlign: "left",
        }}>
          <p style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Faça upgrade do seu plano</p>
          <p style={{ fontSize: 12, opacity: 0.85 }}>Entre em contato com o suporte para assinar o plano Select (R$ 149/mês) e liberar este recurso.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: "4px 0 24px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--pimenta)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Loja
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "var(--grafite)", letterSpacing: "-0.3px" }}>
          Novo pedido
        </h1>
        <p style={{ fontSize: 13, color: "var(--suave)", marginTop: 3 }}>
          Para pedidos recebidos fora do app (WhatsApp, telefone etc.). O pedido vai para "Em preparo" no painel de Pedidos — quando ficar pronto, chame o motoboy por lá.
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
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--suave)", cursor: "pointer", fontSize: 16, padding: 4 }}
              >×</button>
            )}
          </div>
          {showDropdown && clientesFiltrados.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, marginTop: 4,
              background: "white", borderRadius: 12, border: "1.5px solid var(--linha)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.10)", overflow: "hidden",
            }}>
              {clientesFiltrados.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selecionarCliente(c)}
                  style={{
                    width: "100%", textAlign: "left", padding: "10px 14px",
                    background: "none", border: "none", borderBottom: "1px solid var(--pedra)",
                    cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = "var(--pedra)")}
                  onMouseOut={e => (e.currentTarget.style.background = "none")}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--grafite)", margin: 0 }}>{c.nome}</p>
                    <p style={{ fontSize: 11, color: "var(--suave)", margin: 0 }}>
                      {c.telefone && <span>{c.telefone} · </span>}
                      {c.endereco && <span style={{ maxWidth: 200, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>{c.endereco}</span>}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--pimenta)", margin: 0 }}>{c.total_pedidos}x</p>
                    <p style={{ fontSize: 10, color: "var(--suave)", margin: 0 }}>
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
        background: "white", borderRadius: 16, border: "1.5px solid var(--pedra)",
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
                background: resolvendoLink || !linkMaps.trim() ? "var(--linha)" : "var(--pimenta)",
                color: resolvendoLink || !linkMaps.trim() ? "var(--suave)" : "white",
                fontWeight: 700, fontSize: 13, cursor: resolvendoLink || !linkMaps.trim() ? "not-allowed" : "pointer",
              }}
            >
              {resolvendoLink ? "..." : "📍 Usar"}
            </button>
          </div>
          {erroLink && <p style={{ fontSize: 11, color: "var(--pimenta)", marginTop: 6 }}>⚠ {erroLink}</p>}
          {clienteCoords && !erroLink && (
            <p style={{ fontSize: 11, color: "var(--folha)", marginTop: 6 }}>✓ Localização identificada — endereço preenchido abaixo</p>
          )}
        </div>

        {/* 1. Endereço com autocomplete */}
        <div ref={endRef} style={{ marginBottom: 14, position: "relative" }}>
          <p style={labelStyle}>Município *</p>
          <div style={{ position: "relative" }}>
            <input
              value={endBusca}
              onChange={e => { setEndBusca(e.target.value); setEndSelecionado(null) }}
              onFocus={() => { if (sugestoes.length > 0) setShowSug(true) }}
              placeholder="Digite o município para buscar…"
              style={campoStyle}
              autoComplete="off"
            />
            {endBusca && (
              <button type="button" onClick={limparEndereco} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "var(--suave)", cursor: "pointer", fontSize: 18, padding: 4,
              }}>×</button>
            )}
          </div>

          {/* Dropdown de sugestões */}
          {showSug && sugestoes.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 60, marginTop: 4,
              background: "white", borderRadius: 12, border: "1.5px solid var(--linha)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden",
            }}>
              {sugestoes.map(s => (
                <button
                  key={s.place_id}
                  type="button"
                  onClick={() => selecionarSugestao(s)}
                  style={{
                    width: "100%", textAlign: "left", padding: "10px 14px",
                    background: "none", border: "none", borderBottom: "1px solid var(--pedra)",
                    cursor: "pointer", fontSize: 12, color: "var(--grafite)", lineHeight: 1.4,
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = "var(--pedra)")}
                  onMouseOut={e => (e.currentTarget.style.background = "none")}
                >
                  📍 {s.display_name}
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Bairro — com a tabela de bairros da loja como sugestão */}
        <div style={{ marginBottom: 14 }}>
          <p style={labelStyle}>Bairro</p>
          <input
            value={endBairro}
            onChange={e => setEndBairro(e.target.value)}
            list="avulsa-bairros"
            placeholder="Ex: Centro, Vila Boa…"
            style={campoStyle}
            autoComplete="off"
          />
          <datalist id="avulsa-bairros">
            {bairrosTabela.map(b => <option key={b} value={b} />)}
          </datalist>
        </div>

        {/* Endereço (rua e número) */}
        <div style={{ marginBottom: 14 }}>
          <p style={labelStyle}>Endereço *</p>
          <input
            required
            value={endCompl}
            onChange={e => setEndCompl(e.target.value)}
            placeholder="Rua, quadra, lote, número…"
            style={campoStyle}
          />
        </div>

        {/* Ponto de referência */}
        <div style={{ marginBottom: 14 }}>
          <p style={labelStyle}>Ponto de referência *</p>
          <input
            required
            value={endRef2}
            onChange={e => setEndRef2(e.target.value)}
            placeholder="Ex: próx. ao supermercado, em frente à escola…"
            style={campoStyle}
          />
        </div>

        {/* Taxa de entrega — mesma regra dos pedidos do app */}
        {calculandoTaxa && <p style={{ fontSize: 11, color: "var(--suave)", margin: "-4px 0 14px" }}>Calculando taxa de entrega…</p>}
        {erroTaxa && !calculandoTaxa && <p style={{ fontSize: 11, color: "var(--pimenta)", margin: "-4px 0 14px" }}>⚠ {erroTaxa}</p>}
        {taxaInfo && !calculandoTaxa && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, margin: "-4px 0 14px",
            background: "var(--folha-claro)", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 12px",
          }}>
            <span style={{ fontSize: 15 }}>📍</span>
            <p style={{ fontSize: 12, color: "var(--folha)", margin: 0 }}>
              Taxa de entrega: <strong>R$ {taxaInfo.taxa.toFixed(2).replace(".", ",")}</strong>
              {!clienteCoords && !enderecoCoords && !endBairro.trim() && <span style={{ opacity: 0.75 }}> · informe bairro/endereço (ou o link do WhatsApp) pra taxa exata</span>}
            </p>
          </div>
        )}

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
              inputMode="tel"
              value={form.cliente_tel}
              onChange={e => set("cliente_tel", e.target.value)}
              placeholder="(99) 99999-9999"
              style={campoStyle}
            />
          </div>
        </div>

        {/* 3. Itens do pedido (cardápio da loja) */}
        <div style={{ marginBottom: 14 }}>
          <p style={labelStyle}>Itens do pedido *</p>
          <input
            value={buscaItem}
            onChange={e => setBuscaItem(e.target.value)}
            placeholder={cardapio.length ? "Buscar no cardápio…" : "Nenhum item disponível no cardápio da loja"}
            disabled={cardapio.length === 0}
            style={campoStyle}
            autoComplete="off"
          />
          {/* Cardápio da loja sempre visível, agrupado por categoria — a busca só filtra */}
          {cardapio.length > 0 && (() => {
            const n = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            const q = n(buscaItem.trim())
            const lista = q ? cardapio.filter(p => n(p.nome).includes(q) || n(p.categoria).includes(q)) : cardapio
            const categorias = [...new Set(lista.map(p => p.categoria))]
            return (
              <div style={{ marginTop: 8, maxHeight: 340, overflowY: "auto", border: "1.5px solid var(--pedra)", borderRadius: 12, background: "white" }}>
                {lista.length === 0 && <p style={{ padding: "12px 14px", fontSize: 12, color: "var(--suave)" }}>Nenhum item encontrado</p>}
                {categorias.map(cat => (
                  <div key={cat}>
                    <p style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--pedra)", padding: "7px 14px", fontSize: 11, fontWeight: 800, color: "var(--suave)", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid var(--pedra)" }}>{cat}</p>
                    {lista.filter(p => p.categoria === cat).map(p => {
                      const noCarrinho = carrinho.filter(i => i.produto_id === p.id).reduce((t, i) => t + i.quantidade, 0)
                      return (
                        <button key={p.id} type="button" onClick={() => escolherProduto(p)} style={{
                          width: "100%", textAlign: "left", padding: "10px 14px", background: noCarrinho ? "var(--pimenta-claro)" : "none", border: "none",
                          borderBottom: "1px solid var(--pedra)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                        }}>
                          <span style={{ fontSize: 13, color: "var(--grafite)", minWidth: 0 }}>
                            {noCarrinho > 0 && <strong style={{ color: "var(--pimenta-esc)" }}>{noCarrinho}× </strong>}{p.nome}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--grafite)", whiteSpace: "nowrap" }}>{brl(p.preco)}</span>
                            <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--pimenta)", color: "white", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>+</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })()}

          {carrinho.length > 0 && (
            <div style={{ marginTop: 10, border: "1.5px solid var(--pedra)", borderRadius: 12, overflow: "hidden" }}>
              {carrinho.map(i => (
                <div key={i.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: "1px solid var(--pedra)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--grafite)" }}>{i.nome}</p>
                    {i.adicionais.length > 0 && <p style={{ fontSize: 11, color: "var(--suave)" }}>+ {i.adicionais.map(a => a.nome).join(", ")}</p>}
                    {i.observacao && <p style={{ fontSize: 11, color: "var(--suave)", fontStyle: "italic" }}>Obs: {i.observacao}</p>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button type="button" onClick={() => alterarQtd(i.key, -1)} style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px solid var(--linha)", background: "white", fontWeight: 900, cursor: "pointer" }}>−</button>
                    <span style={{ minWidth: 18, textAlign: "center", fontWeight: 800, fontSize: 13 }}>{i.quantidade}</span>
                    <button type="button" onClick={() => alterarQtd(i.key, 1)} style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px solid var(--linha)", background: "white", fontWeight: 900, cursor: "pointer" }}>+</button>
                  </div>
                  <span style={{ width: 78, textAlign: "right", fontSize: 13, fontWeight: 800, color: "var(--grafite)" }}>{brl(precoItem(i))}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "var(--pedra)" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--suave)" }}>Subtotal dos itens</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: "var(--grafite)" }}>{brl(subtotalCarrinho)}</span>
              </div>
            </div>
          )}
        </div>

        {/* 4. Observação */}
        <div style={{ marginBottom: 18 }}>
          <p style={labelStyle}>Observação</p>
          <textarea
            value={form.observacao}
            onChange={e => set("observacao", e.target.value)}
            placeholder="Instruções especiais (troco, portão, etc.)…"
            rows={2}
            style={{ ...campoStyle, resize: "none", fontFamily: "inherit" }}
          />
        </div>

        {produtoEscolhendo && (() => {
          const grupos = gruposDoProduto(produtoEscolhendo.adicionais)
          const faltando = grupos.find(g => g.obrigatorio && (selAdic[g.id]?.length ?? 0) < (g.minimo || 1))
          const marcar = (g: GrupoAdic, id: string) => setSelAdic(prev => {
            const atual = prev[g.id] ?? []
            if (atual.includes(id)) return { ...prev, [g.id]: atual.filter(x => x !== id) }
            if (g.maximo === 1) return { ...prev, [g.id]: [id] }
            if (atual.length >= g.maximo) return prev
            return { ...prev, [g.id]: [...atual, id] }
          })
          const escolhidos = grupos.flatMap(g => g.itens.filter(i => (selAdic[g.id] ?? []).includes(i.id)))
          return (
            <div onClick={() => setProdutoEscolhendo(null)} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              <div onClick={e => e.stopPropagation()} style={{
                background: "white", width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto",
                borderRadius: "18px 18px 0 0", padding: "18px 18px calc(18px + env(safe-area-inset-bottom, 0px))",
              }}>
                <p style={{ fontSize: 16, fontWeight: 900, color: "var(--grafite)" }}>{produtoEscolhendo.nome}</p>
                <p style={{ fontSize: 13, color: "var(--suave)", marginBottom: 12 }}>{brl(produtoEscolhendo.preco)}</p>
                {grupos.map(g => (
                  <div key={g.id} style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 800, color: "var(--grafite)", marginBottom: 6 }}>
                      {g.nome} {g.obrigatorio ? <span style={{ color: "var(--pimenta)" }}>· obrigatório</span> : <span style={{ color: "var(--suave)", fontWeight: 600 }}>· até {g.maximo}</span>}
                    </p>
                    {g.itens.map(it => {
                      const on = (selAdic[g.id] ?? []).includes(it.id)
                      return (
                        <button key={it.id} type="button" onClick={() => marcar(g, it.id)} style={{
                          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", marginBottom: 6,
                          borderRadius: 10, cursor: "pointer", background: on ? "var(--pimenta-claro)" : "white",
                          border: on ? "1.5px solid var(--pimenta)" : "1.5px solid var(--linha)", fontSize: 13, color: "var(--grafite)",
                        }}>
                          <span>{on ? "✓ " : ""}{it.nome}</span>
                          <span style={{ color: "var(--suave)" }}>{it.preco > 0 ? `+ ${brl(it.preco)}` : "grátis"}</span>
                        </button>
                      )
                    })}
                  </div>
                ))}
                <input value={obsItem} onChange={e => setObsItem(e.target.value)} placeholder="Observação do item (opcional)" style={{ ...campoStyle, marginBottom: 12 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setProdutoEscolhendo(null)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "1.5px solid var(--linha)", background: "white", fontWeight: 800, cursor: "pointer" }}>Cancelar</button>
                  <button type="button" disabled={!!faltando} onClick={() => { adicionarAoCarrinho(produtoEscolhendo, escolhidos, obsItem.trim()); setProdutoEscolhendo(null) }} style={{
                    flex: 2, padding: 12, borderRadius: 12, border: "none", fontWeight: 900, cursor: faltando ? "not-allowed" : "pointer",
                    background: faltando ? "var(--linha)" : "var(--pimenta)", color: faltando ? "var(--suave)" : "white",
                  }}>
                    {faltando ? `Escolha: ${faltando.nome}` : `Adicionar · ${brl(produtoEscolhendo.preco + escolhidos.reduce((t, a) => t + a.preco, 0))}`}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Pagamento */}
        <div style={{ marginBottom: 14 }}>
          <p style={labelStyle}>Forma de pagamento *</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
            {([
              ["dinheiro", "💵 Dinheiro"],
              ["maquininha", "💳 Maquininha"],
              ["pix_loja", "✅ Pix na conta da loja"],
            ] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setFormaPgto(v)} style={{
                padding: "11px 10px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700,
                background: formaPgto === v ? "var(--pimenta-claro)" : "white", color: formaPgto === v ? "var(--pimenta-esc)" : "var(--grafite)",
                border: formaPgto === v ? "1.5px solid var(--pimenta)" : "1.5px solid var(--linha)",
              }}>{label}</button>
            ))}
          </div>
          {formaPgto === "dinheiro" && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--grafite)", cursor: "pointer" }}>
                <input type="checkbox" checked={precisaTroco} onChange={e => setPrecisaTroco(e.target.checked)} /> Precisa de troco
              </label>
              {precisaTroco && (
                <input
                  value={trocoPara}
                  onChange={e => {
                    const d = e.target.value.replace(/\D/g, "")
                    setTrocoPara(d ? (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "")
                  }}
                  inputMode="numeric"
                  placeholder="Troco para R$ 0,00"
                  style={{ ...campoStyle, width: 180 }}
                />
              )}
            </div>
          )}
          {formaPgto === "maquininha" && (
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              {([["credito", "Crédito"], ["debito", "Débito"]] as const).map(([v, label]) => (
                <button key={v} type="button" onClick={() => setTipoMaquininha(v)} style={{
                  flex: 1, padding: "9px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700,
                  background: tipoMaquininha === v ? "var(--pimenta-claro)" : "white", color: tipoMaquininha === v ? "var(--pimenta-esc)" : "var(--grafite)",
                  border: tipoMaquininha === v ? "1.5px solid var(--pimenta)" : "1.5px solid var(--linha)",
                }}>{label}</button>
              ))}
              <p style={{ alignSelf: "center", fontSize: 11, color: "var(--suave)", flex: 2 }}>O motoboy é avisado para levar a maquininha.</p>
            </div>
          )}
          {formaPgto === "pix_loja" && (
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--folha)" }}>Pago direto na conta da loja — o motoboy não cobra nada na entrega.</p>
          )}
        </div>

        {/* Resumo de valores */}
        {carrinho.length > 0 && (
          <div style={{ marginBottom: 16, border: "1.5px solid var(--pedra)", borderRadius: 12, padding: "10px 14px", background: "var(--pedra)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--suave)", marginBottom: 4 }}>
              <span>Produtos</span><span>{brl(subtotalCarrinho)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--suave)", marginBottom: 6 }}>
              <span>Taxa de entrega</span><span>{taxaInfo ? brl(taxaInfo.taxa) : calculandoTaxa ? "calculando…" : "informe o endereço"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 900, color: "var(--grafite)", borderTop: "1px solid var(--linha)", paddingTop: 6 }}>
              <span>Total{formaPgto === "dinheiro" || formaPgto === "maquininha" ? " a cobrar" : ""}</span><span>{brl(totalPedido)}</span>
            </div>
          </div>
        )}

        {ultimoPedido && sucesso && (
          <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: "var(--folha-claro)", border: "1px solid #BBF7D0" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--folha)" }}>
              ✓ Pedido #{ultimoPedido} criado e em preparo. <a href="/loja?foco=preparo" style={{ color: "var(--folha)", textDecoration: "underline" }}>Ver no painel de Pedidos</a>
            </p>
          </div>
        )}

        <button type="submit" disabled={enviando} style={{
          width: "100%", padding: "13px", borderRadius: 12, border: "none",
          background: enviando ? "var(--linha)" : "linear-gradient(135deg, var(--pimenta), var(--pimenta))",
          color: enviando ? "var(--suave)" : "white",
          fontWeight: 800, fontSize: 14, cursor: enviando ? "not-allowed" : "pointer",
          boxShadow: enviando ? "none" : "0 4px 16px rgba(215,38,30,0.35)",
        }}>
          {enviando ? "Criando pedido…" : "🧾 Criar pedido e imprimir cupom"}
        </button>
      </form>

      {/* Clientes recorrentes */}
      {clientes.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: "var(--texto)", marginBottom: 12 }}>
            Clientes salvos ({clientes.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clientes.slice(0, 8).map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => { selecionarCliente(c); window.scrollTo({ top: 0, behavior: "smooth" }) }}
                style={{
                  background: "white", borderRadius: 12, border: "1.5px solid var(--pedra)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "12px 16px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  cursor: "pointer", textAlign: "left", width: "100%",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--grafite)", margin: 0 }}>{c.nome}</p>
                  <p style={{ fontSize: 12, color: "var(--suave)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.telefone && <>{c.telefone} · </>}
                    {c.endereco}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "var(--pimenta)", margin: 0 }}>{c.total_pedidos}x</p>
                  <p style={{ fontSize: 11, color: "var(--suave)", margin: 0 }}>
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
          <p style={{ fontSize: 13, fontWeight: 800, color: "var(--texto)", marginBottom: 12 }}>
            Avulsas anteriores ({entregas.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entregas.map(e => (
              <div key={e.id} style={{
                background: "white", borderRadius: 12, border: "1.5px solid var(--pedra)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "12px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--pimenta)" }}>#{e.codigo}</span>
                    <StatusBadge status={e.status} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "var(--suave)" }}>
                      {new Date(e.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <button
                      type="button"
                      onClick={() => imprimirEntregaAvulsa(e, larguraPapel)}
                      title="Imprimir comanda"
                      style={{
                        display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 7,
                        border: "1px solid var(--linha)", background: "var(--pedra)", color: "var(--suave)",
                        fontSize: 11, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      🖨️ Imprimir
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--grafite)", marginBottom: 2 }}>{e.cliente_nome}</p>
                <p style={{ fontSize: 12, color: "var(--suave)" }}>{e.endereco}</p>
                {(e.itens ?? []).length > 0 && (
                  <p style={{ fontSize: 12, color: "var(--suave)", marginTop: 4 }}>
                    {(e.itens ?? []).map(i => `${i.quantidade}x ${i.nome}`).join(" · ")}
                  </p>
                )}
                {(e.valor_pedido > 0 || e.taxa_entrega > 0) && (
                  <p style={{ fontSize: 12, color: "var(--suave)", marginTop: 4 }}>
                    Pedido: R$ {Number(e.valor_pedido).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {e.taxa_entrega > 0 && ` · Entrega: R$ ${Number(e.taxa_entrega).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
