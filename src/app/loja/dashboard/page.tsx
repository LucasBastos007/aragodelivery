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
  if (pct == null) return <span style={{ color: "#9CA3AF", fontSize: 12 }}>—</span>
  const positivo = pct >= 0
  return (
    <span style={{ color: positivo ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 700 }}>
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
      <p style={{ color: destaque ? "#c2410c" : "#6B7280", fontSize: destaque ? 12 : 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>{label}</p>
      <p style={{ color: cor ?? "#111827", fontWeight: 900, fontSize: destaque ? 30 : 21, lineHeight: 1.1, marginBottom: 6, wordBreak: "break-word" }}>{valor}</p>
      {variacaoPct !== undefined ? <Variacao pct={variacaoPct} /> : sub ? <p style={{ color: "#9CA3AF", fontSize: 12 }}>{sub}</p> : null}
    </>
  )
  const style: React.CSSProperties = {
    padding: destaque ? "18px 18px" : "14px 16px",
    background: destaque ? "linear-gradient(155deg, #fff7ed, #ffffff 60%)" : "#ffffff",
    borderColor: destaque ? "rgba(249,115,22,0.25)" : undefined,
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
  novo: { bg: "#FFF7ED", fg: "#EA580C", border: "#FFEDD5" },
  preparo: { bg: "#FFFBEB", fg: "#B45309", border: "#FEF3C7" },
  pronto: { bg: "#F5F3FF", fg: "#6D28D9", border: "#EDE9FE" },
  aguardando_motoboy: { bg: "#EFF6FF", fg: "#1D4ED8", border: "#DBEAFE" },
  em_entrega: { bg: "#F0FDF4", fg: "#15803D", border: "#DCFCE7" },
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
          background: "#ef4444", border: "2px solid #FFF7ED",
        }} title="Precisa de atenção" />
      )}
      <span style={{ color: temQtd ? estilo.fg : "#D1D5DB" }}>{OPERACAO_ICONE[tipo]}</span>
      <p style={{ color: temQtd ? estilo.fg : "#111827", fontWeight: 900, fontSize: 28, lineHeight: 1 }}>{qtd}</p>
      <p style={{ color: temQtd ? estilo.fg : "#6B7280", fontSize: 12, fontWeight: 700, opacity: temQtd ? 0.85 : 1 }}>{OPERACIONAL_LABEL[tipo]}</p>
    </Link>
  )
}

