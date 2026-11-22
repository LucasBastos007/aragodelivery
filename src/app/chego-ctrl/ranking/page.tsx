"use client"

// Ranking e tempos (pedido do Lucas, 20/11/2026): pódio das lojas que mais venderam, motoboys que mais
// entregaram e os mais rápidos, e o acompanhamento de preparo e prazo de entrega de cada loja.
// Só leitura. Semana = ciclo do Chegô (sexta a quinta). Horário de Brasília.
import { useEffect, useMemo, useState } from "react"
import { DESLOCAMENTO_MIN } from "@/lib/tempoEntrega"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Ped = { id: string; codigo: string; loja_id: string | null; motoboy_id: string | null; status: string; tipo: string | null; subtotal: number | null; criado_em: string; aceito_em: string | null; pronto_em: string | null; coletado_em: string | null; entregue_em: string | null; distancia_km: number | null }
type Loja = { id: string; nome: string; logo_url: string | null; tempo_min: number | null; tempo_max: number | null }
type Moto = { id: string; nome: string; foto: string | null }
type Periodo = "semana" | "semana-passada" | "mes" | "mes-passado" | "custom"

const DIA = 86400000, BR = -3 * 3600000
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const hojeBR = () => new Date(Date.now() + BR).toISOString().slice(0, 10)
const somaDia = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") + n * DIA).toISOString().slice(0, 10)
const dm = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7)
// minutos entre dois horários; descarta o que não faz sentido (negativo ou mais de 4 horas, botão esquecido)
const mins = (a: string | null, b: string | null) => { if (!a || !b) return null; const m = (Date.parse(b) - Date.parse(a)) / 60000; return m > 0 && m <= 240 ? m : null }
const media = (xs: number[]) => xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : null
const mediana = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2 }
const mm = (v: number | null) => v == null ? "–" : `${Math.round(v)} min`
const pct = (a: number, b: number) => b ? Math.round(a / b * 100) : 0

function faixa(p: Periodo, ci: string, cf: string): [string, string, string] {
  const h = hojeBR(), dow = new Date(h + "T12:00:00Z").getUTCDay() // 0 dom … 5 sex
  const sex = somaDia(h, -((dow + 2) % 7))
  if (p === "semana") return [sex, h, `Semana de ${dm(sex)} a ${dm(somaDia(sex, 6))}`]
  if (p === "semana-passada") return [somaDia(sex, -7), somaDia(sex, -1), `Semana de ${dm(somaDia(sex, -7))} a ${dm(somaDia(sex, -1))}`]
  if (p === "mes") return [h.slice(0, 8) + "01", h, new Date(h + "T12:00:00Z").toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })]
  if (p === "mes-passado") { const fim = somaDia(h.slice(0, 8) + "01", -1); return [fim.slice(0, 8) + "01", fim, new Date(fim + "T12:00:00Z").toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })] }
  return [ci || h, cf || h, `De ${dm(ci || h)} a ${dm(cf || h)}`]
}

const Avatar = ({ src, nome, r = 34 }: { src?: string | null; nome: string; r?: number }) => src
  ? <img src={src} alt="" className="lj-logo" style={{ width: r, height: r, borderRadius: "50%", objectFit: "cover" }} />
  : <span className="mb-av" style={{ width: r, height: r, fontSize: r * .4 }}>{(nome || "?")[0]}</span>

function Podio({ itens }: { itens: { id: string; nome: string; foto: string | null; valor: string; sub: string }[] }) {
  const ordem = [itens[1], itens[0], itens[2]], alt = [96, 128, 72], cor = ["#9AA3AD", "#C98F00", "#B06A3B"], pos = [2, 1, 3]
  if (!itens.length) return null
  return <div className="rk-podio">{ordem.map((x, i) => x ? <div key={x.id} className="rk-deg">
    <Avatar src={x.foto} nome={x.nome} r={i === 1 ? 64 : 52} />
    <b className="rk-nome">{x.nome}</b><span className="num rk-val">{x.valor}</span><small className="mut">{x.sub}</small>
    <div className="rk-bloco" style={{ height: alt[i], background: cor[i] }}><span>{pos[i]}º</span></div>
  </div> : <div key={i} className="rk-deg" />)}</div>
}

