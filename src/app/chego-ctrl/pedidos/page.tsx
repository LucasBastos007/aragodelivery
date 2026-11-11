"use client"

// Pedidos (admin 2.0, 20/10/2026): a esteira inteira, do pagamento até a porta do cliente.
// Colunas por etapa (ou lista), tempo em cada etapa e o pedido aberto numa gaveta com tudo.
// Ações de antes, todas mantidas: avançar no lugar da loja (/api/admin/avancar-pedido), chamar
// outro motoboy (/api/escalada), forçar entregue (/api/admin/completar-pedido), conferir cartão
// (/api/pagamento/verificar), confirmar pagamento na mão (/api/admin/confirmar-pagamento-manual),
// avulsas (/api/admin/avancar-avulsa, /api/escalada-avulsa) e excluir (/api/chego-ctrl/excluir-pedido),
// que fica escondido em "Mais opções" pra não apagar pedido por engano.
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Pedido, StatusPedido } from "@/types"
import { rotuloPagamento, temForma, ehDividido } from "@/lib/pagamentoDividido"

type Periodo = "hoje" | "7d" | "15d" | "30d" | "custom"
type Filtro = "andamento" | "atrasados" | "entregues" | "cancelados" | "todos" | "avulsas"

const brl = (v: number) => `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const hh = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""
const dataBRT = (o = 0) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + o * 86_400_000))
const minDesde = (iso?: string | null) => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000)) : 0
const tempo = (m: number) => m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${Math.floor(m / 1440)} d`
const FORMA: Record<string, string> = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha", pix_loja: "Pix na loja", google_pay: "Google Pay" }

