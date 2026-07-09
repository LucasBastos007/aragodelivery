"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuth } from "@/lib/auth"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw     = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

type NavItem = {
  href: string
  label: string
  accent: string
  icon: React.ReactNode
}

const NAV: NavItem[] = [
  {
    href: "/chego-ctrl", label: "Dashboard", accent: "#f97316",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    href: "/chego-ctrl/lojas", label: "Lojas", accent: "#10b981",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: "/chego-ctrl/motoboys", label: "Motoboys", accent: "#3b82f6",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        <path d="M15.5 11.5c1.5.5 3 2 3 5"/>
      </svg>
    ),
  },
  {
    href: "/chego-ctrl/pedidos", label: "Pedidos", accent: "#8b5cf6",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
  {
    href: "/chego-ctrl/despacho", label: "Despacho", accent: "#0ea5e9",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
      </svg>
    ),
  },
  {
    href: "/chego-ctrl/saques", label: "Financeiro", accent: "#22c55e",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <rect x="1" y="4" width="22" height="16" rx="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
        <line x1="12" y1="14" x2="12" y2="14" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/chego-ctrl/mensalidades", label: "Mensalidades", accent: "#8b5cf6",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
      </svg>
    ),
  },
  {
    href: "/chego-ctrl/relatorio", label: "Relatório", accent: "#10b981",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
        <line x1="2"  y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
  {
    href: "/chego-ctrl/cupons", label: "Cupons", accent: "#ec4899",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
        <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="3"/>
      </svg>
    ),
  },
  {
    href: "/chego-ctrl/reembolsos", label: "Reembolsos", accent: "#f43f5e",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
      </svg>
    ),
  },
  {
    href: "/chego-ctrl/configuracoes", label: "Config", accent: "#64748b",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
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
      router.push("/chego-ctrl-login")
    }
  }, [sessao, authLoading, router])

  useEffect(() => {
    if (!sessao || sessao.role !== "admin") return
    async function registerAdminPush() {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
        const reg = await navigator.serviceWorker.register("/sw.js")
        await reg.update()
        const perm = await Notification.requestPermission()
        if (perm !== "granted") return
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) return
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })
        await fetch("/api/sos", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub }),
        })
      } catch {}
    }
    registerAdminPush()
  }, [sessao])

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
    router.push("/chego-ctrl-login")
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F1F5F9" }}>
      {/* Sidebar */}
      <aside style={{
        width: 240,
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
            width: 38, height: 38,
            borderRadius: 11,
            background: "linear-gradient(135deg, #f97316, #dc2626)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(249,115,22,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
            flexShrink: 0,
          }}>
            <img src="/logo-chego.png" alt="Chegô" width={26} height={26}
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
        <nav style={{ flex: 1, padding: "14px 10px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#CBD5E1", letterSpacing: 1.2, textTransform: "uppercase", padding: "4px 10px 10px" }}>
            Menu principal
          </p>
          {NAV.map(n => {
            const active = n.href === "/chego-ctrl" ? path === "/chego-ctrl" : path.startsWith(n.href)
            return (
              <Link key={n.href} href={n.href} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 11,
                fontSize: 13, fontWeight: active ? 700 : 600,
                textDecoration: "none",
                transition: "all 0.15s",
                background: active ? `${n.accent}12` : "transparent",
                color: active ? n.accent : "#64748B",
                border: active ? `1.5px solid ${n.accent}25` : "1.5px solid transparent",
              }}>
                {/* Icon box */}
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: active
                    ? `linear-gradient(135deg, ${n.accent}25, ${n.accent}15)`
                    : "#F8FAFC",
                  border: active ? `1px solid ${n.accent}35` : "1px solid #E2E8F0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: active ? `0 2px 8px ${n.accent}20` : "0 1px 3px rgba(0,0,0,0.04)",
                  color: active ? n.accent : "#94a3b8",
                  transition: "all 0.15s",
                }}>
                  {n.icon}
                </div>
                <span style={{ flex: 1 }}>{n.label}</span>
                {active && (
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: n.accent,
                    boxShadow: `0 0 8px ${n.accent}`,
                    flexShrink: 0,
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
              width: 32, height: 32, borderRadius: "50%",
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
            width: "100%", padding: "8px 12px", borderRadius: 9,
            background: "#FEF2F2", border: "1px solid #FECACA",
            color: "#ef4444", fontSize: 12, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2" }}
            onMouseLeave={e => { e.currentTarget.style.background = "#FEF2F2" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowAuto: "auto", minHeight: "100vh" } as React.CSSProperties}>
        {children}
      </main>
    </div>
  )
}
