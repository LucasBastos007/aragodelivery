"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/lib/auth"

export default function EntrarMotoboyPage() {
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

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px", overflowX: "hidden" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <Image src="/logo-chego.png" alt="Chegô" width={64} height={64} style={{ borderRadius: 16, objectFit: "cover" }} />
          </div>
          <p style={{ color: "#f97316", fontWeight: 900, fontSize: 22 }}>Chegô</p>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 4 }}>Área do motoboy</p>
        </div>

        <div style={{ background: "#161616", borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)", padding: "24px 20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Email</label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && entrar()}
                placeholder="seu@email.com"
                autoComplete="email"
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 14,
                  background: "#1f1f1f", border: "1px solid rgba(255,255,255,0.08)",
                  color: "white", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Senha</label>
              <input
                type="password" value={senha}
                onChange={e => setSenha(e.target.value)}
                onKeyDown={e => e.key === "Enter" && entrar()}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 14,
                  background: "#1f1f1f", border: "1px solid rgba(255,255,255,0.08)",
                  color: "white", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {erro && (
              <p style={{ color: "#f87171", fontSize: 13, fontWeight: 500, padding: "10px 12px", background: "rgba(239,68,68,0.1)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
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

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
              Ainda não tem conta?{" "}
              <Link href="/cadastro-motoboy" style={{ color: "#f97316", fontWeight: 700 }}>
                Quero ser motoboy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
