"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

// ─── Types ────────────────────────────────────────────────────────────────────
interface LojaRank   { id: string; nome: string; total: number; pedidos: number; categoria?: string }
interface MoboyRank  { id: string; nome: string; entregas: number; faturamento: number }
interface RecentPed  { id: string; codigo: string; total: number; status: string; loja_nome: string; criado_em: string }
interface Stats {
  lojas_ativas: number; lojas_pendentes: number
  motoboys_ativos: number; motoboys_pendentes: number
  pedidos_hoje: number; faturamento_hoje: number
  ticket_medio: number; cancelamentos: number
}

type Periodo = "hoje" | "7d" | "30d"

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  entregue: "#30D158", cancelado: "#FF453A", pendente: "#FF9F0A",
  aceito: "#007AFF", preparando: "#FF9F0A", em_rota: "#007AFF",
  pronto: "#5E5CE6", coletado: "#007AFF", aguardando_aceite: "#FF9F0A",
  indo_para_loja: "#007AFF", na_loja: "#5E5CE6",
}
const STATUS_LABEL: Record<string, string> = {
  entregue: "Entregue", cancelado: "Cancelado", pendente: "Pendente",
  aceito: "Aceito", preparando: "Preparando", em_rota: "Em rota",
  pronto: "Pronto", coletado: "Coletado", aguardando_aceite: "Aguard. motoboy",
  indo_para_loja: "Indo à loja", na_loja: "Na loja",
}

