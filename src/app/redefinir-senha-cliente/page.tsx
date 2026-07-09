"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Image from "next/image"

export default function RedefinirSenhaClientePage() {
  const router = useRouter()
  const [senha,    setSenha]    = useState("")
  const [confirma, setConfirma] = useState("")
  const [loading,  setLoading]  = useState(false)
  const [erro,     setErro]     = useState("")
  const [ok,       setOk]       = useState(false)
  const [pronto,   setPronto]   = useState(false)

  // Supabase injeta a sessão via hash fragment ao redirecionar
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronto(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setPronto(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function salvar() {
    if (senha.length < 6)       { setErro("Mínimo 6 caracteres"); return }
    if (senha !== confirma)     { setErro("As senhas não coincidem"); return }
    setErro(""); setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setLoading(false)
    if (error) { setErro(error.message); return }
    setOk(true)
    setTimeout(() => router.push("/"), 2000)
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
          <Image src="/logo-chego.png" alt="Chegô" width={60} height={60} style={{ borderRadius: 16, objectFit: "cover", display: "block", margin: "0 auto 10px" }} />
          <p style={{ color: "#DC2626", fontWeight: 900, fontSize: 20 }}>Chegô Delivery</p>
          <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>Nova senha</p>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #e5e7eb", padding: "24px 20px" }}>
          {ok ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
              <p style={{ color: "#111827", fontWeight: 700, fontSize: 16 }}>Senha alterada! Redirecionando...</p>
            </div>
          ) : !pronto ? (
            <p style={{ color: "#9CA3AF", textAlign: "center", fontSize: 14 }}>Verificando link...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Nova senha</label>
                <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" style={inp} />
              </div>
              <div>
                <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Confirmar senha</label>
                <input type="password" value={confirma} onChange={e => setConfirma(e.target.value)} onKeyDown={e => e.key === "Enter" && salvar()} placeholder="Repita a senha" style={inp} />
              </div>
              {erro && <p style={{ color: "#f87171", fontSize: 13, padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8 }}>{erro}</p>}
              <button onClick={salvar} disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: loading ? "rgba(220,38,38,0.4)" : "#DC2626", color: "white", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Salvando..." : "Salvar nova senha →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
