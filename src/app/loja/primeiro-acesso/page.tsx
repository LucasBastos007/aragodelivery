"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function PrimeiroAcessoPage() {
  const router = useRouter()
  const [novaSenha,    setNovaSenha]    = useState("")
  const [confirmar,    setConfirmar]    = useState("")
  const [loading,      setLoading]      = useState(false)
  const [erro,         setErro]         = useState("")
  const [mostrarNova,  setMostrarNova]  = useState(false)
  const [mostrarConf,  setMostrarConf]  = useState(false)

  async function salvar() {
    setErro("")
    if (!novaSenha || !confirmar) { setErro("Preencha todos os campos."); return }
    if (novaSenha.length < 6) { setErro("A senha deve ter pelo menos 6 caracteres."); return }
    if (novaSenha !== confirmar) { setErro("As senhas não coincidem."); return }

    setLoading(true)
    const res = await fetch("/api/loja/trocar-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ novaSenha }),
    })
    const json = await res.json()
    if (!res.ok) { setErro(json.error ?? "Erro ao salvar senha."); setLoading(false); return }
    router.push("/loja")
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 14,
    background: "#F9FAFB", border: "1px solid #E5E7EB",
    color: "#111827", outline: "none", boxSizing: "border-box",
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#f8fafc",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <Image src="/logo-chego.png" alt="Chegô" width={64} height={64} style={{ borderRadius: 16, objectFit: "cover" }} />
          </div>
          <p style={{ color: "#f97316", fontWeight: 900, fontSize: 22 }}>Chegô</p>
          <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>Primeiro acesso</p>
        </div>

        <div style={{ background: "#FFF7ED", border: "1.5px solid #FED7AA", borderRadius: 14, padding: "16px 20px", marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#C2410C", marginBottom: 4 }}>Defina sua senha pessoal</p>
          <p style={{ fontSize: 13, color: "#92400E", lineHeight: 1.5 }}>
            Você está usando uma senha temporária. Por segurança, crie agora uma senha definitiva para o seu acesso.
          </p>
        </div>

        <div style={{ background: "white", borderRadius: 20, border: "1px solid #e5e7eb", padding: "24px 20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Nova senha */}
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                Nova senha
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={mostrarNova ? "text" : "password"}
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setMostrarNova(v => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}
                >
                  {mostrarNova ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirmar senha */}
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                Confirmar senha
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={mostrarConf ? "text" : "password"}
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && salvar()}
                  placeholder="Repita a nova senha"
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setMostrarConf(v => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}
                >
                  {mostrarConf ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Força da senha */}
            {novaSenha.length > 0 && (
              <div>
                <div style={{ height: 4, borderRadius: 4, background: "#e5e7eb", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 4,
                    width: novaSenha.length >= 10 ? "100%" : novaSenha.length >= 8 ? "66%" : novaSenha.length >= 6 ? "33%" : "10%",
                    background: novaSenha.length >= 10 ? "#10b981" : novaSenha.length >= 8 ? "#f59e0b" : "#ef4444",
                    transition: "width 0.3s, background 0.3s",
                  }} />
                </div>
                <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  {novaSenha.length >= 10 ? "Senha forte" : novaSenha.length >= 8 ? "Senha boa" : novaSenha.length >= 6 ? "Senha fraca — tente algo mais longo" : "Muito curta"}
                </p>
              </div>
            )}

            {erro && (
              <p style={{ color: "#f87171", fontSize: 13, fontWeight: 500, padding: "10px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.15)" }}>
                {erro}
              </p>
            )}

            <button
              onClick={salvar}
              disabled={loading}
              style={{
                width: "100%", padding: "13px", borderRadius: 12, border: "none",
                background: loading ? "rgba(249,115,22,0.4)" : "#f97316",
                color: "white", fontWeight: 800, fontSize: 15,
                cursor: loading ? "not-allowed" : "pointer", marginTop: 4,
              }}
            >
              {loading ? "Salvando…" : "Definir senha e entrar →"}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
