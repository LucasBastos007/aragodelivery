"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { StepIndicator } from "@/components/cadastro/StepIndicator"
import { FormInput } from "@/components/cadastro/FormInput"
import { PasswordField } from "@/components/cadastro/PasswordField"
import { FileUpload } from "@/components/cadastro/FileUpload"
import { AddressFields, AddressData } from "@/components/cadastro/AddressFields"
import { BankFields, BankData } from "@/components/cadastro/BankFields"
import { validateCPF, validateEmail, isAdult } from "@/utils/validators"
import { maskCPF, maskPhone, maskPlaca } from "@/utils/masks"

const STEP_LABELS = ["Dados Pessoais", "Endereço", "Veículo", "Documentos", "Dados Bancários"]
const TOTAL_STEPS = 5
const ANO_ATUAL = new Date().getFullYear()
const ANOS = Array.from({ length: ANO_ATUAL - 1999 }, (_, i) => String(ANO_ATUAL - i))

const VEHICLE_TYPES = [
  { id: "Moto", icon: "🏍️" },
  { id: "Bicicleta", icon: "🚲" },
  { id: "Carro", icon: "🚗" },
  { id: "A pé", icon: "🚶" },
]

interface PersonalData {
  nome: string
  cpf: string
  nascimento: string
  genero: string
  email: string
  celular: string
  senha: string
  confirmarSenha: string
}

interface VehicleData {
  tipo: string
  placa: string
  modelo: string
  ano: string
  cnh: string
  categoriaCnh: string
  validadeCnh: string
}

interface DocsData {
  cnhFrente: File | null
  cnhVerso: File | null
  crlv: File | null
  selfie: File | null
}

const emptyPersonal: PersonalData = {
  nome: "", cpf: "", nascimento: "", genero: "Masculino",
  email: "", celular: "", senha: "", confirmarSenha: "",
}

const emptyAddress: AddressData = {
  cep: "", logradouro: "", numero: "", complemento: "",
  bairro: "", cidade: "", estado: "",
}

const emptyVehicle: VehicleData = {
  tipo: "Moto", placa: "", modelo: "", ano: String(ANO_ATUAL),
  cnh: "", categoriaCnh: "A", validadeCnh: "",
}

const emptyDocs: DocsData = { cnhFrente: null, cnhVerso: null, crlv: null, selfie: null }

const emptyBank: BankData = {
  banco: "", tipoConta: "Corrente", agencia: "", conta: "",
  cpfTitular: "", mesmoCpf: false,
}

const slide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.22 },
}