function rangeDatas(p: Periodo, ci: string, cf: string) {
  const d = p === "7d" ? -6 : p === "15d" ? -14 : p === "30d" ? -29 : 0
  if (p === "custom" && ci && cf) return { inicio: `${ci}T03:00:00`, fim: `${somaDia(cf)}T02:59:59` }
  return { inicio: `${dataBRT(d)}T03:00:00`, fim: `${dataBRT(1)}T02:59:59` }
}
const somaDia = (ymd: string) => { const x = new Date(`${ymd}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10) }

// Etapas da esteira. ts = de quando conta o tempo na etapa; lim = minutos até ficar atrasado.
const COLUNAS = [
  { id: "pag", nome: "Aguardando pagamento", cor: "#706C64", st: ["aguardando_pagamento"], ts: "criado_em", lim: 10 },
  { id: "loja", nome: "Esperando a loja", cor: "#F5B700", st: ["pendente"], ts: "criado_em", lim: 5 },
  { id: "cozinha", nome: "Na cozinha", cor: "#1F5FBF", st: ["aceito", "preparando"], ts: "aceito_em", lim: 40 },
  { id: "pronto", nome: "Pronto, sem motoboy", cor: "#D7261E", st: ["pronto", "aguardando_aceite"], ts: "pronto_em", lim: 8 },
  { id: "buscar", nome: "Motoboy indo buscar", cor: "#6B3FC4", st: ["indo_para_loja", "na_loja"], ts: "pronto_em", lim: 20 },
  { id: "rua", nome: "Saiu pra entrega", cor: "#1E8A4C", st: ["coletado", "em_rota"], ts: "coletado_em", lim: 40 },
] as const
// Última coluna da esteira: entregues do período (não conta como em andamento nem atrasa)
const COL_ENTREGUE = { id: "entregue", nome: "Entregue", cor: "#34B86E" }
const NOME_ST: Record<string, [string, string]> = {
  aguardando_pagamento: ["Aguardando pagamento", "cinza"], pendente: ["Esperando a loja", "amarelo"], aceito: ["Aceito pela loja", "azul"], preparando: ["Na cozinha", "azul"],
  pronto: ["Pronto, sem motoboy", "vermelho"], aguardando_aceite: ["Chamando motoboy", "vermelho"], indo_para_loja: ["Motoboy indo à loja", "roxo"], na_loja: ["Motoboy na loja", "roxo"],
  coletado: ["Coletado", "verde"], em_rota: ["Saiu pra entrega", "verde"], entregue: ["Entregue", "verde"], cancelado: ["Cancelado", "vermelho"],
}
const AVULSA_COL: Record<string, string> = { aguardando: "pronto", aguardando_aceite: "pronto", aceito: "buscar", coletado: "rua", em_rota: "rua" }
const AVULSA_ST: Record<string, string> = { aguardando: "Esperando motoboy", aguardando_aceite: "Esperando motoboy", aceito: "Motoboy indo à loja", coletado: "Coletado", em_rota: "Em rota", entregue: "Entregue", cancelado: "Cancelado" }
const AVANCA_LOJA: Record<string, string> = { pendente: "Aceitar no lugar da loja", aceito: "Iniciar preparo", preparando: "Marcar pronto" }
const AVANCA_AVULSA: Record<string, string> = { aceito: "Marcar coletado", coletado: "Saiu pra entrega", em_rota: "Marcar entregue" }
const REESCALA = ["pronto", "aguardando_aceite", "indo_para_loja", "na_loja"]
const FORCA = ["pronto", "aguardando_aceite", "indo_para_loja", "na_loja", "em_rota", "coletado"]

// Retirada na loja: não chama motoboy; pronto = esperando o cliente buscar (31/10/2026)
const ehRetirada = (p: any) => p?.tipo_entrega === "retirada" || !!p?.endereco_entrega?.includes("Retirada")
function colDe(p: any) { return COLUNAS.find(c => (c.st as readonly string[]).includes(p.status)) }
function atraso(p: any) { const c = colDe(p); if (!c) return { m: 0, atrasado: false }; const m = minDesde(p[c.ts] ?? p.atualizado_em ?? p.criado_em); const lim = c.id === "pronto" && ehRetirada(p) ? 30 : c.lim; return { m, atrasado: m >= lim } }
const wa = (tel?: string | null, msg = "") => { const t = (tel ?? "").replace(/\D/g, ""); return t ? `https://wa.me/55${t}?text=${encodeURIComponent(msg)}` : null }

async function post(url: string, body: object) {
  const r = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  return { ok: r.ok, j: await r.json().catch(() => ({})) as any }
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [avulsas, setAvulsas] = useState<any[]>([])
  const [fones, setFones] = useState<{ loja: Record<string, string>; mb: Record<string, { nome: string; tel: string }> }>({ loja: {}, mb: {} })
  const [carregou, setCarregou] = useState(false)
  // "Agora no app": clientes com o app aberto nos últimos 2 min (31/10/2026)
  const [online, setOnline] = useState<{ total: number; lojas: number; checkout: number; pedido: number } | null>(null)
  useEffect(() => {
    const ler = () => fetch("/api/admin/online", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(j => j && setOnline(j)).catch(() => {})
    ler(); const iv = setInterval(ler, 30_000); return () => clearInterval(iv)
  }, [])
  const [periodo, setPeriodo] = useState<Periodo>("hoje")
  const [ci, setCi] = useState(""), [cf, setCf] = useState("")
  const [filtro, setFiltro] = useState<Filtro>("andamento")
  const [visao, setVisao] = useState<"colunas" | "lista">("colunas")
  const [busca, setBusca] = useState("")
  const [colCel, setColCel] = useState("loja")
  const [aberto, setAberto] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<Record<string, { t: string; ok: boolean }>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)

  async function load(per = periodo) {
    const { inicio, fim } = rangeDatas(per, ci, cf)
    const [{ data: ped }, { data: av }] = await Promise.all([
      supabase.from("pedidos").select("*, loja:lojas(nome, telefone, logo_url), motoboy:motoboys(nome, telefone), itens:itens_pedido(*)")
        .gte("criado_em", inicio).lte("criado_em", fim).order("criado_em", { ascending: false }).limit(1000),
      supabase.from("entregas_avulsas").select("*").gte("criado_em", inicio).lte("criado_em", fim).order("criado_em", { ascending: false }).limit(1000),
    ])
    setPedidos((ped as Pedido[]) ?? [])
    const avl = av ?? []; setAvulsas(avl)
    const lIds = [...new Set(avl.map((a: any) => a.loja_id).filter(Boolean))], mIds = [...new Set(avl.map((a: any) => a.motoboy_id).filter(Boolean))]
    const [{ data: ls }, { data: ms }] = await Promise.all([
      lIds.length ? supabase.from("lojas").select("id, telefone").in("id", lIds) : Promise.resolve({ data: [] as any[] }),
      mIds.length ? supabase.from("motoboys").select("id, nome, telefone").in("id", mIds) : Promise.resolve({ data: [] as any[] }),
    ])
    setFones({ loja: Object.fromEntries((ls ?? []).map((l: any) => [l.id, l.telefone])), mb: Object.fromEntries((ms ?? []).map((m: any) => [m.id, { nome: m.nome, tel: m.telefone }])) })
    setCarregou(true)
  }

  useEffect(() => {
    if (periodo === "custom" && (!ci || !cf)) return
    load(periodo)
    if (periodo === "hoje") { const iv = setInterval(() => load("hoje"), 8_000); return () => clearInterval(iv) }
  }, [periodo, ci, cf])

  // Abrir direto pelo código (links do Início, Ao vivo e da busca ⌘K)
  useEffect(() => {
    const cod = new URLSearchParams(window.location.search).get("codigo")
    if (!cod || !carregou) return
    const p = pedidos.find(x => x.codigo === cod)
    if (p) { setAberto(p.id); return }
    supabase.from("pedidos").select("criado_em").eq("codigo", cod).maybeSingle().then(({ data }) => {
      if (data && periodo === "hoje") { const d = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date((data as any).criado_em)); setCi(d); setCf(d); setPeriodo("custom"); setFiltro("todos") }
    })
  }, [carregou])
  useEffect(() => { const cod = new URLSearchParams(window.location.search).get("codigo"); if (cod && !aberto) { const p = pedidos.find(x => x.codigo === cod); if (p) setAberto(p.id) } }, [pedidos])

  const aviso = (id: string, t: string, ok: boolean) => setAvisos(a => ({ ...a, [id]: { t, ok } }))
  const muda = (id: string, campos: Partial<Pedido>) => setPedidos(ps => ps.map(x => x.id === id ? { ...x, ...campos } as Pedido : x))

  async function avancar(p: Pedido) {
    setOcupado(p.id); const { ok, j } = await post("/api/admin/avancar-pedido", { pedido_id: p.id }); setOcupado(null)
    if (ok) { muda(p.id, { status: j.pedido.status }); aviso(p.id, `Avançado: ${NOME_ST[j.pedido.status]?.[0] ?? j.pedido.status}.`, true) } else aviso(p.id, j.error ?? "Não deu certo.", false)
  }
  async function chamarOutro(p: Pedido) {
    setOcupado(p.id); const { ok, j } = await post("/api/escalada", { pedido_id: p.id, motoboy_recusou_id: p.motoboy_id ?? undefined }); setOcupado(null)
    aviso(p.id, ok && j.broadcast ? `Chamando ${j.broadcast} motoboy(s) de novo.` : ok ? (j.msg ?? "Nada a fazer agora.") : (j.error ?? "Não deu certo."), ok); if (ok) load()
  }
  async function forcarEntregue(p: Pedido) {
    setOcupado(p.id); const { ok, j } = await post("/api/admin/completar-pedido", { pedido_id: p.id }); setOcupado(null)
    if (ok && j.ok) { muda(p.id, { status: "entregue" as StatusPedido, entregue_em: new Date().toISOString() } as any); aviso(p.id, "Marcado como entregue.", true) } else aviso(p.id, j.error ?? "Não deu certo.", false)
  }
  async function conferirCartao(p: Pedido) {
    setOcupado(p.id); const { j } = await post("/api/pagamento/verificar", { pedido_id: p.id }); setOcupado(null)
    if (j.confirmado) { muda(p.id, { status: "pendente" as StatusPedido }); aviso(p.id, "O Asaas confirmou. Pedido liberado pra loja.", true) }
    else aviso(p.id, j.status === "cancelado" ? "O Asaas recusou o cartão." : "O Asaas ainda não confirmou.", false)
  }
  async function confirmarManual(p: Pedido, comprovante = "") {
    setOcupado(p.id); const { ok, j } = await post("/api/admin/confirmar-pagamento-manual", { pedido_id: p.id, comprovante }); setOcupado(null)
    if (ok && j.ok) { muda(p.id, { status: "pendente" as StatusPedido }); aviso(p.id, "Pagamento confirmado. A loja foi avisada.", true) } else aviso(p.id, j.error ?? "Não deu certo.", false)
  }
  async function excluir(p: Pedido) {
    setOcupado(p.id)
    const r = await fetch("/api/chego-ctrl/excluir-pedido", { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedido_id: p.id }) }).catch(() => null)
    setOcupado(null)
    if (r?.ok) { setPedidos(ps => ps.filter(x => x.id !== p.id)); setAberto(null) } else aviso(p.id, "Não foi possível excluir.", false)
  }
  async function avancarAvulsa(a: any) {
    setOcupado(a.id); const { ok, j } = await post("/api/admin/avancar-avulsa", { avulsa_id: a.id }); setOcupado(null)
    if (ok && j.ok) setAvulsas(xs => xs.map(x => x.id === a.id ? { ...x, status: j.avulsa.status } : x)); else aviso(a.id, j.error ?? "Não deu certo.", false)
  }
  async function chamarOutroAvulsa(a: any) {
    setOcupado(a.id); const { ok, j } = await post("/api/escalada-avulsa", { avulsa_id: a.id }); setOcupado(null)
    aviso(a.id, ok ? (j.msg ?? "Chamando outros motoboys.") : (j.error ?? "Não deu certo."), ok); if (ok) load()
  }

  const q = busca.trim().toLowerCase()
  const bate = (p: any) => !q || [p.codigo, p.loja?.nome, p.nome_cliente, p.loja_nome, p.cliente_nome].some(x => String(x ?? "").toLowerCase().includes(q))
  const vivos = pedidos.filter(p => colDe(p) && bate(p))
  const lista = useMemo(() => {
    const b = pedidos.filter(bate)
    if (filtro === "andamento") return b.filter(p => colDe(p))
    if (filtro === "atrasados") return b.filter(p => atraso(p).atrasado)
    if (filtro === "entregues") return b.filter(p => p.status === "entregue")
    if (filtro === "cancelados") return b.filter(p => p.status === "cancelado")
    return b
  }, [pedidos, filtro, q])
  const avs = avulsas.filter(bate)
  const ent = pedidos.filter(p => p.status === "entregue")
  const nAtras = pedidos.filter(p => atraso(p).atrasado).length
  const p = pedidos.find(x => x.id === aberto) ?? null
  const usaColunas = visao === "colunas" && filtro === "andamento"
  // No celular, abre na primeira etapa que tem pedido
  useEffect(() => { const c = COLUNAS.find(c => pedidos.some(x => colDe(x)?.id === c.id)); if (c && !pedidos.some(x => colDe(x)?.id === colCel)) setColCel(c.id) }, [pedidos])

  const Cartao = ({ p }: { p: any }) => {
    const a = atraso(p), act = AVANCA_LOJA[p.status], it: any[] = p.itens ?? []
    return (
      <button className={`ped ${a.atrasado ? "atrasado" : ""}`} onClick={() => setAberto(p.id)}>
        <span className="ped-cab"><span className="cod">#{p.codigo}</span>{ehRetirada(p) && <span className="selo amarelo">🏪 Retirada</span>}<span className="tempo" style={{ color: a.atrasado ? "var(--pimenta)" : "var(--suave)" }}>{tempo(a.m)}</span></span>
        <span className="ped-loja">{p.loja?.logo_url ? <img src={p.loja.logo_url} alt="" /> : <i>{(p.loja?.nome ?? "?")[0]}</i>}<b>{p.loja?.nome ?? "—"}</b></span>
        <span className="cli">Pra {p.nome_cliente ?? "cliente"}{p.endereco_entrega?.includes("Retirada") ? ", retira na loja" : ""}</span>
        {it.length > 0 && <span className="itens">{it.slice(0, 2).map(i => `${i.quantidade}× ${i.nome}`).join(", ")}{it.length > 2 ? ` e mais ${it.length - 2}` : ""}</span>}
        <span className="rodape"><span className="selo cinza">{ehDividido(p) ? rotuloPagamento(p) : FORMA[p.forma_pagamento] ?? p.forma_pagamento}</span><span className="total num">{brl(p.total)}</span></span>
        {p.motoboy?.nome && <span className="mb-linha"><span className="av">{p.motoboy.nome[0]}</span>{p.motoboy.nome}</span>}
        {avisos[p.id] && <span className={`aviso ${avisos[p.id].ok ? "vd" : "vm"}`} style={{ display: "block", marginTop: 8, fontSize: 13, padding: "8px 10px" }}>{avisos[p.id].t}</span>}
        {act && <span role="button" tabIndex={0} className="btn btn-p acao" aria-disabled={ocupado === p.id} onClick={e => { e.stopPropagation(); if (ocupado !== p.id) avancar(p) }}>{ocupado === p.id ? "Avançando…" : act}</span>}
        {(p.status === "pronto" || p.status === "aguardando_aceite") && ehRetirada(p) && <span className="t14 mut" style={{ display: "block", marginTop: 8 }}>Pronto. Esperando o cliente buscar na loja.</span>}
        {(p.status === "pronto" || p.status === "aguardando_aceite") && ehRetirada(p) && <span role="button" tabIndex={0} className="btn btn-s acao" onClick={e => { e.stopPropagation(); if (ocupado !== p.id) forcarEntregue(p) }}>{ocupado === p.id ? "Marcando…" : "Cliente retirou"}</span>}
        {(p.status === "pronto" || p.status === "aguardando_aceite") && !p.motoboy_id && !ehRetirada(p) && <span role="button" tabIndex={0} className="btn btn-p acao" onClick={e => { e.stopPropagation(); if (ocupado !== p.id) chamarOutro(p) }}>{ocupado === p.id ? "Chamando…" : "Chamar motoboys de novo"}</span>}
        {p.status === "aguardando_pagamento" && <span className="btn btn-s acao">Ver pagamento</span>}
      </button>
    )
  }
  const CartaoAvulsa = ({ a }: { a: any }) => {
    const mb = fones.mb[a.motoboy_id]
    return (
      <div className="ped avulsa">
        <span className="ped-cab"><span className="cod">#{a.codigo}</span><span className="selo roxo">Avulsa</span><span className="tempo" style={{ color: "var(--suave)" }}>{hh(a.criado_em)}</span></span>
        <span className="ped-loja"><i>{(a.loja_nome ?? "?")[0]}</i><b>{a.loja_nome ?? "—"}</b></span>
        <span className="cli">Pra {a.cliente_nome ?? "cliente"}, {AVULSA_ST[a.status] ?? a.status}</span>
        <span className="rodape"><span className="t14 mut">Entrega</span><span className="total num">{brl(a.taxa_entrega)}</span></span>
        {mb && <span className="mb-linha"><span className="av">{mb.nome[0]}</span>{mb.nome}</span>}
        {avisos[a.id] && <span className={`aviso ${avisos[a.id].ok ? "vd" : "vm"}`} style={{ display: "block", marginTop: 8, fontSize: 13, padding: "8px 10px" }}>{avisos[a.id].t}</span>}
        <span className="ped-links">
          {wa(fones.loja[a.loja_id], `Entrega avulsa *#${a.codigo}*`) && <a href={wa(fones.loja[a.loja_id], `Entrega avulsa *#${a.codigo}*`)!} target="_blank" rel="noreferrer">WhatsApp loja</a>}
          {wa(a.cliente_tel, `Entrega avulsa *#${a.codigo}*`) && <a href={wa(a.cliente_tel, `Entrega avulsa *#${a.codigo}*`)!} target="_blank" rel="noreferrer">Cliente</a>}
          {mb && wa(mb.tel, `Entrega avulsa *#${a.codigo}*`) && <a href={wa(mb.tel, `Entrega avulsa *#${a.codigo}*`)!} target="_blank" rel="noreferrer">Motoboy</a>}
        </span>
        {a.motoboy_id && AVANCA_AVULSA[a.status] && <button className="btn btn-s acao" disabled={ocupado === a.id} onClick={() => avancarAvulsa(a)}>{ocupado === a.id ? "Avançando…" : AVANCA_AVULSA[a.status]}</button>}
        {["aguardando", "aceito"].includes(a.status) && <button className="btn btn-s acao" disabled={ocupado === a.id} onClick={() => { if (!a.motoboy_id || confirm(`Tirar a entrega do ${mb?.nome ?? "motoboy"} e chamar outro?`)) chamarOutroAvulsa(a) }}>Chamar outro motoboy</button>}
      </div>
    )
  }

  return (
    <>
      <div className="pd-topo">
        <div className="pd-resumo"><b className="num">{brl(ent.reduce((s, x) => s + x.total, 0))}</b><span>{ent.length} entregues de {pedidos.length} pedidos {periodo === "hoje" ? "hoje" : "no período"}</span></div>
        {online && (
          <div className="pd-resumo" title="Clientes com o app aberto nos últimos 2 minutos">
            <b className="num" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--folha)", boxShadow: "0 0 0 3px rgba(30,138,76,.18)" }} />{online.total} {online.total === 1 ? "pessoa" : "pessoas"} no app agora</b>
            <span>{online.lojas} olhando lojas, {online.checkout} finalizando, {online.pedido} acompanhando pedido</span>
          </div>
        )}
        <input className="pd-busca" placeholder="Buscar código, loja ou cliente" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>
      <div className="pd-filtros">
        <div className="chips-l">
          {([["andamento", "Em andamento", vivos.length], ["atrasados", "Atrasados", nAtras], ["entregues", "Entregues", ent.length], ["cancelados", "Cancelados", pedidos.filter(x => x.status === "cancelado").length], ["todos", "Todos", pedidos.length], ["avulsas", "Avulsas", avulsas.length]] as [Filtro, string, number][]).map(([k, n, c]) => (
            <button key={k} className={`chip ${k === "atrasados" && c ? "quente" : ""}`} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{n} <span className="pd-n">{c}</span></button>))}
        </div>
        <div className="chips-l" style={{ marginLeft: "auto" }}>
          <select className="pd-sel" value={periodo} onChange={e => setPeriodo(e.target.value as Periodo)}>
            <option value="hoje">Hoje</option><option value="7d">7 dias</option><option value="15d">15 dias</option><option value="30d">30 dias</option><option value="custom">Escolher datas</option>
          </select>
          {filtro === "andamento" && <div className="pd-vis">{(["colunas", "lista"] as const).map(v => <button key={v} aria-pressed={visao === v} onClick={() => setVisao(v)}>{v === "colunas" ? "Colunas" : "Lista"}</button>)}</div>}
        </div>
      </div>
      {periodo === "custom" && <div className="lin" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}><input type="date" className="pd-sel" value={ci} onChange={e => setCi(e.target.value)} /><span className="mut">até</span><input type="date" className="pd-sel" value={cf} onChange={e => setCf(e.target.value)} /></div>}

      {!carregou ? <p className="mut">Carregando…</p> : filtro === "avulsas" ? (
        <div className="pd-grade">{avs.length ? avs.map(a => <CartaoAvulsa key={a.id} a={a} />) : <p className="vazio">Nenhuma entrega avulsa no período.</p>}</div>
      ) : usaColunas ? (
        <>
          {/* Celular: todas as etapas à vista numa grade, com a cor, a quantidade e quantos estão atrasados (21/10/2026) */}
          <div className="abas-col">{COLUNAS.map(c => {
            const n = vivos.filter(x => colDe(x)?.id === c.id).length + avs.filter(a => AVULSA_COL[a.status] === c.id).length
            const atr = vivos.filter(x => colDe(x)?.id === c.id && atraso(x).atrasado).length
            return <button key={c.id} aria-pressed={colCel === c.id} className={n ? "" : "zero"} onClick={() => setColCel(c.id)}>
              <i style={{ background: c.cor }} /><span className="nm">{c.nome}</span>
              <span className="n num">{n}</span>{atr > 0 && <span className="atr">{atr} {atr === 1 ? "atrasado" : "atrasados"}</span>}
            </button> })}
            <button aria-pressed={colCel === "entregue"} className={ent.length ? "" : "zero"} onClick={() => setColCel("entregue")}><i style={{ background: COL_ENTREGUE.cor }} /><span className="nm">Entregue</span><span className="n num">{ent.length}</span></button></div>
          <div className="colunas pd-esteira">
            {COLUNAS.map(c => {
              const cs = vivos.filter(x => colDe(x)?.id === c.id).sort((a, b) => atraso(b).m - atraso(a).m)
              const as = avs.filter(a => AVULSA_COL[a.status] === c.id)
              return (
                <div key={c.id} className={`col ${colCel === c.id ? "ativa" : ""}`}>
                  <div className="col-cab"><i style={{ background: c.cor }} /><b>{c.nome}</b><span className="n">{cs.length + as.length}</span></div>
                  {cs.map(x => <Cartao key={x.id} p={x} />)}
                  {as.map(a => <CartaoAvulsa key={a.id} a={a} />)}
                  {!cs.length && !as.length && <p className="pd-vazio">Nada aqui</p>}
                </div>
              )
            })}
            {(() => { const es = pedidos.filter(x => x.status === "entregue" && bate(x)).sort((a: any, b: any) => String(b.entregue_em ?? b.criado_em).localeCompare(String(a.entregue_em ?? a.criado_em))), ea = avs.filter(a => a.status === "entregue"); return (
              <div className={`col col-entregue ${colCel === "entregue" ? "ativa" : ""}`}>
                <div className="col-cab"><i style={{ background: COL_ENTREGUE.cor }} /><b>{COL_ENTREGUE.nome}</b><span className="n">{es.length + ea.length}</span></div>
                {es.slice(0, 40).map((x: any) => (
                  <button key={x.id} className="ped feito" onClick={() => setAberto(x.id)}>
                    <span className="ped-cab"><span className="cod">#{x.codigo}</span><span className="tempo" style={{ color: "var(--folha)" }}>{hh(x.entregue_em)}</span></span>
                    <span className="ped-loja">{x.loja?.logo_url ? <img src={x.loja.logo_url} alt="" /> : <i>{(x.loja?.nome ?? "?")[0]}</i>}<b>{x.loja?.nome ?? "—"}</b></span>
                    <span className="rodape"><span className="t12 mut">{x.motoboy?.nome ?? (x.endereco_entrega?.includes("Retirada") ? "retirada" : "")}{x.coletado_em && x.entregue_em ? `, ${Math.round((new Date(x.entregue_em).getTime() - new Date(x.coletado_em).getTime()) / 60000)} min na rua` : ""}</span><span className="total num">{brl(x.total)}</span></span>
                  </button>))}
                {ea.map(a => <CartaoAvulsa key={a.id} a={a} />)}
                {es.length > 40 && <button className="btn btn-l" style={{ width: "100%" }} onClick={() => setFiltro("entregues")}>Ver os {es.length} entregues</button>}
                {!es.length && !ea.length && <p className="pd-vazio">Nenhum entregue ainda</p>}
              </div>) })()}
          </div>
        </>
      ) : (
        <div className="cartao" style={{ padding: 6, overflow: "auto" }}>
          <table className="tabela pd-tab"><thead><tr><th>Hora</th><th>Pedido</th><th>Loja</th><th className="esconde-cel">Cliente</th><th>Situação</th><th className="esconde-cel">Motoboy</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
            <tbody>{lista.map((x: any) => { const st = NOME_ST[x.status] ?? [x.status, "cinza"], a = atraso(x); return (
              <tr key={x.id} onClick={() => setAberto(x.id)} style={{ cursor: "pointer" }}>
                <td className="num mut">{periodo === "hoje" ? hh(x.criado_em) : new Date(x.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                <td><b>#{x.codigo}</b></td><td>{x.loja?.nome ?? "—"}</td><td className="esconde-cel">{x.nome_cliente ?? "—"}</td>
                <td><span className={`selo ${st[1]}`}>{st[0]}</span>{a.atrasado && <small className="pd-atr">há {tempo(a.m)}</small>}</td>
                <td className="esconde-cel">{x.motoboy?.nome ?? <span className="mut">—</span>}</td>
                <td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{brl(x.total)}</td></tr>) })}
              {!lista.length && <tr><td colSpan={7} className="vazio">Nenhum pedido aqui.</td></tr>}
            </tbody></table>
        </div>
      )}

      <div className={`veu ${p ? "on" : ""}`} onClick={() => setAberto(null)} style={p ? undefined : { display: "none" }} />
      <aside className={`gaveta ${p ? "on" : ""}`} aria-hidden={!p}>
        {p && <Gaveta p={p as any} ocupado={ocupado === p.id} aviso={avisos[p.id]} onFechar={() => setAberto(null)}
          acoes={{ avancar: () => avancar(p), chamarOutro: () => chamarOutro(p), forcar: () => forcarEntregue(p), cartao: () => conferirCartao(p), manual: () => confirmarManual(p), manualCom: (t: string) => confirmarManual(p, t), excluir: () => excluir(p) }} />}
      </aside>
    </>
  )
}

