"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/lib/auth"

const NAV = [
  {
    href: "/motoboy",
    label: "Corridas",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    ),
  },
  {
    href: "/motoboy/dashboard",
    label: "Início",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        {active ? (
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        ) : (
          <>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </>
        )}
      </svg>
    ),
  },
  {
    href: "/motoboy/historico",
    label: "Histórico",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    href: "/motoboy/financeiro",
    label: "Ganhos",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <line x1="2" y1="10" x2="22" y2="10"/>
        <circle cx="12" cy="15" r="2" fill={active ? "currentColor" : "none"}/>
      </svg>
    ),
  },
]

export default function MotoboyLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { sessao, authLoading, logout } = useAuth()
  const [perfilOpen, setPerfilOpen] = useState(false)

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
    <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>
      {/* Top nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "#0d0d0d", borderBottom: "1px solid #1a1a1a",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 20px", height: 52,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Image src="/logo-chego.png" alt="Chego" width={32} height={32} style={{ borderRadius: 8, objectFit: "cover" }} />
          <div>
            <p style={{ color: "white", fontWeight: 900, fontSize: 14, lineHeight: 1 }}>Chegô</p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 2 }}>{sessao.motoboy_nome}</p>
          </div>
        </div>

        {/* Avatar / menu perfil */}
        <button onClick={() => setPerfilOpen(true)} style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "rgba(249,115,22,0.15)", border: "1.5px solid rgba(249,115,22,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </button>

        {/* Modal perfil */}
        {perfilOpen && (
          <div onClick={() => setPerfilOpen(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200,
            display: "flex", alignItems: "flex-end",
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              width: "100%", background: "#161616", borderRadius: "24px 24px 0 0",
              padding: "20px 20px 40px",
            }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)", margin: "0 auto 24px" }} />

              {/* Cabeçalho */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, padding: "0 4px" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(249,115,22,0.15)", border: "2px solid rgba(249,115,22,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div>
                  <p style={{ color: "white", fontWeight: 900, fontSize: 16 }}>{sessao.motoboy_nome}</p>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 }}>Motoboy parceiro</p>
                </div>
              </div>

              {/* Opções */}
              {[
                {
                  href: "/motoboy/perfil",
                  label: "Meu perfil",
                  sub: "Foto, dados pessoais e PIX",
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
                },
                {
                  href: "/motoboy/dashboard",
                  label: "Meus ganhos",
                  sub: "Estatísticas e histórico",
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
                },
                {
                  href: "/motoboy/historico",
                  label: "Histórico de corridas",
                  sub: "Todas as suas entregas",
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
                },
              ].map(item => (
                <Link key={item.href} href={item.href} onClick={() => setPerfilOpen(false)} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 4px", borderBottom: "1px solid rgba(255,255,255,0.06)",
                  textDecoration: "none",
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>{item.label}</p>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 1 }}>{item.sub}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
              ))}

              <button onClick={() => { logout(); router.push("/entrar") }} style={{
                width: "100%", marginTop: 20, padding: "15px",
                borderRadius: 14, border: "1px solid rgba(239,68,68,0.2)",
                background: "rgba(239,68,68,0.08)", color: "#ef4444",
                fontWeight: 800, fontSize: 15, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sair da conta
              </button>
            </div>
          </div>
        )}
      </nav>

      {children}

      {/* Bottom nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "#111",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        height: 68,
      }}>
        {NAV.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 4, textDecoration: "none",
              transition: "all 0.15s", paddingTop: 6,
            }}>
              <div style={{
                width: 48, height: 34, borderRadius: 18,
                background: active ? "rgba(249,115,22,0.18)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
                boxShadow: active ? "0 0 0 1px rgba(249,115,22,0.2)" : "none",
              }}>
                <span style={{ color: active ? "#f97316" : "rgba(255,255,255,0.3)", transition: "color 0.15s" }}>
                  {item.icon(active)}
                </span>
              </div>
              <span style={{
                fontSize: 9.5, fontWeight: active ? 800 : 400,
                color: active ? "#f97316" : "rgba(255,255,255,0.25)",
                letterSpacing: active ? 0.3 : 0,
                transition: "all 0.15s",
                textTransform: "uppercase",
              }}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
