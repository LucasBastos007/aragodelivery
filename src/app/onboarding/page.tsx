"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const SLIDES = [
  {
    title: "O delivery chegou em Aragoiânia!",
    sub: "Peça da sua loja favorita com poucos cliques e receba em casa rapidinho.",
    color: "#DC2626",
    bg: "rgba(220,38,38,0.08)",
  },
  {
    title: "Acompanhe em tempo real",
    sub: "Veja cada etapa do seu pedido — da loja até a sua porta. Com rastreamento ao vivo.",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
  },
  {
    title: "Rápido e fácil",
    sub: "Receba em casa ou retire na loja. Pague como preferir: PIX, cartão, Apple Pay ou Google Pay.",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
  },
]

function IllustrationScooter() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Sombra */}
      <ellipse cx="36" cy="65" rx="22" ry="4" fill="rgba(0,0,0,0.10)"/>
      {/* Caixa de entrega */}
      <rect x="38" y="20" width="20" height="16" rx="3" fill="#DC2626"/>
      <rect x="38" y="20" width="20" height="16" rx="3" stroke="#b91c1c" strokeWidth="1"/>
      <line x1="48" y1="20" x2="48" y2="36" stroke="#b91c1c" strokeWidth="1.5"/>
      <rect x="44" y="24" width="8" height="5" rx="1.5" fill="white" opacity="0.3"/>
      {/* Corpo da moto */}
      <path d="M18 42 Q22 30 38 33 L58 33 Q62 33 62 38 L62 44 Q62 48 58 48 L20 48 Q16 48 16 44 Z" fill="#1f2937"/>
      {/* Selim */}
      <rect x="30" y="28" width="18" height="7" rx="3.5" fill="#374151"/>
      {/* Guidão */}
      <path d="M54 28 L54 34" stroke="#6b7280" strokeWidth="3" strokeLinecap="round"/>
      <path d="M50 28 L58 28" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Rodas */}
      <circle cx="22" cy="52" r="10" fill="#1f2937" stroke="#374151" strokeWidth="2"/>
      <circle cx="22" cy="52" r="5" fill="#4b5563"/>
      <circle cx="22" cy="52" r="2" fill="#9ca3af"/>
      <circle cx="56" cy="52" r="10" fill="#1f2937" stroke="#374151" strokeWidth="2"/>
      <circle cx="56" cy="52" r="5" fill="#4b5563"/>
      <circle cx="56" cy="52" r="2" fill="#9ca3af"/>
      {/* Escapamento / detalhe frente */}
      <path d="M16 44 L10 46" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
      {/* Linhas de velocidade */}
      <line x1="4" y1="36" x2="14" y2="36" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
      <line x1="2" y1="42" x2="12" y2="42" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      <line x1="5" y1="48" x2="13" y2="48" stroke="#DC2626" strokeWidth="1" strokeLinecap="round" opacity="0.35"/>
    </svg>
  )
}

function IllustrationTracking() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Telefone */}
      <rect x="14" y="6" width="34" height="58" rx="7" fill="#1e3a5f"/>
      <rect x="16" y="8" width="30" height="54" rx="6" fill="#1d4ed8"/>
      {/* Tela mapa */}
      <rect x="18" y="12" width="26" height="38" rx="3" fill="#dbeafe"/>
      {/* Ruas do mapa */}
      <line x1="18" y1="28" x2="44" y2="28" stroke="#93c5fd" strokeWidth="2"/>
      <line x1="30" y1="12" x2="30" y2="50" stroke="#93c5fd" strokeWidth="2"/>
      <rect x="20" y="15" width="8" height="6" rx="1" fill="#bfdbfe"/>
      <rect x="33" y="30" width="9" height="7" rx="1" fill="#bfdbfe"/>
      <rect x="20" y="32" width="7" height="8" rx="1" fill="#bfdbfe"/>
      {/* Rota tracejada */}
      <path d="M24 44 Q24 36 30 32 Q36 28 38 22" stroke="#3b82f6" strokeWidth="2" strokeDasharray="3 2" strokeLinecap="round"/>
      {/* Pin destino */}
      <path d="M38 22 C38 18 44 18 44 22 C44 26 38 30 38 30 C38 30 32 26 32 22 C32 18 38 18 38 22Z" fill="#DC2626"/>
      <circle cx="38" cy="22" r="3" fill="white"/>
      {/* Ponto de origem */}
      <circle cx="24" cy="44" r="4" fill="#22c55e" stroke="white" strokeWidth="2"/>
      {/* Botão home */}
      <rect x="28" y="54" width="6" height="4" rx="2" fill="#93c5fd"/>
      {/* Sinal de rastreamento ao redor */}
      <path d="M52 24 Q58 30 52 36" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7"/>
      <path d="M56 20 Q65 30 56 40" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.4"/>
    </svg>
  )
}

