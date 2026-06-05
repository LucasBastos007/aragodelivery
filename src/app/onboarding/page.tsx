"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const SLIDES = [
  {
    emoji: "🛵",
    title: "O delivery chegou em Aragoiânia!",
    sub: "Peça da sua loja favorita com poucos cliques e receba em casa rapidinho.",
    color: "#f97316",
    bg: "rgba(249,115,22,0.08)",
  },
  {
    emoji: "📍",
    title: "Acompanhe em tempo real",
    sub: "Veja cada etapa do seu pedido — da loja até a sua porta. Com GPS do motoboy ao vivo.",
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.08)",
  },
  {
    emoji: "⚡",
    title: "Rápido e fácil",
    sub: "Receba em casa ou retire na loja. Pague como preferir: PIX, cartão ou dinheiro.",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
  },
]

function playSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch {}
}

export default function OnboardingPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<"intro" | "slides">("intro")
  const [logoVisible, setLogoVisible] = useState(false)
  const [slide, setSlide] = useState(0)
  const [loadingGps, setLoadingGps] = useState(false)

  const isLast = slide === SLIDES.length - 1
  const s = SLIDES[slide]

  // Animação de entrada da logo
  useEffect(() => {
    const t1 = setTimeout(() => {
      setLogoVisible(true)
      playSound()
    }, 400)
    const t2 = setTimeout(() => setPhase("slides"), 3000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  function next() {
    if (isLast) solicitarGps()
    else setSlide(s => s + 1)
  }

  function solicitarGps() {
    setLoadingGps(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(() => concluir(), () => concluir(), { timeout: 8000 })
    } else {
      concluir()
    }
  }

  function concluir() {
    localStorage.setItem("arago_onboarded", "1")
    router.push("/")
  }

  // ── Tela intro com logo animada ──────────────────
  if (phase === "intro") {
    return (
      <div style={{
        minHeight: "100vh", background: "#0a0a0a",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        perspective: "800px", overflow: "hidden",
      }}>
        {/* Partículas de fundo */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              width: 6, height: 6, borderRadius: "50%",
              background: i % 3 === 0 ? "#f97316" : i % 3 === 1 ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.1)",
              left: `${(i * 8.3 + 5) % 100}%`,
              top: `${(i * 13 + 10) % 100}%`,
              animation: `float ${3 + (i % 3)}s ease-in-out ${i * 0.3}s infinite alternate`,
              opacity: logoVisible ? 1 : 0,
              transition: "opacity 0.5s",
            }} />
          ))}
        </div>

        {/* Logo 3D */}
        <div style={{
          transform: logoVisible
            ? "rotateY(0deg) scale(1)"
            : "rotateY(-90deg) scale(0.5)",
          opacity: logoVisible ? 1 : 0,
          transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.6s ease",
          transformStyle: "preserve-3d",
          filter: logoVisible ? "drop-shadow(0 0 40px rgba(249,115,22,0.5))" : "none",
        }}>
          <img
            src="/logo-chego.jpg"
            alt="Chegô"
            style={{
              width: 220, height: 220, borderRadius: 40, objectFit: "contain",
              border: "2px solid rgba(249,115,22,0.3)",
            }}
          />
        </div>

        <p style={{
          color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 600, marginTop: 24,
          opacity: logoVisible ? 1 : 0,
          transform: logoVisible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.6s ease 0.4s",
          letterSpacing: 2, textTransform: "uppercase",
        }}>
          Aragoiânia · GO
        </p>

        <style>{`
          @keyframes float {
            from { transform: translateY(0px) rotate(0deg); }
            to   { transform: translateY(-20px) rotate(180deg); }
          }
        `}</style>
      </div>
    )
  }

  // ── Slides normais ───────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
      padding: "48px 24px 40px",
    }}>
      {/* Pular */}
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <img src="/logo-chego.jpg" alt="Chegô" style={{ height: 32, width: "auto", borderRadius: 8, objectFit: "contain" }} />
        <button onClick={concluir}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Pular
        </button>
      </div>

      {/* Conteúdo central */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 24, maxWidth: 360 }}>
        <div style={{
          width: 120, height: 120, borderRadius: 36, background: s.bg,
          border: `2px solid ${s.color}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 60, transition: "all 0.4s",
        }}>
          {s.emoji}
        </div>
        <div>
          <h1 style={{ color: "white", fontWeight: 900, fontSize: 28, lineHeight: 1.15, marginBottom: 12 }}>
            {s.title}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 16, lineHeight: 1.65 }}>
            {s.sub}
          </p>
        </div>
        {isLast && (
          <div style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 14, padding: "14px 18px", width: "100%" }}>
            <p style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>
              📡 O app vai pedir acesso à sua localização para facilitar o endereço de entrega.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {SLIDES.map((_, i) => (
            <div key={i} onClick={() => setSlide(i)} style={{
              width: i === slide ? 24 : 8, height: 8, borderRadius: 4, cursor: "pointer",
              background: i === slide ? s.color : "rgba(255,255,255,0.15)",
              transition: "all 0.3s",
            }} />
          ))}
        </div>
        <button onClick={next} disabled={loadingGps} style={{
          width: "100%", padding: "16px", borderRadius: 14, border: "none",
          background: loadingGps ? `${s.color}60` : s.color,
          color: "white", fontWeight: 800, fontSize: 16, cursor: loadingGps ? "not-allowed" : "pointer",
          transition: "background 0.2s",
        }}>
          {loadingGps ? "Aguardando localização..." : isLast ? "Permitir localização e começar →" : "Continuar →"}
        </button>
      </div>
    </div>
  )
}
