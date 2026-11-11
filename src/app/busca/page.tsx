"use client"
// Busca do layout novo (proposta aprovada em 19/10/2026). Só leitura: procura lojas e pratos
// e abre as mesmas rotas de sempre (/restaurante/[id]). Mantém o filtro ?cidade= usado pelo
// banner "Chegô chegou em Guapó".
import { PrecoPromo } from "@/components/cliente/PrecoPromo"
import { useEffect, useMemo, useRef, useState, Suspense } from "react"
import { ultimaPorUltimo } from "@/lib/ordemLojas"
import { LinhaLoja } from "@/components/cliente/LinhaLoja"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { MobileBottomNav } from "@/components/MobileBottomNav"
import { HalloweenDecor } from "@/components/HalloweenDecor"
import { precoExibicao, brl } from "@/lib/precoExibicao"
import type { Loja } from "@/types"

type Prod = { id: string; loja_id: string; nome: string; descricao: string | null; preco: number; foto_url: string | null; adicionais: unknown }

const ESCOLHA_GRUPO: Record<string, RegExp[]> = {
  lanches: [/^x[- ]?tudo$/i, /^x[- ]?(salada|bacon)/i, /hamb[uú]rguer|burger/i],
  pizza: [/^pizza calabresa/i, /^pizza /i],
  marmita: [/^prato executivo$/i, /executivo|prato do dia|marmita/i],
  doces: [/bolo no pote brigadeiro/i, /bolo no pote|brigadeiro|bolo/i],
  japonesa: [/^combo 01/i, /^combo .*pe[cç]as/i, /combinado|\d+ ?pcs|uramaki/i],
  mercado: [/queijo de tran[cç]a/i, /requeij[aã]o|queijo/i],
  bebidas: [/^coca[- ]cola 2/i, /coca|refrigerante/i],
  outros: [/^copo de a[cç]a[ií]/i, /a[cç]a[ií]/i],
}

const GRUPOS = [
  { id: "lanches", n: "Lanches", e: "🍔", m: ["Lanches", "Hambúrguer", "Lanchonete"] },
  { id: "pizza", n: "Pizza", e: "🍕", m: ["Pizza", "Italiana"] },
  { id: "almoco", n: "Almoço", e: "🍛", m: ["Restaurante", "Carnes", "Saudável"] },
  { id: "doces", n: "Doces", e: "🧁", m: ["Doces e Bolos"] },
  { id: "japonesa", n: "Japonesa", e: "🍣", m: ["Japonês"] },
  { id: "mercado", n: "Mercado", e: "🛒", m: ["Mercado", "Mercadinho"] },
  { id: "bebidas", n: "Bebidas", e: "🥤", m: ["Bebidas"] },
  { id: "outros", n: "Outros", e: "🛍️", m: ["Outros"] },
]
const INTENCOES: Record<string, { n: string; t: (p: Prod, l: Loja) => boolean }> = {
  leve: { n: "🥗 Algo leve", t: p => /salada|grelhad|açaí|acai|suco|wrap|natural|fit|integral|frutas/i.test(p.nome + " " + (p.descricao ?? "")) },
  dividir: { n: "👨‍👩‍👧 Pra dividir", t: p => /combo|famíl|famil|grande|porç|porc|balde|gigante|2 litros/i.test(p.nome + " " + (p.descricao ?? "")) || /pizza/i.test(p.nome) },
  barato: { n: "💸 Até R$ 30", t: p => precoExibicao(p).valor <= 30 },
  rapido: { n: "⚡ Chega rápido", t: (_p, l) => (l.tempo_max ?? 60) <= 35 },
}
const MAIS_BUSCADOS = ["Pizza", "X-tudo", "Açaí", "Marmita", "Coca-Cola", "Pastel", "Hambúrguer", "Espetinho"]
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
const tempo = (l: Loja) => `${l.tempo_min ?? 30}-${l.tempo_max ?? 50} min`

const IcVoltar = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
const IcBusca = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7.5" /><path d="m20.5 20.5-4.2-4.2" /></svg>


