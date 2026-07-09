"use client"

import { useState, useEffect } from "react"
import { useClienteAuth } from "@/lib/auth-cliente"

function fmtCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

function fmtTel(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

export default function ModalCompletarPerfil() {
  const { user, perfil, completarPerfil } = useClienteAuth()

  const [visivel, setVisivel]   = useState(false)
  const [nome, setNome]         = useState("")
  const [cpf, setCpf]           = useState("")
  const [telefone, setTelefone] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState("")

  // Mostra modal quando logado e sem CPF (verifica perfil E metadados do usuário)
  useEffect(() => {
    const cpfSalvo = perfil?.cpf || user?.user_metadata?.cpf
    if (user && perfil && !cpfSalvo) {
      setNome(perfil.nome || user.user_metadata?.full_name || "")
      setTelefone(fmtTel(perfil.telefone || ""))
      setVisivel(true)
    } else {
      setVisivel(false)
    }
  }, [user, perfil])

  if (!visivel || !user) return null

  async function salvar() {
    const cpfDigits = cpf.replace(/\D/g, "")
    if (!nome.trim())           { setErro("Informe seu nome completo"); return }
    if (cpfDigits.length !== 11){ setErro("CPF inválido — informe os 11 dígitos"); return }
    const telDigits = telefone.replace(/\D/g, "")
    if (telDigits.length < 8)   { setErro("Informe um telefone válido com DDD"); return }

    setErro(""); setSalvando(true)
    await completarPerfil({ nome, telefone, cpf })
    setSalvando(false)
    setVisivel(false)
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 12, fontSize: 15,
    background: "#F9FAFB", border: "1.5px solid #E5E7EB",
    color: "#111827", outline: "none", boxSizing: "border-box",
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px 16px",
    }}>
      <div style={{
        background: "#fff", borderRadius: 24, width: "100%", maxWidth: 420,
        padding: "28px 24px 24px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>👋</div>
          <p style={{ fontWeight: 800, fontSize: 18, color: "#111827", marginBottom: 6 }}>
            Complete seu perfil
          </p>
          <p style={{ color: "#6B7280", fontSize: 13, lineHeight: 1.5 }}>
            Precisamos de algumas informações para facilitar seus pedidos. Só pedimos uma vez!
          </p>
        </div>

        {/* Email (read-only) */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>
            Email
          </label>
          <div style={{ ...inp, color: "#9CA3AF", borderStyle: "dashed" }}>
            {user.email}
          </div>
        </div>

        {/* Nome */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>
            Nome completo *
          </label>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Seu nome completo"
            style={inp}
          />
        </div>

        {/* CPF */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>
            CPF *
          </label>
          <input
            value={cpf}
            onChange={e => setCpf(fmtCpf(e.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
            style={inp}
          />
          <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
            Exigido pelo Banco Central para pagamentos PIX
          </p>
        </div>

        {/* Telefone */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>
            Telefone *
          </label>
          <input
            value={telefone}
            onChange={e => setTelefone(fmtTel(e.target.value))}
            placeholder="(62) 99999-9999"
            inputMode="tel"
            style={inp}
          />
        </div>

        {erro && (
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 10, padding: "10px 14px", marginBottom: 16,
            color: "#DC2626", fontSize: 13,
          }}>
            {erro}
          </div>
        )}

        <button
          onClick={salvar}
          disabled={salvando}
          style={{
            width: "100%", padding: "14px", borderRadius: 14, border: "none",
            background: salvando ? "#9CA3AF" : "#DC2626",
            color: "white", fontWeight: 700, fontSize: 15,
            cursor: salvando ? "not-allowed" : "pointer",
          }}
        >
          {salvando ? "Salvando..." : "Salvar e continuar →"}
        </button>
      </div>
    </div>
  )
}
