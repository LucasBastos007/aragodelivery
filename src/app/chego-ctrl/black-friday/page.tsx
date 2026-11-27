"use client"

// Black Friday Chegô (27/11/2026): números da campanha em tempo real (/api/admin/black-friday),
// separados por situação, por loja e por pedido, e a chave de suspensão emergencial.
// Atualiza sozinho a cada 30 s. Sem teto automático de custo — o Lucas acompanha e decide.
import { useEffect, useState } from "react"
import { R } from "../_dinheiro"

type Tot = { pedidos: number; produtos: number; original: number; promocional: number; desconto: number; chego: number; loja: number }
type Loja = { id: string; nome: string; pedidos: number; produtos: number; original: number; desconto: number; chego: number; loja: number; cancelados: number }
type Ped = { id: string; codigo: string; situacao: string; status: string; loja: string; loja_id: string; cliente: string; criado_em: string; forma: string; itens: string; qtd: number; original: number; desconto: number; chego: number; custo_loja: number; total: number }
type Dados = { janela: { inicio: string; fim: string; no_ar: boolean; suspensa: boolean }; consolidado: Tot & { clientes: number; cancelados: number }; por_situacao: Record<string, Tot>; por_loja: Loja[]; lojas_participantes: number; pedidos: Ped[] }
const SIT: Record<string, string> = { pendente: "Pendentes", confirmado: "Confirmados", concluido: "Concluídos", cancelado: "Cancelados" }
const hora = (t: string) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })

export default function BlackFridayPage() {
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState("")
  const [loja, setLoja] = useState<string | null>(null)
  const [sit, setSit] = useState<string>("todos")
  const [salvando, setSalvando] = useState(false)

  async function load() {
    const r = await fetch("/api/admin/black-friday", { credentials: "include", cache: "no-store" })
    if (!r.ok) { setErro("Não consegui carregar os números."); return }
    setErro(""); setD(await r.json())
  }
  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id) }, [])

  async function suspender(v: boolean) {
    const txt = v ? "Suspender a Black Friday agora? Os descontos somem do app na hora. Pedidos já feitos continuam valendo." : "Voltar a Black Friday? Os descontos reaparecem no app."
    if (!window.confirm(txt)) return
    setSalvando(true)
    const r = await fetch("/api/admin/black-friday", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suspensa: v }) })
    setSalvando(false)
    if (!r.ok) { setErro("Não consegui mudar a suspensão."); return }
    load()
  }

  if (!d) return <div className="cartao" style={{ padding: 20 }}>{erro || "Carregando…"}</div>
  const c = d.consolidado, j = d.janela
  const status = j.suspensa ? "Suspensa pelo admin" : j.no_ar ? "No ar até meia-noite" : Date.now() < new Date(j.inicio).getTime() ? "Começa 27/11 às 06h30" : "Encerrada"
  const lista = d.pedidos.filter(p => (!loja || p.loja_id === loja) && (sit === "todos" || p.situacao === sit))

  return (
    <>
      <div className="cartao" style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", background: "#0A0A0A", color: "#fff", borderColor: "#1E66F5" }}>
        <div><b style={{ fontSize: 18 }}>🖤 BLACK CHEGÔ</b><div className="t14" style={{ opacity: .8 }}>{status} · {d.lojas_participantes} lojas · até 2 pedidos promocionais por cliente em cada loja</div></div>
        {j.suspensa
          ? <button className="btn btn-p" disabled={salvando} onClick={() => suspender(false)}>Voltar a campanha</button>
          : <button className="btn" style={{ background: "#D92D20", color: "#fff", minHeight: 42 }} disabled={salvando} onClick={() => suspender(true)}>Suspender agora</button>}
      </div>
      {erro && <p className="t14" style={{ color: "#D92D20" }}>{erro}</p>}

      <div className="kpis4">
        <div className="cartao kpi2"><small>Pedidos promocionais</small><b className="num">{c.pedidos}</b><span className="t14 mut">{c.clientes} clientes · {c.cancelados} cancelados</span></div>
        <div className="cartao kpi2"><small>Vendido (preço cheio → com desconto)</small><b className="num">{R(c.promocional)}</b><span className="t14 mut">de {R(c.original)} · {c.produtos} un.</span></div>
        <div className="cartao kpi2"><small>Custo do Chegô (10%)</small><b className="num">{R(c.chego)}</b><span className="t14 mut">desconto total {R(c.desconto)}</span></div>
        <div className="cartao kpi2"><small>Custo das lojas</small><b className="num">{R(c.loja)}</b><span className="t14 mut">sai do repasse de cada loja</span></div>
      </div>

      <div className="cartao" style={{ padding: 16, overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>Por situação</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr className="t14 mut"><th align="left">Situação</th><th align="right">Pedidos</th><th align="right">Un.</th><th align="right">Original</th><th align="right">Desconto</th><th align="right">Chegô</th><th align="right">Lojas</th></tr></thead>
          <tbody>{Object.entries(d.por_situacao).map(([k, t]) => <tr key={k} style={{ borderTop: "1px solid var(--linha, #eee)" }}><td>{SIT[k] ?? k}</td><td align="right" className="num">{t.pedidos}</td><td align="right" className="num">{t.produtos}</td><td align="right" className="num">{R(t.original)}</td><td align="right" className="num">{R(t.desconto)}</td><td align="right" className="num">{R(t.chego)}</td><td align="right" className="num">{R(t.loja)}</td></tr>)}</tbody></table>
        <p className="t14 mut">Pendente = esperando pagamento ou a loja aceitar. Concluído = entregue. Cancelado não conta nos totais de cima e libera o cliente.</p>
      </div>

      <div className="cartao" style={{ padding: 16, overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>Por loja {loja && <button className="btn" style={{ marginLeft: 8, minHeight: 32 }} onClick={() => setLoja(null)}>ver todas</button>}</h3>
        {d.por_loja.length === 0 ? <p className="mut">Nenhum pedido promocional ainda.</p> :
          <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr className="t14 mut"><th align="left">Loja</th><th align="right">Pedidos</th><th align="right">Un.</th><th align="right">Original</th><th align="right">Desconto</th><th align="right">Chegô</th><th align="right">Loja</th><th align="right">Cancel.</th></tr></thead>
            <tbody>{d.por_loja.map(l => <tr key={l.id} onClick={() => setLoja(l.id)} style={{ cursor: "pointer", borderTop: "1px solid var(--linha, #eee)", background: loja === l.id ? "rgba(30,102,245,.08)" : undefined }}><td>{l.nome}</td><td align="right" className="num">{l.pedidos}</td><td align="right" className="num">{l.produtos}</td><td align="right" className="num">{R(l.original)}</td><td align="right" className="num">{R(l.desconto)}</td><td align="right" className="num">{R(l.chego)}</td><td align="right" className="num">{R(l.loja)}</td><td align="right" className="num">{l.cancelados}</td></tr>)}</tbody></table>}
      </div>

      <div className="cartao" style={{ padding: 16, overflowX: "auto" }}>
        <div className="lin" style={{ flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <h3 style={{ margin: 0, flex: 1 }}>Pedidos ({lista.length})</h3>
          <div className="abas-l" style={{ marginBottom: 0 }}>{["todos", "pendente", "confirmado", "concluido", "cancelado"].map(k => <button key={k} aria-pressed={sit === k} onClick={() => setSit(k)}>{k === "todos" ? "Todos" : SIT[k]}</button>)}</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}><thead><tr className="t14 mut"><th align="left">Hora</th><th align="left">Pedido</th><th align="left">Loja</th><th align="left">Cliente</th><th align="left">Itens</th><th align="right">Original</th><th align="right">Desconto</th><th align="right">Chegô</th><th align="right">Loja</th><th align="left">Situação</th></tr></thead>
          <tbody>{lista.map(p => <tr key={p.id} style={{ borderTop: "1px solid var(--linha, #eee)", opacity: p.situacao === "cancelado" ? .55 : 1 }}><td className="num">{hora(p.criado_em)}</td><td><b>{p.codigo}</b></td><td>{p.loja}</td><td>{p.cliente}</td><td className="t14">{p.itens}</td><td align="right" className="num">{R(p.original)}</td><td align="right" className="num">{R(p.desconto)}</td><td align="right" className="num">{R(p.chego)}</td><td align="right" className="num">{R(p.custo_loja)}</td><td className="t14">{SIT[p.situacao]?.replace(/s$/, "") ?? p.status}</td></tr>)}</tbody></table>
      </div>
    </>
  )
}
