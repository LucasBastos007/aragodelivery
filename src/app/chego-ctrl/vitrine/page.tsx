"use client"

// Vitrine (admin 2.0, 20/10/2026): o que o cliente vê primeiro no app e o que deixa a vitrine fraca.
// Famosos: Petiscaria fixa em 1º + as 9 que mais venderam na semana passada (muda toda segunda).
// Mais pedidos: destaques que cada loja escolhe no cardápio. Produtos mais vendidos vieram do Relatório.
import { useEffect, useState } from "react"
import Link from "next/link"
import { R } from "../_dinheiro"

type D = { famosos: { id: string; nome: string; logo: string | null; n: number; fixa: boolean }[]; porLoja: { id: string; nome: string; logo: string | null; categoria: string | null; produtos: number; disponiveis: number; semFoto: number; destaques: string[] }[]; top: { nome: string; q: number; v: number }[]; dias: number }

export default function VitrinePage() {
  const [dias, setDias] = useState(30)
  const [d, setD] = useState<D | null>(null)
  const [erro, setErro] = useState("")
  const [aba, setAba] = useState<"atencao" | "destaques" | "top">("atencao")
  useEffect(() => { setD(null); fetch(`/api/admin/vitrine?dias=${dias}`, { credentials: "include" }).then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j.error))).then(setD).catch(e => setErro(String(e ?? "Erro"))) }, [dias])
  if (!d) return <p className="mut">{erro || "Carregando…"}</p>
  const semLogo = d.porLoja.filter(l => !l.logo), semFoto = d.porLoja.filter(l => l.semFoto > 0).sort((a, b) => b.semFoto - a.semFoto)
  const semDestaque = d.porLoja.filter(l => !l.destaques.length), vazias = d.porLoja.filter(l => l.disponiveis === 0)
  const fotos = d.porLoja.reduce((t, l) => t + l.semFoto, 0)
  return (
    <>
      <div className="cartao vt-fam">
        <div className="lin" style={{ flexWrap: "wrap", gap: 8 }}><span className="t20">Famosos no Chegô, agora</span><span className="t14 mut" style={{ marginLeft: "auto" }}>Petiscaria sempre em 1º. As outras 9 são as que mais venderam na semana passada; muda toda segunda.</span></div>
        <div className="vt-fila">{d.famosos.map((f, i) => (
          <div key={f.id} className="vt-loja"><span className="vt-pos">{i + 1}</span>{f.logo ? <img src={f.logo} alt="" /> : <span className="vt-sem">{f.nome[0]}</span>}<b>{f.nome}</b><small>{f.fixa ? "fixa" : `${f.n} pedidos`}</small></div>))}</div>
      </div>
      <div className="kpis4" style={{ marginTop: 12 }}>
        <div className="cartao kpi2"><small>Lojas sem logo</small><b className="num" style={{ color: semLogo.length ? "var(--pimenta)" : undefined }}>{semLogo.length}</b><span className="t14 mut">aparece só a letra</span></div>
        <div className="cartao kpi2"><small>Produtos à venda sem foto</small><b className="num" style={{ color: fotos ? "var(--pimenta)" : undefined }}>{fotos}</b><span className="t14 mut">em {semFoto.length} lojas</span></div>
        <div className="cartao kpi2"><small>Lojas sem "Mais pedidos"</small><b className="num">{semDestaque.length}</b><span className="t14 mut">a loja escolhe no cardápio</span></div>
        <div className="cartao kpi2"><small>Lojas ativas sem nada à venda</small><b className="num" style={{ color: vazias.length ? "var(--pimenta)" : undefined }}>{vazias.length}</b><span className="t14 mut">o cliente abre e não acha nada</span></div>
      </div>
      <div className="abas-l"><button aria-pressed={aba === "atencao"} onClick={() => setAba("atencao")}>Pede atenção</button><button aria-pressed={aba === "destaques"} onClick={() => setAba("destaques")}>Mais pedidos de cada loja</button><button aria-pressed={aba === "top"} onClick={() => setAba("top")}>Produtos mais vendidos</button></div>

      {aba === "atencao" && <div className="cartao" style={{ padding: 6, overflow: "auto" }}><table className="tabela">
        <thead><tr><th>Loja</th><th>O que falta</th><th /></tr></thead>
        <tbody>{d.porLoja.filter(l => !l.logo || l.semFoto || l.disponiveis === 0).sort((a, b) => (b.semFoto + (b.logo ? 0 : 50) + (b.disponiveis ? 0 : 100)) - (a.semFoto + (a.logo ? 0 : 50) + (a.disponiveis ? 0 : 100))).map(l => (
          <tr key={l.id}><td><span className="lin" style={{ gap: 10 }}>{l.logo ? <img src={l.logo} alt="" className="lj-logo" /> : <span className="lj-logo">{l.nome[0]}</span>}<b>{l.nome}</b></span></td>
            <td><span className="chips-l">{!l.logo && <span className="selo vermelho">sem logo</span>}{l.disponiveis === 0 && <span className="selo vermelho">nada à venda</span>}{l.semFoto > 0 && <span className="selo amarelo">{l.semFoto} sem foto</span>}</span></td>
            <td style={{ textAlign: "right" }}><Link className="btn btn-l" href={`/chego-ctrl/lojas/${l.id}/cardapio`}>Abrir cardápio</Link></td></tr>))}
          {!semLogo.length && !semFoto.length && !vazias.length && <tr><td colSpan={3} className="vazio">Vitrine em dia: todas as lojas têm logo e fotos.</td></tr>}
        </tbody></table></div>}

      {aba === "destaques" && <div className="vt-dest">{d.porLoja.sort((a, b) => b.destaques.length - a.destaques.length).map(l => (
        <div key={l.id} className="cartao vt-dl"><span className="lin" style={{ gap: 8 }}>{l.logo ? <img src={l.logo} alt="" className="lj-logo" /> : <span className="lj-logo">{l.nome[0]}</span>}<b>{l.nome}</b></span>
          {l.destaques.length ? <ul>{l.destaques.slice(0, 6).map(n => <li key={n}>{n}</li>)}</ul> : <p className="t14 mut">Não escolheu. O app mostra os mais vendidos dela.</p>}</div>))}</div>}

      {aba === "top" && <>
        <div className="chips-l" style={{ marginBottom: 10 }}>{[[7, "7 dias"], [30, "30 dias"], [90, "90 dias"]].map(([n, t]) => <button key={n} className="chip" aria-pressed={dias === n} onClick={() => setDias(n as number)}>{t}</button>)}</div>
        <div className="cartao" style={{ padding: 6, overflow: "auto" }}><table className="tabela"><thead><tr><th>#</th><th>Produto</th><th>Vendidos</th><th style={{ textAlign: "right" }}>Receita</th></tr></thead>
          <tbody>{d.top.map((p, i) => <tr key={p.nome}><td className="mut">{i + 1}</td><td><b>{p.nome}</b></td><td className="num">{p.q}</td><td className="num" style={{ textAlign: "right" }}>{R(p.v)}</td></tr>)}
            {!d.top.length && <tr><td colSpan={4} className="vazio">Sem vendas no período.</td></tr>}</tbody></table></div>
      </>}
    </>
  )
}
