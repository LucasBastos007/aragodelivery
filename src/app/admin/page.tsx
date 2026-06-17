"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface Stats {
  lojas_ativas: number
  lojas_pendentes: number
  motoboys_ativos: number
  motoboys_pendentes: number
  pedidos_hoje: number
  faturamento_hoje: number
}

function StatCard({
  label, value, icon, color, bg, alert, href, loading,
}: {
  label: string; value: string | number; icon: React.ReactNode
  color: string; bg: string; alert?: boolean; href?: string; loading: boolean
}) {
  const inner = (
    <div style={{
      background: "white",
      borderRadius: 16,
      padding: "20px 22px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)",
      border: alert ? `1.5px solid ${color}33` : "1.5px solid #F1F5F9",
      display: "flex", flexDirection: "column", gap: 14,
      transition: "box-shadow 0.2s, transform 0.2s",
      cursor: href ? "pointer" : "default",
      textDecoration: "none",
      position: "relative",
      overflow: "hidden",
    }}
      onMouseEnter={e => {
        if (!href) return
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = `0 8px 32px rgba(0,0,0,0.1), 0 2px 8px ${color}22`
        el.style.transform = "translateY(-2px)"
      }}
      onMouseLeave={e => {
        if (!href) return
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)"
        el.style.transform = ""
      }}
    >
      {/* Accent bar top */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${color}, ${color}88)`,
        borderRadius: "16px 16px 0 0",
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 4px 12px ${color}20`,
        }}>
          <span style={{ color }}>{icon}</span>
        </div>
        {alert && (
          <span style={{
            background: color + "18", color, fontSize: 10, fontWeight: 800,
            padding: "3px 8px", borderRadius: 20, border: `1px solid ${color}33`,
            letterSpacing: 0.3,
          }}>
            AÇÃO
          </span>
        )}
      </div>

      <div>
        <p style={{
          fontSize: 28, fontWeight: 900, color: loading ? "#E2E8F0" : "#0F172A",
          lineHeight: 1, letterSpacing: "-0.5px",
          background: loading ? "#E2E8F0" : "none",
          borderRadius: loading ? 8 : 0,
          minWidth: loading ? 60 : undefined,
        }}>
          {loading ? "    " : value}
        </p>
        <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginTop: 4 }}>{label}</p>
      </div>
    </div>
  )

  if (href) return <a href={href} style={{ textDecoration: "none" }}>{inner}</a>
  return inner
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    lojas_ativas: 0, lojas_pendentes: 0,
    motoboys_ativos: 0, motoboys_pendentes: 0,
    pedidos_hoje: 0, faturamento_hoje: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const hoje = new Date().toISOString().slice(0, 10)
      const [lojas, motoboys, pedidos] = await Promise.all([
        supabase.from("lojas").select("status"),
        supabase.from("motoboys").select("status"),
        supabase.from("pedidos").select("total, status, criado_em").gte("criado_em", hoje),
      ])
      const lojasData   = lojas.data ?? []
      const motoboyData = motoboys.data ?? []
      const pedidosData = pedidos.data ?? []
      setStats({
        lojas_ativas:       lojasData.filter(l => l.status === "ativo").length,
        lojas_pendentes:    lojasData.filter(l => l.status === "pendente").length,
        motoboys_ativos:    motoboyData.filter(m => m.status === "ativo").length,
        motoboys_pendentes: motoboyData.filter(m => m.status === "pendente").length,
        pedidos_hoje:       pedidosData.filter(p => p.status !== "cancelado").length,
        faturamento_hoje:   pedidosData.filter(p => p.status === "entregue").reduce((s, p) => s + (p.total ?? 0), 0),
      })
      setLoading(false)
    }
    load()
  }, [])

  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
  const temAcao = stats.lojas_pendentes > 0 || stats.motoboys_pendentes > 0

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Visão geral
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.5px" }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4, textTransform: "capitalize" }}>{hoje}</p>
        </div>

        {/* Live indicator */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "white", border: "1.5px solid #E2E8F0",
          borderRadius: 50, padding: "8px 16px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: "#22c55e",
            boxShadow: "0 0 0 3px rgba(34,197,94,0.2)",
            display: "inline-block",
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Sistema online</span>
        </div>
      </div>

      {/* Alerta de ação necessária */}
      {temAcao && !loading && (
        <div style={{
          marginBottom: 28,
          background: "linear-gradient(135deg, #fffbeb, #fff7ed)",
          border: "1.5px solid #fde68a",
          borderRadius: 14,
          padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
          boxShadow: "0 4px 16px rgba(234,179,8,0.1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "#fef3c7", border: "1.5px solid #fde68a",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <p style={{ fontWeight: 800, color: "#92400e", fontSize: 14 }}>Ação necessária</p>
              <p style={{ fontSize: 13, color: "#a16207", marginTop: 2 }}>
                {stats.lojas_pendentes > 0 && `${stats.lojas_pendentes} loja(s) aguardando aprovação. `}
                {stats.motoboys_pendentes > 0 && `${stats.motoboys_pendentes} motoboy(s) aguardando aprovação.`}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {stats.lojas_pendentes > 0 && (
              <a href="/admin/lojas" style={{
                padding: "8px 16px", borderRadius: 10,
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "white", fontSize: 12, fontWeight: 800, textDecoration: "none",
                boxShadow: "0 4px 12px rgba(217,119,6,0.3)",
              }}>
                Ver lojas →
              </a>
            )}
            {stats.motoboys_pendentes > 0 && (
              <a href="/admin/motoboys" style={{
                padding: "8px 16px", borderRadius: 10,
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "white", fontSize: 12, fontWeight: 800, textDecoration: "none",
                boxShadow: "0 4px 12px rgba(217,119,6,0.3)",
              }}>
                Ver motoboys →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard loading={loading} label="Lojas Ativas" value={stats.lojas_ativas} color="#f97316" bg="#FFF7ED" href="/admin/lojas"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
        />
        <StatCard loading={loading} label="Lojas Pendentes" value={stats.lojas_pendentes} color="#eab308" bg="#FEFCE8" alert={stats.lojas_pendentes > 0} href="/admin/lojas"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        />
        <StatCard loading={loading} label="Motoboys Ativos" value={stats.motoboys_ativos} color="#22c55e" bg="#F0FDF4" href="/admin/motoboys"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>}
        />
        <StatCard loading={loading} label="Motoboys Pend." value={stats.motoboys_pendentes} color="#eab308" bg="#FEFCE8" alert={stats.motoboys_pendentes > 0} href="/admin/motoboys"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        />
        <StatCard loading={loading} label="Pedidos Hoje" value={stats.pedidos_hoje} color="#3b82f6" bg="#EFF6FF" href="/admin/pedidos"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><polyline points="16.5 9.4 7.55 4.24"/><line x1="3.29" y1="7" x2="12" y2="12"/><line x1="12" y1="22" x2="12" y2="12"/></svg>}
        />
        <StatCard loading={loading} label="Faturamento Hoje" color="#10b981" bg="#ECFDF5"
          value={`R$ ${stats.faturamento_hoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
        />
      </div>

      {/* Atalhos rápidos */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>
          Acesso rápido
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { href: "/admin/despacho", label: "Central de Despacho", desc: "Gerenciar corridas ao vivo", color: "#6366f1", bg: "#EEF2FF",
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg> },
            { href: "/admin/saques", label: "Financeiro", desc: "Saques e repasses", color: "#10b981", bg: "#ECFDF5",
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
            { href: "/admin/cupons", label: "Cupons", desc: "Gerenciar promoções", color: "#ec4899", bg: "#FDF2F8",
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
            { href: "/admin/pedidos", label: "Pedidos", desc: "Histórico completo", color: "#3b82f6", bg: "#EFF6FF",
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><polyline points="16.5 9.4 7.55 4.24"/><line x1="3.29" y1="7" x2="12" y2="12"/><line x1="12" y1="22" x2="12" y2="12"/></svg> },
          ].map(item => (
            <a key={item.href} href={item.href} style={{
              display: "flex", flexDirection: "column", gap: 10,
              padding: "16px 18px", borderRadius: 14, textDecoration: "none",
              background: "white", border: "1.5px solid #F1F5F9",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)",
              transition: "all 0.2s",
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLAnchorElement
                el.style.boxShadow = `0 8px 28px rgba(0,0,0,0.1), 0 2px 8px ${item.color}22`
                el.style.transform = "translateY(-3px)"
                el.style.borderColor = item.color + "44"
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLAnchorElement
                el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)"
                el.style.transform = ""
                el.style.borderColor = "#F1F5F9"
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: item.bg, display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 2px 8px ${item.color}20`,
              }}>
                <span style={{ color: item.color }}>{item.icon}</span>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{item.label}</p>
                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{item.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
