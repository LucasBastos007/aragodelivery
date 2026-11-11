"use client"

// Reembolsos (admin 2.0, 20/10/2026), abre numa gaveta no Início (pedido do Lucas: sem categoria própria).
// Só o admin decide: devolver tudo, devolver parte ou negar.
// Mesmas APIs de antes: /api/reembolso/listar e /api/reembolso/processar (aprovar já estorna).
import { useEffect, useState } from "react"
import { R } from "./_dinheiro"

type Reembolso = {
  id: string; pedido_id: string; solicitado_em: string; solicitado_por: string; motivo: string; descricao: string; foto_url: string; status: string
  aprovado_por: string | null; aprovado_em: string | null; valor_solicitado: number | null; valor_aprovado: number | null; asaas_refund_id: string | null; negado_motivo: string | null
  pedido: { id: string; codigo: string; total: number; nome_cliente: string | null; forma_pagamento: string; loja?: { nome: string } }
}
const ST: Record<string, [string, string]> = { solicitado: ["Esperando você", "amarelo"], aprovado: ["Aprovado", "azul"], processando: ["Estornando", "roxo"], concluido: ["Devolvido", "verde"], negado: ["Negado", "vermelho"] }
const MOTIVO: Record<string, string> = { nao_recebeu: "Não recebeu o pedido", pedido_errado: "Veio errado", qualidade: "Problema de qualidade", duplicado: "Cobrança duplicada", cancelamento: "Cancelamento", outro: "Outro motivo" }
const FORMA: Record<string, string> = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha" }
const mascara = (v: string) => { const d = v.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9); return d ? (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "" }
const paraNum = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

