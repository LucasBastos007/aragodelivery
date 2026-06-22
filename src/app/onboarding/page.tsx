"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

// ─── Slide data ───────────────────────────────────────────────────────────────
const SLIDES = [
  {
    title: "O delivery chegou\nem Aragoiânia!",
    sub: "Peça da sua loja favorita com poucos cliques e receba em casa rapidinho.",
    grad: ["#c2410c", "#dc2626", "#991b1b"],
    accent: "#ff6b35",
    particle: "#ff9f7a",
  },
  {
    title: "Acompanhe\nem tempo real",
    sub: "Veja cada etapa do seu pedido — da loja até a sua porta, com rastreamento ao vivo.",
    grad: ["#1d4ed8", "#2563eb", "#1e3a8a"],
    accent: "#60a5fa",
    particle: "#93c5fd",
  },
  {
    title: "Rápido, fácil\ne seguro",
    sub: "Pague como preferir: PIX, cartão, Apple Pay ou Google Pay. Receba em casa ou retire na loja.",
    grad: ["#059669", "#10b981", "#065f46"],
    accent: "#34d399",
    particle: "#6ee7b7",
  },
]

// ─── Illustrations ────────────────────────────────────────────────────────────
function IlluDelivery({ accent }: { accent: string }) {
  return (
    <svg width="260" height="200" viewBox="0 0 260 200" fill="none">
      <style>{`
        @keyframes drive { 0%,100%{transform:translateX(0)} 50%{transform:translateX(6px)} }
        @keyframes wheel { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes speedLine { 0%{opacity:0;transform:translateX(10px)} 50%{opacity:1} 100%{opacity:0;transform:translateX(-20px)} }
        @keyframes bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.1)} }
      `}</style>

      {/* Fundo estrada */}
      <rect x="0" y="155" width="260" height="8" rx="2" fill="rgba(255,255,255,0.15)"/>
      <rect x="20" y="157" width="30" height="3" rx="1" fill="rgba(255,255,255,0.4)"/>
      <rect x="70" y="157" width="30" height="3" rx="1" fill="rgba(255,255,255,0.4)"/>
      <rect x="120" y="157" width="30" height="3" rx="1" fill="rgba(255,255,255,0.4)"/>
      <rect x="170" y="157" width="30" height="3" rx="1" fill="rgba(255,255,255,0.4)"/>
      <rect x="220" y="157" width="30" height="3" rx="1" fill="rgba(255,255,255,0.4)"/>

      {/* Sombra moto */}
      <ellipse cx="140" cy="160" rx="55" ry="6" fill="rgba(0,0,0,0.25)" style={{animation:"pulse 1.4s ease-in-out infinite"}}/>

      {/* Grupo moto - animação */}
      <g style={{animation:"drive 1.4s ease-in-out infinite", transformOrigin:"140px 140px"}}>
        {/* Caixa de entrega */}
        <rect x="110" y="72" width="44" height="34" rx="6" fill="white" opacity="0.95"/>
        <rect x="110" y="72" width="44" height="34" rx="6" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
        <line x1="132" y1="72" x2="132" y2="106" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5"/>
        <rect x="122" y="79" width="20" height="10" rx="3" fill={accent} opacity="0.8"/>
        <text x="132" y="89" textAnchor="middle" fontSize="7" fontWeight="800" fill="white">CHEGÔ</text>
        {/* Alça caixa */}
        <path d="M122 72 Q132 66 142 72" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>

        {/* Corpo moto */}
        <path d="M86 118 Q95 100 115 103 L155 103 Q172 103 174 112 L174 130 Q174 138 164 138 L96 138 Q86 138 86 130 Z" fill="rgba(255,255,255,0.95)"/>
        {/* Detalhe cor no corpo */}
        <path d="M100 118 Q108 108 120 108 L150 108 Q162 108 164 116 L164 125 Q164 130 158 130 L106 130 Q100 130 100 124 Z" fill={accent} opacity="0.3"/>

        {/* Selim */}
        <rect x="118" y="94" width="36" height="12" rx="6" fill="rgba(255,255,255,0.9)"/>
        {/* Guidão */}
        <path d="M162 90 L162 104" stroke="rgba(255,255,255,0.8)" strokeWidth="4" strokeLinecap="round"/>
        <path d="M156 90 L168 90" stroke="rgba(255,255,255,0.7)" strokeWidth="3" strokeLinecap="round"/>

        {/* Motoboy */}
        <circle cx="145" cy="82" r="10" fill="rgba(255,255,255,0.95)"/>
        {/* Capacete */}
        <path d="M136 80 Q136 68 145 68 Q154 68 154 80 Z" fill={accent}/>
        <path d="M136 80 Q138 84 145 84 Q152 84 154 80" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none"/>
        {/* Visor */}
        <path d="M138 76 Q145 72 152 76" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>

        {/* Roda traseira */}
        <g style={{transformOrigin:"104px 145px", animation:"wheel 0.5s linear infinite"}}>
          <circle cx="104" cy="145" r="18" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.9)" strokeWidth="3"/>
          <circle cx="104" cy="145" r="10" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.6)" strokeWidth="2"/>
          <circle cx="104" cy="145" r="3" fill="rgba(255,255,255,0.9)"/>
          <line x1="104" y1="132" x2="104" y2="158" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
          <line x1="91" y1="145" x2="117" y2="145" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
        </g>
        {/* Roda dianteira */}
        <g style={{transformOrigin:"168px 145px", animation:"wheel 0.5s linear infinite"}}>
          <circle cx="168" cy="145" r="18" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.9)" strokeWidth="3"/>
          <circle cx="168" cy="145" r="10" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.6)" strokeWidth="2"/>
          <circle cx="168" cy="145" r="3" fill="rgba(255,255,255,0.9)"/>
          <line x1="168" y1="132" x2="168" y2="158" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
          <line x1="155" y1="145" x2="181" y2="145" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
        </g>
      </g>

      {/* Linhas de velocidade */}
      {[0,1,2,3].map(i => (
        <line key={i} x1={60 - i*14} y1={100 + i*12} x2={28 - i*14} y2={100 + i*12}
          stroke="rgba(255,255,255,0.6)" strokeWidth={2.5 - i*0.4} strokeLinecap="round"
          style={{animation:`speedLine ${0.9 + i*0.15}s ease-in-out ${i*0.1}s infinite`}}/>
      ))}
    </svg>
  )
}