// Mesma paleta de OPERACAO_ESTILO (identidade única por status em todo o Dashboard) —
// pendente/aceito/etc mapeiam pro grupo operacional; entregue/cancelado têm cor própria.
const STATUS_COR: Record<string, string> = {
  pendente: "#EA580C", aceito: "#B45309", preparando: "#B45309",
  pronto: "#1D4ED8", aguardando_aceite: "#1D4ED8",
  indo_para_loja: "#15803D", na_loja: "#15803D", em_rota: "#15803D", coletado: "#15803D",
  entregue: "#16a34a", cancelado: "#ef4444", aguardando_pagamento: "#9CA3AF",
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
          <h1 style={{ color: "#111827", fontWeight: 900, fontSize: 20 }}>Visão Geral</h1>
          <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 2 }}>Acompanhe o desempenho da sua loja em tempo real.</p>
        </div>
        {dados && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <p style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 600 }}>{dataHojeLabel()}</p>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999,
              background: dados.aberto ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: dados.aberto ? "#22c55e" : "#ef4444" }} />
              <span style={{ fontSize: 12.5, fontWeight: 800, color: dados.aberto ? "#16a34a" : "#dc2626" }}>
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
            <button key={p.key} onClick={() => setPeriodo(p.key)} style={{
              padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
              cursor: "pointer", border: "1px solid #e5e7eb", flexShrink: 0,
              background: periodo === p.key ? "#f97316" : "#ffffff",
              color: periodo === p.key ? "white" : "#6B7280",
            }}>
              {p.label}
            </button>
          ))}
        </div>
        {periodo === "custom" && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
            <input type="date" value={customInicio} max={customFim} onChange={e => setCustomInicio(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 10, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#111827", outline: "none", fontSize: 13, flex: 1, minWidth: 130 }} />
            <span style={{ color: "#9CA3AF" }}>até</span>
            <input type="date" value={customFim} min={customInicio} max={hojeYmdBrt()} onChange={e => setCustomFim(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 10, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#111827", outline: "none", fontSize: 13, flex: 1, minWidth: 130 }} />
          </div>
        )}
        {erroCustom && <p style={{ color: "#ef4444", fontSize: 12.5, marginTop: 6, fontWeight: 600 }}>{erroCustom}</p>}
      </div>

      {loading && !dados ? (
        <SkeletonDashboard />
      ) : erro ? (
        <div className="card" style={{ padding: "24px 18px", textAlign: "center" }}>
          <p style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{erro}</p>
          <button onClick={carregar} style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid #E5E7EB", background: "white", color: "#374151", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
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
              sub={periodo === "custom" ? undefined : labelComparacao(periodo)} cor="#111827" href={`/loja/historico?periodo=${periodoParaHistorico(periodo)}`} />
            <KpiCard area="pedidos" label="Pedidos" valor={String(dados.kpis.pedidos)} variacaoPct={periodo !== "custom" ? dados.kpis.pedidosVariacaoPct : undefined}
              sub={periodo === "custom" ? undefined : labelComparacao(periodo)} href={`/loja/historico?periodo=${periodoParaHistorico(periodo)}`} />
            <KpiCard area="ticket" label="Ticket médio" valor={fmtMoeda(dados.kpis.ticketMedio)} variacaoPct={periodo !== "custom" ? dados.kpis.ticketMedioVariacaoPct : undefined}
              sub={periodo === "custom" ? undefined : labelComparacao(periodo)} onClick={() => setMostrarCalculoTicket(v => !v)} />
            <KpiCard
              area="taxa"
              label="Taxa de conclusão"
              valor={dados.kpis.taxaConclusao != null ? `${dados.kpis.taxaConclusao.toFixed(0)}%` : "—"}
              sub={`${dados.kpis.cancelados} cancelado${dados.kpis.cancelados !== 1 ? "s" : ""}`}
              cor={dados.kpis.taxaConclusao != null && dados.kpis.taxaConclusao < 80 ? "#ef4444" : "#111827"}
              href={`/loja/historico?periodo=${periodoParaHistorico(periodo)}`}
            />
          </div>

          {/* Ticket médio não navega (não é lista, é conta) — clicar no card revela o
              cálculo por extenso, spec seção 11. */}
          {mostrarCalculoTicket && (
            <div className="card" style={{ padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <p style={{ color: "#374151", fontSize: 13 }}>
                <strong style={{ color: "#111827" }}>Ticket médio</strong> = vendas ÷ pedidos válidos no período · {fmtMoeda(dados.kpis.vendas)} ÷ {dados.kpis.pedidos || 1} = <strong style={{ color: "#f97316" }}>{fmtMoeda(dados.kpis.ticketMedio)}</strong>
              </p>
              <button type="button" onClick={() => setMostrarCalculoTicket(false)} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Fechar</button>
            </div>
          )}

          {/* Operação agora */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <p style={{ color: "#111827", fontWeight: 900, fontSize: 15 }}>Operação agora</p>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#22c55e", fontWeight: 700 }}>
                <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
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
          <div className="dash-grid-2" style={{ marginBottom: 20, alignItems: "stretch" }}>
            <GraficoVendas serie={dados.serie} />

            <div className="card" style={{ padding: "18px 16px", display: "flex", flexDirection: "column" }}>
              <p style={{ color: "#111827", fontWeight: 900, fontSize: 15, marginBottom: 14 }}>Mais vendidos</p>
              {dados.maisVendidos.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ color: "#9CA3AF", fontSize: 13 }}>Sem vendas neste período</p>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 13, flex: 1 }}>
                    {listaVendidos.map((p, i) => (
                      <div key={p.produto_id ?? p.nome} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 900, minWidth: 16, color: i === 0 ? "#f59e0b" : i === 1 ? "#9CA3AF" : "#D1D5DB" }}>{i + 1}º</span>
                        {p.foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.foto_url} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 38, height: 38, borderRadius: 8, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15 }}>🍽️</div>
                        )}
                        <span style={{ color: "#374151", fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</span>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ color: "#f97316", fontWeight: 800, fontSize: 13 }}>{p.qtd}×</p>
                          {p.valorTotal > 0 && <p style={{ color: "#9CA3AF", fontSize: 10.5 }}>{fmtMoeda(p.valorTotal)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {dados.maisVendidos.length > 5 && (
                    <button onClick={() => setVerTodosVendidos(v => !v)} style={{ marginTop: 14, background: "none", border: "none", color: "#f97316", fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0, textAlign: "left" }}>
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
                <p style={{ color: "#111827", fontWeight: 900, fontSize: 15 }}>Últimos pedidos</p>
                <Link href="/loja" style={{ color: "#f97316", fontWeight: 700, fontSize: 12.5, textDecoration: "none" }}>Ver todos</Link>
              </div>
              {dados.ultimosPedidos.length === 0 ? (
                <p style={{ color: "#9CA3AF", fontSize: 13 }}>Nenhum pedido ainda</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {dados.ultimosPedidos.map(p => (
                    <Link key={p.id} href={rotaDoPedido(p.status)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "11px 12px", borderRadius: 10, background: "#F9FAFB", border: "1px solid #e5e7eb", textDecoration: "none",
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ color: "#111827", fontSize: 13, fontWeight: 700 }}>#{p.codigo} · {p.cliente}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                          <span style={{
                            fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                            background: `${STATUS_COR[p.status] ?? "#9CA3AF"}1A`, color: STATUS_COR[p.status] ?? "#9CA3AF",
                          }}>
                            {p.statusLabel}
                          </span>
                          <span style={{ color: "#9CA3AF", fontSize: 11 }}>{p.tempoLabel}</span>
                        </div>
                      </div>
                      <p style={{ color: "#111827", fontWeight: 800, fontSize: 14, flexShrink: 0, marginLeft: 8 }}>R$ {p.valor.toFixed(2)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Horários de pico */}
              <div className="card" style={{ padding: "18px 16px" }}>
                <p style={{ color: "#111827", fontWeight: 900, fontSize: 15, marginBottom: 10 }}>Horários de pico</p>
                {dados.horarioPico ? (
                  <>
                    <p style={{ color: "#f97316", fontWeight: 900, fontSize: 22, marginBottom: 4 }}>{dados.horarioPico.faixa}</p>
                    <p style={{ color: "#6B7280", fontSize: 12.5 }}>
                      {periodo === "hoje" ? "Maior movimento hoje" : "Maior movimento no período"} · {dados.horarioPico.participacaoPct}% das vendas
                    </p>
                  </>
                ) : (
                  <p style={{ color: "#9CA3AF", fontSize: 13 }}>Dados insuficientes para o período</p>
                )}
              </div>

              {/* Desempenho operacional */}
              <div className="card" style={{ padding: "18px 16px" }}>
                <p style={{ color: "#111827", fontWeight: 900, fontSize: 15, marginBottom: 14 }}>Desempenho operacional</p>
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
                    cor={dados.desempenho.taxaCancelamento != null && dados.desempenho.taxaCancelamento > 10 ? "#ef4444" : undefined}
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
        <p style={{ color: "#374151", fontSize: 13, fontWeight: 600 }}>{label}</p>
        {amostra !== undefined && amostra > 0 && <p style={{ color: "#9CA3AF", fontSize: 10.5 }}>Baseado em {amostra} pedido{amostra !== 1 ? "s" : ""}</p>}
      </div>
      <p style={{ color: cor ?? "#111827", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{valor}</p>
    </div>
  )
}

function SkeletonDashboard() {
  const bloco = (h: number) => <div className="card" style={{ height: h, background: "linear-gradient(90deg,#F3F4F6 25%,#F9FAFB 37%,#F3F4F6 63%)", backgroundSize: "400% 100%", animation: "skeleton 1.4s ease infinite" }} />
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

