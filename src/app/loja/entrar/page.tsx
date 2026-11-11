"use client"

// Entrada do lojista (layout novo, 20/10/2026). Mesma entrada de antes (/api/login-loja +
// login({role:"lojista"}), primeiro acesso vai trocar a senha), com o mesmo cenário do login do
// admin: mapa com rotas e motos, logo, mascote. Esqueci a senha e instalar o app continuam aqui.
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import Link from "next/link"
import { EsqueceuSenha } from "@/components/EsqueceuSenha"
import InstalarApp from "@/components/InstalarApp"
import "../../chego-ctrl-login/login.css"

const FRASES = ["Pedido novo toca na hora.", "Repasse toda sexta, sem pedir.", "Seu cardápio do seu jeito.", "Motoboy chega, você acompanha."]

// Ruas e rotas do mapa (coordenadas num quadro de 1200 x 800)
const ROTAS = [
  "M 120 640 L 120 420 L 360 420 L 360 230 L 620 230",
  "M 980 120 L 980 330 L 760 330 L 760 520 L 520 520 L 520 690",
  "M 260 140 L 520 140 L 520 330 L 300 330 L 300 560 L 640 560",
  "M 1080 600 L 860 600 L 860 420 L 1040 420 L 1040 240",
  "M 680 720 L 680 610 L 940 610 L 940 470",
]
const LOJAS: [number, number][] = [[620, 230], [520, 690], [640, 560], [1040, 240], [940, 470], [120, 640], [980, 120], [260, 140]]

