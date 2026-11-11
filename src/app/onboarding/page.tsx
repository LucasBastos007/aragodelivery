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
// Boas-vindas do layout novo (19/10/2026): arte do próprio Chegô (sem loja em destaque),
// "Bateu a fome? O Chegô leva." e 3 benefícios. A lógica continua a mesma de antes:
// pede notificação e localização, marca arago_onboarded e segue pro app.
export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function solicitarPermissoes(destino: string) {
    if (loading) return
    setLoading(true)
    unlockAudio()
    if ("Notification" in window) {
      try { await Notification.requestPermission() } catch {}
    }
    const ir = () => concluir(destino)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(ir, ir, { timeout: 8000 })
    } else {
      ir()
    }
  }

  function concluir(destino: string) {
    localStorage.setItem("arago_onboarded", "1")
    router.push(destino)
  }

  return (
    <div className="bv">
      <div className="bv-arte" aria-hidden="true">
        <svg className="bv-mapa" viewBox="0 0 390 380" preserveAspectRatio="xMidYMax slice">
          <defs><radialGradient id="bvg" cx="70%" cy="25%" r="90%"><stop offset="0" stopColor="#E8392F" /><stop offset="1" stopColor="#A9180F" /></radialGradient></defs>
          <rect width="390" height="380" fill="url(#bvg)" />
          <g fill="rgba(255,255,255,.06)">
            <rect x="18" y="120" width="70" height="52" rx="8" /><rect x="104" y="120" width="96" height="52" rx="8" /><rect x="216" y="120" width="60" height="52" rx="8" /><rect x="292" y="120" width="90" height="52" rx="8" />
            <rect x="18" y="190" width="120" height="64" rx="8" /><rect x="154" y="190" width="70" height="64" rx="8" /><rect x="240" y="190" width="142" height="64" rx="8" />
            <rect x="18" y="272" width="80" height="70" rx="8" /><rect x="114" y="272" width="110" height="70" rx="8" /><rect x="240" y="272" width="64" height="70" rx="8" /><rect x="320" y="272" width="62" height="70" rx="8" />
          </g>
          <path id="bvrota" d="M56 312 C 56 262, 146 262, 146 228 S 232 182, 232 181 S 340 176, 330 128" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 11" />
          <g transform="translate(56 312)"><circle r="19" fill="#fff" /><path d="M-8-4h16l-1.6 13h-12.8z" fill="#D7261E" /><path d="M-4.5-4v-2.5a4.5 4.5 0 0 1 9 0V-4" fill="none" stroke="#D7261E" strokeWidth="2.2" /></g>
          <g transform="translate(330 118)"><path d="M0 22C-14 6-20-2-20-10a20 20 0 0 1 40 0c0 8-6 16-20 32z" fill="#fff" /><path d="M-8-8l8-7 8 7v9h-16z" fill="#D7261E" /></g>
          <g><circle r="20" fill="#22201C" /><text y="7" textAnchor="middle" fontSize="20" transform="scale(-1 1)">🛵</text>
            <animateMotion dur="5.5s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;.82;1" calcMode="linear"><mpath href="#bvrota" /></animateMotion></g>
        </svg>
        <span className="bv-logo"><img src="/logo-chego-transparente.png" alt="Chegô" /></span>
        <div className="bv-card c1"><i className="ok">✓</i><span><b>Pix aprovado</b><small>na hora, direto no app</small></span></div>
        <div className="bv-card c2"><i>🛵</i><span><b>Saiu para entrega</b><small>chega em 12 min</small></span></div>
        <div className="bv-card c3"><i className="est">★</i><span><b>4,9</b><small>entregador da sua cidade</small></span></div>
      </div>
      <div className="bv-corpo">
        <h1>Bateu a fome?<br />O Chegô leva.</h1>
        <p className="bv-sub">Lojas de Aragoiânia e Guapó, com entregador da sua cidade.</p>
        <ul className="bv-lista">
          <li><span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D7261E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.8" /><path d="M6 9v.01M18 15v.01" /></svg></span>Pague no Pix, cartão ou dinheiro, até em 2 formas</li>
          <li><span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D7261E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg></span>Acompanhe a moto até a sua porta</li>
          <li><span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D7261E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></svg></span>Ajuda pelo chat do suporte</li>
        </ul>
        <button className="bv-btn" disabled={loading} onClick={() => solicitarPermissoes("/cliente/entrar")}>{loading ? "Só um instante…" : "Entrar ou criar conta"}</button>
        <button className="bv-link" disabled={loading} onClick={() => solicitarPermissoes("/")}>Ver as lojas sem entrar</button>
        <p className="bv-nota">Vamos pedir pra te mandar avisos do pedido e usar sua localização pra achar as lojas perto.</p>
      </div>
      <style>{CSS_BV}</style>
    </div>
  )
}

