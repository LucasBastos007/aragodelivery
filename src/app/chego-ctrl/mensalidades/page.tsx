"use client"

// Mensalidades (admin 2.0, 20/10/2026): planos das lojas e quem está em dia no mês.
// Mesmas ações de antes (/api/chego-ctrl/mensalidade): confirmar pagamento e mudar o dia do vencimento.
// Plano Gold não tem mensalidade (cobra comissão). Bloqueio automático 4 dias depois do vencimento.
import { useCallback, useEffect, useState } from "react"
import { R } from "../_dinheiro"

const PLANO: Record<string, { n: string; v: number }> = { select: { n: "Select", v: 149 }, prime: { n: "Prime", v: 497 }, black: { n: "Black", v: 997 } }
const ST: Record<string, [string, string]> = { pago: ["Em dia", "verde"], pendente: ["A vencer", "amarelo"], atrasado: ["Atrasada", "vermelho"], bloqueado: ["Bloqueada", "roxo"] }
type Loja = { id: string; nome: string; plano: string; mensalidade_dia: number; status: string; logo_url?: string; mensalidade_paga_em?: string }
type Mens = { id: string; loja_id: string; valor: number; mes_referencia: string; vencimento: string; pago_em?: string; confirmado_por?: string; status: string }
const dataBr = (ymd: string) => new Date(ymd + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
const atrasoDe = (venc: string) => { const h = new Date(); h.setHours(0, 0, 0, 0); return Math.max(0, Math.floor((h.getTime() - new Date(venc + "T00:00:00").getTime()) / 86_400_000)) }
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]

