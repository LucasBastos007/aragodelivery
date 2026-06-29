"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useClienteAuth } from "@/lib/auth-cliente"
import { useIsMobile } from "@/lib/use-mobile"

export function MobileBottomNav() {
  const pathname = usePathname()
  const { user } = useClienteAuth()
  const isMobile = useIsMobile()

  if (!isMobile) return null

  const tabs = [
    {
      label: "Início",
      href: "/",
      active: pathname === "/",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#DC2626" : "none"} stroke={active ? "#DC2626" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      label: "Busca",
      href: "/busca",
      active: pathname.startsWith("/busca"),
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#DC2626" : "#9CA3AF"} strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
      ),
    },
    {
      label: "Pedidos",
      href: user ? "/cliente/historico" : "/cliente/entrar",
      active: pathname === "/cliente/historico",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "rgba(220,38,38,0.1)" : "none"} stroke={active ? "#DC2626" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
    },
    {
      label: "Perfil",
      href: user ? "/cliente/meu-perfil" : "/cliente/entrar",
      active: pathname.startsWith("/cliente/meu-perfil"),
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "rgba(220,38,38,0.1)" : "none"} stroke={active ? "#DC2626" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
      ),
    },
  ]

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "white", borderTop: "1px solid #e5e7eb",
      display: "flex", justifyContent: "space-around", alignItems: "center",
      paddingTop: 8,
      paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
    }}>
      {tabs.map(item => (
        <Link key={item.label} href={item.href} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          textDecoration: "none", padding: "4px 16px", flex: 1, justifyContent: "center",
          color: item.active ? "#DC2626" : "#9CA3AF",
        }}>
          {item.icon(item.active)}
          <span style={{ fontSize: 10, fontWeight: item.active ? 700 : 600 }}>
            {item.label}
          </span>
        </Link>
      ))}
    </div>
  )
}
