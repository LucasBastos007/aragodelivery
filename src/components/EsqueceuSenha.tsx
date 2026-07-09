"use client"

import { useState } from "react"

export function EsqueceuSenha({ tipo, corBotao = "#f97316" }: { tipo: "lojista" | "motoboy"; corBotao?: string }) {
  const [aberto,  setAberto]  = useState(false)
  const [email,   setEmail]   = useState("")
  const [nome,    setNome]    = useState("")
  const [loading, setLoading] = useState(false)
  const [ok,      setOk]      = useState(false)
  const [erro,    setErro]    = useState("")

  async function enviar() {
    if (!email.trim() || !nome.trim()) { setErro("Preencha email e nome completo"); return }
    setErro(""); setLoading(true)
    const res  = await fetch("/api/recuperar-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), nome: nome.trim(), tipo }),
    })
    setLoading(false)
    if (res.ok) setOk(true)
    else { const j = await res.json(); setErro(j.error ?? "Erro ao enviar") }
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
    background: "#F9FAFB", border: "1px solid #E5E7EB",
    color: "#111827", outline: "none", boxSizing: "border-box",
  }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 13, padding: 0 }}
      >
        Esqueceu a senha?
      </button>

      {aberto && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setAberto(false) }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px",
          }}
        >
          <div style={{ background: "#fff", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            {ok ? (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
                <p style={{ color: "#111827", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Solicitação recebida</p>
                <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
                  Se o email e nome informados corresponderem a um cadastro ativo, você receberá o link de redefinição em breve. Verifique sua caixa de entrada.
                </p>
                <button onClick={() => { setAberto(false); setOk(false); setEmail(""); setNome("") }}
                  style={{ background: corBotao, border: "none", color: "white", borderRadius: 10, padding: "12px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <p style={{ color: "#111827", fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Recuperar senha</p>
                <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
                  Informe seu email e nome completo. Se encontrarmos seu cadastro, enviaremos um link de redefinição.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Email cadastrado</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" style={inp} />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Nome completo</label>
                    <input value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => e.key === "Enter" && enviar()} placeholder="Como está no cadastro" style={inp} />
                  </div>

                  {erro && (
                    <p style={{ color: "#f87171", fontSize: 13, padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8 }}>{erro}</p>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button onClick={() => setAberto(false)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#6B7280", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                      Cancelar
                    </button>
                    <button onClick={enviar} disabled={loading} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: loading ? "rgba(249,115,22,0.4)" : corBotao, color: "white", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer" }}>
                      {loading ? "Enviando..." : "Enviar link →"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
