"use client"

// Escala dos motoboys (03/11/2026, pedido do Lucas): calendário da semana com o horário de cada um.
// O mesmo componente serve o admin (edita) e o app do motoboy (só vê, com os próprios turnos em
// destaque). Dados e regras em /api/escala. Duas vistas: Semana (tabela motoboy x dia) e Dia
// (barras numa régua das 6h às 2h, mostra buraco na cobertura). No celular abre no Dia.
import { useCallback, useEffect, useMemo, useState } from "react"
import "./escala.css"

type Turno = { id: number; motoboy_id: string; data: string; inicio: string; fim: string; observacao: string | null }
type Mb = { id: string; nome: string; ativo: boolean }
type Dados = { inicio: string; fim: string; eu: string | null; podeEditar: boolean; motoboys: Mb[]; turnos: Turno[] }
type Form = { id?: number; motoboy_id: string; data: string; inicio: string; fim: string; observacao: string }

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
const REGUA_INI = 6, REGUA_HORAS = 20 // 6h às 2h do dia seguinte

const hojeYmd = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
const maisDias = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const segundaDe = (ymd: string) => { const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay(); return maisDias(ymd, dow === 0 ? -6 : 1 - dow) }
const diaMes = (ymd: string) => Number(ymd.slice(8, 10))
const hora = (h: string) => { const [a, b] = h.split(":"); return `${Number(a)}h${b === "00" ? "" : b}` }
const faixa = (t: { inicio: string; fim: string }) => `${hora(t.inicio)} às ${hora(t.fim)}`
const minutos = (h: string) => { const [a, b] = h.split(":").map(Number); return a * 60 + b }
const viraNoite = (t: { inicio: string; fim: string }) => minutos(t.fim) < minutos(t.inicio)
const primeiro = (n: string) => n.trim().split(/\s+/).slice(0, 2).join(" ")

function tituloSemana(ini: string) {
  const fim = maisDias(ini, 6), mi = Number(ini.slice(5, 7)) - 1, mf = Number(fim.slice(5, 7)) - 1
  return mi === mf ? `${diaMes(ini)} a ${diaMes(fim)} de ${MESES[mf]}` : `${diaMes(ini)} de ${MESES[mi]} a ${diaMes(fim)} de ${MESES[mf]}`
}

// "Seg a Sex: 18h às 23h" em vez de repetir o horário dia por dia
function resumoMeus(ts: Turno[], dias: string[]) {
  const porFaixa = new Map<string, number[]>()
  for (const t of ts) { const k = faixa(t); porFaixa.set(k, [...(porFaixa.get(k) ?? []), dias.indexOf(t.data)]) }
  return [...porFaixa.entries()].map(([f, is]) => {
    const u = [...new Set(is)].sort((a, b) => a - b)
    const seguidos = u.length > 2 && u.every((x, i) => i === 0 || x === u[i - 1] + 1)
    const quando = u.length === 7 ? "Todos os dias" : seguidos ? `${DIAS[u[0]]} a ${DIAS[u.at(-1)!]}` : u.map(i => DIAS[i]).join(", ")
    return `${quando}: ${f}`
  })
}

