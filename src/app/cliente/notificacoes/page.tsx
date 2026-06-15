"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useClienteAuth } from "@/lib/auth-cliente"
import { supabase } from "@/lib/supabase"

export default function NotificacoesPage() {
  const router = useRouter()
  const { user, loading } = useClienteAuth()
  const [pedidosRecentes, setPedidosRecentes] = useState<any[]>([])

  useEffect(() => {
    if (!loading && !user) router.push("/cliente/entrar")
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    supabase
      .from("pedidos")
      .select("id, codigo, status, total, criado_em, loja:lojas(nome)")
      .eq("cliente_id", user.id)
      .order("criado_em", { ascending: false })
      .limit(10)
      .then(({ data }) => setPedidosRecentes(data ?? []))
  }, [user])

  const STATUS_ICON: Record<string, { emoji: string; msg: string; cor: string }> = {
    pendente:   { emoji: "⏳", msg: "aguardando confirmação da loja",  cor: "#f59e0b" },
    aceito:     { emoji: "✅", msg: "pedido confirmado pela loja!",    cor: "#22c55e" },
    preparando: { emoji: "👨‍🍳", msg: "sua comida está sendo preparada", cor: "#60a5fa" },
    pronto:     { emoji: "📦", msg: "pronto! aguardando motoboy",       cor: "#a78bfa" },
    coletado:   { emoji: "🛵", msg: "motoboy a caminho!",               cor: "#DC2626" },
    entregue:   { emoji: "🎉", msg: "pedido entregue! Aproveite!",      cor: "#22c55e" },
    cancelado:  { emoji: "❌", msg: "pedido cancelado",                  cor: "#f87171" },
  }

  function timeAgo(dateStr: string) {
    const d = new Date(dateStr)
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "Agora"
    if (mins < 60) return `${mins} min atrás`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h atrás`
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#9CA3AF" }}>Carregando...</p>
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <nav style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>←</button>
        <p style={{ color: "#111827", fontWeight: 800, fontSize: 16, flex: 1 }}>Notificações</p>
        <Link href="/cliente/configuracoes" style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
          Configurar
        </Link>
      </nav>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 20px 80px", display: "flex", flexDirection: "column", gap: 0 }}>
        {pedidosRecentes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🔔</p>
            <p style={{ color: "#374151", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Nenhuma notificação</p>
            <p style={{ color: "#9CA3AF", fontSize: 13 }}>As atualizações dos seus pedidos aparecerão aqui.</p>
          </div>
        ) : (
          <>
            <p style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
              Atividade recente
            </p>
            {pedidosRecentes.map(p => {
              const info = STATUS_ICON[p.status] ?? { emoji: "●", msg: p.status, cor: "#DC2626" }
              return (
                <Link key={p.id} href={`/pedido/${p.codigo}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    background: "#ffffff", borderRadius: 14, border: "1px solid #e5e7eb",
                    padding: "14px 16px", marginBottom: 10, display: "flex", gap: 12, alignItems: "flex-start",
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                      background: `${info.cor}15`, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20,
                    }}>
                      {info.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "#111827", fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                        Pedido #{p.codigo} — {(p.loja as any)?.nome ?? "Loja"}
                      </p>
                      <p style={{ color: "#6B7280", fontSize: 13 }}>
                        Pedido {info.msg}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ color: "#9CA3AF", fontSize: 11 }}>{timeAgo(p.criado_em)}</p>
                      <p style={{ color: "#DC2626", fontWeight: 700, fontSize: 13, marginTop: 2 }}>R$ {p.total.toFixed(2)}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
