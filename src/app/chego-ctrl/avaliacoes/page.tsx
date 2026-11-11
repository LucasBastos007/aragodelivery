"use client"

// Avaliações (admin 2.0, 20/10/2026): notas que os clientes dão pra loja e pro motoboy.
// As baixas (3 ou menos) pedem atenção. Só leitura: a loja responde pelo painel dela.
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Av = { id: string; pedido_id: string; loja_id: string | null; motoboy_id: string | null; nota_loja: number | null; nota_motoboy: number | null; comentario: string | null; criado_em: string; resposta_loja: string | null; pedido?: { codigo: string } | null }
const Estrelas = ({ n }: { n: number | null }) => n == null ? <span className="mut t12">sem nota</span> : <span className={`av-est ${n <= 3 ? "baixa" : ""}`} aria-label={`${n} de 5`}>{"★".repeat(n)}<i>{"★".repeat(5 - n)}</i></span>
const media = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((t, x) => t + x, 0) / v.length : null }
const f1 = (v: number | null) => v == null ? "–" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default function AvaliacoesPage() {
  const [avs, setAvs] = useState<Av[]>([])
  const [nomes, setNomes] = useState<{ l: Map<string, { nome: string; logo: string | null }>; m: Map<string, string> }>({ l: new Map(), m: new Map() })
  const [carregou, setCarregou] = useState(false)
  const [dias, setDias] = useState(30)
  const [aba, setAba] = useState<"comentarios" | "lojas" | "motoboys">("comentarios")
  const [filtro, setFiltro] = useState<"todas" | "baixas" | "comentario" | "semresposta">("todas")

  useEffect(() => { (async () => {
    const out: Av[] = []
    for (let i = 0; i < 50000; i += 1000) { const { data } = await supabase.from("avaliacoes").select("*, pedido:pedidos(codigo)").order("criado_em", { ascending: false }).range(i, i + 999); out.push(...((data ?? []) as Av[])); if ((data ?? []).length < 1000) break }
    const [{ data: ls }, { data: ms }] = await Promise.all([supabase.from("lojas").select("id,nome,logo_url"), supabase.from("motoboys").select("id,nome")])
    setNomes({ l: new Map((ls ?? []).map((x: any) => [x.id, { nome: x.nome, logo: x.logo_url }])), m: new Map((ms ?? []).map((x: any) => [x.id, x.nome])) })
    setAvs(out); setCarregou(true)
  })() }, [])

  const corte = dias ? Date.now() - dias * 86400000 : 0
  const per = useMemo(() => avs.filter(a => new Date(a.criado_em).getTime() >= corte), [avs, corte])
  const baixa = (a: Av) => (a.nota_loja ?? 5) <= 3 || (a.nota_motoboy ?? 5) <= 3
  const feed = per.filter(a => filtro === "todas" || (filtro === "baixas" ? baixa(a) : filtro === "comentario" ? !!a.comentario?.trim() : !!a.comentario?.trim() && !a.resposta_loja))
  const ranking = (campo: "loja_id" | "motoboy_id", nota: "nota_loja" | "nota_motoboy") => Object.entries(per.reduce((m: Record<string, Av[]>, a) => { const k = a[campo]; if (k && a[nota] != null) (m[k] ??= []).push(a); return m }, {}))
    .map(([id, xs]) => ({ id, n: xs.length, media: media(xs.map(x => x[nota])), baixas: xs.filter(x => (x[nota] ?? 5) <= 3).length })).sort((a, b) => (a.media ?? 9) - (b.media ?? 9))

  if (!carregou) return <p className="mut">Carregando…</p>
  const ml = media(per.map(a => a.nota_loja)), mm = media(per.map(a => a.nota_motoboy)), nb = per.filter(baixa).length
  return (
    <>
      <div className="chips-l" style={{ marginBottom: 12 }}>{[[7, "7 dias"], [30, "30 dias"], [90, "90 dias"], [0, "Desde o começo"]].map(([n, t]) => <button key={n} className="chip" aria-pressed={dias === n} onClick={() => setDias(n as number)}>{t}</button>)}</div>
      <div className="kpis4">
        <div className="cartao kpi2"><small>Nota das lojas</small><b className="num">{f1(ml)} <span className="av-est">★</span></b><span className="t14 mut">média de {per.filter(a => a.nota_loja != null).length} notas</span></div>
        <div className="cartao kpi2"><small>Nota dos motoboys</small><b className="num">{f1(mm)} <span className="av-est">★</span></b><span className="t14 mut">média de {per.filter(a => a.nota_motoboy != null).length} notas</span></div>
        <div className="cartao kpi2"><small>Notas baixas (3 ou menos)</small><b className="num" style={{ color: nb ? "var(--pimenta)" : undefined }}>{nb}</b><span className="t14 mut">{per.length ? Math.round(nb / per.length * 100) : 0}% das avaliações</span></div>
        <div className="cartao kpi2"><small>Comentários sem resposta da loja</small><b className="num">{per.filter(a => a.comentario?.trim() && !a.resposta_loja).length}</b><span className="t14 mut">a loja responde no painel dela</span></div>
      </div>
      <div className="abas-l"><button aria-pressed={aba === "comentarios"} onClick={() => setAba("comentarios")}>Comentários</button><button aria-pressed={aba === "lojas"} onClick={() => setAba("lojas")}>Lojas</button><button aria-pressed={aba === "motoboys"} onClick={() => setAba("motoboys")}>Motoboys</button></div>

      {aba === "comentarios" && <>
        <div className="chips-l" style={{ marginBottom: 10 }}>{([["todas", "Todas"], ["baixas", "Notas baixas"], ["comentario", "Com comentário"], ["semresposta", "Sem resposta"]] as const).map(([k, n]) => <button key={k} className={`chip ${k === "baixas" && nb ? "quente" : ""}`} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{n}</button>)}</div>
        <div className="av-feed">{feed.slice(0, 150).map(a => { const l = a.loja_id ? nomes.l.get(a.loja_id) : null; return (
          <div key={a.id} className={`cartao av-it ${baixa(a) ? "baixa" : ""}`}>
            <div className="lin" style={{ gap: 10 }}>{l?.logo ? <img src={l.logo} alt="" className="lj-logo" /> : <span className="lj-logo">{(l?.nome ?? "?")[0]}</span>}
              <span style={{ flex: 1, minWidth: 0 }}><b>{l?.nome ?? "Loja"}</b><small className="lj-sub">{new Date(a.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{a.pedido?.codigo ? <>, <Link href={`/chego-ctrl/pedidos?codigo=${a.pedido.codigo}`} style={{ color: "var(--pimenta)" }}>#{a.pedido.codigo}</Link></> : null}</small></span></div>
            <div className="av-notas"><span>Loja <Estrelas n={a.nota_loja} /></span>{a.motoboy_id && <span>{nomes.m.get(a.motoboy_id) ?? "Motoboy"} <Estrelas n={a.nota_motoboy} /></span>}</div>
            {a.comentario?.trim() && <p className="rb-desc">“{a.comentario}”</p>}
            {a.resposta_loja && <p className="av-resp"><b>Resposta da loja:</b> {a.resposta_loja}</p>}
          </div>) })}
          {!feed.length && <p className="vazio">Nenhuma avaliação aqui.</p>}</div>
      </>}

      {(aba === "lojas" || aba === "motoboys") && <div className="cartao" style={{ padding: 6, overflow: "auto" }}><table className="tabela">
        <thead><tr><th>{aba === "lojas" ? "Loja" : "Motoboy"}</th><th>Nota</th><th>Avaliações</th><th>Notas baixas</th></tr></thead>
        <tbody>{(aba === "lojas" ? ranking("loja_id", "nota_loja") : ranking("motoboy_id", "nota_motoboy")).map(x => { const l = aba === "lojas" ? nomes.l.get(x.id) : null; return (
          <tr key={x.id}><td><span className="lin" style={{ gap: 10 }}>{aba === "lojas" ? (l?.logo ? <img src={l.logo} alt="" className="lj-logo" /> : <span className="lj-logo">{(l?.nome ?? "?")[0]}</span>) : <span className="mb-av" style={{ width: 34, height: 34, fontSize: 14 }}>{(nomes.m.get(x.id) ?? "?")[0]}</span>}<b>{aba === "lojas" ? l?.nome ?? "Loja" : nomes.m.get(x.id) ?? "Motoboy"}</b></span></td>
            <td><b className="num" style={{ color: (x.media ?? 5) < 4 ? "var(--pimenta-esc)" : undefined }}>{f1(x.media)}</b> <span className="av-est">★</span></td><td className="num">{x.n}</td>
            <td>{x.baixas ? <span className="selo vermelho">{x.baixas}</span> : <span className="mut">0</span>}</td></tr>) })}
          {!per.length && <tr><td colSpan={4} className="vazio">Sem avaliações no período.</td></tr>}</tbody></table>
        <p className="t12 mut" style={{ padding: "6px 10px" }}>Ordenado da pior nota pra melhor.</p></div>}
    </>
  )
}
