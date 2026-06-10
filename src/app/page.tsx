"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useCart } from "@/lib/cart"
import { useClienteAuth } from "@/lib/auth-cliente"
import { useIsMobile } from "@/lib/use-mobile"
import type { Loja, CategoriaLoja } from "@/types"

function LogoClean({ height, style }: { height: number; style?: React.CSSProperties }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    const img = new Image()
    img.src = "/logo-original.jpg"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const px = imageData.data
      for (let i = 0; i < px.length; i += 4) {
        if ((px[i] + px[i + 1] + px[i + 2]) / 3 < 20) px[i + 3] = 0
      }
      ctx.putImageData(imageData, 0, 0)
      setSrc(canvas.toDataURL("image/png"))
    }
  }, [])
  if (!src) return <div style={{ height, width: height * 2.2, flexShrink: 0 }} />
  return <img src={src} alt="Chegô" style={{ height, width: "auto", objectFit: "contain", display: "block", ...style }} />
}

const CAT_ICONS: Record<string, string> = {
  Restaurante: "🍔", Mercadinho: "🛒", "Farmácia": "💊", Outros: "📦",
}
const CAT_IMG: Record<string, string> = {
  Restaurante: "https://cdn-icons-png.flaticon.com/512/3075/3075977.png",
  Mercadinho:  "https://cdn-icons-png.flaticon.com/512/3081/3081559.png",
  "Farmácia":  "https://cdn-icons-png.flaticon.com/512/2913/2913133.png",
  Outros:      "https://cdn-icons-png.flaticon.com/512/869/869869.png",
}
const CAT_DISPLAY: Record<string, string> = {
  Restaurante: "Restaurante",
  Mercadinho:  "Mercados",
  "Farmácia":  "Farmácia",
  Outros:      "Outros",
}
const CAT_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  Restaurante: { bg: "#fff4ee", text: "#c2410c", accent: "#FF6B00" },
  Mercadinho:  { bg: "#f0fdf4", text: "#15803d", accent: "#22c55e" },
  "Farmácia":  { bg: "#eff6ff", text: "#1d4ed8", accent: "#3b82f6" },
  Outros:      { bg: "#f5f3ff", text: "#6d28d9", accent: "#8b5cf6" },
}
const CATEGORIAS: CategoriaLoja[] = ["Restaurante", "Mercadinho", "Farmácia", "Outros"]

function playSound() {
  try {
    const audio = new Audio("/splash.mp3")
    audio.volume = 0.85
    audio.play().catch(() => {})
  } catch {}
}

