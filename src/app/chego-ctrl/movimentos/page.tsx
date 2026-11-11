"use client"

import { useEffect, useMemo, useState } from "react"
import CaixaPainel from "../_CaixaPainel"

// Movimentos (admin 2.0, 20/10/2026, mesma lógica de antes com o visual novo).
// Livro-caixa do fechamento financeiro diário: retiradas, adiantamentos, bônus, dinheiro
// entregue ao caixa, conferências e repasses. Pix enviados pelo Asaas entram sozinhos
// todo dia às 23h59; os sem identificação aparecem no topo para atribuir.

type Pessoa = { id: string; nome: string; status?: string }
type Mov = {
  id: string; beneficiario_tipo: string; motoboy_id: string | null; loja_id: string | null; destinatario_nome: string | null
  tipo: string; valor: number; forma: string | null; ocorrido_em: string; responsavel: string | null; motivo: string
  origem: string; cancelado_em: string | null; cancelado_por: string | null; cancelado_motivo: string | null
  motoboy: { nome: string } | null; loja: { nome: string } | null
}

const TIPOS_MOTOBOY: { v: string; l: string; ajuda: string }[] = [
  { v: "retirada_dinheiro", l: "Retirada em dinheiro", ajuda: "Ficou com parte do dinheiro dos clientes como pagamento. Abate do que ele tem a receber e do dinheiro em mãos." },
  { v: "entrega_caixa", l: "Dinheiro entregue ao caixa", ajuda: "Entregou dinheiro em espécie ao responsável financeiro." },
  { v: "conferencia_caixa", l: "Conferência de caixa", ajuda: "Valor contado em mãos. O fechamento compara com o esperado e alerta se houver diferença." },
  { v: "pagamento", l: "Pagamento (Pix/dinheiro)", ajuda: "Pagamento da remuneração feito fora do Asaas (os Pix do Asaas entram sozinhos)." },
  { v: "adiantamento", l: "Adiantamento", ajuda: "Valor pago antes do fechamento da semana." },
  { v: "pagamento_autorizado_dinheiro", l: "Pagamento autorizado com o dinheiro", ajuda: "Usou dinheiro dos clientes para uma despesa autorizada (ex.: combustível pago pela Chegô)." },
  { v: "bonus", l: "Bônus / adicional", ajuda: "Valor extra a receber (ex.: avulsa não registrada)." },
  { v: "desconto", l: "Desconto", ajuda: "Valor a descontar do que ele tem a receber." },
  { v: "ajuste_credito", l: "Ajuste a favor", ajuda: "Correção a favor do motoboy." },
  { v: "ajuste_debito", l: "Ajuste contra", ajuda: "Correção contra o motoboy." },
]
const TIPOS_LOJA: { v: string; l: string; ajuda: string }[] = [
  { v: "repasse", l: "Repasse feito à loja", ajuda: "Pagamento à loja fora do Asaas (Stone, dinheiro). Os Pix do Asaas entram sozinhos." },
  { v: "ajuste_debito", l: "Desconto / cobrança da loja", ajuda: "Ex.: mensalidade em aberto descontada do repasse." },
  { v: "ajuste_credito", l: "Crédito para a loja", ajuda: "Valor a mais devido à loja." },
]
const NOME_TIPO: Record<string, string> = Object.fromEntries([...TIPOS_MOTOBOY, ...TIPOS_LOJA].map(t => [t.v, t.l]))
NOME_TIPO.repasse = "Repasse à loja"; NOME_TIPO.transferencia_interna = "Transferência interna"; NOME_TIPO.nao_identificado = "Pix sem identificação"; NOME_TIPO.ajuste_debito = "Ajuste / desconto"; NOME_TIPO.ajuste_credito = "Ajuste a favor"

const fmt = (v: number) => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const mascara = (digitos: string) => { const n = Number(digitos.replace(/\D/g, "") || "0") / 100; return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
const agoraBrtLocal = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}
const hora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "")


