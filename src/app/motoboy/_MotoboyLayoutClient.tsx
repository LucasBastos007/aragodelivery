"use client"

// Moldura do app do motoboy no layout novo (proposta aprovada em 19/10/2026).
// Mesma checagem de sessão; a barra de baixo fica com Mapa, Ganhos, Pedidos, Histórico e Perfil.
// Painel e Caixa continuam existindo e abrem pelo Perfil. Pedidos (em preparo) entrou na barra em 20/10/2026.
import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth"

const NAV = [
  { href: "/motoboy", label: "Mapa", ativo: (p: string) => p === "/motoboy",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg> },
  { href: "/motoboy/financeiro", label: "Ganhos", ativo: (p: string) => p.startsWith("/motoboy/financeiro") || p.startsWith("/motoboy/dashboard") || p.startsWith("/motoboy/caixa"),
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></svg> },
  { href: "/motoboy/pedidos", label: "Pedidos", ativo: (p: string) => p.startsWith("/motoboy/pedidos"),
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6M9 12h6" /></svg> },
  { href: "/motoboy/escala", label: "Escala", ativo: (p: string) => p.startsWith("/motoboy/escala"),
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg> },
  { href: "/motoboy/historico", label: "Histórico", ativo: (p: string) => p.startsWith("/motoboy/historico"),
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg> },
  { href: "/motoboy/perfil", label: "Perfil", ativo: (p: string) => p.startsWith("/motoboy/perfil"),
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg> },
]

export default function MotoboyLayoutClient({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { sessao, authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && (!sessao || sessao.role !== "motoboy")) {
      router.push("/entrar/motoboy")
    }
  }, [sessao, authLoading, router])

  if (authLoading || !sessao || sessao.role !== "motoboy") {
    return (
      <div className="mbn" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p className="mut">Verificando acesso…</p>
      </div>
    )
  }

  return (
    <div className="mbn mbn-casca">
      {children}
      <nav className="mbn-nav" aria-label="Navegação do entregador">
        {NAV.map(item => {
          const ativo = item.ativo(pathname)
          return (
            <Link key={item.href} href={item.href} aria-current={ativo ? "page" : undefined} className={ativo ? "on" : ""}>
              {item.icon}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
