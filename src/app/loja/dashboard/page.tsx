"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth"
import { hojeYmdBrt, type ChavePeriodo, labelComparacao } from "@/lib/periodoBrt"
import { OPERACIONAL_LABEL, type StatusOperacional } from "@/lib/statusPedido"
import GraficoVendas from "./GraficoVendas"

const PERIODOS: { key: ChavePeriodo; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "custom", label: "Personalizado" },
]

const OPERACAO_ICONE: Record<StatusOperacional, React.ReactNode> = {
  novo: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="12" /><circle cx="12" cy="16" r="0.5" fill="currentColor" />
    </svg>
  ),
  preparo: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />
    </svg>
  ),
  pronto: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  aguardando_motoboy: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="M9 18h5l-2-7h-4l-1 3" /><path d="M11 11l2-4h3" />
    </svg>
  ),
  em_entrega: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h13l-3-4M16 16l3-4" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" />
    </svg>
  ),
}

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

// Drill-down dos KPIs (spec seção 11) — Vendas/Pedidos/Taxa de conclusão navegam pro
// Histórico (única tela que já lista entregue+coletado+cancelado com filtro de
// período). "custom" (Personalizado) do Dashboard não tem equivalente exato no
// Histórico (que só tem hoje/semana/mês/total) — cai em "total" como aproximação mais
// ampla, nunca inventando um recorte de data que o Histórico não sabe fazer.
function periodoParaHistorico(chave: ChavePeriodo): "hoje" | "semana" | "mes" | "total" {
  if (chave === "hoje") return "hoje"
  if (chave === "semana") return "semana"
  if (chave === "mes") return "mes"
  return "total"
}