export default function ReembolsosPainel({ onMudou, codigoInicial }: { onMudou?: () => void; codigoInicial?: string }) {
  const [lista, setLista] = useState<Reembolso[]>([])
  const [carregou, setCarregou] = useState(false)
  const [filtro, setFiltro] = useState("solicitado")
  const [sel, setSel] = useState<Reembolso | null>(null)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)

  async function load() {
    const r = await fetch("/api/reembolso/listar", { credentials: "include" })
    const j = await r.json().catch(() => ({}))
    setLista(j.reembolsos ?? []); setCarregou(true); onMudou?.()
  }
  useEffect(() => { load() }, [])

  // Reembolso feito pelo admin, sem o cliente pedir (20/10/2026)
  const [novo, setNovo] = useState(!!codigoInicial), [cod, setCod] = useState(codigoInicial ?? ""), [motNovo, setMotNovo] = useState("outro"), [descNovo, setDescNovo] = useState("")
  const [achado, setAchado] = useState<any>(null), [erroNovo, setErroNovo] = useState(""), [envNovo, setEnvNovo] = useState(false)
  async function buscarPedido(c = cod) {
    setErroNovo(""); setAchado(null); if (!c.trim()) return
    const r = await fetch(`/api/admin/reembolso-criar?codigo=${encodeURIComponent(c.trim())}`, { credentials: "include" }); const j = await r.json().catch(() => ({}))
    if (!r.ok) { setErroNovo(j.error ?? "Pedido não encontrado."); return } setAchado(j)
  }
  useEffect(() => { if (codigoInicial) buscarPedido(codigoInicial) }, [codigoInicial]) // eslint-disable-line react-hooks/exhaustive-deps
  async function criarReembolso() {
    setEnvNovo(true); setErroNovo("")
    const r = await fetch("/api/admin/reembolso-criar", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo: achado.pedido.codigo, motivo: motNovo, descricao: descNovo }) })
    const j = await r.json().catch(() => ({})); setEnvNovo(false)
    if (!r.ok) { setErroNovo(j.error ?? "Não deu certo."); return }
    const rr = await fetch("/api/reembolso/listar", { credentials: "include" }).then(x => x.json()).catch(() => ({}))
    const lista2: Reembolso[] = rr.reembolsos ?? []; setLista(lista2); onMudou?.()
    const criado = lista2.find(x => x.id === j.reembolso_id)
    setNovo(false); setAchado(null); setCod(""); setDescNovo(""); setFiltro("solicitado")
    if (criado) setSel(criado) // abre direto a decisão: devolver tudo ou parte
  }

  const conta = (s: string) => lista.filter(r => s === "todos" || r.status === s).length
  const vis = lista.filter(r => filtro === "todos" || r.status === filtro)
  const pend = lista.filter(r => r.status === "solicitado")
  const emAnalise = pend.reduce((t, r) => t + Number(r.valor_solicitado ?? r.pedido?.total ?? 0), 0)
  const devolvido = lista.filter(r => r.status === "concluido" || r.status === "aprovado" || r.status === "processando").reduce((t, r) => t + Number(r.valor_aprovado ?? 0), 0)

  return (
    <>
      <div className="kpis4">
        <div className="cartao kpi2"><small>Esperando você</small><b className="num" style={{ color: pend.length ? "var(--pimenta)" : undefined }}>{pend.length}</b><span className="t14 mut">{pend.length ? "decida o quanto antes" : "nada pendente"}</span></div>
        <div className="cartao kpi2"><small>Valor em análise</small><b className="num">{R(emAnalise)}</b><span className="t14 mut">separado no saldo do Asaas</span></div>
        <div className="cartao kpi2"><small>Já devolvido</small><b className="num">{R(devolvido)}</b><span className="t14 mut">aprovados e estornados</span></div>
        <div className="cartao kpi2"><small>Negados</small><b className="num">{conta("negado")}</b><span className="t14 mut">com motivo registrado</span></div>
      </div>
      {msg && <div className={`aviso ${msg.ok ? "vd" : "vm"}`} role="status" style={{ marginBottom: 12 }}>{msg.t}</div>}
      <div className="cartao rb-novo">
        <div className="lin" style={{ gap: 10, flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 200 }}><b className="t16b">Fazer um reembolso</b><br /><span className="t14 mut">Devolver dinheiro de um pedido sem o cliente pedir.</span></span>
          {!novo && <button className="btn btn-s" onClick={() => setNovo(true)}>Fazer reembolso</button>}
        </div>
        {novo && <div style={{ marginTop: 10 }}>
          <div className="lin" style={{ gap: 8 }}>
            <input className="pd-sel" style={{ flex: 1, minWidth: 0 }} placeholder="Código do pedido, ex.: Z5A4S3" value={cod} onChange={e => setCod(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === "Enter") buscarPedido() }} />
            <button className="btn btn-s" onClick={() => buscarPedido()}>Buscar</button>
            <button className="btn btn-l" onClick={() => { setNovo(false); setAchado(null); setErroNovo("") }}>Fechar</button>
          </div>
          {erroNovo && <div className="aviso vm" style={{ marginTop: 8 }}>{erroNovo}</div>}
          {achado && <div className="rb-achado">
            <div className="rb-grade">
              <span><small>Pedido</small><b>#{achado.pedido.codigo}</b></span>
              <span><small>Loja</small><b>{achado.pedido.loja?.nome ?? "—"}</b></span>
              <span><small>Cliente</small><b>{achado.pedido.nome_cliente ?? "—"}</b></span>
              <span><small>Valor pago</small><b className="num">{R(achado.pedido.total)} <em className="mut">{FORMA[achado.pedido.forma_pagamento] ?? achado.pedido.forma_pagamento}</em></b></span>
            </div>
            {achado.abertos?.length > 0 && <p className="t14" style={{ color: "var(--pimenta-esc)", marginTop: 6 }}>Esse pedido já tem reembolso ({ST[achado.abertos[0].status]?.[0] ?? achado.abertos[0].status}).</p>}
            <div className="lin" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <select className="pd-sel" value={motNovo} onChange={e => setMotNovo(e.target.value)}>{Object.entries(MOTIVO).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
              <input className="pd-sel" style={{ flex: 1, minWidth: 180 }} placeholder="Observação (opcional)" value={descNovo} onChange={e => setDescNovo(e.target.value)} />
              <button className="btn btn-p" disabled={envNovo || achado.abertos?.length > 0} onClick={criarReembolso}>{envNovo ? "Abrindo…" : "Continuar"}</button>
            </div>
            <p className="t12 mut" style={{ marginTop: 6 }}>No próximo passo você escolhe devolver tudo ou parte. Pix e cartão voltam pelo Asaas; dinheiro e maquininha ficam registrados pra você devolver na mão.</p>
          </div>}
        </div>}
      </div>
      <div className="chips-l" style={{ marginBottom: 12 }}>
        {["solicitado", "processando", "concluido", "negado", "todos"].map(s => <button key={s} className="chip" aria-pressed={filtro === s} onClick={() => setFiltro(s)}>{s === "todos" ? "Todos" : ST[s][0]} <span className="pd-n">{conta(s)}</span></button>)}
      </div>

      {!carregou ? <p className="mut">Carregando…</p> : vis.length === 0 ? (
        <div className="cartao dsp-vazio"><b>{filtro === "solicitado" ? "Nenhum pedido de reembolso esperando" : "Nada aqui"}</b><span>Quando um cliente pedir reembolso, ou você fizer um acima, ele aparece aqui pra você decidir.</span></div>
      ) : (
        <div className="rb-lista">
          {vis.map(r => { const st = ST[r.status] ?? [r.status, "cinza"]; return (
            <div key={r.id} className={`cartao rb-it ${r.status === "solicitado" ? "pend" : ""}`}>
              <div className="rb-cab"><span className={`selo ${st[1]}`}>{st[0]}</span><b className="t16b">#{r.pedido?.codigo}</b><span className="t14 mut">{r.pedido?.loja?.nome ?? "—"}, pedido em {quando(r.solicitado_em)}</span></div>
              <div className="rb-grade">
                <span><small>Cliente</small><b>{r.pedido?.nome_cliente ?? "—"}</b></span>
                <span><small>Motivo</small><b>{MOTIVO[r.motivo] ?? r.motivo}</b></span>
                <span><small>Pedido</small><b className="num">{R(r.pedido?.total)} <em className="mut">{FORMA[r.pedido?.forma_pagamento] ?? r.pedido?.forma_pagamento}</em></b></span>
                <span><small>{r.valor_aprovado != null ? "Devolvido" : "Pediu de volta"}</small><b className="num">{R(r.valor_aprovado ?? r.valor_solicitado ?? r.pedido?.total)}</b></span>
              </div>
              {r.descricao && <p className="rb-desc">“{r.descricao}”</p>}
              {r.negado_motivo && <p className="t14" style={{ color: "var(--pimenta-esc)", marginTop: 6 }}>Negado: {r.negado_motivo}</p>}
              {r.aprovado_por && <p className="t12 mut" style={{ marginTop: 4 }}>Decidido por {r.aprovado_por}{r.aprovado_em ? ` em ${quando(r.aprovado_em)}` : ""}</p>}
              <div className="lin" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {r.foto_url && <a className="btn btn-s" style={{ minHeight: 40 }} href={r.foto_url} target="_blank" rel="noreferrer">Ver foto do cliente</a>}
                {r.status === "solicitado" && <button className="btn btn-p" style={{ minHeight: 40, marginLeft: "auto" }} onClick={() => { setMsg(null); setSel(r) }}>Decidir</button>}
              </div>
            </div>) })}
        </div>
      )}

      {sel && <Decidir r={sel} onFechar={(m) => { setSel(null); if (m) { setMsg(m); load() } }} />}
    </>
  )
}