export default function RankingPage() {
  const [periodo, setPeriodo] = useState<Periodo>("semana")
  const [ci, setCi] = useState(""), [cf, setCf] = useState("")
  const [aba, setAba] = useState<"lojas" | "motoboys" | "tempos">("lojas")
  const [ordLoja, setOrdLoja] = useState<"valor" | "pedidos">("valor")
  const [ordMoto, setOrdMoto] = useState<"entregas" | "rapido">("entregas")
  const [meta, setMeta] = useState(20)
  const [peds, setPeds] = useState<Ped[]>([]), [lojas, setLojas] = useState<Map<string, Loja>>(new Map()), [motos, setMotos] = useState<Map<string, Moto>>(new Map())
  const [carregando, setCarregando] = useState(true)
  const [ini, fim, rotulo] = faixa(periodo, ci, cf)

  useEffect(() => { try { const v = Number(localStorage.getItem("rk-meta-preparo")); if (v >= 5 && v <= 90) setMeta(v) } catch {} }, [])
  useEffect(() => { try { localStorage.setItem("rk-meta-preparo", String(meta)) } catch {} }, [meta])
  useEffect(() => { (async () => {
    const [{ data: ls }, { data: ms }] = await Promise.all([supabase.from("lojas").select("id,nome,logo_url,tempo_min,tempo_max"), supabase.from("motoboys").select("id,nome,foto")])
    setLojas(new Map((ls ?? []).map((x: any) => [x.id, x]))); setMotos(new Map((ms ?? []).map((x: any) => [x.id, x])))
  })() }, [])
  useEffect(() => { if (periodo === "custom" && (!ci || !cf)) return; let vivo = true; setCarregando(true); (async () => {
    const out: Ped[] = []
    for (let i = 0; i < 100000; i += 1000) {
      const { data } = await supabase.from("pedidos").select("id,codigo,loja_id,motoboy_id,status,tipo,subtotal,criado_em,aceito_em,pronto_em,coletado_em,entregue_em,distancia_km")
        .gte("criado_em", `${ini}T03:00:00Z`).lte("criado_em", `${somaDia(fim, 1)}T02:59:59Z`).order("criado_em").range(i, i + 999)
      out.push(...((data ?? []) as Ped[])); if ((data ?? []).length < 1000) break
    }
    if (vivo) { setPeds(out); setCarregando(false) }
  })(); return () => { vivo = false } }, [ini, fim, periodo, ci, cf])

  const ent = useMemo(() => peds.filter(p => p.status === "entregue"), [peds])
  const nomeL = (id: string | null) => (id && lojas.get(id)?.nome) || "Loja"
  const nomeM = (id: string | null) => (id && motos.get(id)?.nome) || "Motoboy"

  const rkLojas = useMemo(() => {
    const m = new Map<string, { valor: number; pedidos: number; canc: number }>()
    for (const p of peds) { if (!p.loja_id) continue; const x = m.get(p.loja_id) ?? { valor: 0, pedidos: 0, canc: 0 }; if (p.status === "entregue") { x.valor += Number(p.subtotal) || 0; x.pedidos++ } else if (p.status === "cancelado") x.canc++; m.set(p.loja_id, x) }
    return [...m].map(([id, x]) => ({ id, ...x, ticket: x.pedidos ? x.valor / x.pedidos : 0 })).filter(x => x.pedidos).sort((a, b) => ordLoja === "valor" ? b.valor - a.valor : b.pedidos - a.pedidos || b.valor - a.valor)
  }, [peds, ordLoja])

  const rkMotos = useMemo(() => {
    const m = new Map<string, { n: number; rota: number[]; km: number; noPrazo: number; comPrazo: number }>()
    for (const p of ent) { if (!p.motoboy_id) continue; const x = m.get(p.motoboy_id) ?? { n: 0, rota: [], km: 0, noPrazo: 0, comPrazo: 0 }; x.n++
      const r = mins(p.coletado_em, p.entregue_em); if (r != null) x.rota.push(r); x.km += Number(p.distancia_km) || 0
      const tot = mins(p.criado_em, p.entregue_em), tm = p.loja_id && lojas.get(p.loja_id)?.tempo_max ? lojas.get(p.loja_id)!.tempo_max! + DESLOCAMENTO_MIN : null; if (tot != null && tm) { x.comPrazo++; if (tot <= tm) x.noPrazo++ }
      m.set(p.motoboy_id, x) }
    const l = [...m].map(([id, x]) => ({ id, n: x.n, rota: mediana(x.rota), medidas: x.rota.length, km: x.km, prazo: x.comPrazo ? pct(x.noPrazo, x.comPrazo) : null }))
    return ordMoto === "entregas" ? l.sort((a, b) => b.n - a.n) : l.filter(x => x.medidas >= 5 && x.rota != null).sort((a, b) => a.rota! - b.rota!)
  }, [ent, lojas, ordMoto])

  const tempos = useMemo(() => {
    const m = new Map<string, { prep: number[]; prepBotao: number; tot: number[]; atras: number; comPrazo: number }>()
    const atrasados: { p: Ped; acima: number; tot: number }[] = []
    for (const p of ent) { if (!p.loja_id) continue; const x = m.get(p.loja_id) ?? { prep: [], prepBotao: 0, tot: [], atras: 0, comPrazo: 0 }
      const pr = mins(p.aceito_em, p.pronto_em) ?? (p.tipo !== "loja" ? mins(p.aceito_em, p.coletado_em) : null); if (pr != null) { x.prep.push(pr); if (p.pronto_em) x.prepBotao++ }
      const tot = mins(p.criado_em, p.entregue_em), tm = lojas.get(p.loja_id)?.tempo_max ? lojas.get(p.loja_id)!.tempo_max! + DESLOCAMENTO_MIN : null
      if (tot != null) { x.tot.push(tot); if (tm) { x.comPrazo++; if (tot > tm) { x.atras++; atrasados.push({ p, acima: tot - tm, tot }) } } }
      m.set(p.loja_id, x) }
    const lista = [...m].map(([id, x]) => { const l = lojas.get(id), prep = media(x.prep), dentro = x.prep.filter(v => v <= meta).length, pa = x.comPrazo ? pct(x.atras, x.comPrazo) : null
      const sit = (pa ?? 0) >= 30 || (prep ?? 0) > meta + 10 ? "vermelho" : (pa ?? 0) >= 15 || (prep ?? 0) > meta ? "amarelo" : "verde"
      return { id, n: x.tot.length || x.prep.length, prep, prepOk: x.prep.length ? pct(dentro, x.prep.length) : null, botao: x.prep.length ? pct(x.prepBotao, x.prep.length) : 0, tot: media(x.tot), min: l?.tempo_min ?? null, max: l?.tempo_max ?? null, atras: x.atras, pa, sit } })
      .sort((a, b) => (b.pa ?? -1) - (a.pa ?? -1) || (b.prep ?? 0) - (a.prep ?? 0))
    const todosPrep = [...m.values()].flatMap(x => x.prep), todosTot = [...m.values()].flatMap(x => x.tot), cp = [...m.values()].reduce((t, x) => t + x.comPrazo, 0), at = [...m.values()].reduce((t, x) => t + x.atras, 0)
    return { lista, atrasados: atrasados.sort((a, b) => b.acima - a.acima), prep: media(todosPrep), prepOk: todosPrep.length ? pct(todosPrep.filter(v => v <= meta).length, todosPrep.length) : null, tot: media(todosTot), pa: cp ? pct(at, cp) : null, at }
  }, [ent, lojas, meta])

  const SIT = { verde: "Em dia", amarelo: "Atenção", vermelho: "Atrasando" } as const
  const totalValor = rkLojas.reduce((t, x) => t + x.valor, 0)

  return (
    <>
      <style>{`
        .rk-podio{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;align-items:end;max-width:560px;margin:8px auto 18px}
        .rk-deg{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;min-width:0}
        .rk-nome{font-size:14px;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
        .rk-val{font-weight:800;font-size:15px}
        .rk-bloco{width:100%;border-radius:12px 12px 4px 4px;display:flex;align-items:flex-start;justify-content:center;padding-top:8px;margin-top:6px}
        .rk-bloco span{color:#fff;font-weight:900;font-size:22px}
        .rk-pos{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--pedra);font-weight:800;font-size:13px}
        .rk-filtros{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
        .rk-meta{display:inline-flex;align-items:center;gap:6px;font-size:14px}
        .rk-meta input{width:64px;height:36px;border-radius:10px;border:1.5px solid var(--linha);padding:0 8px;font-size:16px;background:transparent;color:inherit}
        @media (max-width:520px){.rk-podio{gap:6px}.rk-nome{font-size:12px}.rk-val{font-size:13px}}
      `}</style>

      <div className="rk-filtros">
        {([["semana", "Esta semana"], ["semana-passada", "Semana passada"], ["mes", "Este mês"], ["mes-passado", "Mês passado"], ["custom", "Escolher datas"]] as const).map(([k, t]) =>
          <button key={k} className="chip" aria-pressed={periodo === k} onClick={() => { if (k === "custom" && !ci) { setCi(ini); setCf(fim) } setPeriodo(k) }}>{t}</button>)}
      </div>
      {periodo === "custom" && <div className="lin" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}><input type="date" className="pd-sel" value={ci} max={hojeBR()} onChange={e => setCi(e.target.value)} /><span className="mut">até</span><input type="date" className="pd-sel" value={cf} max={hojeBR()} onChange={e => setCf(e.target.value)} /></div>}
      <p className="t14 mut" style={{ margin: "0 0 12px" }}>{rotulo}. {carregando ? "Carregando…" : `${ent.length} pedidos entregues, ${brl(totalValor)} em produtos.`}</p>

      <div className="abas-l"><button aria-pressed={aba === "lojas"} onClick={() => setAba("lojas")}>Lojas</button><button aria-pressed={aba === "motoboys"} onClick={() => setAba("motoboys")}>Motoboys</button><button aria-pressed={aba === "tempos"} onClick={() => setAba("tempos")}>Preparo e prazo</button></div>

      {!carregando && aba === "lojas" && <>
        <div className="chips-l" style={{ marginBottom: 6 }}><button className="chip" aria-pressed={ordLoja === "valor"} onClick={() => setOrdLoja("valor")}>Quem vendeu mais (R$)</button><button className="chip" aria-pressed={ordLoja === "pedidos"} onClick={() => setOrdLoja("pedidos")}>Mais pedidos</button></div>
        <Podio itens={rkLojas.slice(0, 3).map(x => ({ id: x.id, nome: nomeL(x.id), foto: lojas.get(x.id)?.logo_url ?? null, valor: ordLoja === "valor" ? brl(x.valor) : `${x.pedidos} pedidos`, sub: ordLoja === "valor" ? `${x.pedidos} pedidos` : brl(x.valor) }))} />
        <div className="cartao" style={{ padding: 6, overflow: "auto" }}><table className="tabela">
          <thead><tr><th>#</th><th>Loja</th><th>Vendeu</th><th>Pedidos</th><th>Ticket médio</th><th>Parte do total</th><th>Cancelados</th></tr></thead>
          <tbody>{rkLojas.map((x, i) => <tr key={x.id}><td><span className="rk-pos">{i + 1}</span></td>
            <td><span className="lin" style={{ gap: 10 }}><Avatar src={lojas.get(x.id)?.logo_url} nome={nomeL(x.id)} /><b>{nomeL(x.id)}</b></span></td>
            <td className="num"><b>{brl(x.valor)}</b></td><td className="num">{x.pedidos}</td><td className="num">{brl(x.ticket)}</td><td className="num">{pct(x.valor, totalValor)}%</td>
            <td>{x.canc ? <span className="selo vermelho">{x.canc}</span> : <span className="mut">0</span>}</td></tr>)}
            {!rkLojas.length && <tr><td colSpan={7} className="vazio">Nenhuma venda no período.</td></tr>}</tbody></table>
          <p className="t12 mut" style={{ padding: "6px 10px" }}>Vendeu = valor dos produtos dos pedidos entregues (sem frete).</p></div>
      </>}

      {!carregando && aba === "motoboys" && <>
        <div className="chips-l" style={{ marginBottom: 6 }}><button className="chip" aria-pressed={ordMoto === "entregas"} onClick={() => setOrdMoto("entregas")}>Mais entregas</button><button className="chip" aria-pressed={ordMoto === "rapido"} onClick={() => setOrdMoto("rapido")}>Entrega mais rápida</button></div>
        <Podio itens={rkMotos.slice(0, 3).map(x => ({ id: x.id, nome: nomeM(x.id), foto: motos.get(x.id)?.foto ?? null, valor: ordMoto === "entregas" ? `${x.n} entregas` : mm(x.rota), sub: ordMoto === "entregas" ? `rota em ${mm(x.rota)}` : `${x.n} entregas` }))} />
        <div className="cartao" style={{ padding: 6, overflow: "auto" }}><table className="tabela">
          <thead><tr><th>#</th><th>Motoboy</th><th>Entregas</th><th>Tempo da rota</th><th>Km rodados</th><th>Chegou no prazo</th></tr></thead>
          <tbody>{rkMotos.map((x, i) => <tr key={x.id}><td><span className="rk-pos">{i + 1}</span></td>
            <td><span className="lin" style={{ gap: 10 }}><Avatar src={motos.get(x.id)?.foto} nome={nomeM(x.id)} /><b>{nomeM(x.id)}</b></span></td>
            <td className="num"><b>{x.n}</b></td><td className="num">{mm(x.rota)}</td><td className="num">{x.km ? x.km.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " km" : "–"}</td>
            <td>{x.prazo == null ? <span className="mut">–</span> : <span className={`selo ${x.prazo >= 85 ? "verde" : x.prazo >= 70 ? "amarelo" : "vermelho"}`}>{x.prazo}%</span>}</td></tr>)}
            {!rkMotos.length && <tr><td colSpan={6} className="vazio">{ordMoto === "rapido" ? "Ninguém com 5 entregas medidas no período." : "Nenhuma entrega no período."}</td></tr>}</tbody></table>
          <p className="t12 mut" style={{ padding: "6px 10px" }}>Tempo da rota = da coleta na loja até marcar entregue (mediana). No ranking de rapidez entra quem tem pelo menos 5 entregas medidas. Chegou no prazo = pedido entregue dentro do tempo máximo que a loja mostra ao cliente.</p></div>
      </>}

      {!carregando && aba === "tempos" && <>
        <div className="rk-filtros"><label className="rk-meta">Meta de preparo <input type="number" min={5} max={90} value={meta} onChange={e => setMeta(Math.max(5, Math.min(90, Number(e.target.value) || 20)))} /> min</label></div>
        <div className="kpis4">
          <div className="cartao kpi2"><small>Preparo médio</small><b className="num">{mm(tempos.prep)}</b><span className="t14 mut">{tempos.prepOk ?? 0}% dentro da meta de {meta} min</span></div>
          <div className="cartao kpi2"><small>Entrega média</small><b className="num">{mm(tempos.tot)}</b><span className="t14 mut">do pedido feito até a porta</span></div>
          <div className="cartao kpi2"><small>Passaram do prazo</small><b className="num" style={{ color: tempos.at ? "var(--pimenta)" : undefined }}>{tempos.at}</b><span className="t14 mut">{tempos.pa ?? 0}% dos pedidos entregues</span></div>
          <div className="cartao kpi2"><small>Lojas pedindo atenção</small><b className="num">{tempos.lista.filter(x => x.sit !== "verde").length}</b><span className="t14 mut">de {tempos.lista.length} com pedidos</span></div>
        </div>
        <div className="cartao" style={{ padding: 6, overflow: "auto", marginBottom: 14 }}><table className="tabela">
          <thead><tr><th>Loja</th><th>Situação</th><th>Pedidos</th><th>Preparo médio</th><th>Na meta</th><th>Entrega média</th><th>Prazo mostrado</th><th>Atrasados</th></tr></thead>
          <tbody>{tempos.lista.map(x => <tr key={x.id}>
            <td><span className="lin" style={{ gap: 10 }}><Avatar src={lojas.get(x.id)?.logo_url} nome={nomeL(x.id)} /><b>{nomeL(x.id)}</b></span></td>
            <td><span className={`selo ${x.sit}`}>{SIT[x.sit as keyof typeof SIT]}</span></td><td className="num">{x.n}</td>
            <td className="num" title={`${x.botao}% medido pelo botão Pronto, o resto pela coleta`}><b style={{ color: (x.prep ?? 0) > meta ? "var(--pimenta-esc)" : undefined }}>{mm(x.prep)}</b></td>
            <td className="num">{x.prepOk == null ? "–" : `${x.prepOk}%`}</td><td className="num">{mm(x.tot)}</td>
            <td className="num mut">{x.max ? `${x.min ?? "?"} a ${x.max} min` : "sem prazo"}</td>
            <td>{x.atras ? <span className={`selo ${(x.pa ?? 0) >= 30 ? "vermelho" : "amarelo"}`}>{x.atras} ({x.pa}%)</span> : <span className="mut">0</span>}</td></tr>)}
            {!tempos.lista.length && <tr><td colSpan={8} className="vazio">Nenhum pedido entregue no período.</td></tr>}</tbody></table>
          <p className="t12 mut" style={{ padding: "6px 10px" }}>Preparo = do aceite até a loja marcar Pronto; quando a loja não marca, conta até o motoboy coletar. Atrasado = entregue depois do tempo máximo que a loja mostra ao cliente. Em dia: menos de 15% atrasados e preparo na meta. Atrasando: 30% ou mais atrasados, ou preparo 10 min acima da meta.</p></div>

        <h3 style={{ margin: "4px 0 8px", fontSize: 16 }}>Pedidos que passaram do prazo</h3>
        <div className="cartao" style={{ padding: 6, overflow: "auto" }}><table className="tabela">
          <thead><tr><th>Pedido</th><th>Quando</th><th>Loja</th><th>Motoboy</th><th>Levou</th><th>Passou</th><th>Preparo</th><th>Rota</th></tr></thead>
          <tbody>{tempos.atrasados.slice(0, 50).map(({ p, acima, tot }) => <tr key={p.id}>
            <td><Link href={`/chego-ctrl/pedidos?codigo=${p.codigo}`} style={{ color: "var(--pimenta)", fontWeight: 800 }}>#{p.codigo}</Link></td>
            <td className="num mut">{new Date(p.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</td>
            <td>{nomeL(p.loja_id)}</td><td>{p.motoboy_id ? nomeM(p.motoboy_id) : <span className="mut">a loja</span>}</td>
            <td className="num">{mm(tot)}</td><td><span className="selo vermelho">+{Math.round(acima)} min</span></td>
            <td className="num">{mm(mins(p.aceito_em, p.pronto_em ?? p.coletado_em))}</td><td className="num">{mm(mins(p.coletado_em, p.entregue_em))}</td></tr>)}
            {!tempos.atrasados.length && <tr><td colSpan={8} className="vazio">Nenhum pedido passou do prazo no período.</td></tr>}</tbody></table>
          <p className="t12 mut" style={{ padding: "6px 10px" }}>Os 50 mais atrasados. Preparo e Rota mostram onde o tempo foi perdido.</p></div>
      </>}
    </>
  )
}
