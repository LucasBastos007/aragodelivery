"use client"

// Acessos ao app como funil (admin 2.0, 20/10/2026): pessoas diferentes, visitas, contas criadas e pedidos.
// Categoria própria no menu (pedido do Lucas). Dados de /api/admin/acessos (contados no servidor).
import { useEffect, useState } from "react"
import { dm } from "./_dinheiro"

type D = { de: string; hoje: string; dias: { dia: string; pessoas: number; acessos: number; cadastros: number; pedidos: number }[]; pessoas: { total: number; semCodigo: number } | null; ultimos: { nome: string; criado_em: string; endereco_bairro: string | null }[] }
const SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]

export default function AcessosPainel() {
  const [dias, setDias] = useState(7)
  const [d, setD] = useState<D | null>(null)
  const [erro, setErro] = useState("")
  const [sel, setSel] = useState<"pessoas" | "acessos" | "cadastros" | "pedidos">("pessoas")
  useEffect(() => { setD(null); fetch(`/api/admin/acessos?dias=${dias}`, { credentials: "include" }).then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j.error))).then(setD).catch(e => setErro(String(e ?? "Erro"))) }, [dias])

  const chips = <div className="chips-l" style={{ marginBottom: 12 }}>{[[1, "Hoje"], [7, "7 dias"], [15, "15 dias"], [30, "30 dias"], [90, "90 dias"]].map(([n, t]) => <button key={n} className="chip" aria-pressed={dias === n} onClick={() => setDias(n as number)}>{t}</button>)}</div>
  if (!d) return <>{chips}<p className="mut">{erro || "Contando…"}</p></>
  const tot = d.dias.reduce((t, x) => ({ acessos: t.acessos + x.acessos, cadastros: t.cadastros + x.cadastros, pedidos: t.pedidos + x.pedidos }), { acessos: 0, cadastros: 0, pedidos: 0 })
  const pct = (a: number, b: number) => b ? `${Math.round(a / b * 100)}%` : "–"
  const mx = Math.max(1, ...d.dias.map(x => x[sel]))
  const COR = { pessoas: "var(--pimenta)", acessos: "var(--azul)", cadastros: "var(--roxo)", pedidos: "var(--folha)" }
  const pes = d.pessoas?.total ?? 0
  return (
    <>
      {chips}
      <div className="ac-funil">
        {([["pessoas", "Pessoas diferentes", pes, d.pessoas ? (pes ? `${(tot.acessos / pes).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} visitas por pessoa` : "começa a contar quando publicar") : "falta rodar o SQL"],
           ["acessos", "Visitas ao app", tot.acessos, `${(tot.acessos / Math.max(1, d.dias.length)).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} por dia`],
           ["cadastros", "Criaram conta", tot.cadastros, `${pct(tot.cadastros, pes || tot.acessos)} de quem entrou`],
           ["pedidos", "Pedidos entregues", tot.pedidos, `${(tot.pedidos / Math.max(1, d.dias.length)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por dia`]] as const).map(([k, n, v, sub]) => (
          <button key={k} className={`cartao ac-etapa ${sel === k ? "on" : ""}`} onClick={() => setSel(k)} style={{ ["--c" as any]: COR[k] }}>
            <small>{n}</small><b className="num">{v.toLocaleString("pt-BR")}</b>
            <span className="t12 mut">{sub}</span>
          </button>))}
      </div>
      <div className="cartao" style={{ padding: 16, marginTop: 12 }}>
        <b className="t16b">{sel === "pessoas" ? "Pessoas diferentes" : sel === "acessos" ? "Visitas" : sel === "cadastros" ? "Contas criadas" : "Pedidos entregues"} por dia</b>
        <div className="ac-graf">{d.dias.map(x => { const dt = new Date(`${x.dia}T12:00:00Z`); return (
          <div key={x.dia} className="ac-col" title={`${dm(x.dia)}: ${x[sel]}`}><small className="num">{d.dias.length <= 15 ? x[sel] : ""}</small><span><i style={{ height: `${Math.max(2, x[sel] / mx * 100)}%`, background: COR[sel] }} /></span><b>{d.dias.length <= 15 ? (x.dia === d.hoje ? "hoje" : SEM[dt.getUTCDay()]) : x.dia.slice(8)}</b></div>) })}</div>
      </div>
      {d.pessoas && d.pessoas.semCodigo > 0 && <p className="t12 mut" style={{ marginTop: 8 }}>Visitas de antes da contagem por pessoa não têm o código do celular: {d.pessoas.semCodigo.toLocaleString("pt-BR")} visitas do período contam só como visita. O código é anônimo, gerado no celular, sem nome nem telefone.</p>}
      <div className="cartao" style={{ padding: 16, marginTop: 12 }}>
        <b className="t16b">Contas criadas por último</b>
        {d.ultimos.length === 0 ? <p className="t14 mut" style={{ marginTop: 6 }}>Nenhuma conta nova no período.</p> : d.ultimos.map((c, i) => (
          <div key={i} className="lj-dado"><span>{c.nome ?? "Sem nome"}{c.endereco_bairro ? `, ${c.endereco_bairro}` : ""}</span><b>{new Date(c.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</b></div>))}
      </div>
    </>
  )
}
