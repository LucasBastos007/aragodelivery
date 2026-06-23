"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { FileUpload } from "@/components/cadastro/FileUpload"
import { AddressFields, AddressData } from "@/components/cadastro/AddressFields"
import { BankFields, BankData } from "@/components/cadastro/BankFields"
import { validateCPF, validateEmail, isAdult } from "@/utils/validators"
import { maskCPF, maskPhone, maskPlaca } from "@/utils/masks"

// ─── Types ────────────────────────────────────────────────────────────────────
interface PersonalData {
  nome: string; cpf: string; nascimento: string; genero: string
  email: string; celular: string; senha: string; confirmarSenha: string
}
interface VehicleData {
  tipo: string; placa: string; modelo: string; ano: string
  cnh: string; categoriaCnh: string; validadeCnh: string
}
interface DocsData {
  cnhFrente: File | null; cnhVerso: File | null
  crlv: File | null; selfie: File | null
}
type StepId =
  | "nome" | "cpf" | "nascimento" | "genero"
  | "email" | "celular" | "senha"
  | "endereco"
  | "veiculo" | "placa" | "modeloAno" | "cnh"
  | "cnhFrente" | "cnhVerso" | "crlv" | "selfie"
  | "banco"

// ─── Constants ────────────────────────────────────────────────────────────────
const ANO_ATUAL = new Date().getFullYear()
const ANOS = Array.from({ length: ANO_ATUAL - 1999 }, (_, i) => String(ANO_ATUAL - i))

const ALL_STEPS: StepId[] = [
  "nome", "cpf", "nascimento", "genero",
  "email", "celular", "senha",
  "endereco",
  "veiculo", "placa", "modeloAno", "cnh",
  "cnhFrente", "cnhVerso", "crlv", "selfie",
  "banco",
]

const VEHICLE_TYPES: { id: string; icon: React.ReactNode }[] = [
  {
    id: "Moto",
    icon: (
      <svg width="36" height="28" viewBox="0 0 36 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="21" r="5"/><circle cx="30" cy="21" r="5"/>
        <path d="M11 21h14M18 21V12l-5-4H9M18 12h8l3 5h2"/>
        <path d="M13 8h6"/>
      </svg>
    ),
  },
  {
    id: "Bicicleta",
    icon: (
      <svg width="36" height="28" viewBox="0 0 36 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="20" r="5"/><circle cx="29" cy="20" r="5"/>
        <path d="M7 20l10-12h5M22 8l5 12"/>
        <path d="M7 20l15-8"/>
        <circle cx="22" cy="8" r="2" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: "Carro",
    icon: (
      <svg width="38" height="24" viewBox="0 0 38 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="10" width="34" height="10" rx="3"/>
        <path d="M8 10L13 4h12l5 6"/>
        <circle cx="10" cy="20" r="3"/><circle cx="28" cy="20" r="3"/>
        <line x1="2" y1="16" x2="36" y2="16"/>
      </svg>
    ),
  },
  {
    id: "A pé",
    icon: (
      <svg width="20" height="34" viewBox="0 0 20 34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="4" r="3"/>
        <path d="M10 7v10M6 13l8 2M6 17l-3 10M14 17l3 10M6 27l2-6M14 27l-2-6"/>
      </svg>
    ),
  },
]

const GENEROS: { id: string; icon: React.ReactNode }[] = [
  {
    id: "Masculino",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="14" r="6"/><line x1="14.8" y1="9.2" x2="21" y2="3"/>
        <polyline points="16 3 21 3 21 8"/>
      </svg>
    ),
  },
  {
    id: "Feminino",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6"/><line x1="12" y1="14" x2="12" y2="21"/>
        <line x1="9" y1="18" x2="15" y2="18"/>
      </svg>
    ),
  },
  {
    id: "Prefiro não informar",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
]

