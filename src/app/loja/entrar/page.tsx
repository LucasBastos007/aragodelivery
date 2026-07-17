"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/lib/auth"
import { EsqueceuSenha } from "@/components/EsqueceuSenha"

export default function LojaEntrarPage() {
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

    const res  = await fetch("/api/login-loja", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), senha }),
    })
    const json = await res.json()

    if (!res.ok) { setErro(json.error ?? "Erro ao entrar."); setLoading(false); return }

    login({ role: "lojista", loja_id: json.loja_id, loja_nome: json.loja_nome })
    if (json.primeiro_acesso) {
      router.push("/loja/primeiro-acesso")
    } else {
      router.push("/loja")
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <Image src="/logo-chego.png" alt="Chegô" width={64} height={64} style={{ borderRadius: 16, objectFit: "cover" }} />
          </div>
          <p style={{ color: "#f97316", fontWeight: 900, fontSize: 22 }}>Chegô</p>
          <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>Área do lojista</p>
        </div>

        <div style={{ background: "#ffffff", borderRadius: 20, border: "1px solid #e5e7eb", padding: "24px 20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Email</label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && entrar()}
                placeholder="seu@email.com"
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
              background: loading ? "rgba(249,115,22,0.4)" : "#f97316",
              color: "white", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
              marginTop: 4,
            }}>
              {loading ? "Entrando..." : "Entrar →"}
            </button>
          </div>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #e5e7eb", textAlign: "center" }}>
            <EsqueceuSenha tipo="lojista" />
          </div>
        </div>
      </div>
    </div>
  )
}