function fmtBRL(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtShort(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`
  return `R$ ${v.toFixed(0)}`
}
function bar(pct: number, color: string) {
  return (
    <div style={{ height: 4, background: "#F1F5F9", borderRadius: 99, overflow: "hidden", marginTop: 6 }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon, href, loading, trend }: {
  label: string; value: string | number; sub?: string; color: string
  icon: React.ReactNode; href?: string; loading: boolean; trend?: string
}) {
  const content = (
    <div style={{
      background: "white", borderRadius: 18, padding: "20px 22px",
      border: "1px solid rgba(0,0,0,0.06)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05), 0 0 1px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column", gap: 12, position: "relative", overflow: "hidden",
      transition: "all 0.2s", cursor: href ? "pointer" : "default", textDecoration: "none",
    }}
      onMouseEnter={e => { if (!href) return; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 28px rgba(0,0,0,0.09), 0 0 0 1px ${color}22` }}
      onMouseLeave={e => { if (!href) return; (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.05), 0 0 1px rgba(0,0,0,0.04)" }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, ${color}66)`, borderRadius: "18px 18px 0 0" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
          {icon}
        </div>
        {trend && <span style={{ fontSize: 11, fontWeight: 700, color: trend.startsWith("+") ? "#30D158" : "#FF453A", background: trend.startsWith("+") ? "rgba(48,209,88,0.1)" : "rgba(255,69,58,0.1)", padding: "2px 7px", borderRadius: 99 }}>{trend}</span>}
      </div>
      <div>
        <p style={{ fontSize: 26, fontWeight: 800, color: loading ? "#E2E8F0" : "#1D1D1F", letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums" as const, background: loading ? "#E2E8F0" : "none", borderRadius: loading ? 6 : 0, minWidth: loading ? 50 : undefined, lineHeight: 1 }}>
          {loading ? "    " : value}
        </p>
        <p style={{ fontSize: 12, color: "#6E6E73", fontWeight: 500, marginTop: 4 }}>{label}</p>
        {sub && !loading && <p style={{ fontSize: 11, color: "#98989D", marginTop: 2 }}>{sub}</p>}
      </div>
    </div>
  )
  if (href) return <Link href={href} style={{ textDecoration: "none" }}>{content}</Link>
  return content
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, sub, color = "#f97316" }: { title: string; sub?: string; color?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 3, height: 16, background: color, borderRadius: 99 }} />
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F" }}>{title}</p>
      </div>
      {sub && <p style={{ fontSize: 11, color: "#98989D", marginTop: 3, marginLeft: 11 }}>{sub}</p>}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [stats,      setStats]      = useState<Stats>({ lojas_ativas: 0, lojas_pendentes: 0, motoboys_ativos: 0, motoboys_pendentes: 0, pedidos_hoje: 0, faturamento_hoje: 0, ticket_medio: 0, cancelamentos: 0 })
  const [lojaRank,   setLojaRank]   = useState<LojaRank[]>([])
  const [lojasBaixa, setLojasBaixa] = useState<LojaRank[]>([])
  const [moboyRank,  setMoboyRank]  = useState<MoboyRank[]>([])
  const [recentes,   setRecentes]   = useState<RecentPed[]>([])
  const [loading,    setLoading]    = useState(true)
  const [periodo,    setPeriodo]    = useState<Periodo>("7d")
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  async function load(p: Periodo = periodo) {
    setLoading(true)
    const hoje    = new Date().toISOString().slice(0, 10)
    const cutoff  = p === "hoje" ? hoje : p === "7d"
      ? new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10)
      : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

    const [lojasRes, motoboyRes, pedidosRes, pedHojeRes, todosPedRes] = await Promise.all([
      supabase.from("lojas").select("id, nome, status, categoria"),
      supabase.from("motoboys").select("id, nome, status"),
      supabase.from("pedidos")
        .select("id, codigo, total, status, loja_id, motoboy_id, taxa_entrega, criado_em, loja:lojas(nome), motoboy:motoboys(nome)")
        .gte("criado_em", cutoff)
        .order("criado_em", { ascending: false })
        .limit(500),
      supabase.from("pedidos").select("total, status, criado_em").gte("criado_em", hoje),
      supabase.from("pedidos").select("id, codigo, total, status, criado_em, loja:lojas(nome)")
        .order("criado_em", { ascending: false }).limit(8),
    ])

    const lojasData   = lojasRes.data   ?? []
    const motoboyData = motoboyRes.data ?? []
    const pedData     = (pedidosRes.data ?? []) as any[]
    const pedHoje     = (pedHojeRes.data ?? []) as any[]

    // Stats hoje
    const validos = pedHoje.filter((p: any) => p.status !== "cancelado")
    const entregues = pedHoje.filter((p: any) => p.status === "entregue")
    const fatHoje = entregues.reduce((a: number, p: any) => a + (p.total ?? 0), 0)
    const ticket  = validos.length > 0 ? validos.reduce((a: number, p: any) => a + (p.total ?? 0), 0) / validos.length : 0
    const cancelHoje = pedHoje.filter((p: any) => p.status === "cancelado").length

    setStats({
      lojas_ativas:       lojasData.filter(l => l.status === "ativo").length,
      lojas_pendentes:    lojasData.filter(l => l.status === "pendente").length,
      motoboys_ativos:    motoboyData.filter(m => m.status === "ativo").length,
      motoboys_pendentes: motoboyData.filter(m => m.status === "pendente").length,
      pedidos_hoje:  validos.length,
      faturamento_hoje: fatHoje,
      ticket_medio: ticket,
      cancelamentos: cancelHoje,
    })

    // Ranking lojas por faturamento no período
    const lojaMap = new Map<string, { nome: string; total: number; pedidos: number; categoria?: string }>()
    for (const ped of pedData) {
      if (ped.status === "cancelado" || !ped.loja_id) continue
      const prev = lojaMap.get(ped.loja_id) ?? { nome: (ped.loja as any)?.nome ?? "—", total: 0, pedidos: 0, categoria: undefined }
      lojaMap.set(ped.loja_id, { ...prev, total: prev.total + (ped.total ?? 0), pedidos: prev.pedidos + 1 })
    }
    // Enrich with categoria
    for (const loja of lojasData) {
      const entry = lojaMap.get(loja.id)
      if (entry) lojaMap.set(loja.id, { ...entry, categoria: loja.categoria ?? undefined })
    }
    const sorted = Array.from(lojaMap.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total)
    setLojaRank(sorted.slice(0, 5))

    // Lojas ativas com baixa/nenhuma demanda
    const lojasAtivas = lojasData.filter(l => l.status === "ativo")
    const baixaDemanda = lojasAtivas
      .map(l => {
        const stats = lojaMap.get(l.id) ?? { nome: l.nome, total: 0, pedidos: 0 }
        return { id: l.id, nome: l.nome, total: stats.total, pedidos: stats.pedidos, categoria: l.categoria ?? undefined }
      })
      .filter(l => l.pedidos < 3)
      .sort((a, b) => a.pedidos - b.pedidos)
      .slice(0, 5)
    setLojasBaixa(baixaDemanda)

    // Ranking motoboys por entregas
    const mobMap = new Map<string, { nome: string; entregas: number; faturamento: number }>()
    for (const ped of pedData) {
      if (ped.status !== "entregue" || !ped.motoboy_id) continue
      const prev = mobMap.get(ped.motoboy_id) ?? { nome: (ped.motoboy as any)?.nome ?? "—", entregas: 0, faturamento: 0 }
      mobMap.set(ped.motoboy_id, { ...prev, entregas: prev.entregas + 1, faturamento: prev.faturamento + (ped.taxa_entrega ?? 0) })
    }
    const mobSorted = Array.from(mobMap.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.entregas - a.entregas)
    setMoboyRank(mobSorted.slice(0, 5))

    // Pedidos recentes
    setRecentes(((todosPedRes.data ?? []) as any[]).map(p => ({
      id: p.id, codigo: p.codigo, total: p.total, status: p.status,
      loja_nome: (p.loja as any)?.nome ?? "—", criado_em: p.criado_em,
    })))

    setLastUpdate(new Date())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function changePeriodo(p: Periodo) {
    setPeriodo(p)
    load(p)
  }

  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
  const temAcao = stats.lojas_pendentes > 0 || stats.motoboys_pendentes > 0
  const maxLojaTotal = lojaRank[0]?.total ?? 1
  const maxMobEntregas = moboyRank[0]?.entregas ?? 1
  const periodoLabel = periodo === "hoje" ? "Hoje" : periodo === "7d" ? "7 dias" : "30 dias"

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* ─── Header ─── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 16 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>
            Visão geral
          </p>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: "#1D1D1F", letterSpacing: "-0.7px", marginBottom: 4 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: "#98989D", textTransform: "capitalize" }}>{hoje}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {/* Periodo */}
          <div style={{ display: "flex", background: "rgba(0,0,0,0.05)", borderRadius: 10, padding: 3, gap: 2 }}>
            {(["hoje", "7d", "30d"] as Periodo[]).map(p => (
              <button key={p} onClick={() => changePeriodo(p)} style={{
                padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12,
                background: periodo === p ? "white" : "transparent",
                color: periodo === p ? "#1D1D1F" : "#6E6E73",
                boxShadow: periodo === p ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s",
              }}>
                {p === "hoje" ? "Hoje" : p === "7d" ? "7 dias" : "30 dias"}
              </button>
            ))}
          </div>
          {/* Live */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 50, padding: "7px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#30D158", boxShadow: "0 0 0 3px rgba(48,209,88,0.2)", display: "block" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6E6E73" }}>Online</span>
          </div>
          {/* Refresh */}
          <button onClick={() => load()} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6E6E73", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </button>
        </div>
      </div>

      {/* ─── Alerta ─── */}
      {temAcao && !loading && (
        <div style={{ marginBottom: 24, background: "linear-gradient(135deg, #fffbeb, #fff7ed)", border: "1.5px solid #fde68a", borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <p style={{ fontWeight: 700, color: "#92400e", fontSize: 13 }}>Ação necessária</p>
              <p style={{ fontSize: 12, color: "#a16207", marginTop: 1 }}>
                {stats.lojas_pendentes > 0 && `${stats.lojas_pendentes} loja(s) aguardando aprovação. `}
                {stats.motoboys_pendentes > 0 && `${stats.motoboys_pendentes} motoboy(s) aguardando aprovação.`}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {stats.lojas_pendentes > 0 && <Link href="/chego-ctrl/lojas" style={{ padding: "7px 14px", borderRadius: 9, background: "#d97706", color: "white", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Ver lojas →</Link>}
            {stats.motoboys_pendentes > 0 && <Link href="/chego-ctrl/motoboys" style={{ padding: "7px 14px", borderRadius: 9, background: "#d97706", color: "white", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Ver motoboys →</Link>}
          </div>
        </div>
      )}

      {/* ─── KPI Grid ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        <KpiCard loading={loading} label="Lojas Ativas" value={stats.lojas_ativas} href="/chego-ctrl/lojas" color="#f97316"
          sub={stats.lojas_pendentes > 0 ? `${stats.lojas_pendentes} pend. aprovação` : "Todas operando"}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
        />
        <KpiCard loading={loading} label="Motoboys Ativos" value={stats.motoboys_ativos} href="/chego-ctrl/motoboys" color="#3b82f6"
          sub={stats.motoboys_pendentes > 0 ? `${stats.motoboys_pendentes} pend. aprovação` : "Todos ativos"}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
        />
        <KpiCard loading={loading} label="Pedidos Hoje" value={stats.pedidos_hoje} href="/chego-ctrl/pedidos" color="#8b5cf6"
          sub={stats.cancelamentos > 0 ? `${stats.cancelamentos} cancelados` : "Sem cancelamentos"}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>}
        />
        <KpiCard loading={loading} label="Faturamento Hoje" value={fmtBRL(stats.faturamento_hoje)} color="#30D158"
          sub={stats.ticket_medio > 0 ? `Ticket médio ${fmtBRL(stats.ticket_medio)}` : "Aguardando pedidos"}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
        />
      </div>

      {/* ─── Bottom Grid: Rankings + Recentes ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

        {/* Col 1: Ranking Lojas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Top Lojas */}
          <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #F5F5F7" }}>
              <SectionHeader title="Ranking de Lojas" sub={`Faturamento — ${periodoLabel}`} color="#f97316" />
              {lojaRank.length === 0 && !loading && (
                <p style={{ fontSize: 12, color: "#98989D", textAlign: "center", padding: "12px 0" }}>Sem dados no período</p>
              )}
            </div>
            <div style={{ padding: "6px 0" }}>
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 24, height: 24, background: "#F1F5F9", borderRadius: 8 }} />
                  <div style={{ flex: 1, height: 12, background: "#F1F5F9", borderRadius: 6 }} />
                  <div style={{ width: 50, height: 12, background: "#F1F5F9", borderRadius: 6 }} />
                </div>
              )) : lojaRank.map((loja, i) => {
                const medals = ["🥇", "🥈", "🥉", "4°", "5°"]
                const pct = (loja.total / maxLojaTotal) * 100
                const colors = ["#f97316", "#94a3b8", "#d97706", "#64748B", "#94a3b8"]
                return (
                  <div key={loja.id} style={{ padding: "10px 20px", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#FAFAFA")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>{medals[i]}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#1D1D1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loja.nome}</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: colors[i], flexShrink: 0, marginLeft: 8 }}>{fmtShort(loja.total)}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {bar(pct, colors[i])}
                          <p style={{ fontSize: 10, color: "#98989D", flexShrink: 0 }}>{loja.pedidos} ped.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lojas com baixa demanda */}
          {lojasBaixa.length > 0 && (
            <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(255,69,58,0.15)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #FFF5F5" }}>
                <SectionHeader title="Lojas precisam de atenção" sub={`Poucos pedidos em ${periodoLabel}`} color="#FF453A" />
              </div>
              <div style={{ padding: "6px 0" }}>
                {lojasBaixa.map(loja => (
                  <div key={loja.id} style={{ padding: "9px 20px", display: "flex", alignItems: "center", gap: 10, transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#FFFAFA")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: loja.pedidos === 0 ? "#FF453A" : "#FF9F0A", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#1D1D1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loja.nome}</p>
                      {loja.categoria && <p style={{ fontSize: 11, color: "#98989D" }}>{loja.categoria}</p>}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: loja.pedidos === 0 ? "#FF453A" : "#FF9F0A", flexShrink: 0 }}>
                      {loja.pedidos === 0 ? "Sem pedidos" : `${loja.pedidos} pedido${loja.pedidos > 1 ? "s" : ""}`}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "10px 20px", background: "#FFF9F9", borderTop: "1px solid #FFF5F5" }}>
                <p style={{ fontSize: 11, color: "#98989D", lineHeight: 1.5 }}>
                  Considere contatar essas lojas para entender as dificuldades e ajudá-las a aumentar vendas.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Col 2: Ranking Motoboys */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #F5F5F7" }}>
              <SectionHeader title="Ranking de Motoboys" sub={`Entregas realizadas — ${periodoLabel}`} color="#3b82f6" />
            </div>
            <div style={{ padding: "6px 0" }}>
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, background: "#F1F5F9", borderRadius: "50%" }} />
                  <div style={{ flex: 1, height: 12, background: "#F1F5F9", borderRadius: 6 }} />
                  <div style={{ width: 40, height: 12, background: "#F1F5F9", borderRadius: 6 }} />
                </div>
              )) : moboyRank.length === 0 ? (
                <p style={{ padding: "20px", fontSize: 12, color: "#98989D", textAlign: "center" }}>Sem entregas no período</p>
              ) : moboyRank.map((mb, i) => {
                const pct = (mb.entregas / maxMobEntregas) * 100
                const avatarColors = ["#3b82f6", "#8b5cf6", "#10b981", "#f97316", "#ec4899"]
                const initials = mb.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
                return (
                  <div key={mb.id} style={{ padding: "10px 20px", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#FAFAFA")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${avatarColors[i]}18`, border: `1.5px solid ${avatarColors[i]}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: avatarColors[i] }}>{initials}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#1D1D1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mb.nome}</p>
                          <div style={{ flexShrink: 0, marginLeft: 8, textAlign: "right" }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: avatarColors[i] }}>{mb.entregas} ent.</p>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {bar(pct, avatarColors[i])}
                          <p style={{ fontSize: 10, color: "#98989D", flexShrink: 0 }}>{fmtShort(mb.faturamento)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Acesso rápido compacto */}
          <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #F5F5F7" }}>
              <SectionHeader title="Acesso rápido" color="#6E6E73" />
            </div>
            <div style={{ padding: "8px 12px" }}>
              {[
                { href: "/chego-ctrl/despacho", label: "Despacho ao vivo", color: "#5E5CE6", icon: "📡" },
                { href: "/chego-ctrl/saques",   label: "Financeiro",       color: "#30D158", icon: "💳" },
                { href: "/chego-ctrl/cupons",   label: "Cupons",           color: "#ec4899", icon: "🏷️" },
                { href: "/chego-ctrl/pedidos",  label: "Todos os pedidos", color: "#3b82f6", icon: "📦" },
              ].map(item => (
                <Link key={item.href} href={item.href} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 10,
                  textDecoration: "none", transition: "background 0.15s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#F5F5F7")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1D1D1F", flex: 1 }}>{item.label}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#98989D" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Col 3: Pedidos recentes */}
        <div>
          <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #F5F5F7", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <SectionHeader title="Atividade recente" sub="Últimos pedidos" color="#8b5cf6" />
              <Link href="/chego-ctrl/pedidos" style={{ fontSize: 12, color: "#f97316", fontWeight: 700, textDecoration: "none" }}>Ver todos →</Link>
            </div>
            <div style={{ padding: "4px 0" }}>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ padding: "10px 20px", display: "flex", gap: 10 }}>
                  <div style={{ flex: 1, height: 14, background: "#F1F5F9", borderRadius: 6 }} />
                  <div style={{ width: 50, height: 14, background: "#F1F5F9", borderRadius: 6 }} />
                </div>
              )) : recentes.length === 0 ? (
                <p style={{ padding: "24px", fontSize: 12, color: "#98989D", textAlign: "center" }}>Nenhum pedido ainda</p>
              ) : recentes.map((ped, i) => {
                const cor = STATUS_COLOR[ped.status] ?? "#98989D"
                const mins = Math.floor((Date.now() - new Date(ped.criado_em).getTime()) / 60000)
                const timeAgo = mins < 60 ? `${mins}min` : `${Math.floor(mins / 60)}h`
                return (
                  <div key={ped.id} style={{
                    padding: "10px 20px",
                    borderBottom: i < recentes.length - 1 ? "1px solid #F5F5F7" : "none",
                    transition: "background 0.15s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#FAFAFA")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: cor, flexShrink: 0 }} />
                          <p style={{ fontSize: 12, fontWeight: 700, color: "#1D1D1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ped.loja_nome}
                          </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, marginLeft: 13 }}>
                          <span style={{ fontSize: 10, color: cor, fontWeight: 700 }}>{STATUS_LABEL[ped.status] ?? ped.status}</span>
                          <span style={{ fontSize: 10, color: "#98989D" }}>· #{ped.codigo?.slice(-4)}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F" }}>{fmtBRL(ped.total ?? 0)}</p>
                        <p style={{ fontSize: 10, color: "#98989D", marginTop: 2 }}>{timeAgo} atrás</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {lastUpdate && (
              <div style={{ padding: "10px 20px", background: "#FAFAFA", borderTop: "1px solid #F5F5F7" }}>
                <p style={{ fontSize: 10, color: "#98989D" }}>
                  Atualizado às {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
