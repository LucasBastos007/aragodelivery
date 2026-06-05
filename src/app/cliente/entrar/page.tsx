"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useClienteAuth } from "@/lib/auth-cliente"

const inp: React.CSSProperties = {
  width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 14,
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  color: "white", outline: "none", boxSizing: "border-box",
}

export default function ClienteEntrarPage() {
  const router = useRouter()
  const { user, loginGoogle, loginEmail, cadastrar } = useClienteAuth()

  const [modo, setModo]         = useState<"entrar" | "cadastrar">("entrar")
  const [email, setEmail]       = useState("")
  const [senha, setSenha]       = useState("")
  const [nome, setNome]         = useState("")
  const [telefone, setTelefone] = useState("")
  const [loading, setLoading]   = useState(false)
  const [erro, setErro]         = useState("")
  const [sucesso, setSucesso]   = useState("")

  useEffect(() => {
    if (user) router.push("/cliente/perfil")
  }, [user])

  async function handleSubmit() {
    setErro(""); setSucesso("")
    setLoading(true)

    if (modo === "entrar") {
      const err = await loginEmail(email.trim(), senha)
      if (err) setErro(err === "Invalid login credentials" ? "Email ou senha incorretos." : err)
      else router.push("/cliente/perfil")
    } else {
      if (!nome.trim()) { setErro("Informe seu nome."); setLoading(false); return }
      if (senha.length < 6) { setErro("A senha precisa ter pelo menos 6 caracteres."); setLoading(false); return }
      const err = await cadastrar(email.trim(), senha, nome, telefone)
      if (err) setErro(err)
      else setSucesso("Conta criada! Verifique seu e-mail para confirmar o cadastro.")
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/lojas" style={{ textDecoration: "none" }}>
            <p style={{ fontSize: 36, marginBottom: 6 }}>🛵</p>
            <p style={{ color: "#f97316", fontWeight: 900, fontSize: 22 }}>Arago Delivery</p>
          </Link>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 4 }}>Minha conta</p>
        </div>

        <div style={{ background: "#111", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", padding: 28 }}>

          {/* Google */}
          <button
            onClick={loginGoogle}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)", color: "white", fontWeight: 700, fontSize: 14,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20,
            }}>
            {/* Google G SVG */}
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar com Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>ou</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* Toggle */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 3, marginBottom: 20, gap: 2 }}>
            {(["entrar", "cadastrar"] as const).map(m => (
              <button key={m} onClick={() => { setModo(m); setErro(""); setSucesso("") }} style={{
                flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer",
                background: modo === m ? "#f97316" : "transparent",
                color: modo === m ? "white" : "rgba(255,255,255,0.4)",
                fontWeight: 700, fontSize: 13,
              }}>
                {m === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {modo === "cadastrar" && (
              <>
                <div>
                  <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Nome completo *</label>
                  <input style={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="João Silva" />
                </div>
                <div>
                  <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>WhatsApp</label>
                  <input style={inp} value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(64) 9 9999-1234" inputMode="tel" />
                </div>
              </>
            )}
            <div>
              <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>E-mail *</label>
              <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="seu@email.com" autoComplete="email" />
            </div>
            <div>
              <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Senha *</label>
              <input style={inp} type="password" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="••••••••" autoComplete={modo === "entrar" ? "current-password" : "new-password"} />
            </div>

            {erro && (
              <p style={{ color: "#f87171", fontSize: 13, padding: "10px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.15)" }}>
                {erro}
              </p>
            )}
            {sucesso && (
              <p style={{ color: "#22c55e", fontSize: 13, padding: "10px 12px", background: "rgba(34,197,94,0.08)", borderRadius: 8, border: "1px solid rgba(34,197,94,0.2)" }}>
                {sucesso}
              </p>
            )}

            <button onClick={handleSubmit} disabled={loading} style={{
              width: "100%", padding: "13px", borderRadius: 12, border: "none",
              background: loading ? "rgba(249,115,22,0.4)" : "#f97316",
              color: "white", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", marginTop: 4,
            }}>
              {loading ? "Aguarde..." : modo === "entrar" ? "Entrar →" : "Criar conta →"}
            </button>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 16, color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
          <Link href="/lojas" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>← Voltar para as lojas</Link>
        </p>
      </div>
    </div>
  )
}
