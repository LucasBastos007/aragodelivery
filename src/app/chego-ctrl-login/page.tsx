"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"

export default function AdminLoginPage() {
  const router = useRouter()
  const { login } = useAuth()

  const [email,   setEmail]   = useState("")
  const [senha,   setSenha]   = useState("")
  const [loading, setLoading] = useState(false)
  const [erro,    setErro]    = useState("")

  async function entrar() {
    if (!email.trim() || !senha.trim()) { setErro("Preencha email e senha."); return }
    setErro("")
    setLoading(true)

    const res  = await fetch("/api/auth/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), senha }),
    })
    const json = await res.json()

    if (!res.ok) { setErro(json.error ?? "Credenciais inválidas."); setLoading(false); return }

    login({ role: "admin" })
    router.push("/chego-ctrl")
    setLoading(false)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, margin: "0 auto 12px",
            background: "linear-gradient(135deg, #f97316, #dc2626)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(249,115,22,0.3)",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <p style={{ fontWeight: 900, fontSize: 20, color: "#0F172A" }}>Acesso restrito</p>
          <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>Painel administrativo</p>
        </div>

        <div style={{ background: "white", borderRadius: 20, border: "1px solid #E2E8F0", padding: "24px 20px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Email</label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && entrar()}
                placeholder="admin@email.com"
                autoComplete="email"
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 14,
                  background: "#F9FAFB", border: "1px solid #E5E7EB",
                  color: "#111827", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Senha</label>
              <input
                type="password" value={senha}
                onChange={e => setSenha(e.target.value)}
                onKeyDown={e => e.key === "Enter" && entrar()}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 14,
                  background: "#F9FAFB", border: "1px solid #E5E7EB",
                  color: "#111827", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {erro && (
              <p style={{ color: "#f87171", fontSize: 13, fontWeight: 500, padding: "10px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.15)" }}>
                {erro}
              </p>
            )}

            <button onClick={entrar} disabled={loading} style={{
              width: "100%", padding: "13px", borderRadius: 12, border: "none",
              background: loading ? "rgba(249,115,22,0.4)" : "linear-gradient(135deg, #f97316, #dc2626)",
              color: "white", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
              marginTop: 4, boxShadow: loading ? "none" : "0 4px 14px rgba(249,115,22,0.3)",
            }}>
              {loading ? "Verificando..." : "Entrar →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
