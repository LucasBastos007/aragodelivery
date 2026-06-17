"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuth } from "@/lib/auth"

const NAV = [
  {
    href: "/admin", label: "Dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    href: "/admin/lojas", label: "Lojas",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: "/admin/motoboys", label: "Motoboys",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/>
        <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
      </svg>
    ),
  },
  {
    href: "/admin/pedidos", label: "Pedidos",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/>
        <polyline points="16.5 9.4 7.55 4.24"/><line x1="3.29" y1="7" x2="12" y2="12"/><line x1="12" y1="22" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    href: "/admin/despacho", label: "Despacho",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="2"/>
        <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
      </svg>
    ),
  },
  {
    href: "/admin/saques", label: "Financeiro",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    href: "/admin/cupons", label: "Cupons",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
        <line x1="7" y1="7" x2="7.01" y2="7"/>
      </svg>
    ),
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const { sessao, authLoading, logout } = useAuth()

  useEffect(() => {
    if (!authLoading && (!sessao || sessao.role !== "admin")) {
      router.push("/entrar")
    }
  }, [sessao, authLoading, router])

  if (authLoading || !sessao || sessao.role !== "admin") {
    return (
      <div style={{ minHeight: "100vh", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #f97316", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>Verificando acesso…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  function handleLogout() {
    logout()
    router.push("/entrar")
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F1F5F9" }}>
      {/* Sidebar */}
      <aside style={{
        width: 232,
        background: "white",
        borderRight: "1px solid #E2E8F0",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        boxShadow: "4px 0 24px rgba(0,0,0,0.04)",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}>
        {/* Logo */}
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid #F1F5F9",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <div style={{
            width: 36, height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, #f97316, #dc2626)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(249,115,22,0.35)",
            flexShrink: 0,
          }}>
            <img src="/logo-chego.png" alt="Chegô" width={24} height={24}
              style={{ borderRadius: 6, objectFit: "cover" }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
            />
          </div>
          <div>
            <p style={{ fontWeight: 900, fontSize: 15, color: "#0F172A", lineHeight: 1 }}>Chegô</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginTop: 2 }}>Painel Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#CBD5E1", letterSpacing: 1, textTransform: "uppercase", padding: "4px 10px 8px" }}>
            Navegação
          </p>
          {NAV.map(n => {
            const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href)
            return (
              <Link key={n.href} href={n.href} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 10,
                fontSize: 13, fontWeight: 600,
                textDecoration: "none",
                transition: "all 0.15s",
                background: active
                  ? "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(220,38,38,0.08))"
                  : "transparent",
                color: active ? "#ea580c" : "#64748B",
                border: active ? "1px solid rgba(249,115,22,0.2)" : "1px solid transparent",
                boxShadow: active ? "0 2px 8px rgba(249,115,22,0.1)" : "none",
              }}>
                <span style={{ color: active ? "#f97316" : "#94a3b8", flexShrink: 0 }}>
                  {n.icon}
                </span>
                {n.label}
                {active && (
                  <span style={{
                    marginLeft: "auto", width: 6, height: 6, borderRadius: "50%",
                    background: "#f97316",
                    boxShadow: "0 0 6px #f97316",
                  }} />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{
          padding: "14px 20px",
          borderTop: "1px solid #F1F5F9",
          background: "linear-gradient(to bottom, white, #FAFAFA)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "linear-gradient(135deg, #f97316, #dc2626)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 900, color: "white",
              boxShadow: "0 2px 8px rgba(249,115,22,0.3)",
            }}>A</div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>Admin</p>
              <p style={{ fontSize: 10, color: "#94a3b8" }}>Aragoiânia · GO</p>
            </div>
          </div>
          <button onClick={handleLogout} style={{
            width: "100%", padding: "7px 12px", borderRadius: 8,
            background: "#FEF2F2", border: "1px solid #FECACA",
            color: "#ef4444", fontSize: 12, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2" }}
            onMouseLeave={e => { e.currentTarget.style.background = "#FEF2F2" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowAuto: "auto", minHeight: "100vh" } as any}>
        {children}
      </main>
    </div>
  )
}