export default function CadastroMotoboy() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const [personal, setPersonal] = useState<PersonalData>(emptyPersonal)
  const [address, setAddress] = useState<AddressData>(emptyAddress)
  const [vehicle, setVehicle] = useState<VehicleData>(emptyVehicle)
  const [docs, setDocs] = useState<DocsData>(emptyDocs)
  const [bank, setBank] = useState<BankData>(emptyBank)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const needsVehicleDoc = vehicle.tipo === "Moto" || vehicle.tipo === "Carro"

  function err(field: string, msg: string) {
    setErrors(e => ({ ...e, [field]: msg }))
  }
  function clearErr(field: string) {
    setErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  function validateStep1(): boolean {
    const e: Record<string, string> = {}
    if (!personal.nome.trim()) e.nome = "Informe seu nome completo"
    if (!validateCPF(personal.cpf)) e.cpf = "CPF inválido"
    if (!personal.nascimento) e.nascimento = "Informe sua data de nascimento"
    else if (!isAdult(personal.nascimento)) e.nascimento = "É necessário ter 18 anos ou mais"
    if (!validateEmail(personal.email)) e.email = "E-mail inválido"
    if (personal.celular.replace(/\D/g, "").length < 10) e.celular = "Celular inválido"
    if (personal.senha.length < 8) e.senha = "Mínimo 8 caracteres"
    if (personal.confirmarSenha !== personal.senha) e.confirmarSenha = "As senhas não coincidem"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep2(): boolean {
    const e: Record<string, string> = {}
    if (!address.logradouro.trim()) e.logradouro = "Informe o logradouro"
    if (!address.numero.trim()) e.numero = "Informe o número"
    if (!address.bairro.trim()) e.bairro = "Informe o bairro"
    if (!address.cidade.trim()) e.cep = "Preencha o CEP para buscar o endereço"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep3(): boolean {
    const e: Record<string, string> = {}
    if (needsVehicleDoc) {
      if (!vehicle.placa.trim()) e.placa = "Informe a placa"
      if (!vehicle.modelo.trim()) e.modelo = "Informe o modelo"
      if (!vehicle.cnh.trim()) e.cnh = "Informe o número da CNH"
      if (!vehicle.validadeCnh) e.validadeCnh = "Informe a validade da CNH"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep4(): boolean {
    const e: Record<string, string> = {}
    if (!docs.cnhFrente) e.cnhFrente = "Anexe a frente da CNH"
    if (!docs.cnhVerso) e.cnhVerso = "Anexe o verso da CNH"
    if (needsVehicleDoc && !docs.crlv) e.crlv = "Anexe o CRLV do veículo"
    if (!docs.selfie) e.selfie = "Anexe a selfie com o documento"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep5(): boolean {
    const e: Record<string, string> = {}
    if (!bank.banco) e.banco = "Selecione o banco"
    if (!bank.agencia.trim()) e.agencia = "Informe a agência"
    if (!bank.conta.trim()) e.conta = "Informe a conta"
    if (!bank.cpfTitular.trim()) e.cpfTitular = "Informe o CPF/CNPJ do titular"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    const validators: Record<number, () => boolean> = {
      1: validateStep1, 2: validateStep2, 3: validateStep3,
      4: validateStep4, 5: validateStep5,
    }
    if (validators[step]()) setStep(s => s + 1)
  }

  function back() {
    setErrors({})
    setStep(s => s - 1)
  }

  async function enviar() {
    if (!validateStep5()) return
    setLoading(true)
    try {
      const enderecoStr = `${address.logradouro}, ${address.numero}${address.complemento ? " " + address.complemento : ""} - ${address.bairro}, ${address.cidade}/${address.estado} - CEP ${address.cep}`

      let authUserId: string | null = null
      const { data: authData } = await supabase.auth.signUp({
        email: personal.email.trim().toLowerCase(),
        password: personal.senha,
      })
      authUserId = authData.user?.id ?? null

      const payload = {
        nome: personal.nome.trim(),
        email: personal.email.trim().toLowerCase(),
        telefone: personal.celular,
        cpf: personal.cpf,
        veiculo: vehicle.tipo,
        placa: vehicle.placa.toUpperCase(),
        cnh: vehicle.cnh,
        endereco: enderecoStr,
        pix_key: `${bank.banco} Ag:${bank.agencia} Cc:${bank.conta}`,
        status: "pendente" as const,
        disponivel: false,
        ...(authUserId ? { user_id: authUserId } : {}),
      }

      const { error } = await supabase.from("motoboys").insert(payload)
      if (error) throw error
      setSucesso(true)
    } catch (e) {
      console.error(e)
      alert("Erro ao enviar cadastro. Verifique os dados e tente novamente.")
    }
    setLoading(false)
  }

  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0a0a0a" }}>
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="card p-8 text-center max-w-sm w-full"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.3)" }}
          >
            <span className="text-4xl">✅</span>
          </motion.div>
          <h2 className="text-xl font-black text-white mb-2">Cadastro enviado!</h2>
          <p className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
            Recebemos seus dados. Nossa equipe analisará em até 48h.
          </p>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.3)" }}>
            Após aprovação, você receberá um link para assinar o contrato digital e começar a fazer entregas.
          </p>
          <a href="/" className="btn-ghost w-full justify-center">
            Voltar ao início
          </a>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 flex flex-col items-center" style={{ background: "#0a0a0a" }}>
      <div className="w-full max-w-md">
        <div className="mb-7">
          <a href="/" className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>
            ← Voltar
          </a>
          <h1 className="text-2xl font-black text-white mt-3">Quero ser entregador</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Preencha seus dados. Nossa equipe analisará em até 48h.
          </p>
        </div>

        <StepIndicator current={step} total={TOTAL_STEPS} labels={STEP_LABELS} />

        <AnimatePresence mode="wait">
          <motion.div key={step} {...slide}>

            {/* ── ETAPA 1 — Dados Pessoais ────────────────────────────── */}
            {step === 1 && (
              <div className="flex flex-col gap-4">
                <FormInput
                  label="Nome completo"
                  placeholder="Seu nome completo"
                  value={personal.nome}
                  onChange={e => { setPersonal(p => ({ ...p, nome: e.target.value })); clearErr("nome") }}
                  error={errors.nome}
                  valid={!errors.nome && personal.nome.trim().length > 3}
                  required
                />
                <FormInput
                  label="CPF"
                  placeholder="000.000.000-00"
                  value={personal.cpf}
                  onChange={e => {
                    const v = maskCPF(e.target.value)
                    setPersonal(p => ({ ...p, cpf: v }))
                    clearErr("cpf")
                  }}
                  error={errors.cpf}
                  valid={!errors.cpf && validateCPF(personal.cpf)}
                  maxLength={14}
                  required
                />
                <FormInput
                  label="Data de nascimento"
                  type="date"
                  value={personal.nascimento}
                  onChange={e => { setPersonal(p => ({ ...p, nascimento: e.target.value })); clearErr("nascimento") }}
                  error={errors.nascimento}
                  valid={!errors.nascimento && !!personal.nascimento && isAdult(personal.nascimento)}
                  max={new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().split("T")[0]}
                  required
                />
                <div>
                  <label htmlFor="genero-sel" className="label">Gênero</label>
                  <select
                    id="genero-sel"
                    className="input"
                    value={personal.genero}
                    onChange={e => setPersonal(p => ({ ...p, genero: e.target.value }))}
                  >
                    <option>Masculino</option>
                    <option>Feminino</option>
                    <option>Prefiro não informar</option>
                  </select>
                </div>
                <FormInput
                  label="E-mail"
                  type="email"
                  placeholder="seu@email.com"
                  value={personal.email}
                  onChange={e => { setPersonal(p => ({ ...p, email: e.target.value })); clearErr("email") }}
                  error={errors.email}
                  valid={!errors.email && validateEmail(personal.email)}
                  required
                />
                <FormInput
                  label="Celular / WhatsApp"
                  placeholder="(00) 00000-0000"
                  value={personal.celular}
                  onChange={e => {
                    const v = maskPhone(e.target.value)
                    setPersonal(p => ({ ...p, celular: v }))
                    clearErr("celular")
                  }}
                  error={errors.celular}
                  valid={!errors.celular && personal.celular.replace(/\D/g, "").length >= 10}
                  maxLength={15}
                  required
                />
                <PasswordField
                  label="Senha"
                  id="senha-motoboy"
                  value={personal.senha}
                  onChange={v => { setPersonal(p => ({ ...p, senha: v })); clearErr("senha") }}
                  error={errors.senha}
                  required
                />
                <PasswordField
                  label="Confirmar senha"
                  id="confirmar-senha-motoboy"
                  value={personal.confirmarSenha}
                  onChange={v => { setPersonal(p => ({ ...p, confirmarSenha: v })); clearErr("confirmarSenha") }}
                  error={errors.confirmarSenha}
                  required
                />
                <button onClick={next} className="btn-primary justify-center mt-2" style={{ padding: "14px" }}>
                  Próximo →
                </button>
              </div>
            )}

            {/* ── ETAPA 2 — Endereço ──────────────────────────────────── */}
            {step === 2 && (
              <div className="flex flex-col gap-2">
                <AddressFields
                  data={address}
                  onChange={setAddress}
                  errors={{
                    logradouro: errors.logradouro,
                    numero: errors.numero,
                    bairro: errors.bairro,
                  }}
                />
                {errors.cep && (
                  <p className="text-xs" style={{ color: "#ef4444" }}>❌ {errors.cep}</p>
                )}
                <div className="flex gap-3 mt-4">
                  <button onClick={back} className="btn-ghost flex-1 justify-center">← Voltar</button>
                  <button onClick={next} className="btn-primary flex-1 justify-center" style={{ padding: "14px" }}>
                    Próximo →
                  </button>
                </div>
              </div>
            )}

            {/* ── ETAPA 3 — Veículo ───────────────────────────────────── */}
            {step === 3 && (
              <div className="flex flex-col gap-5">
                <div>
                  <label className="label">Tipo de veículo *</label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {VEHICLE_TYPES.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVehicle(veh => ({ ...veh, tipo: v.id }))}
                        className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-xs font-semibold transition-all duration-200"
                        style={{
                          background: vehicle.tipo === v.id ? "rgba(249,115,22,0.12)" : "#1a1a1a",
                          border: `1.5px solid ${vehicle.tipo === v.id ? "#f97316" : "#2a2a2a"}`,
                          color: vehicle.tipo === v.id ? "#f97316" : "rgba(255,255,255,0.45)",
                        }}
                      >
                        <span className="text-2xl">{v.icon}</span>
                        {v.id}
                      </button>
                    ))}
                  </div>
                </div>

                {needsVehicleDoc && (
                  <>
                    <FormInput
                      label="Placa"
                      placeholder="ABC-1234"
                      value={vehicle.placa}
                      onChange={e => {
                        const v = maskPlaca(e.target.value)
                        setVehicle(veh => ({ ...veh, placa: v }))
                        clearErr("placa")
                      }}
                      error={errors.placa}
                      maxLength={8}
                      required
                    />
                    <FormInput
                      label="Modelo do veículo"
                      placeholder="Ex: Honda CG 160"
                      value={vehicle.modelo}
                      onChange={e => { setVehicle(veh => ({ ...veh, modelo: e.target.value })); clearErr("modelo") }}
                      error={errors.modelo}
                      required
                    />
                    <div>
                      <label htmlFor="ano-sel" className="label">Ano do veículo *</label>
                      <select
                        id="ano-sel"
                        className="input"
                        value={vehicle.ano}
                        onChange={e => setVehicle(veh => ({ ...veh, ano: e.target.value }))}
                      >
                        {ANOS.map(a => <option key={a}>{a}</option>)}
                      </select>
                    </div>
                    <FormInput
                      label="Número da CNH"
                      placeholder="00000000000"
                      value={vehicle.cnh}
                      onChange={e => { setVehicle(veh => ({ ...veh, cnh: e.target.value.replace(/\D/g, "").slice(0, 11) })); clearErr("cnh") }}
                      error={errors.cnh}
                      required
                    />
                    <div>
                      <label htmlFor="cat-cnh" className="label">Categoria da CNH *</label>
                      <select
                        id="cat-cnh"
                        className="input"
                        value={vehicle.categoriaCnh}
                        onChange={e => setVehicle(veh => ({ ...veh, categoriaCnh: e.target.value }))}
                      >
                        <option value="A">A</option>
                        <option value="AB">AB</option>
                        <option value="B">B</option>
                        <option value="ACC">ACC</option>
                      </select>
                    </div>
                    <FormInput
                      label="Validade da CNH"
                      type="date"
                      value={vehicle.validadeCnh}
                      onChange={e => { setVehicle(veh => ({ ...veh, validadeCnh: e.target.value })); clearErr("validadeCnh") }}
                      error={errors.validadeCnh}
                      min={new Date().toISOString().split("T")[0]}
                      required
                    />
                  </>
                )}

                <div className="flex gap-3">
                  <button onClick={back} className="btn-ghost flex-1 justify-center">← Voltar</button>
                  <button onClick={next} className="btn-primary flex-1 justify-center" style={{ padding: "14px" }}>
                    Próximo →
                  </button>
                </div>
              </div>
            )}

            {/* ── ETAPA 4 — Documentos ────────────────────────────────── */}
            {step === 4 && (
              <div className="flex flex-col gap-5">
                <div
                  className="rounded-xl px-4 py-3 text-xs"
                  style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", color: "rgba(255,255,255,0.5)" }}
                >
                  <span className="font-bold" style={{ color: "#f97316" }}>📋 Por que pedimos os documentos?</span>
                  <br />
                  Para garantir a segurança de todos os usuários, verificamos a identidade e habilitação de cada entregador.
                </div>

                <FileUpload
                  label="CNH — Frente"
                  value={docs.cnhFrente}
                  onChange={f => { setDocs(d => ({ ...d, cnhFrente: f })); clearErr("cnhFrente") }}
                  required
                />
                {errors.cnhFrente && <p className="text-xs -mt-3" style={{ color: "#ef4444" }}>❌ {errors.cnhFrente}</p>}

                <FileUpload
                  label="CNH — Verso"
                  value={docs.cnhVerso}
                  onChange={f => { setDocs(d => ({ ...d, cnhVerso: f })); clearErr("cnhVerso") }}
                  required
                />
                {errors.cnhVerso && <p className="text-xs -mt-3" style={{ color: "#ef4444" }}>❌ {errors.cnhVerso}</p>}

                {needsVehicleDoc && (
                  <>
                    <FileUpload
                      label="CRLV (documento do veículo)"
                      value={docs.crlv}
                      onChange={f => { setDocs(d => ({ ...d, crlv: f })); clearErr("crlv") }}
                      required
                    />
                    {errors.crlv && <p className="text-xs -mt-3" style={{ color: "#ef4444" }}>❌ {errors.crlv}</p>}
                  </>
                )}

                <FileUpload
                  label="Selfie segurando o documento"
                  value={docs.selfie}
                  onChange={f => { setDocs(d => ({ ...d, selfie: f })); clearErr("selfie") }}
                  required
                />
                {errors.selfie && <p className="text-xs -mt-3" style={{ color: "#ef4444" }}>❌ {errors.selfie}</p>}

                <div className="flex gap-3 mt-2">
                  <button onClick={back} className="btn-ghost flex-1 justify-center">← Voltar</button>
                  <button onClick={next} className="btn-primary flex-1 justify-center" style={{ padding: "14px" }}>
                    Próximo →
                  </button>
                </div>
              </div>
            )}

            {/* ── ETAPA 5 — Banco + Resumo ────────────────────────────── */}
            {step === 5 && (
              <div className="flex flex-col gap-5">
                <BankFields
                  data={bank}
                  onChange={setBank}
                  autoFillDoc={personal.cpf}
                  errors={{
                    banco: errors.banco,
                    agencia: errors.agencia,
                    conta: errors.conta,
                    cpfTitular: errors.cpfTitular,
                  }}
                />

                {/* Resumo */}
                <div className="rounded-xl p-4 mt-2" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Resumo do cadastro
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <ResumoSecao titulo="Dados Pessoais" onEdit={() => { setErrors({}); setStep(1) }}>
                      <ResumoLinha label="Nome" valor={personal.nome} />
                      <ResumoLinha label="CPF" valor={personal.cpf} />
                      <ResumoLinha label="E-mail" valor={personal.email} />
                      <ResumoLinha label="Celular" valor={personal.celular} />
                    </ResumoSecao>
                    <ResumoSecao titulo="Endereço" onEdit={() => { setErrors({}); setStep(2) }}>
                      <ResumoLinha label="CEP" valor={address.cep} />
                      <ResumoLinha label="Logradouro" valor={`${address.logradouro}, ${address.numero}`} />
                      <ResumoLinha label="Cidade" valor={`${address.cidade}/${address.estado}`} />
                    </ResumoSecao>
                    <ResumoSecao titulo="Veículo" onEdit={() => { setErrors({}); setStep(3) }}>
                      <ResumoLinha label="Tipo" valor={vehicle.tipo} />
                      {needsVehicleDoc && (
                        <>
                          <ResumoLinha label="Placa" valor={vehicle.placa} />
                          <ResumoLinha label="Modelo" valor={`${vehicle.modelo} ${vehicle.ano}`} />
                        </>
                      )}
                    </ResumoSecao>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={back} className="btn-ghost flex-1 justify-center">← Voltar</button>
                  <button
                    onClick={enviar}
                    disabled={loading}
                    className="btn-primary flex-1 justify-center"
                    style={{ padding: "14px" }}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />
                        Enviando...
                      </span>
                    ) : (
                      "Enviar cadastro ✓"
                    )}
                  </button>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function ResumoSecao({
  titulo, onEdit, children,
}: {
  titulo: string; onEdit: () => void; children: React.ReactNode
}) {
  return (
    <div className="rounded-lg p-3" style={{ background: "#1a1a1a" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>{titulo}</p>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-semibold"
          style={{ color: "#f97316" }}
        >
          Editar
        </button>
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

function ResumoLinha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between text-xs gap-2">
      <span style={{ color: "rgba(255,255,255,0.3)" }}>{label}</span>
      <span className="text-white font-medium text-right">{valor || "—"}</span>
    </div>
  )
}