function IlluTracking({ accent }: { accent: string }) {
  return (
    <svg width="220" height="220" viewBox="0 0 220 220" fill="none">
      <style>{`
        @keyframes ping {0%{opacity:0.8;transform:scale(1)} 100%{opacity:0;transform:scale(2.5)}}
        @keyframes dash {0%{stroke-dashoffset:80} 100%{stroke-dashoffset:0}}
        @keyframes glow {0%,100%{opacity:0.4} 50%{opacity:1}}
        @keyframes scoot {0%,100%{transform:translateX(0) translateY(0)} 50%{transform:translateX(6px) translateY(-3px)}}
      `}</style>

      {/* Telefone */}
      <rect x="55" y="20" width="110" height="175" rx="18" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
      <rect x="60" y="26" width="100" height="163" rx="14" fill="rgba(255,255,255,0.12)"/>

      {/* Mapa */}
      <rect x="64" y="32" width="92" height="118" rx="10" fill="rgba(255,255,255,0.9)"/>
      {/* Grid mapa */}
      {[50,66,82,98,114].map(y => <line key={y} x1="64" y1={y} x2="156" y2={y} stroke={accent} strokeWidth="0.8" opacity="0.3"/>)}
      {[80,96,112,128,144].map(x => <line key={x} x1={x} y1="32" x2={x} y2="150" stroke={accent} strokeWidth="0.8" opacity="0.3"/>)}

      {/* Blocos de quarteirão */}
      {[[68,36,22,18],[96,36,18,18],[68,58,18,22],[102,58,22,18],[68,84,14,16],[90,84,20,16],[116,84,16,16],[68,104,28,14],[102,104,18,14],[124,60,22,22]].map(([x,y,w,h],i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="3" fill={accent} opacity="0.18"/>
      ))}

      {/* Rota tracejada */}
      <path d="M88 138 Q88 118 100 110 Q112 102 112 86 Q112 70 108 60"
        stroke={accent} strokeWidth="3" strokeDasharray="6 4" strokeLinecap="round" fill="none"
        style={{animation:"dash 2s linear infinite"}}/>

      {/* Pin destino (animado) */}
      <circle cx="108" cy="55" r="18" fill={accent} opacity="0.2" style={{animation:"ping 1.5s ease-out infinite"}}/>
      <path d="M108 40 C108 34 116 34 116 40 C116 48 108 56 108 56 C108 56 100 48 100 40 C100 34 108 34 108 40Z" fill="white"/>
      <circle cx="108" cy="40" r="4" fill={accent}/>

      {/* Motoboy no mapa */}
      <g style={{animation:"scoot 1.5s ease-in-out infinite", transformOrigin:"88px 138px"}}>
        <circle cx="88" cy="138" r="8" fill={accent}/>
        <circle cx="88" cy="138" r="12" fill={accent} opacity="0.25" style={{animation:"ping 1.5s ease-out infinite"}}/>
        <text x="88" y="141" textAnchor="middle" fontSize="8">🛵</text>
      </g>

      {/* Barra inferior do telefone */}
      <rect x="64" y="155" width="92" height="28" rx="4" fill="rgba(255,255,255,0.15)"/>
      <rect x="72" y="160" width="40" height="6" rx="3" fill="rgba(255,255,255,0.5)"/>
      <rect x="72" y="170" width="28" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>
      <rect x="120" y="159" width="30" height="16" rx="5" fill={accent} opacity="0.8"/>
      <text x="135" y="170" textAnchor="middle" fontSize="7" fontWeight="800" fill="white">LIVE</text>

      {/* Notch */}
      <rect x="92" y="21" width="36" height="8" rx="4" fill="rgba(0,0,0,0.3)"/>

      {/* Ondas de sinal */}
      {[1,2,3].map(i => (
        <path key={i} d={`M${165+i*8} ${90-i*10} Q${170+i*8} 110 ${165+i*8} ${130+i*10}`}
          stroke="rgba(255,255,255,0.5)" strokeWidth="2" fill="none" strokeLinecap="round"
          style={{animation:`glow 1.5s ease-in-out ${i*0.3}s infinite`}}/>
      ))}
    </svg>
  )
}

