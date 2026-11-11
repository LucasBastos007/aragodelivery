"use client"

// Caixa dos motoboys (admin 2.0, 20/10/2026): dinheiro de clientes que os motoboys declararam ao
// encerrar o dia. Só leitura (/api/admin/caixa). Retirada ou acerto se lança em Movimentos.
import Link from "next/link"
import { useEffect, useState } from "react"
import { R } from "./_dinheiro"

type Declaracao = { id: string; valor: number; observacao: string | null; criado_em: string; motoboy: { id: string; nome: string } | null }
const PER = [[1, "Hoje"], [7, "7 dias"], [30, "30 dias"], [90, "90 dias"]] as const

export default function CaixaPainel() {
  const [lista, setLista] = useState<Declaracao[]>([])
  const [carregou, setCarregou] = useState(false)
  const [dias, setDias] = useState(7)

  useEffect(() => {
    setCarregou(false)
    fetch(`/api/admin/caixa?dias=${dias}`, { credentials: "include" }).then(r => r.json()).catch(() => ({})).then(j => { setLista(j.declaracoes ?? []); setCarregou(true) })
  }, [dias])

  const total = lista.reduce((s, d) => s + Number(d.valor), 0)
  const porMb = Object.values(lista.reduce((a: Record<string, { nome: string; v: number; n: number }>, d) => { const k = d.motoboy?.id ?? "?"; (a[k] ??= { nome: d.motoboy?.nome ?? "Motoboy", v: 0, n: 0 }); a[k].v += Number(d.valor); a[k].n++; return a }, {})).sort((a, b) => b.v - a.v)
  const mx = porMb[0]?.v || 1

  return (
    <>
      <div className="lin" style={{ flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div className="chips-l">{PER.map(([d, n]) => <button key={d} className="chip" aria-pressed={dias === d} onClick={() => setDias(d)}>{n}</button>)}</div>

      </div>
      <div className="dupla" style={{ marginTop: 0 }}>
        <div className="cartao" style={{ padding: 6, overflow: "auto" }}>
          {!carregou ? <p className="vazio">Carregando…</p> : lista.length === 0 ? <div className="dsp-vazio"><b>Nenhuma declaração no período</b><span>Quando o motoboy encerra o dia, ele informa quanto recebeu em dinheiro dos clientes. Aparece aqui.</span></div> : (
            <table className="tabela"><thead><tr><th>Motoboy</th><th>Quando</th><th className="esconde-cel">Observação</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
              <tbody>{lista.map(d => (
                <tr key={d.id}><td><b>{d.motoboy?.nome ?? "—"}</b></td>
                  <td className="num mut">{new Date(d.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="esconde-cel mut">{d.observacao ?? "—"}</td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{R(d.valor)}</td></tr>))}</tbody></table>)}
        </div>
        <div className="cartao" style={{ padding: 18 }}>
          <small className="t14 mut">Total declarado no período</small>
          <b className="num" style={{ display: "block", fontFamily: "var(--display)", fontSize: 32, fontWeight: 800, color: "var(--grafite)" }}>{R(total)}</b>
          <p className="t14 mut" style={{ margin: "4px 0 12px" }}>{lista.length} {lista.length === 1 ? "declaração" : "declarações"}</p>
          <ol className="ini-rank">{porMb.map((x, i) => (
            <li key={i}><span className="pos">{i + 1}</span><span className="av" style={{ borderRadius: "50%", background: "var(--roxo-claro)", color: "var(--roxo)" }}>{x.nome[0]}</span>
              <span className="nm"><span>{x.nome}</span><i style={{ width: `${x.v / mx * 100}%`, background: "var(--roxo)" }} /></span><b className="num">{R(x.v)}<small className="av-n">{x.n} dias</small></b></li>))}</ol>
        </div>
      </div>
    </>
  )
}