export default function EscalaSemana() {
  const hoje = hojeYmd()
  const [semana, setSemana] = useState(segundaDe(hoje))
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [vista, setVista] = useState<"semana" | "dia">("semana")
  const [dia, setDia] = useState(hoje)
  const [form, setForm] = useState<Form | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [apagar, setApagar] = useState(false)
  const [aviso, setAviso] = useState<{ t: string; ok: boolean } | null>(null)

  useEffect(() => { if (window.matchMedia("(max-width: 760px)").matches) setVista("dia") }, [])

  const carregar = useCallback(() => {
    setErro(null)
    fetch(`/api/escala?inicio=${semana}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j.error)))
      .then(setD).catch(e => setErro(typeof e === "string" ? e : "Não foi possível carregar a escala."))
  }, [semana])
  useEffect(() => { carregar() }, [carregar])

  const diasSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => maisDias(semana, i)), [semana])
  useEffect(() => { if (!diasSemana.includes(dia)) setDia(diasSemana.includes(hoje) ? hoje : diasSemana[0]) }, [diasSemana]) // eslint-disable-line react-hooks/exhaustive-deps

  const nomeDe = useMemo(() => new Map((d?.motoboys ?? []).map(m => [m.id, m.nome])), [d])
  // Linhas da tabela: o admin vê todos os ativos (pra tocar e escalar); o motoboy vê só quem tem turno, ele primeiro
  const linhas = useMemo(() => {
    if (!d) return []
    const comTurno = new Set(d.turnos.map(t => t.motoboy_id))
    const ms = d.podeEditar ? d.motoboys : d.motoboys.filter(m => comTurno.has(m.id))
    return [...ms].sort((a, b) => Number(b.id === d.eu) - Number(a.id === d.eu) || Number(comTurno.has(b.id)) - Number(comTurno.has(a.id)) || a.nome.localeCompare(b.nome))
  }, [d])
  const turnosDe = (mb: string, data: string) => (d?.turnos ?? []).filter(t => t.motoboy_id === mb && t.data === data)
  const doDia = useMemo(() => (d?.turnos ?? []).filter(t => t.data === dia).sort((a, b) => Number(b.motoboy_id === d?.eu) - Number(a.motoboy_id === d?.eu) || a.inicio.localeCompare(b.inicio)), [d, dia])
  const porMotoboy = useMemo(() => { const m = new Map<string, Turno[]>(); for (const t of doDia) m.set(t.motoboy_id, [...(m.get(t.motoboy_id) ?? []), t]); return [...m.entries()] }, [doDia])
  const meus = useMemo(() => (d?.turnos ?? []).filter(t => t.motoboy_id === d?.eu), [d])

  function abrirNovo(motoboy_id = "", data = dia) {
    if (!d?.podeEditar) return
    setApagar(false); setAviso(null)
    setForm({ motoboy_id, data, inicio: "18:00", fim: "23:00", observacao: "" })
  }
  function abrirTurno(t: Turno) {
    if (!d?.podeEditar) return
    setApagar(false); setAviso(null)
    setForm({ id: t.id, motoboy_id: t.motoboy_id, data: t.data, inicio: t.inicio, fim: t.fim, observacao: t.observacao ?? "" })
  }
  async function enviar(body: object, ok: string) {
    setSalvando(true)
    const r = await fetch("/api/escala", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    setSalvando(false)
    if (!r.ok) { setAviso({ t: j.error ?? "Não deu certo.", ok: false }); return false }
    setAviso({ t: typeof j.copiados === "number" ? (j.copiados ? `Copiei ${j.copiados} ${j.copiados === 1 ? "turno" : "turnos"} da semana anterior.` : "Essa semana já tinha todos os turnos da anterior.") : ok, ok: true })
    carregar(); return true
  }
  async function salvar() {
    if (!form) return
    if (await enviar(form, form.id ? "Turno alterado." : "Turno salvo.")) setForm(null)
  }
  async function confirmarApagar() {
    if (!form?.id) return
    if (await enviar({ acao: "apagar", id: form.id }, "Turno apagado.")) setForm(null)
  }

  const barra = (t: Turno) => {
    const ini = (minutos(t.inicio) / 60 - REGUA_INI + 24) % 24
    let fim = (minutos(t.fim) / 60 - REGUA_INI + 24) % 24
    if (fim <= ini) fim = Math.min(REGUA_HORAS, fim + 24)
    const a = Math.max(0, Math.min(REGUA_HORAS, ini)), b = Math.max(a + 0.5, Math.min(REGUA_HORAS, fim))
    return { left: `${a / REGUA_HORAS * 100}%`, width: `${(b - a) / REGUA_HORAS * 100}%` }
  }

  return (
    <div className="esc">
      <div className="esc-topo">
        <div className="esc-nav">
          <button className="esc-seta" aria-label="Semana anterior" onClick={() => setSemana(maisDias(semana, -7))}>‹</button>
          <b className="esc-tit">{tituloSemana(semana)}</b>
          <button className="esc-seta" aria-label="Próxima semana" onClick={() => setSemana(maisDias(semana, 7))}>›</button>
          {semana !== segundaDe(hoje) && <button className="esc-chip" onClick={() => { setSemana(segundaDe(hoje)); setDia(hoje) }}>Esta semana</button>}
        </div>
        <div className="esc-acoes">
          <div className="esc-vistas" role="group" aria-label="Como ver">
            <button className="esc-chip" aria-pressed={vista === "semana"} onClick={() => setVista("semana")}>Semana</button>
            <button className="esc-chip" aria-pressed={vista === "dia"} onClick={() => setVista("dia")}>Dia</button>
          </div>
          {d?.podeEditar && <>
            <button className="esc-bt" disabled={salvando} onClick={() => enviar({ acao: "copiar", para: semana }, "")}>Copiar semana anterior</button>
            <button className="esc-bt esc-bt-p" onClick={() => abrirNovo()}>Novo turno</button>
          </>}
        </div>
      </div>

      {aviso && !form && <div className={`esc-aviso ${aviso.ok ? "ok" : "erro"}`} role="status">{aviso.t}</div>}
      {erro && <div className="esc-aviso erro">{erro}</div>}
      {!d && !erro && <p className="esc-mut">Carregando a escala…</p>}

      {d && d.eu && (
        <div className="esc-meus">
          <b>Seus horários nesta semana</b>
          {meus.length ? resumoMeus(meus, diasSemana).map(l => <span key={l}>{l}</span>) : <span>Você ainda não está escalado nesta semana.</span>}
        </div>
      )}

      {d && vista === "semana" && (
        linhas.length === 0 ? <p className="esc-vazio">Ninguém escalado nesta semana.</p> :
        <div className="esc-rolagem">
          <table className="esc-tabela">
            <thead><tr><th className="esc-th-nome">Motoboy</th>{diasSemana.map((ymd, i) => <th key={ymd} className={ymd === hoje ? "hoje" : ""}><span>{DIAS[i]}</span> <b className="num">{diaMes(ymd)}</b></th>)}</tr></thead>
            <tbody>{linhas.map(m => (
              <tr key={m.id} className={m.id === d.eu ? "eu" : ""}>
                <th className="esc-th-nome">{primeiro(m.nome)}{m.id === d.eu && <small>você</small>}{!m.ativo && <small>suspenso</small>}</th>
                {diasSemana.map(ymd => {
                  const ts = turnosDe(m.id, ymd)
                  return (
                    <td key={ymd} className={ymd === hoje ? "hoje" : ""}>
                      {ts.map(t => <button key={t.id} className="esc-pilula" disabled={!d.podeEditar} onClick={() => abrirTurno(t)} title={t.observacao ?? undefined}>{faixa(t)}{t.observacao && <i>{t.observacao}</i>}</button>)}
                      {d.podeEditar && <button className="esc-mais" aria-label={`Escalar ${m.nome} em ${DIAS[diasSemana.indexOf(ymd)]} ${diaMes(ymd)}`} onClick={() => abrirNovo(m.id, ymd)}>+</button>}
                    </td>
                  )
                })}
              </tr>))}
            </tbody>
          </table>
        </div>
      )}

      {d && vista === "dia" && (
        <>
          <div className="esc-dias" role="tablist" aria-label="Dia da semana">
            {diasSemana.map((ymd, i) => {
              const n = d.turnos.filter(t => t.data === ymd).length
              return <button key={ymd} role="tab" aria-selected={dia === ymd} className={`esc-dia ${ymd === hoje ? "hoje" : ""}`} onClick={() => setDia(ymd)}>
                <span>{DIAS[i]}</span><b className="num">{diaMes(ymd)}</b><small>{n ? <>{n}<span className="esc-palavra"> {n === 1 ? "turno" : "turnos"}</span></> : "–"}</small>
              </button>
            })}
          </div>
          {doDia.length === 0 ? (
            <div className="esc-vazio">Ninguém escalado neste dia.{d.podeEditar && <> <button className="esc-link" onClick={() => abrirNovo("", dia)}>Colocar um horário</button></>}</div>
          ) : (
            <div className="esc-regua-caixa">
              <div className="esc-regua">
                <span className="esc-regua-nome" />
                <div className="esc-horas">{Array.from({ length: REGUA_HORAS / 2 + 1 }, (_, i) => <span key={i} className={i % 2 ? "esc-impar" : ""} style={{ left: `${i * 2 / REGUA_HORAS * 100}%` }}>{(REGUA_INI + i * 2) % 24}h</span>)}</div>
              </div>
              {porMotoboy.map(([mb, ts]) => (
                <div key={mb} className={`esc-linha ${mb === d.eu ? "eu" : ""}`}>
                  <span className="esc-regua-nome">{primeiro(nomeDe.get(mb) ?? "Motoboy")}{mb === d.eu && <small>você</small>}
                    <em>{ts.map(faixa).join(" e ")}</em></span>
                  <span className="esc-trilho">{ts.map(t => (
                    <button key={t.id} className="esc-barra" style={barra(t)} disabled={!d.podeEditar} onClick={() => abrirTurno(t)} aria-label={`${nomeDe.get(mb) ?? "Motoboy"}, ${faixa(t)}`}><span>{faixa(t)}</span></button>
                  ))}</span>
                  {ts.filter(t => t.observacao || viraNoite(t)).map(t => <small key={t.id} className="esc-obs">{faixa(t)}: {[t.observacao, viraNoite(t) ? "termina no dia seguinte" : null].filter(Boolean).join(", ")}</small>)}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {form && d && (
        <div className="esc-veu" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="esc-caixa" role="dialog" aria-modal="true" aria-label={form.id ? "Mudar turno" : "Novo turno"}>
            <b className="esc-caixa-tit">{form.id ? "Mudar turno" : "Novo turno"}</b>
            <label className="esc-campo"><span>Motoboy</span>
              <select value={form.motoboy_id} onChange={e => setForm({ ...form, motoboy_id: e.target.value })}>
                <option value="">Escolha</option>
                {d.motoboys.filter(m => m.ativo || m.id === form.motoboy_id).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </label>
            <label className="esc-campo"><span>Dia</span>
              <select value={form.data} onChange={e => setForm({ ...form, data: e.target.value })}>
                {diasSemana.map((ymd, i) => <option key={ymd} value={ymd}>{DIAS[i]}, {diaMes(ymd)} de {MESES[Number(ymd.slice(5, 7)) - 1]}</option>)}
              </select>
            </label>
            <div className="esc-dupla">
              <label className="esc-campo"><span>Começa</span><input type="time" step={900} value={form.inicio} onChange={e => setForm({ ...form, inicio: e.target.value })} /></label>
              <label className="esc-campo"><span>Termina</span><input type="time" step={900} value={form.fim} onChange={e => setForm({ ...form, fim: e.target.value })} /></label>
            </div>
            {form.inicio && form.fim && viraNoite(form) && <p className="esc-dica">Termina no dia seguinte, às {hora(form.fim)}.</p>}
            <label className="esc-campo"><span>Observação (opcional)</span><input value={form.observacao} maxLength={120} placeholder="Ex.: cobre a Petiscaria" onChange={e => setForm({ ...form, observacao: e.target.value })} /></label>
            {aviso && !aviso.ok && <div className="esc-aviso erro">{aviso.t}</div>}
            <div className="esc-caixa-pe">
              {form.id && (apagar
                ? <button className="esc-bt esc-bt-perigo" disabled={salvando} onClick={confirmarApagar}>Apagar mesmo</button>
                : <button className="esc-bt esc-bt-l" onClick={() => setApagar(true)}>Apagar turno</button>)}
              <span className="esc-esp" />
              <button className="esc-bt" onClick={() => setForm(null)}>Cancelar</button>
              <button className="esc-bt esc-bt-p" disabled={salvando || !form.motoboy_id || !form.inicio || !form.fim} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