export default function MensalidadesPage() {
  const [lojas, setLojas] = useState<Loja[]>([])
  const [mens, setMens] = useState<Mens[]>([])
  const [carregou, setCarregou] = useState(false)
  const [filtro, setFiltro] = useState("todos")
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [dia, setDia] = useState<{ id: string; v: string } | null>(null)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    const r = await fetch("/api/chego-ctrl/mensalidade", { credentials: "include" })
    const d = await r.json().catch(() => ({}))
    setLojas(d.lojas ?? []); setMens(d.mensalidades ?? []); setCarregou(true)
  }, [])
  useEffect(() => { load() }, [load])

  const hoje = new Date(), mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
  const ordem: Record<string, number> = { bloqueado: 0, atrasado: 1, pendente: 2, pago: 3 }
  const rows = lojas.map(l => { const m = mens.find(x => x.loja_id === l.id && x.mes_referencia === mes) ?? null; return { l, m, st: m?.status ?? "pendente", atraso: m ? atrasoDe(m.vencimento) : 0 } })
    .sort((a, b) => (ordem[a.st] ?? 2) - (ordem[b.st] ?? 2) || b.atraso - a.atraso)
  const vis = rows.filter(r => filtro === "todos" || r.st === filtro)
  const valor = (r: typeof rows[number]) => Number(r.m?.valor ?? PLANO[r.l.plano]?.v ?? 0)
  const recebido = rows.filter(r => r.st === "pago").reduce((t, r) => t + valor(r), 0)
  const aReceber = rows.filter(r => r.st !== "pago").reduce((t, r) => t + valor(r), 0)
  const conta = (s: string) => rows.filter(r => s === "todos" || r.st === s).length

  async function post(body: object) {
    const r = await fetch("/api/chego-ctrl/mensalidade", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    return r.ok
  }
  async function confirmar(r: typeof rows[number]) {
    if (!r.m) return
    if (!confirm(`Confirmar que ${r.l.nome} pagou ${R(valor(r))}?${r.st === "bloqueado" ? " A loja é desbloqueada." : ""}`)) return
    setOcupado(r.m.id); const ok = await post({ acao: "confirmar_pagamento", mensalidade_id: r.m.id }); await load(); setOcupado(null)
    setMsg(ok ? { t: `Mensalidade de ${r.l.nome} confirmada.`, ok: true } : { t: "Não deu certo.", ok: false })
  }
  async function salvarDia(l: Loja) {
    const n = Number(dia?.v); if (!(n >= 1 && n <= 28)) { setMsg({ t: "O dia tem que ser de 1 a 28.", ok: false }); return }
    setOcupado(l.id); const ok = await post({ acao: "atualizar_dia", loja_id: l.id, dia: n }); await load(); setOcupado(null); setDia(null)
    setMsg(ok ? { t: `${l.nome} agora vence todo dia ${n}.`, ok: true } : { t: "Não deu certo.", ok: false })
  }

  return (
    <>
      <div className="kpis4">
        <div className="cartao kpi2"><small>Recebido em {MESES[hoje.getMonth()]}</small><b className="num">{R(recebido)}</b><span className="t14 mut">{conta("pago")} lojas em dia</span></div>
        <div className="cartao kpi2"><small>Falta receber</small><b className="num">{R(aReceber)}</b><span className="t14 mut">{conta("pendente")} a vencer</span></div>
        <div className="cartao kpi2"><small>Atrasadas</small><b className="num" style={{ color: conta("atrasado") ? "var(--pimenta)" : undefined }}>{conta("atrasado")}</b><span className="t14 mut">bloqueia com 4 dias</span></div>
        <div className="cartao kpi2"><small>Bloqueadas</small><b className="num">{conta("bloqueado")}</b><span className="t14 mut">sem acesso ao painel</span></div>
      </div>
      {msg && <div className={`aviso ${msg.ok ? "vd" : "vm"}`} role="status" style={{ marginBottom: 12 }}>{msg.t}</div>}
      <div className="chips-l" style={{ marginBottom: 12 }}>
        {["todos", "atrasado", "bloqueado", "pendente", "pago"].map(s => <button key={s} className="chip" aria-pressed={filtro === s} onClick={() => setFiltro(s)}>{s === "todos" ? "Todas" : ST[s][0]} <span className="pd-n">{conta(s)}</span></button>)}
      </div>

      {!carregou ? <p className="mut">Carregando…</p> : (
        <div className="cartao" style={{ padding: 6, overflow: "auto" }}>
          <table className="tabela">
            <thead><tr><th>Loja</th><th>Plano</th><th className="esconde-cel">Vence</th><th>Situação</th><th style={{ textAlign: "right" }}>Ação</th></tr></thead>
            <tbody>
              {vis.map(r => { const st = ST[r.st] ?? ST.pendente; return (
                <tr key={r.l.id}>
                  <td><span className="lin" style={{ gap: 10 }}>{r.l.logo_url ? <img src={r.l.logo_url} alt="" style={{ width: 32, height: 32, borderRadius: 9, objectFit: "cover" }} /> : <span className="av-mb" style={{ width: 32, height: 32, borderRadius: 9, background: "var(--pedra)", color: "var(--suave)" }}>{r.l.nome[0]}</span>}
                    <span><b>{r.l.nome}</b><br />
                      {dia?.id === r.l.id
                        ? <span className="lin" style={{ gap: 6, marginTop: 4 }}><input className="pd-sel" style={{ width: 70 }} inputMode="numeric" value={dia.v} onChange={e => setDia({ id: r.l.id, v: e.target.value.replace(/\D/g, "").slice(0, 2) })} /><button className="btn btn-v" style={{ minHeight: 34, padding: "0 10px", fontSize: 13 }} disabled={ocupado === r.l.id} onClick={() => salvarDia(r.l)}>Salvar</button><button className="btn btn-l" style={{ minHeight: 34 }} onClick={() => setDia(null)}>Voltar</button></span>
                        : <button className="t12 mut" onClick={() => setDia({ id: r.l.id, v: String(r.l.mensalidade_dia ?? 10) })}>Vence todo dia {r.l.mensalidade_dia ?? 10}, <u>mudar</u></button>}
                    </span></span></td>
                  <td><b>{PLANO[r.l.plano]?.n ?? r.l.plano}</b><br /><span className="t12 mut num">{R(valor(r))}</span></td>
                  <td className="esconde-cel num">{r.m ? dataBr(r.m.vencimento) : `dia ${r.l.mensalidade_dia ?? 10}`}</td>
                  <td><span className={`selo ${st[1]}`}>{st[0]}</span>{r.st !== "pago" && r.atraso > 0 && <small className="pd-atr">{r.atraso} {r.atraso === 1 ? "dia" : "dias"} de atraso</small>}</td>
                  <td style={{ textAlign: "right" }}>
                    {r.m && r.st !== "pago" && <button className="btn btn-v" style={{ minHeight: 38, fontSize: 14, padding: "0 12px" }} disabled={ocupado === r.m.id} onClick={() => confirmar(r)}>{ocupado === r.m.id ? "Confirmando…" : "Confirmar pagamento"}</button>}
                    {r.st === "pago" && r.m?.pago_em && <span className="t12 mut">Pago em {new Date(r.m.pago_em).toLocaleDateString("pt-BR")}{r.m.confirmado_por ? `, por ${r.m.confirmado_por}` : ""}</span>}
                    {!r.m && <span className="t12 mut">sem cobrança no mês</span>}
                  </td>
                </tr>) })}
              {!vis.length && <tr><td colSpan={5} className="vazio">Nenhuma loja aqui.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="t12 mut" style={{ marginTop: 8 }}>Plano Gold não tem mensalidade: paga comissão sobre os pedidos. Loja bloqueada não entra no painel até a mensalidade ser confirmada. O bloqueio é automático 4 dias depois do vencimento.</p>
    </>
  )
}