const CSS_BV = `
.bv{min-height:100dvh;background:#fff;display:flex;flex-direction:column;font-family:var(--font-corpo),system-ui,sans-serif}
.bv-arte{position:relative;height:46vh;min-height:300px;overflow:hidden;background:#B01D16}
.bv-mapa{position:absolute;inset:0;width:100%;height:100%}
.bv-logo{position:absolute;left:16px;top:calc(env(safe-area-inset-top,0px) + 14px);z-index:2;background:#fff;border-radius:16px;padding:6px 12px;box-shadow:0 8px 20px rgba(0,0,0,.2)}
.bv-logo img{width:96px;display:block}
.bv-card{position:absolute;z-index:2;display:flex;gap:10px;align-items:center;background:#fff;border-radius:14px;padding:9px 12px 9px 9px;box-shadow:0 12px 28px rgba(0,0,0,.25);font-size:12px;color:#3D3A35;animation:bvsobe .5s both,bvboia 4s ease-in-out infinite}
.bv-card b{display:block;font-size:13.5px;color:#22201C;font-weight:800}
.bv-card small{color:#77736B;font-size:11.5px}
.bv-card i{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;font-style:normal;font-size:17px;background:#FDECEB;flex-shrink:0}
.bv-card i.ok{background:#1E8A4C;color:#fff;font-weight:800;font-size:16px}
.bv-card i.est{background:#FFF6D6;color:#E8A400}
.bv-card.c1{left:14px;bottom:min(190px,calc(100% - 190px - env(safe-area-inset-top,0px)));animation-delay:.3s,.8s}
.bv-card.c2{right:12px;bottom:128px;animation-delay:.6s,1.6s}
.bv-card.c3{left:96px;bottom:44px;animation-delay:.9s,2.4s}
@keyframes bvsobe{from{transform:translateY(12px);opacity:0}}
@keyframes bvboia{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@media (max-height:700px){.bv-card.c3{display:none}.bv-card.c2{bottom:46px}}
.bv-corpo{flex:1;margin-top:-26px;position:relative;z-index:3;background:#fff;border-radius:26px 26px 0 0;padding:24px 22px calc(env(safe-area-inset-bottom,0px) + 24px);max-width:520px;width:100%;align-self:center}
.bv-corpo h1{font-family:var(--font-display),system-ui,sans-serif;font-weight:800;font-size:28px;line-height:1.08;color:#22201C;letter-spacing:-.02em;margin:0}
.bv-sub{color:#77736B;margin:8px 0 16px;font-size:15px}
.bv-lista{list-style:none;margin:0 0 20px;padding:0;display:flex;flex-direction:column;gap:10px}
.bv-lista li{display:flex;gap:12px;align-items:center;font-size:15px;color:#3D3A35}
.bv-lista span{width:36px;height:36px;border-radius:10px;background:#FDECEB;display:grid;place-items:center;flex-shrink:0}
.bv-btn{width:100%;height:54px;border-radius:16px;border:0;background:#D7261E;color:#fff;font-weight:700;font-size:16px;cursor:pointer}
.bv-btn:disabled{opacity:.7}
.bv-link{display:block;width:100%;margin-top:10px;height:46px;border:0;background:none;color:#D7261E;font-weight:700;font-size:15px;cursor:pointer}
.bv-nota{font-size:12px;color:#9A968E;text-align:center;margin-top:8px}
`