function Gaveta({ p, ocupado, aviso, onFechar, acoes }: { p: any; ocupado: boolean; aviso?: { t: string; ok: boolean }; onFechar: () => void; acoes: Record<string, (...a: any[]) => void> }) {
  const [confirma, setConfirma] = useState<string | null>(null)
  const [comprovante, setComprovante] = useState("")
  const [mais, setMais] = useState(false)
  useEffect(() => { setConfirma(null); setMais(false); setComprovante("") }, [p.id])
  // Liberou: fecha a caixa; se o servidor pediu comprovante, ela fica aberta com o aviso em cima
  useEffect(() => { if (p.status !== "aguardando_pagamento") setConfirma(c => c === "manual" ? null : c) }, [p.status])
  const st = NOME_ST[p.status] ?? [p.status, "cinza"], it: any[] = p.itens ?? []
  const retirada = p.endereco_entrega?.includes("Retirada")
  const etapas: [string, string | null][] = retirada
    ? [["Pedido feito", p.criado_em], ["Loja aceitou", p.aceito_em], ["Pronto pra retirar", p.pronto_em], ["Retirado", p.entregue_em]]
    : [["Pedido feito", p.criado_em], ["Loja aceitou", p.aceito_em], ["Pronto", p.pronto_em], ["Motoboy coletou", p.coletado_em], ["Entregue", p.entregue_em]]
  const iAtual = p.status === "cancelado" ? -1 : etapas.findIndex(e => !e[1])
  const Conf = ({ k, txt, sim, fn, perigo }: { k: string; txt: string; sim: string; fn: () => void; perigo?: boolean }) => confirma === k
    ? <div className={`aviso ${perigo ? "vm" : "am"}`} style={{ marginTop: 8 }}>{txt}<div className="lin" style={{ gap: 8, marginTop: 8 }}><button className={`btn ${perigo ? "btn-p" : "btn-v"}`} style={{ minHeight: 40, flex: 1 }} disabled={ocupado} onClick={() => { fn(); setConfirma(null) }}>{ocupado ? "…" : sim}</button><button className="btn btn-s" style={{ minHeight: 40, flex: 1 }} onClick={() => setConfirma(null)}>Voltar</button></div></div>
    : null
  const linkWa = (tel: string | null | undefined, rot: string, msg: string) => { const u = wa(tel, msg); return u ? <a className="btn btn-s gav-wa" href={u} target="_blank" rel="noreferrer">{rot}</a> : null }

  return (
    <>
      <div className="gav-cab">
        <span style={{ flex: 1, minWidth: 0 }}><b className="t20">Pedido #{p.codigo}</b><br /><span className={`selo ${st[1]}`}>{st[0]}</span> <span className="t14 mut">{new Date(p.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></span>
        <button className="btn btn-s" style={{ minHeight: 40, padding: "0 12px" }} onClick={onFechar} aria-label="Fechar">Fechar</button>
      </div>
      <div className="gav-corpo">
        {aviso && <div className={`aviso ${aviso.ok ? "vd" : "vm"}`} style={{ marginBottom: 12 }}>{aviso.t}</div>}
        {p.status === "cancelado"
          ? <div className="aviso vm" style={{ marginBottom: 14 }}>Pedido cancelado{p.motivo_cancelamento ? `: ${p.motivo_cancelamento}` : "."}</div>
          : <ul className="linha-tempo" style={{ marginBottom: 6 }}>{etapas.map(([n, ts], i) => <li key={n} className={ts ? "feito" : i === iAtual ? "agora" : ""}>{n}<small>{ts ? hh(ts) : i === iAtual ? "esperando" : "ainda não"}</small></li>)}</ul>}
        {p.coletado_em && p.entregue_em && <p className="t14 mut" style={{ marginBottom: 12 }}>Entrega levou <b style={{ color: "var(--grafite)" }}>{Math.round((new Date(p.entregue_em).getTime() - new Date(p.coletado_em).getTime()) / 60000)} min</b> da loja até o cliente.</p>}

        <div className="gav-sec"><small>Loja</small><b>{p.loja?.nome ?? "—"}</b>{linkWa(p.loja?.telefone, "WhatsApp da loja", `Pedido *#${p.codigo}*`)}</div>
        <div className="gav-sec"><small>Cliente</small><b>{p.nome_cliente ?? "—"}</b><span className="t14">{p.endereco_entrega}</span>{linkWa(p.telefone_cliente, "WhatsApp do cliente", `Pedido *#${p.codigo}*`)}</div>
        <div className="gav-sec"><small>Motoboy</small>{p.motoboy?.nome ? <><b>{p.motoboy.nome}</b>{linkWa(p.motoboy?.telefone, "WhatsApp do motoboy", `Entrega *#${p.codigo}*`)}</> : <span className="t14 mut">{retirada ? "Cliente retira na loja." : "Ninguém pegou ainda."}</span>}</div>

        <div className="gav-sec"><small>Itens</small>
          {it.length === 0 ? <span className="t14 mut">Sem itens.</span> : it.map((x: any, i: number) => (
            <div key={x.id ?? i} className="gav-item"><span><b>{x.quantidade}× {x.nome}</b>
              {Array.isArray(x.adicionais) && x.adicionais.map((ad: any, j: number) => <small key={j}>+ {ad.nome ?? ad}{ad.preco > 0 ? ` ${brl(ad.preco)}` : ""}</small>)}
              {x.observacao && <small style={{ color: "var(--pimenta-esc)" }}>Obs: {x.observacao}</small>}</span><b className="num">{brl(x.preco * x.quantidade)}</b></div>))}
          <div className="gav-tot"><span>Produtos</span><b className="num">{brl(p.subtotal)}</b></div>
          <div className="gav-tot"><span>Entrega</span><b className="num">{brl(p.taxa_entrega)}</b></div>
          {Number(p.desconto) > 0 && <div className="gav-tot"><span>Desconto{p.cupom_codigo ? ` (${p.cupom_codigo})` : ""}</span><b className="num">−{brl(p.desconto)}</b></div>}
          <div className="gav-tot forte"><span>Total, {ehDividido(p) ? rotuloPagamento(p) : (FORMA[p.forma_pagamento] ?? p.forma_pagamento)}</span><b className="num">{brl(p.total)}</b></div>
          {p.observacao && <div className="aviso am" style={{ marginTop: 8 }}>Obs do cliente: {p.observacao}</div>}
        </div>

        <div className="gav-sec"><small>O que o admin pode fazer</small>
          <div className="gav-acoes">
            {!["pendente", "aguardando_pagamento"].includes(p.status) && <a className="btn btn-s" href={`/chego-ctrl?reembolsos=1&codigo=${p.codigo}`}>Reembolsar</a>}
            {p.status === "aguardando_pagamento" && <>
              {temForma(p, "cartao") && <button className="btn btn-s" disabled={ocupado} onClick={acoes.cartao}>Conferir cartão no Asaas</button>}
              <button className="btn btn-v" disabled={ocupado} onClick={() => setConfirma("manual")}>Já recebi, liberar pedido</button>
            </>}
            {AVANCA_LOJA[p.status] && <button className="btn btn-p" disabled={ocupado} onClick={acoes.avancar}>{ocupado ? "Avançando…" : AVANCA_LOJA[p.status]}</button>}
            {REESCALA.includes(p.status) && !ehRetirada(p) && <button className="btn btn-s" disabled={ocupado} onClick={() => p.motoboy_id ? setConfirma("outro") : acoes.chamarOutro()}>{p.motoboy_id ? "Tirar do motoboy e chamar outro" : "Chamar motoboys de novo"}</button>}
            {FORCA.includes(p.status) && <button className="btn btn-s" disabled={ocupado} onClick={() => setConfirma("forca")}>{ehRetirada(p) ? "Cliente retirou" : "Marcar como entregue"}</button>}
            {!AVANCA_LOJA[p.status] && !REESCALA.includes(p.status) && !FORCA.includes(p.status) && p.status !== "aguardando_pagamento" && <span className="t14 mut">Nada pendente nesse pedido.</span>}
          </div>
          {confirma === "manual" && <div className="aviso am" style={{ marginTop: 8 }}>
            Se o Mercado Pago já mostra o Pix como pago, o pedido vai direto pra loja. Se ainda não mostra, escreva onde você viu o dinheiro.
            <textarea value={comprovante} onChange={e => setComprovante(e.target.value)} rows={2} placeholder="Ex.: comprovante no WhatsApp, R$ 36,99, 21h05, Nubank" style={{ width: "100%", marginTop: 8, padding: 8, borderRadius: 8, border: "1px solid var(--linha)", font: "inherit" }} />
            <div className="lin" style={{ gap: 8, marginTop: 8 }}><button className="btn btn-v" style={{ minHeight: 40, flex: 1 }} disabled={ocupado} onClick={() => acoes.manualCom(comprovante.trim())}>{ocupado ? "…" : "Liberar pedido"}</button><button className="btn btn-s" style={{ minHeight: 40, flex: 1 }} onClick={() => setConfirma(null)}>Voltar</button></div>
          </div>}
          <Conf k="outro" txt={`Tirar o pedido do ${p.motoboy?.nome ?? "motoboy"} e chamar outro? Ele recebe um aviso.`} sim="Tirar e chamar outro" fn={acoes.chamarOutro} />
          <Conf k="forca" txt="Marcar como entregue sem o motoboy confirmar? Use só se o cliente já recebeu." sim="Marcar entregue" fn={acoes.forcar} />
        </div>

        <button className="btn btn-l" style={{ padding: 0 }} onClick={() => setMais(!mais)}>{mais ? "Esconder mais opções" : "Mais opções"}</button>
        {mais && <div className="gav-sec" style={{ borderColor: "var(--pimenta-claro)" }}>
          <span className="t14 mut">Excluir apaga o pedido de vez, inclusive do financeiro. Prefira cancelar com o cliente.</span>
          <button className="btn btn-s" style={{ marginTop: 8, color: "var(--pimenta-esc)" }} onClick={() => setConfirma("excluir")}>Excluir pedido</button>
          <Conf k="excluir" txt={`Excluir o pedido #${p.codigo} de vez? Não dá pra desfazer.`} sim="Excluir" fn={acoes.excluir} perigo />
        </div>}
      </div>
    </>
  )
}