const STEP_META: Record<StepId, { question: string; hint?: string; category: string }> = {
  nome:       { question: "Qual é o seu nome completo?", category: "Dados pessoais" },
  cpf:        { question: "Qual é o seu CPF?", category: "Dados pessoais" },
  nascimento: { question: "Quando você nasceu?", category: "Dados pessoais" },
  genero:     { question: "Como você se identifica?", category: "Dados pessoais" },
  email:      { question: "Qual é o seu e-mail?", hint: "Será usado para acessar sua conta", category: "Acesso" },
  celular:    { question: "Qual é o seu WhatsApp?", hint: "Para comunicação sobre as corridas", category: "Acesso" },
  senha:      { question: "Crie uma senha segura", hint: "Mínimo de 8 caracteres", category: "Acesso" },
  endereco:   { question: "Qual é o seu endereço?", hint: "Digite o CEP para preencher automaticamente", category: "Localização" },
  veiculo:    { question: "Com qual veículo você vai fazer entregas?", category: "Veículo" },
  placa:      { question: "Qual é a placa do veículo?", category: "Veículo" },
  modeloAno:  { question: "Qual é o modelo e o ano?", category: "Veículo" },
  cnh:        { question: "Dados da sua CNH", hint: "Número, categoria e validade", category: "Veículo" },
  cnhFrente:  { question: "Foto da CNH — frente", hint: "Foto clara e legível, sem reflexo", category: "Documentos" },
  cnhVerso:   { question: "Foto da CNH — verso", hint: "Foto clara e legível, sem reflexo", category: "Documentos" },
  crlv:       { question: "Foto do CRLV do veículo", hint: "Documento de registro e licenciamento", category: "Documentos" },
  selfie:     { question: "Selfie segurando a CNH", hint: "Segure o documento ao lado do rosto, sem óculos escuros", category: "Documentos" },
  banco:      { question: "Dados bancários para receber", hint: "Para o repasse das suas corridas", category: "Pagamento" },
}

// ─── Light theme CSS override (for sub-components that use .input/.label) ────
const LIGHT_CSS = `
  [data-light-form] .input {
    background: white !important;
    border: 1.5px solid #E2E8F0 !important;
    color: #0F172A !important;
    font-size: 16px !important;
    border-radius: 14px !important;
    padding: 16px 18px !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;
    transition: border-color 0.15s, box-shadow 0.15s !important;
  }
  [data-light-form] .input::placeholder { color: #94A3B8 !important; }
  [data-light-form] .input:focus {
    border-color: #DC2626 !important;
    box-shadow: 0 0 0 3px rgba(220,38,38,0.1), 0 1px 3px rgba(0,0,0,0.05) !important;
    outline: none !important;
  }
  [data-light-form] select.input,
  [data-light-form] select.input option {
    background: white !important;
    color: #0F172A !important;
  }
  [data-light-form] .label {
    color: #475569 !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    letter-spacing: 0.5px !important;
    text-transform: uppercase !important;
  }
  [data-light-form] .btn-primary {
    background: linear-gradient(135deg, #DC2626, #C41E3A) !important;
    box-shadow: 0 4px 16px rgba(220,38,38,0.3) !important;
    border-radius: 12px !important;
    font-weight: 800 !important;
  }
  [data-light-form] .btn-ghost {
    background: #F8FAFC !important;
    border-color: #E2E8F0 !important;
    color: #475569 !important;
  }
  [data-light-form] .card {
    background: white !important;
    border: 1px solid #E2E8F0 !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05) !important;
  }
  @keyframes chego-spin { to { transform: rotate(360deg) } }
`

// Shared input style for inline inputs
const inp: React.CSSProperties = {
  width: "100%", padding: "18px 20px",
  fontSize: 17, borderRadius: 14,
  background: "white", border: "1.5px solid #E2E8F0",
  color: "#0F172A", outline: "none", boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
  WebkitAppearance: "none",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
}