function MovimentosLanc() {
  const [movs, setMovs] = useState<Mov[]>([])
  const [motoboys, setMotoboys] = useState<Pessoa[]>([])
  const [lojas, setLojas] = useState<Pessoa[]>([])
  const [dias, setDias] = useState(7)
  const [loading, setLoading] = useState(true)
  const [quem, setQuem] = useState<"motoboy" | "loja">("motoboy")
  const [pessoa, setPessoa] = useState("")
  const [tipo, setTipo] = useState("retirada_dinheiro")
  const [valor, setValor] = useState("0,00")
  const [forma, setForma] = useState("")
  const [quando, setQuando] = useState(agoraBrtLocal())
  const [responsavel, setResponsavel] = useState("")
  const [motivo, setMotivo] = useState("")
  const [pedido, setPedido] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [motivoCancel, setMotivoCancel] = useState("")
  const [atrib, setAtrib] = useState<Record<string, string>>({})
  const [aberto, setAberto] = useState(false)

  useEffect(() => { try { setResponsavel(localStorage.getItem("mov_responsavel") ?? "") } catch {} }, [])
  useEffect(() => { carregar() }, [dias])

  async function carregar() {
    setLoading(true)
    const res = await fetch(`/api/admin/movimentos?dias=${dias}`, { credentials: "include" })
    const j = await res.json().catch(() => ({}))
    setMovs(j.movimentos ?? []); setMotoboys((j.motoboys ?? []).filter((m: Pessoa) => m.status !== "rejeitado")); setLojas(j.lojas ?? [])
    setLoading(false)
  }

  const tipos = quem === "motoboy" ? TIPOS_MOTOBOY : TIPOS_LOJA
  const ajuda = tipos.find(t => t.v === tipo)?.ajuda

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setMsg(null)
    try { localStorage.setItem("mov_responsavel", responsavel) } catch {}
    const res = await fetch("/api/admin/movimentos", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beneficiario_tipo: quem, motoboy_id: quem === "motoboy" ? pessoa : null, loja_id: quem === "loja" ? pessoa : null,
        tipo, valor: Number(valor.replace(/\./g, "").replace(",", ".")), forma: forma || null,
        ocorrido_em: new Date(`${quando}:00-03:00`).toISOString(), responsavel, motivo, pedido_codigo: pedido || null,
      }),
    })
    const j = await res.json().catch(() => ({}))
    setSalvando(false)
    if (!res.ok) { setMsg({ ok: false, t: j.error ?? "Erro ao registrar" }); return }
    setMsg({ ok: true, t: "Movimento registrado. Entra no fechamento das 23h59." }); setAberto(false)
    setValor("0,00"); setMotivo(""); setPedido(""); setQuando(agoraBrtLocal())
    carregar()
  }

  async function patch(body: object) {
    const res = await fetch("/api/admin/movimentos", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg({ ok: false, t: j.error ?? "Erro" }); return false }
    carregar(); return true
  }

  const naoIdent = useMemo(() => movs.filter(m => m.tipo === "nao_identificado" && !m.cancelado_em), [movs])
  const nome = (m: Mov) => m.motoboy?.nome ?? m.loja?.nome ?? m.destinatario_nome ?? "—"

  const ativos = movs.filter(m => !m.cancelado_em)
  const entradas = ativos.filter(m => ["entrega_caixa", "ajuste_debito", "desconto"].includes(m.tipo)).reduce((t, m) => t + Number(m.valor), 0)
  const saidas = ativos.filter(m => ["repasse", "pagamento", "adiantamento", "retirada_dinheiro", "bonus", "ajuste_credito", "pagamento_autorizado_dinheiro"].includes(m.tipo)).reduce((t, m) => t + Number(m.valor), 0)

  return (
    <>
      {naoIdent.length > 0 && (
        <div className="cartao mv-ni">
          <b className="t16b">Pix enviados sem identificação ({naoIdent.length})</b>
          <p className="t14 mut" style={{ margin: "2px 0 8px" }}>Saíram da conta do Asaas e ninguém sabe pra quem. Diga de quem é pra fechar o dia certo.</p>
          {naoIdent.map(m => (
            <div key={m.id} className="mv-ni-l">
              <span style={{ flex: "1 1 240px" }}><b>{m.destinatario_nome ?? "—"}</b>, <b className="num">{fmt(m.valor)}</b>, {hora(m.ocorrido_em)}<br /><small className="mut">{m.motivo}</small></span>
              <select className="pd-sel" style={{ flex: "1 1 220px", borderRadius: 12, height: 42 }} value={atrib[m.id] ?? ""} onChange={e => setAtrib({ ...atrib, [m.id]: e.target.value })}>
                <option value="">É de quem?</option>
                <option value="interna">Transferência interna (conta do Chegô)</option>
                <optgroup label="Motoboys">{motoboys.map(p => <option key={p.id} value={`m:${p.id}`}>{p.nome}</option>)}</optgroup>
                <optgroup label="Lojas">{lojas.map(p => <option key={p.id} value={`l:${p.id}`}>{p.nome}</option>)}</optgroup>
              </select>
              <button className="btn btn-g" style={{ minHeight: 42 }} disabled={!atrib[m.id]} onClick={() => { const v = atrib[m.id]; patch({ id: m.id, acao: "atribuir", interna: v === "interna", motoboy_id: v.startsWith("m:") ? v.slice(2) : null, loja_id: v.startsWith("l:") ? v.slice(2) : null }) }}>Salvar</button>
            </div>
          ))}
        </div>
      )}

      <div className="lin" style={{ flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div className="chips-l">{[1, 7, 30, 90].map(d => <button key={d} className="chip" aria-pressed={dias === d} onClick={() => setDias(d)}>{d === 1 ? "Hoje" : `${d} dias`}</button>)}</div>
        <button className="btn btn-p" style={{ marginLeft: "auto", minHeight: 42 }} onClick={() => { setMsg(null); setAberto(true) }}>Registrar movimento</button>
      </div>
      {msg && !aberto && <div className={`aviso ${msg.ok ? "vd" : "vm"}`} role="status" style={{ marginBottom: 12 }}>{msg.t}</div>}
      <div className="kpis3">
        <div className="cartao kpi2"><small>Lançamentos</small><b className="num">{ativos.length}</b><span className="t14 mut">{movs.length - ativos.length ? `${movs.length - ativos.length} cancelados` : "nenhum cancelado"}</span></div>
        <div className="cartao kpi2"><small>Saiu (pagamentos, retiradas, repasses)</small><b className="num">{fmt(saidas)}</b><span className="t14 mut">no período</span></div>
        <div className="cartao kpi2"><small>Voltou pro caixa e descontos</small><b className="num">{fmt(entradas)}</b><span className="t14 mut">no período</span></div>
      </div>

      {loading ? <p className="mut">Carregando…</p> : movs.length === 0 ? <div className="cartao dsp-vazio"><b>Nenhum movimento no período</b><span>Retiradas, adiantamentos, dinheiro entregue ao caixa e repasses fora do Asaas aparecem aqui. Os Pix do Asaas entram sozinhos às 23h59.</span></div> : (
        <div className="cartao" style={{ padding: 6 }}>
          {movs.map(m => (
            <div key={m.id} className={`mv-l ${m.cancelado_em ? "canc" : ""}`}>
              <span className={`mv-ic ${m.beneficiario_tipo === "loja" ? "loja" : ""}`}>{nome(m)[0]}</span>
              <span className="mv-txt">
                <b>{nome(m)} <span className="selo cinza">{NOME_TIPO[m.tipo] ?? m.tipo}</span>{m.origem === "asaas" && <span className="selo azul">Asaas</span>}</b>
                <small>{hora(m.ocorrido_em)}, {m.responsavel ?? "—"}{m.forma ? `, ${m.forma}` : ""}. {String(m.motivo ?? "").replace(/\s*\[repasse_ciclo:[^\]]+\]/, "")}</small>
                {m.cancelado_em && <small style={{ color: "var(--pimenta-esc)", fontWeight: 700 }}>Cancelado por {m.cancelado_por}: {m.cancelado_motivo}</small>}
                {!m.cancelado_em && m.origem === "manual" && (cancelando === m.id ? (
                  <span className="lin" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <input className="pd-busca" style={{ flex: "1 1 220px", height: 40 }} value={motivoCancel} onChange={e => setMotivoCancel(e.target.value)} placeholder="Por que cancelar?" />
                    <button className="btn btn-p" style={{ minHeight: 40 }} disabled={!motivoCancel.trim()} onClick={async () => { if (await patch({ id: m.id, acao: "cancelar", motivo: motivoCancel, responsavel })) { setCancelando(null); setMotivoCancel("") } }}>Cancelar lançamento</button>
                    <button className="btn btn-s" style={{ minHeight: 40 }} onClick={() => setCancelando(null)}>Voltar</button>
                  </span>
                ) : <button className="mv-canc" onClick={() => { setCancelando(m.id); setMotivoCancel("") }}>Cancelar lançamento</button>)}
              </span>
              <b className="num mv-v" style={{ textDecoration: m.cancelado_em ? "line-through" : undefined }}>{fmt(m.valor)}</b>
            </div>
          ))}
        </div>
      )}

      {aberto && (
        <div className="veu on" onClick={() => !salvando && setAberto(false)}>
          <form className="busca-caixa mv-form" onSubmit={async e => { await registrar(e) }} onClick={e => e.stopPropagation()}>
            <div className="t20" style={{ marginBottom: 10 }}>Registrar movimento</div>
            <div className="pd-vis" style={{ display: "inline-flex", marginBottom: 12 }}>{(["motoboy", "loja"] as const).map(q => <button type="button" key={q} aria-pressed={quem === q} onClick={() => { setQuem(q); setPessoa(""); setTipo(q === "motoboy" ? "retirada_dinheiro" : "repasse") }}>{q === "motoboy" ? "Motoboy" : "Loja"}</button>)}</div>
            <div className="mv-grade">
              <label className="campo"><span>{quem === "motoboy" ? "Motoboy" : "Loja"}</span><select required value={pessoa} onChange={e => setPessoa(e.target.value)}><option value="">Escolha</option>{(quem === "motoboy" ? motoboys : lojas).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
              <label className="campo"><span>O que foi</span><select value={tipo} onChange={e => setTipo(e.target.value)}>{tipos.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select></label>
              <label className="campo"><span>Valor</span><input inputMode="numeric" value={valor} onChange={e => setValor(mascara(e.target.value))} /></label>
              <label className="campo"><span>Forma</span><select value={forma} onChange={e => setForma(e.target.value)}><option value="">Automática</option><option value="dinheiro">Dinheiro</option><option value="pix">Pix</option><option value="outro">Outro</option></select></label>
              <label className="campo"><span>Quando (Brasília)</span><input type="datetime-local" required value={quando} onChange={e => setQuando(e.target.value)} /></label>
              <label className="campo"><span>Quem registrou</span><input required value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Seu nome" /></label>
            </div>
            <label className="campo"><span>Motivo</span><input required value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: retirou do dinheiro das entregas de hoje" /></label>
            <label className="campo"><span>Pedido (se tiver)</span><input value={pedido} onChange={e => setPedido(e.target.value.toUpperCase())} placeholder="Código, ex.: AV8475" /></label>
            {ajuda && <p className="aviso am" style={{ marginBottom: 10 }}>{ajuda}</p>}
            {msg && <div className={`aviso ${msg.ok ? "vd" : "vm"}`} style={{ marginBottom: 10 }}>{msg.t}</div>}
            <div className="lin" style={{ gap: 8 }}>
              <button type="button" className="btn btn-s" style={{ flex: 1 }} disabled={salvando} onClick={() => setAberto(false)}>Fechar</button>
              <button className="btn btn-p" style={{ flex: 2 }} disabled={salvando}>{salvando ? "Salvando…" : "Registrar"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

// Caixa dos motoboys virou uma aba daqui (admin 2.0, 20/10/2026): é o mesmo livro-caixa.
export default function MovimentosPage() {
  const [aba, setAba] = useState<"lanc" | "caixa">("lanc")
  useEffect(() => { if (new URLSearchParams(window.location.search).get("aba") === "caixa") setAba("caixa") }, [])
  return (
    <>
      <div className="abas-l"><button aria-pressed={aba === "lanc"} onClick={() => setAba("lanc")}>Lançamentos</button><button aria-pressed={aba === "caixa"} onClick={() => setAba("caixa")}>Dinheiro declarado pelos motoboys</button></div>
      {aba === "lanc" ? <MovimentosLanc /> : <CaixaPainel />}
    </>
  )
}