function Decidir({ r, onFechar }: { r: Reembolso; onFechar: (m?: { t: string; ok: boolean }) => void }) {
  const total = Number(r.pedido?.total ?? 0)
  const [modo, setModo] = useState<"tudo" | "parte" | "negar">("tudo")
  const [valor, setValor] = useState(mascara(String(Math.round(Number(r.valor_solicitado ?? total) * 100))))
  const [motivo, setMotivo] = useState("")
  const [env, setEnv] = useState(false)
  const [erro, setErro] = useState("")
  const v = modo === "tudo" ? total : paraNum(valor)
  const invalido = modo === "parte" ? !(v > 0 && v <= total) : modo === "negar" ? !motivo.trim() : false

  async function enviar() {
    setEnv(true); setErro("")
    const body: Record<string, unknown> = { reembolso_id: r.id, acao: modo === "negar" ? "negar" : "aprovar" }
    if (modo !== "negar") body.valor_aprovado = Math.round(v * 100) / 100
    else body.negado_motivo = motivo.trim()
    const res = await fetch("/api/reembolso/processar", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const j = await res.json().catch(() => ({})); setEnv(false)
    if (!res.ok || j.error) { setErro(j.error ?? "Não deu certo."); return }
    onFechar({ t: modo === "negar" ? `Reembolso do #${r.pedido?.codigo} negado.` : `Aprovado: ${R(v)} voltando pro cliente do #${r.pedido?.codigo}.`, ok: true })
  }

  return (
    <div className="veu on" style={{ zIndex: 95 }} onClick={() => !env && onFechar()}>
      <div className="busca-caixa" onClick={e => e.stopPropagation()}>
        <div className="t20">Reembolso do #{r.pedido?.codigo}</div>
        <p className="t14 mut" style={{ margin: "4px 0 12px" }}>{r.pedido?.nome_cliente ?? "Cliente"}, {MOTIVO[r.motivo] ?? r.motivo}. Pedido de {R(total)} no {FORMA[r.pedido?.forma_pagamento] ?? r.pedido?.forma_pagamento}.</p>
        {r.descricao && <p className="rb-desc" style={{ marginBottom: 12 }}>“{r.descricao}”</p>}
        <div className="pg-modos rb-modos">
          {([["tudo", "Devolver tudo", R(total)], ["parte", "Devolver parte", "você escolhe o valor"], ["negar", "Negar", "com o motivo"]] as const).map(([k, n, s]) => (
            <button key={k} className="cartao" aria-pressed={modo === k} style={modo === k ? { borderColor: k === "negar" ? "var(--pimenta)" : "var(--folha)" } : undefined} onClick={() => { setModo(k); if (k === "parte") setValor("") }}><b>{n}</b><small>{s}</small></button>))}
        </div>
        {modo === "parte" && <label className="campo" style={{ marginTop: 12 }}><span>Quanto devolver (até {R(total)})</span><input inputMode="numeric" placeholder="R$ 0,00" value={valor} onChange={e => setValor(mascara(e.target.value))} /></label>}
        {modo === "negar" && <label className="campo" style={{ marginTop: 12 }}><span>Por que negar? O cliente vê esse motivo.</span><input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: o pedido foi entregue certo, conforme a foto do motoboy" /></label>}
        {modo !== "negar" && <p className="t14 mut" style={{ marginTop: 10 }}>{r.pedido?.forma_pagamento === "pix" || r.pedido?.forma_pagamento === "cartao" ? "O estorno sai pelo Asaas, direto pro cliente." : "Pedido pago na entrega: combine a devolução com o cliente."}</p>}
        {erro && <div className="aviso vm" style={{ marginTop: 10 }}>{erro}</div>}
        <div className="lin" style={{ marginTop: 14, gap: 8 }}>
          <button className="btn btn-s" style={{ flex: 1 }} disabled={env} onClick={() => onFechar()}>Voltar</button>
          <button className={`btn ${modo === "negar" ? "btn-p" : "btn-v"}`} style={{ flex: 2 }} disabled={env || invalido} onClick={enviar}>{env ? "Enviando…" : modo === "negar" ? "Negar reembolso" : `Devolver ${R(v)}`}</button>
        </div>
      </div>
    </div>
  )
}
