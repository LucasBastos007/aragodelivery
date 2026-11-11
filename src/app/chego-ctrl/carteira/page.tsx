"use client"

// Carteira do admin 2.0 (20/10/2026, refeita a pedido do Lucas: "virar uma carteira mesmo"):
// 1) Saldo: quanto tem na conta do Asaas e de quem é (seu, das lojas, dos motoboys, reservado),
//    mais o que ainda vai cair do cartão.
// 2) Extrato: cada entrada e saída real da conta, com nome do pedido, da loja ou do motoboy.
// 3) A pagar: quanto cada loja e cada motoboy tem pra receber.
// 4) Resultado: quanto vendeu no período e pra onde foi cada real (a conta do app, pedido a pedido).
import { Fragment, Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import ConferenciaAsaas from "../_ConferenciaAsaas"
import { BarraDiv, Divisao, MEIOS, PARTES, R, dm, somaL, type Divisao as Div, type Linha } from "../_dinheiro"

type Dados = { de: string; ate: string; hoje: string; custoEstimado: boolean; linhas: Linha[]; divisao: Div | null; lojas: Record<string, { nome: string; logo: string | null }>; motoboys: Record<string, string> }
type Item = { id: string; data: string; tipo: string; grupo: "entrada" | "saida"; titulo: string; detalhe: string; valor: number; taxa: number; saldo: number; pedido?: string; comprovante?: { tipo: string; id: string } }
type Extrato = { itens: Item[]; saldoInicial: number | null; saldoFinal: number | null; entrou: number; saiu: number; taxas: number; aReceber: { n: number; liquido: number; proxima: string | null; porMes?: { mes: string; n: number; bruto: number; liquido: number }[] } | null }
const FN: Record<string, string> = { pix: "Pix", cartao: "Cartão no app", dinheiro: "Dinheiro", maquininha: "Maquininha", pix_loja: "Pix na loja" }
const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
const nomeMes = (ym: string) => MES[Number(ym.slice(5, 7)) - 1] ?? ym
const mascaraBrl = (v: string) => { const d = v.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9); return d ? (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "" }
const paraNumBrl = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0
const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const quando = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(",", " às") }
const nomeForma = (f: string) => f.split("+").map(x => FN[x] ?? x).join(" + ")
const soma = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const SEM = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
const PERS = [["hoje", "Hoje"], ["7d", "7 dias"], ["mes", "Este mês"], ["30d", "30 dias"], ["90d", "90 dias"]] as const
const ABAS = [["extrato", "Extrato"], ["pagar", "A pagar"], ["resultado", "Resultado"]] as const
const FILTROS = [["tudo", "Tudo"], ["entrada", "Entradas"], ["saida", "Saídas"], ["taxa", "Taxas"]] as const
const ehTaxa = (i: Item) => /_FEE$/.test(i.tipo)
const sinal = (v: number) => (v > 0 ? "+ " : v < 0 ? "− " : "") + R(Math.abs(v))
const nomeDia = (x: string, hoje: string) => x === hoje ? "Hoje" : x === soma(hoje, -1) ? "Ontem" : `${SEM[new Date(`${x}T12:00:00Z`).getUTCDay()]}, ${dm(x)}`
// Próxima sexta (dia do repasse das lojas)
const sexta = (hoje: string) => { const w = new Date(`${hoje}T12:00:00Z`).getUTCDay(); return soma(hoje, (5 - w + 7) % 7) }

function porMeio(ls: Linha[]) { const m: Record<string, { v: number; n: number }> = {}; for (const l of ls) for (const [k, v] of Object.entries(l.meios ?? {})) { (m[k] ??= { v: 0, n: 0 }); m[k].v += v; m[k].n++ } return m }
function ComoEntrou({ ls }: { ls: Linha[] }) {
  const m = porMeio(ls), tot = Object.values(m).reduce((t, x) => t + x.v, 0) || 1
  const lista = MEIOS.filter(x => m[x.k]?.v)
  if (!lista.length) return <p className="t14 mut">Nenhuma venda entregue.</p>
  return (
    <>
      <BarraDiv partes={lista.map(x => ({ n: x.n, v: m[x.k].v, cor: x.cor }))} />
      <div className="ct-meios">{lista.map(x => (
        <div key={x.k} className="ct-meio"><i style={{ background: x.cor }} /><span><b>{x.n}</b><small>{m[x.k].n} {m[x.k].n === 1 ? "pedido" : "pedidos"}, {x.quem}</small></span><b className="num">{R(m[x.k].v)}<small>{Math.round(m[x.k].v / tot * 100)}%</small></b></div>))}</div>
    </>
  )
}