export default function Home() {
  const router   = useRouter()
  const storeRef = useRef<HTMLDivElement>(null)
  const { count, total } = useCart()
  const { user, perfil, logout } = useClienteAuth()

  const [lojas,      setLojas]      = useState<Loja[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filtro,     setFiltro]     = useState<string | null>(null)
  const [busca,      setBusca]      = useState("")
  const [splashVis,  setSplashVis]  = useState(true)
  const [splashFade, setSplashFade] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  // step: 0=nenhum 1=hamburguer 2=carrinho 3=farmácia 4=logo
  const [step, setStep] = useState(0)

  const isMobile    = useIsMobile()
  const primeiroNome = perfil?.nome?.split(" ")[0] ?? user?.user_metadata?.name?.split(" ")[0] ?? null

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("arago_onboarded")) {
      router.replace("/onboarding"); return
    }
    // sequência: cada ícone entra e sai antes do próximo
    const t1  = setTimeout(() => setStep(1),                          150)   // hamburguer entra
    const t2  = setTimeout(() => setStep(0),                          950)   // hamburguer sai
    const t3  = setTimeout(() => setStep(2),                         1200)   // carrinho entra
    const t4  = setTimeout(() => setStep(0),                         2000)   // carrinho sai
    const t5  = setTimeout(() => setStep(3),                         2250)   // farmácia entra
    const t6  = setTimeout(() => setStep(0),                         3050)   // farmácia sai
    const t7  = setTimeout(() => { setStep(4); playSound() },        3300)   // logo entra + som
    const t8  = setTimeout(() => setSplashFade(true),                4800)   // fade começa
    const t9  = setTimeout(() => setSplashVis(false),                5400)   // desmonta
    supabase.from("lojas").select("*").eq("status", "ativo")
      .order("aberto", { ascending: false }).order("nome")
      .then(({ data }) => { setLojas((data as Loja[]) ?? []); setLoading(false) })
    return () => [t1,t2,t3,t4,t5,t6,t7,t8,t9].forEach(clearTimeout)
  }, [])

  function scrollToLojas() {
    storeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
  function selectCat(cat: string | null) {
    setFiltro(f => f === cat ? null : cat)
    setTimeout(scrollToLojas, 80)
  }

  const filtradas = lojas.filter(l => {
    const matchCat   = !filtro || l.categoria === filtro
    const matchBusca = l.nome.toLowerCase().includes(busca.toLowerCase())
    return matchCat && matchBusca
  })
  const abertas  = filtradas.filter(l => l.aberto)
  const fechadas = filtradas.filter(l => !l.aberto)

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB" }}>

      {/* ── SPLASH ─────────────────────────────────────────── */}
      {splashVis && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999, background: "#0a0a0a",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          opacity: splashFade ? 0 : 1, transition: "opacity 0.6s ease",
          pointerEvents: splashFade ? "none" : "all",
        }}>
          {/* Partículas de fundo */}
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{
                position: "absolute", width: 5, height: 5, borderRadius: "50%",
                background: i % 3 === 0 ? "#FF6B00" : i % 3 === 1 ? "rgba(255,107,0,0.35)" : "rgba(255,255,255,0.06)",
                left: `${(i * 8.3 + 5) % 100}%`, top: `${(i * 13 + 10) % 100}%`,
                animation: `splashFloat ${3 + (i % 3)}s ease-in-out ${i * 0.3}s infinite alternate`,
                opacity: step > 0 ? 1 : 0, transition: "opacity 0.5s",
              }} />
            ))}
          </div>

          {/* Anel de glow que pulsa enquanto os ícones aparecem */}
          <div style={{
            position: "absolute",
            width: 280, height: 280, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,107,0,0.12) 0%, transparent 70%)",
            opacity: step > 0 && step < 4 ? 1 : 0,
            transform: step > 0 && step < 4 ? "scale(1)" : "scale(0.6)",
            transition: "opacity 0.4s, transform 0.4s",
          }} />

          {/* Container dos ícones — todos empilhados, só o ativo visível */}
          <div style={{ position: "relative", width: 200, height: 200, perspective: "600px" }}>

            {/* 1 — Hamburguer */}
            <img
              src="https://cdn-icons-png.flaticon.com/512/3075/3075977.png"
              alt="Restaurantes"
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
                opacity: step === 1 ? 1 : 0,
                transform: step === 1 ? "scale(1) translateY(0px)" : step < 1 ? "scale(0.6) translateY(32px)" : "scale(0.6) translateY(-32px)",
                transition: "opacity 0.4s ease, transform 0.4s ease",
                filter: "drop-shadow(0 0 32px rgba(249,115,22,0.6))",
              }}
            />

            {/* 2 — Carrinho */}
            <img
              src="https://cdn-icons-png.flaticon.com/512/3081/3081559.png"
              alt="Mercados"
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
                opacity: step === 2 ? 1 : 0,
                transform: step === 2 ? "scale(1) translateY(0px)" : step < 2 ? "scale(0.6) translateY(32px)" : "scale(0.6) translateY(-32px)",
                transition: "opacity 0.4s ease, transform 0.4s ease",
                filter: "drop-shadow(0 0 32px rgba(34,197,94,0.6))",
              }}
            />

            {/* 3 — Farmácia */}
            <img
              src="https://cdn-icons-png.flaticon.com/512/2913/2913133.png"
              alt="Farmácias"
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
                opacity: step === 3 ? 1 : 0,
                transform: step === 3 ? "scale(1) translateY(0px)" : step < 3 ? "scale(0.6) translateY(32px)" : "scale(0.6) translateY(-32px)",
                transition: "opacity 0.4s ease, transform 0.4s ease",
                filter: "drop-shadow(0 0 32px rgba(59,130,246,0.6))",
              }}
            />

            {/* 4 — Logo Chegô (3D flip) */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              transform: step === 4 ? "rotateY(0deg) scale(1)" : "rotateY(-90deg) scale(0.5)",
              opacity: step === 4 ? 1 : 0,
              transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease",
              transformStyle: "preserve-3d",
              filter: step === 4 ? "drop-shadow(0 0 32px rgba(29,78,216,0.5))" : "none",
            }}>
              <img src="/logo-chego.png" alt="Chegô" style={{ width: 180, height: 180, objectFit: "contain" }} />
            </div>
          </div>

          {/* Label que muda a cada step */}
          <p style={{
            marginTop: 32,
            fontSize: step === 4 ? 15 : 13,
            fontWeight: 700,
            letterSpacing: step === 4 ? 1 : 3,
            textTransform: step === 4 ? "none" : "uppercase",
            textAlign: "center",
            maxWidth: 280,
            opacity: step > 0 ? 1 : 0,
            transform: step > 0 ? "translateY(0px)" : "translateY(12px)",
            transition: "opacity 0.35s ease, transform 0.35s ease, font-size 0.3s ease",
            color: step === 1 ? "#f97316"
                 : step === 2 ? "#22c55e"
                 : step === 3 ? "#60a5fa"
                 : step === 4 ? "rgba(255,255,255,0.75)"
                 : "transparent",
          }}>
            {step === 1 ? "Restaurantes"
           : step === 2 ? "Mercados"
           : step === 3 ? "Farmácias"
           : step === 4 ? "O primeiro aplicativo delivery de Aragoiânia"
           : ""}
          </p>

          <style>{`
            @keyframes splashFloat {
              from { transform: translateY(0px) rotate(0deg); }
              to   { transform: translateY(-18px) rotate(180deg); }
            }
          `}</style>
        </div>
      )}

      {/* ── NAVBAR ─────────────────────────────────────────── */}
      <nav style={{
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "none",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", padding: isMobile ? "0 16px" : "0 24px",
          height: isMobile ? 72 : 80, display: "flex", alignItems: "center", gap: 8,
        }}>
          <Link href="/" style={{ textDecoration: "none", flexShrink: 0, marginRight: isMobile ? 8 : 20, display: "flex", alignItems: "center" }}>
            <LogoClean height={isMobile ? 62 : 80} />
          </Link>

          {/* Nav links — hidden on mobile */}
          {!isMobile && (
            <div style={{ display: "flex", gap: 4, flex: 1 }}>
              {[
                { label: "Restaurantes", cat: "Restaurante" },
                { label: "Mercados",     cat: "Mercadinho"  },
                { label: "Farmácias",    cat: "Farmácia"    },
              ].map(({ label, cat }) => (
                <button key={cat} onClick={() => selectCat(cat)}
                  style={{
                    background: filtro === cat ? "#FFF3E0" : "transparent",
                    border: filtro === cat ? "1px solid rgba(255,107,0,0.25)" : "1px solid transparent",
                    borderRadius: 10, padding: "8px 16px", cursor: "pointer",
                    color: filtro === cat ? "#FF6B00" : "#374151",
                    fontWeight: 500, fontSize: 15,
                  }}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {isMobile && <div style={{ flex: 1 }} />}

          {/* Right */}
          <div style={{ display: "flex", gap: isMobile ? 8 : 10, alignItems: "center", flexShrink: 0 }}>
            {count > 0 && !!user && (
              <Link href="/carrinho" style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: isMobile ? "8px 12px" : "8px 16px", borderRadius: 12,
                background: "#DC2626", color: "white", fontWeight: 700, fontSize: 13, textDecoration: "none",
                boxShadow: "0 4px 12px rgba(220,38,38,0.3)",
              }}>
                🛒 {count}{!isMobile && ` · R$ ${total.toFixed(2)}`}
              </Link>
            )}
            {!user && !isMobile && (
              <Link href="/cadastro-loja" style={{
                padding: "8px 16px", borderRadius: 12,
                color: "#DC2626", fontWeight: 600, fontSize: 14, textDecoration: "none",
              }}>
                Anuncie sua loja
              </Link>
            )}

            {/* Usuário logado — botão + dropdown */}
            {user ? (
              <div style={{ position: "relative" }}
                onMouseEnter={() => setMenuAberto(true)}
                onMouseLeave={() => setMenuAberto(false)}>

                <button onClick={() => setMenuAberto(v => !v)} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 14px", borderRadius: 12, cursor: "pointer",
                  background: "#FFF3E0", border: "1px solid rgba(220,38,38,0.15)",
                  color: "#DC2626", fontWeight: 600, fontSize: 13,
                }}>
                  {user.user_metadata?.avatar_url
                    ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    : <span style={{ fontSize: 18, lineHeight: 1 }}>👤</span>}
                  {!isMobile && <span>Minha conta</span>}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points={menuAberto ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
                  </svg>
                </button>

                {/* Dropdown */}
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  background: "white", borderRadius: 16,
                  boxShadow: "0 12px 40px rgba(0,0,0,0.14)",
                  border: "1px solid #f0f0f0",
                  minWidth: 230, overflow: "hidden", zIndex: 200,
                  opacity: menuAberto ? 1 : 0,
                  transform: menuAberto ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.97)",
                  pointerEvents: menuAberto ? "all" : "none",
                  transition: "opacity 0.18s ease, transform 0.18s ease",
                }}>
                  {/* Cabeçalho com avatar */}
                  <div style={{ padding: "14px 16px", background: "#FFF8F5", borderBottom: "1px solid #f5ebe8", display: "flex", gap: 12, alignItems: "center" }}>
                    {user.user_metadata?.avatar_url
                      ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                      : <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#FFF0EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>👤</div>}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {primeiroNome ?? "Meu perfil"}
                      </p>
                      <p style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</p>
                    </div>
                  </div>

                  {/* Itens do menu */}
                  {[
                    { icon: "✏️", label: "Alterar dados",          href: "/cliente/perfil" },
                    { icon: "🖼️", label: "Ver meu perfil",          href: "/cliente/perfil" },
                    { icon: "⚙️", label: "Configurações",           href: "/cliente/perfil" },
                    { icon: "📦", label: "Histórico de pedidos",    href: "/cliente/perfil" },
                    { icon: "🎁", label: "Convide e ganhe",         href: "/parceiros" },
                    { icon: "🔔", label: "Notificações",            href: "/cliente/perfil" },
                  ].map(({ icon, label, href }) => (
                    <Link key={label} href={href}
                      onClick={() => setMenuAberto(false)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", textDecoration: "none", color: "#374151", fontSize: 14, fontWeight: 500, borderBottom: "1px solid #fafafa" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#FFF8F5"; (e.currentTarget as HTMLAnchorElement).style.color = "#DC2626" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = ""; (e.currentTarget as HTMLAnchorElement).style.color = "#374151" }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                      {label}
                    </Link>
                  ))}

                  <button
                    onClick={async () => { setMenuAberto(false); await logout(); router.push("/") }}
                    style={{ width: "100%", padding: "12px 16px", border: "none", background: "none", textAlign: "left", color: "#ef4444", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#fff5f5" }}
                    onMouseLeave={e => { e.currentTarget.style.background = "" }}>
                    <span style={{ fontSize: 16 }}>🚪</span> Sair da conta
                  </button>
                </div>
              </div>
            ) : (
              <Link href="/cliente/entrar" style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: isMobile ? "8px 14px" : "8px 18px", borderRadius: 12,
                background: "#DC2626", border: "none",
                color: "white", fontWeight: 600, fontSize: 13, textDecoration: "none",
                boxShadow: "0 4px 12px rgba(220,38,38,0.35)",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#B91C1C"; (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#DC2626"; (e.currentTarget as HTMLAnchorElement).style.transform = "" }}>
                Entrar
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #B91C1C 0%, #DC2626 40%, #EF4444 75%, #F87171 100%)",
        minHeight: isMobile ? 300 : 420,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
        padding: isMobile ? "40px 16px" : "56px 24px",
      }}>
        {/* Círculos decorativos de fundo */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "50%", right: "8%", transform: "translateY(-50%)", width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 640, width: "100%", textAlign: "center", position: "relative", zIndex: 1 }}>
          <h1 style={{
            color: "white", fontWeight: 800,
            fontSize: "clamp(2rem, 4vw, 3rem)",
            lineHeight: 1.15, marginBottom: 14,
            textShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}>
            {primeiroNome ? `Olá, ${primeiroNome}! 👋` : "Chegô. O delivery de Aragoiânia."}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.9)", fontSize: "1.1rem", lineHeight: 1.6, marginBottom: 36, fontWeight: 400 }}>
            Peça da sua loja favorita e receba em casa rapidinho.
          </p>

          {/* Search bar */}
          <div style={{
            maxWidth: 680, width: "90%", margin: "0 auto",
            borderRadius: 16, overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            display: "flex",
          }}>
            <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", background: "white" }}>
              <span style={{ padding: "0 16px", fontSize: 18, color: "#FF6B00", flexShrink: 0, lineHeight: 1 }}>📍</span>
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") scrollToLojas() }}
                placeholder="Buscar restaurante ou produto..."
                style={{
                  flex: 1, height: 60, fontSize: 16, fontWeight: 500,
                  background: "transparent", border: "none", color: "#1a1a1a", outline: "none",
                  padding: "0 20px 0 0",
                }}
              />
            </div>
            <button onClick={scrollToLojas} style={{
              height: 60, padding: "0 28px", border: "none",
              background: "#991B1B", color: "white",
              fontWeight: 700, fontSize: 16, cursor: "pointer", flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#7F1D1D" }}
            onMouseLeave={e => { e.currentTarget.style.background = "#991B1B" }}>
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN ───────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "28px 16px 80px" : "48px 24px 80px" }}>

        {/* Category chips */}
        {!busca && (
          <div style={{ marginBottom: 40 }}>
            <div className="cat-chips-wrap" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {CATEGORIAS.map(cat => {
                const c     = CAT_COLORS[cat]
                const ativo = filtro === cat
                return (
                  <button key={cat} onClick={() => selectCat(cat)} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 22px", borderRadius: 50,
                    border: ativo ? `1.5px solid ${c.accent}` : "1.5px solid #e5e7eb",
                    background: ativo ? c.accent : "white",
                    color: ativo ? "white" : "#374151",
                    fontWeight: 600, fontSize: 14, cursor: "pointer",
                    boxShadow: ativo ? `0 6px 16px ${c.accent}44` : "0 4px 12px rgba(0,0,0,0.08)",
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    if (!ativo) {
                      e.currentTarget.style.transform = "translateY(-3px)"
                      e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)"
                      e.currentTarget.style.borderColor = "#FF6B00"
                    }
                  }}
                  onMouseLeave={e => {
                    if (!ativo) {
                      e.currentTarget.style.transform = ""
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"
                      e.currentTarget.style.borderColor = "#e5e7eb"
                    }
                  }}>
                    <img src={CAT_IMG[cat]} alt={cat} style={{ width: 24, height: 24, objectFit: "contain", filter: ativo ? "brightness(0) invert(1)" : "none" }} />
                    {CAT_DISPLAY[cat] ?? cat}
                  </button>
                )
              })}
              {filtro && (
                <button onClick={() => setFiltro(null)} style={{
                  padding: "12px 18px", borderRadius: 50, border: "1.5px dashed #d1d5db",
                  background: "transparent", color: "#9ca3af", fontWeight: 600, fontSize: 14, cursor: "pointer",
                  flexShrink: 0,
                }}>
                  ✕ Limpar
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2 CARDS GRANDES */}
        {!busca && !filtro && (
          <div style={{ marginBottom: 52 }}>
            {/* Título de seção */}
            <div style={{ marginBottom: 22 }}>
              <h2 style={{
                color: "#1a1a1a", fontWeight: 800, fontSize: "1.6rem",
                letterSpacing: "-0.5px",
                borderLeft: "4px solid #FF6B00", paddingLeft: 12,
                lineHeight: 1.2,
              }}>
                O que você quer pedir?
              </h2>
              <p style={{ fontSize: 14, color: "#6B7280", marginTop: 6, paddingLeft: 16 }}>Escolha onde quer pedir</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>

              {/* Restaurante */}
              <button onClick={() => selectCat("Restaurante")} style={{
                position: "relative", borderRadius: 20, overflow: "hidden",
                height: isMobile ? 160 : 200, cursor: "pointer", border: "none", textAlign: "left",
                boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                background: "linear-gradient(135deg, #FF6B00 0%, #E55A00 100%)",
                padding: 0, display: "block", width: "100%",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(255,107,0,0.35)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.15)" }}>
                {/* Foto lateral direita (desktop) — com overlay para não cobrir texto */}
                {!isMobile && (
                  <>
                    <div style={{
                      position: "absolute", right: 0, top: 0, bottom: 0, width: "45%",
                      backgroundImage: "url(https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=85)",
                      backgroundSize: "cover", backgroundPosition: "center",
                    }} />
                    <div style={{
                      position: "absolute", right: 0, top: 0, bottom: 0, width: "60%",
                      background: "linear-gradient(to right, #E55A00 0%, #FF6B0000 100%)",
                    }} />
                  </>
                )}
                {/* Content */}
                <div style={{ position: "relative", zIndex: 1, padding: isMobile ? "28px 24px" : "30px 32px", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", width: isMobile ? "100%" : "65%" }}>
                  <div>
                    <p style={{ color: "white", fontWeight: 900, fontSize: 26, lineHeight: 1, marginBottom: 8 }}>Restaurantes</p>
                    <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>Comida pronta na sua porta</p>
                  </div>
                  <span style={{
                    display: "inline-flex", width: "fit-content",
                    padding: "10px 20px", borderRadius: 12,
                    background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)",
                    color: "white", fontWeight: 700, fontSize: 14,
                  }}>
                    Ver opções ›
                  </span>
                </div>
              </button>

              {/* Mercados */}
              <button onClick={() => selectCat("Mercadinho")} style={{
                position: "relative", borderRadius: 20, overflow: "hidden",
                height: isMobile ? 160 : 200, cursor: "pointer", border: "none", textAlign: "left",
                boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                padding: 0, display: "block", width: "100%",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(34,197,94,0.35)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.15)" }}>
                {!isMobile && (
                  <>
                    <div style={{
                      position: "absolute", right: 0, top: 0, bottom: 0, width: "45%",
                      backgroundImage: "url(https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=85)",
                      backgroundSize: "cover", backgroundPosition: "center",
                    }} />
                    <div style={{
                      position: "absolute", right: 0, top: 0, bottom: 0, width: "60%",
                      background: "linear-gradient(to right, #15803d 0%, #15803d00 100%)",
                    }} />
                  </>
                )}
                <div style={{ position: "relative", zIndex: 1, padding: isMobile ? "28px 24px" : "30px 32px", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", width: isMobile ? "100%" : "65%" }}>
                  <div>
                    <p style={{ color: "white", fontWeight: 900, fontSize: 26, lineHeight: 1, marginBottom: 8 }}>Mercados</p>
                    <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>Produtos do dia a dia sem sair</p>
                  </div>
                  <span style={{
                    display: "inline-flex", width: "fit-content",
                    padding: "10px 20px", borderRadius: 12,
                    background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)",
                    color: "white", fontWeight: 700, fontSize: 14,
                  }}>
                    Ver lojas ›
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Search mode filter chips */}
        {busca && (
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            {["Todas", ...CATEGORIAS].map(c => (
              <button key={c} onClick={() => setFiltro(c === "Todas" ? null : c)} style={{
                padding: "8px 16px", borderRadius: 50, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: (filtro === c || (c === "Todas" && !filtro)) ? "#FF6B00" : "white",
                color:      (filtro === c || (c === "Todas" && !filtro)) ? "white" : "#6B7280",
                border: "1px solid #e5e7eb",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}>
                {c === "Todas" ? "🏪 Todas" : `${CAT_ICONS[c]} ${c}`}
              </button>
            ))}
          </div>
        )}

        {/* ── LOJAS ──────────────────────────────────────────── */}
        <div ref={storeRef}>
          {(filtro || busca) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "#1a1a1a", fontWeight: 800, fontSize: 20 }}>
                {busca ? `Resultados para "${busca}"` : `${CAT_ICONS[filtro!]} ${filtro}`}
              </h2>
              {filtro && (
                <button onClick={() => setFiltro(null)} style={{
                  background: "none", border: "none", color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600,
                }}>
                  Limpar ✕
                </button>
              )}
            </div>
          )}

          {!filtro && !busca && (
            <div style={{ marginBottom: 20 }}>
              <h2 style={{
                color: "#1a1a1a", fontWeight: 900, fontSize: 22,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22C55E", display: "inline-block", boxShadow: "0 0 0 3px rgba(34,197,94,0.2)" }} />
                Lojas abertas agora
              </h2>
            </div>
          )}

          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ background: "white", borderRadius: 16, height: 240, boxShadow: "var(--shadow-sm)" }} />
              ))}
            </div>
          ) : filtradas.length === 0 ? (
            <div style={{ textAlign: "center", marginTop: 64, background: "white", borderRadius: 20, padding: "48px 24px", boxShadow: "var(--shadow-sm)" }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>🔍</p>
              <p style={{ color: "#1a1a1a", fontWeight: 700, fontSize: 16 }}>Nenhuma loja encontrada</p>
              <p style={{ color: "#9ca3af", fontSize: 14, marginTop: 4 }}>Tente outro nome ou categoria</p>
            </div>
          ) : (
            <>
              {abertas.length > 0 && (
                <div style={{ marginBottom: 40 }}>
                  {(filtro || busca) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
                      <p style={{ color: "#9ca3af", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Abertas · {abertas.length} loja{abertas.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                    {abertas.map(loja => <LojaCard key={loja.id} loja={loja} />)}
                  </div>
                </div>
              )}
              {fechadas.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d1d5db" }} />
                    <p style={{ color: "#d1d5db", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Fechadas · {fechadas.length} loja{fechadas.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                    {fechadas.map(loja => <LojaCard key={loja.id} loja={loja} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer style={{ background: "#1C1C1E", color: "rgba(255,255,255,0.85)", padding: "56px 24px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Logo + tagline */}
          <div style={{ marginBottom: 40 }}>
            <img src="/logo-chego.png" alt="Chegô" style={{ height: 60, objectFit: "contain", marginBottom: 12 }} />
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>O delivery de Aragoiânia, GO</p>
          </div>

          {/* Colunas */}
          <div className="footer-cols" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 40, marginBottom: 40 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>Parceiros</p>
              {[
                { label: "Cadastrar minha loja", href: "/cadastro-loja" },
                { label: "Portal de parceiros",  href: "/parceiros" },
                { label: "Acesso lojista",        href: "/entrar" },
              ].map(({ label, href }) => (
                <Link key={href} href={href} style={{ display: "block", color: "rgba(255,255,255,0.75)", fontSize: 14, textDecoration: "none", marginBottom: 10, fontWeight: 400 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#FF6B00" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.75)" }}>
                  {label}
                </Link>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>Entregadores</p>
              {[
                { label: "Quero ser motoboy", href: "/cadastro-motoboy" },
              ].map(({ label, href }) => (
                <Link key={href} href={href} style={{ display: "block", color: "rgba(255,255,255,0.75)", fontSize: 14, textDecoration: "none", marginBottom: 10, fontWeight: 400 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#FF6B00" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.75)" }}>
                  {label}
                </Link>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>Redes sociais</p>
              <a href="https://instagram.com/ChegoAragyn" target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(193,53,132,0.18)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(193,53,132,0.4)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.1)" }}>
                {/* Instagram logo SVG oficial com gradiente */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
                      <stop offset="0%" stopColor="#fdf497"/>
                      <stop offset="5%" stopColor="#fdf497"/>
                      <stop offset="45%" stopColor="#fd5949"/>
                      <stop offset="60%" stopColor="#d6249f"/>
                      <stop offset="90%" stopColor="#285AEB"/>
                    </radialGradient>
                  </defs>
                  <rect x="2" y="2" width="20" height="20" rx="6" ry="6" fill="url(#ig-grad)"/>
                  <circle cx="12" cy="12" r="4.5" fill="none" stroke="white" strokeWidth="1.8"/>
                  <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
                </svg>
                <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 500 }}>@ChegoAragyn</span>
              </a>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>Localização</p>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.6 }}>Aragoiânia, Goiás</p>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>© 2026 Chegô Delivery · Todos os direitos reservados</p>
            <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>Feito com ❤️ em Aragoiânia</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ── LOJA CARD ────────────────────────────────────────── */
function LojaCard({ loja }: { loja: Loja }) {
  const c = CAT_COLORS[loja.categoria] ?? CAT_COLORS["Outros"]
  const CAT_ICONS_LOCAL: Record<string, string> = {
    Restaurante: "🍔", Mercadinho: "🛒", "Farmácia": "💊", Outros: "📦",
  }
  return (
    <Link href={`/restaurante/${loja.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "white", borderRadius: 16, overflow: "hidden", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(0,0,0,0.09)",
          transition: "transform 0.18s, box-shadow 0.18s",
          opacity: loja.aberto ? 1 : 0.65,
        }}
        onMouseEnter={e => {
          if (loja.aberto) {
            e.currentTarget.style.transform = "translateY(-5px)"
            e.currentTarget.style.boxShadow = "0 12px 36px rgba(0,0,0,0.15)"
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = ""
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.09)"
        }}>

        {/* Banner */}
        {loja.logo_url ? (
          <div style={{ height: 160, position: "relative", overflow: "hidden" }}>
            <img src={loja.logo_url} alt={loja.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <span style={{
              position: "absolute", top: 10, right: 10, fontSize: 12, fontWeight: 700,
              padding: "4px 12px", borderRadius: 20,
              background: loja.aberto ? "#22C55E" : "rgba(0,0,0,0.5)",
              color: "white",
            }}>
              {loja.aberto ? "● Aberto" : "Fechado"}
            </span>
          </div>
        ) : (
          <div style={{
            height: 160, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 56, position: "relative",
            background: loja.aberto
              ? `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)`
              : `linear-gradient(135deg, #d1d5db, #9ca3af)`,
          }}>
            {CAT_ICONS_LOCAL[loja.categoria]}
            <span style={{
              position: "absolute", top: 10, right: 10, fontSize: 12, fontWeight: 700,
              padding: "4px 12px", borderRadius: 20,
              background: loja.aberto ? "#22C55E" : "rgba(0,0,0,0.3)",
              color: "white",
            }}>
              {loja.aberto ? "● Aberto" : "Fechado"}
            </span>
          </div>
        )}

        <div style={{ padding: "14px 16px 18px" }}>
          <p style={{ color: "#1a1a1a", fontWeight: 700, fontSize: 16, lineHeight: 1.2, marginBottom: 4 }}>{loja.nome}</p>
          {loja.descricao && (
            <p style={{
              color: "#6B7280", fontSize: 13, marginBottom: 10, lineHeight: 1.4,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {loja.descricao}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span style={{ color: "#6B7280", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {loja.tempo_min}–{loja.tempo_max} min
            </span>
            <span style={{ color: "#e5e7eb" }}>·</span>
            <span style={{ color: loja.taxa_entrega === 0 ? "#16a34a" : "#6B7280", fontWeight: loja.taxa_entrega === 0 ? 700 : 400, display: "flex", alignItems: "center", gap: 4 }}>
              {loja.taxa_entrega === 0 ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  Grátis
                </>
              ) : `R$ ${loja.taxa_entrega.toFixed(2)}`}
            </span>
            <span style={{
              marginLeft: "auto", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 8,
              background: c.bg, color: c.text,
            }}>
              {loja.categoria}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
