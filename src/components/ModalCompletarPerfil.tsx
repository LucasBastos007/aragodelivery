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

  // Layout novo (19/10/2026): folha de baixo no estilo da proposta; mesmos campos e mesma validação
  return (
    <div className="cn-veu on" style={{ zIndex: 9000 }}>
      <div className="cn folha on" role="dialog" aria-label="Complete seu cadastro">
        <div className="folha-rolagem" style={{ padding: "24px 20px 8px" }}>
          <div className="passos" aria-hidden="true"><i className="on" /><i className="on" /><i /></div>
          <div className="h1" style={{ fontSize: 26 }}>Falta pouco, {(nome.split(" ")[0] || "tudo certo")}</div>
          <p className="mut" style={{ margin: "6px 0 18px", lineHeight: 1.5 }}>Só pedimos uma vez. O CPF é exigido pelo Banco Central pra pagar com Pix.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label className="campo"><span>Nome completo *</span>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome e sobrenome" autoComplete="name" /></label>
            <label className={`campo ${cpf.replace(/\D/g, "").length === 11 ? "" : "falta"}`}><span>CPF *</span>
              <input value={cpf} onChange={e => setCpf(fmtCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" /></label>
            <label className="campo"><span>WhatsApp *</span>
              <input value={telefone} onChange={e => setTelefone(fmtTel(e.target.value))} placeholder="(62) 99999-9999" inputMode="tel" autoComplete="tel" /></label>
            <p className="mut" style={{ fontSize: 12.5 }}>Conta: {user.email}</p>
          </div>
          {erro && <p className="aviso-vermelho" style={{ margin: "14px 0 0" }}>{erro}</p>}
        </div>
        <div className="rodape-fixo">
          <button className="btn btn-p" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar e continuar"}</button>
        </div>
      </div>
    </div>
  )
}