function Carteira() {
  const sp = useSearchParams()
  const [per, setPer] = useState<string>(sp.get("per") ?? "7d")
  const [aba, setAba] = useState<string>(sp.get("aba") ?? "extrato")
  const [d, setD] = useState<Dados | null>(null)
  const [ex, setEx] = useState<Extrato | null>(null)
  const [erro, setErro] = useState(""), [erroEx, setErroEx] = useState("")
  const [filtro, setFiltro] = useState("tudo"), [busca, setBusca] = useState("")
  const [quem, setQuem] = useState<"lojas" | "motoboys">("lojas")
  const [parte, setParte] = useState<string | null>(null)
  const [grupo, setGrupo] = useState<string | null>(null)
  const [pedido, setPedido] = useState<Linha | null>(null)
  const [tonEd, setTonEd] = useState<{ saldo: string; aReceber: string } | null>(null)
  const [tonMsg, setTonMsg] = useState(""), [tonSalvando, setTonSalvando] = useState(false)
  const [mpEd, setMpEd] = useState<string | null>(null)

  useEffect(() => {
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
    const de = per === "hoje" ? hoje : per === "7d" ? soma(hoje, -6) : per === "mes" ? hoje.slice(0, 8) + "01" : per === "30d" ? soma(hoje, -29) : soma(hoje, -89)
    setErro(""); setErroEx(""); setParte(null); setGrupo(null); setEx(null)
    fetch(`/api/admin/carteira?de=${de}&ate=${hoje}`, { credentials: "include" }).then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j.error))).then(setD).catch(e => setErro(String(e ?? "Erro ao carregar")))
    fetch(`/api/admin/carteira-extrato?de=${de}&ate=${hoje}`, { credentials: "include" }).then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j.error))).then(setEx).catch(e => setErroEx(String(e ?? "Não foi possível ler o extrato do Asaas.")))
  }, [per])

  const L = d?.linhas ?? []
  const tot = useMemo(() => ({ vendido: somaL(L, l => l.pago), app: somaL(L, l => l.app), custo: somaL(L, l => l.custo), loja: somaL(L, l => l.loja), mb: somaL(L, l => l.mb) }), [L])
  const itens = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return (ex?.itens ?? []).filter(i => filtro === "tudo" ? true : filtro === "taxa" ? ehTaxa(i) || i.taxa > 0 : filtro === "saida" ? i.grupo === "saida" && !ehTaxa(i) : i.grupo === filtro)
      .filter(i => !q || `${i.titulo} ${i.detalhe}`.toLowerCase().includes(q))
  }, [ex, filtro, busca])
  const dias = useMemo(() => { const m: { x: string; is: Item[] }[] = []; for (const i of itens) { const u = m[m.length - 1]; if (u?.x === i.data) u.is.push(i); else m.push({ x: i.data, is: [i] }) } return m }, [itens])

  async function salvarTon() {
    if (!tonEd || !d) return
    setTonSalvando(true); setTonMsg("")
    try {
      const r = await fetch("/api/admin/carteira", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saldo: paraNumBrl(tonEd.saldo), aReceber: paraNumBrl(tonEd.aReceber) }) })
      const j = await r.json(); if (!r.ok) throw new Error(j.error)
      const dv0 = d.divisao!, antes = dv0.ton?.saldo ?? 0, delta = (j.ton?.saldo ?? 0) - antes
      setD({ ...d, divisao: { ...dv0, ton: j.ton, total: Math.round((dv0.total + delta) * 100) / 100, app: Math.round((dv0.app + delta) * 100) / 100 } }); setTonEd(null)
    } catch (e: any) { setTonMsg(e?.message || "Não foi possível salvar.") } finally { setTonSalvando(false) }
  }

  async function salvarMp() {
    if (mpEd == null || !d) return
    setTonSalvando(true); setTonMsg("")
    try {
      const r = await fetch("/api/admin/carteira", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conta: "mp", saldo: paraNumBrl(mpEd) }) })
      const j = await r.json(); if (!r.ok) throw new Error(j.error)
      const dv0 = d.divisao!, delta = (j.mp?.saldo ?? 0) - (dv0.mp?.saldo ?? 0)
      setD({ ...d, divisao: { ...dv0, mp: j.mp, total: Math.round((dv0.total + delta) * 100) / 100, app: Math.round((dv0.app + delta) * 100) / 100 } }); setMpEd(null)
    } catch (e: any) { setTonMsg(e?.message || "Não foi possível salvar.") } finally { setTonSalvando(false) }
  }

  if (!d) return <p className="mut">{erro || "Carregando…"}</p>
  const dv = d.divisao
  const nomeLoja = (id: string) => d.lojas[id]?.nome ?? "Loja"
  const naoESeu = dv ? dv.lojas + dv.motoboys + dv.reservado : 0
  const sx = sexta(d.hoje)
  const fecha = ex && ex.saldoInicial != null && ex.saldoFinal != null && Math.abs(ex.saldoInicial + ex.entrou - ex.saiu - ex.taxas - ex.saldoFinal) < 0.02

  const grupos = (() => {
    if (!parte) return []
    const por = (chave: (l: Linha) => string) => Object.values(L.reduce((a: Record<string, { g: string; ls: Linha[] }>, l) => { const g = chave(l); (a[g] ??= { g, ls: [] }).ls.push(l); return a }, {}))
    if (parte === "loja") return por(l => l.loja_id).map(x => ({ ...x, rot: nomeLoja(x.g), logo: d.lojas[x.g]?.logo, a: somaL(x.ls, l => l.produtos), b: somaL(x.ls, l => l.comissao + l.taxaLoja + l.cupomLoja), c: somaL(x.ls, l => l.loja), cols: ["Produtos", "Comissão, taxa e cupom", "Recebe"] }))
    if (parte === "mb") return por(l => l.motoboy_id ?? "sem").map(x => ({ ...x, rot: x.g === "sem" ? "Sem motoboy (retirada)" : d.motoboys[x.g] ?? "Motoboy", logo: null, a: somaL(x.ls, l => l.entrega), b: somaL(x.ls, l => l.mb - l.entrega), c: somaL(x.ls, l => l.mb), cols: ["Taxas de entrega", "Complemento do piso", "Recebe"] }))
    if (parte === "custo") return por(l => l.forma).map(x => ({ ...x, rot: nomeForma(x.g), logo: null, a: somaL(x.ls, l => l.pago), b: somaL(x.ls, l => l.taxaLoja), c: somaL(x.ls, l => l.custo), cols: ["Pago pelos clientes", "Cobrado das lojas", "Custo pro Chegô"] }))
    const fontes: [string, (l: Linha) => number][] = [["Comissão das lojas", l => l.comissao], ["Taxas cobradas das lojas", l => l.taxaLoja], ["Parte da entrega", l => Math.max(0, l.entrega - l.mb)], ["Complemento do piso dos motoboys", l => -Math.max(0, l.mb - l.entrega)], ["Custo do Asaas e da maquininha", l => -l.custo], ["Cupons pagos pelo Chegô", l => -l.cupomChego]]
    return fontes.map(([n, f]) => ({ g: n, ls: L.filter(l => Math.abs(f(l)) > 0.004), rot: n, logo: null, a: 0, b: 0, c: somaL(L, f), cols: ["", "", "Valor"] }))
  })().sort((a, b) => Math.abs(b.c) - Math.abs(a.c))

  return (
    <>
      {/* 1. Saldo: Asaas + Ton + Mercado Pago + dinheiro com os motoboys */}
      <section className="cw-topo">
        <div className="cw-saldo">
          <span className="cw-rot">Dinheiro do Chegô agora</span>
          <b className="num cw-valor">{dv?.lido ? R(dv.total) : "–"}</b>
          {dv?.lido ? <>
            <div className="cw-contas">
              <div><span className="cw-marca"><img src="/marcas/asaas.png" alt="" />Conta do Asaas</span><b className="num">{R(dv.asaas ?? dv.total)}</b></div>
              <div><span className="cw-marca"><img src="/marcas/ton.png" alt="" />Conta da Ton{dv.ton?.vendas ? ", estimado" : ""}</span><b className="num">{dv.ton ? R(dv.ton.saldo) : "–"}</b>{dv.ton && <small>{dv.ton.vendas ? `digitado ${quando(dv.ton.em)} + ${dv.ton.vendas} ${dv.ton.vendas === 1 ? "venda" : "vendas"} na maquininha depois` : `digitado ${quando(dv.ton.em)}, sem venda na maquininha depois`}</small>}
                <button className="cw-ed" onClick={() => { setTonMsg(""); setMpEd(null); setTonEd({ saldo: "", aReceber: "" }) }}>{dv.ton ? "Corrigir com o valor da Ton" : "Digitar o saldo"}</button></div>
              {dv.mp && <div><span className="cw-marca"><img src="/marcas/mercadopago.svg" alt="" />Conta do Mercado Pago{dv.mp.vendas && !dv.mp.daConta ? ", estimado" : ""}</span><b className="num">{R(dv.mp.saldo)}</b><small>{dv.mp.daConta ? `lido da conta ${quando(dv.mp.em ?? "")}${dv.mp.vendas ? ` + ${dv.mp.vendas} Pix depois` : ""}` : dv.mp.em ? `digitado ${quando(dv.mp.em)}${dv.mp.vendas ? ` + ${dv.mp.vendas} Pix depois` : ", sem Pix depois"}` : `${dv.mp.vendas} Pix recebidos, sem a taxa de 0,99%`}</small>
                <button className="cw-ed" onClick={() => { setTonMsg(""); setTonEd(null); setMpEd("") }}>Corrigir com o valor do Mercado Pago</button></div>}
              <div><span>Dinheiro com os motoboys</span><b className="num">{R(dv.dinheiro ?? 0)}</b><small>{(dv.porDinheiro ?? []).length ? `${dv.porDinheiro!.length} ${dv.porDinheiro!.length === 1 ? "motoboy ainda não prestou" : "motoboys ainda não prestaram"} conta` : "nada pra prestar conta"}</small></div>
            </div>
            {tonEd && <div className="cw-ton">
              <label className="campo"><span>Saldo na Ton</span><input inputMode="numeric" value={tonEd.saldo} onChange={e => setTonEd({ ...tonEd, saldo: mascaraBrl(e.target.value) })} placeholder="0,00" autoFocus /></label>
              <label className="campo"><span>Ton a receber</span><input inputMode="numeric" value={tonEd.aReceber} onChange={e => setTonEd({ ...tonEd, aReceber: mascaraBrl(e.target.value) })} placeholder="0,00" /></label>
              <button className="btn btn-p" disabled={tonSalvando || !tonEd.saldo} onClick={salvarTon}>{tonSalvando ? "Salvando…" : "Salvar"}</button>
              <button className="btn btn-l" onClick={() => setTonEd(null)}>Cancelar</button>
              {tonMsg && <p className="cw-ton-msg">{tonMsg}</p>}
              <small>Copie do app da Ton o saldo disponível e o "a receber". Daqui pra frente o painel soma sozinho as vendas na maquininha (sem a taxa de 1,32%, liberadas no dia seguinte). Corrija quando tirar dinheiro da Ton.</small>
            </div>}
            {mpEd != null && <div className="cw-ton">
              <label className="campo"><span>Saldo no Mercado Pago</span><input inputMode="numeric" value={mpEd} onChange={e => setMpEd(mascaraBrl(e.target.value))} placeholder="0,00" autoFocus /></label>
              <button className="btn btn-p" disabled={tonSalvando || !mpEd} onClick={salvarMp}>{tonSalvando ? "Salvando…" : "Salvar"}</button>
              <button className="btn btn-l" onClick={() => setMpEd(null)}>Cancelar</button>
              {tonMsg && <p className="cw-ton-msg">{tonMsg}</p>}
              <small>Copie o saldo disponível do app do Mercado Pago. Daqui pra frente o painel soma sozinho os Pix pagos (sem a taxa de 0,99%). Corrija sempre que passar dinheiro do Mercado Pago pro Asaas.</small>
            </div>}
            <BarraDiv partes={[{ n: "Seu", v: Math.max(0, dv.app), cor: "var(--c-app)" }, { n: "Lojas", v: dv.lojas, cor: "var(--c-loja)" }, { n: "Motoboys", v: dv.motoboys, cor: "var(--c-mb)" }, { n: "Reservado", v: dv.reservado, cor: "var(--c-res)" }]} />
            <div className="cw-div">
              <div className="cw-seu"><span><i style={{ background: "var(--c-app)" }} />É seu, pode usar</span><b className="num" style={{ color: dv.app < 0 ? "#FF8A7A" : undefined }}>{R(dv.app)}</b></div>
              <div><span><i style={{ background: "var(--c-loja)" }} />Das lojas</span><b className="num">{R(dv.lojas)}</b></div>
              <div><span><i style={{ background: "var(--c-mb)" }} />Dos motoboys</span><b className="num">{R(dv.motoboys)}</b></div>
              <div><span><i style={{ background: "var(--c-res)" }} />Reservado</span><b className="num">{R(dv.reservado)}</b></div>
            </div>
          </> : <p className="cw-sub">O Asaas não respondeu agora. Tente de novo em instantes.</p>}
          <Link href="/chego-ctrl/faturamento" className="btn btn-p cw-pagar">Pagar lojas e motoboys</Link>
        </div>
        <div className="cw-lado">
          <div className="cartao cw-mini"><span>Ainda vai cair</span><b className="num">{ex?.aReceber || dv?.ton ? R((ex?.aReceber?.liquido ?? 0) + (dv?.ton?.aReceber ?? 0)) : "–"}</b>
            <div className="cw-cai">
              <div><span>Cartão no app (Asaas)</span><b className="num">{ex?.aReceber ? R(ex.aReceber.liquido) : erroEx ? "não respondeu" : "lendo…"}</b></div>
              {(ex?.aReceber?.porMes ?? []).map(m => <div key={m.mes} className="sub"><span>cai em {nomeMes(m.mes)}, {m.n} {m.n === 1 ? "pagamento" : "pagamentos"} (bruto {R(m.bruto)})</span><b className="num">{R(m.liquido)}</b></div>)}
              <div><span>Maquininha (Ton)</span><b className="num">{dv?.ton ? R(dv.ton.aReceber) : "–"}</b></div>
            </div>
            <small>Cartão já sem a taxa do Asaas.{ex?.aReceber?.proxima ? ` O próximo cai ${dm(ex.aReceber.proxima)}.` : ""}</small></div>
          <div className="cartao cw-mini"><span>Não é seu</span><b className="num">{dv ? R(naoESeu) : "–"}</b><small>lojas recebem {sx === d.hoje ? "hoje" : `sexta, ${dm(sx)}`}; motoboys pelo saldo desde 16/10</small></div>
        </div>
      </section>
      {dv && dv.app < 0 && <div className="aviso vm" style={{ marginTop: 10 }}>O dinheiro de agora não cobre o que é das lojas e dos motoboys. Faltam {R(-dv.app)}{ex?.aReceber || dv.ton ? `; contando o que ainda vai cair, ${(dv.app + (ex?.aReceber?.liquido ?? 0) + (dv.ton?.aReceber ?? 0)) >= 0 ? "fica coberto" : `ainda faltam ${R(-(dv.app + (ex?.aReceber?.liquido ?? 0) + (dv.ton?.aReceber ?? 0)))}`}` : ""}.</div>}

      {/* Abas + período */}
      <div className="lin cw-barra">
        <div className="pd-vis" role="tablist">{ABAS.map(([k, n]) => <button key={k} role="tab" aria-pressed={aba === k} onClick={() => setAba(k)}>{n}</button>)}</div>
        {aba !== "pagar" && <span className="per-chips">{PERS.map(([k, n]) => <button key={k} aria-pressed={per === k} onClick={() => setPer(k)}>{n}</button>)}</span>}
      </div>

      {/* 2. Extrato */}
      {aba === "extrato" && (
        erroEx ? <div className="aviso vm">{erroEx}</div> : !ex ? <p className="mut">Lendo o extrato do Asaas…</p> : <>
          <div className="cw-res">
            <div className="cartao"><span>Saldo no início</span><b className="num">{ex.saldoInicial == null ? "–" : R(ex.saldoInicial)}</b></div>
            <div className="cartao"><span>Entrou</span><b className="num cw-mais">{sinal(ex.entrou)}</b></div>
            <div className="cartao"><span>Saiu</span><b className="num cw-menos">{sinal(-ex.saiu)}</b></div>
            <div className="cartao"><span>Taxas</span><b className="num cw-menos">{sinal(-ex.taxas)}</b></div>
            <div className="cartao"><span>Saldo no fim</span><b className="num">{ex.saldoFinal == null ? "–" : R(ex.saldoFinal)}</b></div>
          </div>
          {ex.saldoInicial != null && <p className={`t14 cw-fecha ${fecha ? "ok" : "nao"}`}>{fecha ? "A conta fecha: saldo do início + entradas − saídas − taxas dá o saldo do fim." : "A conta não fechou no período. Confira o extrato no Asaas."}</p>}

          <div className="cartao cw-ext">
            <div className="lin cw-filtros">
              <span className="per-chips">{FILTROS.map(([k, n]) => <button key={k} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{n}</button>)}</span>
              <input className="pd-sel cw-busca" placeholder="Buscar pedido, loja ou motoboy" value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            {dias.length === 0 ? <p className="vazio">{ex.itens.length ? "Nenhum lançamento com esse filtro." : "Nenhum lançamento na conta nesse período."}</p> : dias.map(({ x, is }) => (
              <div key={x} className="cw-dia">
                <div className="cw-dia-t"><b>{nomeDia(x, d.hoje)}</b><span className="num">saldo no fim do dia {R(is[0].saldo)}</span></div>
                {is.map(i => {
                  const tx = ehTaxa(i), liq = Math.round((i.valor - i.taxa) * 100) / 100
                  const conteudo = <>
                    <span className={`cw-ic ${tx ? "tx" : i.grupo}`} aria-hidden>{tx ? "%" : i.grupo === "entrada" ? "↓" : "↑"}</span>
                    <span className="cw-txt"><b>{i.titulo}</b><small>{[i.detalhe || (i.grupo === "entrada" ? "entrou direto na conta" : ""), i.taxa ? `taxa ${R(i.taxa)}, ficou ${R(liq)}` : ""].filter(Boolean).join(", ")}</small></span>
                    <span className="cw-val"><b className={`num ${i.valor >= 0 ? "cw-mais" : "cw-menos"}`}>{sinal(i.valor)}</b>{i.comprovante && <small className="cw-comp">Ver comprovante</small>}</span>
                  </>
                  return i.comprovante
                    ? <a key={i.id} className="cw-it" href={`/api/admin/comprovante?tipo=${i.comprovante.tipo}&id=${i.comprovante.id}`} target="_blank" rel="noreferrer">{conteudo}</a>
                    : i.pedido ? <Link key={i.id} className="cw-it" href={`/chego-ctrl/pedidos?codigo=${i.pedido}`}>{conteudo}</Link>
                    : <div key={i.id} className="cw-it">{conteudo}</div>
                })}
              </div>))}
          </div>
          <p className="t12 mut" style={{ marginTop: 6 }}>Este é o extrato real do Asaas. Dinheiro fica com o motoboy e maquininha cai na Ton, então não aparecem aqui; estão em Resultado.</p>
        </>
      )}

      {/* 3. A pagar */}
      {aba === "pagar" && dv && (
        <div className="cartao ct-rep">
          <div className="lin" style={{ flexWrap: "wrap", gap: 8 }}>
            <div className="pd-vis">{(["lojas", "motoboys"] as const).map(k => <button key={k} aria-pressed={quem === k} onClick={() => setQuem(k)}>{k === "lojas" ? `Lojas ${R(dv.lojas)}` : `Motoboys ${R(dv.motoboys)}`}</button>)}</div>
            <Link className="btn btn-p" style={{ marginLeft: "auto", minHeight: 40 }} href={quem === "lojas" ? "/chego-ctrl/faturamento" : "/chego-ctrl/repasses"}>{quem === "lojas" ? "Ir pra Repasses" : "Ir pra Pagamentos"}</Link>
          </div>
          <p className="t14 mut" style={{ margin: "10px 0 6px" }}>{quem === "lojas" ? `O que cada loja tem a receber desde 16/10, já sem repasses pagos e adiantamentos. O próximo repasse é ${sx === d.hoje ? "hoje" : `sexta, ${dm(sx)}`}.` : "O saldo de cada motoboy desde 16/10: entregas menos o que já recebeu. É a mesma conta da tela de Repasses."}</p>
          {(quem === "lojas" ? dv.porLoja ?? [] : dv.porMb ?? []).length === 0
            ? <p className="vazio">{quem === "lojas" ? "Nenhuma loja com saldo a receber." : "Nenhum motoboy com saldo a receber."}</p>
            : <div className="ct-rep-l">{(quem === "lojas" ? dv.porLoja! : dv.porMb!).map((x: any) => {
                const tt = quem === "lojas" ? dv.lojas : dv.motoboys
                return (
                  <div key={x.id} className="ct-rep-i">
                    {x.logo ? <img src={x.logo} alt="" /> : <span className="av" style={quem === "motoboys" ? { borderRadius: "50%", background: "var(--roxo-claro)", color: "var(--roxo)" } : undefined}>{x.nome[0]}</span>}
                    <span className="nm"><b>{x.nome}</b><i style={{ width: `${tt ? x.v / tt * 100 : 0}%`, background: quem === "lojas" ? "var(--c-loja)" : "var(--c-mb)" }} /></span>
                    <b className="num">{R(x.v)}</b>
                  </div>)
              })}</div>}
          {dv.reservado > 0 && <p className="t14 mut" style={{ marginTop: 10 }}>Além disso, {R(dv.reservado)} estão separados pra reembolsos em análise. <Link href="/chego-ctrl?reembolsos=1" style={{ color: "var(--pimenta)", fontWeight: 800 }}>Ver reembolsos</Link></p>}
        </div>
      )}

      {/* 4. Resultado */}
      {aba === "resultado" && <>
        <div className="ct-tot cw-tot">
          {([["Vendido", tot.vendido, "var(--grafite)", `${L.length} pedidos entregues`], ["Lucro do app", tot.app, "var(--c-app)", tot.vendido ? `${Math.round(tot.app / tot.vendido * 100)}% do vendido` : "–"],
            ["Lojistas", tot.loja, "var(--c-loja)", "já sem comissão e taxa"], ["Motoboys", tot.mb, "var(--c-mb)", "entregas com piso"], ["Taxas", tot.custo, "var(--c-res)", d.custoEstimado ? "Asaas e maquininha, estimado" : "Asaas e maquininha"]] as [string, number, string, string][]).map(([n, v, c, s]) => (
            <div key={n} className="cartao ct-t"><span><i style={{ background: c }} />{n}</span><b className="num">{R(v)}</b><small>{s}</small></div>))}
        </div>

        <div className="cartao" style={{ padding: 18, marginTop: 12 }}>
          <div className="t20" style={{ marginBottom: 6 }}>Pra onde foi cada real</div>
          <Divisao linhas={L} sel={parte} onSel={k => { setParte(parte === k ? null : k); setGrupo(null) }} />
          {parte ? (
            <div className="parte-det">
              <div className="lin"><span className="t16b">{PARTES.find(p => p.k === parte)?.n}: quem recebeu</span><button className="btn btn-l" style={{ marginLeft: "auto" }} onClick={() => setParte(null)}>Fechar</button></div>
              <div style={{ overflow: "auto" }}><table className="tabela"><thead><tr><th>{parte === "loja" ? "Loja" : parte === "mb" ? "Motoboy" : parte === "custo" ? "Forma" : "De onde vem"}</th><th>Pedidos</th>{grupos[0]?.cols.map((c, i) => <th key={i} style={{ textAlign: "right" }}>{c}</th>)}</tr></thead>
                <tbody>{grupos.map(x => (
                  <Fragment key={x.g}>
                    <tr style={{ cursor: "pointer" }} onClick={() => setGrupo(grupo === x.g ? null : x.g)}><td><span className="lin">{x.logo ? <img src={x.logo} alt="" style={{ width: 26, height: 26, borderRadius: 7, objectFit: "cover" }} /> : null}<b>{x.rot}</b></span></td><td className="num">{x.ls.length}</td>
                      {x.cols[0] !== "" && <td className="num" style={{ textAlign: "right" }}>{R(x.a)}</td>}{x.cols[1] !== "" && <td className="num" style={{ textAlign: "right" }}>{R(x.b)}</td>}{x.cols[0] === "" && <><td /><td /></>}
                      <td className="num" style={{ textAlign: "right", fontWeight: 800, color: x.c < 0 ? "var(--pimenta-esc)" : undefined }}>{R(x.c)}</td></tr>
                    {grupo === x.g && <tr className="sub"><td colSpan={5}><div className="sub-l">{x.ls.slice(0, 60).map(l => <button key={l.id} onClick={() => setPedido(l)}><b>#{l.codigo}</b><span>{dm(l.dia)}, {nomeLoja(l.loja_id)}{l.motoboy_id ? `, ${d.motoboys[l.motoboy_id] ?? ""}` : ""}, {nomeForma(l.forma)}</span><b className="num">{R(l.pago)}</b></button>)}{x.ls.length > 60 && <p className="t12 mut">e mais {x.ls.length - 60} pedidos</p>}</div></td></tr>}
                  </Fragment>
                ))}</tbody></table></div>
            </div>
          ) : <p className="t14 mut" style={{ marginTop: 10 }}>Toque numa parte pra ver quem recebeu: cada loja, cada motoboy, cada forma de pagamento.</p>}
        </div>

        <div className="cartao" style={{ padding: 18, marginTop: 12 }}>
          <div className="t20" style={{ marginBottom: 8 }}>Como os clientes pagaram</div>
          <ComoEntrou ls={L} />
          <p className="t12 mut" style={{ marginTop: 10 }}>Pix e cartão no app caem no Asaas; dinheiro fica com o motoboy; maquininha cai na Ton. O dia a dia está no <Link href="/chego-ctrl/visao-financeira" style={{ color: "var(--pimenta)", fontWeight: 800 }}>Fechamento diário</Link>.</p>
        </div>

        <ConferenciaAsaas key={`${d.de}-${d.ate}`} de={d.de} ate={d.ate} />
        {d.custoEstimado && <p className="t12 mut" style={{ marginTop: 6 }}>Taxas estimadas (Pix R$ 0,99, cartão 2,99% + R$ 0,49, maquininha 1,99%) até confirmarmos o contrato. As taxas reais estão no Extrato.</p>}
      </>}

      {pedido && (
        <div className="veu on" onClick={() => setPedido(null)}>
          <div className="busca-caixa" onClick={e => e.stopPropagation()}>
            <div className="t20">Pedido #{pedido.codigo}</div><p className="t14 mut" style={{ margin: "4px 0 12px" }}>{dm(pedido.dia)}, {nomeForma(pedido.forma)}</p>
            <div className="cem"><span>Cliente pagou</span><b className="num">{R(pedido.pago)}</b></div>
            <p className="t12 mut">Produtos {R(pedido.produtos)} + entrega {R(pedido.entrega)}{pedido.cupomLoja ? ` − cupom da loja ${R(pedido.cupomLoja)}` : ""}{pedido.cupomChego ? ` − cupom do Chegô ${R(pedido.cupomChego)}` : ""}</p>
            <BarraDiv partes={[{ n: "Loja", v: pedido.loja, cor: "var(--c-loja)" }, { n: "Motoboy", v: pedido.mb, cor: "var(--c-mb)" }, { n: "Taxas", v: pedido.custo, cor: "var(--c-res)" }, { n: "App", v: Math.max(0, pedido.app), cor: "var(--c-app)" }]} />
            <div className="cem"><span><i style={{ background: "var(--c-loja)" }} />{nomeLoja(pedido.loja_id)}</span><b className="num">{R(pedido.loja)}</b></div>
            <p className="t12 mut">Produtos {R(pedido.produtos)} − comissão {R(pedido.comissao)} − taxa {R(pedido.taxaLoja)}{pedido.cupomLoja ? ` − cupom ${R(pedido.cupomLoja)}` : ""}{pedido.recebidoLoja ? `. ${R(pedido.recebidoLoja)} ela já recebeu no balcão.` : ""}</p>
            <div className="cem"><span><i style={{ background: "var(--c-mb)" }} />{pedido.motoboy_id ? d.motoboys[pedido.motoboy_id] ?? "Motoboy" : "Sem motoboy"}</span><b className="num">{R(pedido.mb)}</b></div>
            <div className="cem"><span><i style={{ background: "var(--c-res)" }} />Asaas e maquininha (estimado)</span><b className="num">{R(pedido.custo)}</b></div>
            <div className="cem"><span><i style={{ background: "var(--c-app)" }} />Lucro do app</span><b className="num" style={{ color: pedido.app < 0 ? "var(--pimenta-esc)" : "var(--folha)" }}>{R(pedido.app)}</b></div>
            <button className="btn btn-s cheio" style={{ marginTop: 12 }} onClick={() => setPedido(null)}>Fechar</button>
          </div>
        </div>
      )}
    </>
  )
}

export default function CarteiraPage() { return <Suspense><Carteira /></Suspense> }
