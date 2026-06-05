"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuth } from "@/lib/auth"

const NAV = [
  { href: "/admin",          icon: "📊", label: "Dashboard" },
  { href: "/admin/lojas",    icon: "🏪", label: "Lojas" },
  { href: "/admin/motoboys", icon: "🏍️", label: "Motoboys" },
  { href: "/admin/pedidos",  icon: "📦", label: "Pedidos" },
  { href: "/admin/saques",   icon: "💸", label: "Financeiro" },
  { href: "/admin/cupons",   icon: "🎟️", label: "Cupons" },
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
        <div className="p-5 pb-4" style={{ borderBottom: "1px solid #1a1a1a" }}>
          <p className="font-black text-lg" style={{ color: "#f97316" }}>🛵 Arago</p>
          <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.25)" }}>Delivery · Admin</p>
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
                <span>{n.icon}</span>
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
