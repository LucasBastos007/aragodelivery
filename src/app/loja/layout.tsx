"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth"

const NAV: { href: string; icon: React.ReactNode; label: string }[] = [
  { href: "/loja", label: "Pedidos", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
    </svg>
  )},
  { href: "/loja/historico", label: "Histórico", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )},
  { href: "/loja/dashboard", label: "Dashboard", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
  )},
  { href: "/loja/cardapio", label: "Cardápio", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/>
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
    </svg>
  )},
  { href: "/loja/cupons", label: "Cupons", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  )},
  { href: "/loja/financeiro", label: "Financeiro", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )},
  { href: "/loja/perfil", label: "Minha loja", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
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