function IlluPayment({ accent }: { accent: string }) {
  return (
    <svg width="240" height="200" viewBox="0 0 240 200" fill="none">
      <style>{`
        @keyframes cardFan {0%,100%{transform:rotate(0deg) translateY(0)} 50%{transform:rotate(-2deg) translateY(-4px)}}
        @keyframes checkPop {0%{transform:scale(0);opacity:0} 60%{transform:scale(1.2)} 100%{transform:scale(1);opacity:1}}
        @keyframes coinFloat {0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-8px) rotate(10deg)}}
      `}</style>

      {/* Cartão 3 - atrás */}
      <g style={{transformOrigin:"120px 120px", animation:"cardFan 3s ease-in-out 0.4s infinite"}}>
        <rect x="40" y="85" width="160" height="100" rx="14" fill="rgba(255,255,255,0.2)" transform="rotate(-8 40 85)"/>
      </g>
      {/* Cartão 2 - meio */}
      <g style={{transformOrigin:"120px 120px", animation:"cardFan 3s ease-in-out 0.2s infinite"}}>
        <rect x="44" y="80" width="160" height="100" rx="14" fill="rgba(255,255,255,0.35)" transform="rotate(-3 44 80)"/>
      </g>
      {/* Cartão 1 - frente */}
      <g style={{transformOrigin:"120px 120px", animation:"cardFan 3s ease-in-out infinite"}}>
        <rect x="36" y="75" width="168" height="105" rx="14" fill="rgba(255,255,255,0.95)"/>
        <rect x="36" y="96" width="168" height="18" fill={accent} opacity="0.2"/>
        {/* Chip */}
        <rect x="52" y="102" width="28" height="20" rx="4" fill={accent} opacity="0.7"/>
        <line x1="60" y1="102" x2="60" y2="122" stroke="rgba(255,255,255,0.6)" strokeWidth="1"/>
        <line x1="68" y1="102" x2="68" y2="122" stroke="rgba(255,255,255,0.6)" strokeWidth="1"/>
        <line x1="52" y1="112" x2="80" y2="112" stroke="rgba(255,255,255,0.6)" strokeWidth="1"/>
        {/* Número */}
        {[0,1,2,3].map(i => (
          <g key={i}>
            {i < 3
              ? [0,1,2,3].map(j => <circle key={j} cx={54 + i*40 + j*8} cy="148" r="3" fill={accent} opacity="0.5"/>)
              : <text key="num" x={54 + i*40} y="152" fontSize="11" fontWeight="700" fill={accent} opacity="0.8">4231</text>
            }
          </g>
        ))}
        {/* Contactless */}
        <path d="M155 86 Q162 90 162 96 Q162 102 155 106" stroke={accent} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8"/>
        <path d="M160 83 Q170 90 170 96 Q170 102 160 109" stroke={accent} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5"/>
        {/* Logo Visa-like */}
        <text x="178" y="170" fontSize="10" fontWeight="900" fill={accent} textAnchor="end" opacity="0.6">VISA</text>
      </g>

      {/* Check de confirmação */}
      <g style={{animation:"checkPop 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.5s both"}}>
        <circle cx="172" cy="55" r="28" fill="rgba(255,255,255,0.95)"/>
        <circle cx="172" cy="55" r="24" fill={accent} opacity="0.15"/>
        <path d="M160 55 L168 63 L184 44" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      </g>

      {/* PIX icon */}
      <g style={{animation:"coinFloat 2.5s ease-in-out infinite"}}>
        <circle cx="50" cy="40" r="20" fill="rgba(255,255,255,0.9)"/>
        <text x="50" y="47" textAnchor="middle" fontSize="18">💠</text>
      </g>

      {/* Apple Pay */}
      <g style={{animation:"coinFloat 2.5s ease-in-out 0.8s infinite"}}>
        <rect x="180" y="20" width="50" height="28" rx="8" fill="rgba(255,255,255,0.9)"/>
        <text x="205" y="38" textAnchor="middle" fontSize="10" fontWeight="700" fill="#1D1D1F"> Pay</text>
      </g>
    </svg>
  )
}

