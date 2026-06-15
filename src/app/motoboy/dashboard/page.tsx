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

function dateInicio(periodo: Periodo): Date {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  if (periodo === "hoje")   return hoje
  if (periodo === "semana") { const d = new Date(hoje); d.setDate(d.getDate() - 6); return d }
  if (periodo === "mes")    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  return new Date(2020, 0, 1)
}

function ganhoReal(p: any): number {
  return p.ganho_motoboy ?? p.taxa_entrega ?? 0
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string
}) {
  return (
    <div style={{ background: "#111", borderRadius: 16, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {icon}
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
      </div>
      <p style={{ color, fontWeight: 900, fontSize: 26, lineHeight: 1, marginBottom: 4 }}>{value}</p>
      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>{sub}</p>
    </div>
  )
}

function GraficoSemanal({ pedidos }: { pedidos: any[] }) {
  const hoje = new Date()
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoje)
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    return d
  })

  const valores = dias.map(d => {
    const fim = new Date(d); fim.setHours(23, 59, 59, 999)
    return pedidos
      .filter(p => { const cd = new Date(p.criado_em); return cd >= d && cd <= fim })
      .reduce((s, p) => s + ganhoReal(p), 0)
  })

  const maxVal = Math.max(...valores, 0.01)
  const labels = dias.map(d => d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3))

  return (
    <div style={{ background: "#111", borderRadius: 16, padding: "18px 20px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.07)" }}>
      <p style={{ color: "white", fontWeight: 900, fontSize: 14, marginBottom: 18 }}>Ganhos — últimos 7 dias</p>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
        {valores.map((v, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <p style={{ color: v > 0 ? "rgba(249,115,22,0.8)" : "transparent", fontSize: 8, fontWeight: 700 }}>
              {v > 0 ? `R$${v.toFixed(0)}` : ""}
            </p>
            <div style={{
              width: "100%", borderRadius: "4px 4px 0 0",
              height: `${Math.max((v / maxVal) * 64, v > 0 ? 4 : 0)}px`,
              background: i === 6 ? "#f97316" : "rgba(249,115,22,0.3)",
              transition: "height 0.4s ease",
            }} />
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, fontWeight: 600 }}>{labels[i]}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MotoboyDashboardPage() {
  const { sessao } = useAuth()
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null

  const [periodo, setPeriodo] = useState<Periodo>("mes")
  const [loading, setLoading] = useState(true)

  const [corridas,      setCorridas]      = useState(0)
  const [ganhos,        setGanhos]        = useState(0)
  const [ticketMedio,   setTicketMedio]   = useState(0)
  const [corridasTotal, setCorridasTotal] = useState(0)
  const [ganhoTotal,    setGanhoTotal]    = useState(0)
  const [ultimos,       setUltimos]       = useState<any[]>([])
  const [lojaFreq,      setLojaFreq]      = useState<{ nome: string; count: number }[]>([])
  const [all,           setAll]           = useState<any[]>([])
  const [notaMedia,     setNotaMedia]     = useState<number | null>(null)
  const [totalAvals,    setTotalAvals]    = useState(0)

  useEffect(() => { if (motoboy_id) carregar() }, [motoboy_id, periodo])

  async function carregar() {
    setLoading(true)
    const inicio = dateInicio(periodo)
    const fim    = new Date(); fim.setHours(23, 59, 59, 999)

    const { data: todos } = await supabase
      .from("pedidos")
      .select("id, codigo, taxa_entrega, ganho_motoboy, criado_em, loja:lojas(nome)")
      .eq("motoboy_id", motoboy_id)
      .eq("status", "entregue")
      .order("criado_em", { ascending: false })

    const allData  = (todos ?? []) as any[]
    const filtered = allData.filter(p => { const d = new Date(p.criado_em); return d >= inicio && d <= fim })

    const sumGanhos = (arr: any[]) => arr.reduce((s, p) => s + ganhoReal(p), 0)

    setCorridas(filtered.length)
    setGanhos(sumGanhos(filtered))
    setTicketMedio(filtered.length > 0 ? sumGanhos(filtered) / filtered.length : 0)
    setCorridasTotal(allData.length)
    setGanhoTotal(sumGanhos(allData))
    setUltimos(allData.slice(0, 5))
    setAll(allData)

    const freq: Record<string, number> = {}
    filtered.forEach(p => { const n = p.loja?.nome ?? "Loja"; freq[n] = (freq[n] ?? 0) + 1 })
    setLojaFreq(
      Object.entries(freq).map(([nome, count]) => ({ nome, count }))
        .sort((a, b) => b.count - a.count).slice(0, 4)
    )
    // Nota média
    const { data: mb } = await supabase.from("motoboys").select("nota_media, total_avaliacoes").eq("id", motoboy_id).single()
    if (mb) { setNotaMedia(mb.nota_media ?? null); setTotalAvals(mb.total_avaliacoes ?? 0) }

    setLoading(false)
  }

  const maxFreq      = lojaFreq[0]?.count ?? 1
  const periodoLabel = { hoje: "Hoje", semana: "Últimos 7 dias", mes: "Este mês", total: "Todo período" }[periodo]

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: "white", fontWeight: 900, fontSize: 20 }}>Dashboard</h1>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 3 }}>Seus ganhos e corridas</p>
      </div>

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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <StatCard
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
              label="Ganhos" value={`R$ ${ganhos.toFixed(2)}`} sub="taxa de entrega" color="#22c55e"
            />
            <StatCard
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>}
              label="Corridas" value={String(corridas)} sub="entregas feitas" color="#f97316"
            />
            <StatCard
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
              label="Média/corrida" value={`R$ ${ticketMedio.toFixed(2)}`} sub="ganho médio" color="#60a5fa"
            />
            <StatCard
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>}
              label="Total histórico" value={`R$ ${ganhoTotal.toFixed(2)}`} sub={`${corridasTotal} corridas`} color="#a78bfa"
            />
          </div>

          <GraficoSemanal pedidos={all} />

          {/* Card de avaliação */}
          {notaMedia !== null && (
            <div style={{ background: "#111", borderRadius: 16, padding: "18px 20px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Sua avaliação</p>
                <p style={{ color: "#f59e0b", fontWeight: 900, fontSize: 28, lineHeight: 1 }}>{notaMedia.toFixed(1)}</p>
                <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, marginTop: 4 }}>{totalAvals} avaliação{totalAvals !== 1 ? "ões" : ""}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                {[5, 4, 3, 2, 1].map(s => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 60, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 2, background: notaMedia >= s ? "#f59e0b" : "transparent", width: notaMedia >= s ? "100%" : `${Math.max(0, (notaMedia - (s - 1)) * 100)}%` }} />
                    </div>
                    <span style={{ color: "#f59e0b", fontSize: 10 }}>{"★".repeat(s)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lojaFreq.length > 0 && (
            <div style={{ background: "#111", borderRadius: 16, padding: "18px 20px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ color: "white", fontWeight: 900, fontSize: 14, marginBottom: 16 }}>Lojas no período</p>
              {lojaFreq.map((l, i) => (
                <div key={l.nome} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13 }}>
                    <span style={{ color: "white", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 900, minWidth: 16, color: i === 0 ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>{i + 1}°</span>
                      {l.nome}
                    </span>
                    <span style={{ color: "#f97316", fontWeight: 700 }}>{l.count}x</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)" }}>
                    <div style={{ height: "100%", borderRadius: 2, background: i === 0 ? "linear-gradient(90deg,#f97316,#fb923c)" : "rgba(249,115,22,0.4)", width: `${(l.count / maxFreq) * 100}%`, transition: "width 0.5s" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {ultimos.length > 0 && (
            <div style={{ background: "#111", borderRadius: 16, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ color: "white", fontWeight: 900, fontSize: 14, marginBottom: 14 }}>Últimas entregas</p>
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
                    <p style={{ color: "#22c55e", fontWeight: 800, fontSize: 14 }}>R$ {ganhoReal(p).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {corridas === 0 && (
            <div style={{ textAlign: "center", marginTop: 48 }}>
              <p style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Nenhuma entrega no período</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
