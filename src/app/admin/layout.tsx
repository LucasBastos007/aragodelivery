"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuth } from "@/lib/auth"

const NAV_ICON: Record<string, React.ReactNode> = {
  "/admin": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  "/admin/lojas": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  "/admin/motoboys": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/>
      <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
    </svg>
  ),
  "/admin/pedidos": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/>
      <polyline points="16.5 9.4 7.55 4.24"/><line x1="3.29" y1="7" x2="12" y2="12"/><line x1="12" y1="22" x2="12" y2="12"/>
      <circle cx="18.5" cy="15.5" r="2.5"/><path d="M20.27 17.27L22 19"/>
    </svg>
  ),
  "/admin/despacho": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
    </svg>
  ),
  "/admin/saques": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  "/admin/cupons": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
}

const NAV = [
  { href: "/admin",           label: "Dashboard" },
  { href: "/admin/lojas",     label: "Lojas" },
  { href: "/admin/motoboys",  label: "Motoboys" },
  { href: "/admin/pedidos",   label: "Pedidos" },
  { href: "/admin/despacho",  label: "Despacho" },
  { href: "/admin/saques",    label: "Financeiro" },
  { href: "/admin/cupons",    label: "Cupons" },
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
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.3)" }}>Verificando acesso...</p>
      </div>
    )
  }

  function handleLogout() {
    logout()
    router.push("/entrar")
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside style={{ width: 220, background: "#0d0d0d", borderRight: "1px solid #1a1a1a", flexShrink: 0 }}
        className="flex flex-col">
        <div className="p-5 pb-4" style={{ borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo-chego.png" alt="Chegô" width={32} height={32} style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
          <div>
            <p className="font-black text-sm" style={{ color: "#f97316" }}>Chegô</p>
            <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.25)", marginTop: 1 }}>Admin</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV.map(n => {
            const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href)
            return (
              <Link key={n.href} href={n.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: active ? "rgba(249,115,22,0.12)" : "transparent",
                  color: active ? "#f97316" : "rgba(255,255,255,0.4)",
                  border: active ? "1px solid rgba(249,115,22,0.25)" : "1px solid transparent",
                }}>
                <span style={{ color: active ? "#f97316" : "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                  {NAV_ICON[n.href]}
                </span>
                {n.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 flex flex-col gap-2" style={{ borderTop: "1px solid #1a1a1a" }}>
          <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>Aragoiânia - GO</p>
          <button onClick={handleLogout}
            className="text-xs font-semibold text-left"
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", padding: 0 }}>
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 overflow-auto" style={{ background: "#0a0a0a" }}>
        {children}
      </main>
    </div>
  )
}
