"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth"

const NAV = [
  { href: "/motoboy",            icon: "🛵", label: "Pedidos" },
  { href: "/motoboy/dashboard",  icon: "📊", label: "Dashboard" },
  { href: "/motoboy/historico",  icon: "📋", label: "Histórico" },
  { href: "/motoboy/financeiro", icon: "💰", label: "Ganhos" },
]

export default function MotoboyLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { sessao, authLoading, logout } = useAuth()

  useEffect(() => {
    if (!authLoading && (!sessao || sessao.role !== "motoboy")) {
      router.push("/entrar")
    }
  }, [sessao, authLoading, router])

  if (authLoading || !sessao || sessao.role !== "motoboy") {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.3)" }}>Verificando acesso...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingBottom: 72 }}>
      {/* Top nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "#0d0d0d", borderBottom: "1px solid #1a1a1a",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px",
      }}>
        <div>
          <p style={{ color: "#f97316", fontWeight: 900, fontSize: 16 }}>🛵 Arago</p>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 1 }}>
            {sessao.motoboy_nome}
          </p>
        </div>
        <button onClick={() => { logout(); router.push("/entrar") }}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          Sair
        </button>
      </nav>

      {children}

      {/* Bottom nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "#0d0d0d", borderTop: "1px solid #1a1a1a",
        display: "flex", height: 60,
      }}>
        {NAV.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 3, textDecoration: "none",
              color: active ? "#f97316" : "rgba(255,255,255,0.3)",
              borderTop: active ? "2px solid #f97316" : "2px solid transparent",
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700 }}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
