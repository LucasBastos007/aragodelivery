"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

type Periodo = "hoje" | "semana" | "mes" | "total"

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "hoje",   label: "Hoje" },
  { key: "semana", label: "7 dias" },
  { key: "mes",    label: "Este mês" },
  { key: "total",  label: "Total" },
]

const STATUS_LABEL: Record<string, string> = {
  coletado:  "Coletado",
  entregue:  "Entregue",
  cancelado: "Cancelado",
}

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  entregue:  { bg: "rgba(34,197,94,0.1)",   text: "#16a34a" },
  coletado:  { bg: "rgba(96,165,250,0.12)",  text: "#2563eb" },
  cancelado: { bg: "rgba(239,68,68,0.1)",   text: "#dc2626" },
}

const PGTO: Record<string, string> = {
  pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha",
  apple_pay: "Apple Pay", google_pay: "Google Pay",
}

const PAGE_SIZE = 20

function dateInicio(periodo: Periodo): Date {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  if (periodo === "hoje")   return hoje
  if (periodo === "semana") { const d = new Date(hoje); d.setDate(d.getDate() - 6); return d }
  if (periodo === "mes")    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  return new Date(2020, 0, 1)
}

export default function LojaHistoricoPage() {
  const { sessao } = useAuth()
  const loja_id = sessao?.role === "lojista" ? sessao.loja_id : null

  const [periodo,  setPeriodo]  = useState<Periodo>("mes")
  const [pedidos,  setPedidos]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [page,     setPage]     = useState(0)
  const [hasMore,  setHasMore]  = useState(false)
  const [total,    setTotal]    = useState(0)
  const [totalVendas, setTotalVendas] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!loja_id) return
    setPedidos([]); setPage(0); carregar(0)
  }, [loja_id, periodo])

  async function carregar(novaPagina: number) {
    if (!loja_id) return
    setLoading(true)
    const inicio = dateInicio(periodo)
    const fim    = new Date(); fim.setHours(23, 59, 59, 999)
    const from   = novaPagina * PAGE_SIZE

    const { data, count } = await supabase
      .from("pedidos")
      .select("id, codigo, total, subtotal, taxa_entrega, forma_pagamento, status, endereco_entrega, observacao, criado_em, itens:itens_pedido(nome, quantidade, preco)", { count: "exact" })
      .eq("loja_id", loja_id)
      .in("status", ["coletado", "entregue", "cancelado"])
      .gte("criado_em", inicio.toISOString())
      .lte("criado_em", fim.toISOString())
      .order("criado_em", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    const rows = (data ?? []) as any[]
    setPedidos(novaPagina === 0 ? rows : prev => [...prev, ...rows])
    if (count !== null) setTotal(count)
    setHasMore(rows.length === PAGE_SIZE)
    setPage(novaPagina)

    if (novaPagina === 0) {
      const { data: todos } = await supabase
        .from("pedidos")
        .select("total")
        .eq("loja_id", loja_id)
        .eq("status", "entregue")
        .gte("criado_em", inicio.toISOString())
        .lte("criado_em", fim.toISOString())
      setTotalVendas((todos ?? []).reduce((s, p) => s + (p.total ?? 0), 0))
    }

    setLoading(false)
  }

  const statusColor = (s: string) => STATUS_COLOR[s] ?? { bg: "#F3F4F6", text: "#6B7280" }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: "#111827", fontWeight: 900, fontSize: 20 }}>Histórico de pedidos</h1>
        {total > 0 && (
          <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
            {total} pedido{total !== 1 ? "s" : ""}
            {totalVendas > 0 && (
              <> · <span style={{ color: "#22c55e", fontWeight: 700 }}>R$ {totalVendas.toFixed(2)} em vendas</span></>
            )}
          </p>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
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
      </div>

      {loading && pedidos.length === 0 ? (
        <p style={{ color: "#9CA3AF", textAlign: "center", marginTop: 48 }}>Carregando...</p>
      ) : pedidos.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 60 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" style={{ margin: "0 auto 12px" }} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <p style={{ color: "#9CA3AF", fontWeight: 600 }}>Nenhum pedido no período</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pedidos.map(p => {
              const sc    = statusColor(p.status)
              const isExp = expanded === p.id
              return (
                <div key={p.id} style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                  {/* Header do card */}
                  <button
                    onClick={() => setExpanded(isExp ? null : p.id)}
                    style={{ width: "100%", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
                            background: sc.bg, color: sc.text,
                          }}>
                            {STATUS_LABEL[p.status] ?? p.status}
                          </span>
                          <span style={{ color: "#374151", fontSize: 14, fontWeight: 800 }}>#{p.codigo}</span>
                        </div>
                        <p style={{ color: "#9CA3AF", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {(p.itens ?? []).map((i: any) => `${i.quantidade}x ${i.nome}`).join(", ")}
                        </p>
                        <div style={{ display: "flex", gap: 8, marginTop: 5, fontSize: 11, color: "#9CA3AF" }}>
                          <span>{new Date(p.criado_em).toLocaleDateString("pt-BR")}</span>
                          <span>·</span>
                          <span>{new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span>·</span>
                          <span>{PGTO[p.forma_pagamento] ?? p.forma_pagamento}</span>
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

                  {/* Detalhes expandidos */}
                  {isExp && (
                    <div style={{ borderTop: "1px solid #F3F4F6", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                      {/* Itens */}
                      {(p.itens ?? []).length > 0 && (
                        <div>
                          <p style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Itens</p>
                          {(p.itens as any[]).map((item: any, i: number) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                              <span style={{ color: "#374151" }}>{item.quantidade}x {item.nome}</span>
                              <span style={{ color: "#9CA3AF" }}>R$ {(item.preco * item.quantidade).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Endereço */}
                      {p.endereco_entrega && (
                        <div style={{ padding: "8px 12px", borderRadius: 10, background: "#F9FAFB", border: "1px solid #e5e7eb" }}>
                          <p style={{ color: "#6B7280", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>ENDEREÇO</p>
                          <p style={{ color: "#374151", fontSize: 13 }}>{p.endereco_entrega}</p>
                        </div>
                      )}

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
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => carregar(page + 1)}
              disabled={loading}
              style={{
                width: "100%", marginTop: 16, padding: "12px",
                borderRadius: 12, border: "1px solid #e5e7eb",
                background: "#ffffff", color: "#6B7280",
                fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
              }}>
              {loading ? "Carregando..." : "Carregar mais"}
            </button>
          )}
        </>
      )}
    </div>
  )
}
