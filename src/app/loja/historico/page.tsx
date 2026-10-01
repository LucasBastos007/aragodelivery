"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import type { Pedido, FormaPagamento } from "@/types"
import { STATUS_FINAIS } from "@/lib/statusPedido"
import { STATUS_LABEL, PGTO, CANCELADO_POR_LABEL, MOTIVO_CANCELAMENTO_LABEL } from "@/lib/pedidoLabels"
import { imprimirComProtecao } from "@/lib/impressao"
import { ClienteInfo } from "@/components/ClienteInfo"
import { TimelinePedido } from "@/components/TimelinePedido"
import { BotaoImprimir } from "@/components/BotaoImprimir"

// Fase 4 (Histórico) — reescrito em 2026-09-23 a partir da auditoria aprovada.
// Regra central de "isso é Histórico" agora vem de src/lib/statusPedido.ts
// (STATUS_FINAIS = ["entregue","cancelado"]) — nunca mais hardcoded aqui. "coletado" foi
// removido de propósito: é operação ativa (motoboy a caminho), pertence à tela Pedidos.

type Periodo = "hoje" | "semana" | "mes" | "total"
const PERIODOS_VALIDOS = new Set<Periodo>(["hoje", "semana", "mes", "total"])

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "hoje",   label: "Hoje" },
  { key: "semana", label: "7 dias" },
  { key: "mes",    label: "Este mês" },
  { key: "total",  label: "Total" },
]

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  entregue:  { bg: "rgba(34,197,94,0.1)", text: "#16a34a" },
  cancelado: { bg: "rgba(239,68,68,0.1)", text: "#dc2626" },
}

const PAGAMENTOS: { value: FormaPagamento; label: string }[] = [
  { value: "pix",        label: "PIX" },
  { value: "cartao",     label: "Cartão" },
  { value: "dinheiro",   label: "Dinheiro" },
  { value: "maquininha", label: "Maquininha" },
  { value: "google_pay", label: "Google Pay" },
]

const PAGE_SIZE = 20

function dateInicio(periodo: Periodo): Date {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  if (periodo === "hoje")   return hoje
  if (periodo === "semana") { const d = new Date(hoje); d.setDate(d.getDate() - 6); return d }
  if (periodo === "mes")    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  return new Date(2020, 0, 1)
}

// PostgREST usa vírgula/parênteses como separadores no mini-linguagem do `.or()` — tirar
// esses caracteres do texto de busca antes de interpolar evita quebrar o filtro (nunca
// confiar em texto de busca livre dentro de uma string de query sem sanitizar).
function sanitizarBusca(s: string): string {
  return s.replace(/[,()]/g, " ").trim()
}

type EstadoCarga = "loading" | "error" | "success"

