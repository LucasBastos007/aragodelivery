"use client"

// Cupons (admin 2.0, 20/10/2026). Do Chegô (globais, o Chegô paga o desconto) e das lojas (a loja paga),
// com quanto cada um já custou nos pedidos entregues. Mesmas ações: criar (com lojas e raio), ativar,
// pausar e excluir (/api/admin/cupons). Valores em reais com máscara.
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { R } from "../_dinheiro"

type Tipo = "percentual" | "fixo" | "frete_gratis" | "frete_percentual"
type Cupom = { id: string; codigo: string; tipo: Tipo; valor: number; loja_id: string | null; pedido_minimo: number; validade: string | null; ativo: boolean; usos: number; criado_em: string; lojas_ids: string[] | null; raio_km: number | null; max_usos: number | null; loja?: { nome: string } | null }
const TIPO: Record<Tipo, string> = { percentual: "% nos produtos", fixo: "R$ de desconto", frete_gratis: "Frete grátis", frete_percentual: "% no frete" }
const mascara = (v: string) => { const d = v.replace(/\D/g, "").replace(/^0+/, "").slice(0, 7); return d ? (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "" }
const paraNum = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0
const desc = (c: Cupom) => c.tipo === "frete_gratis" ? "Frete grátis" : c.tipo === "fixo" ? `${R(c.valor)} off` : c.tipo === "frete_percentual" ? `${c.valor}% no frete` : `${c.valor}% off`
const vencido = (c: Cupom) => !!c.validade && c.validade < new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())

