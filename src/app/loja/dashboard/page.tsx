"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

type Periodo = "hoje" | "semana" | "mes" | "custom"

const PGTO: Record<string, string> = {
  pix: "💠 PIX", cartao: "💳 Cartão", dinheiro: "💵 Dinheiro", maquininha: "📱 Maquininha",
}

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub: string; icon: string; color: string
}) {
  return (
    <div className="card" style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
      </div>
      <p style={{ color, fontWeight: 900, fontSize: 28, lineHeight: 1, marginBottom: 6 }}>{value}</p>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{sub}</p>
    </div>
  )
}

function dateInicio(periodo: Periodo, customInicio: string): Date {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  if (periodo === "hoje") return hoje
  if (periodo === "semana") {
    const d = new Date(hoje)
    d.setDate(d.getDate() - 6)
    return d
  }
  if (periodo === "mes") return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  return customInicio ? new Date(customInicio + "T00:00:00") : hoje
}

function dateFim(periodo: Periodo, customFim: string): Date {
  if (periodo !== "custom" || !customFim) {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d
  }
  const d = new Date(customFim + "T23:59:59"); return d
}

export default function DashboardPage() {
  const { sessao } = useAuth()
  const loja_id = sessao?.role === "lojista" ? sessao.loja_id : null

  const [periodo, setPeriodo]       = useState<Periodo>("mes")
  const [customInicio, setCustomInicio] = useState("")
  const [customFim, setCustomFim]   = useState("")
  const [loading, setLoading]       = useState(true)

  const [vendas, setVendas]         = useState(0)
  const [numPedidos, setNumPedidos] = useState(0)
  const [ticketMedio, setTicketMedio] = useState(0)
  const [vendasTotal, setVendasTotal] = useState(0)
  const [pedidosTotal, setPedidosTotal] = useState(0)
  const [topProds, setTopProds]     = useState<{ nome: string; qtd: number; total: number }[]>([])
  const [ultimos, setUltimos]       = useState<any[]>([])
  const [pgtoDist, setPgtoDist]     = useState<{ label: string; count: number; valor: number }[]>([])

  useEffect(() => {
    if (!loja_id) return
    if (periodo === "custom" && (!customInicio || !customFim)) return
    carregar()
  }, [loja_id, periodo, customInicio, customFim])

  async function carregar() {
    setLoading(true)
    const inicio = dateInicio(periodo, customInicio)
    const fim    = dateFim(periodo, customFim)

    const { data: todos } = await supabase
      .from("pedidos")
      .select("*, itens:itens_pedido(*)")
      .eq("loja_id", loja_id)
      .eq("status", "entregue")
      .order("criado_em", { ascending: false })

    const all = (todos ?? []) as any[]
    const filtered = all.filter(p => {
      const d = new Date(p.criado_em)
      return d >= inicio && d <= fim
    })

    const sum = (arr: any[]) => arr.reduce((s, p) => s + p.total, 0)
    setVendas(sum(filtered))
    setNumPedidos(filtered.length)
    setTicketMedio(filtered.length > 0 ? sum(filtered) / filtered.length : 0)
    setVendasTotal(sum(all))
    setPedidosTotal(all.length)

    const contagem: Record<string, { qtd: number; total: number }> = {}
    filtered.forEach(p => {
      ;(p.itens ?? []).forEach((i: any) => {
        if (!contagem[i.nome]) contagem[i.nome] = { qtd: 0, total: 0 }
        contagem[i.nome].qtd   += i.quantidade
        contagem[i.nome].total += i.preco * i.quantidade
      })
    })
    setTopProds(
      Object.entries(contagem)
        .map(([nome, v]) => ({ nome, qtd: v.qtd, total: v.total }))
        .sort((a, b) => b.qtd - a.qtd)
        .slice(0, 6)
    )

    const pgDist: Record<string, { count: number; valor: number }> = {}
    filtered.forEach(p => {
      if (!pgDist[p.forma_pagamento]) pgDist[p.forma_pagamento] = { count: 0, valor: 0 }
      pgDist[p.forma_pagamento].count++
      pgDist[p.forma_pagamento].valor += p.total
    })
    setPgtoDist(
      Object.entries(pgDist)
        .map(([k, v]) => ({ label: PGTO[k] ?? k, count: v.count, valor: v.valor }))
        .sort((a, b) => b.count - a.count)
    )

    setUltimos(all.slice(0, 8))
    setLoading(false)
  }

  const maxQtd = topProds[0]?.qtd ?? 1

  const PERIODOS: { key: Periodo; label: string }[] = [
    { key: "hoje",   label: "Hoje" },
    { key: "semana", label: "7 dias" },
    { key: "mes",    label: "Este mês" },
    { key: "custom", label: "Personalizado" },
  ]

  const periodoLabel = periodo === "hoje" ? "Hoje" : periodo === "semana" ? "Últimos 7 dias" : periodo === "mes" ? "Este mês" : `${customInicio} → ${customFim}`

  return (
    <div style={{ padding: "32px 36px", maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: "white", fontWeight: 900, fontSize: 22 }}>📊 Dashboard</h1>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 4 }}>Somente pedidos entregues</p>
      </div>

      {/* Filtro de período */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: periodo === "custom" ? 12 : 0 }}>
          {PERIODOS.map(p => (
            <button key={p.key} onClick={() => setPeriodo(p.key)} style={{
              padding: "8px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700,
              cursor: "pointer", border: "none", transition: "all 0.15s",
              background: periodo === p.key ? "#f97316" : "rgba(255,255,255,0.07)",
              color: periodo === p.key ? "white" : "rgba(255,255,255,0.45)",
            }}>
              {p.label}
            </button>
          ))}
        </div>
        {periodo === "custom" && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
            <input
              type="date"
              value={customInicio}
              onChange={e => setCustomInicio(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white", outline: "none", fontSize: 13 }}
            />
            <span style={{ color: "rgba(255,255,255,0.3)" }}>até</span>
            <input
              type="date"
              value={customFim}
              onChange={e => setCustomFim(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white", outline: "none", fontSize: 13 }}
            />
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando dados...</p>
      ) : (
        <>
          {/* Stat cards do período */}
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            {periodoLabel}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14, marginBottom: 24 }}>
            <StatCard icon="💰" label="Vendas" value={`R$ ${vendas.toFixed(2)}`} sub={`${numPedidos} pedido${numPedidos !== 1 ? "s" : ""}`} color="#22c55e" />
            <StatCard icon="🧾" label="Ticket médio" value={`R$ ${ticketMedio.toFixed(2)}`} sub="por pedido" color="#60a5fa" />
            <StatCard icon="🏆" label="Total histórico" value={`R$ ${vendasTotal.toFixed(2)}`} sub={`${pedidosTotal} pedidos`} color="#a78bfa" />
            <StatCard icon="📦" label="Pedidos no período" value={String(numPedidos)} sub="entregues" color="#f97316" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* Top produtos */}
            <div className="card" style={{ padding: "20px 22px" }}>
              <p style={{ color: "white", fontWeight: 900, fontSize: 14, marginBottom: 18 }}>🔥 Mais pedidos no período</p>
              {topProds.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Sem dados para o período</p>
              ) : topProds.map((p, i) => (
                <div key={p.nome} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5, fontSize: 13 }}>
                    <span style={{ color: "white", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 900, minWidth: 18, color: i === 0 ? "#f59e0b" : i === 1 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)" }}>{i + 1}º</span>
                      {p.nome}
                    </span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      <span style={{ color: "#f97316", fontWeight: 700 }}>{p.qtd}×</span>
                      <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>R$ {p.total.toFixed(0)}</span>
                    </div>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.05)" }}>
                    <div style={{ height: "100%", borderRadius: 3, background: i === 0 ? "linear-gradient(90deg,#f97316,#fb923c)" : "rgba(249,115,22,0.45)", width: `${(p.qtd / maxQtd) * 100}%`, transition: "width 0.6s" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Últimas entregas */}
            <div className="card" style={{ padding: "20px 22px" }}>
              <p style={{ color: "white", fontWeight: 900, fontSize: 14, marginBottom: 18 }}>✅ Últimas entregas</p>
              {ultimos.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Nenhuma entrega ainda</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {ultimos.map((p, i) => (
                    <div key={p.codigo + i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 10px", borderRadius: 10,
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                    }}>
                      <div>
                        <p style={{ color: "white", fontSize: 13, fontWeight: 700 }}>#{p.codigo}</p>
                        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                          {new Date(p.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · {PGTO[p.forma_pagamento] ?? p.forma_pagamento}
                        </p>
                      </div>
                      <p style={{ color: "#22c55e", fontWeight: 800, fontSize: 14 }}>R$ {p.total.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Formas de pagamento */}
          {pgtoDist.length > 0 && (
            <div className="card" style={{ padding: "20px 22px" }}>
              <p style={{ color: "white", fontWeight: 900, fontSize: 14, marginBottom: 18 }}>💳 Formas de pagamento no período</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                {pgtoDist.map(p => (
                  <div key={p.label} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p style={{ color: "white", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{p.label}</p>
                    <p style={{ color: "#f97316", fontWeight: 900, fontSize: 18 }}>{p.count} pedido{p.count !== 1 ? "s" : ""}</p>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 }}>R$ {p.valor.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