function dataHojeLabel(): string {
  const texto = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date())
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function Variacao({ pct }: { pct: number | null }) {
  if (pct == null) return <span style={{ color: "var(--suave)", fontSize: 12 }}>—</span>
  const positivo = pct >= 0
  return (
    <span style={{ color: positivo ? "var(--folha)" : "var(--pimenta)", fontSize: 12, fontWeight: 700 }}>
      {positivo ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

// KPIs viram drill-down: Vendas/Pedidos/Taxa navegam pro Histórico filtrado pelo mesmo
// período (spec seção 11); Ticket médio não navega — só revela o cálculo por cima do
// próprio card (onClick em vez de href), porque não é uma lista, é uma conta.
function KpiCard({ label, valor, sub, variacaoPct, cor, destaque, area, href, onClick }: {
  label: string; valor: string; sub?: string; variacaoPct?: number | null; cor?: string; destaque?: boolean; area: string
  href?: string; onClick?: () => void
}) {
  const clicavel = !!href || !!onClick
  const conteudo = (
    <>
      <p style={{ color: destaque ? "var(--pimenta-esc)" : "var(--suave)", fontSize: destaque ? 12 : 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>{label}</p>
      <p style={{ color: cor ?? "var(--grafite)", fontWeight: 900, fontSize: destaque ? 30 : 21, lineHeight: 1.1, marginBottom: 6, wordBreak: "break-word" }}>{valor}</p>
      {variacaoPct !== undefined ? <Variacao pct={variacaoPct} /> : sub ? <p style={{ color: "var(--suave)", fontSize: 12 }}>{sub}</p> : null}
    </>
  )
  const style: React.CSSProperties = {
    padding: destaque ? "18px 18px" : "14px 16px",
    background: destaque ? "linear-gradient(155deg, var(--pimenta-claro), #ffffff 60%)" : "#ffffff",
    borderColor: destaque ? "rgba(215,38,30,0.25)" : undefined,
    gridArea: area,
    textAlign: "left", textDecoration: "none", display: "block", width: "100%",
    cursor: clicavel ? "pointer" : "default",
  }
  if (href) return <Link href={href} className="card" style={style}>{conteudo}</Link>
  if (onClick) return <button type="button" className="card" onClick={onClick} style={{ ...style, margin: 0, font: "inherit" }}>{conteudo}</button>
  return <div className="card" style={style}>{conteudo}</div>
}

// Identidade suave por status operacional — cores servem pra reconhecimento rápido, não
// pra deixar o Dashboard colorido demais (spec: backgrounds MUITO leves, ícone com
// contraste melhor que o cinza neutro do round 1).
const OPERACAO_ESTILO: Record<StatusOperacional, { bg: string; fg: string; border: string }> = {
  novo: { bg: "var(--pimenta-claro)", fg: "var(--pimenta-esc)", border: "#FFEDD5" },
  preparo: { bg: "var(--pequi-claro)", fg: "#B45309", border: "#FEF3C7" },
  pronto: { bg: "#F5F3FF", fg: "#6D28D9", border: "#EDE9FE" },
  aguardando_motoboy: { bg: "#EFF6FF", fg: "#1D4ED8", border: "#DBEAFE" },
  em_entrega: { bg: "var(--folha-claro)", fg: "var(--folha)", border: "#DCFCE7" },
}

function CardOperacional({ tipo, qtd }: { tipo: StatusOperacional; qtd: number }) {
  const estilo = OPERACAO_ESTILO[tipo]
  const temQtd = qtd > 0
  const precisaAtencao = tipo === "novo" && temQtd
  return (
    <Link href={`/loja?foco=${tipo}`} className="card" style={{
      padding: "15px 14px", textDecoration: "none", display: "flex", flexDirection: "column", gap: 8,
      transition: "transform 0.12s, box-shadow 0.12s", cursor: "pointer", position: "relative",
      background: temQtd ? estilo.bg : "#ffffff",
      borderColor: temQtd ? estilo.border : undefined,
    }}>
      {precisaAtencao && (
        <span style={{
          position: "absolute", top: 10, right: 10, width: 9, height: 9, borderRadius: "50%",
          background: "var(--pimenta)", border: "2px solid var(--pimenta-claro)",
        }} title="Precisa de atenção" />
      )}
      <span style={{ color: temQtd ? estilo.fg : "var(--linha)" }}>{OPERACAO_ICONE[tipo]}</span>
      <p style={{ color: temQtd ? estilo.fg : "var(--grafite)", fontWeight: 900, fontSize: 28, lineHeight: 1 }}>{qtd}</p>
      <p style={{ color: temQtd ? estilo.fg : "var(--suave)", fontSize: 12, fontWeight: 700, opacity: temQtd ? 0.85 : 1 }}>{OPERACIONAL_LABEL[tipo]}</p>
    </Link>
  )
}

// Mesma paleta de OPERACAO_ESTILO (identidade única por status em todo o Dashboard) —
// pendente/aceito/etc mapeiam pro grupo operacional; entregue/cancelado têm cor própria.
const STATUS_COR: Record<string, string> = {
  pendente: "var(--pimenta-esc)", aceito: "#B45309", preparando: "#B45309",
  pronto: "#1D4ED8", aguardando_aceite: "#1D4ED8",
  indo_para_loja: "var(--folha)", na_loja: "var(--folha)", em_rota: "var(--folha)", coletado: "var(--folha)",
  entregue: "var(--folha)", cancelado: "var(--pimenta)", aguardando_pagamento: "var(--suave)",
}
// Pra onde levar ao clicar num pedido específico: ativos aparecem em /loja (fila do
// dia), entregue/cancelado só aparecem em /loja/historico (não existe tela de detalhe
// por id — leva pra tela certa em vez de linkar pra um lugar onde o pedido não aparece).
function rotaDoPedido(status: string): string {
  return status === "entregue" || status === "cancelado" ? "/loja/historico" : "/loja"
}

interface DadosDashboard {
  lojaNome: string | null
  aberto: boolean
  kpis: {
    vendas: number; vendasVariacaoPct: number | null
    pedidos: number; pedidosVariacaoPct: number | null
    ticketMedio: number; ticketMedioVariacaoPct: number | null
    taxaConclusao: number | null; cancelados: number
  }
  operacaoAgora: Record<StatusOperacional, number>
  serie: { rotulo: string; vendas: number; pedidos: number }[]
  maisVendidos: { produto_id: string | null; nome: string; qtd: number; valorTotal: number; foto_url: string | null }[]
  ultimosPedidos: { id: string; codigo: string; cliente: string; status: string; statusLabel: string; valor: number; tempoLabel: string; tempoTipo: "decorrido" | "duracao" | "indisponivel" }[]
  horarioPico: { faixa: string; participacaoPct: number } | null
  desempenho: { tempoPreparoMin: number | null; amostraPreparo: number; tempoEntregaMin: number | null; amostraEntrega: number; taxaCancelamento: number | null }
}

export default function VisaoGeralPage() {
  const { sessao } = useAuth()
  const loja_id = sessao?.role === "lojista" ? sessao.loja_id : null

  const [periodo, setPeriodo] = useState<ChavePeriodo>("hoje")
  const [customInicio, setCustomInicio] = useState(hojeYmdBrt())
  const [customFim, setCustomFim] = useState(hojeYmdBrt())
  const [mesSel, setMesSel] = useState("")
  const [erroCustom, setErroCustom] = useState("")

  const [dados, setDados] = useState<DadosDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState("")
  const [verTodosVendidos, setVerTodosVendidos] = useState(false)
  const [mostrarCalculoTicket, setMostrarCalculoTicket] = useState(false)

  const carregar = useCallback(async () => {
    if (!loja_id) return
    if (periodo === "custom") {
      if (!customInicio || !customFim) return
      if (customInicio > customFim) { setErroCustom("Data final não pode ser anterior à inicial"); return }
    }
    setErroCustom("")
    setLoading(true)
    setErro("")
    const params = new URLSearchParams({ periodo })
    if (periodo === "custom") { params.set("inicio", customInicio); params.set("fim", customFim) }
    try {
      const res = await fetch(`/api/loja/dashboard?${params.toString()}`, { credentials: "include" })
      if (!res.ok) { setErro("Não foi possível carregar os dados agora."); setLoading(false); return }
      const json = await res.json()
      setDados(json)
    } catch {
      setErro("Não foi possível carregar os dados agora.")
    }
    setLoading(false)
  }, [loja_id, periodo, customInicio, customFim])

  useEffect(() => { carregar() }, [carregar])

  const listaVendidos = dados ? (verTodosVendidos ? dados.maisVendidos : dados.maisVendidos.slice(0, 5)) : []

  return (
    <div style={{ padding: "20px 16px 32px", maxWidth: 1180, margin: "0 auto" }}>
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          
          <p style={{ color: "var(--suave)", fontSize: 13, marginTop: 2 }}>Acompanhe o desempenho da sua loja em tempo real.</p>
        </div>
        {dados && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <p style={{ color: "var(--suave)", fontSize: 12, fontWeight: 600 }}>{dataHojeLabel()}</p>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999,
              background: dados.aberto ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: dados.aberto ? "var(--folha)" : "var(--pimenta)" }} />
              <span style={{ fontSize: 12.5, fontWeight: 800, color: dados.aberto ? "var(--folha)" : "var(--pimenta)" }}>
                {dados.aberto ? "Loja aberta" : "Loja fechada"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Filtros de período */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {PERIODOS.map(p => (
            <button key={p.key} onClick={() => { setPeriodo(p.key); setMesSel("") }} style={{
              padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
              cursor: "pointer", border: "1px solid var(--linha)", flexShrink: 0,
              background: periodo === p.key ? "var(--pimenta)" : "#ffffff",
              color: periodo === p.key ? "white" : "var(--suave)",
            }}>
              {p.label}
            </button>
          ))}
        </div>
        {/* Meses anteriores (pedido do Lucas): escolhe o mês e vira período personalizado do 1º ao último dia */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--suave)", fontWeight: 700 }}>Ver um mês:</span>
          <select value={mesSel} onChange={e => { const v = e.target.value; setMesSel(v); if (!v) return; const [a, m] = v.split("-").map(Number); const ult = new Date(Date.UTC(a, m, 0)).getUTCDate(); const fim = `${v}-${String(ult).padStart(2, "0")}`; setCustomInicio(`${v}-01`); setCustomFim(fim > hojeYmdBrt() ? hojeYmdBrt() : fim); setPeriodo("custom") }}
            style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid var(--linha)", background: "#fff", color: "var(--grafite)", fontSize: 13, fontWeight: 700 }}>
            <option value="">Escolher</option>
            {Array.from({ length: 6 }, (_, k) => { const h = hojeYmdBrt(); const d = new Date(Date.UTC(Number(h.slice(0, 4)), Number(h.slice(5, 7)) - 1 - k, 1)); const v = d.toISOString().slice(0, 7); return <option key={v} value={v}>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(d)}</option> })}
          </select>
        </div>
        {periodo === "custom" && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
            <input type="date" value={customInicio} max={customFim} onChange={e => setCustomInicio(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 10, background: "var(--pedra)", border: "1px solid var(--linha)", color: "var(--grafite)", outline: "none", fontSize: 13, flex: 1, minWidth: 130 }} />
            <span style={{ color: "var(--suave)" }}>até</span>
            <input type="date" value={customFim} min={customInicio} max={hojeYmdBrt()} onChange={e => setCustomFim(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 10, background: "var(--pedra)", border: "1px solid var(--linha)", color: "var(--grafite)", outline: "none", fontSize: 13, flex: 1, minWidth: 130 }} />
          </div>
        )}
        {erroCustom && <p style={{ color: "var(--pimenta)", fontSize: 12.5, marginTop: 6, fontWeight: 600 }}>{erroCustom}</p>}
      </div>

      {loading && !dados ? (
        <SkeletonDashboard />
      ) : erro ? (
        <div className="card" style={{ padding: "24px 18px", textAlign: "center" }}>
          <p style={{ color: "var(--pimenta)", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{erro}</p>
          <button onClick={carregar} style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid var(--linha)", background: "white", color: "var(--texto)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Tentar de novo
          </button>
        </div>
      ) : dados ? (
        <>
          {/* KPIs — Vendas em destaque (KPI principal). No mobile: Vendas ocupa a linha
              inteira, Pedidos+Ticket dividem uma linha, Taxa de conclusão fica sozinha
              embaixo (spec seção 11). No desktop os 4 ficam lado a lado. */}
          <div className="kpi-grid" style={{ marginBottom: mostrarCalculoTicket ? 10 : 20 }}>
            <KpiCard area="vendas" destaque label="Vendas" valor={fmtMoeda(dados.kpis.vendas)} variacaoPct={periodo !== "custom" ? dados.kpis.vendasVariacaoPct : undefined}
              sub={periodo === "custom" ? undefined : labelComparacao(periodo)} cor="var(--grafite)" href={`/loja/historico?periodo=${periodoParaHistorico(periodo)}`} />
            <KpiCard area="pedidos" label="Pedidos" valor={String(dados.kpis.pedidos)} variacaoPct={periodo !== "custom" ? dados.kpis.pedidosVariacaoPct : undefined}
              sub={periodo === "custom" ? undefined : labelComparacao(periodo)} href={`/loja/historico?periodo=${periodoParaHistorico(periodo)}`} />
            <KpiCard area="ticket" label="Ticket médio" valor={fmtMoeda(dados.kpis.ticketMedio)} variacaoPct={periodo !== "custom" ? dados.kpis.ticketMedioVariacaoPct : undefined}
              sub={periodo === "custom" ? undefined : labelComparacao(periodo)} onClick={() => setMostrarCalculoTicket(v => !v)} />
            <KpiCard
              area="taxa"
              label="Taxa de conclusão"
              valor={dados.kpis.taxaConclusao != null ? `${dados.kpis.taxaConclusao.toFixed(0)}%` : "—"}
              sub={`${dados.kpis.cancelados} cancelado${dados.kpis.cancelados !== 1 ? "s" : ""}`}
              cor={dados.kpis.taxaConclusao != null && dados.kpis.taxaConclusao < 80 ? "var(--pimenta)" : "var(--grafite)"}
              href={`/loja/historico?periodo=${periodoParaHistorico(periodo)}`}
            />
          </div>

          {/* Ticket médio não navega (não é lista, é conta) — clicar no card revela o
              cálculo por extenso, spec seção 11. */}
          {mostrarCalculoTicket && (
            <div className="card" style={{ padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <p style={{ color: "var(--texto)", fontSize: 13 }}>
                <strong style={{ color: "var(--grafite)" }}>Ticket médio</strong> = vendas ÷ pedidos válidos no período · {fmtMoeda(dados.kpis.vendas)} ÷ {dados.kpis.pedidos || 1} = <strong style={{ color: "var(--pimenta)" }}>{fmtMoeda(dados.kpis.ticketMedio)}</strong>
              </p>
              <button type="button" onClick={() => setMostrarCalculoTicket(false)} style={{ background: "none", border: "none", color: "var(--suave)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Fechar</button>
            </div>
          )}

          {/* Operação agora */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <p style={{ color: "var(--grafite)", fontWeight: 900, fontSize: 15 }}>Operação agora</p>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--folha)", fontWeight: 700 }}>
                <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--folha)", display: "inline-block" }} />
                Em tempo real
              </span>
            </div>
            <div className="dash-grid-4">
              <CardOperacional tipo="novo" qtd={dados.operacaoAgora.novo} />
              <CardOperacional tipo="preparo" qtd={dados.operacaoAgora.preparo} />
              <CardOperacional tipo="pronto" qtd={dados.operacaoAgora.pronto} />
              <CardOperacional tipo="aguardando_motoboy" qtd={dados.operacaoAgora.aguardando_motoboy} />
              <CardOperacional tipo="em_entrega" qtd={dados.operacaoAgora.em_entrega} />
            </div>
          </div>

          {/* Gráfico + Mais vendidos — stretch pra acompanhar a altura um do outro */}
          {/* Período maior que uma semana: gráfico na linha inteira, com o valor em cima de cada barra */}
          <div className={dados.serie.length > 8 ? "" : "dash-grid-2"} style={{ marginBottom: 20, alignItems: "stretch", display: dados.serie.length > 8 ? "flex" : undefined, flexDirection: "column", gap: 12 }}>
            <GraficoVendas serie={dados.serie} largo={dados.serie.length > 8} />

            <div className="card" style={{ padding: "18px 16px", display: "flex", flexDirection: "column" }}>
              <p style={{ color: "var(--grafite)", fontWeight: 900, fontSize: 15, marginBottom: 14 }}>Mais vendidos</p>
              {dados.maisVendidos.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ color: "var(--suave)", fontSize: 13 }}>Sem vendas neste período</p>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 13, flex: 1 }}>
                    {listaVendidos.map((p, i) => (
                      <div key={p.produto_id ?? p.nome} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 900, minWidth: 16, color: i === 0 ? "var(--pequi)" : i === 1 ? "var(--suave)" : "var(--linha)" }}>{i + 1}º</span>
                        {p.foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.foto_url} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--pedra)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15 }}>🍽️</div>
                        )}
                        <span style={{ color: "var(--texto)", fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</span>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ color: "var(--pimenta)", fontWeight: 800, fontSize: 13 }}>{p.qtd}×</p>
                          {p.valorTotal > 0 && <p style={{ color: "var(--suave)", fontSize: 10.5 }}>{fmtMoeda(p.valorTotal)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {dados.maisVendidos.length > 5 && (
                    <button onClick={() => setVerTodosVendidos(v => !v)} style={{ marginTop: 14, background: "none", border: "none", color: "var(--pimenta)", fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0, textAlign: "left" }}>
                      {verTodosVendidos ? "Ver menos" : "Ver todos"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Últimos pedidos + Insights operacionais */}
          <div className="dash-grid-2" style={{ alignItems: "start" }}>
            <div className="card" style={{ padding: "18px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <p style={{ color: "var(--grafite)", fontWeight: 900, fontSize: 15 }}>Últimos pedidos</p>
                <Link href="/loja" style={{ color: "var(--pimenta)", fontWeight: 700, fontSize: 12.5, textDecoration: "none" }}>Ver todos</Link>
              </div>
              {dados.ultimosPedidos.length === 0 ? (
                <p style={{ color: "var(--suave)", fontSize: 13 }}>Nenhum pedido ainda</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {dados.ultimosPedidos.map(p => (
                    <Link key={p.id} href={rotaDoPedido(p.status)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "11px 12px", borderRadius: 10, background: "var(--pedra)", border: "1px solid var(--linha)", textDecoration: "none",
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ color: "var(--grafite)", fontSize: 13, fontWeight: 700 }}>#{p.codigo} · {p.cliente}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                          <span style={{
                            fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                            background: `color-mix(in srgb, ${STATUS_COR[p.status] ?? "var(--suave)"} 10%, transparent)`, color: STATUS_COR[p.status] ?? "var(--suave)",
                          }}>
                            {p.statusLabel}
                          </span>
                          <span style={{ color: "var(--suave)", fontSize: 11 }}>{p.tempoLabel}</span>
                        </div>
                      </div>
                      <p style={{ color: "var(--grafite)", fontWeight: 800, fontSize: 14, flexShrink: 0, marginLeft: 8 }}>R$ {Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Horários de pico */}
              <div className="card" style={{ padding: "18px 16px" }}>
                <p style={{ color: "var(--grafite)", fontWeight: 900, fontSize: 15, marginBottom: 10 }}>Horários de pico</p>
                {dados.horarioPico ? (
                  <>
                    <p style={{ color: "var(--pimenta)", fontWeight: 900, fontSize: 22, marginBottom: 4 }}>{dados.horarioPico.faixa}</p>
                    <p style={{ color: "var(--suave)", fontSize: 12.5 }}>
                      {periodo === "hoje" ? "Maior movimento hoje" : "Maior movimento no período"} · {dados.horarioPico.participacaoPct}% das vendas
                    </p>
                  </>
                ) : (
                  <p style={{ color: "var(--suave)", fontSize: 13 }}>Dados insuficientes para o período</p>
                )}
              </div>

              {/* Desempenho operacional */}
              <div className="card" style={{ padding: "18px 16px" }}>
                <p style={{ color: "var(--grafite)", fontWeight: 900, fontSize: 15, marginBottom: 14 }}>Desempenho operacional</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <LinhaDesempenho
                    label="Tempo médio de preparo"
                    valor={dados.desempenho.tempoPreparoMin != null ? `${Math.round(dados.desempenho.tempoPreparoMin)} min` : "—"}
                    amostra={dados.desempenho.amostraPreparo}
                  />
                  <LinhaDesempenho
                    label="Tempo médio de entrega"
                    valor={dados.desempenho.tempoEntregaMin != null ? `${Math.round(dados.desempenho.tempoEntregaMin)} min` : "—"}
                    amostra={dados.desempenho.amostraEntrega}
                  />
                  <LinhaDesempenho
                    label="Taxa de cancelamento"
                    valor={dados.desempenho.taxaCancelamento != null ? `${dados.desempenho.taxaCancelamento.toFixed(1)}%` : "—"}
                    cor={dados.desempenho.taxaCancelamento != null && dados.desempenho.taxaCancelamento > 10 ? "var(--pimenta)" : undefined}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <style>{`
        .dash-grid-4 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .dash-grid-2 { display: grid; grid-template-columns: 1fr; gap: 16px; }
        .kpi-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
          grid-template-areas: "vendas vendas" "pedidos ticket" "taxa taxa";
        }
        @media (min-width: 640px) {
          .dash-grid-4 { grid-template-columns: repeat(5, 1fr); }
          .kpi-grid { grid-template-columns: repeat(4, 1fr); grid-template-areas: "vendas pedidos ticket taxa"; }
        }
        @media (min-width: 900px) {
          .dash-grid-2 { grid-template-columns: 1fr 1fr; }
        }
        .pulse-dot { animation: dash-pulse 1.6s ease-in-out infinite; }
        @keyframes dash-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>
    </div>
  )
}

function LinhaDesempenho({ label, valor, amostra, cor }: { label: string; valor: string; amostra?: number; cor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <div>
        <p style={{ color: "var(--texto)", fontSize: 13, fontWeight: 600 }}>{label}</p>
        {amostra !== undefined && amostra > 0 && <p style={{ color: "var(--suave)", fontSize: 10.5 }}>Baseado em {amostra} pedido{amostra !== 1 ? "s" : ""}</p>}
      </div>
      <p style={{ color: cor ?? "var(--grafite)", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{valor}</p>
    </div>
  )
}

function SkeletonDashboard() {
  const bloco = (h: number) => <div className="card" style={{ height: h, background: "linear-gradient(90deg,var(--pedra) 25%,var(--pedra) 37%,var(--pedra) 63%)", backgroundSize: "400% 100%", animation: "skeleton 1.4s ease infinite" }} />
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="dash-grid-4">{[0, 1, 2, 3].map(i => <div key={i}>{bloco(90)}</div>)}</div>
      <div className="dash-grid-5">{[0, 1, 2, 3, 4].map(i => <div key={i}>{bloco(100)}</div>)}</div>
      {bloco(220)}
      <style>{`
        .dash-grid-4, .dash-grid-5 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        @media (min-width: 640px) {
          .dash-grid-4 { grid-template-columns: repeat(4, 1fr); }
          .dash-grid-5 { grid-template-columns: repeat(5, 1fr); }
        }
        @keyframes skeleton { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
      `}</style>
    </div>
  )
}