export default function CuponsPage() {
  const [cupons, setCupons] = useState<Cupom[]>([])
  const [lojas, setLojas] = useState<{ id: string; nome: string }[]>([])
  const [custo, setCusto] = useState<Record<string, { n: number; v: number }>>({})
  const [carregou, setCarregou] = useState(false)
  const [aba, setAba] = useState<"chego" | "lojas">("chego")
  const [criar, setCriar] = useState(false)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)

  async function load() {
    const [{ data: cs }, { data: ls }] = await Promise.all([
      supabase.from("cupons").select("*, loja:lojas(nome)").order("criado_em", { ascending: false }),
      supabase.from("lojas").select("id, nome").eq("status", "ativo").order("nome"),
    ])
    setCupons((cs as Cupom[]) ?? []); setLojas(ls ?? [])
    const m: Record<string, { n: number; v: number }> = {}
    for (let i = 0; i < 20000; i += 1000) {
      const { data } = await supabase.from("pedidos").select("cupom_codigo, desconto").eq("status", "entregue").not("cupom_codigo", "is", null).range(i, i + 999)
      for (const p of (data ?? []) as any[]) { const k = String(p.cupom_codigo).toUpperCase(); (m[k] ??= { n: 0, v: 0 }); m[k].n++; m[k].v += Number(p.desconto ?? 0) }
      if ((data ?? []).length < 1000) break
    }
    setCusto(m); setCarregou(true)
  }
  useEffect(() => { load() }, [])

  async function api(metodo: string, body: object) {
    const r = await fetch("/api/admin/cupons", { method: metodo, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    return { ok: r.ok, j: await r.json().catch(() => ({})) as any }
  }
  async function alternar(c: Cupom) { const { ok, j } = await api("PATCH", { id: c.id, ativo: !c.ativo }); if (ok) { setCupons(xs => xs.map(x => x.id === c.id ? { ...x, ativo: !x.ativo } : x)); setMsg({ t: c.ativo ? `${c.codigo} pausado.` : `${c.codigo} ativo de novo.`, ok: true }) } else setMsg({ t: j.error ?? "Não deu certo.", ok: false }) }
  async function excluir(c: Cupom) { if (!confirm(`Excluir o cupom ${c.codigo}? Quem já usou não perde o desconto.`)) return; const { ok, j } = await api("DELETE", { id: c.id }); if (ok) { setCupons(xs => xs.filter(x => x.id !== c.id)); setMsg({ t: `${c.codigo} excluído.`, ok: true }) } else setMsg({ t: j.error ?? "Não deu certo.", ok: false }) }

  const globais = cupons.filter(c => !c.loja_id), daLoja = cupons.filter(c => c.loja_id)
  const lista = aba === "chego" ? globais : daLoja
  const custoChego = globais.reduce((t, c) => t + (custo[c.codigo.toUpperCase()]?.v ?? 0), 0)
  const nomeLoja = useMemo(() => new Map(lojas.map(l => [l.id, l.nome])), [lojas])

  return (
    <>
      <div className="kpis4">
        <div className="cartao kpi2"><small>Cupons do Chegô ativos</small><b className="num">{globais.filter(c => c.ativo && !vencido(c)).length}</b><span className="t14 mut">de {globais.length} criados</span></div>
        <div className="cartao kpi2"><small>Já custaram ao Chegô</small><b className="num">{R(custoChego)}</b><span className="t14 mut">desconto em pedidos entregues</span></div>
        <div className="cartao kpi2"><small>Cupons das lojas</small><b className="num">{daLoja.filter(c => c.ativo).length}</b><span className="t14 mut">a loja paga o desconto</span></div>
        <div className="cartao kpi2"><small>Usos no total</small><b className="num">{Object.values(custo).reduce((t, x) => t + x.n, 0)}</b><span className="t14 mut">pedidos com cupom</span></div>
      </div>
      {msg && <div className={`aviso ${msg.ok ? "vd" : "vm"}`} role="status" style={{ marginBottom: 10 }}>{msg.t}</div>}
      <div className="lin" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="abas-l" style={{ flex: 1, marginBottom: 0 }}><button aria-pressed={aba === "chego"} onClick={() => setAba("chego")}>Do Chegô ({globais.length})</button><button aria-pressed={aba === "lojas"} onClick={() => setAba("lojas")}>Das lojas ({daLoja.length})</button></div>
        {aba === "chego" && <button className="btn btn-p" style={{ minHeight: 42 }} onClick={() => { setMsg(null); setCriar(true) }}>Criar cupom</button>}
      </div>
      <div style={{ height: 12 }} />
      {!carregou ? <p className="mut">Carregando…</p> : lista.length === 0 ? <div className="cartao dsp-vazio"><b>{aba === "chego" ? "Nenhum cupom do Chegô" : "Nenhuma loja criou cupom"}</b><span>{aba === "chego" ? "Crie um cupom pra trazer cliente novo ou chamar de volta quem sumiu." : "As lojas criam os cupons delas no painel do lojista."}</span></div> : (
        <div className="cp-grade">{lista.map(c => { const u = custo[c.codigo.toUpperCase()], venc = vencido(c); return (
          <div key={c.id} className={`cartao cp-card ${!c.ativo || venc ? "off" : ""}`}>
            <div className="cp-topo"><b className="cp-cod">{c.codigo}</b><span className={`selo ${venc ? "cinza" : c.ativo ? "verde" : "amarelo"}`}>{venc ? "Vencido" : c.ativo ? "Ativo" : "Pausado"}</span></div>
            <b className="cp-val">{desc(c)}</b>
            <span className="t14 mut">{[c.pedido_minimo > 0 && `pedido mínimo ${R(c.pedido_minimo)}`, c.validade && `até ${new Date(c.validade + "T12:00:00").toLocaleDateString("pt-BR")}`, c.max_usos && `até ${c.max_usos} usos`].filter(Boolean).join(", ") || "sem mínimo e sem validade"}</span>
            <span className="t14 mut">{c.loja_id ? `Da loja ${c.loja?.nome ?? nomeLoja.get(c.loja_id) ?? ""}` : c.lojas_ids?.length ? `Só em ${c.lojas_ids.map(id => nomeLoja.get(id) ?? "loja").slice(0, 3).join(", ")}${c.lojas_ids.length > 3 ? ` e mais ${c.lojas_ids.length - 3}` : ""}` : "Vale em todas as lojas"}{c.raio_km ? `, até ${c.raio_km} km` : ""}</span>
            <div className="cp-uso"><span><b className="num">{u?.n ?? 0}</b> usos</span><span><b className="num">{R(u?.v ?? 0)}</b> {c.loja_id ? "de desconto" : "custou ao Chegô"}</span></div>
            {!c.loja_id && <div className="lin" style={{ gap: 8, marginTop: 6 }}><button className="btn btn-s" style={{ flex: 1, minHeight: 40 }} onClick={() => alternar(c)}>{c.ativo ? "Pausar" : "Ativar"}</button><button className="btn btn-l" style={{ minHeight: 40, color: "var(--pimenta-esc)" }} onClick={() => excluir(c)}>Excluir</button></div>}
          </div>) })}</div>)}
      {criar && <CriarCupom lojas={lojas} onFechar={(m) => { setCriar(false); if (m) { setMsg(m); load() } }} />}
    </>
  )
}

function CriarCupom({ lojas, onFechar }: { lojas: { id: string; nome: string }[]; onFechar: (m?: { t: string; ok: boolean }) => void }) {
  const [codigo, setCodigo] = useState(""), [tipo, setTipo] = useState<Tipo>("percentual"), [valor, setValor] = useState(""), [minimo, setMinimo] = useState(""), [validade, setValidade] = useState("")
  const [sel, setSel] = useState<string[]>([]), [buscaL, setBuscaL] = useState("")
  const [end, setEnd] = useState(""), [centro, setCentro] = useState<{ lat: number; lng: number; display: string } | null>(null), [raio, setRaio] = useState("")
  const [env, setEnv] = useState(false), [erro, setErro] = useState("")
  const [usos, setUsos] = useState(""), [confirmou, setConfirmou] = useState(false)
  const dinheiro = tipo === "fixo"
  const v = dinheiro ? paraNum(valor) : Number(valor.replace(",", "."))
  const minNum = paraNum(minimo)
  const pesado = dinheiro && v > 0 && (minNum <= 0 || v / minNum > 0.2)
  const resumo = tipo === "frete_gratis" ? "Frete grátis" : !(v > 0) ? "" : dinheiro
    ? `Desconto de ${R(v)}${minNum > 0 ? ` num pedido de ${R(minNum)}: ${Math.round(v / minNum * 100)}% do pedido mínimo` : ", sem pedido mínimo"}`
    : `${String(valor).replace(".", ",")}% de desconto${minNum > 0 ? `, ${R(minNum * v / 100)} num pedido de ${R(minNum)}` : ""}`
  async function buscarCentro() {
    setErro(""); setCentro(null)
    const r = await fetch(`/api/geocode/search?q=${encodeURIComponent(end.trim())}&lat=-16.9214&lon=-49.4497`).then(r => r.json()).catch(() => [])
    if (!r?.[0]) { setErro("Endereço não encontrado."); return }
    setCentro({ lat: parseFloat(r[0].lat), lng: parseFloat(r[0].lon), display: r[0].display_name })
  }
  async function salvar() {
    if (!codigo.trim()) { setErro("Dê um código ao cupom."); return }
    if (tipo !== "frete_gratis" && !(v > 0)) { setErro("Informe o valor do desconto."); return }
    if ((tipo === "percentual" || tipo === "frete_percentual") && v > 100) { setErro("Percentual vai até 100."); return }
    if (raio && !centro) { setErro("Busque o endereço do centro do raio."); return }
    // Trava do VOLTAGEMERSON (31/10/2026): R$ 10 fixo num mínimo de R$ 30, sem limite de uso,
    // passou sem ninguém perceber. Desconto em reais acima de 20% do mínimo pede um 2º clique.
    if (pesado && !confirmou) { setConfirmou(true); return }
    setEnv(true); setErro("")
    const r = await fetch("/api/admin/cupons", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo, tipo, valor: tipo === "frete_gratis" ? 0 : v, pedido_minimo: paraNum(minimo), validade: validade || null, lojas_ids: sel.length ? sel : null, centro_lat: centro && raio ? centro.lat : null, centro_lng: centro && raio ? centro.lng : null, raio_km: centro && raio ? Number(raio.replace(",", ".")) : null, max_usos: usos ? Number(usos) : null }) })
    const j = await r.json().catch(() => ({})); setEnv(false)
    if (!r.ok) { setErro(String(j.error ?? "").includes("unique") ? "Já existe um cupom com esse código." : j.error ?? "Não deu certo."); return }
    onFechar({ t: `Cupom ${codigo.toUpperCase()} criado e já vale no app.`, ok: true })
  }
  const filtradas = lojas.filter(l => !buscaL.trim() || l.nome.toLowerCase().includes(buscaL.trim().toLowerCase()))
  return (
    <div className="veu on" onClick={() => !env && onFechar()}>
      <div className="busca-caixa mv-form" onClick={e => e.stopPropagation()}>
        <div className="t20" style={{ marginBottom: 4 }}>Criar cupom do Chegô</div>
        <p className="t14 mut" style={{ marginBottom: 12 }}>O desconto sai do lucro do app, não da loja.</p>
        <label className="campo"><span>Código</span><input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="Ex.: VOLTA10" /></label>
        <div className="chips-l" style={{ marginBottom: 12 }}>{(Object.keys(TIPO) as Tipo[]).map(k => <button key={k} className="chip" aria-pressed={tipo === k} onClick={() => { setTipo(k); setValor(""); setConfirmou(false) }}>{TIPO[k]}</button>)}</div>
        <div className="mv-grade">
          {tipo !== "frete_gratis" && <label className="campo"><span>{dinheiro ? "Desconto em reais" : "Percentual"}</span><input inputMode="numeric" value={valor} onChange={e => { setValor(dinheiro ? mascara(e.target.value) : e.target.value.replace(/[^\d,]/g, "").slice(0, 5)); setConfirmou(false) }} placeholder={dinheiro ? "R$ 0,00" : "Ex.: 10"} /></label>}
          <label className="campo"><span>Pedido mínimo</span><input inputMode="numeric" value={minimo} onChange={e => { setMinimo(mascara(e.target.value)); setConfirmou(false) }} placeholder="Sem mínimo" /></label>
          <label className="campo"><span>Vale até</span><input type="date" value={validade} onChange={e => setValidade(e.target.value)} /></label>
          <label className="campo"><span>Limite de usos</span><input inputMode="numeric" value={usos} onChange={e => { setUsos(e.target.value.replace(/\D/g, "").slice(0, 5)); setConfirmou(false) }} placeholder="Sem limite" /></label>
        </div>
        {resumo && <p className="t14" style={{ margin: "0 0 12px" }}><b>{resumo}</b>. {usos ? `Pode ser usado ${usos} ${usos === "1" ? "vez" : "vezes"}.` : "Sem limite de usos: qualquer cliente pode usar quantas vezes quiser."}</p>}
        <div className="gav-sec" style={{ marginTop: 0 }}><small>Lojas (nenhuma marcada = vale em todas)</small>
          <input className="pd-busca" style={{ width: "100%", height: 40 }} placeholder="Buscar loja" value={buscaL} onChange={e => setBuscaL(e.target.value)} />
          <div className="chips-l cp-lojas">{filtradas.map(l => <button key={l.id} className="chip" aria-pressed={sel.includes(l.id)} onClick={() => setSel(s => s.includes(l.id) ? s.filter(x => x !== l.id) : [...s, l.id])}>{l.nome}</button>)}</div>
          {sel.length > 0 && <span className="t12 mut">{sel.length} {sel.length === 1 ? "loja marcada" : "lojas marcadas"}</span>}
        </div>
        <div className="gav-sec"><small>Só perto de um lugar (opcional)</small>
          <div className="lin" style={{ gap: 8 }}><input className="pd-busca" style={{ flex: 1, width: "auto", height: 42 }} placeholder="Endereço do centro" value={end} onChange={e => setEnd(e.target.value)} /><button className="btn btn-s" style={{ minHeight: 42 }} onClick={buscarCentro} disabled={!end.trim()}>Buscar</button></div>
          {centro && <span className="t12" style={{ color: "var(--folha)" }}>{centro.display}</span>}
          <input className="pd-busca" style={{ width: 160, height: 42 }} inputMode="decimal" placeholder="Raio em km" value={raio} onChange={e => setRaio(e.target.value.replace(/[^\d,]/g, "").slice(0, 4))} />
        </div>
        {erro && <div className="aviso vm" style={{ marginBottom: 10 }}>{erro}</div>}
        {confirmou && pesado && <div className="aviso vm" style={{ marginBottom: 10 }}>Desconto alto: {resumo}. {usos ? "" : "E sem limite de usos. "}Confira o valor e toque em Criar mesmo assim.</div>}
        <div className="lin" style={{ gap: 8 }}><button className="btn btn-s" style={{ flex: 1 }} disabled={env} onClick={() => onFechar()}>Voltar</button><button className="btn btn-p" style={{ flex: 2 }} disabled={env} onClick={salvar}>{env ? "Criando…" : confirmou && pesado ? "Criar mesmo assim" : "Criar cupom"}</button></div>
      </div>
    </div>
  )
}
