"use client"

// Clientes (admin 2.0, 20/10/2026): quem pede, quanto gasta, quem voltou e quem sumiu.
// Dados de /api/admin/clientes. Na gaveta: contato, lojas preferidas, último pedido e frete fixo
// (o único dado que o admin muda aqui; vale antes de qualquer tabela de frete).
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import AcessosPainel from "../_AcessosPainel"

type Cli = { id: string; nome: string; telefone: string | null; email: string | null; criado_em: string; bairro: string | null; cidade: string | null; endereco: string; frete_fixo: number | null
  pedidos: number; gasto: number; cancelados: number; primeiro: string | null; ultimo: string | null; ultimoCodigo: string | null; lojas: { nome: string; n: number }[] }
type Filtro = "todos" | "voltaram" | "um" | "sumidos" | "nunca" | "novos"
const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dias = (iso: string | null) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null
const quando = (iso: string | null) => { const d = dias(iso); return d == null ? "nunca" : d === 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias` }
const mascara = (v: string) => { const d = v.replace(/\D/g, "").replace(/^0+/, "").slice(0, 6); return d ? (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "" }

function ClientesLista() {
  const [lista, setLista] = useState<Cli[]>([])
  const [carregou, setCarregou] = useState(false)
  const [erro, setErro] = useState("")
  const [filtro, setFiltro] = useState<Filtro>("todos")
  const [busca, setBusca] = useState("")
  const [ordem, setOrdem] = useState<"gasto" | "pedidos" | "ultimo" | "novo">("gasto")
  const [aberto, setAberto] = useState<string | null>(null)

  async function load() {
    const r = await fetch("/api/admin/clientes", { credentials: "include" })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setErro(j.error ?? "Não foi possível carregar."); return }
    setLista(j.clientes ?? []); setCarregou(true)
  }
  useEffect(() => { load() }, [])

  const regra: Record<Filtro, (c: Cli) => boolean> = {
    todos: () => true, voltaram: c => c.pedidos >= 2, um: c => c.pedidos === 1, nunca: c => c.pedidos === 0,
    sumidos: c => c.pedidos >= 2 && (dias(c.ultimo) ?? 0) > 30, novos: c => (dias(c.criado_em) ?? 99) <= 30,
  }
  const q = busca.trim().toLowerCase()
  const vis = useMemo(() => lista.filter(c => regra[filtro](c) && (!q || [c.nome, c.telefone, c.email, c.bairro].some(x => String(x ?? "").toLowerCase().includes(q))))
    .sort((a, b) => ordem === "gasto" ? b.gasto - a.gasto : ordem === "pedidos" ? b.pedidos - a.pedidos : ordem === "ultimo" ? String(b.ultimo ?? "").localeCompare(String(a.ultimo ?? "")) : b.criado_em.localeCompare(a.criado_em)), [lista, filtro, q, ordem])
  const compraram = lista.filter(c => c.pedidos > 0), voltaram = lista.filter(c => c.pedidos >= 2)
  const gastoTot = compraram.reduce((t, c) => t + c.gasto, 0), pedTot = compraram.reduce((t, c) => t + c.pedidos, 0)
  const sel = lista.find(c => c.id === aberto) ?? null

  if (!carregou) return <p className="mut">{erro || "Carregando…"}</p>
  return (
    <>
      <div className="kpis4">
        <div className="cartao kpi2"><small>Clientes cadastrados</small><b className="num">{lista.length.toLocaleString("pt-BR")}</b><span className="t14 mut">{lista.filter(regra.novos).length} novos em 30 dias</span></div>
        <div className="cartao kpi2"><small>Já compraram</small><b className="num">{compraram.length.toLocaleString("pt-BR")}</b><span className="t14 mut">{lista.length ? Math.round(compraram.length / lista.length * 100) : 0}% dos cadastrados</span></div>
        <div className="cartao kpi2"><small>Voltaram (2 pedidos ou mais)</small><b className="num">{voltaram.length.toLocaleString("pt-BR")}</b><span className="t14 mut">{compraram.length ? Math.round(voltaram.length / compraram.length * 100) : 0}% de quem comprou</span></div>
        <div className="cartao kpi2"><small>Gasto médio por cliente</small><b className="num">{brl(compraram.length ? gastoTot / compraram.length : 0)}</b><span className="t14 mut">{compraram.length ? (pedTot / compraram.length).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : 0} pedidos cada</span></div>
      </div>
      <div className="pd-topo" style={{ marginTop: 4 }}>
        <div className="chips-l" style={{ flex: 1 }}>
          {([["todos", "Todos"], ["voltaram", "Voltaram"], ["um", "Só 1 pedido"], ["sumidos", "Sumiram há 30 dias"], ["nunca", "Nunca compraram"], ["novos", "Novos"]] as [Filtro, string][]).map(([k, n]) =>
            <button key={k} className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{n} <span className="pd-n">{lista.filter(regra[k]).length}</span></button>)}
        </div>
        <input className="pd-busca" placeholder="Buscar nome, telefone ou bairro" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>
      <div className="cartao" style={{ padding: 6, overflow: "auto" }}>
        <table className="tabela">
          <thead><tr><th>Cliente</th><th className="esconde-cel">Bairro</th>
            {([["pedidos", "Pedidos"], ["gasto", "Gastou"], ["ultimo", "Último pedido"]] as const).map(([k, n]) => <th key={k} style={{ cursor: "pointer", textAlign: k === "gasto" ? "right" : undefined }} className={k === "ultimo" ? "esconde-cel" : undefined} onClick={() => setOrdem(k)}>{n}{ordem === k ? " ↓" : ""}</th>)}</tr></thead>
          <tbody>{vis.slice(0, 300).map(c => (
            <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setAberto(c.id)}>
              <td><span className="lin" style={{ gap: 10 }}><span className="mb-av" style={{ width: 34, height: 34, fontSize: 14 }}>{(c.nome ?? "?")[0]}</span><span style={{ minWidth: 0 }}><b>{c.nome ?? "Sem nome"}</b>{c.frete_fixo != null && <span className="selo azul" style={{ marginLeft: 6 }}>frete fixo</span>}<small className="lj-sub">{c.telefone ?? c.email ?? ""}</small></span></span></td>
              <td className="esconde-cel">{c.bairro ?? <span className="mut">—</span>}</td>
              <td className="num">{c.pedidos}{c.cancelados ? <small className="lj-sub">{c.cancelados} cancelado{c.cancelados > 1 ? "s" : ""}</small> : null}</td>
              <td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{brl(c.gasto)}</td>
              <td className="esconde-cel">{quando(c.ultimo)}</td>
            </tr>))}
            {!vis.length && <tr><td colSpan={5} className="vazio">Nenhum cliente aqui.</td></tr>}
          </tbody>
        </table>
        {vis.length > 300 && <p className="t12 mut" style={{ padding: 10 }}>Mostrando 300 de {vis.length}. Use a busca pra achar um cliente.</p>}
      </div>

      <div className={`veu ${sel ? "on" : ""}`} onClick={() => setAberto(null)} style={sel ? undefined : { display: "none" }} />
      <aside className={`gaveta lj-gav ${sel ? "on" : ""}`} aria-hidden={!sel}>{sel && <GavetaCli c={sel} onFechar={() => setAberto(null)} recarregar={load} />}</aside>
    </>
  )
}

function GavetaCli({ c, onFechar, recarregar }: { c: Cli; onFechar: () => void; recarregar: () => Promise<void> }) {
  const [frete, setFrete] = useState(c.frete_fixo == null ? "" : mascara(String(Math.round(c.frete_fixo * 100))))
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)
  const [env, setEnv] = useState(false)
  useEffect(() => { setFrete(c.frete_fixo == null ? "" : mascara(String(Math.round(c.frete_fixo * 100)))); setMsg(null) }, [c.id])
  const tel = (c.telefone ?? "").replace(/\D/g, "")
  const sumido = c.pedidos >= 1 && (dias(c.ultimo) ?? 0) > 30
  async function salvar(valor: string | null) {
    setEnv(true); setMsg(null)
    const r = await fetch("/api/admin/clientes", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, frete_fixo: valor == null ? null : Number(valor.replace(/\./g, "").replace(",", ".")) }) })
    const j = await r.json().catch(() => ({})); setEnv(false)
    if (!r.ok) { setMsg({ t: j.error ?? "Não deu certo.", ok: false }); return }
    await recarregar(); setMsg({ t: valor == null ? "Frete fixo removido: volta a valer a tabela normal." : `Frete fixo de R$ ${valor} salvo pra ${c.nome}.`, ok: true })
  }
  const dado = (n: string, v: unknown) => v ? <div className="lj-dado" key={n}><span>{n}</span><b>{String(v)}</b></div> : null
  return (
    <>
      <div className="gav-cab lj-cab"><span className="mb-av g">{(c.nome ?? "?")[0]}</span>
        <span style={{ flex: 1, minWidth: 0 }}><b className="t20">{c.nome ?? "Sem nome"}</b><br /><span className="t14 mut">Cliente desde {new Date(c.criado_em).toLocaleDateString("pt-BR")}</span></span>
        <button className="btn btn-s" style={{ minHeight: 40, padding: "0 12px" }} onClick={onFechar}>Fechar</button></div>
      <div className="gav-corpo">
        {msg && <div className={`aviso ${msg.ok ? "vd" : "vm"}`} role="status" style={{ marginBottom: 12 }}>{msg.t}</div>}
        <div className="mb-sem g"><span><b className="num">{c.pedidos}</b> pedidos</span><span><b className="num">{brl(c.gasto)}</b> gastos</span><span>último <b>{quando(c.ultimo)}</b></span></div>
        {tel && <div className="gav-acoes" style={{ marginBottom: 10 }}>
          <a className="btn btn-v" href={`https://wa.me/55${tel}${sumido ? `?text=${encodeURIComponent(`Oi ${c.nome?.split(" ")[0] ?? ""}! Sentimos sua falta no Chegô. Que tal pedir hoje?`)}` : ""}`} target="_blank" rel="noreferrer">{sumido ? "Chamar de volta no WhatsApp" : "Abrir WhatsApp"}</a></div>}
        {c.lojas.length > 0 && <div className="gav-sec"><small>Lojas que mais pede</small>{c.lojas.map(l => <div key={l.nome} className="lj-dado"><span>{l.nome}</span><b>{l.n} {l.n === 1 ? "pedido" : "pedidos"}</b></div>)}</div>}
        {c.ultimoCodigo && <div className="gav-sec"><small>Último pedido</small><Link className="btn btn-s" href={`/chego-ctrl/pedidos?codigo=${c.ultimoCodigo}`}>Abrir o #{c.ultimoCodigo}</Link></div>}
        <div className="gav-sec"><small>Frete fixo (vale antes de qualquer tabela)</small>
          <span className="t14 mut">Use pra quem mora longe ou tem combinado especial. Vazio = frete normal.</span>
          <div className="lin" style={{ gap: 8, marginTop: 6 }}><input className="pd-busca" style={{ flex: 1, width: "auto" }} inputMode="numeric" placeholder="Frete normal" value={frete} onChange={e => setFrete(mascara(e.target.value))} />
            <button className="btn btn-g" style={{ minHeight: 44 }} disabled={env || !frete} onClick={() => salvar(frete)}>Salvar</button></div>
          {c.frete_fixo != null && <button className="btn btn-l" style={{ padding: 0, alignSelf: "flex-start" }} disabled={env} onClick={() => salvar(null)}>Voltar pro frete normal</button>}
        </div>
        <div className="gav-sec" style={{ gap: 0 }}><small style={{ marginBottom: 4 }}>Contato e endereço</small>
          {[["Telefone", c.telefone], ["E-mail", c.email], ["Endereço", c.endereco], ["Bairro", c.bairro], ["Cidade", c.cidade], ["Primeiro pedido", c.primeiro ? new Date(c.primeiro).toLocaleDateString("pt-BR") : null], ["Cancelados", c.cancelados || null]].map(([n, v]) => dado(n as string, v))}
        </div>
      </div>
    </>
  )
}

// Acessos ao app virou aba daqui (admin 2.0, 20/10/2026)
export default function ClientesPage() {
  const [aba, setAba] = useState<"lista" | "acessos">("lista")
  useEffect(() => { if (new URLSearchParams(window.location.search).get("aba") === "acessos") setAba("acessos") }, [])
  return (
    <>
      <div className="abas-l"><button aria-pressed={aba === "lista"} onClick={() => setAba("lista")}>Clientes</button><button aria-pressed={aba === "acessos"} onClick={() => setAba("acessos")}>Acessos ao app</button></div>
      {aba === "lista" ? <ClientesLista /> : <AcessosPainel />}
    </>
  )
}
