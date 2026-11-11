"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import InstallBanner from "@/components/InstallBanner"
import { EsqueceuSenha } from "@/components/EsqueceuSenha"
import "../../motoboy/mb-novo.css"

export default function EntrarMotoboyPage() {
  const router = useRouter()
  const { login } = useAuth()

  const [email,   setEmail]   = useState("")
  const [senha,   setSenha]   = useState("")
  const [loading, setLoading] = useState(false)
  const [erro,    setErro]    = useState("")
  const [verSenha, setVerSenha] = useState(false)

  async function entrar() {
    if (!email.trim() || !senha.trim()) { setErro("Preencha email e senha."); return }
    setErro("")
    setLoading(true)

    const res  = await fetch("/api/auth/motoboy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), senha }),
    })
    const json = await res.json()

    if (!res.ok) { setErro(json.error ?? "Erro ao entrar."); setLoading(false); return }

    login({ role: "motoboy", motoboy_id: json.motoboy_id, motoboy_nome: json.motoboy_nome })
    router.push("/motoboy")
    setLoading(false)
  }

  // Layout novo (proposta aprovada em 19/10/2026). Mesmo login (/api/auth/motoboy).
  // "Quero ser motoboy" saiu desta tela a pedido do Lucas; o cadastro segue em /cadastro-motoboy.
  return (
    <div className="mbn mb-entrar">
      <div className="mb-entrar-topo">
        {/* Arte da proposta: ruas, rota pontilhada e o pino */}
        <svg className="mb-entrar-arte" viewBox="0 0 390 420" preserveAspectRatio="xMaxYMin slice" aria-hidden="true">
          <g stroke="rgba(255,255,255,.08)" strokeWidth="14" fill="none" strokeLinecap="round"><path d="M-20 300 C 80 260, 120 330, 220 280 S 360 200, 420 230" /><path d="M60 -20 V 440" /><path d="M300 -20 C 280 120, 330 200, 300 440" /><path d="M-20 120 H 420" /></g>
          <path d="M390 210 C 330 200, 300 160, 330 130 S 350 100, 340 74" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="4" strokeDasharray="2 12" strokeLinecap="round" />
          <path d="M340 90c-11-13-16-20-16-27a16 16 0 0 1 32 0c0 7-5 14-16 27z" fill="#fff" /><circle cx="340" cy="63" r="6" fill="#D7261E" />
        </svg>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo-chego.png" alt="" width={64} height={64} style={{ borderRadius: 18, border: "3px solid rgba(255,255,255,.9)" }} />
          <span><b style={{ fontFamily: "var(--display)", fontSize: 26, display: "block", lineHeight: 1 }}>Chegô</b><span className="mb-entrar-selo">Entregador</span></span>
        </div>
        <div style={{ marginTop: "auto" }}>
          <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 34, lineHeight: 1.02, letterSpacing: "-.8px" }}>Sua cidade.<br />Suas corridas.</h1>
          <p style={{ opacity: .9, marginTop: 8, fontSize: 15 }}>Ganhe por entrega e receba no seu Pix.</p>
        </div>
      </div>

      <div className="mb-entrar-form">
        <label className="mb-campo"><span>E-mail</span>
          <span style={{ position: "relative", display: "block" }}>
          <svg className="mb-campo-ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></svg>
          <input type="email" style={{ paddingLeft: 44 }} value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && entrar()} placeholder="Seu e-mail" autoComplete="email" />
          </span>
        </label>
        <label className="mb-campo" style={{ marginTop: 14 }}><span>Senha</span>
          <span style={{ position: "relative", display: "block" }}>
            <svg className="mb-campo-ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            <input type={verSenha ? "text" : "password"} value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === "Enter" && entrar()} placeholder="Sua senha" autoComplete="current-password" style={{ paddingRight: 52, paddingLeft: 44 }} />
            <button type="button" onClick={() => setVerSenha(v => !v)} aria-label={verSenha ? "Esconder senha" : "Mostrar senha"} style={{ position: "absolute", right: 6, top: 5, width: 40, height: 40, border: 0, background: "none", color: "var(--suave)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" />{verSenha && <line x1="3" y1="3" x2="21" y2="21" />}</svg>
            </button>
          </span>
        </label>

        <div className="mb-esqueci" style={{ textAlign: "right", marginTop: 8 }}><EsqueceuSenha tipo="motoboy" /></div>

        {erro && <p style={{ color: "var(--pimenta)", background: "var(--pimenta-claro)", borderRadius: 12, padding: "10px 12px", fontSize: 13.5, fontWeight: 600, marginTop: 10 }}>{erro}</p>}

        <button className="mb-btn verm" style={{ marginTop: 16 }} onClick={entrar} disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button>

        <InstallBanner />
      </div>
    </div>
  )
}
