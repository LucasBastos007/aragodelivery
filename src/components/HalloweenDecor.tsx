"use client"

// Halloween 2026 (pedido do Lucas, 31/10). Some sozinho às 23h00 de Brasília (02:00 UTC de
// 01/11): depois disso não renderiza nada. Apagar este arquivo e os 3 usos depois do dia.
import { useEffect, useState } from "react"

const FIM = Date.parse("2026-11-01T02:00:00Z")

export function HalloweenDecor({ faixa = true }: { faixa?: boolean }) {
  const [ativo, setAtivo] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [lado, setLado] = useState(8)

  useEffect(() => {
    const conferir = () => setAtivo(Date.now() < FIM)
    conferir()
    const id = setInterval(conferir, 30000)
    return () => clearInterval(id)
  }, [])

  if (!ativo) return null

  async function copiar() {
    try { await navigator.clipboard.writeText("TRAVESSURAS"); setCopiado(true); setTimeout(() => setCopiado(false), 2500) } catch {}
  }

  return (
    <>
      <style>{`
        @keyframes hw-desce { 0%,6% { transform: translateY(-100%) } 32%,58% { transform: translateY(calc(-10vh - 150px)) } 36% { transform: translateY(calc(-10vh - 150px)) rotate(4deg) } 40% { transform: translateY(calc(-10vh - 150px)) rotate(-3deg) } 44% { transform: translateY(calc(-10vh - 150px)) rotate(0) } 86%,100% { transform: translateY(-100%) } }
        @keyframes hw-pula { 0%,70%,100% { transform: translateY(0) scale(1,1) } 74% { transform: translateY(0) scale(1.12,.86) } 82% { transform: translateY(-9px) scale(.94,1.06) } 90% { transform: translateY(0) scale(1.08,.92) } }
        @keyframes hw-voa { 0% { transform: translate(-80px, 0) } 25% { transform: translate(25vw, -26px) } 50% { transform: translate(50vw, 10px) } 75% { transform: translate(75vw, -18px) } 100% { transform: translate(calc(100vw + 80px), 4px) } }
        @keyframes hw-onda { 0% { opacity: .85 } 33.3%,100% { opacity: 0 } }
        @keyframes hw-asa { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(.55) } }
        @keyframes hw-fant { 0%,12% { opacity: 0; transform: translateY(24px) } 22%,48% { opacity: .92; transform: translateY(0) } 35% { transform: translateY(-10px) } 60%,100% { opacity: 0; transform: translateY(-30px) } }
        .hw-morcego { position: fixed; left: 0; z-index: 101; pointer-events: none; opacity: 0; animation: hw-voa 7s linear infinite, hw-onda 21s steps(1) infinite; }
        .hw-morcego svg { animation: hw-asa .32s ease-in-out infinite; transform-origin: 50% 40%; }
        .hw-fantasma { position: fixed; right: 18px; bottom: calc(env(safe-area-inset-bottom, 0px) + 160px); z-index: 98; pointer-events: none; animation: hw-fant 18s ease-in-out infinite; animation-delay: 4s; opacity: 0; }
        .hw-aranha { position: fixed; top: 0; z-index: 101; pointer-events: none; height: 110vh; width: 44px; display: flex; flex-direction: column; align-items: center; transform: translateY(-100%); transform-origin: 50% 0; animation: hw-desce 26s ease-in-out infinite; }
        .hw-abob { display: inline-block; animation: hw-pula 3.2s ease-in-out infinite; transform-origin: 50% 100%; }
        @media (prefers-reduced-motion: reduce) { .hw-aranha, .hw-morcego, .hw-fantasma { display: none } .hw-abob { animation: none } }
      `}</style>

      {faixa && (
        <div role="note" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          background: "#2B1740", color: "#fff", padding: "9px 14px",
          fontFamily: "var(--font-corpo), system-ui, sans-serif", fontSize: 13.5, lineHeight: 1.3,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span aria-hidden style={{ fontSize: 20, whiteSpace: "nowrap" }}>
              <span className="hw-abob">🎃</span><span className="hw-abob" style={{ animationDelay: "1.6s", fontSize: 15, marginLeft: 2 }}>🎃</span>
            </span>
            <span>Hoje é Halloween: use <b style={{ color: "#FF9A2E" }}>TRAVESSURAS</b> e ganhe 5% de desconto</span>
          </span>
          <button onClick={copiar} style={{ flexShrink: 0, border: "1px solid rgba(255,154,46,.7)", background: "transparent", color: "#FF9A2E", borderRadius: 999, padding: "5px 11px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
            {copiado ? "Copiado" : "Copiar cupom"}
          </button>
        </div>
      )}

      <div className="hw-morcego" aria-hidden style={{ top: "30vh" }}><svg width="56" height="21" viewBox="0 0 64 24"><g fill="#1b1b1b"><path d="M29 11 C22 3 10 1 1 6 C5 8 6 12 5 17 C9 13 13 14 15 19 C18 15 22 15 24 20 C26 16 28 16 29 19 Z"/><path d="M35 11 C42 3 54 1 63 6 C59 8 58 12 59 17 C55 13 51 14 49 19 C46 15 42 15 40 20 C38 16 36 16 35 19 Z"/><ellipse cx="32" cy="15" rx="4" ry="7"/><circle cx="32" cy="8" r="3.6"/><path d="M29.4 6 L29.8 1.5 L31.4 5 Z M34.6 6 L34.2 1.5 L32.6 5 Z"/></g></svg></div>
      <div className="hw-morcego" aria-hidden style={{ top: "40vh", animationDelay: ".9s, .9s" }}><svg width="42" height="16" viewBox="0 0 64 24"><g fill="#1b1b1b"><path d="M29 11 C22 3 10 1 1 6 C5 8 6 12 5 17 C9 13 13 14 15 19 C18 15 22 15 24 20 C26 16 28 16 29 19 Z"/><path d="M35 11 C42 3 54 1 63 6 C59 8 58 12 59 17 C55 13 51 14 49 19 C46 15 42 15 40 20 C38 16 36 16 35 19 Z"/><ellipse cx="32" cy="15" rx="4" ry="7"/><circle cx="32" cy="8" r="3.6"/><path d="M29.4 6 L29.8 1.5 L31.4 5 Z M34.6 6 L34.2 1.5 L32.6 5 Z"/></g></svg></div>
      <div className="hw-morcego" aria-hidden style={{ top: "24vh", animationDelay: "1.6s, 1.6s" }}><svg width="34" height="13" viewBox="0 0 64 24"><g fill="#1b1b1b"><path d="M29 11 C22 3 10 1 1 6 C5 8 6 12 5 17 C9 13 13 14 15 19 C18 15 22 15 24 20 C26 16 28 16 29 19 Z"/><path d="M35 11 C42 3 54 1 63 6 C59 8 58 12 59 17 C55 13 51 14 49 19 C46 15 42 15 40 20 C38 16 36 16 35 19 Z"/><ellipse cx="32" cy="15" rx="4" ry="7"/><circle cx="32" cy="8" r="3.6"/><path d="M29.4 6 L29.8 1.5 L31.4 5 Z M34.6 6 L34.2 1.5 L32.6 5 Z"/></g></svg></div>

      <div className="hw-fantasma" aria-hidden>
        <svg width="46" height="54" viewBox="0 0 46 54">
          <path d="M23 2C11 2 4 11 4 23v27l6-5 6 5 7-5 7 5 6-5 6 5V23C42 11 35 2 23 2z" fill="#fff" stroke="#d9d6e3" strokeWidth="1.5" />
          <ellipse cx="16.5" cy="22" rx="3" ry="4" fill="#2B1740" /><ellipse cx="29.5" cy="22" rx="3" ry="4" fill="#2B1740" />
          <ellipse cx="23" cy="32" rx="3.2" ry="2.4" fill="#2B1740" />
        </svg>
      </div>

      <div className="hw-aranha" aria-hidden style={{ left: `clamp(4px, calc(${lado}% - 22px), calc(100vw - 48px))` }}
        onAnimationIteration={() => setLado(l => (l < 50 ? 84 + Math.round(Math.random() * 8) : 4 + Math.round(Math.random() * 8)))}>
        <div style={{ flex: 1, width: 1.5, background: "rgba(80,80,80,.45)" }} />
        <svg width="44" height="44" viewBox="-22 -20 44 44" style={{ marginTop: -6 }}>
          <g fill="#1b1b1b">
            <ellipse cx="0" cy="5" rx="10" ry="12" />
            <circle cx="0" cy="-9" r="6.5" />
            <g stroke="#1b1b1b" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M-7 -3 L-17 -12 L-20 -4" /><path d="M-8 2 L-19 0 L-21 9" /><path d="M-8 7 L-17 12 L-17 21" /><path d="M-6 11 L-12 18 L-10 23" />
              <path d="M7 -3 L17 -12 L20 -4" /><path d="M8 2 L19 0 L21 9" /><path d="M8 7 L17 12 L17 21" /><path d="M6 11 L12 18 L10 23" />
            </g>
            <circle cx="-2.4" cy="-10" r="1.6" fill="#fff" /><circle cx="2.4" cy="-10" r="1.6" fill="#fff" />
          </g>
        </svg>
      </div>
    </>
  )
}
