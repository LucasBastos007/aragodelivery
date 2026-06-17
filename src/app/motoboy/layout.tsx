"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

const NAV = [
  {
    href: "/motoboy",
    label: "Corridas",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        {/* Motorcycle side profile */}
        {/* Rear wheel */}
        <circle cx="6" cy="17" r="3.5"/>
        {/* Front wheel */}
        <circle cx="18" cy="17" r="3.5"/>
        {/* Frame body */}
        <path d="M6 17 L9 10 L14 10 L18 17"/>
        {/* Engine/body block */}
        <path d="M9 10 L11 7 L16 7 L18 10 L14 10"/>
        {/* Handlebar */}
        <path d="M16 7 L20 6"/>
        {/* Seat */}
        <path d="M10 9 Q12 8 14 9"/>
        {/* Exhaust */}
        <path d="M9 14 L6 14"/>
      </svg>
    ),
  },
  {
    href: "/motoboy/dashboard",
    label: "Início",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        {/* Triangular roof */}
        <polyline points="2 11 12 3 22 11"/>
        {/* House body */}
        <rect x="4" y="11" width="16" height="11" rx="1" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0}/>
        <path d="M4 11 L4 22 L20 22 L20 11"/>
        {/* Door arch */}
        <path d="M9 22 L9 17 Q9 15 12 15 Q15 15 15 17 L15 22"/>
        {/* Left window */}
        <rect x="5.5" y="13" width="3" height="2.5" rx="0.5"/>
        {/* Right window */}
        <rect x="15.5" y="13" width="3" height="2.5" rx="0.5"/>
      </svg>
    ),
  },
  {
    href: "/motoboy/historico",
    label: "Histórico",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        {/* Document rectangle */}
        <rect x="4" y="2" width="14" height="18" rx="2"/>
        {/* Text lines of varying widths */}
        <line x1="7" y1="7" x2="15" y2="7"/>
        <line x1="7" y1="11" x2="13" y2="11"/>
        <line x1="7" y1="15" x2="11" y2="15"/>
        {/* Small clock overlay bottom-right */}
        <circle cx="16.5" cy="17.5" r="3.5" fill="#0a0a0a" stroke="currentColor" strokeWidth={active ? 2 : 1.6}/>
        <line x1="16.5" y1="15.8" x2="16.5" y2="17.5" strokeWidth="1.5"/>
        <line x1="16.5" y1="17.5" x2="17.8" y2="18.3" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: "/motoboy/financeiro",
    label: "Ganhos",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        {/* Wallet body */}
        <rect x="2" y="6" width="18" height="14" rx="2"/>
        {/* Wallet flap */}
        <path d="M2 10 L20 10"/>
        {/* Card edges sticking out from top */}
        <rect x="5" y="3" width="10" height="4" rx="1" strokeWidth="1.5" strokeOpacity="0.7"/>
        <rect x="7" y="1.5" width="7" height="2.5" rx="0.8" strokeWidth="1.3" strokeOpacity="0.4"/>
        {/* Coin slot / amount circle */}
        <circle cx="16" cy="17" r="2.5"/>
        {/* $ symbol inside */}
        <line x1="16" y1="15.5" x2="16" y2="18.5" strokeWidth="1.2"/>
      </svg>
    ),
  },
]

export default function MotoboyLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { sessao, authLoading, logout } = useAuth()
  const [perfilOpen,     setPerfilOpen]     = useState(false)
  const [notaMedia,      setNotaMedia]      = useState<number | null>(null)
  const [totalAvals,     setTotalAvals]     = useState(0)
  const [corridasTotal,  setCorridasTotal]  = useState(0)

  useEffect(() => {
    if (!perfilOpen || !sessao || sessao.role !== "motoboy") return
    const id = (sessao as any).motoboy_id as string
    if (!id) return
    supabase.from("motoboys").select("nota_media, total_avaliacoes").eq("id", id).single()
      .then(({ data }) => {
        if (data) { setNotaMedia((data as any).nota_media ?? null); setTotalAvals((data as any).total_avaliacoes ?? 0) }
      })
    supabase.from("pedidos").select("id", { count: "exact" }).eq("motoboy_id", id).eq("status", "entregue")
      .then(({ count }) => setCorridasTotal(count ?? 0))
  }, [perfilOpen, sessao])

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
                <div style={{ flex: 1 }}>
                  <p style={{ color: "white", fontWeight: 900, fontSize: 16 }}>{sessao.motoboy_nome}</p>
                  <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 }}>Motoboy parceiro</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                    {/* Estrelas */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={notaMedia !== null ? "#f59e0b" : "rgba(255,255,255,0.15)"} stroke="none">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      <span style={{ color: notaMedia !== null ? "#f59e0b" : "rgba(255,255,255,0.25)", fontWeight: 800, fontSize: 13 }}>
                        {notaMedia !== null ? notaMedia.toFixed(1) : "—"}
                      </span>
                      {totalAvals > 0 && (
                        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>({totalAvals})</span>
                      )}
                    </div>
                    {/* Separador */}
                    <span style={{ color: "rgba(255,255,255,0.12)", fontSize: 12 }}>·</span>
                    {/* Corridas */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(249,115,22,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/>
                        <path d="M6 17 L9 10 L14 10 L18 17"/><path d="M9 10 L11 7 L16 7 L18 10 L14 10"/>
                      </svg>
                      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700 }}>
                        {corridasTotal} {corridasTotal === 1 ? "entrega" : "entregas"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Opções */}
              {[
                {
                  href: "/motoboy/perfil",
                  label: "Meu perfil",
                  sub: "Foto, dados pessoais e PIX",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {/* Face circle */}
                      <circle cx="12" cy="7" r="4"/>
                      {/* Neck */}
                      <line x1="12" y1="11" x2="12" y2="13" strokeWidth="2.5"/>
                      {/* Shoulders - wider arc */}
                      <path d="M4 21 Q4 16 8 15 Q10 14.5 12 14.5 Q14 14.5 16 15 Q20 16 20 21"/>
                    </svg>
                  ),
                },
                {
                  href: "/motoboy/dashboard",
                  label: "Meus ganhos",
                  sub: "Estatísticas e histórico",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {/* Rising bars chart */}
                      <rect x="3" y="14" width="4" height="7" rx="1"/>
                      <rect x="10" y="9" width="4" height="12" rx="1"/>
                      <rect x="17" y="4" width="4" height="17" rx="1"/>
                      {/* Trend arrow going up-right */}
                      <polyline points="2 13 7 8 13 10 21 3"/>
                      <polyline points="17 3 21 3 21 7"/>
                    </svg>
                  ),
                },
                {
                  href: "/motoboy/historico",
                  label: "Histórico de corridas",
                  sub: "Todas as suas entregas",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {/* Road with dotted center line */}
                      <path d="M4 20 L10 4 L14 4 L20 20 Z"/>
                      {/* Center dashes */}
                      <line x1="12" y1="8" x2="12" y2="10" strokeWidth="1.5"/>
                      <line x1="12" y1="12" x2="12" y2="14" strokeWidth="1.5"/>
                      <line x1="12" y1="16" x2="12" y2="18" strokeWidth="1.5"/>
                      {/* Checkered flag at top */}
                      <rect x="10" y="1" width="2" height="2" fill="currentColor" stroke="none"/>
                      <rect x="12" y="2" width="2" height="2" fill="currentColor" stroke="none"/>
                      <rect x="10" y="3" width="2" height="1" fill="currentColor" stroke="none"/>
                    </svg>
                  ),
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
