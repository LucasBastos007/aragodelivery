"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useCart } from "@/lib/cart"
import { useClienteAuth } from "@/lib/auth-cliente"
import { useIsMobile } from "@/lib/use-mobile"
import type { Loja, CategoriaLoja } from "@/types"
import { LogoClean } from "@/components/LogoClean"
import { MobileBottomNav } from "@/components/MobileBottomNav"
import AddressBottomSheet from "@/components/AddressBottomSheet"

const CAT_IMG: Record<string, string> = {
  Restaurante: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f354.png",
  Mercadinho:  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f6d2.png",
  "Farmácia":  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f48a.png",
  Outros:      "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f35d.png",
}
const CAT_DISPLAY: Record<string, string> = {
  Restaurante: "Restaurantes",
  Mercadinho:  "Mercados",
  "Farmácia":  "Farmácias",
  Outros:      "Outros",
}
const CAT_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  Restaurante: { bg: "#fff4ee", text: "#c2410c", accent: "#FF6B00" },
  Mercadinho:  { bg: "#f0fdf4", text: "#15803d", accent: "#22c55e" },
  "Farmácia":  { bg: "#eff6ff", text: "#1d4ed8", accent: "#3b82f6" },
  Outros:      { bg: "#f5f3ff", text: "#6d28d9", accent: "#8b5cf6" },
}
const CATEGORIAS: CategoriaLoja[] = ["Restaurante", "Mercadinho", "Farmácia", "Outros"]

