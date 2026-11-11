"use client"

// Fechamento por dia (admin 2.0, 20/10/2026, pedido do Lucas): faixa de dias com o valor de cada um,
// igual ao "Ganho por dia" da loja. Tocar no dia mostra o fechamento dele: receita total, por loja,
// lucro do Chegô, lojistas, motoboys, taxas e como pagaram. Mesma conta da Carteira (/api/admin/carteira).
import { useEffect, useMemo, useRef, useState } from "react"
import { MEIOS, R, somaL, type Linha } from "./_dinheiro"

const SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
const soma = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const hojeBrt = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
const curto = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(v).toLocaleString("pt-BR")}`

export default function DiasFechamento({ dia, onDia }: { dia: string; onDia: (d: string) => void }) {
  const hoje = hojeBrt()
  const [fim, setFim] = useState(hoje)
  const [d, setD] = useState<{ linhas: Linha[]; lojas: Record<string, { nome: string; logo: string | null }> } | null>(null)
  const [erro, setErro] = useState("")
  const ini = soma(fim, -13)
  const faixa = useRef<HTMLDivElement>(null)
  // Abre a faixa mostrando o dia escolhido (no celular ela rola pro lado)
  useEffect(() => { const el = faixa.current?.querySelector(".fd-dia.on") as HTMLElement | null; if (el && faixa.current) faixa.current.scrollLeft = el.offsetLeft - faixa.current.clientWidth / 2 + el.clientWidth / 2 }, [d, dia])
  useEffect(() => {
    setD(null); setErro("")
    fetch(`/api/admin/carteira?de=${ini}&ate=${fim}&saldo=0`, { credentials: "include" }).then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j.error))).then(setD).catch(e => setErro(String(e ?? "Erro")))
  }, [ini, fim])

  const dias = useMemo(() => { const out: string[] = []; for (let x = ini; x <= fim; x = soma(x, 1)) out.push(x); return out }, [ini, fim])
  const L = d?.linhas ?? []
  const porDia = (x: string) => L.filter(l => l.dia === x)
  const max = Math.max(1, ...dias.map(x => somaL(porDia(x), l => l.pago)))
  const melhor = dias.reduce((m, x) => somaL(porDia(x), l => l.pago) > somaL(porDia(m), l => l.pago) ? x : m, dias[0])
  const ls = porDia(dia)
  const tot = { pago: somaL(ls, l => l.pago), app: somaL(ls, l => l.app), loja: somaL(ls, l => l.loja), mb: somaL(ls, l => l.mb), custo: somaL(ls, l => l.custo) }
  const porLoja = Object.entries(ls.reduce((a: Record<string, Linha[]>, l) => { (a[l.loja_id] ??= []).push(l); return a }, {}))
    .map(([id, xs]) => ({ id, n: xs.length, vendido: somaL(xs, l => l.pago), produtos: somaL(xs, l => l.produtos), recebe: somaL(xs, l => l.loja), app: somaL(xs, l => l.app) })).sort((a, b) => b.vendido - a.vendido)
  const meios = MEIOS.map(m => ({ ...m, v: Math.round(ls.reduce((t, l) => t + (l.meios?.[m.k] ?? 0), 0) * 100) / 100 })).filter(m => m.v > 0)
  const dt = new Date(`${dia}T12:00:00Z`)

  return (
    <div className="fd">
      <div className="cartao fd-faixa">
        <div className="lin" style={{ gap: 10, flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 220 }}><b className="t20">Vendido por dia</b><br /><span className="t14 mut">{d && L.length ? `O melhor dia foi ${SEM[new Date(`${melhor}T12:00:00Z`).getUTCDay()]}, dia ${Number(melhor.slice(8))}, com ${R(somaL(porDia(melhor), l => l.pago))}.` : "Toque num dia pra ver o fechamento dele."}</span></span>
          <span className="lin" style={{ gap: 6 }}>
            <button className="btn btn-s" style={{ minHeight: 38, padding: "0 12px" }} onClick={() => setFim(soma(fim, -14))} aria-label="Dias anteriores">‹ Antes</button>
            <button className="btn btn-s" style={{ minHeight: 38, padding: "0 12px" }} disabled={fim >= hoje} onClick={() => setFim(soma(fim, 14) > hoje ? hoje : soma(fim, 14))} aria-label="Dias seguintes">Depois ›</button>
            <input type="date" className="pd-sel" value={dia} max={hoje} onChange={e => { if (!e.target.value) return; onDia(e.target.value); if (e.target.value < ini || e.target.value > fim) setFim(soma(e.target.value, 6) > hoje ? hoje : soma(e.target.value, 6)) }} />
          </span>
        </div>
        {erro ? <p className="aviso vm" style={{ marginTop: 10 }}>{erro}</p> : (
          <div className="fd-dias" ref={faixa}>{dias.map(x => { const v = somaL(porDia(x), l => l.pago), w = new Date(`${x}T12:00:00Z`); return (
            <button key={x} className={`fd-dia ${x === dia ? "on" : ""} ${x === melhor && v ? "top" : ""}`} onClick={() => onDia(x)} disabled={!d}>
              <small className="num">{d ? (v ? curto(v) : "R$ 0") : "…"}</small>
              <span className="fd-barra"><i style={{ width: `${v / max * 100}%` }} /></span>
              <span>{x === hoje ? "hoje" : SEM[w.getUTCDay()]}</span><b>{Number(x.slice(8))}</b>
            </button>) })}</div>)}
      </div>

      <div className="cartao fd-dia-det">
        <div className="lin" style={{ gap: 8, flexWrap: "wrap" }}><b className="t20">Fechamento de {dia === hoje ? "hoje" : `${SEM[dt.getUTCDay()]}, ${dia.slice(8)}/${dia.slice(5, 7)}`}</b><span className="t14 mut">{ls.length} pedidos entregues{dia === hoje ? ", até agora" : ""}</span></div>
        <div className="fd-tot">
          {([["Receita total", tot.pago, "var(--grafite)", "o que os clientes pagaram"], ["Lucro do Chegô", tot.app, "var(--c-app)", tot.pago ? `${Math.round(tot.app / tot.pago * 100)}% da receita` : "–"], ["Lojistas", tot.loja, "var(--c-loja)", "já sem comissão e taxa"], ["Motoboys", tot.mb, "var(--c-mb)", "entregas com mínimo de R$ 4"], ["Taxas", tot.custo, "var(--c-res)", "Asaas e maquininha (estimado)"]] as [string, number, string, string][]).map(([n, v, c, s]) => (
            <div key={n} className="fd-t" style={{ ["--c" as any]: c }}><span><i />{n}</span><b className="num">{R(v)}</b><small>{s}</small></div>))}
        </div>
        {meios.length > 0 && <div className="fd-meios">{meios.map(m => <span key={m.k}><i style={{ background: m.cor }} />{m.n} <b className="num">{R(m.v)}</b></span>)}</div>}
        <b className="t16b" style={{ display: "block", marginTop: 14 }}>Receita por loja</b>
        {porLoja.length === 0 ? <p className="t14 mut" style={{ marginTop: 6 }}>Nenhuma venda entregue nesse dia.</p> : (
          <div style={{ overflow: "auto" }}><table className="tabela" style={{ marginTop: 6 }}><thead><tr><th>Loja</th><th>Pedidos</th><th style={{ textAlign: "right" }}>Vendido</th><th style={{ textAlign: "right" }} className="esconde-cel">Produtos</th><th style={{ textAlign: "right" }}>Loja recebe</th><th style={{ textAlign: "right" }}>Chegô</th></tr></thead>
            <tbody>{porLoja.map(x => <tr key={x.id}><td><span className="lin" style={{ gap: 8 }}>{d?.lojas[x.id]?.logo ? <img src={d.lojas[x.id].logo!} alt="" className="lj-logo" /> : <span className="lj-logo">{(d?.lojas[x.id]?.nome ?? "?")[0]}</span>}<b>{d?.lojas[x.id]?.nome ?? "Loja"}</b></span></td>
              <td className="num">{x.n}</td><td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{R(x.vendido)}</td><td className="num esconde-cel" style={{ textAlign: "right" }}>{R(x.produtos)}</td><td className="num" style={{ textAlign: "right" }}>{R(x.recebe)}</td><td className="num" style={{ textAlign: "right", color: "var(--c-app)", fontWeight: 800 }}>{R(x.app)}</td></tr>)}</tbody></table></div>)}
        <p className="t12 mut" style={{ marginTop: 10 }}>Abaixo, o fechamento completo do dia: repasses, conciliação e caixa no Asaas.</p>
      </div>
    </div>
  )
}