const ILLUSTRATIONS = [IlluDelivery, IlluTracking, IlluPayment]

// ─── Utils ────────────────────────────────────────────────────────────────────
function unlockAudio() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, ctx.currentTime)
    const o = ctx.createOscillator()
    o.connect(g); g.connect(ctx.destination)
    o.start(); o.stop(ctx.currentTime + 0.01)
  } catch {}
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router  = useRouter()
  const [phase, setPhase] = useState<"intro" | "slides">("intro")
  const [logoVisible, setLogoVisible] = useState(false)
  const [slide, setSlide] = useState(0)
  const [dir,   setDir]   = useState<"left" | "right">("left")
  const [animating, setAnimating] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [btnPress,  setBtnPress]  = useState(false)
  const touchStart  = useRef<number | null>(null)

  const s    = SLIDES[slide]
  const isLast = slide === SLIDES.length - 1
  const Illu = ILLUSTRATIONS[slide]

  useEffect(() => {
    const t1 = setTimeout(() => setLogoVisible(true), 300)
    const t2 = setTimeout(() => setPhase("slides"), 2800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  function goTo(next: number) {
    if (animating || next < 0 || next >= SLIDES.length) return
    setDir(next > slide ? "left" : "right")
    setAnimating(true)
    setTimeout(() => { setSlide(next); setAnimating(false) }, 300)
  }

  function next() {
    if (isLast) { solicitarPermissoes(); return }
    goTo(slide + 1)
  }

  async function solicitarPermissoes() {
    setLoading(true)
    unlockAudio()
    if ("Notification" in window) {
      try { await Notification.requestPermission() } catch {}
    }
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

  // ── Intro ───────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${SLIDES[0].grad[0]}, ${SLIDES[0].grad[1]}, ${SLIDES[0].grad[2]})`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        overflow: "hidden", position: "relative",
      }}>
        {/* Círculos decorativos */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "-10%", right: "-10%", width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }}/>
          <div style={{ position: "absolute", bottom: "-5%", left: "-15%", width: 400, height: 400, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }}/>
          <div style={{ position: "absolute", top: "40%", left: "-5%", width: 150, height: 150, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }}/>
        </div>

        {/* Partículas */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: 5 + (i % 3) * 3, height: 5 + (i % 3) * 3,
            borderRadius: "50%", background: "rgba(255,255,255,0.3)",
            left: `${10 + i * 9}%`, top: `${15 + (i * 17) % 70}%`,
            opacity: logoVisible ? 1 : 0,
            animation: `floatP ${2.5 + (i % 3) * 0.5}s ease-in-out ${i * 0.2}s infinite alternate`,
            transition: "opacity 0.5s",
          }}/>
        ))}

        {/* Logo */}
        <div style={{
          transform: logoVisible ? "scale(1) translateY(0)" : "scale(0.3) translateY(40px)",
          opacity: logoVisible ? 1 : 0,
          transition: "all 0.8s cubic-bezier(0.34,1.56,0.64,1)",
          filter: logoVisible ? "drop-shadow(0 20px 60px rgba(0,0,0,0.35))" : "none",
        }}>
          <img src="/logo-chego.jpg" alt="Chegô" style={{ width: 180, height: 180, borderRadius: 40, objectFit: "contain", display: "block" }}/>
        </div>

        <p style={{
          color: "rgba(255,255,255,0.9)", fontSize: 22, fontWeight: 800, marginTop: 28, letterSpacing: "-0.3px",
          opacity: logoVisible ? 1 : 0,
          transform: logoVisible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.6s ease 0.4s",
        }}>
          Chegô Delivery
        </p>
        <p style={{
          color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 600, marginTop: 6, letterSpacing: 3, textTransform: "uppercase",
          opacity: logoVisible ? 1 : 0,
          transform: logoVisible ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.6s ease 0.55s",
        }}>
          Aragoiânia · GO
        </p>

        <style>{`
          @keyframes floatP {
            from { transform: translateY(0) rotate(0deg); }
            to   { transform: translateY(-18px) rotate(180deg); }
          }
        `}</style>
      </div>
    )
  }

  // ── Slides ──────────────────────────────────────────────────────────────────
  const grad = `linear-gradient(160deg, ${s.grad[0]}, ${s.grad[1]} 55%, ${s.grad[2]})`

  return (
    <div style={{
      minHeight: "100vh", background: grad, transition: "background 0.5s ease",
      display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}
      onTouchStart={e => { touchStart.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchStart.current === null) return
        const dx = e.changedTouches[0].clientX - touchStart.current
        if (Math.abs(dx) > 50) { dx < 0 ? goTo(slide + 1) : goTo(slide - 1) }
        touchStart.current = null
      }}
    >
      {/* Decoração de fundo */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-20%", right: "-20%", width: 450, height: 450, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }}/>
        <div style={{ position: "absolute", bottom: "-10%", left: "-20%", width: 500, height: 500, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }}/>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute", borderRadius: "50%",
            width: 4 + (i % 3) * 3, height: 4 + (i % 3) * 3,
            background: "rgba(255,255,255,0.25)",
            left: `${8 + i * 15}%`, top: `${20 + (i * 12) % 55}%`,
            animation: `floatP ${2 + i * 0.4}s ease-in-out ${i * 0.3}s infinite alternate`,
          }}/>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "52px 28px 0", position: "relative", zIndex: 10 }}>
        <img src="/logo-chego.jpg" alt="Chegô" style={{ height: 36, width: 36, borderRadius: 10, objectFit: "contain" }}/>
        <button onClick={concluir} style={{
          background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)",
          color: "white", fontSize: 13, fontWeight: 700, padding: "6px 16px", borderRadius: 99,
          cursor: "pointer", backdropFilter: "blur(8px)",
        }}>
          Pular
        </button>
      </div>

      {/* Ilustração */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 20px 0", position: "relative", zIndex: 10,
        transform: animating ? (dir === "left" ? "translateX(-40px)" : "translateX(40px)") : "translateX(0)",
        opacity: animating ? 0 : 1,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}>
        <Illu accent={s.accent} />
      </div>

      {/* Card de conteúdo */}
      <div style={{
        margin: "0 0", padding: "32px 28px 40px",
        background: "rgba(255,255,255,0.12)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.2)",
        borderRadius: "32px 32px 0 0",
        position: "relative", zIndex: 10,
        transform: animating ? "translateY(16px)" : "translateY(0)",
        opacity: animating ? 0 : 1,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.05s",
      }}>
        {/* Título */}
        <h1 style={{
          color: "white", fontWeight: 900, fontSize: 28, lineHeight: 1.2,
          letterSpacing: "-0.5px", marginBottom: 10, whiteSpace: "pre-line",
        }}>
          {s.title}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>
          {s.sub}
        </p>

        {/* Card de permissões (último slide) */}
        {isLast && (
          <div style={{
            background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 18, padding: "14px 16px", marginBottom: 24,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <p style={{ color: "rgba(255,255,255,0.9)", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
              O app vai solicitar
            </p>
            {[
              { emoji: "📍", label: "Localização", desc: "Para preencher o endereço automaticamente" },
              { emoji: "🔔", label: "Notificações", desc: "Para avisar quando o pedido sair para entrega" },
              { emoji: "🔊", label: "Áudio",        desc: "Para tocar sons de confirmação" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 20 }}>{item.emoji}</span>
                <div>
                  <p style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{item.label}</p>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dots */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, alignItems: "center" }}>
          {SLIDES.map((_, i) => (
            <div key={i} onClick={() => goTo(i)} style={{
              height: 6, borderRadius: 3, cursor: "pointer",
              width: i === slide ? 24 : 6,
              background: i === slide ? "white" : "rgba(255,255,255,0.35)",
              transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            }}/>
          ))}
        </div>

        {/* Botão */}
        <button
          onClick={() => { if (!loading && !animating) { setBtnPress(true); setTimeout(() => setBtnPress(false), 150); next() } }}
          disabled={loading}
          style={{
            width: "100%", padding: "17px", borderRadius: 16, border: "none",
            background: loading ? "rgba(255,255,255,0.4)" : "white",
            color: loading ? "rgba(255,255,255,0.7)" : s.grad[0],
            fontWeight: 900, fontSize: 16, cursor: loading ? "not-allowed" : "pointer",
            boxShadow: btnPress ? "none" : "0 8px 32px rgba(0,0,0,0.2)",
            transform: btnPress ? "scale(0.97)" : "scale(1)",
            transition: "all 0.15s cubic-bezier(0.34,1.56,0.64,1)",
            letterSpacing: "-0.2px",
          }}
        >
          {loading ? "Configurando..." : isLast ? "Permitir e começar →" : "Continuar →"}
        </button>
      </div>

      <style>{`
        @keyframes floatP {
          from { transform: translateY(0) rotate(0deg); }
          to   { transform: translateY(-16px) rotate(180deg); }
        }
      `}</style>
    </div>
  )
}
