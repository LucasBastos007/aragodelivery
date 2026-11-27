"use client"
// Black Friday Chegô (27/11/2026): selo "verificado" preto com o azul do Chegô (vai ao lado do nome
// da loja participante) e o banner único da home — vivo: luz passando, contagem até meia-noite e a
// fileira das logos das lojas participantes correndo (toque abre a loja).
import Link from "next/link"
import { useEffect, useState } from "react"
import { BLACK_FIM } from "@/lib/blackFriday"

/** Selo de verificado da Black Chegô (estrela de 12 pontas preta, borda azul, check branco). */
export function SeloBlack({ tam = 17 }: { tam?: number }) {
  // estrela "recortada" igual a selo de verificado
  const pts: string[] = []
  for (let i = 0; i < 24; i++) {
    const a = (Math.PI * 2 * i) / 24 - Math.PI / 2, r = i % 2 ? 10.3 : 12
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`)
  }
  return (
    <span className="selo-black-ver" role="img" aria-label="Loja na Black Chegô" title="Black Chegô: loja com desconto hoje">
      <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden>
        <defs>
          <linearGradient id="sbk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2A2A2E" /><stop offset=".55" stopColor="#0A0A0A" /><stop offset="1" stopColor="#000" /></linearGradient>
        </defs>
        <polygon points={pts.join(" ")} fill="url(#sbk)" stroke="#1E66F5" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M7.4 12.3l3 3 6.2-6.4" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function falta(): string {
  const ms = Math.max(0, new Date(BLACK_FIM).getTime() - Date.now())
  const h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4), s = Math.floor((ms % 6e4) / 1e3)
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":")
}

/** Banner único da Black na home (no lugar das 3 artes). */
export function BannerBlack({ lojas, onVerLojas }: { lojas: { id: string; nome: string; logo_url?: string | null }[]; onVerLojas: () => void }) {
  const [t, setT] = useState(falta)
  useEffect(() => { const id = setInterval(() => setT(falta()), 1000); return () => clearInterval(id) }, [])
  const comLogo = lojas.filter(l => l.logo_url)
  const fila = comLogo.length ? [...comLogo, ...comLogo] : []
  return (
    <section className="bk-banner" aria-label="Black Chegô: 20% de desconto nas lojas participantes, hoje até meia-noite">
      <div className="bk-luz" aria-hidden />
      <div className="bk-topo">
        <img className="bk-logo" src="/logo-chego-transparente.png" alt="Chegô" />
        <span className="bk-tempo" aria-live="off">termina em <b className="num">{t}</b></span>
      </div>
      <button className="bk-meio" onClick={onVerLojas}>
        <span className="bk-titulo"><span className="bk-black">BLACK</span> CHEGÔ <SeloBlack tam={22} /></span>
        <span className="bk-off"><b>20%</b><span>OFF<small>sem cupom</small></span></span>
      </button>
      {fila.length > 0 && (
        <div className="bk-fila" aria-label="Lojas participantes">
          <div className="bk-trilho" style={{ animationDuration: `${Math.max(18, comLogo.length * 3)}s` }}>
            {fila.map((l, i) => (
              <Link key={i} href={`/restaurante/${l.id}`} className="bk-loja" aria-hidden={i >= comLogo.length} tabIndex={i >= comLogo.length ? -1 : 0} title={l.nome}>
                <img src={l.logo_url!} alt={l.nome} loading="lazy" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/** Faixa da Black no lugar dos "Famosos no Chegô" (mesmo espaço): timer e as logos correndo. */
export function FaixaBlack({ lojas }: { lojas: { id: string; nome: string; logo_url?: string | null }[] }) {
  const [t, setT] = useState(falta)
  useEffect(() => { const id = setInterval(() => setT(falta()), 1000); return () => clearInterval(id) }, [])
  const comLogo = lojas.filter(l => l.logo_url)
  if (!comLogo.length) return null
  const fila = [...comLogo, ...comLogo]
  return (
    <section className="bk-faixa" aria-label="Lojas na Black Chegô">
      <div className="bk-luz" aria-hidden />
      <div className="bk-faixa-topo">
        <b className="bk-faixa-tit">BLACK CHEGÔ <SeloBlack tam={16} /> <span>20% OFF</span></b>
        <span className="bk-tempo">termina em <b className="num">{t}</b></span>
      </div>
      <div className="bk-fila">
        <div className="bk-trilho" style={{ animationDuration: `${Math.max(20, comLogo.length * 3.2)}s` }}>
          {fila.map((l, i) => (
            <Link key={i} href={`/restaurante/${l.id}`} className="bk-fam" aria-hidden={i >= comLogo.length} tabIndex={i >= comLogo.length ? -1 : 0}>
              <img src={l.logo_url!} alt="" loading="lazy" />
              <span>{l.nome.length > 18 ? l.nome.slice(0, 17) + "…" : l.nome}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Logo da loja com o selo da Black no canto (lista de lojas e página da loja). */
export function LogoComSelo({ black, children, tam = 18 }: { black: boolean; children: React.ReactNode; tam?: number }) {
  if (!black) return <>{children}</>
  // 27/11 (Lucas): no canto da logo vai a etiqueta "20% OFF" no lugar do selo de verificado
  return <span className={`logo-wrap${tam >= 24 ? " grande" : ""}`}>{children}<span className="off-black" aria-label="20% de desconto na Black Chegô">20% OFF</span></span>
}
