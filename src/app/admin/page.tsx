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
        lojas_ativas:      lojasData.filter(l => l.status === "ativo").length,
        lojas_pendentes:   lojasData.filter(l => l.status === "pendente").length,
        motoboys_ativos:   motoboyData.filter(m => m.status === "ativo").length,
        motoboys_pendentes: motoboyData.filter(m => m.status === "pendente").length,
        pedidos_hoje:      pedidosData.filter(p => p.status !== "cancelado").length,
        faturamento_hoje:  pedidosData.filter(p => p.status === "entregue").reduce((s, p) => s + (p.total ?? 0), 0),
      })
      setLoading(false)
    }
    load()
  }, [])

  const CARDS: { label: string; value: string | number; icon: React.ReactNode; color: string; alert?: boolean }[] = [
    { label: "Lojas Ativas", value: stats.lojas_ativas, color: "#f97316", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    )},
    { label: "Lojas Pendentes", value: stats.lojas_pendentes, color: "#eab308", alert: true, icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    )},
    { label: "Motoboys Ativos", value: stats.motoboys_ativos, color: "#22c55e", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
    )},
    { label: "Motoboys Pend.", value: stats.motoboys_pendentes, color: "#eab308", alert: true, icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    )},
    { label: "Pedidos Hoje", value: stats.pedidos_hoje, color: "#3b82f6", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><polyline points="16.5 9.4 7.55 4.24"/><line x1="3.29" y1="7" x2="12" y2="12"/><line x1="12" y1="22" x2="12" y2="12"/></svg>
    )},
    { label: "Faturamento Hoje", value: `R$ ${stats.faturamento_hoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "#22c55e", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
    )},
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {CARDS.map(c => (
          <div key={c.label} className="card p-5"
            style={{ border: c.alert && (c.value as number) > 0 ? "1px solid rgba(234,179,8,0.3)" : undefined }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ color: c.color }}>{c.icon}</span>
              {c.alert && (c.value as number) > 0 && (
                <span className="badge badge-yellow">Requer ação</span>
              )}
            </div>
            <p className="text-3xl font-black" style={{ color: c.color }}>
              {loading ? "—" : c.value}
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>{c.label}</p>
          </div>
        ))}
      </div>

      {(stats.lojas_pendentes > 0 || stats.motoboys_pendentes > 0) && (
        <div className="card p-5" style={{ border: "1px solid rgba(234,179,8,0.3)", background: "rgba(234,179,8,0.04)" }}>
          <p className="font-bold text-yellow-400 mb-1">Ação necessária</p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            {stats.lojas_pendentes > 0 && `${stats.lojas_pendentes} loja(s) aguardando aprovação. `}
            {stats.motoboys_pendentes > 0 && `${stats.motoboys_pendentes} motoboy(s) aguardando aprovação.`}
          </p>
          <div className="flex gap-3 mt-3">
            {stats.lojas_pendentes > 0 && (
              <a href="/admin/lojas" className="btn-primary" style={{ fontSize: 12, padding: "8px 14px" }}>Ver lojas →</a>
            )}
            {stats.motoboys_pendentes > 0 && (
              <a href="/admin/motoboys" className="btn-primary" style={{ fontSize: 12, padding: "8px 14px" }}>Ver motoboys →</a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
