"use client"

// Taxas e frete (admin 2.0, 20/10/2026). Tudo que define quanto o cliente paga de entrega e quanto a
// loja paga ao Chegô. Só o Chegô muda (as lojas não editam). Dados e gravação em /api/admin/taxas.
import { Fragment, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { R } from "../_dinheiro"

type Loja = { id: string; nome: string; logo_url: string | null; status: string; taxa_entrega: number | null; comissao: number | null; participacao_entrega: number | null; plano: string | null; plano_mensalidade: number | null }
type Frete = { id: string; loja_id: string; municipio: string; taxa: number; tipo: string }
const mascara = (v: string) => { const d = v.replace(/\D/g, "").replace(/^0+/, "").slice(0, 7); return d ? (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "" }
const reais = (n: number | null | undefined) => mascara(String(Math.round(Number(n ?? 0) * 100)))
const paraNum = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0

export default function TaxasPage() {
  const [lojas, setLojas] = useState<Loja[]>([])
  const [frete, setFrete] = useState<Frete[]>([])
  const [carregou, setCarregou] = useState(false)
  const [aba, setAba] = useState<"municipios" | "lojas" | "regras">("municipios")
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)
  const [ed, setEd] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const [novo, setNovo] = useState({ municipio: "", taxa: "" })

  async function load() { const r = await fetch("/api/admin/taxas", { credentials: "include" }); const j = await r.json().catch(() => ({})); setLojas((j.lojas ?? []).map((l: any) => ({ ...l, taxa_entrega: l.taxa_entrega == null ? null : Number(l.taxa_entrega), comissao: Number(l.comissao ?? 0), participacao_entrega: Number(l.participacao_entrega ?? 0), plano_mensalidade: Number(l.plano_mensalidade ?? 0) }))); setFrete((j.frete ?? []).map((f: any) => ({ ...f, taxa: Number(f.taxa) }))); setCarregou(true) }
  useEffect(() => { load() }, [])
  async function post(chave: string, body: object, ok: string) {
    setOcupado(chave); setMsg(null)
    const r = await fetch("/api/admin/taxas", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({})); setOcupado(null)
    if (!r.ok) { setMsg({ t: j.error ?? "Não deu certo.", ok: false }); return false }
    setMsg({ t: ok.replace("{n}", String(j.alteradas ?? "")), ok: true }); await load(); return true
  }

  const ativas = lojas.filter(l => l.status === "ativo")
  const munis = useMemo(() => {
    const m = new Map<string, Frete[]>(); for (const f of frete) { const k = f.municipio; (m.get(k) ?? m.set(k, []).get(k)!).push(f) }
    return [...m.entries()].map(([nome, fs]) => { const vals = fs.map(f => f.taxa); const cont = new Map<number, number>(); vals.forEach(v => cont.set(v, (cont.get(v) ?? 0) + 1)); const comum = [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
      return { nome, fs, comum, min: Math.min(...vals), max: Math.max(...vals), diferentes: fs.filter(f => f.taxa !== comum) } }).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [frete])
  const taxasBase = ativas.map(l => Number(l.taxa_entrega ?? 0)).sort((a, b) => a - b), comumBase = taxasBase[Math.floor(taxasBase.length / 2)] ?? 0
  const nomeLoja = (id: string) => lojas.find(l => l.id === id)?.nome ?? "Loja"

  if (!carregou) return <p className="mut">Carregando…</p>
  return (
    <>
      <div className="kpis4">
        <div className="cartao kpi2"><small>Taxa base mais comum</small><b className="num">{R(comumBase)}</b><span className="t14 mut">{ativas.filter(l => Math.abs(Number(l.taxa_entrega ?? 0) - comumBase) >= 3).length} lojas fora do padrão</span></div>
        <div className="cartao kpi2"><small>Municípios atendidos</small><b className="num">{munis.length}</b><span className="t14 mut">com frete fixo por cidade</span></div>
        <div className="cartao kpi2"><small>Comissão mais comum</small><b className="num">{(() => { const c = new Map<number, number>(); ativas.forEach(l => c.set(Number(l.comissao), (c.get(Number(l.comissao)) ?? 0) + 1)); return `${[...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0}%` })()}</b><span className="t14 mut">sobre os produtos</span></div>
        <div className="cartao kpi2"><small>Ganho mínimo do motoboy</small><b className="num">R$ 4,00</b><span className="t14 mut">por entrega; o Chegô completa</span></div>
      </div>
      {msg && <div className={`aviso ${msg.ok ? "vd" : "vm"}`} role="status" style={{ marginBottom: 10 }}>{msg.t}</div>}
      <div className="abas-l"><button aria-pressed={aba === "municipios"} onClick={() => setAba("municipios")}>Frete por município</button><button aria-pressed={aba === "lojas"} onClick={() => setAba("lojas")}>Cada loja</button><button aria-pressed={aba === "regras"} onClick={() => setAba("regras")}>Como o frete é calculado</button></div>

      {aba === "municipios" && <>
        <p className="t14 mut" style={{ marginBottom: 10 }}>Pra cidades vizinhas o frete é fixo por município. Mudar aqui vale pra todas as lojas que já atendem a cidade. Toque na cidade pra ver loja por loja.</p>
        <div className="cartao" style={{ padding: 6, overflow: "auto" }}><table className="tabela">
          <thead><tr><th>Município</th><th>Lojas</th><th>Frete</th><th style={{ textAlign: "right" }}>Mudar pra todas</th></tr></thead>
          <tbody>{munis.map(m => { const k = `m:${m.nome}`; return (
            <Fragment key={m.nome}>
              <tr><td style={{ cursor: "pointer" }} onClick={() => setAberta(aberta === m.nome ? null : m.nome)}><b>{m.nome}</b>{m.diferentes.length > 0 && <small className="pd-atr">{m.diferentes.length} loja{m.diferentes.length > 1 ? "s" : ""} com valor diferente</small>}</td>
                <td className="num">{m.fs.length}</td>
                <td className="num"><b>{R(m.comum)}</b>{m.min !== m.max && <small className="lj-sub">de {R(m.min)} a {R(m.max)}</small>}</td>
                <td style={{ textAlign: "right" }}><span className="lin" style={{ gap: 6, justifyContent: "flex-end" }}><input className="pd-busca" style={{ width: 110, height: 38 }} inputMode="numeric" value={ed[k] ?? reais(m.comum)} onChange={e => setEd({ ...ed, [k]: mascara(e.target.value) })} />
                  <button className="btn btn-g" style={{ minHeight: 38, fontSize: 14 }} disabled={ocupado === k || paraNum(ed[k] ?? reais(m.comum)) === m.comum && !m.diferentes.length} onClick={() => { const v = paraNum(ed[k] ?? reais(m.comum)); if (confirm(`Frete pra ${m.nome} vai ser ${R(v)} em ${m.fs.length} lojas. Confirma?`)) post(k, { acao: "municipio", municipio: m.nome, taxa: v }, `${m.nome}: ${R(v)} em {n} lojas.`) }}>{ocupado === k ? "…" : "Aplicar"}</button></span></td></tr>
              {aberta === m.nome && <tr className="sub"><td colSpan={4}><div className="tx-lojas">{m.fs.map(f => { const kk = `f:${f.id}`; return (
                <div key={f.id} className="lj-dado"><span>{nomeLoja(f.loja_id)}</span><span className="lin" style={{ gap: 6 }}><input className="pd-busca" style={{ width: 100, height: 34 }} inputMode="numeric" value={ed[kk] ?? reais(f.taxa)} onChange={e => setEd({ ...ed, [kk]: mascara(e.target.value) })} />
                  <button className="btn btn-s" style={{ minHeight: 34, fontSize: 13, padding: "0 10px" }} disabled={ocupado === kk || paraNum(ed[kk] ?? reais(f.taxa)) === f.taxa} onClick={() => post(kk, { acao: "municipio", municipio: m.nome, taxa: paraNum(ed[kk] ?? ""), loja_id: f.loja_id }, `${nomeLoja(f.loja_id)} em ${m.nome}: ${R(paraNum(ed[kk] ?? ""))}.`)}>Salvar</button></span></div>) })}</div></td></tr>}
            </Fragment>) })}
            {!munis.length && <tr><td colSpan={4} className="vazio">Nenhum município com frete fixo.</td></tr>}
          </tbody></table></div>
        <div className="cartao" style={{ padding: 14, marginTop: 12 }}><b className="t16b">Atender uma cidade nova</b><p className="t14 mut" style={{ margin: "2px 0 8px" }}>Passa a valer em todas as lojas ativas que ainda não atendem lá.</p>
          <div className="lin" style={{ gap: 8, flexWrap: "wrap" }}><input className="pd-busca" style={{ flex: "1 1 200px" }} placeholder="Nome do município" value={novo.municipio} onChange={e => setNovo({ ...novo, municipio: e.target.value })} />
            <input className="pd-busca" style={{ width: 130 }} inputMode="numeric" placeholder="R$ 0,00" value={novo.taxa} onChange={e => setNovo({ ...novo, taxa: mascara(e.target.value) })} />
            <button className="btn btn-p" style={{ minHeight: 44 }} disabled={!novo.municipio.trim() || !paraNum(novo.taxa) || ocupado === "novo"} onClick={async () => { if (confirm(`Atender ${novo.municipio.trim()} com frete de ${R(paraNum(novo.taxa))} em todas as lojas ativas?`) && await post("novo", { acao: "adicionar_municipio", municipio: novo.municipio.trim(), taxa: paraNum(novo.taxa) }, `${novo.municipio.trim()} adicionado em {n} lojas.`)) setNovo({ municipio: "", taxa: "" }) }}>Adicionar</button></div></div>
      </>}

      {aba === "lojas" && <div className="cartao" style={{ padding: 6, overflow: "auto" }}><table className="tabela">
        <thead><tr><th>Loja</th><th>Taxa base</th><th>Comissão %</th><th className="esconde-cel">R$ por entrega</th><th className="esconde-cel">Mensalidade</th><th /></tr></thead>
        <tbody>{ativas.map(l => { const k = (c: string) => `${l.id}:${c}`, val = (c: string, def: string) => ed[k(c)] ?? def
          const mudou = val("taxa", reais(l.taxa_entrega)) !== reais(l.taxa_entrega) || val("com", String(l.comissao)) !== String(l.comissao) || val("part", reais(l.participacao_entrega)) !== reais(l.participacao_entrega) || val("mens", reais(l.plano_mensalidade)) !== reais(l.plano_mensalidade)
          const fora = Math.abs(Number(l.taxa_entrega ?? 0) - comumBase) >= 3
          return (
          <tr key={l.id}><td><span className="lin" style={{ gap: 8 }}>{l.logo_url ? <img src={l.logo_url} alt="" className="lj-logo" /> : <span className="lj-logo">{l.nome[0]}</span>}<b>{l.nome}</b></span></td>
            <td><input className={`pd-busca tx-in ${fora ? "fora" : ""}`} inputMode="numeric" value={val("taxa", reais(l.taxa_entrega))} onChange={e => setEd({ ...ed, [k("taxa")]: mascara(e.target.value) })} title={fora ? `Fora do padrão (${R(comumBase)})` : undefined} /></td>
            <td><input className="pd-busca tx-in" style={{ width: 70 }} inputMode="decimal" value={val("com", String(l.comissao))} onChange={e => setEd({ ...ed, [k("com")]: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) })} /></td>
            <td className="esconde-cel"><input className="pd-busca tx-in" inputMode="numeric" value={val("part", reais(l.participacao_entrega))} onChange={e => setEd({ ...ed, [k("part")]: mascara(e.target.value) })} /></td>
            <td className="esconde-cel"><input className="pd-busca tx-in" inputMode="numeric" value={val("mens", reais(l.plano_mensalidade))} onChange={e => setEd({ ...ed, [k("mens")]: mascara(e.target.value) })} /></td>
            <td style={{ textAlign: "right" }}>{mudou && <button className="btn btn-g" style={{ minHeight: 38, fontSize: 14 }} disabled={ocupado === l.id} onClick={async () => {
              const body = { acao: "loja", loja_id: l.id, taxa_entrega: paraNum(val("taxa", reais(l.taxa_entrega))), comissao: Number(val("com", String(l.comissao))), participacao_entrega: paraNum(val("part", reais(l.participacao_entrega))), plano_mensalidade: paraNum(val("mens", reais(l.plano_mensalidade))) }
              if (!confirm(`Salvar ${l.nome}: taxa base ${R(body.taxa_entrega)}, comissão ${body.comissao}%, ${R(body.participacao_entrega)} por entrega, mensalidade ${R(body.plano_mensalidade)}? Vale pros próximos pedidos.`)) return
              if (await post(l.id, body, `${l.nome} salva.`)) setEd(e => Object.fromEntries(Object.entries(e).filter(([kk]) => !kk.startsWith(l.id))))
            }}>{ocupado === l.id ? "…" : "Salvar"}</button>}</td></tr>) })}</tbody></table>
        <p className="t12 mut" style={{ padding: "6px 10px" }}>Comissão é sobre os produtos. "R$ por entrega" é quanto a loja assume de cada entrega (ex.: R$ 1,00). Mudança vale só pros próximos pedidos; os já feitos não mudam. <Link href="/chego-ctrl/lojas" style={{ color: "var(--pimenta)" }}>Plano de cada loja fica em Lojas</Link>.</p></div>}

      {aba === "regras" && <div className="tx-regras">
        <div className="cartao"><b className="t16b">Ordem do cálculo do frete</b><ol>
          <li><b>Retirada na loja:</b> frete zero.</li><li><b>Frete fixo do cliente:</b> se o cliente tem, vale ele (em Clientes).</li>
          <li><b>Cidade vizinha:</b> o valor da tabela por município.</li><li><b>Na cidade:</b> pela distância da rota, a partir da taxa base da loja.</li>
          <li><b>Zona rural:</b> mais R$ 5,00. <b>Limite:</b> 30 km da loja.</li></ol></div>
        <div className="cartao"><b className="t16b">Taxas de pagamento cobradas da loja</b>
          <div className="lj-dado"><span>Pix no app</span><b>R$ 1,00 por pedido</b></div><div className="lj-dado"><span>Cartão no app</span><b>1,99% + R$ 0,49</b></div>
          <div className="lj-dado"><span>Maquininha (débito ou crédito)</span><b>3,08%</b></div><div className="lj-dado"><span>Dinheiro e Pix direto na loja</span><b>sem taxa</b></div>
          <p className="t12 mut" style={{ marginTop: 6 }}>Essas regras estão no código (lib/regrasFinanceiras.ts). Mudar exige ajuste no sistema.</p></div>
        <div className="cartao"><b className="t16b">Motoboy</b>
          <div className="lj-dado"><span>Ganho por entrega</span><b>a taxa de entrega</b></div><div className="lj-dado"><span>Mínimo garantido</span><b>R$ 4,00 (o Chegô completa)</b></div>
          <div className="lj-dado"><span>Dinheiro de cliente</span><b>fica com ele e é acertado</b></div></div>
      </div>}
    </>
  )
}
