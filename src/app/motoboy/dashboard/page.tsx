"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

type Periodo = "hoje" | "semana" | "mes" | "total"

function StatCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub: string; color: string
}) {
  return (
    <div style={{ background: "#111", borderRadius: 16, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
      </div>
      <p style={{ color, fontWeight: 900, fontSize: 26, lineHeight: 1, marginBottom: 4 }}>{value}</p>
      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>{sub}</p>
    </div>
  )
}

function dateInicio(periodo: Periodo): Date {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  if (periodo === "hoje") return hoje
  if (periodo === "semana") { const d = new Date(hoje); d.setDate(d.getDate() - 6); return d }
  if (periodo === "mes") return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  return new Date(2020, 0, 1)
}

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "hoje",   label: "Hoje" },
  { key: "semana", label: "7 dias" },
  { key: "mes",    label: "Este mês" },
  { key: "total",  label: "Total" },
]

export default function MotoboyDashboardPage() {
  const { sessao } = useAuth()
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null

  const [periodo, setPeriodo] = useState<Periodo>("mes")
  const [loading, setLoading] = useState(true)

  const [corridas,       setCorridas]       = useState(0)
  const [ganhos,         setGanhos]         = useState(0)
  const [ticketMedio,    setTicketMedio]    = useState(0)
  const [corridasTotal,  setCorridasTotal]  = useState(0)
  const [ganhoTotal,     setGanhoTotal]     = useState(0)
  const [ultimos,        setUltimos]        = useState<any[]>([])
  const [lojaFreq,       setLojaFreq]       = useState<{ nome: string; count: number }[]>([])

  useEffect(() => {
    if (!motoboy_id) return
    carregar()
  }, [motoboy_id, periodo])

  async function carregar() {
    setLoading(true)
    const inicio = dateInicio(periodo)
    const fim    = new Date(); fim.setHours(23, 59, 59, 999)

    const { data: todos } = await supabase
      .from("pedidos")
      .select("*, loja:lojas(nome)")
      .eq("motoboy_id", motoboy_id)
      .eq("status", "entregue")
      .order("criado_em", { ascending: false })

    const all      = (todos ?? []) as any[]
    const filtered = all.filter(p => {
      const d = new Date(p.criado_em)
      return d >= inicio && d <= fim
    })

    const sumTaxa = (arr: any[]) => arr.reduce((s, p) => s + (p.taxa_entrega ?? 0), 0)

    setCorridas(filtered.length)
    setGanhos(sumTaxa(filtered))
    setTicketMedio(filtered.length > 0 ? sumTaxa(filtered) / filtered.length : 0)
    setCorridasTotal(all.length)
    setGanhoTotal(sumTaxa(all))

    setUltimos(all.slice(0, 5))

    const freq: Record<string, number> = {}
    filtered.forEach(p => {
      const nome = p.loja?.nome ?? "Loja"
      freq[nome] = (freq[nome] ?? 0) + 1
    })
    setLojaFreq(
      Object.entries(freq)
        .map(([nome, count]) => ({ nome, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)
    )

    setLoading(false)
  }

  const maxFreq = lojaFreq[0]?.count ?? 1
  const periodoLabel = periodo === "hoje" ? "Hoje" : periodo === "semana" ? "Últimos 7 dias" : periodo === "mes" ? "Este mês" : "Todo período"

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: "white", fontWeight: 900, fontSize: 20 }}>📊 Dashboard</h1>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 3 }}>Seus ganhos e corridas</p>
      </div>

      {/* Filtro período */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
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

      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando...</p>
      ) : (
        <>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
            {periodoLabel}
          </p>

          {/* Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <StatCard icon="💰" label="Ganhos" value={`R$ ${ganhos.toFixed(2)}`} sub="taxa de entrega" color="#22c55e" />
            <StatCard icon="🛵" label="Corridas" value={String(corridas)} sub="entregas feitas" color="#f97316" />
            <StatCard icon="📈" label="Média/corrida" value={`R$ ${ticketMedio.toFixed(2)}`} sub="ganho médio" color="#60a5fa" />
            <StatCard icon="🏆" label="Total histórico" value={`R$ ${ganhoTotal.toFixed(2)}`} sub={`${corridasTotal} corridas`} color="#a78bfa" />
          </div>

          {/* Lojas mais frequentes */}
          {lojaFreq.length > 0 && (
            <div style={{ background: "#111", borderRadius: 16, padding: "18px 20px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ color: "white", fontWeight: 900, fontSize: 14, marginBottom: 16 }}>🏪 Lojas no período</p>
              {lojaFreq.map((l, i) => (
                <div key={l.nome} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13 }}>
                    <span style={{ color: "white", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 900, minWidth: 16, color: i === 0 ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>{i + 1}º</span>
                      {l.nome}
                    </span>
                    <span style={{ color: "#f97316", fontWeight: 700 }}>{l.count}×</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)" }}>
                    <div style={{ height: "100%", borderRadius: 2, background: i === 0 ? "linear-gradient(90deg,#f97316,#fb923c)" : "rgba(249,115,22,0.4)", width: `${(l.count / maxFreq) * 100}%`, transition: "width 0.5s" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Últimas entregas */}
          {ultimos.length > 0 && (
            <div style={{ background: "#111", borderRadius: 16, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ color: "white", fontWeight: 900, fontSize: 14, marginBottom: 14 }}>✅ Últimas entregas</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ultimos.map((p, i) => (
                  <div key={p.id + i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 10px", borderRadius: 10,
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    <div>
                      <p style={{ color: "white", fontSize: 13, fontWeight: 700 }}>#{p.codigo}</p>
                      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                        {p.loja?.nome ?? "—"} · {new Date(p.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </p>
                    </div>
                    <p style={{ color: "#22c55e", fontWeight: 800, fontSize: 14 }}>R$ {(p.taxa_entrega ?? 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {corridas === 0 && (
            <div style={{ textAlign: "center", marginTop: 48 }}>
              <p style={{ fontSize: 36, marginBottom: 10 }}>📭</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Nenhuma entrega no período</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