function IllustrationFast() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Sombra */}
      <ellipse cx="36" cy="67" rx="20" ry="3.5" fill="rgba(0,0,0,0.08)"/>
      {/* Cartão de trás */}
      <rect x="20" y="22" width="40" height="26" rx="5" fill="#4ade80" transform="rotate(-5 20 22)"/>
      {/* Cartão do meio */}
      <rect x="16" y="26" width="40" height="26" rx="5" fill="#16a34a" transform="rotate(2 16 26)"/>
      {/* Cartão da frente */}
      <rect x="12" y="30" width="42" height="28" rx="6" fill="#15803d"/>
      <rect x="12" y="30" width="42" height="28" rx="6" stroke="#166534" strokeWidth="1"/>
      {/* Chip */}
      <rect x="18" y="38" width="10" height="8" rx="2" fill="#4ade80" opacity="0.7"/>
      <line x1="21" y1="38" x2="21" y2="46" stroke="#166534" strokeWidth="0.8" opacity="0.5"/>
      <line x1="24" y1="38" x2="24" y2="46" stroke="#166534" strokeWidth="0.8" opacity="0.5"/>
      <line x1="18" y1="42" x2="28" y2="42" stroke="#166534" strokeWidth="0.8" opacity="0.5"/>
      {/* Número mascarado */}
      <circle cx="32" cy="51" r="2" fill="#4ade80" opacity="0.5"/>
      <circle cx="38" cy="51" r="2" fill="#4ade80" opacity="0.5"/>
      <circle cx="44" cy="51" r="2" fill="#4ade80" opacity="0.5"/>
      <rect x="47" y="49" width="5" height="4" rx="1" fill="#4ade80" opacity="0.5"/>
      {/* Símbolo check de confirmação */}
      <circle cx="54" cy="20" r="12" fill="#22c55e"/>
      <circle cx="54" cy="20" r="12" stroke="white" strokeWidth="2"/>
      <path d="M48 20 L52 24 L60 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* PIX icon hint */}
      <path d="M19 20 L23 16 L27 20 L23 24 Z" fill="#22c55e" opacity="0.6"/>
    </svg>
  )
}

const SLIDE_ILLUSTRATIONS = [IllustrationScooter, IllustrationTracking, IllustrationFast]

function unlockAudio() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.01)
  } catch {}
}

