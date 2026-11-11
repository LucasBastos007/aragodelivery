"use client"

// Ao vivo (admin 2.0, 20/10/2026): o que está acontecendo agora. Números do dia, mapa dos
// motoboys, pedidos em andamento, rankings do período e quem precisa de atenção.
// Aba Despacho (antes era uma tela separada): mandar motoboy na mão e SOS.
import Link from "next/link"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

const Despacho = dynamic(() => import("../_DespachoPainel"), { ssr: false, loading: () => <p className="mut">Carregando…</p> })
const Mapa = dynamic(() => import("../_Mapa"), { ssr: false, loading: () => <div className="mapa-op" /> })

type Periodo = "hoje" | "7d" | "30d"
const ANDAMENTO = ["aguardando_pagamento", "pendente", "aceito", "preparando", "pronto", "aguardando_aceite", "indo_para_loja", "na_loja", "coletado", "em_rota"]
const ST: Record<string, [string, string]> = {
  aguardando_pagamento: ["Pix não pago", "cinza"], pendente: ["Esperando a loja", "amarelo"], aceito: ["Aceito", "azul"], preparando: ["Na cozinha", "azul"],
  pronto: ["Pronto, sem motoboy", "vermelho"], aguardando_aceite: ["Chamando motoboy", "roxo"], indo_para_loja: ["Motoboy indo à loja", "roxo"], na_loja: ["Motoboy na loja", "roxo"],
  coletado: ["Coletado", "azul"], em_rota: ["Saiu pra entrega", "verde"], entregue: ["Entregue", "verde"], cancelado: ["Cancelado", "vermelho"],
}
const brl = (v: number) => `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const curto = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : brl(v)
const ymdBrt = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d)
const iniDia = (ymd: string) => `${ymd}T03:00:00.000Z`
const minDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
const tempo = (m: number) => m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${Math.floor(m / 1440)} dias`

