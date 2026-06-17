"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth"

const NAV: { href: string; icon: React.ReactNode; label: string }[] = [
  { href: "/loja", label: "Pedidos", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Clipboard board */}
      <rect x="6" y="4" width="12" height="17" rx="2"/>
      {/* Paper clamp at top */}
      <rect x="9" y="2" width="6" height="4" rx="1.5"/>
      {/* Text rows - varying widths for realism */}
      <line x1="9" y1="11" x2="15" y2="11"/>
      <line x1="9" y1="14" x2="14" y2="14"/>
      <line x1="9" y1="17" x2="12" y2="17"/>
    </svg>
  )},
  { href: "/loja/historico", label: "Histórico", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Outer ring */}
      <circle cx="12" cy="12" r="10"/>
      {/* Inner face circle */}
      <circle cx="12" cy="12" r="7" strokeWidth="1" strokeOpacity="0.3"/>
      {/* Hour hand pointing ~10 */}
      <line x1="12" y1="12" x2="8.5" y2="8.5" strokeWidth="2.5"/>
      {/* Minute hand pointing ~12 */}
      <line x1="12" y1="12" x2="12" y2="6" strokeWidth="2"/>
      {/* Center pivot */}
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>
      {/* Hour marks at 12/3/6/9 */}
      <line x1="12" y1="3" x2="12" y2="4.5" strokeWidth="1.5"/>
      <line x1="21" y1="12" x2="19.5" y2="12" strokeWidth="1.5"/>
      <line x1="12" y1="21" x2="12" y2="19.5" strokeWidth="1.5"/>
      <line x1="3" y1="12" x2="4.5" y2="12" strokeWidth="1.5"/>
    </svg>
  )},
  { href: "/loja/dashboard", label: "Dashboard", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Thin frame */}
      <rect x="2" y="2" width="20" height="20" rx="2" strokeWidth="1.5" strokeOpacity="0.4"/>
      {/* 3 vertical bars - short, medium, tall */}
      <rect x="4" y="13" width="4" height="7" rx="1"/>
      <rect x="10" y="8" width="4" height="12" rx="1"/>
      <rect x="16" y="4" width="4" height="16" rx="1"/>
      {/* Baseline */}
      <line x1="2" y1="20" x2="22" y2="20" strokeWidth="1.5"/>
    </svg>
  )},
  { href: "/loja/cardapio", label: "Cardápio", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Fork on left: 4 tines + handle */}
      <line x1="6" y1="2" x2="6" y2="22"/>
      <line x1="4" y1="2" x2="4" y2="7"/>
      <line x1="6" y1="2" x2="6" y2="7"/>
      <line x1="8" y1="2" x2="8" y2="7"/>
      <path d="M4 7 Q6 10 6 12"/>
      <path d="M8 7 Q6 10 6 12"/>
      {/* Spoon on right: round bowl + handle */}
      <ellipse cx="18" cy="5" rx="2.5" ry="3"/>
      <line x1="18" y1="8" x2="18" y2="22"/>
    </svg>
  )},
  { href: "/loja/cupons", label: "Cupons", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Tag outline */}
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V3h9l9.59 9.59a2 2 0 0 1 0 2.82z"/>
      {/* Hole at top-left */}
      <circle cx="7" cy="8" r="1.5"/>
      {/* Inner dashed border suggestion via short lines */}
      <line x1="10" y1="14" x2="10.01" y2="14" strokeWidth="3"/>
      {/* Percent symbol */}
      <line x1="14" y1="10" x2="11" y2="14" strokeWidth="1.5"/>
      <circle cx="13.5" cy="9.5" r="1" strokeWidth="1.5"/>
      <circle cx="11.5" cy="14.5" r="1" strokeWidth="1.5"/>
    </svg>
  )},
  { href: "/loja/financeiro", label: "Financeiro", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Banknote rectangle */}
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      {/* Left decorative oval */}
      <ellipse cx="5" cy="12" rx="2" ry="3" strokeWidth="1.2" strokeOpacity="0.5"/>
      {/* Right decorative oval */}
      <ellipse cx="19" cy="12" rx="2" ry="3" strokeWidth="1.2" strokeOpacity="0.5"/>
      {/* Dollar sign: vertical bar */}
      <line x1="12" y1="8.5" x2="12" y2="15.5" strokeWidth="1.8"/>
      {/* Dollar sign: S curves */}
      <path d="M14.5 9.5 Q14.5 8 12 8 Q9.5 8 9.5 10 Q9.5 12 12 12 Q14.5 12 14.5 14 Q14.5 16 12 16 Q9.5 16 9.5 14.5" strokeWidth="1.8"/>
    </svg>
  )},
  { href: "/loja/perfil", label: "Minha loja", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Roof triangle */}
      <polyline points="2 10 12 2 22 10"/>
      {/* Walls */}
      <rect x="4" y="10" width="16" height="12" rx="1"/>
      {/* Door with arch */}
      <path d="M9 22 L9 16 Q9 14 12 14 Q15 14 15 16 L15 22"/>
      {/* Left window */}
      <rect x="5.5" y="12" width="3" height="3" rx="0.5"/>
      {/* Right window */}
      <rect x="15.5" y="12" width="3" height="3" rx="0.5"/>
      {/* Chimney */}
      <rect x="16" y="3.5" width="2.5" height="4" rx="0.5"/>
    </svg>
  )},
]

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const { sessao, authLoading, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!authLoading && (!sessao || sessao.role !== "lojista")) {
      router.push("/entrar")
    }
  }, [sessao, authLoading, router])

  // Registra push subscription para receber alertas de novos pedidos
  useEffect(() => {
    if (sessao?.role !== "lojista" || typeof window === "undefined") return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    const lojaId = sessao.loja_id

    function urlB64(b64: string) {
      const pad = "=".repeat((4 - (b64.length % 4)) % 4)
      const raw = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/")
      return Uint8Array.from([...window.atob(raw)].map(c => c.charCodeAt(0)))
    }

    async function registerPush() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js")
        await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()
        const sub = existing ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64(vapidKey!),
        })
        await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "subscribe-loja", loja_id: lojaId, subscription: sub.toJSON() }),
        })
      } catch {}
    }

    if (Notification.permission === "granted") {
      registerPush()
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then(p => { if (p === "granted") registerPush() })
    }
  }, [sessao?.role, (sessao as any)?.loja_id])

  // Toca beep quando SW encaminha push de novo pedido (app em segundo plano)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const handler = (ev: MessageEvent) => {
      if (ev.data?.type === "push-received" && String(ev.data?.tag ?? "").startsWith("pedido-loja-")) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          const play = (freq: number, t: number, d: number) => {
            const o = ctx.createOscillator(); const g = ctx.createGain()
            o.connect(g); g.connect(ctx.destination); o.frequency.value = freq
            g.gain.setValueAtTime(0.4, ctx.currentTime + t)
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + d)
            o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + d)
          }
          play(880, 0, 0.15); play(1100, 0.18, 0.15); play(880, 0.36, 0.2)
        } catch {}
      }
    }
    navigator.serviceWorker.addEventListener("message", handler)
    return () => navigator.serviceWorker.removeEventListener("message", handler)
  }, [])

  if (authLoading || !sessao || sessao.role !== "lojista") {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9CA3AF" }}>Verificando acesso...</p>
      </div>
    )
  }

  function handleLogout() {
    logout()
    router.push("/entrar")
  }

  const isActive = (href: string) => href === "/loja" ? path === "/loja" : path.startsWith(href)

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#f8fafc" }}>

      {/* ── Sidebar desktop (≥768px) ── */}
      <aside style={{
        width: 210, background: "#ffffff", borderRight: "1px solid #e5e7eb",
        flexShrink: 0, display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh",
      }} className="hidden-mobile">
        <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
          <Image src="/logo-chego.png" alt="Chegô" width={32} height={32} style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ color: "#f97316", fontWeight: 900, fontSize: 14 }}>Chegô</p>
            <p style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
              {sessao.loja_nome}
            </p>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4, padding: 12, flex: 1 }}>
          {NAV.map(n => {
            const active = isActive(n.href)
            return (
              <Link key={n.href} href={n.href} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 12, fontSize: 13, fontWeight: 600,
                textDecoration: "none", transition: "all 0.15s",
                background: active ? "rgba(249,115,22,0.08)" : "transparent",
                color: active ? "#f97316" : "#6B7280",
                border: active ? "1px solid rgba(249,115,22,0.2)" : "1px solid transparent",
              }}>
                <span style={{ flexShrink: 0 }}>{n.icon}</span>
                {n.label}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: "14px 16px", borderTop: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 8 }}>
          <Link href="/" style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>← Voltar ao site</Link>
          <button onClick={handleLogout} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 600, textAlign: "left" }}>
            Sair da conta
          </button>
        </div>
      </aside>

      {/* ── Conteúdo principal ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "auto" }}>

        {/* Top bar mobile */}
        <header style={{
          display: "none", background: "#ffffff", borderBottom: "1px solid #e5e7eb",
          padding: "10px 16px", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, zIndex: 40,
        }} className="show-mobile-flex">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image src="/logo-chego.png" alt="Chegô" width={28} height={28} style={{ borderRadius: 6, objectFit: "cover" }} />
            <div>
              <p style={{ color: "#f97316", fontWeight: 900, fontSize: 13 }}>Chegô</p>
              <p style={{ color: "#9CA3AF", fontSize: 10, marginTop: 1 }}>{sessao.loja_nome}</p>
            </div>
          </div>
          <button onClick={() => setMenuOpen(o => !o)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
            </svg>
          </button>
        </header>

        {/* Drawer mobile */}
        {menuOpen && (
          <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.4)" }} className="show-mobile-block">
            <div onClick={e => e.stopPropagation()} style={{
              position: "absolute", top: 0, right: 0, bottom: 0, width: 240,
              background: "#ffffff", display: "flex", flexDirection: "column",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
            }}>
              <div style={{ padding: "20px 16px 14px", borderBottom: "1px solid #e5e7eb" }}>
                <p style={{ color: "#111827", fontWeight: 900, fontSize: 15 }}>{sessao.loja_nome}</p>
                <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>Painel do lojista</p>
              </div>
              <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
                {NAV.map(n => {
                  const active = isActive(n.href)
                  return (
                    <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", borderRadius: 12, fontSize: 14, fontWeight: 600,
                      textDecoration: "none", transition: "all 0.15s",
                      background: active ? "rgba(249,115,22,0.08)" : "transparent",
                      color: active ? "#f97316" : "#374151",
                    }}>
                      <span style={{ color: active ? "#f97316" : "#9CA3AF" }}>{n.icon}</span>
                      {n.label}
                    </Link>
                  )
                })}
              </nav>
              <div style={{ padding: "14px 16px", borderTop: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 10 }}>
                <Link href="/" style={{ color: "#9CA3AF", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>← Voltar ao site</Link>
                <button onClick={handleLogout} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0, fontSize: 13, fontWeight: 700, textAlign: "left" }}>
                  Sair da conta
                </button>
              </div>
            </div>
          </div>
        )}

        <main style={{ flex: 1, overflowX: "hidden" }}>
          {children}
        </main>
      </div>

      {/* ── Bottom nav mobile (≤767px) ── */}
      <nav style={{
        display: "none", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
        background: "#ffffff", borderTop: "1px solid #e5e7eb",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }} className="show-mobile-flex">
        {NAV.slice(0, 5).map(n => {
          const active = isActive(n.href)
          return (
            <Link key={n.href} href={n.href} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 3, textDecoration: "none",
              padding: "8px 2px", minHeight: 56,
            }}>
              <span style={{ color: active ? "#f97316" : "#9CA3AF", transition: "color 0.15s" }}>{n.icon}</span>
              <span style={{ fontSize: 9, fontWeight: active ? 800 : 500, color: active ? "#f97316" : "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.2 }}>
                {n.label}
              </span>
            </Link>
          )
        })}
      </nav>

      <style>{`
        @media (max-width: 767px) {
          .hidden-mobile { display: none !important; }
          .show-mobile-flex { display: flex !important; }
          .show-mobile-block { display: block !important; }
          main { padding-bottom: 64px; }
        }
        @media (min-width: 768px) {
          .show-mobile-flex { display: none !important; }
          .show-mobile-block { display: none !important; }
        }
      `}</style>
    </div>
  )
}
