"use client"

// Meus dados e Endereço no layout novo (20/10/2026). Mesmos campos e o mesmo salvarPerfil de antes.
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useClienteAuth } from "@/lib/auth-cliente"
import { TopoSub } from "@/components/cliente/TopoSub"

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

  if (loading) return <div className="cn sub-tela" style={{ display: "grid", placeItems: "center" }}><p className="mut">Carregando…</p></div>

  return (
    <div className="cn sub-tela">
      <TopoSub titulo="Meus dados" />
      <div className="conteudo">
        <div className="bloco">
          <div className="h3">Informações pessoais</div>
          <label className="campo"><span>Nome completo</span>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" autoComplete="name" /></label>
          <label className="campo"><span>WhatsApp</span>
            <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(62) 9 9999-1234" inputMode="tel" autoComplete="tel" />
            <small className="mut">É por ele que você recebe o código de entrada e os avisos do pedido.</small></label>
          {user?.email && !user.email.endsWith("@cliente.chegodelivery.com") && (
            <label className="campo"><span>E-mail</span><input value={user.email} disabled style={{ color: "var(--suave)" }} /></label>
          )}
        </div>

        <div className="bloco" id="endereco">
          <div className="h3">Endereço principal</div>
          <div className="duas">
            <label className="campo"><span>CEP</span>
              <input value={endCep} onChange={e => setEndCep(e.target.value)} placeholder="75360-000" inputMode="numeric" /></label>
            <label className="campo"><span>Rua</span>
              <input value={endRua} onChange={e => setEndRua(e.target.value)} placeholder="Rua das Flores" /></label>
          </div>
          <div className="duas">
            <label className="campo"><span>Número</span>
              <input value={endNumero} onChange={e => setEndNumero(e.target.value)} placeholder="42" inputMode="numeric" /></label>
            <label className="campo"><span>Complemento</span>
              <input value={endCompl} onChange={e => setEndCompl(e.target.value)} placeholder="Casa dos fundos" /></label>
          </div>
          <label className="campo"><span>Bairro</span>
            <input value={endBairro} onChange={e => setEndBairro(e.target.value)} placeholder="Centro" /></label>
          <small className="mut" style={{ fontSize: 13, lineHeight: 1.45 }}>Os outros endereços você escolhe ou cadastra na hora do pedido, em “Endereço de entrega”.</small>
        </div>

        {salvo && <div className="ok-msg" role="status">Dados salvos</div>}
        <button className="btn btn-p" onClick={handleSalvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar alterações"}</button>
      </div>
    </div>
  )
}