function LinhaPrato({ p, l }: { p: Prod; l: Loja }) {
  const { valor, aPartir } = precoExibicao(p)
  return (
    <Link className="res-prato" href={`/restaurante/${l.id}?produto=${p.id}`}>
      {p.foto_url ? <img src={p.foto_url} alt="" loading="lazy" /> : <span className="sem-foto">🍽️</span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <b>{p.nome}</b>
        <small className="mut">{l.nome}{l.aberto ? `, ${tempo(l)}` : ", fechada"}</small>
      </span>
      <PrecoPromo produtoId={p.id} valor={valor} aPartir={aPartir} normal={<span className="preco">{aPartir && <small>a partir de </small>}{brl(valor)}</span>} />
    </Link>
  )
}

function BuscaContent() {
  const params = useSearchParams()
  const [cidade, setCidade] = useState<string | null>(params.get("cidade"))
  const [q, setQ] = useState(params.get("q") ?? "")
  const [grupo, setGrupo] = useState<string | null>(null)
  const [intencao, setIntencao] = useState<string | null>(null)
  const [fb, setFb] = useState<Set<string>>(new Set())
  const [lojas, setLojas] = useState<Loja[]>([])
  const [prods, setProds] = useState<Prod[]>([])
  const [buscando, setBuscando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    supabase.from("lojas").select("*").eq("status", "ativo")
      .order("ordem_home", { ascending: true, nullsFirst: false })
      .order("destaque", { ascending: false }).order("aberto", { ascending: false }).order("nome")
      .then(({ data }) => setLojas(ultimaPorUltimo((data as Loja[]) ?? [])))
  }, [])
  const porId = useMemo(() => new Map(lojas.map(l => [l.id, l])), [lojas])
  const daCidade = (l: Loja) => !cidade || l.cidade === cidade || (l.cidades_atendidas ?? []).includes(cidade)

  // Pratos: busca no servidor pelo nome/descrição (só leitura), com uma pequena espera ao digitar
  const termo = q.trim()
  useEffect(() => {
    if (termo.length < 2) { setProds([]); return }
    const limpo = termo.replace(/[%,()*\\]/g, " ").trim()
    setBuscando(true)
    const t = setTimeout(() => {
      supabase.from("produtos").select("id, loja_id, nome, descricao, preco, foto_url, adicionais")
        .eq("disponivel", true).or(`nome.ilike.%${limpo}%,descricao.ilike.%${limpo}%`).limit(300)
        .then(({ data }) => { setProds((data as Prod[]) ?? []); setBuscando(false) })
    }, 250)
    return () => clearTimeout(t)
  }, [termo])

  // Sugestões por intenção: pratos com foto das lojas abertas
  const [vitrine, setVitrine] = useState<Prod[]>([])
  useEffect(() => {
    if (!intencao || vitrine.length) return
    const ids = lojas.filter(l => l.aberto).map(l => l.id)
    if (!ids.length) return
    supabase.from("produtos").select("id, loja_id, nome, descricao, preco, foto_url, adicionais")
      .in("loja_id", ids).eq("disponivel", true).not("foto_url", "is", null).limit(1500)
      .then(({ data }) => setVitrine((data as Prod[]) ?? []))
  }, [intencao, lojas, vitrine.length])

  // Foto de cada categoria (igual à proposta): um prato típico com foto, escolhido pelo nome;
  // sem achar, fica o emoji (nunca uma foto aleatória).
  const [fotoGrupo, setFotoGrupo] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!lojas.length || Object.keys(fotoGrupo).length) return
    supabase.from("produtos").select("nome, foto_url, loja_id").in("loja_id", lojas.map(l => l.id))
      .eq("disponivel", true).not("foto_url", "is", null).limit(3000)
      .then(({ data }) => {
        const ps = (data ?? []) as { nome: string; foto_url: string; loja_id: string }[]
        const catDe = new Map(lojas.map(l => [l.id, l.categoria]))
        const r: Record<string, string> = {}
        for (const g of GRUPOS) {
          const doGrupo = ps.filter(p => g.m.includes(catDe.get(p.loja_id) ?? ""))
          const p = (ESCOLHA_GRUPO[g.id] ?? []).reduce<typeof ps[number] | undefined>((ach, re) => ach ?? doGrupo.find(x => re.test(x.nome.trim())), undefined)
          if (p) r[g.id] = p.foto_url
        }
        setFotoGrupo(r)
      })
  }, [lojas, fotoGrupo])

  const toggleFb = (k: string) => setFb(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  let corpo: React.ReactNode
  if (intencao && !termo) {
    const it = INTENCOES[intencao]
    const porLoja: Record<string, number> = {}
    const pratos = vitrine.filter(p => { const l = porId.get(p.loja_id); return l && l.aberto && daCidade(l) && precoExibicao(p).valor > 0 && it.t(p, l) })
      .filter(p => (porLoja[p.loja_id] = (porLoja[p.loja_id] ?? 0) + 1) <= 4).slice(0, 30)
    corpo = <>
      <p className="mut" style={{ padding: "0 16px 10px", fontSize: 13.5 }}>Sugestões das lojas abertas agora.</p>
      <div style={{ paddingBottom: 120 }}>{pratos.length ? pratos.map((p, i) => <div key={p.id}>{i > 0 && <div className="divisor" />}<LinhaPrato p={p} l={porId.get(p.loja_id)!} /></div>) : <div className="vazio">{vitrine.length ? "Nenhuma sugestão agora." : "Carregando…"}</div>}</div>
    </>
  } else if (!termo && !grupo) {
    corpo = (
      <div className="recentes">
        {cidade && <><span className="h3">Lojas de {cidade}</span><div style={{ margin: "6px -16px 18px" }}>{lojas.filter(daCidade).map((l, i) => <div key={l.id}>{i > 0 && <div className="divisor" />}<LinhaLoja l={l} /></div>)}</div></>}
        <span className="h3">Peça do seu jeito</span>
        <div className="chips">{Object.entries(INTENCOES).map(([k, v]) => <button key={k} className="chip" onClick={() => setIntencao(k)}>{v.n}</button>)}</div>
        <span className="h3">Mais buscados</span>
        <div className="chips">{MAIS_BUSCADOS.map(t => <button key={t} className="chip" onClick={() => setQ(t)}>{t}</button>)}</div>
        <span className="h3">Categorias</span>
        <div className="grupos">{GRUPOS.filter(g => lojas.some(l => g.m.includes(l.categoria))).map(g => (
          <button key={g.id} onClick={() => setGrupo(g.id)}><span>{fotoGrupo[g.id] ? <img src={fotoGrupo[g.id]} alt="" loading="lazy" /> : g.e}</span>{g.n}</button>
        ))}</div>
      </div>
    )
  } else if (grupo && !termo) {
    const g = GRUPOS.find(x => x.id === grupo)!
    const ls = lojas.filter(l => g.m.includes(l.categoria) && daCidade(l))
    corpo = <div style={{ paddingBottom: 120 }}>
      <div className="sec-tit"><span className="h3">{g.e} {g.n}</span><button onClick={() => setGrupo(null)}>Ver todas</button></div>
      {ls.length ? [...ls.filter(l => l.aberto), ...ls.filter(l => !l.aberto)].map((l, i) => <div key={l.id}>{i > 0 && <div className="divisor" />}<LinhaLoja l={l} /></div>) : <div className="vazio">Nenhuma loja nessa categoria ainda.</div>}
    </div>
  } else {
    const nq = norm(termo)
    const ls = lojas.filter(l => daCidade(l) && (norm(l.nome).includes(nq) || norm(l.categoria ?? "").includes(nq))).slice(0, 6)
    let pratos = prods.filter(p => { const l = porId.get(p.loja_id); return l && daCidade(l) && precoExibicao(p).valor > 0 })
    if (fb.has("abertas")) pratos = pratos.filter(p => porId.get(p.loja_id)!.aberto)
    if (fb.has("ate30")) pratos = pratos.filter(p => precoExibicao(p).valor <= 30)
    if (fb.has("foto")) pratos = pratos.filter(p => p.foto_url)
    pratos.sort((a, b) => Number(porId.get(b.loja_id)!.aberto) - Number(porId.get(a.loja_id)!.aberto))
    const total = pratos.length
    corpo = <>
      {ls.length > 0 && <><div className="sec-tit"><span className="h3">Lojas</span></div>{ls.map((l, i) => <div key={l.id}>{i > 0 && <div className="divisor" />}<LinhaLoja l={l} /></div>)}</>}
      <div className="sec-tit"><span className="h3">Pratos ({total})</span></div>
      <div className="filtros">{([["abertas", "Abertas agora"], ["ate30", "Até R$ 30"], ["foto", "Com foto"]] as const).map(([k, n]) =>
        <button key={k} className="chip" aria-pressed={fb.has(k)} onClick={() => toggleFb(k)}>{n}</button>)}</div>
      <div style={{ paddingBottom: 120 }}>
        {buscando && !total ? <div className="vazio">Buscando…</div>
          : total ? pratos.slice(0, 40).map((p, i) => <div key={p.id}>{i > 0 && <div className="divisor" />}<LinhaPrato p={p} l={porId.get(p.loja_id)!} /></div>)
          : <div className="vazio">Nada encontrado pra “{termo}”.</div>}
      </div>
    </>
  }

  const voltar = intencao ? () => setIntencao(null) : grupo ? () => setGrupo(null) : null
  return (
    <div className="cn busca-nova">
      <HalloweenDecor />
      <div className="topo">
        <div className="linha-topo">
          {voltar && <button className="voltar" onClick={voltar} aria-label="Voltar"><IcVoltar /></button>}
          {intencao && !termo
            ? <span className="h2">{INTENCOES[intencao].n}</span>
            : <label className="busca-real"><IcBusca /><input ref={inputRef} placeholder="Buscar loja ou prato" value={q} onChange={e => setQ(e.target.value)} enterKeyHint="search" /></label>}
          {q && <button className="limpar" onClick={() => setQ("")}>Limpar</button>}
        </div>
        {cidade && <div style={{ marginTop: 10 }}><span className="chip" aria-pressed="true">📍 {cidade} <button onClick={() => setCidade(null)} aria-label="Tirar filtro de cidade" style={{ color: "#fff", marginLeft: 2 }}>✕</button></span></div>}
      </div>
      {corpo}
      <MobileBottomNav />
    </div>
  )
}

export default function BuscaPage() {
  return <Suspense><BuscaContent /></Suspense>
}
