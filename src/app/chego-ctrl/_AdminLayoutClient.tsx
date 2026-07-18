"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw     = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

type NavItem = { href: string; label: string; accent: string; icon: React.ReactNode }
type NavGroup = { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Operação",
    items: [
      { href: "/chego-ctrl",          label: "Dashboard",    accent: "#f97316", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg> },
      { href: "/chego-ctrl/despacho", label: "Despacho",     accent: "#0ea5e9", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg> },
      { href: "/chego-ctrl/pedidos",  label: "Pedidos",      accent: "#8b5cf6", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> },
      { href: "/chego-ctrl/lojas",    label: "Lojas",        accent: "#10b981", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
      { href: "/chego-ctrl/motoboys", label: "Motoboys",     accent: "#3b82f6", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M15.5 11.5c1.5.5 3 2 3 5"/></svg> },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { href: "/chego-ctrl/saques",       label: "Financeiro",   accent: "#22c55e", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="12" y1="14" x2="12" y2="14" strokeWidth="3" strokeLinecap="round"/></svg> },
      { href: "/chego-ctrl/mensalidades", label: "Mensalidades", accent: "#8b5cf6", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg> },
      { href: "/chego-ctrl/reembolsos",   label: "Reembolsos",   accent: "#f43f5e", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg> },
    ],
  },
  {
    title: "Análise",
    items: [
      { href: "/chego-ctrl/acessos",  label: "Acessos",  accent: "#06b6d4", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
      { href: "/chego-ctrl/relatorio", label: "Relatório", accent: "#10b981", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg> },
    ],
  },
  {
    title: "Outros",
    items: [
      { href: "/chego-ctrl/cupons",        label: "Cupons", accent: "#ec4899", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="3"/></svg> },
      { href: "/chego-ctrl/configuracoes", label: "Config", accent: "#64748b", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
    ],
  },
]

const NAV = NAV_GROUPS.flatMap(g => g.items)

// Bottom nav items (mobile)
const BOTTOM_NAV = [NAV[0], NAV[1], NAV[2], NAV[3]]

function NavLink({ n, active, onClick }: { n: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Link key={n.href} href={n.href} onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 10px", borderRadius: 11,
      fontSize: 13, fontWeight: active ? 700 : 600,
      textDecoration: "none", transition: "all 0.15s",
      background: active ? `${n.accent}12` : "transparent",
      color: active ? n.accent : "#64748B",
      border: active ? `1.5px solid ${n.accent}25` : "1.5px solid transparent",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: active ? `linear-gradient(135deg, ${n.accent}25, ${n.accent}15)` : "#F8FAFC",
        border: active ? `1px solid ${n.accent}35` : "1px solid #E2E8F0",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: active ? n.accent : "#94a3b8",
      }}>
        {n.icon}
      </div>
      <span style={{ flex: 1 }}>{n.label}</span>
      {active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: n.accent, boxShadow: `0 0 8px ${n.accent}`, flexShrink: 0 }} />}
    </Link>
  )
}

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const path     = usePathname()
  const router   = useRouter()
  const { sessao, authLoading, logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!authLoading && (!sessao || sessao.role !== "admin")) router.push("/chego-ctrl-login")
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
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) })
        await fetch("/api/sos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub }) })
      } catch {}
    }
    registerAdminPush()
  }, [sessao])

  // Close drawer on navigation
  useEffect(() => { setDrawerOpen(false) }, [path])

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

  function handleLogout() { logout(); router.push("/chego-ctrl-login") }

  const SidebarContent = ({ onClickLink }: { onClickLink?: () => void }) => (
    <>
      {/* Logo */}
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg, #f97316, #dc2626)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(249,115,22,0.4)", flexShrink: 0 }}>
          <img src="/logo-chego.png" alt="Chegô" width={26} height={26} style={{ borderRadius: 6, objectFit: "cover" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none" }} />
        </div>
        <div>
          <p style={{ fontWeight: 900, fontSize: 15, color: "#0F172A", lineHeight: 1 }}>Chegô</p>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginTop: 2 }}>Painel Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 10px", display: "flex", flexDirection: "column", gap: 0, overflowY: "auto" }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.title} style={{ marginBottom: gi < NAV_GROUPS.length - 1 ? 6 : 0 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#CBD5E1", letterSpacing: 1.2, textTransform: "uppercase", padding: gi === 0 ? "4px 10px 8px" : "10px 10px 8px" }}>
              {group.title}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {group.items.map(n => {
                const active = n.href === "/chego-ctrl" ? path === "/chego-ctrl" : path.startsWith(n.href)
                return <NavLink key={n.href} n={n} active={active} onClick={onClickLink} />
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: "14px 20px", borderTop: "1px solid #F1F5F9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #f97316, #dc2626)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "white" }}>A</div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>Admin</p>
            <p style={{ fontSize: 10, color: "#94a3b8" }}>Aragoiânia · GO</p>
          </div>
        </div>
        <button onClick={handleLogout} style={{ width: "100%", padding: "8px 12px", borderRadius: 9, background: "#FEF2F2", border: "1px solid #FECACA", color: "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sair da conta
        </button>
      </div>
    </>
  )

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          .admin-sidebar { display: none !important; }
          .admin-topbar  { display: flex !important; }
          .admin-main    {
            margin-top: 52px !important;
            height: calc(100vh - 112px) !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch;
          }
          .admin-topbar-spacer { display: none !important; }
          .admin-bottomnav { display: flex !important; }
        }
        @media (min-width: 768px) {
          .admin-sidebar { display: flex !important; }
          .admin-topbar  { display: none !important; }
          .admin-bottomnav { display: none !important; }
        }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideIn { from { transform: translateX(-100%) } to { transform: translateX(0) } }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh", background: "#F1F5F9" }}>

        {/* ── Desktop sidebar ── */}
        <aside className="admin-sidebar" style={{ width: 240, background: "white", borderRight: "1px solid #E2E8F0", flexShrink: 0, flexDirection: "column", boxShadow: "4px 0 24px rgba(0,0,0,0.04)", position: "sticky", top: 0, height: "100vh" }}>
          <SidebarContent />
        </aside>

        {/* ── Mobile top bar ── */}
        <div className="admin-topbar" style={{ display: "none", position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, height: 52, background: "white", borderBottom: "1px solid #E2E8F0", alignItems: "center", justifyContent: "space-between", padding: "0 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #f97316, #dc2626)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="/logo-chego.png" alt="" width={22} height={22} style={{ borderRadius: 5, objectFit: "cover" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none" }} />
            </div>
            <span style={{ fontWeight: 900, fontSize: 15, color: "#0F172A" }}>Chegô Admin</span>
          </div>
          <button onClick={() => setDrawerOpen(true)} style={{ background: "none", border: "none", padding: 6, cursor: "pointer", display: "flex", alignItems: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>

        {/* ── Mobile drawer overlay ── */}
        {drawerOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 60 }} onClick={() => setDrawerOpen(false)}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 260, background: "white", display: "flex", flexDirection: "column", animation: "slideIn 0.22s ease", boxShadow: "4px 0 24px rgba(0,0,0,0.15)" }}>
              <SidebarContent onClickLink={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        {/* ── Main content ── */}
        <main className="admin-main" style={{ flex: 1, minWidth: 0 } as React.CSSProperties}>
          {children}
        </main>

        {/* ── Mobile bottom nav ── */}
        <nav className="admin-bottomnav" style={{ display: "none", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, height: 60, background: "white", borderTop: "1px solid #E2E8F0", alignItems: "stretch", boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }}>
          {BOTTOM_NAV.map(n => {
            const active = n.href === "/chego-ctrl" ? path === "/chego-ctrl" : path.startsWith(n.href)
            return (
              <Link key={n.href} href={n.href} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, textDecoration: "none", color: active ? n.accent : "#94a3b8", fontWeight: active ? 700 : 500, fontSize: 10, transition: "color 0.15s" }}>
                <div style={{ color: active ? n.accent : "#94a3b8" }}>{n.icon}</div>
                {n.label}
              </Link>
            )
          })}
          {/* Menu button */}
          <button onClick={() => setDrawerOpen(true)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, border: "none", background: "none", color: "#94a3b8", fontSize: 10, fontWeight: 500, cursor: "pointer" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            Mais
          </button>
        </nav>
      </div>
    </>
  )
}
