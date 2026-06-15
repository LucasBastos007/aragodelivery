"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useClienteAuth } from "@/lib/auth-cliente"

const inp: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
  background: "#F9FAFB", border: "1px solid #E5E7EB",
  color: "#111827", outline: "none", boxSizing: "border-box",
}

export default function AlterarDadosPage() {
  const router = useRouter()
  const { user, perfil, loading, salvarPerfil } = useClienteAuth()

  const [nome,      setNome]      = useState("")
  const [telefone,  setTelefone]  = useState("")
  const [endRua,    setEndRua]    = useState("")
  const [endNumero, setEndNumero] = useState("")
  const [endCompl,  setEndCompl]  = useState("")
  const [endBairro, setEndBairro] = useState("")
  const [endCep,    setEndCep]    = useState("")
  const [salvando,  setSalvando]  = useState(false)
  const [salvo,     setSalvo]     = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push("/cliente/entrar")
  }, [user, loading, router])

  useEffect(() => {
    if (perfil) {
      setNome(perfil.nome ?? "")
      setTelefone(perfil.telefone ?? "")
      setEndRua(perfil.endereco_rua ?? "")
      setEndNumero(perfil.endereco_numero ?? "")
      setEndCompl(perfil.endereco_complemento ?? "")
      setEndBairro(perfil.endereco_bairro ?? "")
      setEndCep(perfil.endereco_cep ?? "")
    } else if (user) {
      setNome(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "")
    }
  }, [perfil, user])

  async function handleSalvar() {
    setSalvando(true)
    await salvarPerfil(nome, telefone, {
      rua: endRua, numero: endNumero, complemento: endCompl,
      bairro: endBairro, cep: endCep,
    })
    if (endRua && endNumero) {
      const addr = [endRua, endNumero, endBairro].filter(Boolean).join(", ")
      if (typeof window !== "undefined") localStorage.setItem("arago_last_address", addr)
    }
    setSalvando(false)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#9CA3AF" }}>Carregando...</p>
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <nav style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>←</button>
        <p style={{ color: "#111827", fontWeight: 800, fontSize: 16, flex: 1 }}>Alterar dados</p>
      </nav>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "28px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ color: "#111827", fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Informações pessoais</p>
          <div>
            <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Nome completo</label>
            <input style={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" />
          </div>
          <div>
            <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              WhatsApp
              <span style={{ color: "#9CA3AF", marginLeft: 6, fontWeight: 400 }}>(código de rastreamento)</span>
            </label>
            <input style={inp} value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(64) 9 9999-1234" inputMode="tel" />
          </div>
        </div>

        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ color: "#111827", fontWeight: 700, fontSize: 14, marginBottom: 2 }}>📍 Endereço de entrega</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>CEP</label>
              <input style={inp} value={endCep} onChange={e => setEndCep(e.target.value)} placeholder="74000-000" inputMode="numeric" />
            </div>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Rua / Avenida</label>
              <input style={inp} value={endRua} onChange={e => setEndRua(e.target.value)} placeholder="Rua das Flores" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Número</label>
              <input style={inp} value={endNumero} onChange={e => setEndNumero(e.target.value)} placeholder="42" inputMode="numeric" />
            </div>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Complemento</label>
              <input style={inp} value={endCompl} onChange={e => setEndCompl(e.target.value)} placeholder="Apto 3, casa dos fundos..." />
            </div>
          </div>
          <div>
            <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Bairro</label>
            <input style={inp} value={endBairro} onChange={e => setEndBairro(e.target.value)} placeholder="Centro" />
          </div>
        </div>

        {salvo && (
          <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
            <p style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>✓ Dados salvos com sucesso!</p>
          </div>
        )}

        <button onClick={handleSalvar} disabled={salvando} style={{
          padding: "14px", borderRadius: 12, border: "none",
          background: salvo ? "#22c55e" : salvando ? "rgba(220,38,38,0.4)" : "#DC2626",
          color: "white", fontWeight: 800, fontSize: 15, cursor: salvando ? "not-allowed" : "pointer",
        }}>
          {salvo ? "✓ Salvo!" : salvando ? "Salvando..." : "Salvar alterações"}
        </button>

      </div>
    </div>
  )
}
