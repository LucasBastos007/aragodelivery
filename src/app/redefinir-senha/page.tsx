"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

function RedefinirForm() {
  const params = useSearchParams()
  const token  = params.get("token") ?? ""

  const [senha,    setSenha]    = useState("")
  const [confirma, setConfirma] = useState("")
  const [loading,  setLoading]  = useState(false)
  const [erro,     setErro]     = useState("")
  const [ok,       setOk]       = useState(false)

  async function salvar() {
    if (senha.length < 8)        { setErro("A senha deve ter pelo menos 8 caracteres"); return }
    if (senha !== confirma)      { setErro("As senhas não coincidem"); return }
    if (!token)                  { setErro("Link inválido"); return }
    setErro(""); setLoading(true)

    const res  = await fetch("/api/redefinir-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, senha }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setErro(json.error ?? "Erro ao redefinir senha"); return }
    setOk(true)
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 14,
    background: "#F9FAFB", border: "1px solid #E5E7EB",
    color: "#111827", outline: "none", boxSizing: "border-box",
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <Image src="/logo-chego.png" alt="Chegô" width={60} height={60} style={{ borderRadius: 16, objectFit: "cover" }} />
          </div>
          <p style={{ color: "#f97316", fontWeight: 900, fontSize: 20 }}>Chegô Delivery</p>
          <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>Redefinição de senha</p>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #e5e7eb", padding: "24px 20px" }}>
          {ok ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
              <p style={{ color: "#111827", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Senha alterada com sucesso!</p>
              <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 24 }}>Agora você pode entrar com sua nova senha.</p>
              <Link href="/entrar" style={{ color: "#f97316", fontWeight: 700, fontSize: 14 }}>← Voltar para o login</Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Nova senha</label>
                <input
                  type="password" value={senha} onChange={e => setSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  style={inp}
                />
              </div>
              <div>
                <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Confirmar nova senha</label>
                <input
                  type="password" value={confirma} onChange={e => setConfirma(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && salvar()}
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                  style={inp}
                />
              </div>

              {erro && (
                <p style={{ color: "#f87171", fontSize: 13, fontWeight: 500, padding: "10px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8 }}>
                  {erro}
                </p>
              )}

              <button onClick={salvar} disabled={loading} style={{
                width: "100%", padding: "13px", borderRadius: 12, border: "none",
                background: loading ? "rgba(249,115,22,0.4)" : "#f97316",
                color: "white", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
                marginTop: 4,
              }}>
                {loading ? "Salvando..." : "Salvar nova senha →"}
              </button>

              <div style={{ textAlign: "center" }}>
                <Link href="/entrar" style={{ color: "#9CA3AF", fontSize: 13 }}>← Voltar para o login</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense>
      <RedefinirForm />
    </Suspense>
  )
}
