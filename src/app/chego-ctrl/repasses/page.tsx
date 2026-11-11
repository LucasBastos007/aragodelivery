"use client"

// Pagamentos do admin 2.0 (20/10/2026): toda saída de dinheiro do Chegô num lugar só.
// Cada pagamento passa por: Conferir → Pagar (Pix pelo Asaas ou por fora) → Comprovante → Avisado.
// Lojas: repasse de sexta (vendas de sexta a quinta). Motoboys e adiantamentos de terça: saques
// pedidos. Despesas do Chegô. Pix pelo Asaas já fica com o comprovante oficial anexado; pago por
// fora, o comprovante (foto ou PDF) vai pra pasta privada "comprovantes".
import { useEffect, useRef, useState } from "react"
import { R, dm } from "../_dinheiro"
import { gravarAdmin } from "@/lib/adminGravar"

type LinhaLoja = { loja_id: string; nome: string; logo_url: string | null; pedidos: number; produtos: number; liquido: number; comissao: number; taxas: number; cupom: number; recebidoPelaLoja: number; adiantado?: number
  chave: string | null; chaveTipo: { tipo: string; certeza: boolean } | null; pago: { id: string; valor: number; ocorrido_em: string; origem: string; responsavel: string; comprovante_path: string | null } | null }
type Rep = { ciclo: { ini: string; fim: string; paga: string }; encerrado: boolean; inicio: string; saldoAsaas: number | null; lojas: LinhaLoja[] }
type Saque = { id: string; tipo: string; valor: number; taxa_saque: number | null; status: string; pix_chave: string | null; chaveTipo: { tipo: string; certeza: boolean } | null; criado_em: string; pago_em: string | null; comprovante_path: string | null; loja: { nome: string; logo_url: string | null } | null; motoboy: { nome: string } | null }
type Despesa = { id: string; descricao: string; categoria: string; valor: number; data: string; comprovante_path: string | null }
type Mov = { id: string; valor: number; ocorrido_em: string; motivo: string; origem: string; destinatario_nome: string; comprovante_path: string | null; loja: { nome: string; logo_url: string | null } | null }
type Pg = { hoje: string; ciclo: Rep["ciclo"]; saques: Saque[]; despesas: Despesa[]; repasses: Mov[] }

const ETAPAS = ["Conferir", "Pagar", "Comprovante", "Avisado"]
const TIPOS: [string, string][] = [["CPF", "CPF"], ["PHONE", "Celular"], ["CNPJ", "CNPJ"], ["EMAIL", "E-mail"], ["EVP", "Chave aleatória"]]
const soma = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const mascara = (v: string) => { const d = v.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9); return d ? (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "" }

function Etapas({ e, texto }: { e: number; texto: string }) {
  return <span className="pg-et">{ETAPAS.map((n, i) => <i key={n} className={i < e ? "feita" : i === e ? "agora" : ""} title={n} />)}<small>{texto}</small></span>
}

