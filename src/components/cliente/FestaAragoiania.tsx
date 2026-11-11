"use client"
// Aniversário de Aragoiânia, 68 anos (14/11/2026), junto com o frete grátis da semana
// (lib/freteGratisCampanha). "Sopre as velinhas": bolinho com as velas 6 e 8 acesas; cada toque
// apaga uma vela (fumaça + vibração); com as duas apagadas, confete cai pela tela e o cartão
// revela o frete grátis. O cartão inclina seguindo o dedo. Some sozinho no fim do frete grátis.
import { useEffect, useRef, useState } from "react"
import { freteGratisAtivo } from "@/lib/freteGratisCampanha"

const CORES = ["#D7261E", "#F5B700", "#1E8A4C", "#FFFFFF", "#B01D16", "#FFD54A"]

// Confete com física (gravidade, arrasto, giro) num canvas da tela inteira, só durante a festa
function soltarConfete(origens: { x: number; y: number }[]) {
  const c = document.createElement("canvas")
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = window.innerWidth, H = window.innerHeight
  c.width = W * dpr; c.height = H * dpr
  c.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999"
  document.body.appendChild(c)
  const g = c.getContext("2d")!
  g.scale(dpr, dpr)
  type P = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; cor: string; fase: number; redondo: boolean }
  const ps: P[] = []
  origens.forEach(o => {
    for (let i = 0; i < 70; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.9
      const vel = 7 + Math.random() * 9
      ps.push({ x: o.x, y: o.y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
        w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, cor: CORES[i % CORES.length], fase: Math.random() * 6, redondo: i % 5 === 0 })
    }
  })
  let ant = performance.now(), fim = ant + 4200
  const quadro = (t: number) => {
    const dt = Math.min(2.5, (t - ant) / 16.67); ant = t
    g.clearRect(0, 0, W, H)
    let vivos = 0
    for (const p of ps) {
      p.vx *= Math.pow(0.985, dt); p.vy = p.vy * Math.pow(0.985, dt) + 0.32 * dt
      p.x += (p.vx + Math.sin(t / 260 + p.fase) * 0.9) * dt; p.y += p.vy * dt; p.r += p.vr * dt
      if (p.y < H + 30) vivos++
      const alfa = Math.max(0, Math.min(1, (fim - t) / 700))
      g.save(); g.globalAlpha = alfa; g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.cor
      if (p.redondo) { g.beginPath(); g.arc(0, 0, p.w / 2, 0, Math.PI * 2); g.fill() }
      else g.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(t / 180 + p.fase)), p.w, p.h * Math.abs(Math.cos(t / 180 + p.fase)) + 1)
      g.restore()
    }
    if (vivos && t < fim) requestAnimationFrame(quadro); else c.remove()
  }
  requestAnimationFrame(quadro)
}

function Vela({ digito, x, acesa, onSoprar }: { digito: string; x: number; acesa: boolean; onSoprar: () => void }) {
  return (
    <g className={`f68-vela ${acesa ? "acesa" : "apagada"}`} transform={`translate(${x} 0)`}
      onClick={e => { e.stopPropagation(); if (acesa) onSoprar() }} style={{ cursor: acesa ? "pointer" : "default" }}>
      <rect x="-22" y="-6" width="44" height="100" fill="transparent" />
      <line x1="0" y1="24" x2="0" y2="40" stroke="#3D3A35" strokeWidth="2.2" strokeLinecap="round" />
      <g transform="translate(0 -4) scale(1.35)"><g className="f68-chama">
        <ellipse cx="0" cy="12" rx="13" ry="16" fill="url(#f68-brilho)" />
        <path d="M0 0 C 7 9, 8 15, 0 22 C -8 15, -7 9, 0 0 Z" fill="url(#f68-fogo)" />
        <path d="M0 9 C 3 13, 3 17, 0 20 C -3 17, -3 13, 0 9 Z" fill="#FFF7D6" />
      </g></g>
      <g className="f68-fumaca">
        <circle cx="0" cy="14" r="3" /><circle cx="3" cy="8" r="4" /><circle cx="-2" cy="1" r="5" />
      </g>
      <text x="0" y="86" textAnchor="middle" className="f68-digito" fill="url(#f68-listras)">{digito}</text>
    </g>
  )
}