export default function OnboardingPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<"intro" | "slides">("intro")
  const [logoVisible, setLogoVisible] = useState(false)
  const [slide, setSlide] = useState(0)
  const [loading, setLoading] = useState(false)
  const [statusPermissoes, setStatusPermissoes] = useState({ geo: false, notif: false, audio: false })

  const isLast = slide === SLIDES.length - 1
  const s = SLIDES[slide]

  useEffect(() => {
    const t1 = setTimeout(() => setLogoVisible(true), 400)
    const t2 = setTimeout(() => setPhase("slides"), 3000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  function next() {
    if (isLast) solicitarPermissoes()
    else setSlide(s => s + 1)
  }

  async function solicitarPermissoes() {
    setLoading(true)

    // 1. Desbloquear áudio (requer gesto do usuário)
    unlockAudio()
    setStatusPermissoes(p => ({ ...p, audio: true }))

    // 2. Notificações push
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const result = await Notification.requestPermission()
        setStatusPermissoes(p => ({ ...p, notif: result === "granted" }))
      } catch {}
    }

    // 3. Localização
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => { setStatusPermissoes(p => ({ ...p, geo: true })); concluir() },
        () => concluir(),
        { timeout: 8000 }
      )
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
        minHeight: "100vh", background: "#f8fafc",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        perspective: "800px", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              width: 6, height: 6, borderRadius: "50%",
              background: i % 3 === 0 ? "#DC2626" : i % 3 === 1 ? "rgba(220,38,38,0.3)" : "rgba(0,0,0,0.06)",
              left: `${(i * 8.3 + 5) % 100}%`,
              top: `${(i * 13 + 10) % 100}%`,
              animation: `float ${3 + (i % 3)}s ease-in-out ${i * 0.3}s infinite alternate`,
              opacity: logoVisible ? 1 : 0,
              transition: "opacity 0.5s",
            }} />
          ))}
        </div>

        <div style={{
          transform: logoVisible ? "rotateY(0deg) scale(1)" : "rotateY(-90deg) scale(0.5)",
          opacity: logoVisible ? 1 : 0,
          transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.6s ease",
          transformStyle: "preserve-3d",
          filter: logoVisible ? "drop-shadow(0 0 32px rgba(220,38,38,0.25))" : "none",
        }}>
          <img
            src="/logo-chego.jpg"
            alt="Chegô"
            style={{ width: 220, height: 220, borderRadius: 40, objectFit: "contain" }}
          />
        </div>

        <p style={{
          color: "#9CA3AF", fontSize: 14, fontWeight: 600, marginTop: 24,
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

  // ── Slides ──────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "#f8fafc",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
      padding: "48px 24px 40px",
    }}>
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <img src="/logo-chego.jpg" alt="Chegô" style={{ height: 32, width: "auto", borderRadius: 8, objectFit: "contain" }} />
        <button onClick={concluir}
          style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Pular
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 24, maxWidth: 360 }}>
        <div style={{
          width: 120, height: 120, borderRadius: 36, background: s.bg,
          border: `2px solid ${s.color}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.4s",
        }}>
          {(() => { const Illu = SLIDE_ILLUSTRATIONS[slide]; return <Illu /> })()}
        </div>
        <div>
          <h1 style={{ color: "#111827", fontWeight: 900, fontSize: 28, lineHeight: 1.15, marginBottom: 12 }}>
            {s.title}
          </h1>
          <p style={{ color: "#6B7280", fontSize: 15, lineHeight: 1.65 }}>
            {s.sub}
          </p>
        </div>

        {isLast && (
          <div style={{ background: "#F9FAFB", border: "1px solid #e5e7eb", borderRadius: 16, padding: "16px 18px", width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ color: "#374151", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
              O app vai solicitar acesso a:
            </p>
            {[
              {
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                ),
                label: "Localização",
                desc: "Para preencher o endereço de entrega automaticamente",
              },
              {
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                ),
                label: "Notificações",
                desc: "Para avisar quando seu pedido sair para entrega",
              },
              {
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                  </svg>
                ),
                label: "Áudio",
                desc: "Para tocar sons de confirmação e entrega",
              },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flexShrink: 0, marginTop: 1 }}>{item.icon}</div>
                <div>
                  <p style={{ color: "#374151", fontWeight: 600, fontSize: 13 }}>{item.label}</p>
                  <p style={{ color: "#9CA3AF", fontSize: 12 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {SLIDES.map((_, i) => (
            <div key={i} onClick={() => setSlide(i)} style={{
              width: i === slide ? 24 : 8, height: 8, borderRadius: 4, cursor: "pointer",
              background: i === slide ? s.color : "#E5E7EB",
              transition: "all 0.3s",
            }} />
          ))}
        </div>
        <button onClick={next} disabled={loading} style={{
          width: "100%", padding: "16px", borderRadius: 14, border: "none",
          background: loading ? `${s.color}60` : s.color,
          color: "white", fontWeight: 800, fontSize: 16, cursor: loading ? "not-allowed" : "pointer",
          transition: "background 0.2s",
        }}>
          {loading ? "Configurando..." : isLast ? "Permitir e começar →" : "Continuar →"}
        </button>
      </div>
    </div>
  )
}