export default function PagamentosPage() {
  const [aba, setAba] = useState("agenda")
  const [rep, setRep] = useState<Rep | null>(null)
  const [pg, setPg] = useState<Pg | null>(null)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)
  // Quem vai receber: repasse de loja ou saque (motoboy / adiantamento de terça)
  const [pagar, setPagar] = useState<{ nome: string; valor: number; chave: string | null; chaveTipo: LinhaLoja["chaveTipo"]; sub: string; l?: LinhaLoja; s?: Saque; modo: "asaas" | "manual"; tipo: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [despesa, setDespesa] = useState(false)
  const arq = useRef<HTMLInputElement>(null)
  const [anexo, setAnexo] = useState<{ tipo: string; id: string } | null>(null)

  async function carregar() {
    const [a, b] = await Promise.all([
      fetch("/api/admin/repasses?ciclo=pagar", { credentials: "include" }).then(r => r.json()).catch(() => null),
      fetch("/api/admin/pagamentos", { credentials: "include" }).then(r => r.json()).catch(() => null),
    ])
    setRep(a); setPg(b)
  }
  useEffect(() => { carregar() }, [])

  function pedirAnexo(tipo: string, id: string) { setAnexo({ tipo, id }); setTimeout(() => arq.current?.click(), 0) }
  async function enviarAnexo(f: File | undefined) {
    if (!f || !anexo) return
    const fd = new FormData(); fd.append("tipo", anexo.tipo); fd.append("id", anexo.id); fd.append("arquivo", f)
    const r = await fetch("/api/admin/comprovante", { method: "POST", credentials: "include", body: fd }); const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? { t: "Comprovante anexado.", ok: true } : { t: j.error ?? "Não foi possível anexar.", ok: false })
    setAnexo(null); if (arq.current) arq.current.value = ""; carregar()
  }
  const verComp = (tipo: string, id: string) => window.open(`/api/admin/comprovante?tipo=${tipo}&id=${id}`, "_blank")

  const abrirLoja = (l: LinhaLoja) => { setMsg(null); setPagar({ nome: l.nome, valor: l.liquido, chave: l.chave, chaveTipo: l.chaveTipo, sub: `vendas de ${dm(rep!.ciclo.ini)} a ${dm(rep!.ciclo.fim)}`, l, modo: "asaas", tipo: l.chaveTipo?.tipo ?? "" }) }
  const abrirSaque = (s: Saque) => { setMsg(null); setPagar({ nome: s.loja?.nome ?? s.motoboy?.nome ?? "—", valor: Number(s.valor) - Number(s.taxa_saque ?? 0), chave: s.pix_chave, chaveTipo: s.chaveTipo,
    sub: s.tipo === "lojista" ? "adiantamento de terça (já sem a taxa de R$ 5,00)" : "saque do motoboy", s, modo: "asaas", tipo: s.chaveTipo?.tipo ?? "" }) }

  async function confirmarPagamento() {
    if (!pagar || !rep) return
    setEnviando(true); setMsg(null)
    const r = pagar.l
      ? await fetch("/api/admin/repasses", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loja_id: pagar.l.loja_id, ciclo_ini: rep.ciclo.ini, modo: pagar.modo, tipo_chave: pagar.tipo, valor_confirmado: pagar.l.liquido }) })
      : await fetch("/api/admin/saque-pagar", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saque_id: pagar.s!.id, modo: pagar.modo, tipo_chave: pagar.tipo }) })
    const j = await r.json().catch(() => ({})); setEnviando(false)
    if (!r.ok) { setMsg({ t: j.error ?? "Não deu certo", ok: false }); return }
    setPagar(null)
    setMsg({ t: pagar.modo === "asaas" ? `Pix de ${R(j.valor)} enviado pra ${pagar.nome}. O comprovante do Asaas já ficou anexado.` : `Pagamento de ${R(j.valor)} registrado pra ${pagar.nome}. Agora anexe o comprovante.`, ok: true })
    carregar()
  }
  async function recusarSaque(s: Saque) {
    if (!confirm(`Recusar o saque de ${R(Number(s.valor) - Number(s.taxa_saque ?? 0))} de ${s.loja?.nome ?? s.motoboy?.nome}? O valor volta pro saldo dele.`)) return
    const ok = await gravarAdmin("saques", s.id, { status: "cancelado" }).then(r => !r?.error).catch(() => false)
    setMsg(ok ? { t: "Saque recusado.", ok: true } : { t: "Não deu certo.", ok: false }); carregar()
  }
  const peloAsaas = (p: string | null | undefined) => String(p ?? "").startsWith("asaas:")

  if (!rep || !pg) return <p className="mut">Carregando…</p>
  const c = rep.ciclo, terca = soma(c.ini, 4)
  const lojasPend = rep.lojas.filter(l => !l.pago && l.liquido > 0)
  const saquesLoja = pg.saques.filter(s => s.tipo === "lojista"), saquesMb = pg.saques.filter(s => s.tipo === "motoboy")
  const pend = { lojas: lojasPend.reduce((t, l) => t + l.liquido, 0), saques: pg.saques.filter(s => s.status === "solicitado").reduce((t, s) => t + Number(s.valor) - Number(s.taxa_saque ?? 0), 0) }
  const semComp = [...rep.lojas.filter(l => l.pago && l.pago.origem === "manual" && !l.pago.comprovante_path), ...pg.saques.filter(s => s.status === "pago" && !s.comprovante_path), ...pg.despesas.filter(d => !d.comprovante_path)].length

  const linhaLoja = (l: LinhaLoja) => {
    const e = !l.pago ? 0 : String(l.pago.comprovante_path ?? "").startsWith("asaas:") || l.pago.comprovante_path ? 3 : 2
    return (
      <div key={l.loja_id} className="pg-l">
        <span className="pg-quem">{l.logo_url ? <img src={l.logo_url} alt="" style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover" }} /> : <span className="av-mb" style={{ width: 34, height: 34 }}>{l.nome[0]}</span>}
          <span><b>{l.nome}</b><small>{l.pedidos} pedidos, {R(l.produtos)} em produtos{l.adiantado ? `, adiantou ${R(l.adiantado)}` : ""}</small></span></span>
        <Etapas e={e} texto={e === 0 ? (rep.encerrado ? "a pagar" : "acumulando") : e === 2 ? "falta comprovante" : String(l.pago?.comprovante_path ?? "").startsWith("asaas:") ? "pago pelo Asaas" : "concluído"} />
        <b className="num pg-v">{R(l.pago ? l.pago.valor : l.liquido)}</b>
        <span className="pg-ac">{!l.pago ? (rep.encerrado && l.liquido > 0
            ? <button className="btn btn-v" style={{ minHeight: 40 }} onClick={() => abrirLoja(l)}>Pagar</button>
            : <small className="mut">paga a partir de {dm(c.paga)}</small>)
          : e === 2 ? <button className="btn btn-s" style={{ minHeight: 40 }} onClick={() => pedirAnexo("movimento", l.pago!.id)}>Anexar comprovante</button>
          : l.pago.comprovante_path ? <button className="btn btn-l" onClick={() => verComp("movimento", l.pago!.id)}>Ver comprovante</button> : <span className="selo verde">Pago</span>}</span>
      </div>
    )
  }
  const linhaSaque = (s: Saque) => {
    const quem = s.loja?.nome ?? s.motoboy?.nome ?? "—", e = s.status === "solicitado" ? 0 : !s.comprovante_path ? 2 : 3, liq = Number(s.valor) - Number(s.taxa_saque ?? 0)
    return (
      <div key={s.id} className="pg-l">
        <span className="pg-quem">{s.loja?.logo_url ? <img src={s.loja.logo_url} alt="" style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover" }} /> : <span className="av-mb" style={{ width: 34, height: 34 }}>{quem[0]}</span>}
          <span><b>{quem}</b><small>{s.tipo === "lojista" ? `Adiantamento de terça, recebe ${R(liq)} (taxa R$ 5,00)` : "Saque do motoboy"}, pedido em {new Date(s.criado_em).toLocaleDateString("pt-BR")}</small></span></span>
        <Etapas e={e} texto={e === 0 ? "a pagar" : e === 2 ? "falta comprovante" : peloAsaas(s.comprovante_path) ? "pago pelo Asaas" : "concluído"} />
        <b className="num pg-v">{R(liq)}</b>
        <span className="pg-ac">{e === 0 ? <><button className="btn btn-l" style={{ minHeight: 40 }} onClick={() => recusarSaque(s)}>Recusar</button><button className="btn btn-v" style={{ minHeight: 40 }} onClick={() => abrirSaque(s)}>Pagar</button></>
          : e === 2 ? <button className="btn btn-s" style={{ minHeight: 40 }} onClick={() => pedirAnexo("saque", s.id)}>Anexar comprovante</button>
          : <button className="btn btn-l" onClick={() => verComp("saque", s.id)}>Ver comprovante</button>}</span>
      </div>
    )
  }
  const linhaDespesa = (d: Despesa) => (
    <div key={d.id} className="pg-l">
      <span className="pg-quem"><span className="av-mb" style={{ width: 34, height: 34 }}>{d.descricao[0]}</span><span><b>{d.descricao}</b><small>{d.categoria}, {dm(d.data)}</small></span></span>
      <Etapas e={d.comprovante_path ? 3 : 2} texto={d.comprovante_path ? "concluído" : "falta comprovante"} />
      <b className="num pg-v">{R(Number(d.valor))}</b>
      <span className="pg-ac">{d.comprovante_path ? <button className="btn btn-l" onClick={() => verComp("despesa", d.id)}>Ver comprovante</button> : <button className="btn btn-s" style={{ minHeight: 40 }} onClick={() => pedirAnexo("despesa", d.id)}>Anexar comprovante</button>}</span>
    </div>
  )

  return (
    <>
      <input ref={arq} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => enviarAnexo(e.target.files?.[0])} />
      <div className="kpis4">
        <div className="cartao kpi2"><small>Repasse das lojas, sexta {dm(c.paga)}</small><b className="num">{R(pend.lojas)}</b><span className="t14 mut">{lojasPend.length} lojas, vendas de {dm(c.ini)} a {dm(c.fim)}</span></div>
        <div className="cartao kpi2"><small>Saques pedidos</small><b className="num">{R(pend.saques)}</b><span className="t14 mut">motoboys e adiantamentos</span></div>
        <div className="cartao kpi2"><small>Saldo no Asaas</small><b className="num">{rep.saldoAsaas == null ? "–" : R(rep.saldoAsaas)}</b><span className={`var ${rep.saldoAsaas != null && rep.saldoAsaas >= pend.lojas + pend.saques ? "sobe" : "desce"}`}>{rep.saldoAsaas == null ? "não respondeu" : rep.saldoAsaas >= pend.lojas + pend.saques ? "cobre tudo" : "não cobre tudo"}</span></div>
        <div className="cartao kpi2"><small>Sem comprovante</small><b className="num">{semComp}</b><span className={`var ${semComp ? "desce" : "sobe"}`}>{semComp ? "anexe pra fechar o mês" : "tudo em dia"}</span></div>
      </div>
      {msg && <div className={`aviso ${msg.ok ? "vd" : "vm"}`} role="status" style={{ marginBottom: 12 }}>{msg.t}</div>}
      <div className="abas-l">{[["agenda", "Agenda da semana"], ["lojas", "Lojas"], ["motoboys", "Motoboys"], ["terca", "Adiantamentos de terça"], ["despesas", "Despesas do Chegô"], ["comprovantes", "Comprovantes"]].map(([k, n]) => <button key={k} aria-pressed={aba === k} onClick={() => setAba(k)}>{n}</button>)}</div>

      {aba === "agenda" && (
        <div className="agenda">
          {[{ dia: terca, nome: "Terça", t: "Adiantamentos das lojas", itens: saquesLoja.map(linhaSaque), n: saquesLoja.filter(s => s.status === "solicitado").length },
            { dia: c.paga, nome: "Sexta", t: "Repasse das lojas", itens: rep.lojas.map(linhaLoja), n: lojasPend.length },
            { dia: c.paga, nome: "Quando pedirem", t: "Saques dos motoboys", itens: saquesMb.map(linhaSaque), n: saquesMb.filter(s => s.status === "solicitado").length }].map(g => (
            <div key={g.t} className="cartao ag-dia">
              <div className="ag-cab"><span className="ag-data"><b>{g.nome === "Quando pedirem" ? "—" : Number(g.dia.slice(8))}</b><small>{g.nome}</small></span><span style={{ flex: 1 }}><b className="t16b">{g.t}</b><br /><span className="t14 mut">{g.n ? `${g.n} pra pagar` : "nada pendente"}</span></span></div>
              {g.itens.length ? g.itens : <p className="t14 mut" style={{ padding: "8px 0" }}>Nada aqui nesta semana.</p>}
            </div>
          ))}
          <div className="cartao ag-dia"><div className="ag-cab"><span className="ag-data"><b style={{ fontSize: 16 }}>23h59</b><small>todo dia</small></span><span style={{ flex: 1 }}><b className="t16b">Fechamento diário</b><br /><span className="t14 mut">Vai sozinho pra você e pra Amanda: vendas, quem recebeu o quê e o saldo.</span></span><a className="btn btn-s" href="/chego-ctrl/visao-financeira">Ver fechamentos</a></div></div>
        </div>
      )}
      {aba === "lojas" && <div className="cartao pg-lista">{rep.lojas.map(linhaLoja)}{!rep.lojas.length && <p className="vazio">Nenhuma venda entregue nesse ciclo.</p>}</div>}
      {aba === "motoboys" && <div className="cartao pg-lista">{saquesMb.map(linhaSaque)}{!saquesMb.length && <p className="vazio">Nenhum saque de motoboy nas últimas 2 semanas.</p>}</div>}
      {aba === "terca" && <div className="cartao pg-lista">{saquesLoja.map(linhaSaque)}{!saquesLoja.length && <p className="vazio">Nenhum adiantamento nas últimas 2 semanas.</p>}</div>}
      {aba === "despesas" && (
        <>
          <div className="cartao pg-lista">{pg.despesas.map(linhaDespesa)}{!pg.despesas.length && <p className="vazio">Nenhuma despesa nas últimas 2 semanas.</p>}</div>
          <button className="btn btn-s" style={{ marginTop: 10 }} onClick={() => setDespesa(true)}>Lançar despesa</button>
        </>
      )}
      {aba === "comprovantes" && (
        <div className="cartao" style={{ padding: 8, overflow: "auto" }}><table className="tabela"><thead><tr><th>Pagamento</th><th>Como</th><th>Comprovante</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead><tbody>
          {pg.repasses.map(m => <tr key={m.id}><td><b>{m.loja?.nome ?? m.destinatario_nome}</b><br /><span className="t12 mut">{String(m.motivo ?? "").replace(/\s*\[repasse_ciclo:[^\]]+\]/, "")}</span></td><td>{m.origem === "asaas_repasse" || m.origem === "asaas" ? "Pix pelo Asaas" : "Pix por fora"}</td>
            <td>{m.comprovante_path ? <button className="btn btn-l" onClick={() => verComp("movimento", m.id)}>Ver</button> : <button className="btn btn-s" style={{ minHeight: 36 }} onClick={() => pedirAnexo("movimento", m.id)}>Anexar</button>}</td><td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{R(Number(m.valor))}</td></tr>)}
          {pg.saques.filter(s => s.status === "pago").map(s => <tr key={s.id}><td><b>{s.loja?.nome ?? s.motoboy?.nome}</b><br /><span className="t12 mut">{s.tipo === "lojista" ? "Adiantamento de terça" : "Saque do motoboy"}</span></td><td>{peloAsaas(s.comprovante_path) ? "Pix pelo Asaas" : "Pix por fora"}</td>
            <td>{s.comprovante_path ? <button className="btn btn-l" onClick={() => verComp("saque", s.id)}>Ver</button> : <button className="btn btn-s" style={{ minHeight: 36 }} onClick={() => pedirAnexo("saque", s.id)}>Anexar</button>}</td><td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{R(Number(s.valor) - Number(s.taxa_saque ?? 0))}</td></tr>)}
          {pg.despesas.map(d => <tr key={d.id}><td><b>{d.descricao}</b><br /><span className="t12 mut">Despesa, {dm(d.data)}</span></td><td>—</td>
            <td>{d.comprovante_path ? <button className="btn btn-l" onClick={() => verComp("despesa", d.id)}>Ver</button> : <button className="btn btn-s" style={{ minHeight: 36 }} onClick={() => pedirAnexo("despesa", d.id)}>Anexar</button>}</td><td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{R(Number(d.valor))}</td></tr>)}
          {!pg.repasses.length && !pg.despesas.length && !pg.saques.some(s => s.status === "pago") && <tr><td colSpan={4} className="vazio">Nenhum pagamento nas últimas 2 semanas.</td></tr>}
        </tbody></table></div>
      )}
      <p className="t14 mut" style={{ marginTop: 12 }}>Pix pelo Asaas: sai da conta do Chegô e o comprovante do Asaas fica anexado sozinho. Pix por fora: anexe o comprovante (foto ou PDF) pra fechar o mês. Ninguém é pago duas vezes no mesmo ciclo.</p>

      {pagar && (
        <div className="veu on" onClick={() => !enviando && setPagar(null)}>
          <div className="busca-caixa" onClick={e => e.stopPropagation()}>
            <div className="t20">Pagar {R(pagar.valor)}</div>
            <p className="t14 mut" style={{ margin: "4px 0 12px" }}>{pagar.nome}, {pagar.sub}.</p>
            <div className="pg-modos">
              <button className="cartao" aria-pressed={pagar.modo === "asaas"} style={pagar.modo === "asaas" ? { borderColor: "var(--folha)" } : undefined} onClick={() => setPagar({ ...pagar, modo: "asaas" })}><b>Pix pelo Asaas</b><small>Sai agora da conta do Chegô, na chave {pagar.chave ?? "(sem chave)"}. O comprovante fica anexado sozinho.</small></button>
              <button className="cartao" aria-pressed={pagar.modo === "manual"} style={pagar.modo === "manual" ? { borderColor: "var(--folha)" } : undefined} onClick={() => setPagar({ ...pagar, modo: "manual" })}><b>Já paguei por fora</b><small>Pix pelo banco. Depois anexe o comprovante.</small></button>
            </div>
            {pagar.modo === "asaas" && (
              <label className="campo" style={{ marginTop: 12 }}><span>Tipo da chave Pix{pagar.chaveTipo && !pagar.chaveTipo.certeza ? " (confira: pode ser CPF ou celular)" : ""}</span>
                <select value={pagar.tipo} onChange={e => setPagar({ ...pagar, tipo: e.target.value })}><option value="">Escolha</option>{TIPOS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
            )}
            {msg && !msg.ok && <div className="aviso vm" style={{ marginTop: 10 }}>{msg.t}</div>}
            <div className="lin" style={{ marginTop: 14 }}>
              <button className="btn btn-s" style={{ flex: 1 }} disabled={enviando} onClick={() => setPagar(null)}>Cancelar</button>
              <button className="btn btn-v" style={{ flex: 2 }} disabled={enviando || (pagar.modo === "asaas" && (!pagar.tipo || !pagar.chave))} onClick={confirmarPagamento}>{enviando ? "Enviando…" : pagar.modo === "asaas" ? `Enviar ${R(pagar.valor)}` : "Registrar pagamento"}</button>
            </div>
          </div>
        </div>
      )}
      {despesa && <FolhaDespesa onFechar={ok => { setDespesa(false); if (ok) { setMsg({ t: "Despesa lançada. Entra no fechamento do dia.", ok: true }); carregar() } }} />}
    </>
  )
}