export function FestaAragoiania({ onAbrir }: { onAbrir?: () => void }) {
  const [ativa, setAtiva] = useState(false)
  const [velas, setVelas] = useState([true, true])
  const [revelado, setRevelado] = useState(false)
  const calmo = useRef(false)
  const cartao = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  // inclinação com mola (alvo segue o dedo; o valor desenhado persegue o alvo)
  const alvo = useRef({ x: 0, y: 0 }), atual = useRef({ x: 0, y: 0 }), raf = useRef(0)

  useEffect(() => {
    if (!freteGratisAtivo()) return
    setAtiva(true)
    try { calmo.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches } catch {}
    try { if (sessionStorage.getItem("festa68") === "1") { setVelas([false, false]); setRevelado(true) } } catch {}
    return () => cancelAnimationFrame(raf.current)
  }, [])

  function animarInclinacao() {
    cancelAnimationFrame(raf.current)
    const passo = () => {
      const a = atual.current, t = alvo.current
      a.x += (t.x - a.x) * 0.14; a.y += (t.y - a.y) * 0.14
      if (cartao.current) cartao.current.style.transform = `perspective(700px) rotateX(${a.y}deg) rotateY(${a.x}deg)`
      if (Math.abs(t.x - a.x) > 0.02 || Math.abs(t.y - a.y) > 0.02) raf.current = requestAnimationFrame(passo)
    }
    raf.current = requestAnimationFrame(passo)
  }
  function mover(e: React.PointerEvent) {
    if (calmo.current || !cartao.current) return
    const r = cartao.current.getBoundingClientRect()
    alvo.current = { x: ((e.clientX - r.left) / r.width - 0.5) * 10, y: -((e.clientY - r.top) / r.height - 0.5) * 8 }
    animarInclinacao()
  }
  function soltar() { alvo.current = { x: 0, y: 0 }; animarInclinacao() }

  function soprar(i: number) {
    if (!velas[i]) return
    try { navigator.vibrate?.(i === 0 ? 18 : [18, 40, 28]) } catch {}
    const novas = velas.map((v, k) => k === i ? false : v)
    setVelas(novas)
    if (novas.every(v => !v)) {
      try { sessionStorage.setItem("festa68", "1") } catch {}
      const b = svg.current?.getBoundingClientRect()
      if (b && !calmo.current) {
        const esc = b.width / 150
        setTimeout(() => soltarConfete([{ x: b.left + 52 * esc, y: b.top + 18 * esc }, { x: b.left + 98 * esc, y: b.top + 18 * esc }]), 180)
      }
      setTimeout(() => { setRevelado(true); try { navigator.vibrate?.([30, 60, 30]) } catch {} }, calmo.current ? 0 : 380)
    }
  }
  function tocarCartao() {
    if (revelado) { onAbrir?.(); return }
    const i = velas.findIndex(v => v)
    if (i >= 0) soprar(i)
  }

  if (!ativa) return null
  return (
    <div className="festa68-palco">
      <div ref={cartao} role="button" tabIndex={0} className={`festa68 ${revelado ? "revelado" : ""}`}
        onClick={tocarCartao} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tocarCartao() } }}
        onPointerMove={mover} onPointerLeave={soltar} onPointerUp={soltar}
        aria-label={revelado ? "Aragoiânia 68 anos: frete grátis até 7 km até sábado às 23h. Ver lojas" : "Aragoiânia faz 68 anos. Toque para soprar as velinhas"}>
        <span className="f68-luz" aria-hidden="true" />
        <svg ref={svg} className="f68-bolo" viewBox="0 -12 150 144" aria-hidden="true">
          <defs>
            <radialGradient id="f68-fogo" cx="50%" cy="70%" r="60%"><stop offset="0" stopColor="#FFE27A" /><stop offset=".55" stopColor="#FF9F1C" /><stop offset="1" stopColor="#E8430C" /></radialGradient>
            <radialGradient id="f68-brilho"><stop offset="0" stopColor="#FFD54A" stopOpacity=".55" /><stop offset="1" stopColor="#FFD54A" stopOpacity="0" /></radialGradient>
            <pattern id="f68-listras" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <rect width="10" height="10" fill="#D7261E" /><rect width="4" height="10" fill="#FFFFFF" />
            </pattern>
          </defs>
          <Vela digito="6" x={52} acesa={velas[0]} onSoprar={() => soprar(0)} />
          <Vela digito="8" x={98} acesa={velas[1]} onSoprar={() => soprar(1)} />
          <path d="M14 96 h122 a8 8 0 0 1 8 8 v16 a8 8 0 0 1 -8 8 h-122 a8 8 0 0 1 -8 -8 v-16 a8 8 0 0 1 8 -8 Z" fill="#6B3A1E" />
          <path d="M10 100 q8 10 16 0 q8 10 16 0 q8 10 16 0 q8 10 16 0 q8 10 16 0 q8 10 16 0 q8 10 16 0 q8 10 14 0 v-4 h-128 Z" fill="#FFF6D6" />
          {[24, 46, 70, 94, 118].map((x, i) => <circle key={x} cx={x} cy={116} r="2.4" fill={CORES[i % 3]} />)}
        </svg>
        <span className="f68-txt" aria-live="polite">
          {!revelado ? (
            <span className="f68-fase" key="a">
              <small>Aragoiânia faz 68 anos</small>
              <b>Sopre as velinhas</b>
              <span>{velas.every(Boolean) ? "Toque em cada vela." : "Falta uma!"}</span>
            </span>
          ) : (
            <span className="f68-fase entra" key="b">
              <small>Parabéns, Aragoiânia!</small>
              <b>Frete grátis até 7 km</b>
              <span>Por nossa conta até sábado, 23h. Ver lojas ›</span>
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