export default function LojaEntrarPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [ver, setVer] = useState(false)
  const [caps, setCaps] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState(false)
  const [erro, setErro] = useState("")
  const [treme, setTreme] = useState(0)
  const [frase, setFrase] = useState(0)
  const palco = useRef<HTMLDivElement>(null)

  useEffect(() => { const iv = setInterval(() => setFrase(f => (f + 1) % FRASES.length), 3200); return () => clearInterval(iv) }, [])
  // Fundo reage ao mouse: leve paralaxe e um brilho que segue o cursor
  useEffect(() => {
    const el = palco.current; if (!el) return
    const mover = (e: PointerEvent) => {
      const x = e.clientX / window.innerWidth, y = e.clientY / window.innerHeight
      el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`); el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`)
      el.style.setProperty("--px", `${((x - .5) * -18).toFixed(1)}px`); el.style.setProperty("--py", `${((y - .5) * -12).toFixed(1)}px`)
    }
    window.addEventListener("pointermove", mover); return () => window.removeEventListener("pointermove", mover)
  }, [])

  async function entrar(e?: React.FormEvent) {
    e?.preventDefault()
    if (loading || ok) return
    if (!email.trim() || !senha) { setErro("Preencha o e-mail e a senha."); setTreme(t => t + 1); return }
    setErro(""); setLoading(true)
    const res = await fetch("/api/login-loja", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase(), senha }) }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : {}
    if (!res || !res.ok) {
      setLoading(false); setTreme(t => t + 1)
      setErro(!res ? "Sem conexão. Confira a internet e tente de novo." : res.status === 429 ? "Muitas tentativas. Espere um minuto e tente de novo." : json.error ?? "E-mail ou senha não conferem.")
      return
    }
    setOk(true)
    login({ role: "lojista", loja_id: json.loja_id, loja_nome: json.loja_nome })
    setTimeout(() => router.push(json.primeiro_acesso ? "/loja/primeiro-acesso" : "/loja"), 900)
  }
  const capsTecla = (e: React.KeyboardEvent) => setCaps(e.getModifierState?.("CapsLock") ?? false)
  const motos = useMemo(() => ROTAS.flatMap((d, i) => [{ d, dur: 9 + i * 2.3, atraso: -i * 1.7 }, { d, dur: 13 + i * 1.9, atraso: -6 - i * 2.1 }]), [])

  return (
    <div className={`lg ${ok ? "saindo" : ""}`} ref={palco}>
      <div className="lg-mapa" aria-hidden="true">
        <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="ruas" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="rgba(255,255,255,.045)" strokeWidth="1" /></pattern>
            <radialGradient id="brilho"><stop offset="0" stopColor="#E8352C" stopOpacity=".9" /><stop offset="1" stopColor="#E8352C" stopOpacity="0" /></radialGradient>
          </defs>
          <rect width="1200" height="800" fill="url(#ruas)" />
          {[90, 250, 410, 570, 730].map(y => <line key={y} x1="0" x2="1200" y1={y} y2={y + 30} stroke="rgba(255,255,255,.035)" strokeWidth="10" />)}
          {[180, 450, 700, 900, 1120].map(x => <line key={x} y1="0" y2="800" x1={x} x2={x - 25} stroke="rgba(255,255,255,.035)" strokeWidth="10" />)}
          {ROTAS.map((d, i) => <path key={i} d={d} className="lg-rota" style={{ animationDelay: `${i * .45}s` }} />)}
          {LOJAS.map(([x, y], i) => <g key={i} className="lg-loja" style={{ animationDelay: `${.6 + i * .25}s` }} transform={`translate(${x} ${y})`}><circle r="16" fill="url(#brilho)" opacity=".5" /><path d="M0 -14c-6 0-10 4.5-10 10 0 7.5 10 16 10 16s10-8.5 10-16c0-5.5-4-10-10-10z" fill="#E8352C" /><circle cy="-4" r="3.6" fill="#fff" /></g>)}
          {motos.map((m, i) => <g key={i}><circle r="5" fill="#fff" opacity=".95"><animateMotion dur={`${m.dur}s`} begin={`${m.atraso}s`} repeatCount="indefinite" path={m.d} /></circle><circle r="12" fill="url(#brilho)" opacity=".7"><animateMotion dur={`${m.dur}s`} begin={`${m.atraso}s`} repeatCount="indefinite" path={m.d} /></circle></g>)}
        </svg>
      </div>
      <div className="lg-luz" aria-hidden="true" />

      <main className="lg-centro">
        <section className="lg-marca">
          <img src="/logo-chego-transparente.png" alt="Chegô" className="lg-logo" />
          <h1>Painel da loja</h1>
          <p className="lg-frase" aria-live="polite"><span key={frase}>{FRASES[frase]}</span></p>
        </section>

        <form className={`lg-cartao ${erro ? "erro" : ""}`} key={treme} onSubmit={entrar} noValidate>
          <img src="/mascote/moto.png" alt="" className="lg-mascote" aria-hidden="true" />
          <h2>Entrar na sua loja</h2>
          <p className="lg-sub">Use o e-mail e a senha que o Chegô te passou.</p>
          <label className="lg-campo"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder=" " autoComplete="email" inputMode="email" autoFocus /><span>E-mail</span></label>
          <label className="lg-campo"><input type={ver ? "text" : "password"} value={senha} onChange={e => setSenha(e.target.value)} onKeyUp={capsTecla} onKeyDown={capsTecla} placeholder=" " autoComplete="current-password" /><span>Senha</span>
            <button type="button" className="lg-ver" onClick={() => setVer(!ver)} aria-label={ver ? "Esconder senha" : "Mostrar senha"}>{ver ? "Esconder" : "Mostrar"}</button></label>
          {caps && <p className="lg-caps">Caps Lock ligado</p>}
          {erro && <p className="lg-erro" role="alert">{erro}</p>}
          <button className="lg-entrar" disabled={loading || ok}>
            {ok ? <><i className="lg-ok" />Abrindo sua loja…</> : loading ? <><i className="lg-gira" />Conferindo…</> : "Entrar"}
          </button>
          <div className="lg-extra"><EsqueceuSenha tipo="lojista" corBotao="#E8352C" /></div>
          <p className="lg-cadastro">Ainda não tem conta? <Link href="/cadastro-loja">Cadastre sua loja</Link></p>
          <div className="lg-install"><InstalarApp papel="lojista" /></div>
        </form>
      </main>
      <footer className="lg-pe">Chegô Delivery, Aragoiânia e região</footer>
    </div>
  )
}