export default function LojaHistoricoPage() {
  const { sessao } = useAuth()
  const loja_id = sessao?.role === "lojista" ? sessao.loja_id : null

  // Deep-link vindo dos cliques de drill-down do Dashboard (?periodo=hoje|semana|mes|total)
  // — ignora silenciosamente qualquer valor fora do conjunto conhecido, mantendo o
  // default "mes" de sempre (nunca confiar cegamente em query param externo).
  const searchParams = useSearchParams()
  const periodoUrl = searchParams.get("periodo")
  const periodoInicial: Periodo = PERIODOS_VALIDOS.has(periodoUrl as Periodo) ? (periodoUrl as Periodo) : "mes"

  const [periodo,  setPeriodo]  = useState<Periodo>(periodoInicial)
  const [buscaInput, setBuscaInput] = useState("")
  const [busca,     setBusca]     = useState("") // versão com debounce, é a usada na query
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [filtroStatus,     setFiltroStatus]     = useState<"" | "entregue" | "cancelado">("")
  const [filtroPagamento,  setFiltroPagamento]  = useState<"" | FormaPagamento>("")
  const [filtroTipo,       setFiltroTipo]       = useState<"" | "entrega" | "retirada">("")

  const [pedidos,  setPedidos]  = useState<Pedido[]>([])
  const [estado,   setEstado]   = useState<EstadoCarga>("loading")
  const [page,     setPage]     = useState(0)
  const [hasMore,  setHasMore]  = useState(false)
  const [total,    setTotal]    = useState(0)
  const [totalVendas, setTotalVendas] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [larguraPapel, setLarguraPapel] = useState<"80mm" | "58mm">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("print_largura") as "80mm" | "58mm") ?? "80mm"
    return "80mm"
  })
  const [impressos, setImpressos] = useState<Record<string, string>>({})

  // Debounce da busca — evita disparar uma query a cada tecla digitada.
  useEffect(() => {
    const t = setTimeout(() => setBusca(sanitizarBusca(buscaInput)), 350)
    return () => clearTimeout(t)
  }, [buscaInput])

  useEffect(() => {
    if (!loja_id) return
    setPedidos([]); setPage(0); carregar(0)
    carregarTotalVendas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loja_id, periodo, busca, filtroStatus, filtroPagamento, filtroTipo])

  function montarQueryBase() {
    let q = supabase
      .from("pedidos")
      .select(
        "id, codigo, total, subtotal, taxa_entrega, desconto, cupom_codigo, forma_pagamento, status, endereco_entrega, observacao, " +
        "criado_em, aceito_em, pronto_em, coletado_em, entregue_em, cancelado_em, cancelado_por, motivo_cancelamento, motivo_outro, " +
        "nome_cliente, telefone_cliente, motoboy:motoboys(nome, telefone), itens:itens_pedido(nome, quantidade, preco, observacao, adicionais)",
        { count: "exact" }
      )
      .eq("loja_id", loja_id as string)
      .in("status", filtroStatus ? [filtroStatus] : (STATUS_FINAIS as readonly string[]))

    const inicio = dateInicio(periodo)
    const fim = new Date(); fim.setHours(23, 59, 59, 999)
    q = q.gte("criado_em", inicio.toISOString()).lte("criado_em", fim.toISOString())

    if (busca) {
      q = q.or(`codigo.ilike.%${busca}%,nome_cliente.ilike.%${busca}%,telefone_cliente.ilike.%${busca}%`)
    }
    if (filtroPagamento) q = q.eq("forma_pagamento", filtroPagamento)
    if (filtroTipo === "retirada") q = q.ilike("endereco_entrega", "%Retirada%")
    if (filtroTipo === "entrega")  q = q.not("endereco_entrega", "ilike", "%Retirada%")

    return q
  }

  async function carregar(novaPagina: number) {
    if (!loja_id) return
    setEstado("loading")
    const from = novaPagina * PAGE_SIZE
    try {
      const { data, count, error } = await montarQueryBase()
        .order("criado_em", { ascending: false })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw error

      const rows = (data ?? []) as unknown as Pedido[]
      setPedidos(prev => (novaPagina === 0 ? rows : [...prev, ...rows]))
      if (count !== null) setTotal(count)
      setHasMore(rows.length === PAGE_SIZE)
      setPage(novaPagina)
      setEstado("success")
    } catch (e) {
      console.error("[historico] falha ao carregar pedidos:", e)
      setEstado("error")
    }
  }

  // Total de vendas do período — agregado no banco (RPC), não busca linha por linha só
  // pra somar no JavaScript (achado real da auditoria: período "Total" numa loja de
  // alto volume chegava a trazer milhares de linhas pra uma soma simples). Se a RPC
  // ainda não existir (não rodada no ambiente), falha em silêncio e mostra "—" — nunca
  // trava o resto da tela por causa dessa métrica secundária.
  async function carregarTotalVendas() {
    if (!loja_id) return
    const inicio = dateInicio(periodo)
    const fim = new Date(); fim.setHours(23, 59, 59, 999)
    try {
      const { data, error } = await supabase.rpc("historico_total_vendas", {
        p_loja_id: loja_id, p_inicio: inicio.toISOString(), p_fim: fim.toISOString(),
      })
      if (error) throw error
      setTotalVendas(Number(data ?? 0))
    } catch (e) {
      console.error("[historico] RPC historico_total_vendas indisponível:", e)
      setTotalVendas(null)
    }
  }

  const statusColor = (s: string) => STATUS_COLOR[s] ?? { bg: "#F3F4F6", text: "#6B7280" }

  function onToggleLargura() {
    const nova = larguraPapel === "80mm" ? "58mm" : "80mm"
    setLarguraPapel(nova)
    localStorage.setItem("print_largura", nova)
  }

  function onImprimir(pedido: Pedido) {
    // No Histórico o pedido já está encerrado — toda impressão daqui é conceitualmente
    // uma reimpressão da via original, então força o aviso "REIMPRESSÃO" mesmo no
    // primeiro clique da sessão (ver src/lib/impressao.ts).
    imprimirComProtecao({ pedido, larguraPapel, impressos, setImpressos, forcarReimpressao: true })
  }

  const filtrosAtivos = [filtroStatus, filtroPagamento, filtroTipo].filter(Boolean).length

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: "#111827", fontWeight: 900, fontSize: 20 }}>Histórico de pedidos</h1>
        {total > 0 && (
          <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
            {total} pedido{total !== 1 ? "s" : ""}
            {totalVendas !== null && totalVendas > 0 && (
              <> · <span style={{ color: "#22c55e", fontWeight: 700 }}>R$ {totalVendas.toFixed(2)} em vendas</span></>
            )}
          </p>
        )}
      </div>

      {/* Busca principal */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <input
          value={buscaInput}
          onChange={e => setBuscaInput(e.target.value)}
          placeholder="Buscar pedido ou cliente"
          style={{
            width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 12,
            border: "1px solid #e5e7eb", fontSize: 14, color: "#111827", background: "#fff",
          }}
        />
        {buscaInput && (
          <button onClick={() => setBuscaInput("")} style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 15,
          }}>✕</button>
        )}
      </div>

      {/* Período + botão Filtros */}
      <div style={{ display: "flex", gap: 6, marginBottom: filtrosAbertos ? 10 : 20, flexWrap: "wrap", alignItems: "center" }}>
        {PERIODOS.map(p => (
          <button key={p.key} onClick={() => setPeriodo(p.key)} style={{
            padding: "7px 16px", borderRadius: 999, fontSize: 12, fontWeight: 700,
            cursor: "pointer", border: "1px solid #e5e7eb", transition: "all 0.15s",
            background: periodo === p.key ? "#f97316" : "#ffffff",
            color: periodo === p.key ? "white" : "#6B7280",
          }}>
            {p.label}
          </button>
        ))}
        <button onClick={() => setFiltrosAbertos(v => !v)} style={{
          padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700,
          cursor: "pointer", border: "1px solid #e5e7eb",
          background: filtrosAtivos > 0 ? "#111827" : "#ffffff",
          color: filtrosAtivos > 0 ? "white" : "#6B7280",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          Filtros{filtrosAtivos > 0 ? ` (${filtrosAtivos})` : ""}
          <span style={{ fontSize: 9 }}>{filtrosAbertos ? "▲" : "▼"}</span>
        </button>
      </div>

      {/* Painel compacto de filtros — só aparece quando aberto, pra não poluir a tela */}
      {filtrosAbertos && (
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20,
          padding: "12px", background: "#F9FAFB", borderRadius: 12, border: "1px solid #e5e7eb",
        }}>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as any)} style={selectStyle}>
            <option value="">Status: Todos</option>
            <option value="entregue">Entregue</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <select value={filtroPagamento} onChange={e => setFiltroPagamento(e.target.value as any)} style={selectStyle}>
            <option value="">Pagamento: Todos</option>
            {PAGAMENTOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)} style={selectStyle}>
            <option value="">Tipo: Todos</option>
            <option value="entrega">Entrega</option>
            <option value="retirada">Retirada</option>
          </select>
          {filtrosAtivos > 0 && (
            <button onClick={() => { setFiltroStatus(""); setFiltroPagamento(""); setFiltroTipo("") }} style={{
              background: "none", border: "none", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {estado === "loading" && pedidos.length === 0 ? (
        <p style={{ color: "#9CA3AF", textAlign: "center", marginTop: 48 }}>Carregando...</p>
      ) : estado === "error" ? (
        <div style={{ textAlign: "center", marginTop: 60, background: "#FEF2F2", borderRadius: 16, padding: "32px 20px", border: "1px solid rgba(239,68,68,0.2)" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.5" style={{ margin: "0 auto 12px" }} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style={{ color: "#991B1B", fontWeight: 700 }}>Não foi possível carregar o histórico</p>
          <p style={{ color: "#B91C1C", fontSize: 13, marginTop: 4 }}>Verifique sua conexão e tente novamente.</p>
          <button onClick={() => carregar(0)} style={{
            marginTop: 16, padding: "9px 20px", borderRadius: 10, border: "none",
            background: "#DC2626", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}>
            Tentar de novo
          </button>
        </div>
      ) : pedidos.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 60 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" style={{ margin: "0 auto 12px" }} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <p style={{ color: "#9CA3AF", fontWeight: 600 }}>
            {busca || filtrosAtivos > 0 ? "Nenhum pedido encontrado com esses filtros" : "Nenhum pedido no período"}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pedidos.map(p => {
              const sc    = statusColor(p.status)
              const isExp = expanded === p.id
              const isRetirada = p.endereco_entrega?.includes("Retirada") ?? false
              return (
                <div key={p.id} style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                  {/* Header do card — só o essencial, detalhe completo ao expandir */}
                  <button
                    onClick={() => setExpanded(isExp ? null : p.id)}
                    style={{ width: "100%", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
                            background: sc.bg, color: sc.text,
                          }}>
                            {STATUS_LABEL[p.status] ?? p.status}
                          </span>
                          <span style={{ color: "#374151", fontSize: 14, fontWeight: 800 }}>#{p.codigo}</span>
                        </div>
                        <p style={{ color: "#374151", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.nome_cliente ?? "Cliente não identificado"}
                        </p>
                        <div style={{ display: "flex", gap: 8, marginTop: 5, fontSize: 11, color: "#9CA3AF", flexWrap: "wrap" }}>
                          <span>{new Date(p.criado_em).toLocaleDateString("pt-BR")}</span>
                          <span>·</span>
                          <span>{new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span>·</span>
                          <span>{PGTO[p.forma_pagamento] ?? p.forma_pagamento}</span>
                          <span>·</span>
                          <span>{isRetirada ? "Retirada" : "Entrega"}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ color: p.status === "cancelado" ? "#9CA3AF" : "#111827", fontWeight: 900, fontSize: 16, textDecoration: p.status === "cancelado" ? "line-through" : "none" }}>
                          R$ {Number(p.total ?? 0).toFixed(2)}
                        </p>
                        <svg
                          width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"
                          style={{ marginTop: 6, transform: isExp ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
                        >
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Detalhe completo — somente leitura, reaproveita componentes da Fase 3 */}
                  {isExp && (
                    <div style={{ borderTop: "1px solid #F3F4F6", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                      <ClienteInfo pedido={p} />

                      {/* Motoboy — só aparece se houver relacionamento real, nunca bloco vazio */}
                      {p.motoboy?.nome && (
                        <div style={{ padding: "8px 12px", borderRadius: 10, background: "#F9FAFB", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14 }}>🛵</span>
                          <div>
                            <p style={{ color: "#6B7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Motoboy</p>
                            <p style={{ color: "#374151", fontSize: 13, fontWeight: 600 }}>
                              {p.motoboy.nome}{p.motoboy.telefone ? ` · ${p.motoboy.telefone}` : ""}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Itens, com adicionais e observação quando existirem */}
                      {(p.itens ?? []).length > 0 && (
                        <div>
                          <p style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Itens</p>
                          {(p.itens ?? []).map((item, i) => (
                            <div key={i} style={{ marginBottom: 6 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                <span style={{ color: "#374151" }}>{item.quantidade}x {item.nome}</span>
                                <span style={{ color: "#9CA3AF" }}>R$ {(item.preco * item.quantidade).toFixed(2)}</span>
                              </div>
                              {(item.adicionais ?? []).map((a, j) => (
                                <p key={j} style={{ fontSize: 11.5, color: "#9CA3AF", paddingLeft: 10 }}>
                                  + {a.nome}{a.preco > 0 ? ` (R$ ${a.preco.toFixed(2)})` : ""}
                                </p>
                              ))}
                              {item.observacao && (
                                <p style={{ fontSize: 11.5, color: "#9CA3AF", paddingLeft: 10, fontStyle: "italic" }}>obs: {item.observacao}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Cancelamento — só aparece se o pedido foi cancelado E os dados
                          existirem (pedidos antigos podem não ter tudo — nunca inventamos
                          o que falta). */}
                      {p.status === "cancelado" && (p.cancelado_em || p.cancelado_por || p.motivo_cancelamento) && (
                        <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                            <p style={{ color: "#dc2626", fontSize: 12, fontWeight: 700 }}>Pedido cancelado</p>
                            {p.cancelado_em && (
                              <span style={{ color: "#9CA3AF", fontSize: 11 }}>
                                {new Date(p.cancelado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </div>
                          {p.cancelado_por && (
                            <p style={{ color: "#6B7280", fontSize: 12 }}>Por: {CANCELADO_POR_LABEL[p.cancelado_por] ?? p.cancelado_por}</p>
                          )}
                          {p.motivo_cancelamento && (
                            <p style={{ color: "#6B7280", fontSize: 12 }}>
                              Motivo: {p.motivo_cancelamento === "outro" && p.motivo_outro ? p.motivo_outro : (MOTIVO_CANCELAMENTO_LABEL[p.motivo_cancelamento] ?? p.motivo_cancelamento)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Endereço */}
                      {p.endereco_entrega && (
                        <div style={{ padding: "8px 12px", borderRadius: 10, background: "#F9FAFB", border: "1px solid #e5e7eb" }}>
                          <p style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>ENDEREÇO</p>
                          <p style={{ color: "#374151", fontSize: 13 }}>{p.endereco_entrega}</p>
                        </div>
                      )}

                      {/* Timeline — timestamps reais, somente leitura */}
                      <div>
                        <p style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Linha do tempo</p>
                        <TimelinePedido pedido={p} />
                      </div>

                      {/* Valores */}
                      <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9CA3AF" }}>
                          <span>Subtotal</span><span>R$ {Number(p.subtotal ?? 0).toFixed(2)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9CA3AF" }}>
                          <span>Taxa de entrega</span><span>R$ {Number(p.taxa_entrega ?? 0).toFixed(2)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800, color: "#111827", marginTop: 4 }}>
                          <span>Total</span><span>R$ {Number(p.total ?? 0).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Reimpressão — mesma infra da Fase 3, sempre marcada como REIMPRESSÃO aqui */}
                      <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
                        <BotaoImprimir
                          pedido={p}
                          larguraPapel={larguraPapel}
                          ultimaImpressao={impressos[p.id]}
                          onImprimir={onImprimir}
                          onToggleLargura={onToggleLargura}
                          sempreReimprimir
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => carregar(page + 1)}
              disabled={estado === "loading"}
              style={{
                width: "100%", marginTop: 16, padding: "12px",
                borderRadius: 12, border: "1px solid #e5e7eb",
                background: "#ffffff", color: "#6B7280",
                fontWeight: 700, fontSize: 14, cursor: estado === "loading" ? "not-allowed" : "pointer",
              }}>
              {estado === "loading" ? "Carregando..." : "Carregar mais"}
            </button>
          )}
        </>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb",
  background: "#fff", fontSize: 12, color: "#374151", fontWeight: 600,
}
