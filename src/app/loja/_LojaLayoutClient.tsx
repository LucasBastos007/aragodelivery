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
  { href: "/loja/entrega-avulsa", label: "Motoboy", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3"/>
      <path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
      <path d="M3 17l3-5"/>
      <path d="M21 17l-3-5"/>
      <circle cx="3" cy="17" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="21" cy="17" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  )},
  { href: "/loja/fiscal", label: "Fiscal", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="13" y2="17"/>
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

export default function LojaLayoutClient({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const { sessao, authLoading, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [lojaStatus, setLojaStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && (!sessao || sessao.role !== "lojista")) {
      if (path !== "/loja/entrar") router.push("/loja/entrar")
    }
  }, [sessao, authLoading, router, path])

  // Verifica status da loja e validade do cookie de sessão
  useEffect(() => {
    if (sessao?.role !== "lojista" || !(sessao as any).loja_id) return
    fetch(`/api/loja/status-loja`, { credentials: "include" })
      .then(r => {
        if (r.status === 401 || r.status === 403) {
          logout()
          router.push("/loja/entrar")
          return null
        }
        return r.json()
      })
      .then(d => { if (d?.status) setLojaStatus(d.status) })
      .catch(() => {})
  }, [sessao])

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

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9CA3AF" }}>Verificando acesso...</p>
      </div>
    )
  }

  if (!sessao || sessao.role !== "lojista") {
    if (path === "/loja/entrar") return <>{children}</>
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9CA3AF" }}>Verificando acesso...</p>
      </div>
    )
  }

  // Tela de bloqueio por inadimplência
  if (lojaStatus === "suspenso") {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "white", borderRadius: 20, padding: "40px 32px", textAlign: "center", maxWidth: 400, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1.5px solid #FECACA" }}>
          <p style={{ fontSize: 44, marginBottom: 12 }}>🔒</p>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#111827", marginBottom: 8 }}>Acesso suspenso</h2>
          <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, marginBottom: 20 }}>
            Sua mensalidade está em atraso. Regularize o pagamento para retomar o acesso ao sistema.
          </p>
          <div style={{ padding: "14px 16px", background: "#FEF2F2", borderRadius: 12, marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>Como regularizar:</p>
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
              Entre em contato com a equipe Chegô para realizar o pagamento e reativar seu acesso.
            </p>
          </div>
          <a href="https://wa.me/5562993910717" target="_blank" rel="noreferrer" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "13px 20px", borderRadius: 12, background: "#25D366", color: "white",
            fontSize: 14, fontWeight: 800, textDecoration: "none",
            boxShadow: "0 4px 12px rgba(37,211,102,0.3)",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            Falar com a equipe Chegô
          </a>
          <button onClick={() => { logout(); router.push("/loja/entrar") }} style={{
            marginTop: 12, padding: "10px", width: "100%", borderRadius: 10,
            border: "1px solid #E5E7EB", background: "white", color: "#9CA3AF",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            Sair da conta
          </button>
        </div>
      </div>
    )
  }

  function handleLogout() {
    logout()
    router.push("/loja/entrar")
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