function AoVivoGeral() {
  const [periodo, setPeriodo] = useState<Periodo>("7d")
  const [d, setD] = useState<any>(null)

  const load = useCallback(async (p: Periodo) => {
    const hoje = ymdBrt(), dias = p === "hoje" ? 0 : p === "7d" ? 6 : 29
    const corte = iniDia(ymdBrt(new Date(Date.now() - dias * 86400000)))
    const [lojas, mbs, per, dia, and, sos, avul] = await Promise.all([
      supabase.from("lojas").select("id, nome, status, categoria, aberto, logo_url, lat, lng"),
      supabase.from("motoboys").select("id, nome, status, disponivel, lat, lng"),
      supabase.from("pedidos").select("id, total, status, loja_id, motoboy_id, taxa_entrega, motoboy:motoboys(nome)").gte("criado_em", corte).neq("status", "cancelado").limit(5000),
      supabase.from("pedidos").select("id, codigo, total, status, criado_em, atualizado_em, loja:lojas(nome)").gte("criado_em", iniDia(hoje)).order("criado_em", { ascending: false }).limit(1000),
      supabase.from("pedidos").select("id, codigo, total, status, criado_em, atualizado_em, motoboy_id, endereco_entrega, loja:lojas(nome, logo_url)").in("status", ANDAMENTO).order("criado_em", { ascending: true }).limit(100),
      supabase.from("alertas_sos").select("motoboy_id").eq("status", "pendente"),
      supabase.from("entregas_avulsas").select("motoboy_id, motoboy_nome, taxa_entrega").eq("status", "entregue").not("motoboy_id", "is", null).gte("criado_em", corte),
    ])
    const L = lojas.data ?? [], M = mbs.data ?? [], P = (per.data ?? []) as any[], H = (dia.data ?? []) as any[]
    const porLoja = new Map<string, { v: number; n: number }>()
    for (const x of P) if (x.loja_id) { const a = porLoja.get(x.loja_id) ?? { v: 0, n: 0 }; a.v += x.total ?? 0; a.n++; porLoja.set(x.loja_id, a) }
    const porMb = new Map<string, { nome: string; n: number; v: number }>()
    for (const x of P) if (x.status === "entregue" && x.motoboy_id) { const a = porMb.get(x.motoboy_id) ?? { nome: x.motoboy?.nome ?? "—", n: 0, v: 0 }; a.n++; a.v += x.taxa_entrega ?? 0; porMb.set(x.motoboy_id, a) }
    for (const x of (avul.data ?? []) as any[]) { const a = porMb.get(x.motoboy_id) ?? { nome: x.motoboy_nome ?? "—", n: 0, v: 0 }; a.n++; a.v += x.taxa_entrega ?? 0; porMb.set(x.motoboy_id, a) }
    const ativas = L.filter((l: any) => l.status === "ativo")
    setD({
      lojas: L, mbs: M, sos: sos.data ?? [],
      andamento: and.data ?? [],
      ativasMb: ((and.data ?? []) as any[]).filter(x => x.motoboy_id).map(x => ({ motoboy_id: x.motoboy_id, status: x.status })),
      hoje: { validos: H.filter(x => x.status !== "cancelado").length, cancel: H.filter(x => x.status === "cancelado").length, vendido: H.filter(x => x.status === "entregue").reduce((s, x) => s + (x.total ?? 0), 0), entregues: H.filter(x => x.status === "entregue").length },
      recentes: H.slice(0, 10),
      topLojas: [...porLoja.entries()].map(([id, a]) => ({ id, ...a, l: L.find((l: any) => l.id === id) })).sort((a, b) => b.v - a.v).slice(0, 6),
      topMb: [...porMb.entries()].map(([id, a]) => ({ id, ...a })).sort((a, b) => b.n - a.n).slice(0, 6),
      fracas: ativas.map((l: any) => ({ l, n: porLoja.get(l.id)?.n ?? 0 })).filter(x => x.n < 3).sort((a, b) => a.n - b.n).slice(0, 6),
      pend: { lojas: L.filter((l: any) => l.status === "pendente").length, mbs: M.filter((m: any) => m.status === "pendente").length },
      abertas: L.filter((l: any) => l.aberto && l.status === "ativo").length, online: M.filter((m: any) => m.disponivel && m.status === "ativo").length,
      quando: new Date(),
    })
  }, [])

  useEffect(() => { load(periodo); const iv = setInterval(() => load(periodo), 30_000); return () => clearInterval(iv) }, [load, periodo])

  if (!d) return <p className="mut">Carregando…</p>
  const nomePer = periodo === "hoje" ? "hoje" : periodo === "7d" ? "nos últimos 7 dias" : "nos últimos 30 dias"
  const maxL = d.topLojas[0]?.v || 1, maxM = d.topMb[0]?.n || 1
  const parados = d.andamento.filter((p: any) => p.status === "pronto" && !p.motoboy_id).length

  return (
    <>
      {(d.pend.lojas > 0 || d.pend.mbs > 0) && (
        <div className="cartao av-pend">
          <span><b>Cadastros esperando você</b><small>{[d.pend.lojas && `${d.pend.lojas} ${d.pend.lojas === 1 ? "loja" : "lojas"}`, d.pend.mbs && `${d.pend.mbs} ${d.pend.mbs === 1 ? "motoboy" : "motoboys"}`].filter(Boolean).join(" e ")} pra aprovar.</small></span>
          {d.pend.lojas > 0 && <Link className="btn btn-s" href="/chego-ctrl/lojas">Ver lojas</Link>}
          {d.pend.mbs > 0 && <Link className="btn btn-s" href="/chego-ctrl/motoboys">Ver motoboys</Link>}
        </div>
      )}

      <div className="kpis4">
        <div className="cartao kpi2"><small>Pedidos hoje</small><b className="num">{d.hoje.validos}</b><span className="t14 mut">{d.hoje.cancel ? `${d.hoje.cancel} cancelados` : "nenhum cancelado"}</span></div>
        <div className="cartao kpi2"><small>Vendido hoje</small><b className="num">{brl(d.hoje.vendido)}</b><span className="t14 mut">{d.hoje.entregues} entregues</span></div>
        <div className="cartao kpi2"><small>Em andamento agora</small><b className="num">{d.andamento.length}</b><span className={`var ${parados ? "desce" : ""}`} style={parados ? undefined : { color: "var(--suave)" }}>{parados ? `${parados} pronto${parados > 1 ? "s" : ""} sem motoboy` : "nenhum parado"}</span></div>
        <div className="cartao kpi2"><small>Na rua agora</small><b className="num">{d.online} <span className="t14 mut" style={{ fontWeight: 600 }}>motoboys</span></b><span className="t14 mut">{d.abertas} lojas abertas</span></div>
      </div>

      <div className="op-grade" style={{ marginTop: 0 }}>
        <div className="cartao" style={{ padding: 0, overflow: "hidden" }}>
          <Mapa motoboys={d.mbs} sos={d.sos} ativas={d.ativasMb} lojas={d.andamento.filter((p: any) => p.status === "pronto" && !p.motoboy_id).map((p: any) => { const l = d.lojas.find((x: any) => x.nome === p.loja?.nome); return { id: p.id, lat: l?.lat, lng: l?.lng, titulo: `#${p.codigo} pronto`, sub: p.loja?.nome } })} altura={460} />
        </div>
        <div className="cartao av-and">
          <div className="lin" style={{ padding: "16px 16px 8px" }}><span className="t20">Pedidos em andamento</span><Link className="btn btn-l" style={{ marginLeft: "auto" }} href="/chego-ctrl/pedidos">Abrir esteira</Link></div>
          <div className="av-and-l">
            {d.andamento.length === 0 && <div className="dsp-vazio"><b>Nada em andamento</b><span>Quando entrar pedido, ele aparece aqui com a etapa e há quanto tempo está nela.</span></div>}
            {d.andamento.map((p: any) => { const st = ST[p.status] ?? [p.status, "cinza"], m = minDesde(p.atualizado_em ?? p.criado_em); return (
              <Link key={p.id} href={`/chego-ctrl/pedidos?codigo=${p.codigo}`} className="av-ped">
                {p.loja?.logo_url ? <img src={p.loja.logo_url} alt="" /> : <span className="av-ini">{(p.loja?.nome ?? "?")[0]}</span>}
                <span className="av-txt"><b>#{p.codigo} <span className={`selo ${st[1]}`}>{st[0]}</span></b><small>{p.loja?.nome ?? "—"}, {brl(p.total)}</small></span>
                <span className={`av-min ${m >= 15 ? "quente" : ""}`}>{tempo(m)}</span>
              </Link>) })}
          </div>
        </div>
      </div>

      <div className="lin av-per">
        <span className="t20">Desempenho {nomePer}</span>
        <div className="chips-l" style={{ marginLeft: "auto" }}>{([["hoje", "Hoje"], ["7d", "7 dias"], ["30d", "30 dias"]] as [Periodo, string][]).map(([k, n]) => <button key={k} className="chip" aria-pressed={periodo === k} onClick={() => setPeriodo(k)}>{n}</button>)}</div>
      </div>
      <div className="av-tres">
        <div className="cartao av-bloco">
          <b className="t16b">Lojas que mais venderam</b>
          {d.topLojas.length === 0 ? <p className="t14 mut">Sem vendas no período.</p> : <ol className="ini-rank">{d.topLojas.map((x: any, i: number) => (
            <li key={x.id}><span className="pos">{i + 1}</span>{x.l?.logo_url ? <img src={x.l.logo_url} alt="" /> : <span className="av">{(x.l?.nome ?? "?")[0]}</span>}
              <span className="nm"><span>{x.l?.nome ?? "—"}</span><i style={{ width: `${x.v / maxL * 100}%` }} /></span><b className="num">{curto(x.v)}<small className="av-n">{x.n} ped.</small></b></li>))}</ol>}
        </div>
        <div className="cartao av-bloco">
          <b className="t16b">Motoboys que mais entregaram</b>
          {d.topMb.length === 0 ? <p className="t14 mut">Sem entregas no período.</p> : <ol className="ini-rank">{d.topMb.map((x: any, i: number) => (
            <li key={x.id}><span className="pos">{i + 1}</span><span className="av" style={{ borderRadius: "50%", background: "var(--azul-claro)", color: "var(--azul)" }}>{x.nome[0]}</span>
              <span className="nm"><span>{x.nome}</span><i style={{ width: `${x.n / maxM * 100}%`, background: "var(--azul)" }} /></span><b className="num">{x.n} ent.<small className="av-n">{curto(x.v)}</small></b></li>))}</ol>}
        </div>
        <div className="cartao av-bloco">
          <b className="t16b">Lojas com poucos pedidos</b>
          <p className="t14 mut" style={{ margin: "2px 0 8px" }}>Menos de 3 pedidos {nomePer}. Vale uma ligação.</p>
          {d.fracas.length === 0 ? <p className="t14 mut">Todas as lojas ativas venderam bem.</p> : d.fracas.map((x: any) => (
            <div key={x.l.id} className="av-fraca"><span className={`pt ${x.n === 0 ? "z" : ""}`} /><span style={{ flex: 1, minWidth: 0 }}><b>{x.l.nome}</b><small>{x.l.categoria ?? "sem categoria"}</small></span><span className={`selo ${x.n === 0 ? "vermelho" : "amarelo"}`}>{x.n === 0 ? "nenhum" : `${x.n} pedido${x.n > 1 ? "s" : ""}`}</span></div>))}
        </div>
      </div>

      <div className="cartao av-bloco" style={{ marginTop: 12 }}>
        <div className="lin"><b className="t16b">Acontecendo hoje</b><span className="t14 mut" style={{ marginLeft: "auto" }}>atualizado às {d.quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
        {d.recentes.length === 0 ? <p className="t14 mut" style={{ marginTop: 8 }}>Nenhum pedido hoje ainda.</p> : (
          <table className="tabela" style={{ marginTop: 6 }}><tbody>{d.recentes.map((p: any) => { const st = ST[p.status] ?? [p.status, "cinza"]; return (
            <tr key={p.id}><td className="num" style={{ width: 70, color: "var(--suave)" }}>{new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
              <td><Link href={`/chego-ctrl/pedidos?codigo=${p.codigo}`}><b>#{p.codigo}</b></Link> <span className="mut">{p.loja?.nome}</span></td>
              <td><span className={`selo ${st[1]}`}>{st[0]}</span></td><td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{brl(p.total)}</td></tr>) })}</tbody></table>)}
      </div>
    </>
  )
}

export default function AoVivoPage() {
  const [aba, setAba] = useState<"agora" | "despacho">("agora")
  const [prontos, setProntos] = useState(0)
  useEffect(() => { if (new URLSearchParams(window.location.search).get("aba") === "despacho") setAba("despacho") }, [])
  useEffect(() => {
    const ler = () => supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("status", "pronto").is("motoboy_id", null).not("endereco_entrega", "ilike", "%Retirada%").then(({ count }) => setProntos(count ?? 0))
    ler(); const iv = setInterval(ler, 20_000); return () => clearInterval(iv)
  }, [])
  const trocar = (a: "agora" | "despacho") => { setAba(a); window.history.replaceState(null, "", a === "despacho" ? "?aba=despacho" : window.location.pathname) }
  return (
    <>
      <div className="abas-l"><button aria-pressed={aba === "agora"} onClick={() => trocar("agora")}>Agora</button>
        <button aria-pressed={aba === "despacho"} onClick={() => trocar("despacho")}>Despacho {prontos > 0 && <span className="dsp-cont sos">{prontos}</span>}</button></div>
      {aba === "agora" ? <AoVivoGeral /> : <Despacho />}
    </>
  )
}
