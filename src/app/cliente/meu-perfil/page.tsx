"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useClienteAuth } from "@/lib/auth-cliente"
import { supabase } from "@/lib/supabase"
import { useIsMobile } from "@/lib/use-mobile"
import { MobileBottomNav } from "@/components/MobileBottomNav"

export default function MeuPerfilPage() {
  const router = useRouter()
  const { user, perfil, loading, logout } = useClienteAuth()
  const isMobile = useIsMobile()
  const [stats, setStats] = useState<{ total: number; gasto: number } | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push("/cliente/entrar")
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    supabase
      .from("pedidos")
      .select("total")
      .eq("cliente_id", user.id)
      .then(({ data }) => {
        if (!data) return
        setStats({
          total: data.length,
          gasto: data.reduce((s: number, p: any) => s + (p.total ?? 0), 0),
        })
      })
  }, [user])

  const nome = perfil?.nome ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "Usuário"
  const primeiroNome = nome.split(" ")[0]

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#9CA3AF" }}>Carregando...</p>
    </div>
  )

  const menuItems = [
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
      label: "Histórico de pedidos",
      desc: "Veja seus pedidos anteriores",
      href: "/cliente/historico",
      color: "#DC2626",
      bg: "rgba(220,38,38,0.08)",
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
      label: "Notificações",
      desc: "Atualizações dos seus pedidos",
      href: "/cliente/notificacoes",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.08)",
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
      label: "Meus endereços",
      desc: "Endereço de entrega",
      href: "/cliente/alterar-dados",
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.08)",
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
      label: "Convide e ganhe",
      desc: "5 convites = 1 cupom de desconto",
      href: "/cliente/convide",
      color: "#22c55e",
      bg: "rgba(34,197,94,0.08)",
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
      label: "Configurações",
      desc: "Notificações e preferências",
      href: "/cliente/configuracoes",
      color: "#6b7280",
      bg: "rgba(107,114,128,0.08)",
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
      label: "Alterar dados",
      desc: "Nome, telefone e endereço",
      href: "/cliente/alterar-dados",
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.08)",
    },
  ]

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6" }}>

      {/* Header com avatar */}
      <div style={{
        background: "white",
        borderBottom: "1px solid #e5e7eb",
        padding: isMobile ? "20px 20px 24px" : "28px 28px 32px",
      }}>
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>←</button>
            <p style={{ color: "#111827", fontWeight: 800, fontSize: 16 }}>Meu perfil</p>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: isMobile ? 72 : 80, height: isMobile ? 72 : 80, borderRadius: "50%",
            overflow: "hidden", flexShrink: 0,
            background: "rgba(220,38,38,0.08)",
            border: "3px solid rgba(220,38,38,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "#111827", fontWeight: 800, fontSize: 20, marginBottom: 2 }}>{primeiroNome}</p>
            <p style={{ color: "#9CA3AF", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</p>
          </div>

          <Link href="/cliente/alterar-dados" style={{
            padding: "8px 14px", borderRadius: 10,
            background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)",
            color: "#DC2626", fontWeight: 700, fontSize: 13, textDecoration: "none", flexShrink: 0,
          }}>
            Editar
          </Link>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <div style={{ flex: 1, background: "#f8fafc", borderRadius: 12, padding: "12px 14px", border: "1px solid #e5e7eb" }}>
              <p style={{ color: "#DC2626", fontWeight: 900, fontSize: 20, lineHeight: 1 }}>{stats.total}</p>
              <p style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 600, marginTop: 4 }}>Pedidos feitos</p>
            </div>
            <div style={{ flex: 1, background: "#f8fafc", borderRadius: 12, padding: "12px 14px", border: "1px solid #e5e7eb" }}>
              <p style={{ color: "#DC2626", fontWeight: 900, fontSize: 18, lineHeight: 1 }}>R$ {stats.gasto.toFixed(0)}</p>
              <p style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 600, marginTop: 4 }}>Gasto total</p>
            </div>
          </div>
        )}
      </div>

      {/* Menu */}
      <div style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 8, maxWidth: 560, margin: "0 auto", paddingBottom: isMobile ? 96 : 32 }}>
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          {menuItems.map(({ icon, label, desc, href, color, bg }, i) => (
            <Link key={label} href={href} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "14px 16px", textDecoration: "none",
              borderBottom: i < menuItems.length - 1 ? "1px solid #f3f4f6" : "none",
              background: "white",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: bg, display: "flex", alignItems: "center", justifyContent: "center",
                color,
              }}>
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>{label}</p>
                <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 1 }}>{desc}</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          ))}
        </div>

        <button
          onClick={async () => { await logout(); router.push("/") }}
          style={{
            width: "100%", padding: "14px", borderRadius: 14,
            background: "white", border: "1px solid #fee2e2",
            color: "#DC2626", fontWeight: 700, fontSize: 14,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sair da conta
        </button>
      </div>

      <MobileBottomNav />
    </div>
  )
}