const inpFocus = {
  borderColor: "#DC2626",
  boxShadow: "0 0 0 3px rgba(220,38,38,0.1), 0 1px 3px rgba(0,0,0,0.05)",
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CadastroMotoboy() {
  const [stepIdx, setStepIdx]       = useState(0)
  const [direction, setDirection]   = useState(1)
  const [loading, setLoading]       = useState(false)
  const [sucesso, setSucesso]       = useState(false)
  const [erro, setErro]             = useState("")
  const [showPass, setShowPass]     = useState(false)
  const [showPass2, setShowPass2]   = useState(false)
  const [focusedInp, setFocusedInp] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  const [personal, setPersonal] = useState<PersonalData>({
    nome: "", cpf: "", nascimento: "", genero: "Masculino",
    email: "", celular: "", senha: "", confirmarSenha: "",
  })
  const [address, setAddress] = useState<AddressData>({
    cep: "", logradouro: "", numero: "", complemento: "",
    bairro: "", cidade: "", estado: "",
  })
  const [vehicle, setVehicle] = useState<VehicleData>({
    tipo: "Moto", placa: "", modelo: "", ano: String(ANO_ATUAL),
    cnh: "", categoriaCnh: "A", validadeCnh: "",
  })
  const [docs, setDocs] = useState<DocsData>({
    cnhFrente: null, cnhVerso: null, crlv: null, selfie: null,
  })
  const [bank, setBank] = useState<BankData>({
    banco: "", tipoConta: "Corrente", agencia: "", conta: "",
    cpfTitular: "", mesmoCpf: false,
  })

  const needsVehicleDoc = vehicle.tipo === "Moto" || vehicle.tipo === "Carro"

  const activeSteps = ALL_STEPS.filter(id => {
    if (["placa", "modeloAno", "cnh", "crlv"].includes(id)) return needsVehicleDoc
    return true
  })

  const currentStepId = activeSteps[stepIdx]
  const totalSteps    = activeSteps.length
  const isLastStep    = stepIdx === totalSteps - 1
  const progress      = ((stepIdx + 1) / totalSteps) * 100

  const meta = (() => {
    const base = STEP_META[currentStepId]
    if (!needsVehicleDoc) {
      if (currentStepId === "cnhFrente") return { ...base, question: "Foto do RG ou CNH — frente", hint: "Foto clara e legível, sem reflexo" }
      if (currentStepId === "cnhVerso")  return { ...base, question: "Foto do RG ou CNH — verso",  hint: "Foto clara e legível, sem reflexo" }
      if (currentStepId === "selfie")    return { ...base, question: "Selfie segurando o documento", hint: "Segure o documento ao lado do rosto, sem óculos escuros" }
    }
    return base
  })()

  // Auto-focus text input when step changes
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 160)
    return () => clearTimeout(t)
  }, [stepIdx])

  // ─── Validation ─────────────────────────────────────────────────────────────
  function validate(): string | null {
    switch (currentStepId) {
      case "nome":
        return personal.nome.trim().length >= 3 ? null : "Informe seu nome completo"
      case "cpf":
        return validateCPF(personal.cpf) ? null : "CPF inválido"
      case "nascimento":
        if (!personal.nascimento) return "Informe sua data de nascimento"
        return isAdult(personal.nascimento) ? null : "É necessário ter 18 anos ou mais"
      case "genero": return null
      case "email":
        return validateEmail(personal.email) ? null : "E-mail inválido"
      case "celular":
        return personal.celular.replace(/\D/g, "").length >= 10 ? null : "Celular inválido"
      case "senha":
        if (personal.senha.length < 8) return "A senha deve ter pelo menos 8 caracteres"
        return personal.confirmarSenha === personal.senha ? null : "As senhas não coincidem"
      case "endereco":
        if (!address.logradouro.trim()) return "Preencha o CEP para buscar o endereço"
        if (!address.numero.trim()) return "Informe o número"
        return null
      case "veiculo": return null
      case "placa":
        return vehicle.placa.trim() ? null : "Informe a placa do veículo"
      case "modeloAno":
        return vehicle.modelo.trim() ? null : "Informe o modelo do veículo"
      case "cnh":
        if (!vehicle.cnh.trim()) return "Informe o número da CNH"
        return vehicle.validadeCnh ? null : "Informe a validade da CNH"
      case "cnhFrente": return docs.cnhFrente ? null : needsVehicleDoc ? "Adicione a foto da frente da CNH" : "Adicione a foto da frente do documento"
      case "cnhVerso":  return docs.cnhVerso  ? null : needsVehicleDoc ? "Adicione a foto do verso da CNH"  : "Adicione a foto do verso do documento"
      case "crlv":      return docs.crlv      ? null : "Adicione o CRLV do veículo"
      case "selfie":    return docs.selfie    ? null : "Adicione a selfie segurando o documento"
      case "banco":
        if (!bank.banco) return "Selecione o banco"
        if (!bank.agencia.trim()) return "Informe a agência"
        if (!bank.conta.trim()) return "Informe a conta"
        return bank.cpfTitular.trim() ? null : "Informe o CPF do titular"
      default: return null
    }
  }

  // ─── Navigation ─────────────────────────────────────────────────────────────
  function next() {
    const e = validate()
    if (e) { setErro(e); return }
    setErro("")
    if (stepIdx < totalSteps - 1) {
      setDirection(1)
      setStepIdx(s => s + 1)
    } else {
      enviar()
    }
  }

  function back() {
    setErro("")
    setDirection(-1)
    setStepIdx(s => s - 1)
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────
  async function enviar() {
    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signUp({
        email: personal.email.trim().toLowerCase(),
        password: personal.senha,
      })
      // signUp pode retornar erro de "email já cadastrado" — toleramos pois
      // o cadastro no banco pode ser de um novo motoboy com e-mail existente.
      if (authError && !authError.message.includes("already")) throw authError

      const res = await fetch("/api/cadastro-motoboy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome:     personal.nome.trim(),
          email:    personal.email.trim().toLowerCase(),
          telefone: personal.celular,
          cpf:      personal.cpf,
          veiculo:  vehicle.tipo,
          placa:    vehicle.placa.toUpperCase() || null,
          pix_key:  bank.banco ? `${bank.banco} Ag:${bank.agencia} Cc:${bank.conta}` : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar cadastro")
      setSucesso(true)
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao enviar. Verifique os dados e tente novamente.")
    }
    setLoading(false)
  }

  // ─── Input per step ─────────────────────────────────────────────────────────
  function renderInput() {
    const onEnter = (e: React.KeyboardEvent) => { if (e.key === "Enter") next() }
    const focusStyle = (id: string) => focusedInp === id ? inpFocus : {}

    switch (currentStepId) {

      case "nome":
        return (
          <input
            ref={inputRef}
            style={{ ...inp, ...focusStyle("nome") }}
            value={personal.nome}
            onChange={e => { setPersonal(p => ({ ...p, nome: e.target.value })); setErro("") }}
            onKeyDown={onEnter}
            onFocus={() => setFocusedInp("nome")}
            onBlur={() => setFocusedInp(null)}
            placeholder="João da Silva"
            autoComplete="name"
          />
        )

      case "cpf":
        return (
          <input
            ref={inputRef}
            style={{ ...inp, ...focusStyle("cpf"), letterSpacing: 2 }}
            value={personal.cpf}
            onChange={e => { setPersonal(p => ({ ...p, cpf: maskCPF(e.target.value) })); setErro("") }}
            onKeyDown={onEnter}
            onFocus={() => setFocusedInp("cpf")}
            onBlur={() => setFocusedInp(null)}
            placeholder="000.000.000-00"
            maxLength={14}
            inputMode="numeric"
          />
        )

      case "nascimento":
        return (
          <input
            ref={inputRef}
            type="date"
            style={{ ...inp, ...focusStyle("nasc") }}
            value={personal.nascimento}
            onChange={e => { setPersonal(p => ({ ...p, nascimento: e.target.value })); setErro("") }}
            onFocus={() => setFocusedInp("nasc")}
            onBlur={() => setFocusedInp(null)}
            max={new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().split("T")[0]}
          />
        )

      case "genero":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {GENEROS.map(g => {
              const sel = personal.genero === g.id
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { setPersonal(p => ({ ...p, genero: g.id })); setErro("") }}
                  style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "16px 20px", borderRadius: 16,
                    border: `1.5px solid ${sel ? "#DC2626" : "#E2E8F0"}`,
                    background: sel ? "#FFF1F2" : "white",
                    cursor: "pointer", textAlign: "left",
                    transition: "all 0.18s",
                    boxShadow: sel ? "0 4px 16px rgba(220,38,38,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
                    transform: sel ? "translateX(4px)" : "translateX(0)",
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: sel ? "rgba(220,38,38,0.1)" : "#F8FAFC",
                    border: `1px solid ${sel ? "rgba(220,38,38,0.2)" : "#E2E8F0"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: sel ? "#DC2626" : "#94A3B8",
                    transition: "all 0.18s",
                  }}>{g.icon}</div>
                  <span style={{
                    color: sel ? "#DC2626" : "#374151",
                    fontWeight: 700, fontSize: 16, flex: 1,
                  }}>{g.id}</span>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${sel ? "#DC2626" : "#CBD5E1"}`,
                    background: sel ? "#DC2626" : "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.18s",
                  }}>
                    {sel && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1.5,5 4,7.5 8.5,2.5"/>
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )

      case "email":
        return (
          <input
            ref={inputRef}
            type="email"
            style={{ ...inp, ...focusStyle("email") }}
            value={personal.email}
            onChange={e => { setPersonal(p => ({ ...p, email: e.target.value })); setErro("") }}
            onKeyDown={onEnter}
            onFocus={() => setFocusedInp("email")}
            onBlur={() => setFocusedInp(null)}
            placeholder="seu@email.com"
            autoComplete="email"
            inputMode="email"
          />
        )

      case "celular":
        return (
          <input
            ref={inputRef}
            style={{ ...inp, ...focusStyle("cel") }}
            value={personal.celular}
            onChange={e => { setPersonal(p => ({ ...p, celular: maskPhone(e.target.value) })); setErro("") }}
            onKeyDown={onEnter}
            onFocus={() => setFocusedInp("cel")}
            onBlur={() => setFocusedInp(null)}
            placeholder="(64) 9 9999-1234"
            maxLength={15}
            inputMode="tel"
          />
        )

      case "senha":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ position: "relative" }}>
              <input
                ref={inputRef}
                type={showPass ? "text" : "password"}
                style={{ ...inp, ...focusStyle("senha"), paddingRight: 56 }}
                value={personal.senha}
                onChange={e => { setPersonal(p => ({ ...p, senha: e.target.value })); setErro("") }}
                onFocus={() => setFocusedInp("senha")}
                onBlur={() => setFocusedInp(null)}
                placeholder="Sua senha"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9ca3af", padding: 4 }}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <input
                type={showPass2 ? "text" : "password"}
                style={{
                  ...inp, paddingRight: 56,
                  ...focusStyle("senha2"),
                  borderColor: personal.confirmarSenha && personal.confirmarSenha !== personal.senha
                    ? "#ef4444"
                    : personal.confirmarSenha && personal.confirmarSenha === personal.senha
                      ? "#22c55e"
                      : focusedInp === "senha2" ? "#DC2626" : "#e5e7eb",
                }}
                value={personal.confirmarSenha}
                onChange={e => { setPersonal(p => ({ ...p, confirmarSenha: e.target.value })); setErro("") }}
                onFocus={() => setFocusedInp("senha2")}
                onBlur={() => setFocusedInp(null)}
                placeholder="Confirme sua senha"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPass2(v => !v)}
                style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9ca3af", padding: 4 }}
              >
                {showPass2 ? "🙈" : "👁️"}
              </button>
            </div>
            {personal.confirmarSenha && personal.confirmarSenha === personal.senha && (
              <p style={{ color: "#22c55e", fontSize: 14, fontWeight: 600 }}>✓ Senhas conferem</p>
            )}
          </div>
        )

      case "endereco":
        return (
          <div className="flex flex-col gap-2">
            <AddressFields data={address} onChange={d => { setAddress(d); setErro("") }} errors={{}} />
          </div>
        )

      case "veiculo":
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {VEHICLE_TYPES.map(v => {
              const sel = vehicle.tipo === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setVehicle(veh => ({ ...veh, tipo: v.id })); setErro("") }}
                  style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    gap: 14, padding: "28px 16px", borderRadius: 20,
                    border: `1.5px solid ${sel ? "#DC2626" : "#E2E8F0"}`,
                    background: sel ? "#FFF1F2" : "white",
                    cursor: "pointer", transition: "all 0.2s",
                    boxShadow: sel
                      ? "0 8px 28px rgba(220,38,38,0.18)"
                      : "0 1px 4px rgba(0,0,0,0.06)",
                    transform: sel ? "translateY(-3px)" : "translateY(0)",
                    position: "relative",
                  }}
                >
                  {sel && (
                    <div style={{
                      position: "absolute", top: 10, right: 10,
                      width: 22, height: 22, borderRadius: "50%",
                      background: "#DC2626",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 6px rgba(220,38,38,0.4)",
                    }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1.5,5 4,7.5 8.5,2.5"/>
                      </svg>
                    </div>
                  )}
                  <div style={{
                    width: 64, height: 64, borderRadius: 18,
                    background: sel ? "rgba(220,38,38,0.08)" : "#F8FAFC",
                    border: `1px solid ${sel ? "rgba(220,38,38,0.2)" : "#E2E8F0"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: sel ? "#DC2626" : "#94A3B8",
                    transition: "all 0.2s",
                  }}>{v.icon}</div>
                  <span style={{
                    color: sel ? "#DC2626" : "#475569",
                    fontWeight: 700, fontSize: 14, letterSpacing: "-0.2px",
                  }}>{v.id}</span>
                </button>
              )
            })}
          </div>
        )

      case "placa":
        return (
          <input
            ref={inputRef}
            style={{ ...inp, ...focusStyle("placa"), textTransform: "uppercase", letterSpacing: 6, textAlign: "center", fontSize: 26, fontWeight: 800 }}
            value={vehicle.placa}
            onChange={e => { setVehicle(veh => ({ ...veh, placa: maskPlaca(e.target.value) })); setErro("") }}
            onKeyDown={onEnter}
            onFocus={() => setFocusedInp("placa")}
            onBlur={() => setFocusedInp(null)}
            placeholder="ABC-1234"
            maxLength={8}
          />
        )

      case "modeloAno":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input
              ref={inputRef}
              style={{ ...inp, ...focusStyle("modelo") }}
              value={vehicle.modelo}
              onChange={e => { setVehicle(v => ({ ...v, modelo: e.target.value })); setErro("") }}
              onKeyDown={onEnter}
              onFocus={() => setFocusedInp("modelo")}
              onBlur={() => setFocusedInp(null)}
              placeholder="Ex: Honda CG 160"
            />
            <div style={{ position: "relative" }}>
              <select
                style={{ ...inp, cursor: "pointer", paddingRight: 44 }}
                value={vehicle.ano}
                onChange={e => setVehicle(v => ({ ...v, ano: e.target.value }))}
              >
                {ANOS.map(a => <option key={a}>{a}</option>)}
              </select>
              <span style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9ca3af", fontSize: 14 }}>▼</span>
            </div>
          </div>
        )

      case "cnh":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input
              ref={inputRef}
              style={{ ...inp, ...focusStyle("cnh"), letterSpacing: 2 }}
              value={vehicle.cnh}
              onChange={e => { setVehicle(v => ({ ...v, cnh: e.target.value.replace(/\D/g, "").slice(0, 11) })); setErro("") }}
              onKeyDown={onEnter}
              onFocus={() => setFocusedInp("cnh")}
              onBlur={() => setFocusedInp(null)}
              placeholder="Número da CNH (11 dígitos)"
              inputMode="numeric"
              maxLength={11}
            />
            <div style={{ position: "relative" }}>
              <select
                style={{ ...inp, cursor: "pointer", paddingRight: 44 }}
                value={vehicle.categoriaCnh}
                onChange={e => setVehicle(v => ({ ...v, categoriaCnh: e.target.value }))}
              >
                <option value="A">Categoria A — Motocicleta</option>
                <option value="AB">Categoria AB</option>
                <option value="B">Categoria B — Carro</option>
                <option value="ACC">Categoria ACC</option>
              </select>
              <span style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9ca3af", fontSize: 14 }}>▼</span>
            </div>
            <div>
              <p style={{ color: "#6B7280", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Validade da CNH</p>
              <input
                type="date"
                style={{ ...inp, ...focusStyle("valCnh") }}
                value={vehicle.validadeCnh}
                onChange={e => { setVehicle(v => ({ ...v, validadeCnh: e.target.value })); setErro("") }}
                onFocus={() => setFocusedInp("valCnh")}
                onBlur={() => setFocusedInp(null)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>
        )

      case "cnhFrente":
        return (
          <FileUpload
            label={needsVehicleDoc ? "Frente da CNH" : "Frente do RG ou CNH"}
            value={docs.cnhFrente}
            onChange={f => { setDocs(d => ({ ...d, cnhFrente: f })); setErro("") }}
            required
            light
          />
        )

      case "cnhVerso":
        return (
          <FileUpload
            label={needsVehicleDoc ? "Verso da CNH" : "Verso do RG ou CNH"}
            value={docs.cnhVerso}
            onChange={f => { setDocs(d => ({ ...d, cnhVerso: f })); setErro("") }}
            required
            light
          />
        )

      case "crlv":
        return (
          <FileUpload
            label="CRLV do veículo"
            value={docs.crlv}
            onChange={f => { setDocs(d => ({ ...d, crlv: f })); setErro("") }}
            required
            light
          />
        )

      case "selfie":
        return (
          <FileUpload
            label="Selfie segurando o documento"
            value={docs.selfie}
            onChange={f => { setDocs(d => ({ ...d, selfie: f })); setErro("") }}
            required
            light
          />
        )

      case "banco":
        return (
          <BankFields
            data={bank}
            onChange={b => { setBank(b); setErro("") }}
            autoFillDoc={personal.cpf}
            errors={{ banco: undefined, agencia: undefined, conta: undefined, cpfTitular: undefined }}
            light
          />
        )

      default:
        return null
    }
  }

  // ─── Animation variants ─────────────────────────────────────────────────────
  const variants = {
    enter:  (d: number) => ({ x: d * 56, y: 8, opacity: 0 }),
    center: { x: 0, y: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d * -56, y: -8, opacity: 0 }),
  }

  // ─── Success screen ─────────────────────────────────────────────────────────
  if (sucesso) {
    return (
      <div style={{ minHeight: "100vh", background: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          style={{
            background: "white", borderRadius: 28, padding: "48px 36px",
            textAlign: "center", maxWidth: 400, width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)",
            border: "1px solid #F1F5F9",
          }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 15 }}
            style={{
              width: 90, height: 90, borderRadius: "50%",
              background: "linear-gradient(135deg, #dcfce7, #bbf7d0)",
              border: "2px solid #86efac",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 28px", fontSize: 44,
            }}
          >
            ✅
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", marginBottom: 10, letterSpacing: "-0.5px" }}>
              Cadastro enviado!
            </h2>
            <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7, marginBottom: 8 }}>
              Recebemos seus dados com sucesso.
            </p>
            <p style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.7, marginBottom: 32 }}>
              Nossa equipe vai analisar em até 48h. Após aprovação, você receberá o contrato digital para assinar e poderá começar a fazer entregas.
            </p>
            <a
              href="/"
              style={{
                display: "block", padding: "16px", borderRadius: 14,
                background: "linear-gradient(135deg, #DC2626, #C41E3A)",
                color: "white", fontWeight: 800, textDecoration: "none",
                fontSize: 15, letterSpacing: "-0.2px",
                boxShadow: "0 4px 20px rgba(220,38,38,0.3)",
              }}
            >
              Voltar ao início
            </a>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  // ─── Main form ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "white" }} data-light-form="">
      <style>{LIGHT_CSS}</style>

      {/* ── Top progress stripe ───────────────────────────────────────────── */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 4, background: "#F1F5F9", zIndex: 60 }}>
        <motion.div
          style={{
            height: "100%", originX: 0,
            background: "linear-gradient(90deg, #DC2626, #f97316)",
          }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* ── Fixed header ─────────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 4, left: 0, right: 0, zIndex: 50,
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #F1F5F9",
      }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "13px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          {/* Back / close */}
          {stepIdx > 0 ? (
            <button
              onClick={back}
              style={{
                background: "#F8FAFC", border: "1.5px solid #E2E8F0",
                cursor: "pointer", color: "#475569",
                width: 38, height: 38, borderRadius: 11,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0, transition: "all 0.15s",
              }}
            >
              ←
            </button>
          ) : (
            <a
              href="/"
              style={{
                background: "#F8FAFC", border: "1.5px solid #E2E8F0",
                color: "#475569", width: 38, height: 38, borderRadius: 11,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0, textDecoration: "none",
              }}
            >
              ←
            </a>
          )}

          {/* Logo centered */}
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <img src="/logo-chego.png" alt="Chegô" style={{ height: 32, objectFit: "contain" }} />
          </div>

          {/* Step pill */}
          <div style={{
            background: "#F8FAFC", border: "1.5px solid #E2E8F0",
            borderRadius: 10, padding: "6px 12px",
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#DC2626",
              boxShadow: "0 0 0 2px rgba(220,38,38,0.2)",
            }} />
            <span style={{ color: "#475569", fontSize: 12, fontWeight: 700 }}>
              {stepIdx + 1} <span style={{ color: "#CBD5E1" }}>/</span> {totalSteps}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div style={{ paddingTop: 90, paddingBottom: 110, minHeight: "100vh" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "36px 24px 28px" }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStepId}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {/* Category pill */}
              <div style={{ marginBottom: 18 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 999,
                  background: "#FFF1F2", border: "1px solid #FECDD3",
                  color: "#DC2626", fontSize: 11, fontWeight: 800,
                  textTransform: "uppercase", letterSpacing: 1.4,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#DC2626", display: "inline-block" }} />
                  {meta.category}
                </span>
              </div>

              {/* Big question */}
              <h1 style={{
                color: "#0F172A", fontSize: 29, fontWeight: 900,
                lineHeight: 1.2, marginBottom: meta.hint ? 10 : 28,
                letterSpacing: "-0.5px",
              }}>
                {meta.question}
              </h1>

              {/* Hint */}
              {meta.hint && (
                <p style={{
                  color: "#64748B", fontSize: 15, lineHeight: 1.65,
                  marginBottom: 28,
                }}>
                  {meta.hint}
                </p>
              )}

              {/* Input area */}
              {renderInput()}

              {/* Error */}
              <AnimatePresence>
                {erro && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    style={{
                      marginTop: 14, padding: "13px 16px", borderRadius: 12,
                      background: "#FFF1F2", border: "1px solid #FECDD3",
                      color: "#DC2626", fontSize: 14, fontWeight: 500,
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                    {erro}
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Fixed bottom CTA ─────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid #F1F5F9",
        padding: "16px 24px",
        paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
      }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <button
            onClick={next}
            disabled={loading}
            style={{
              width: "100%", padding: "18px 24px", borderRadius: 16,
              background: loading
                ? "#fca5a5"
                : "linear-gradient(135deg, #DC2626 0%, #C41E3A 100%)",
              color: "white", fontWeight: 800, fontSize: 16,
              border: "none", cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: loading
                ? "none"
                : "0 4px 24px rgba(220,38,38,0.32), inset 0 1px 0 rgba(255,255,255,0.15)",
              transition: "all 0.15s",
              letterSpacing: "-0.2px",
            }}
          >
            {loading ? (
              <>
                <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid white", borderTopColor: "transparent", animation: "chego-spin 0.8s linear infinite", display: "inline-block" }} />
                Enviando...
              </>
            ) : isLastStep ? (
              <>Enviar cadastro <span style={{ fontSize: 18 }}>✓</span></>
            ) : (
              <>Continuar <span style={{ fontSize: 18 }}>→</span></>
            )}
          </button>
        </div>
      </div>

    </div>
  )
}
