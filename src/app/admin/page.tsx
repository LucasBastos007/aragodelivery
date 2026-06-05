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

  const CARDS = [
    { label: "Lojas Ativas",     value: stats.lojas_ativas,      icon: "🏪", color: "#f97316" },
    { label: "Lojas Pendentes",  value: stats.lojas_pendentes,   icon: "⏳", color: "#eab308", alert: true },
    { label: "Motoboys Ativos",  value: stats.motoboys_ativos,   icon: "🏍️", color: "#22c55e" },
    { label: "Motoboys Pend.",   value: stats.motoboys_pendentes, icon: "⏳", color: "#eab308", alert: true },
    { label: "Pedidos Hoje",     value: stats.pedidos_hoje,      icon: "📦", color: "#3b82f6" },
    {
      label: "Faturamento Hoje",
      value: `R$ ${stats.faturamento_hoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: "💰", color: "#22c55e",
    },
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
              <span className="text-2xl">{c.icon}</span>
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
          <p className="font-bold text-yellow-400 mb-1">⚠️ Ação necessária</p>
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
