"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useCart } from "@/lib/cart"
import { useClienteAuth } from "@/lib/auth-cliente"
import { useIsMobile } from "@/lib/use-mobile"
import type { Loja, CategoriaLoja } from "@/types"

const CAT_ICONS: Record<string, string> = {
  Restaurante: "🍔", Mercadinho: "🛒", "Farmácia": "💊", Outros: "📦",
}
const CAT_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  Restaurante: { bg: "#fff4ee", text: "#c2410c", accent: "#f97316" },
  Mercadinho:  { bg: "#f0fdf4", text: "#15803d", accent: "#22c55e" },
  "Farmácia":  { bg: "#eff6ff", text: "#1d4ed8", accent: "#3b82f6" },
  Outros:      { bg: "#f5f3ff", text: "#6d28d9", accent: "#8b5cf6" },
}
const CATEGORIAS: CategoriaLoja[] = ["Restaurante", "Mercadinho", "Farmácia", "Outros"]

function playSound() {
  try {
    const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5)
  } catch {}
}

export default function Home() {
  const router   = useRouter()
  const storeRef = useRef<HTMLDivElement>(null)
  const { count, total } = useCart()
  const { user, perfil }  = useClienteAuth()

  const [lojas,      setLojas]      = useState<Loja[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filtro,     setFiltro]     = useState<string | null>(null)
  const [busca,      setBusca]      = useState("")
  const [splashVis,  setSplashVis]  = useState(true)
  const [logoVis,    setLogoVis]    = useState(false)
  const [splashFade, setSplashFade] = useState(false)

  const isMobile    = useIsMobile()
  const primeiroNome = perfil?.nome?.split(" ")[0] ?? user?.user_metadata?.name?.split(" ")[0] ?? null

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("arago_onboarded")) {
      router.replace("/onboarding"); return
    }
    const t1 = setTimeout(() => { setLogoVis(true); playSound() }, 300)
    const t2 = setTimeout(() => setSplashFade(true), 2000)
    const t3 = setTimeout(() => setSplashVis(false), 2600)
    supabase.from("lojas").select("*").eq("status", "ativo")
      .order("aberto", { ascending: false }).order("nome")
      .then(({ data }) => { setLojas((data as Loja[]) ?? []); setLoading(false) })
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
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
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>

      {/* ── SPLASH ─────────────────────────────────────────── */}
      {splashVis && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999, background: "#0a0a0a",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          opacity: splashFade ? 0 : 1, transition: "opacity 0.6s ease",
          pointerEvents: splashFade ? "none" : "all", perspective: "800px",
        }}>
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{
                position: "absolute", width: 6, height: 6, borderRadius: "50%",
                background: i % 3 === 0 ? "#f97316" : i % 3 === 1 ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.08)",
                left: `${(i * 8.3 + 5) % 100}%`, top: `${(i * 13 + 10) % 100}%`,
                animation: `float ${3 + (i % 3)}s ease-in-out ${i * 0.3}s infinite alternate`,
                opacity: logoVis ? 1 : 0, transition: "opacity 0.5s",
              }} />
            ))}
          </div>
          <div style={{
            transform: logoVis ? "rotateY(0deg) scale(1)" : "rotateY(-90deg) scale(0.5)",
            opacity: logoVis ? 1 : 0,
            transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.6s ease",
            transformStyle: "preserve-3d",
            filter: logoVis ? "drop-shadow(0 0 50px rgba(249,115,22,0.6))" : "none",
          }}>
            <img src="/logo-chego.jpg" alt="Chegô" style={{
              width: 200, height: 200, borderRadius: 40, objectFit: "contain",
              border: "2px solid rgba(249,115,22,0.3)",
            }} />
          </div>
          <p style={{
            color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: 700, marginTop: 24,
            opacity: logoVis ? 1 : 0, transform: logoVis ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.6s ease 0.4s", letterSpacing: 3, textTransform: "uppercase",
          }}>Aragoiânia · GO</p>
          <style>{`
            @keyframes float {
              from { transform: translateY(0px) rotate(0deg); }
              to   { transform: translateY(-20px) rotate(180deg); }
            }
          `}</style>
        </div>
      )}

      {/* ── NAVBAR ─────────────────────────────────────────── */}
      <nav style={{
        background: "#ffffff",
        borderBottom: "1px solid #e8e8e8",
        position: "sticky", top: 0, zIndex: 40,
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", padding: isMobile ? "0 16px" : "0 28px",
          height: 64, display: "flex", alignItems: "center", gap: 8,
        }}>
          <Link href="/" style={{ textDecoration: "none", flexShrink: 0, marginRight: isMobile ? 8 : 16 }}>
            <img src="/logo-chego.jpg" alt="Chegô" style={{ height: isMobile ? 40 : 52, width: "auto", borderRadius: 12, objectFit: "contain" }} />
          </Link>

          {/* Nav links — hidden on mobile */}
          {!isMobile && (
            <div style={{ display: "flex", gap: 2, flex: 1 }}>
              {[
                { label: "Restaurantes", cat: "Restaurante" },
                { label: "Mercadinho",   cat: "Mercadinho"  },
                { label: "Farmácias",    cat: "Farmácia"    },
              ].map(({ label, cat }) => (
                <button key={cat} onClick={() => selectCat(cat)}
                  style={{
                    background: filtro === cat ? "#fff4ee" : "transparent",
                    border: filtro === cat ? "1px solid #f9731633" : "1px solid transparent",
                    borderRadius: 10, padding: "8px 16px", cursor: "pointer",
                    color: filtro === cat ? "#f97316" : "#666",
                    fontWeight: filtro === cat ? 700 : 500, fontSize: 14,
                    transition: "all 0.15s",
                  }}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {isMobile && <div style={{ flex: 1 }} />}

          {/* Right */}
          <div style={{ display: "flex", gap: isMobile ? 8 : 10, alignItems: "center", flexShrink: 0 }}>
            {count > 0 && (
              <Link href="/carrinho" style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: isMobile ? "9px 12px" : "9px 16px", borderRadius: 12,
                background: "#f97316", color: "white", fontWeight: 800, fontSize: 13, textDecoration: "none",
              }}>
                🛒 {count}{!isMobile && ` · R$ ${total.toFixed(2)}`}
              </Link>
            )}
            {!user && !isMobile && (
              <Link href="/cadastro-loja" style={{
                padding: "9px 14px", borderRadius: 12,
                color: "#f97316", fontWeight: 700, fontSize: 13, textDecoration: "none",
              }}>
                Anuncie sua loja
              </Link>
            )}
            <Link href={user ? "/cliente/perfil" : "/cliente/entrar"} style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: isMobile ? "9px 14px" : "9px 20px", borderRadius: 12,
              background: user ? "#fff4ee" : "#f97316",
              border: user ? "1px solid #f9731633" : "none",
              color: user ? "#f97316" : "white", fontWeight: 700, fontSize: 13, textDecoration: "none",
            }}>
              {user ? (
                <>
                  {user.user_metadata?.avatar_url
                    ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
                    : "👤"}
                  {!isMobile && (primeiroNome ?? "Minha conta")}
                </>
              ) : (isMobile ? "Entrar" : "Entrar")}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
        padding: isMobile ? "40px 16px 48px" : "56px 24px 64px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h1 style={{
            color: "white", fontWeight: 900,
            fontSize: "clamp(30px, 5vw, 50px)",
            lineHeight: 1.15, marginBottom: 14,
            textShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}>
            {primeiroNome ? `Olá, ${primeiroNome}! 👋` : "Chegô. O delivery de Aragoiânia."}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 17, lineHeight: 1.6, marginBottom: 36 }}>
            Peça da sua loja favorita e receba em casa rapidinho.
          </p>

          {/* Search bar */}
          <div style={{
            display: "flex", maxWidth: 520, margin: "0 auto",
            background: "white", borderRadius: 16,
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)", overflow: "hidden",
          }}>
            <span style={{ padding: "0 16px", fontSize: 18, display: "flex", alignItems: "center", color: "#f97316", flexShrink: 0 }}>
              📍
            </span>
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") scrollToLojas() }}
              placeholder="Buscar restaurante ou produto..."
              style={{
                flex: 1, padding: "16px 0", fontSize: 15, fontWeight: 500,
                background: "transparent", border: "none", color: "#1a1a1a", outline: "none",
              }}
            />
            <button onClick={scrollToLojas} style={{
              padding: "0 24px", border: "none",
              background: "#f97316", color: "white",
              fontWeight: 800, fontSize: 14, cursor: "pointer", flexShrink: 0,
            }}>
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN ───────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "24px 16px 80px" : "40px 24px 72px" }}>

        {/* Category chips */}
        {!busca && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {CATEGORIAS.map(cat => {
                const c    = CAT_COLORS[cat]
                const ativo = filtro === cat
                return (
                  <button key={cat} onClick={() => selectCat(cat)} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 20px", borderRadius: 50, border: "none", cursor: "pointer",
                    background: ativo ? c.accent : "#ffffff",
                    color: ativo ? "white" : "#444",
                    fontWeight: ativo ? 700 : 600, fontSize: 14,
                    boxShadow: ativo ? `0 4px 16px ${c.accent}44` : "0 1px 4px rgba(0,0,0,0.08)",
                    transition: "all 0.18s",
                  }}>
                    <span style={{ fontSize: 18 }}>{CAT_ICONS[cat]}</span>
                    {cat}
                  </button>
                )
              })}
              {filtro && (
                <button onClick={() => setFiltro(null)} style={{
                  padding: "10px 18px", borderRadius: 50, border: "1px dashed #ddd",
                  background: "transparent", color: "#999", fontWeight: 600, fontSize: 14, cursor: "pointer",
                }}>
                  ✕ Limpar
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2 CARDS GRANDES */}
        {!busca && !filtro && (
          <div style={{ marginBottom: 44 }}>
            <h2 style={{ color: "#1a1a1a", fontWeight: 900, fontSize: 22, marginBottom: 18 }}>
              O que você quer pedir?
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>

              {/* Restaurante */}
              <button onClick={() => selectCat("Restaurante")} style={{
                position: "relative", borderRadius: 24, overflow: "hidden",
                height: isMobile ? 160 : 210, cursor: "pointer", border: "none", textAlign: "left",
                background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                boxShadow: "0 6px 24px rgba(249,115,22,0.35)",
                transition: "transform 0.18s, box-shadow 0.18s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(249,115,22,0.45)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 6px 24px rgba(249,115,22,0.35)" }}>
                <div style={{ position: "absolute", inset: 0, padding: "30px 32px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ color: "white", fontWeight: 900, fontSize: 26, lineHeight: 1, marginBottom: 8 }}>Restaurantes</p>
                    <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14 }}>Comida pronta na sua porta</p>
                  </div>
                  <span style={{
                    display: "inline-flex", width: "fit-content",
                    padding: "9px 18px", borderRadius: 12,
                    background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)",
                    color: "white", fontWeight: 700, fontSize: 14,
                    border: "1px solid rgba(255,255,255,0.3)",
                  }}>
                    Ver opções ›
                  </span>
                </div>
                <div style={{ position: "absolute", right: -10, bottom: -12, fontSize: 140, opacity: 0.18, transform: "rotate(-8deg)", pointerEvents: "none", lineHeight: 1 }}>🍔</div>
              </button>

              {/* Mercadinho */}
              <button onClick={() => selectCat("Mercadinho")} style={{
                position: "relative", borderRadius: 24, overflow: "hidden",
                height: isMobile ? 160 : 210, cursor: "pointer", border: "none", textAlign: "left",
                background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                boxShadow: "0 6px 24px rgba(34,197,94,0.3)",
                transition: "transform 0.18s, box-shadow 0.18s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(34,197,94,0.4)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 6px 24px rgba(34,197,94,0.3)" }}>
                <div style={{ position: "absolute", inset: 0, padding: "30px 32px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ color: "white", fontWeight: 900, fontSize: 26, lineHeight: 1, marginBottom: 8 }}>Mercadinho</p>
                    <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14 }}>Produtos do dia a dia sem sair</p>
                  </div>
                  <span style={{
                    display: "inline-flex", width: "fit-content",
                    padding: "9px 18px", borderRadius: 12,
                    background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)",
                    color: "white", fontWeight: 700, fontSize: 14,
                    border: "1px solid rgba(255,255,255,0.3)",
                  }}>
                    Ver lojas ›
                  </span>
                </div>
                <div style={{ position: "absolute", right: -10, bottom: -12, fontSize: 140, opacity: 0.18, transform: "rotate(-8deg)", pointerEvents: "none", lineHeight: 1 }}>🛒</div>
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
                background: (filtro === c || (c === "Todas" && !filtro)) ? "#f97316" : "white",
                color:      (filtro === c || (c === "Todas" && !filtro)) ? "white" : "#666",
                border: "1px solid #e0e0e0",
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
                  background: "none", border: "none", color: "#999", fontSize: 13, cursor: "pointer", fontWeight: 600,
                }}>
                  Limpar ✕
                </button>
              )}
            </div>
          )}

          {!filtro && !busca && (
            <h2 style={{ color: "#1a1a1a", fontWeight: 900, fontSize: 22, marginBottom: 20 }}>
              🟢 Lojas abertas agora
            </h2>
          )}

          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ background: "white", borderRadius: 20, height: 220, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }} />
              ))}
            </div>
          ) : filtradas.length === 0 ? (
            <div style={{ textAlign: "center", marginTop: 64, background: "white", borderRadius: 20, padding: "48px 24px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>🔍</p>
              <p style={{ color: "#1a1a1a", fontWeight: 700, fontSize: 16 }}>Nenhuma loja encontrada</p>
              <p style={{ color: "#999", fontSize: 14, marginTop: 4 }}>Tente outro nome ou categoria</p>
            </div>
          ) : (
            <>
              {abertas.length > 0 && (
                <div style={{ marginBottom: 40 }}>
                  {(filtro || busca) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                      <p style={{ color: "#888", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Abertas · {abertas.length} loja{abertas.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                    {abertas.map(loja => <LojaCard key={loja.id} loja={loja} />)}
                  </div>
                </div>
              )}
              {fechadas.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ccc" }} />
                    <p style={{ color: "#bbb", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Fechadas · {fechadas.length} loja{fechadas.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                    {fechadas.map(loja => <LojaCard key={loja.id} loja={loja} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <div style={{ marginTop: 72, paddingTop: 32, borderTop: "1px solid #e8e8e8" }}>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            {[
              { label: "🏪 Cadastrar minha loja", href: "/cadastro-loja" },
              { label: "🛵 Quero ser motoboy",    href: "/cadastro-motoboy" },
              { label: "🤝 Portal de parceiros",   href: "/parceiros" },
              { label: "🔐 Acesso lojista",        href: "/entrar" },
            ].map(({ label, href }) => (
              <Link key={href} href={href} style={{
                color: "#999", fontSize: 13, textDecoration: "none", fontWeight: 500,
                padding: "8px 14px", borderRadius: 8, border: "1px solid #e0e0e0",
                background: "white",
              }}>
                {label}
              </Link>
            ))}
          </div>
          <p style={{ textAlign: "center", color: "#bbb", fontSize: 12 }}>
            © 2026 Chegô Delivery · Aragoiânia, GO · Instagram{" "}
            <a href="https://instagram.com/ChegoAragyn" target="_blank" rel="noopener noreferrer"
              style={{ color: "#f97316", textDecoration: "none", fontWeight: 600 }}>@ChegoAragyn</a>
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── LOJA CARD (light mode) ────────────────────────── */
function LojaCard({ loja }: { loja: Loja }) {
  const c = CAT_COLORS[loja.categoria] ?? CAT_COLORS["Outros"]
  return (
    <Link href={`/restaurante/${loja.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "white", borderRadius: 20, overflow: "hidden", cursor: "pointer",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          transition: "transform 0.15s, box-shadow 0.15s",
          opacity: loja.aberto ? 1 : 0.6,
        }}
        onMouseEnter={e => {
          if (loja.aberto) {
            e.currentTarget.style.transform = "translateY(-4px)"
            e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.14)"
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = ""
          e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"
        }}>

        {/* Banner */}
        {loja.logo_url ? (
          <div style={{ height: 140, position: "relative", overflow: "hidden" }}>
            <img src={loja.logo_url} alt={loja.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <span style={{
              position: "absolute", top: 10, right: 10, fontSize: 11, fontWeight: 700,
              padding: "4px 10px", borderRadius: 999,
              background: loja.aberto ? "#22c55e" : "rgba(0,0,0,0.45)",
              color: "white", backdropFilter: "blur(4px)",
            }}>
              {loja.aberto ? "● Aberto" : "Fechado"}
            </span>
          </div>
        ) : (
          <div style={{
            height: 120, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 52, position: "relative",
            background: c.bg,
          }}>
            {CAT_ICONS[loja.categoria]}
            <span style={{
              position: "absolute", top: 10, right: 10, fontSize: 11, fontWeight: 700,
              padding: "4px 10px", borderRadius: 999,
              background: loja.aberto ? "#22c55e" : "#e5e5e5",
              color: loja.aberto ? "white" : "#999",
            }}>
              {loja.aberto ? "● Aberto" : "Fechado"}
            </span>
          </div>
        )}

        <div style={{ padding: "14px 16px 18px" }}>
          <p style={{ color: "#1a1a1a", fontWeight: 800, fontSize: 15, lineHeight: 1.2, marginBottom: 4 }}>{loja.nome}</p>
          {loja.descricao && (
            <p style={{
              color: "#888", fontSize: 12, marginBottom: 10, lineHeight: 1.4,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {loja.descricao}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
            <span style={{ color: "#888" }}>🕐 {loja.tempo_min}–{loja.tempo_max} min</span>
            <span style={{ color: "#ddd" }}>·</span>
            <span style={{ color: loja.taxa_entrega === 0 ? "#16a34a" : "#888", fontWeight: loja.taxa_entrega === 0 ? 700 : 400 }}>
              {loja.taxa_entrega === 0 ? "🎉 Grátis" : `R$ ${loja.taxa_entrega.toFixed(2)}`}
            </span>
            <span style={{
              marginLeft: "auto", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
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