function FolhaDespesa({ onFechar }: { onFechar: (ok: boolean) => void }) {
  const [d, setD] = useState(""), [v, setV] = useState(""), [cat, setCat] = useState("outros"), [erro, setErro] = useState(""), [env, setEnv] = useState(false)
  async function salvar() {
    setEnv(true); setErro("")
    const r = await fetch("/api/admin/pagamentos", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ descricao: d, valor: Number(v.replace(/\./g, "").replace(",", ".")), categoria: cat }) })
    const j = await r.json().catch(() => ({})); setEnv(false)
    if (!r.ok) { setErro(j.error ?? "Não deu certo"); return }
    onFechar(true)
  }
  return (
    <div className="veu on" onClick={() => !env && onFechar(false)}>
      <div className="busca-caixa" onClick={e => e.stopPropagation()}>
        <div className="t20" style={{ marginBottom: 10 }}>Lançar despesa</div>
        <label className="campo"><span>O que é</span><input value={d} onChange={e => setD(e.target.value)} placeholder="Ex.: gasolina, anúncio, sacolas" /></label>
        <label className="campo"><span>Valor</span><input inputMode="numeric" placeholder="R$ 0,00" value={v} onChange={e => setV(mascara(e.target.value))} /></label>
        <label className="campo"><span>Tipo</span><select value={cat} onChange={e => setCat(e.target.value)}>{["outros", "marketing", "combustível", "ajuda de custo", "equipamento", "impostos"].map(x => <option key={x}>{x}</option>)}</select></label>
        {erro && <div className="aviso vm">{erro}</div>}
        <button className="btn btn-p cheio" style={{ marginTop: 10 }} disabled={env} onClick={salvar}>{env ? "Lançando…" : "Lançar"}</button>
      </div>
    </div>
  )
}