type HomeCatAction = "filter" | "busca" | "breve"
const CATS_HOME: { label: string; img: string | null; bg: string; cat: CategoriaLoja | null; badge: string | null; action: HomeCatAction }[] = [
  { label: "Restaurantes", img: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f354.svg", bg: "linear-gradient(145deg,#FF5722,#E64A19)", cat: "Restaurante", badge: null,   action: "filter" },
  { label: "Mercados",     img: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f6d2.svg", bg: "linear-gradient(145deg,#E53935,#C62828)", cat: "Mercadinho",  badge: null,   action: "filter" },
  { label: "Farmácias",   img: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f48a.svg", bg: "linear-gradient(145deg,#1E88E5,#1565C0)", cat: "Farmácia",   badge: null,   action: "filter" },
  { label: "Gourmet",     img: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f37d.svg", bg: "linear-gradient(145deg,#4E342E,#6D4C41)", cat: "Restaurante", badge: "Novo", action: "filter" },
  { label: "Pet Shops",   img: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f43e.svg", bg: "linear-gradient(145deg,#AD1457,#E91E63)", cat: "Outros",     badge: null,   action: "filter" },
  { label: "Bebidas",     img: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f964.svg", bg: "linear-gradient(145deg,#0288D1,#0277BD)", cat: "Outros",     badge: null,   action: "filter" },
  { label: "Massas",      img: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f35d.svg", bg: "linear-gradient(145deg,#F57F17,#E65100)", cat: "Restaurante", badge: null,   action: "filter" },
  { label: "Lanches",     img: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f32d.svg", bg: "linear-gradient(145deg,#6D4C41,#4E342E)", cat: "Restaurante", badge: null,   action: "filter" },
  { label: "Pizzarias",   img: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f355.svg", bg: "linear-gradient(145deg,#C62828,#B71C1C)", cat: "Restaurante", badge: null,   action: "filter" },
  { label: "Ver mais",    img: null,                                                                       bg: "linear-gradient(145deg,#546E7A,#78909C)", cat: null,         badge: null,   action: "busca"  },
]

function playSound() {
  try {
    const audio = new Audio("/splash.mp3")
    audio.volume = 0.85
    audio.play().catch(() => {})
  } catch {}
}

const BANNERS = [
  {
    photo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&h=400&q=82",
    overlay: "linear-gradient(100deg,rgba(140,10,10,0.90) 0%,rgba(160,20,20,0.65) 50%,rgba(0,0,0,0.08) 100%)",
    shadow: "rgba(160,20,20,0.40)",
    cta_bg: "#DC2626",
    eyebrow: "Promoção do dia",
    title: "Frete Grátis",
    sub: "nos seus primeiros pedidos",
    cta: "Pedir agora →",
  },
  {
    photo: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&h=400&q=82",
    overlay: "linear-gradient(100deg,rgba(55,10,110,0.90) 0%,rgba(75,15,140,0.65) 50%,rgba(0,0,0,0.08) 100%)",
    shadow: "rgba(75,15,140,0.40)",
    cta_bg: "#7C3AED",
    eyebrow: "Novidade",
    title: "Mais Rápido",
    sub: "entrega express em 30 min",
    cta: "Ver lojas →",
  },
  {
    photo: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&h=400&q=82",
    overlay: "linear-gradient(100deg,rgba(4,60,25,0.90) 0%,rgba(5,90,35,0.65) 50%,rgba(0,0,0,0.08) 100%)",
    shadow: "rgba(5,90,35,0.40)",
    cta_bg: "#16a34a",
    eyebrow: "Mercados",
    title: "Fresquinho",
    sub: "hortifruti direto na sua porta",
    cta: "Ver mercados →",
  },
]

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"
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
  const splashDone = typeof window !== "undefined" && !!sessionStorage.getItem("arago_splash_done")
  const [splashVis,  setSplashVis]  = useState(!splashDone)
  const [splashFade, setSplashFade] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [lastAddress, setLastAddress] = useState("Aragoiânia, GO")
  const [addrSheetOpen, setAddrSheetOpen] = useState(false)
  const [breveToast, setBreveToast] = useState(false)
  const [bannerIdx, setBannerIdx] = useState(0)
  const touchStartX = useRef(0)
  // step: 0=nenhum 1=hamburguer 2=carrinho 3=farmácia 4=logo
  const [step, setStep] = useState(0)

  const isMobile    = useIsMobile()
  const primeiroNome = perfil?.nome?.split(" ")[0] ?? user?.user_metadata?.name?.split(" ")[0] ?? null

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("arago_last_address")
      if (saved) setLastAddress(saved)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("arago_onboarded")) {
      router.replace("/onboarding"); return
    }
    supabase.from("lojas").select("*").eq("status", "ativo")
      .order("aberto", { ascending: false }).order("nome")
      .then(({ data }) => { setLojas((data as Loja[]) ?? []); setLoading(false) })

    // Splash já foi exibido nesta sessão — pula animação e som
    if (sessionStorage.getItem("arago_splash_done")) return

    // sequência: cada ícone entra e sai antes do próximo
    const t1  = setTimeout(() => { setStep(1); playSound() },         150)
    const t2  = setTimeout(() => setStep(0),                          950)
    const t3  = setTimeout(() => setStep(2),                         1200)
    const t4  = setTimeout(() => setStep(0),                         2000)
    const t5  = setTimeout(() => setStep(3),                         2250)
    const t6  = setTimeout(() => setStep(0),                         3050)
    const t7  = setTimeout(() => setStep(4),                         3300)
    const t8  = setTimeout(() => setSplashFade(true),                4800)
    const t9  = setTimeout(() => { setSplashVis(false); sessionStorage.setItem("arago_splash_done", "1") }, 5400)
    return () => [t1,t2,t3,t4,t5,t6,t7,t8,t9].forEach(clearTimeout)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setBannerIdx(i => (i + 1) % BANNERS.length), 4000)
    return () => clearInterval(id)
  }, [])

  function scrollToLojas() {
    storeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
  function selectCat(cat: string | null) {
    setFiltro(f => f === cat ? null : cat)
    setTimeout(scrollToLojas, 80)
  }
  function handleHomeCat(c: typeof CATS_HOME[0]) {
    if (c.action === "filter" && c.cat) {
      selectCat(c.cat)
    } else if (c.action === "busca") {
      router.push("/busca")
    } else {
      setBreveToast(true)
      setTimeout(() => setBreveToast(false), 2200)
    }
  }

  const filtradas = lojas.filter(l => {
    const matchCat   = !filtro || l.categoria === filtro
    const matchBusca = l.nome.toLowerCase().includes(busca.toLowerCase())
    return matchCat && matchBusca
  })
  const abertas  = filtradas.filter(l => l.aberto)
  const fechadas = filtradas.filter(l => !l.aberto)

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", overflowX: "hidden" }}>

      {/* ── SPLASH ─────────────────────────────────────────── */}
      {splashVis && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999, background: "#ffffff",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          opacity: splashFade ? 0 : 1, transition: "opacity 0.6s ease",
          pointerEvents: splashFade ? "none" : "all",
        }}>
          {/* Partículas de fundo */}
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{
                position: "absolute", width: 5, height: 5, borderRadius: "50%",
                background: i % 3 === 0 ? "#DC2626" : i % 3 === 1 ? "rgba(220,38,38,0.2)" : "rgba(0,0,0,0.05)",
                left: `${(i * 8.3 + 5) % 100}%`, top: `${(i * 13 + 10) % 100}%`,
                animation: `splashFloat ${3 + (i % 3)}s ease-in-out ${i * 0.3}s infinite alternate`,
                opacity: step > 0 ? 1 : 0, transition: "opacity 0.5s",
              }} />
            ))}
          </div>

          <div style={{
            position: "absolute",
            width: 280, height: 280, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(220,38,38,0.07) 0%, transparent 70%)",
            opacity: step > 0 && step < 4 ? 1 : 0,
            transform: step > 0 && step < 4 ? "scale(1)" : "scale(0.6)",
            transition: "opacity 0.4s, transform 0.4s",
          }} />

          <div style={{ position: "relative", width: 200, height: 200, perspective: "600px" }}>
            <img src="https://cdn-icons-png.flaticon.com/512/3075/3075977.png" alt="Restaurantes" style={{
              position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
              opacity: step === 1 ? 1 : 0,
              transform: step === 1 ? "scale(1) translateY(0px)" : step < 1 ? "scale(0.6) translateY(32px)" : "scale(0.6) translateY(-32px)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
              filter: "drop-shadow(0 0 24px rgba(249,115,22,0.4))",
            }} />
            <img src="https://cdn-icons-png.flaticon.com/512/3081/3081559.png" alt="Mercados" style={{
              position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
              opacity: step === 2 ? 1 : 0,
              transform: step === 2 ? "scale(1) translateY(0px)" : step < 2 ? "scale(0.6) translateY(32px)" : "scale(0.6) translateY(-32px)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
              filter: "drop-shadow(0 0 24px rgba(34,197,94,0.4))",
            }} />
            <img src="https://cdn-icons-png.flaticon.com/512/2913/2913133.png" alt="Farmácias" style={{
              position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
              opacity: step === 3 ? 1 : 0,
              transform: step === 3 ? "scale(1) translateY(0px)" : step < 3 ? "scale(0.6) translateY(32px)" : "scale(0.6) translateY(-32px)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
              filter: "drop-shadow(0 0 24px rgba(59,130,246,0.4))",
            }} />
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              transform: step === 4 ? "rotateY(0deg) scale(1)" : "rotateY(-90deg) scale(0.5)",
              opacity: step === 4 ? 1 : 0,
              transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease",
              transformStyle: "preserve-3d",
              filter: step === 4 ? "drop-shadow(0 0 24px rgba(220,38,38,0.3))" : "none",
            }}>
              <img src="/logo-chego.png" alt="Chegô" style={{ width: 180, height: 180, objectFit: "contain" }} />
            </div>
          </div>

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
                 : step === 4 ? "#374151"
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

      {/* ── HEADER MOBILE (iFood-style) ─────────────────────── */}
      {isMobile && (
        <div style={{
          background: "white", position: "sticky", top: 0, zIndex: 100,
          boxShadow: "0 1px 8px rgba(0,0,0,0.08)",
        }}>
          <div style={{ padding: "12px 16px 6px" }}>
            {/* Row 1: Saudação + avatar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p style={{ color: "#6B7280", fontSize: 13, fontWeight: 500 }}>
                {getGreeting()}{primeiroNome ? `, ${primeiroNome}` : ""} 👋
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {count > 0 && !!user && (
                  <Link href="/carrinho" style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "5px 10px", borderRadius: 8,
                    background: "#DC2626", color: "white", fontWeight: 700, fontSize: 12, textDecoration: "none",
                  }}>
                    🛒 {count}
                  </Link>
                )}
                {user ? (
                  <div style={{ position: "relative" }}>
                    {menuAberto && (
                      <div onClick={() => setMenuAberto(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 199 }} />
                    )}
                    <button onClick={() => setMenuAberto(v => !v)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                      {user.user_metadata?.avatar_url
                        ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
                        : <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                          </div>}
                    </button>
                    {/* Mobile dropdown */}
                    <div style={{
                      position: "fixed", top: 64, right: 8,
                      background: "white", borderRadius: 16,
                      boxShadow: "0 12px 40px rgba(0,0,0,0.14)",
                      border: "1px solid #f0f0f0",
                      width: "calc(100vw - 16px)", maxWidth: 300, overflow: "hidden", zIndex: 200,
                      opacity: menuAberto ? 1 : 0,
                      transform: menuAberto ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.97)",
                      pointerEvents: menuAberto ? "all" : "none",
                      transition: "opacity 0.18s ease, transform 0.18s ease",
                    }}>
                      <div style={{ padding: "12px 14px", background: "#FFF8F5", borderBottom: "1px solid #f5ebe8", display: "flex", gap: 10, alignItems: "center" }}>
                        {user.user_metadata?.avatar_url
                          ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                          : <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                            </div>}
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 13, color: "#1a1a1a" }}>{primeiroNome ?? "Meu perfil"}</p>
                          <p style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
                        </div>
                      </div>
                      {[
                        { label: "Alterar dados",       href: "/cliente/alterar-dados" },
                        { label: "Ver meu perfil",      href: "/cliente/meu-perfil" },
                        { label: "Histórico de pedidos",href: "/cliente/historico" },
                        { label: "Convide e ganhe",     href: "/cliente/convide" },
                        { label: "Notificações",        href: "/cliente/notificacoes" },
                      ].map(({ label, href }) => (
                        <Link key={label} href={href} onClick={() => setMenuAberto(false)}
                          style={{ display: "block", padding: "10px 14px", textDecoration: "none", color: "#374151", fontSize: 13, fontWeight: 500, borderBottom: "1px solid #fafafa" }}>
                          {label}
                        </Link>
                      ))}
                      <button
                        onClick={async () => { setMenuAberto(false); await logout(); router.push("/") }}
                        style={{ width: "100%", padding: "10px 14px", border: "none", background: "none", textAlign: "left", color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        Sair da conta
                      </button>
                    </div>
                  </div>
                ) : (
                  <Link href="/cliente/entrar" style={{ background: "#DC2626", color: "white", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8, textDecoration: "none" }}>
                    Entrar
                  </Link>
                )}
              </div>
            </div>

            {/* Endereço — clicável */}
            <button onClick={() => setAddrSheetOpen(true)} style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 10,
              background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%", textAlign: "left",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span style={{ color: "#111827", fontWeight: 700, fontSize: 14, flex: 1 }}>
                {lastAddress.length > 32 ? lastAddress.substring(0, 30) + "..." : lastAddress}
              </span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>

          {/* Barra de busca mobile */}
          <div style={{ padding: "0 14px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F3F4F6", borderRadius: 12, padding: "10px 14px" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar restaurante ou produto..."
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 14, color: "#374151" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── NAVBAR DESKTOP ─────────────────────────────────── */}
      {!isMobile && (
        <nav style={{
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid #e5e7eb",
          position: "sticky", top: 0, zIndex: 100,
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}>
          <div style={{
            maxWidth: 1200, margin: "0 auto", padding: "0 24px",
            height: 80, display: "flex", alignItems: "center", gap: 8,
          }}>
            <Link href="/" style={{ textDecoration: "none", flexShrink: 0, marginRight: 20, display: "flex", alignItems: "center" }}>
              <img src="/logo-original.jpg" alt="Chegô" style={{ height: 60, width: "auto", objectFit: "contain", display: "block", borderRadius: 8 }} />
            </Link>

            <div style={{ display: "flex", gap: 4, flex: 1 }}>
              {[
                { label: "Restaurantes", cat: "Restaurante" },
                { label: "Mercados",     cat: "Mercadinho"  },
                { label: "Farmácias",    cat: "Farmácia"    },
              ].map(({ label, cat }) => (
                <button key={cat} onClick={() => selectCat(cat)}
                  style={{
                    background: filtro === cat ? "rgba(220,38,38,0.08)" : "transparent",
                    border: filtro === cat ? "1px solid rgba(220,38,38,0.3)" : "1px solid transparent",
                    borderRadius: 10, padding: "8px 16px", cursor: "pointer",
                    color: filtro === cat ? "#DC2626" : "#374151",
                    fontWeight: 500, fontSize: 15,
                  }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
              {count > 0 && !!user && (
                <Link href="/carrinho" style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 12,
                  background: "#DC2626", color: "white", fontWeight: 700, fontSize: 13, textDecoration: "none",
                  boxShadow: "0 4px 12px rgba(220,38,38,0.3)",
                }}>
                  🛒 {count} · R$ {total.toFixed(2)}
                </Link>
              )}
              <Link href="/cadastro-loja" style={{
                padding: "8px 16px", borderRadius: 12,
                color: "#374151", fontWeight: 600, fontSize: 14, textDecoration: "none",
              }}>
                Anuncie sua loja
              </Link>

              {user ? (
                <div style={{ position: "relative" }}>
                  {menuAberto && (
                    <div onClick={() => setMenuAberto(false)}
                      style={{ position: "fixed", inset: 0, zIndex: 199 }} />
                  )}
                  <button onClick={() => setMenuAberto(v => !v)} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 14px", borderRadius: 12, cursor: "pointer",
                    background: "rgba(0,0,0,0.04)", border: "1px solid #e5e7eb",
                    color: "#374151", fontWeight: 600, fontSize: 13,
                  }}>
                    {user.user_metadata?.avatar_url
                      ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
                    <span>Minha conta</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points={menuAberto ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
                    </svg>
                  </button>

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
                    <div style={{ padding: "14px 16px", background: "#FFF8F5", borderBottom: "1px solid #f5ebe8", display: "flex", gap: 12, alignItems: "center" }}>
                      {user.user_metadata?.avatar_url
                        ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                        : <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                          </div>}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {primeiroNome ?? "Meu perfil"}
                        </p>
                        <p style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</p>
                      </div>
                    </div>

                    {[
                      { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>, label: "Alterar dados",        href: "/cliente/alterar-dados" },
                      { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>, label: "Ver meu perfil",       href: "/cliente/meu-perfil" },
                      { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, label: "Configurações",        href: "/cliente/configuracoes" },
                      { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>, label: "Histórico de pedidos", href: "/cliente/historico" },
                      { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, label: "Convide e ganhe",      href: "/cliente/convide" },
                      { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, label: "Notificações",         href: "/cliente/notificacoes" },
                    ].map(({ icon, label, href }) => (
                      <Link key={label} href={href}
                        onClick={() => setMenuAberto(false)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", textDecoration: "none", color: "#374151", fontSize: 14, fontWeight: 500, borderBottom: "1px solid #fafafa" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#FFF8F5"; (e.currentTarget as HTMLAnchorElement).style.color = "#DC2626" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = ""; (e.currentTarget as HTMLAnchorElement).style.color = "#374151" }}>
                        <span style={{ color: "#6B7280", flexShrink: 0, display: "flex" }}>{icon}</span>
                        {label}
                      </Link>
                    ))}

                    <button
                      onClick={async () => { setMenuAberto(false); await logout(); router.push("/") }}
                      style={{ width: "100%", padding: "12px 16px", border: "none", background: "none", textAlign: "left", color: "#DC2626", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#fff5f5" }}
                      onMouseLeave={e => { e.currentTarget.style.background = "" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Sair da conta
                    </button>
                  </div>
                </div>
              ) : (
                <Link href="/cliente/entrar" style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 18px", borderRadius: 12,
                  background: "#DC2626", border: "none",
                  color: "white", fontWeight: 600, fontSize: 13, textDecoration: "none",
                  boxShadow: "0 4px 12px rgba(220,38,38,0.35)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#B91C1C" }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#DC2626" }}>
                  Entrar
                </Link>
              )}
            </div>
          </div>
        </nav>
      )}

      {/* ── HERO (desktop only) ─────────────────────────────── */}
      {!isMobile && (
        <div style={{
          background: "linear-gradient(135deg, #B91C1C 0%, #DC2626 40%, #EF4444 75%, #F87171 100%)",
          minHeight: 420,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
          padding: "56px 24px",
        }}>
          <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -60, left: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

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
      )}

      {/* ── MAIN ───────────────────────────────────────────── */}
      <div style={{ maxWidth: isMobile ? "100%" : 1200, margin: "0 auto", padding: isMobile ? "0 0 80px" : "48px 24px 80px" }}>

        {/* Mobile: grade de categorias iFood 2×5 */}
        {isMobile && !busca && (
          <div style={{ background: "white", padding: "16px 8px 14px", borderBottom: "1px solid #f0f0f0", marginBottom: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "14px 0" }}>
              {CATS_HOME.map(c => {
                const isActive = !!(c.cat && filtro === c.cat)
                return (
                  <button key={c.label} onClick={() => handleHomeCat(c)} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    background: "none", border: "none", cursor: "pointer", padding: "0 2px",
                  }}>
                    <div style={{ position: "relative" }}>
                      <div style={{
                        width: 58, height: 58, borderRadius: 16,
                        background: c.bg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: isActive
                          ? "0 4px 14px rgba(0,0,0,0.35)"
                          : "0 2px 8px rgba(0,0,0,0.18)",
                        transform: isActive ? "scale(1.06)" : "scale(1)",
                        transition: "all 0.15s",
                        outline: isActive ? "2.5px solid rgba(255,255,255,0.8)" : "none",
                        outlineOffset: 1,
                      }}>
                        {c.img ? (
                          <img src={c.img} alt={c.label} style={{ width: 34, height: 34, objectFit: "contain" }} />
                        ) : (
                          /* Ver mais: grid de pontos */
                          <svg width="28" height="28" viewBox="0 0 28 28" fill="white" opacity={0.9}>
                            <circle cx="7"  cy="7"  r="3.5"/>
                            <circle cx="14" cy="7"  r="3.5"/>
                            <circle cx="21" cy="7"  r="3.5"/>
                            <circle cx="7"  cy="14" r="3.5"/>
                            <circle cx="14" cy="14" r="3.5"/>
                            <circle cx="21" cy="14" r="3.5"/>
                            <circle cx="7"  cy="21" r="3.5"/>
                            <circle cx="14" cy="21" r="3.5"/>
                            <circle cx="21" cy="21" r="3.5"/>
                          </svg>
                        )}
                      </div>
                      {c.badge && (
                        <span style={{
                          position: "absolute", top: -4, right: -4,
                          background: "#DC2626", color: "white",
                          fontSize: 8, fontWeight: 800,
                          padding: "2px 5px", borderRadius: 6, lineHeight: 1.3,
                          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                        }}>
                          {c.badge}
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: isActive ? "#DC2626" : "#374151",
                      textAlign: "center", lineHeight: 1.2,
                      width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {c.label}
                    </span>
                  </button>
                )
              })}
            </div>
            {filtro && (
              <button onClick={() => setFiltro(null)} style={{ marginTop: 10, width: "100%", padding: "6px", borderRadius: 8, border: "1px dashed #d1d5db", background: "none", color: "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ✕ Limpar filtro
              </button>
            )}
          </div>
        )}

        {/* Banner Promocional mobile */}
        {isMobile && !busca && !filtro && (() => {
          const b = BANNERS[bannerIdx]
          return (
            <div style={{ padding: "10px 16px 6px" }}>
              <div
                onClick={() => setBannerIdx(i => (i + 1) % BANNERS.length)}
                onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
                onTouchEnd={e => {
                  const dx = e.changedTouches[0].clientX - touchStartX.current
                  if (dx < -40)      setBannerIdx(i => (i + 1) % BANNERS.length)
                  else if (dx > 40)  setBannerIdx(i => (i - 1 + BANNERS.length) % BANNERS.length)
                }}
                style={{
                  borderRadius: 20, overflow: "hidden", cursor: "pointer",
                  position: "relative", height: 164,
                  boxShadow: `0 8px 28px ${b.shadow}`,
                }}>

                {/* Foto ultra-realista */}
                <img
                  key={bannerIdx}
                  src={b.photo}
                  alt={b.title}
                  style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%", objectFit: "cover",
                    animation: "bannerFadeIn 0.45s ease",
                  }}
                />

                {/* Overlay gradiente */}
                <div style={{ position: "absolute", inset: 0, background: b.overlay }} />

                {/* Conteúdo */}
                <div style={{ position: "relative", zIndex: 1, padding: "18px 20px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.3, marginBottom: 4 }}>
                    {b.eyebrow}
                  </p>
                  <p style={{ color: "white", fontSize: 26, fontWeight: 900, lineHeight: 1.1, marginBottom: 4, textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                    {b.title}
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginBottom: 14 }}>
                    {b.sub}
                  </p>
                  <div style={{
                    display: "inline-block", background: b.cta_bg,
                    padding: "7px 16px", borderRadius: 20, alignSelf: "flex-start",
                    boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
                  }}>
                    <span style={{ color: "white", fontSize: 12, fontWeight: 800 }}>{b.cta}</span>
                  </div>
                </div>

                {/* Indicadores */}
                <div style={{ position: "absolute", bottom: 12, right: 18, display: "flex", gap: 5 }}>
                  {BANNERS.map((_, i) => (
                    <div key={i} style={{
                      width: i === bannerIdx ? 20 : 6, height: 6, borderRadius: 3,
                      background: i === bannerIdx ? "white" : "rgba(255,255,255,0.45)",
                      transition: "all 0.3s",
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Desktop: category chips */}
        {!isMobile && !busca && (
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

        {/* Desktop: 2 cards grandes */}
        {!isMobile && !busca && !filtro && (
          <div style={{ marginBottom: 52 }}>
            <div style={{ marginBottom: 22 }}>
              <h2 style={{
                color: "#1a1a1a", fontWeight: 800, fontSize: "1.6rem",
                letterSpacing: "-0.5px",
                borderLeft: "4px solid #DC2626", paddingLeft: 12,
                lineHeight: 1.2,
              }}>
                O que você quer pedir?
              </h2>
              <p style={{ fontSize: 14, color: "#6B7280", marginTop: 6, paddingLeft: 16 }}>Escolha onde quer pedir</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <button onClick={() => selectCat("Restaurante")} style={{
                position: "relative", borderRadius: 20, overflow: "hidden",
                height: 200, cursor: "pointer", border: "none", textAlign: "left",
                boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                background: "linear-gradient(135deg, #FF6B00 0%, #E55A00 100%)",
                padding: 0, display: "block", width: "100%",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(255,107,0,0.35)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.15)" }}>
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "45%", backgroundImage: "url(https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=85)", backgroundSize: "cover", backgroundPosition: "center" }} />
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "60%", background: "linear-gradient(to right, #E55A00 0%, #FF6B0000 100%)" }} />
                <div style={{ position: "relative", zIndex: 1, padding: "30px 32px", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", width: "65%" }}>
                  <div>
                    <p style={{ color: "white", fontWeight: 900, fontSize: 26, lineHeight: 1, marginBottom: 8 }}>Restaurantes</p>
                    <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>Comida pronta na sua porta</p>
                  </div>
                  <span style={{ display: "inline-flex", width: "fit-content", padding: "10px 20px", borderRadius: 12, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)", color: "white", fontWeight: 700, fontSize: 14 }}>
                    Ver opções ›
                  </span>
                </div>
              </button>

              <button onClick={() => selectCat("Mercadinho")} style={{
                position: "relative", borderRadius: 20, overflow: "hidden",
                height: 200, cursor: "pointer", border: "none", textAlign: "left",
                boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                padding: 0, display: "block", width: "100%",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(34,197,94,0.35)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.15)" }}>
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "45%", backgroundImage: "url(https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=85)", backgroundSize: "cover", backgroundPosition: "center" }} />
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "60%", background: "linear-gradient(to right, #15803d 0%, #15803d00 100%)" }} />
                <div style={{ position: "relative", zIndex: 1, padding: "30px 32px", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", width: "65%" }}>
                  <div>
                    <p style={{ color: "white", fontWeight: 900, fontSize: 26, lineHeight: 1, marginBottom: 8 }}>Mercados</p>
                    <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>Produtos do dia a dia sem sair</p>
                  </div>
                  <span style={{ display: "inline-flex", width: "fit-content", padding: "10px 20px", borderRadius: 12, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)", color: "white", fontWeight: 700, fontSize: 14 }}>
                    Ver lojas ›
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Search mode filter chips */}
        {busca && (
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", padding: isMobile ? "12px 16px 0" : "0" }}>
            {["Todas", ...CATEGORIAS].map(c => (
              <button key={c} onClick={() => setFiltro(c === "Todas" ? null : c)} style={{
                padding: "8px 16px", borderRadius: 50, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: (filtro === c || (c === "Todas" && !filtro)) ? "#DC2626" : "white",
                color:      (filtro === c || (c === "Todas" && !filtro)) ? "white" : "#6B7280",
                border: "1px solid #e5e7eb",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}>
                {c === "Todas" ? "🏪 Todas" : `${{ Restaurante:"🍔", Mercadinho:"🛒", "Farmácia":"💊", Outros:"🍝" }[c] ?? "📦"} ${c}`}
              </button>
            ))}
          </div>
        )}

        {/* ── LOJAS ──────────────────────────────────────────── */}
        <div ref={storeRef} style={{ padding: isMobile ? "0 0" : "0" }}>
          {(filtro || busca) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, padding: isMobile ? "12px 16px 0" : "0" }}>
              <h2 style={{ color: "#1a1a1a", fontWeight: 800, fontSize: 20 }}>
                {busca ? `Resultados para "${busca}"` : `${{ Restaurante:"🍔", Mercadinho:"🛒", "Farmácia":"💊", Outros:"🍝" }[filtro!] ?? "📦"} ${filtro}`}
              </h2>
              {filtro && (
                <button onClick={() => setFiltro(null)} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                  Limpar ✕
                </button>
              )}
            </div>
          )}

          {!filtro && !busca && (
            <div style={{ marginBottom: 8, padding: isMobile ? "12px 16px 4px" : "0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ color: "#111827", fontWeight: 900, fontSize: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#22C55E", display: "inline-block", boxShadow: "0 0 0 3px rgba(34,197,94,0.25)" }} />
                Lojas abertas
              </h2>
              {isMobile && (
                <button onClick={() => router.push("/busca")} style={{ background: "none", border: "none", color: "#EA1B2D", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                  Ver mais
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: isMobile ? 0 : 20, padding: isMobile ? "0 0" : "0" }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ background: "white", borderRadius: isMobile ? 0 : 16, height: 100, boxShadow: "var(--shadow-sm)", borderBottom: "1px solid #f0f0f0" }} />
              ))}
            </div>
          ) : filtradas.length === 0 ? (
            <div style={{ textAlign: "center", marginTop: 64, background: "white", borderRadius: 20, padding: "48px 24px", boxShadow: "var(--shadow-sm)", margin: isMobile ? "20px 16px" : undefined }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>🔍</p>
              <p style={{ color: "#1a1a1a", fontWeight: 700, fontSize: 16 }}>Nenhuma loja encontrada</p>
              <p style={{ color: "#9ca3af", fontSize: 14, marginTop: 4 }}>Tente outro nome ou categoria</p>
            </div>
          ) : (
            <>
              {abertas.length > 0 && (
                <div style={{ marginBottom: isMobile ? 0 : 40 }}>
                  {(filtro || busca) && !isMobile && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
                      <p style={{ color: "#9ca3af", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Abertas · {abertas.length} loja{abertas.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: isMobile ? 0 : 20 }}>
                    {abertas.map(loja => <LojaCard key={loja.id} loja={loja} isMobile={isMobile} />)}
                  </div>
                </div>
              )}
              {fechadas.length > 0 && (
                <div>
                  {!isMobile && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d1d5db" }} />
                      <p style={{ color: "#d1d5db", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Fechadas · {fechadas.length} loja{fechadas.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                  {isMobile && fechadas.length > 0 && (
                    <div style={{ padding: "12px 16px 4px" }}>
                      <p style={{ color: "#9ca3af", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Fechadas</p>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: isMobile ? 0 : 20 }}>
                    {fechadas.map(loja => <LojaCard key={loja.id} loja={loja} isMobile={isMobile} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── FOOTER (desktop only) ───────────────────────────── */}
      {!isMobile && (
        <footer style={{ background: "#f8fafc", borderTop: "1px solid #e5e7eb", color: "#374151", padding: "56px 24px 32px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ marginBottom: 40 }}>
              <LogoClean height={48} style={{ marginBottom: 12 }} />
              <p style={{ color: "#9CA3AF", fontSize: 14 }}>O delivery de Aragoiânia, GO</p>
            </div>
            <div className="footer-cols" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 40, marginBottom: 40 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#9CA3AF", marginBottom: 16 }}>Parceiros</p>
                {[
                  { label: "Cadastrar minha loja", href: "/cadastro-loja" },
                  { label: "Portal de parceiros",  href: "/parceiros" },
                  { label: "Acesso lojista",        href: "/entrar" },
                ].map(({ label, href }) => (
                  <Link key={href} href={href} style={{ display: "block", color: "#6B7280", fontSize: 14, textDecoration: "none", marginBottom: 10, fontWeight: 400 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#DC2626" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#6B7280" }}>
                    {label}
                  </Link>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#9CA3AF", marginBottom: 16 }}>Entregadores</p>
                <Link href="/cadastro-motoboy" style={{ display: "block", color: "#6B7280", fontSize: 14, textDecoration: "none", marginBottom: 10, fontWeight: 400 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#DC2626" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#6B7280" }}>
                  Quero ser motoboy
                </Link>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#9CA3AF", marginBottom: 16 }}>Redes sociais</p>
                <a href="https://instagram.com/ChegoAragyn" target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", padding: "10px 14px", borderRadius: 12, background: "#ffffff", border: "1px solid #e5e7eb" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
                        <stop offset="0%" stopColor="#fdf497"/><stop offset="5%" stopColor="#fdf497"/>
                        <stop offset="45%" stopColor="#fd5949"/><stop offset="60%" stopColor="#d6249f"/>
                        <stop offset="90%" stopColor="#285AEB"/>
                      </radialGradient>
                    </defs>
                    <rect x="2" y="2" width="20" height="20" rx="6" ry="6" fill="url(#ig-grad)"/>
                    <circle cx="12" cy="12" r="4.5" fill="none" stroke="white" strokeWidth="1.8"/>
                    <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
                  </svg>
                  <span style={{ color: "#374151", fontSize: 14, fontWeight: 500 }}>@ChegoAragyn</span>
                </a>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#9CA3AF", marginBottom: 16 }}>Localização</p>
                <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6 }}>Aragoiânia, Goiás</p>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <p style={{ color: "#9CA3AF", fontSize: 13 }}>© 2026 Chegô Delivery · Todos os direitos reservados</p>
              <p style={{ color: "#D1D5DB", fontSize: 12 }}>Feito com ❤️ em Aragoiânia</p>
            </div>
          </div>
        </footer>
      )}

      <MobileBottomNav />

      {/* Toast: em breve */}
      {breveToast && (
        <div style={{
          position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
          background: "#111827", color: "white",
          padding: "10px 20px", borderRadius: 24,
          fontSize: 13, fontWeight: 700,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          zIndex: 9999, whiteSpace: "nowrap",
          maxWidth: "calc(100vw - 32px)",
          animation: "fadeInUp 0.2s ease",
        }}>
          🚀 Em breve no Chegô!
        </div>
      )}

      {/* Sheet de endereços */}
      {isMobile && addrSheetOpen && (
        <AddressBottomSheet
          currentAddress={lastAddress}
          onSelect={addr => setLastAddress(addr)}
          onClose={() => setAddrSheetOpen(false)}
        />
      )}
    </div>
  )
}

/* ── LOJA CARD ────────────────────────────────────────── */
function LojaCard({ loja, isMobile }: { loja: Loja; isMobile: boolean }) {
  const c = CAT_COLORS[loja.categoria] ?? CAT_COLORS["Outros"]
  const CAT_ICONS_LOCAL: Record<string, string> = {
    Restaurante: "🍔", Mercadinho: "🛒", "Farmácia": "💊", Outros: "📦",
  }

  if (isMobile) {
    return (
      <Link href={`/restaurante/${loja.id}`} style={{ textDecoration: "none" }}>
        <div style={{
          background: "white", display: "flex", alignItems: "center", gap: 14,
          padding: "14px 16px", borderBottom: "1px solid #f0f0f0",
          opacity: loja.aberto ? 1 : 0.55,
        }}>
          {/* Thumb */}
          <div style={{
            width: 76, height: 76, borderRadius: 18, overflow: "hidden",
            flexShrink: 0, boxShadow: "0 3px 12px rgba(0,0,0,0.12)",
          }}>
            {loja.logo_url
              ? <img src={loja.logo_url} alt={loja.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%", background: loja.aberto ? `linear-gradient(135deg, ${c.accent}, ${c.accent}bb)` : "linear-gradient(135deg,#d1d5db,#9ca3af)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>
                  {CAT_ICONS_LOCAL[loja.categoria]}
                </div>}
          </div>
          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "#111827", fontWeight: 800, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>{loja.nome}</p>
            {loja.descricao && (
              <p style={{ color: "#6B7280", fontSize: 12, marginBottom: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{loja.descricao}</p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: loja.aberto ? "rgba(34,197,94,0.12)" : "rgba(0,0,0,0.06)", color: loja.aberto ? "#16a34a" : "#9ca3af" }}>
                {loja.aberto ? "● Aberto" : "Fechado"}
              </span>
              <span style={{ color: "#9CA3AF", fontSize: 11 }}>·</span>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>{loja.tempo_min}–{loja.tempo_max} min</span>
              {loja.taxa_entrega === 0 ? (
                <span style={{ fontSize: 11, fontWeight: 800, color: "#7C3AED", background: "rgba(124,58,237,0.1)", padding: "2px 7px", borderRadius: 6 }}>Grátis</span>
              ) : (
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>R$ {loja.taxa_entrega.toFixed(2)}</span>
              )}
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </Link>
    )
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
        {loja.logo_url ? (
          <div style={{ height: 160, position: "relative", overflow: "hidden" }}>
            <img src={loja.logo_url} alt={loja.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <span style={{ position: "absolute", top: 10, right: 10, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: loja.aberto ? "#22C55E" : "rgba(0,0,0,0.5)", color: "white" }}>
              {loja.aberto ? "● Aberto" : "Fechado"}
            </span>
          </div>
        ) : (
          <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, position: "relative", background: loja.aberto ? `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)` : "linear-gradient(135deg, #d1d5db, #9ca3af)" }}>
            {CAT_ICONS_LOCAL[loja.categoria]}
            <span style={{ position: "absolute", top: 10, right: 10, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: loja.aberto ? "#22C55E" : "rgba(0,0,0,0.3)", color: "white" }}>
              {loja.aberto ? "● Aberto" : "Fechado"}
            </span>
          </div>
        )}
        <div style={{ padding: "14px 16px 18px" }}>
          <p style={{ color: "#1a1a1a", fontWeight: 700, fontSize: 16, lineHeight: 1.2, marginBottom: 4 }}>{loja.nome}</p>
          {loja.descricao && (
            <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 10, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
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
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>Grátis</>
              ) : `R$ ${loja.taxa_entrega.toFixed(2)}`}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 8, background: c.bg, color: c.text }}>
              {loja.categoria}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
