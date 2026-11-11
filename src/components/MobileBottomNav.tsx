"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useClienteAuth } from "@/lib/auth-cliente"
import { useIsMobile } from "@/lib/use-mobile"
import { SacolaFlutuante } from "@/components/SacolaFlutuante"

export function MobileBottomNav() {
  const pathname = usePathname()
  const { user } = useClienteAuth()
  const isMobile = useIsMobile()

  if (!isMobile) return <SacolaFlutuante />

  const tabs = [
    {
      label: "Início",
      href: "/",
      active: pathname === "/",
      icon: (active: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#D7261E" : "#77736B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>
        </svg>
      ),
    },
    {
      label: "Busca",
      href: "/busca",
      active: pathname.startsWith("/busca"),
      icon: (active: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#D7261E" : "#77736B"} strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#D7261E" : "#77736B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/>
          <path d="M9 8h6M9 12h6"/>
        </svg>
      ),
    },
    {
      label: "Perfil",
      href: user ? "/cliente/meu-perfil" : "/cliente/entrar",
      active: pathname.startsWith("/cliente/meu-perfil"),
      icon: (active: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#D7261E" : "#77736B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
      ),
    },
  ]

  // Layout novo (19/10/2026): mesmas 4 abas e rotas, visual da proposta.
  // Cores do logo (azul-marinho e vermelho) ficam no chego-novo.css, na classe nav-cliente.
  return (
    <>
    <SacolaFlutuante acimaDoMenu />
    <nav aria-label="Navegação" className="nav-cliente" style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(255,255,255,0.96)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
      borderTop: "1px solid #E6E5E1",
      display: "flex", alignItems: "center",
      padding: "8px 6px calc(env(safe-area-inset-bottom, 0px) + 8px)",
      fontFamily: "var(--font-corpo), system-ui, sans-serif",
    }}>
      {tabs.map(item => (
        <Link key={item.label} href={item.href} aria-current={item.active ? "page" : undefined} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          textDecoration: "none", flex: 1, justifyContent: "center",
          color: item.active ? "#D7261E" : "#77736B",
        }}>
          {item.icon(item.active)}
          <span style={{ fontSize: 11.5, fontWeight: 600 }}>
            {item.label}
          </span>
        </Link>
      ))}
    </nav>
    </>
  )
}
