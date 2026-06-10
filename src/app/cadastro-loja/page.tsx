"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { StepIndicator } from "@/components/cadastro/StepIndicator"
import { FormInput } from "@/components/cadastro/FormInput"
import { PasswordField } from "@/components/cadastro/PasswordField"
import { AddressFields, AddressData } from "@/components/cadastro/AddressFields"
import { BankFields, BankData } from "@/components/cadastro/BankFields"
import { validateCPF, validateCNPJ, validateEmail } from "@/utils/validators"
import { maskCPF, maskCNPJ, maskPhone, maskCurrency } from "@/utils/masks"
import { fetchCNPJData } from "@/utils/api"

const STEP_LABELS = ["Dados do Negócio", "Endereço", "Responsável", "Configurações", "Dados Bancários"]
const TOTAL_STEPS = 5

const SEGMENTOS = [
  { id: "Pizza", icon: "🍕" },
  { id: "Hambúrguer", icon: "🍔" },
  { id: "Japonesa", icon: "🍣" },
  { id: "Frango", icon: "🐔" },
  { id: "Saudável", icon: "🥗" },
  { id: "Bebidas", icon: "🍺" },
  { id: "Mercado", icon: "🛒" },
  { id: "Farmácia", icon: "💊" },
  { id: "Mexicana", icon: "🌮" },
  { id: "Italiana", icon: "🍝" },
  { id: "Carnes", icon: "🥩" },
  { id: "Doces e Bolos", icon: "🍰" },
  { id: "Outros", icon: "📦" },
]

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

const VANTAGENS = [
  {
    img: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=900&q=85",
    titulo: "Mais vendas todo dia",
    descricao: "Alcance clientes em Aragoiânia que já estão no app procurando aquela comida caseira de todo dia, feita com carinho perto de casa.",
    span: 2,
  },
  {
    img: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&q=85",
    titulo: "Cadastro 100% gratuito",
    descricao: "Cadastre sua loja em minutos, sem burocracia. Nossa equipe cuida de tudo para você começar a vender o mais rápido possível.",
    span: 1,
  },
  {
    img: "https://images.unsplash.com/photo-1526367790999-0150786686a2?w=600&q=85",
    titulo: "Entregadores inclusos",
    descricao: "Entregadores parceiros cuidam de toda a logística. Você foca em preparar os pedidos, eles levam até o cliente com segurança.",
    span: 1,
  },
  {
    img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=85",
    titulo: "Painel de gestão completo",
    descricao: "Pedidos em tempo real, cardápio digital, cupons e relatórios financeiros num único painel.",
    span: 1,
  },
  {
    img: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&q=85",
    titulo: "Pagamento garantido",
    descricao: "Repasse direto na sua conta, sem atrasos e sem risco de inadimplência. Você vende, você recebe.",
    span: 1,
  },
  {
    img: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=900&q=85",
    titulo: "Visibilidade garantida no site e no app",
    descricao: "Anunciamos sua loja tanto no site aragodelivery.vercel.app quanto no app Chegô para aumentar sua demanda. Seu negócio aparece para todos os moradores de Aragoiânia que buscam delivery — mesmo aqueles que ainda não te conhecem.",
    span: 2,
  },
  {
    img: "/aragoiania.jpg",
    titulo: "Seja o primeiro na cidade",
    descricao: "Aragoiânia tem um único app delivery. Chegue antes da concorrência e fideliza os clientes desde o início.",
    span: 1,
  },
  {
    img: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&q=85",
    titulo: "Suporte próximo e real",
    descricao: "Time local em Aragoiânia. Não é call center — é o pessoal da cidade que entende o seu negócio.",
    span: 1,
  },
]

interface BusinessData {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string
  segmento: string
  telefone: string
}

interface ResponsibleData {
  nome: string
  cpf: string
  cargo: string
  email: string
  celular: string
  senha: string
  confirmarSenha: string
}

interface HorarioItem {
  ativo: boolean
  abertura: string
  fechamento: string
}

interface ConfigData {
  horarios: HorarioItem[]
  tempoPreparo: string
  aceitaRetirada: boolean
  valorMinimo: string
}

const emptyBusiness: BusinessData = {
  cnpj: "", razaoSocial: "", nomeFantasia: "", segmento: "Pizza", telefone: "",
}

const emptyAddress: AddressData = {
  cep: "", logradouro: "", numero: "", complemento: "",
  bairro: "", cidade: "", estado: "",
}

const emptyResponsible: ResponsibleData = {
  nome: "", cpf: "", cargo: "Proprietário", email: "", celular: "",
  senha: "", confirmarSenha: "",
}

const emptyConfig: ConfigData = {
  horarios: DIAS.map((_, i) => ({
    ativo: i < 5,
    abertura: "08:00",
    fechamento: "22:00",
  })),
  tempoPreparo: "30",
  aceitaRetirada: true,
  valorMinimo: "R$ 15,00",
}

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

export default function CadastroLoja() {
  const [showForm, setShowForm] = useState(false)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [pontoReferencia, setPontoReferencia] = useState("")
  const [tipoCadastro, setTipoCadastro] = useState<"cnpj" | "cpf" | null>(null)
  const [pixKey, setPixKey] = useState("")
  const [pixTipo, setPixTipo] = useState("cpf")

  const [business, setBusiness] = useState<BusinessData>(emptyBusiness)
  const [address, setAddress] = useState<AddressData>(emptyAddress)
  const [responsible, setResponsible] = useState<ResponsibleData>(emptyResponsible)
  const [config, setConfig] = useState<ConfigData>(emptyConfig)
  const [bank, setBank] = useState<BankData>(emptyBank)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function clearErr(field: string) {
    setErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  async function handleCNPJ(raw: string) {
    const masked = maskCNPJ(raw)
    setBusiness(b => ({ ...b, cnpj: masked }))
    clearErr("cnpj")
    if (masked.replace(/\D/g, "").length === 14) {
      if (!validateCNPJ(masked)) {
        setErrors(e => ({ ...e, cnpj: "CNPJ inválido" }))
        return
      }
      setCnpjLoading(true)
      const data = await fetchCNPJData(masked)
      setCnpjLoading(false)
      if (data) {
        setBusiness(b => ({
          ...b,
          razaoSocial: data.razao_social,
          nomeFantasia: data.nome_fantasia || b.nomeFantasia,
        }))
      }
    }
  }

  function validateStep1(): boolean {
    if (tipoCadastro === null) return false
    const e: Record<string, string> = {}
    if (tipoCadastro === "cnpj") {
      if (!validateCNPJ(business.cnpj)) e.cnpj = "CNPJ inválido"
    } else {
      if (!validateCPF(business.cnpj)) e.cnpj = "CPF inválido"
      if (!business.razaoSocial.trim()) e.razaoSocial = "Informe o nome completo"
    }
    if (!business.nomeFantasia.trim()) e.nomeFantasia = "Informe o nome do estabelecimento"
    if (business.telefone.replace(/\D/g, "").length < 10) e.telefone = "Telefone inválido"
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
    if (!responsible.nome.trim()) e.nomeResp = "Informe o nome do responsável"
    if (!validateCPF(responsible.cpf)) e.cpfResp = "CPF inválido"
    if (!validateEmail(responsible.email)) e.emailResp = "E-mail inválido"
    if (responsible.celular.replace(/\D/g, "").length < 10) e.celularResp = "Celular inválido"
    if (responsible.senha.length < 8) e.senhaResp = "Mínimo 8 caracteres"
    if (responsible.confirmarSenha !== responsible.senha) e.confirmarResp = "As senhas não coincidem"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep4(): boolean {
    return true
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

  function setHorario(idx: number, field: keyof HorarioItem, value: string | boolean) {
    setConfig(c => {
      const h = [...c.horarios]
      h[idx] = { ...h[idx], [field]: value }
      return { ...c, horarios: h }
    })
  }

  async function enviar() {
    if (!validateStep5()) return
    setLoading(true)
    try {
      const enderecoStr = `${address.logradouro}, ${address.numero}${address.complemento ? " " + address.complemento : ""} - ${address.bairro}, ${address.cidade}/${address.estado} - CEP ${address.cep}${pontoReferencia ? ` (Ref: ${pontoReferencia})` : ""}`
      const valorMinimoNum = parseFloat(config.valorMinimo.replace(/[R$\s.]/g, "").replace(",", ".")) || 0
      const prepMin = parseInt(config.tempoPreparo)

      let authUserId: string | null = null
      const { data: authData } = await supabase.auth.signUp({
        email: responsible.email.trim().toLowerCase(),
        password: responsible.senha,
      })
      authUserId = authData.user?.id ?? null

      const pixKeyFinal = pixKey.trim()
        || `${bank.banco} Ag:${bank.agencia} Cc:${bank.conta}`

      const payload = {
        nome: business.nomeFantasia.trim(),
        descricao: tipoCadastro === "cpf" ? business.razaoSocial.trim() : business.razaoSocial.trim(),
        categoria: business.segmento as "Restaurante" | "Mercadinho" | "Farmácia" | "Outros",
        endereco: enderecoStr,
        telefone: business.telefone,
        taxa_entrega: 5,
        tempo_min: prepMin,
        tempo_max: prepMin + 15,
        status: "pendente" as const,
        aberto: false,
        comissao: 10,
        nome_responsavel: tipoCadastro === "cpf" ? business.razaoSocial.trim() : responsible.nome.trim(),
        cpf_responsavel: tipoCadastro === "cpf" ? business.cnpj : responsible.cpf,
        cnpj: tipoCadastro === "cnpj" ? business.cnpj : "",
        email: responsible.email.trim().toLowerCase(),
        pix_key: pixKeyFinal,
        ...(authUserId ? { user_id: authUserId } : {}),
        valor_minimo: valorMinimoNum,
        aceita_retirada: config.aceitaRetirada,
      }

      const { error } = await supabase.from("lojas").insert(payload)
      if (error) throw error
      setSucesso(true)
    } catch (e) {
      console.error(e)
      alert("Erro ao enviar cadastro. Verifique os dados e tente novamente.")
    }
    setLoading(false)
  }

  /* ── SUCESSO ─────────────────────────────────────────────────── */
  if (sucesso) {
    return (
      <div style={{ minHeight: "100vh", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          style={{
            background: "white", borderRadius: 24, padding: 40, textAlign: "center",
            maxWidth: 420, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.1)",
          }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
            style={{
              width: 80, height: 80, borderRadius: "50%",
              background: "rgba(34,197,94,0.1)", border: "2px solid rgba(34,197,94,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <span style={{ fontSize: 40 }}>✅</span>
          </motion.div>
          <img src="/logo-chego.png" alt="Chegô" style={{ height: 48, objectFit: "contain", margin: "0 auto 20px", display: "block" }} />
          <h2 style={{ fontSize: 22, fontWeight: 900, color: "#111", marginBottom: 8 }}>Cadastro enviado!</h2>
          <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 8, lineHeight: 1.6 }}>
            Seu cadastro foi recebido e será analisado em até 48h.
          </p>
          <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 28, lineHeight: 1.6 }}>
            Após aprovação, você receberá um link por WhatsApp para assinar o contrato digital e ativar sua loja.
          </p>
          <a href="/" style={{
            display: "block", padding: "14px", borderRadius: 12,
            background: "#DC2626", color: "white", fontWeight: 700, textDecoration: "none",
            fontSize: 15,
          }}>
            Voltar ao início
          </a>
        </motion.div>
      </div>
    )
  }

  /* ── LANDING — VANTAGENS ─────────────────────────────────────── */
  if (!showForm) {
    return (
      <div style={{ minHeight: "100vh", background: "#F9FAFB" }}>

        {/* Header */}
        <div style={{
          background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          position: "sticky", top: 0, zIndex: 100,
        }}>
          <div style={{
            maxWidth: 1100, margin: "0 auto", padding: "0 24px",
            height: 72, display: "flex", alignItems: "center", gap: 16,
          }}>
            <a href="/" style={{
              display: "flex", alignItems: "center", gap: 8,
              color: "#6B7280", textDecoration: "none", fontSize: 14, fontWeight: 600,
            }}>
              ← Voltar
            </a>
            <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              <img src="/logo-chego.png" alt="Chegô" style={{ height: 48, objectFit: "contain" }} />
            </div>
            <div style={{ width: 70 }} />
          </div>
        </div>

        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg, #991B1B 0%, #DC2626 45%, #EF4444 100%)",
          padding: "64px 24px 72px",
          textAlign: "center", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -60, right: -60, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -40, left: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 1, maxWidth: 620, margin: "0 auto" }}>
            <span style={{
              display: "inline-block", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)",
              color: "white", fontSize: 13, fontWeight: 700, padding: "6px 16px", borderRadius: 50,
              marginBottom: 20, letterSpacing: 0.5,
            }}>
              O delivery de Aragoiânia
            </span>
            <h1 style={{
              color: "white", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 900,
              lineHeight: 1.15, marginBottom: 16,
              textShadow: "0 2px 12px rgba(0,0,0,0.2)",
            }}>
              Leve sua loja para<br />mais clientes agora
            </h1>
            <p style={{ color: "rgba(255,255,255,0.88)", fontSize: "1.1rem", lineHeight: 1.7, marginBottom: 36 }}>
              Cadastre seu negócio no Chegô e comece a receber pedidos hoje.<br />
              Simples, sem custo fixo e com suporte local em Aragoiânia.
            </p>
            <button
              onClick={() => setShowForm(true)}
              style={{
                background: "white", color: "#DC2626", fontWeight: 800, fontSize: 16,
                padding: "16px 40px", borderRadius: 14, border: "none", cursor: "pointer",
                boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)"
                e.currentTarget.style.boxShadow = "0 14px 40px rgba(0,0,0,0.25)"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = ""
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.2)"
              }}
            >
              Quero anunciar minha loja →
            </button>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 14 }}>
              Cadastro gratuito · Análise em até 48h
            </p>
          </div>
        </div>

        {/* Stats */}
        <div style={{ background: "#DC2626", padding: "20px 24px" }}>
          <div style={{
            maxWidth: 800, margin: "0 auto",
            display: "flex", justifyContent: "center", gap: 48, flexWrap: "wrap",
          }}>
            {[
              { num: "100%", label: "Gratuito para cadastrar" },
              { num: "48h", label: "Para ser aprovado" },
              { num: "0", label: "Custo fixo mensal" },
            ].map(({ num, label }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <p style={{ color: "white", fontWeight: 900, fontSize: 26, lineHeight: 1 }}>{num}</p>
                <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 4 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Vantagens */}
        <div style={{ background: "#F1F5F9", padding: "72px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <h2 style={{
                fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 900, color: "#0F172A",
                marginBottom: 12, letterSpacing: "-0.5px",
              }}>
                Por que vender no Chegô?
              </h2>
              <p style={{ color: "#64748B", fontSize: 16, maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
                Tudo que o seu negócio precisa para crescer em Aragoiânia
              </p>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
            }}>
              {VANTAGENS.map((v, i) => (
                <motion.div
                  key={v.titulo}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  style={{
                    gridColumn: `span ${v.span}`,
                    background: "white",
                    borderRadius: 20,
                    overflow: "hidden",
                    boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
                    border: "1px solid rgba(0,0,0,0.04)",
                    cursor: "default",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-5px)"
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = "0 16px 40px rgba(220,38,38,0.13)"
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = ""
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 16px rgba(0,0,0,0.07)"
                  }}
                >
                  {/* Imagem */}
                  <div style={{
                    height: v.span === 2 ? 260 : 190,
                    position: "relative", overflow: "hidden",
                  }}>
                    <img
                      src={v.img}
                      alt={v.titulo}
                      style={{
                        width: "100%", height: "100%", objectFit: "cover",
                        display: "block",
                        transition: "transform 0.4s ease",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)" }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)" }}
                    />
                    {/* Gradiente sutil no bottom da imagem */}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0, height: 60,
                      background: "linear-gradient(to top, rgba(0,0,0,0.18), transparent)",
                      pointerEvents: "none",
                    }} />
                  </div>

                  {/* Texto */}
                  <div style={{ padding: v.span === 2 ? "22px 28px 26px" : "18px 20px 22px" }}>
                    <h3 style={{
                      color: "#0F172A", fontWeight: 800,
                      fontSize: v.span === 2 ? 18 : 15,
                      marginBottom: 8, lineHeight: 1.3,
                    }}>
                      {v.titulo}
                    </h3>
                    <p style={{
                      color: "#64748B", fontSize: v.span === 2 ? 14 : 13,
                      lineHeight: 1.7,
                    }}>
                      {v.descricao}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA final */}
        <div style={{ background: "#111", padding: "56px 24px", textAlign: "center" }}>
          <img src="/logo-chego.png" alt="Chegô" style={{ height: 52, objectFit: "contain", margin: "0 auto 24px", display: "block" }} />
          <h2 style={{ color: "white", fontWeight: 900, fontSize: "1.8rem", marginBottom: 12 }}>
            Pronto para começar?
          </h2>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, marginBottom: 32 }}>
            Preencha o formulário e nossa equipe entra em contato em até 48h.
          </p>
          <button
            onClick={() => { setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }) }}
            style={{
              background: "#DC2626", color: "white", fontWeight: 800, fontSize: 16,
              padding: "16px 44px", borderRadius: 14, border: "none", cursor: "pointer",
              boxShadow: "0 8px 24px rgba(220,38,38,0.4)",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#B91C1C" }}
            onMouseLeave={e => { e.currentTarget.style.background = "#DC2626" }}
          >
            Cadastrar minha loja →
          </button>
        </div>
      </div>
    )
  }

  /* ── FORMULÁRIO ──────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB" }}>
      <style>{`
        [data-light-form] .input {
          background: white !important;
          border: 1.5px solid #e5e7eb !important;
          color: #111 !important;
        }
        [data-light-form] .input::placeholder {
          color: #9ca3af !important;
        }
        [data-light-form] .input:focus {
          border-color: #DC2626 !important;
          box-shadow: 0 0 0 3px rgba(220,38,38,0.08) !important;
        }
        [data-light-form] select.input,
        [data-light-form] select.input option {
          background: white !important;
          color: #111 !important;
        }
        [data-light-form] .label {
          color: #374151 !important;
        }
        [data-light-form] .btn-primary {
          background: #DC2626 !important;
        }
        [data-light-form] .btn-ghost {
          background: #f3f4f6 !important;
          border-color: #e5e7eb !important;
          color: #374151 !important;
        }
        [data-light-form] .btn-ghost:hover {
          background: #e5e7eb !important;
          color: #111 !important;
        }
      `}</style>

      {/* Header */}
      <div style={{
        background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto", padding: "0 24px",
          height: 72, display: "flex", alignItems: "center", gap: 16,
        }}>
          <button
            onClick={() => { setShowForm(false); setStep(1); setErrors({}); setTipoCadastro(null) }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              color: "#6B7280", background: "none", border: "none",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            ← Voltar
          </button>
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <img src="/logo-chego.png" alt="Chegô" style={{ height: 48, objectFit: "contain" }} />
          </div>
          <div style={{ width: 70 }} />
        </div>
      </div>

      {/* Hero compacto */}
      <div style={{
        background: "linear-gradient(135deg, #991B1B 0%, #DC2626 100%)",
        padding: "28px 24px",
        textAlign: "center",
      }}>
        <h1 style={{ color: "white", fontWeight: 900, fontSize: "1.5rem", marginBottom: 4 }}>
          Cadastrar minha loja
        </h1>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
          Preencha os dados abaixo. Nossa equipe analisará em até 48h.
        </p>
      </div>

      {/* Form */}
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 24px 80px" }} data-light-form>

        <StepIndicator current={step} total={TOTAL_STEPS} labels={STEP_LABELS} />

        <AnimatePresence mode="wait">
          <motion.div key={step} {...slide}>

            {/* ── ETAPA 1 — Dados do Negócio ──────────────────────────── */}
            {step === 1 && (
              <div className="flex flex-col gap-4">

                {/* Escolha CNPJ ou CPF */}
                {tipoCadastro === null && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{
                      background: "#FEF2F2", border: "1px solid #FECACA",
                      borderRadius: 14, padding: "18px 20px", marginBottom: 4,
                    }}>
                      <p style={{ color: "#991B1B", fontWeight: 800, fontSize: 17, marginBottom: 4 }}>
                        Você tem CNPJ ativo?
                      </p>
                      <p style={{ color: "#6B7280", fontSize: 13, lineHeight: 1.6 }}>
                        Aceitamos MEI, CNPJ ou apenas CPF. Escolha abaixo:
                      </p>
                    </div>

                    <button
                      onClick={() => { setTipoCadastro("cnpj"); setBusiness(b => ({ ...b, cnpj: "" })) }}
                      style={{
                        display: "flex", alignItems: "center", gap: 16,
                        padding: "18px 20px", borderRadius: 14, border: "1.5px solid #e5e7eb",
                        background: "white", cursor: "pointer", textAlign: "left",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#DC2626"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(220,38,38,0.12)" }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)" }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>
                        🏢
                      </div>
                      <div>
                        <p style={{ color: "#111", fontWeight: 700, fontSize: 15 }}>Sim, tenho CNPJ</p>
                        <p style={{ color: "#6B7280", fontSize: 13 }}>Empresa, MEI ou CNPJ ativo</p>
                      </div>
                      <svg style={{ marginLeft: "auto", color: "#9ca3af", flexShrink: 0 }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>

                    <button
                      onClick={() => { setTipoCadastro("cpf"); setBusiness(b => ({ ...b, cnpj: "" })) }}
                      style={{
                        display: "flex", alignItems: "center", gap: 16,
                        padding: "18px 20px", borderRadius: 14, border: "1.5px solid #e5e7eb",
                        background: "white", cursor: "pointer", textAlign: "left",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#DC2626"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(220,38,38,0.12)" }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)" }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>
                        👤
                      </div>
                      <div>
                        <p style={{ color: "#111", fontWeight: 700, fontSize: 15 }}>Não, vou usar meu CPF</p>
                        <p style={{ color: "#6B7280", fontSize: 13 }}>Autônomo ou negócio informal</p>
                      </div>
                      <svg style={{ marginLeft: "auto", color: "#9ca3af", flexShrink: 0 }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                )}

                {/* Formulário CNPJ */}
                {tipoCadastro === "cnpj" && (<>
                  <button
                    onClick={() => { setTipoCadastro(null); setErrors({}) }}
                    style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}
                  >
                    ← Mudar tipo de cadastro
                  </button>
                  <div>
                    <label htmlFor="cnpj-input" className="label">CNPJ *</label>
                    <div className="relative">
                      <input
                        id="cnpj-input"
                        className="input"
                        placeholder="00.000.000/0000-00"
                        value={business.cnpj}
                        onChange={e => handleCNPJ(e.target.value)}
                        maxLength={18}
                        style={{ borderColor: errors.cnpj ? "#ef4444" : !errors.cnpj && validateCNPJ(business.cnpj) ? "#22c55e" : undefined }}
                      />
                      {cnpjLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                          style={{ borderColor: "#DC2626", borderTopColor: "transparent" }} />
                      )}
                      {!cnpjLoading && validateCNPJ(business.cnpj) && !errors.cnpj && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">✅</span>
                      )}
                    </div>
                    {errors.cnpj && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>❌ {errors.cnpj}</p>}
                  </div>

                  <FormInput
                    label="Razão social"
                    placeholder="Preenchida automaticamente via CNPJ"
                    value={business.razaoSocial}
                    onChange={e => setBusiness(b => ({ ...b, razaoSocial: e.target.value }))}
                    hint="Preenchida automaticamente ao validar o CNPJ"
                  />

                  <FormInput
                    label="Nome da loja / Nome fantasia"
                    placeholder="Ex: Pizzaria do João"
                    value={business.nomeFantasia}
                    onChange={e => { setBusiness(b => ({ ...b, nomeFantasia: e.target.value })); clearErr("nomeFantasia") }}
                    error={errors.nomeFantasia}
                    valid={!errors.nomeFantasia && business.nomeFantasia.trim().length > 2}
                    required
                  />

                  <div>
                    <label className="label">Segmento *</label>
                    <div className="grid grid-cols-4 gap-2 mt-1">
                      {SEGMENTOS.map(s => (
                        <button key={s.id} type="button" onClick={() => setBusiness(b => ({ ...b, segmento: s.id }))}
                          className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-xs font-semibold transition-all duration-200"
                          style={{
                            background: business.segmento === s.id ? "rgba(220,38,38,0.08)" : "white",
                            border: `1.5px solid ${business.segmento === s.id ? "#DC2626" : "#e5e7eb"}`,
                            color: business.segmento === s.id ? "#DC2626" : "#6B7280",
                          }}>
                          <span className="text-xl">{s.icon}</span>
                          <span className="leading-tight text-center" style={{ fontSize: 10 }}>{s.id}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <FormInput
                    label="Telefone comercial"
                    placeholder="(00) 0000-0000"
                    value={business.telefone}
                    onChange={e => { setBusiness(b => ({ ...b, telefone: maskPhone(e.target.value) })); clearErr("telefone") }}
                    error={errors.telefone}
                    valid={!errors.telefone && business.telefone.replace(/\D/g, "").length >= 10}
                    maxLength={15}
                    required
                  />
                  <button onClick={next} className="btn-primary justify-center mt-2" style={{ padding: "14px" }}>
                    Próximo →
                  </button>
                </>)}

                {/* Formulário CPF */}
                {tipoCadastro === "cpf" && (<>
                  <button
                    onClick={() => { setTipoCadastro(null); setErrors({}) }}
                    style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}
                  >
                    ← Mudar tipo de cadastro
                  </button>

                  <div>
                    <label htmlFor="cpf-input" className="label">CPF *</label>
                    <div className="relative">
                      <input
                        id="cpf-input"
                        className="input"
                        placeholder="000.000.000-00"
                        value={business.cnpj}
                        onChange={e => {
                          const v = maskCPF(e.target.value)
                          setBusiness(b => ({ ...b, cnpj: v }))
                          clearErr("cnpj")
                        }}
                        maxLength={14}
                        style={{ borderColor: errors.cnpj ? "#ef4444" : !errors.cnpj && validateCPF(business.cnpj) ? "#22c55e" : undefined }}
                      />
                      {validateCPF(business.cnpj) && !errors.cnpj && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">✅</span>
                      )}
                    </div>
                    {errors.cnpj && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>❌ {errors.cnpj}</p>}
                  </div>

                  <FormInput
                    label="Nome completo *"
                    placeholder="Seu nome completo"
                    value={business.razaoSocial}
                    onChange={e => { setBusiness(b => ({ ...b, razaoSocial: e.target.value })); clearErr("razaoSocial") }}
                    error={errors.razaoSocial}
                    valid={!errors.razaoSocial && business.razaoSocial.trim().length > 3}
                    required
                  />

                  <FormInput
                    label="Nome do estabelecimento *"
                    placeholder="Ex: Lanchonete da Maria"
                    value={business.nomeFantasia}
                    onChange={e => { setBusiness(b => ({ ...b, nomeFantasia: e.target.value })); clearErr("nomeFantasia") }}
                    error={errors.nomeFantasia}
                    valid={!errors.nomeFantasia && business.nomeFantasia.trim().length > 2}
                    required
                  />

                  <div>
                    <label className="label">Segmento *</label>
                    <div className="grid grid-cols-4 gap-2 mt-1">
                      {SEGMENTOS.map(s => (
                        <button key={s.id} type="button" onClick={() => setBusiness(b => ({ ...b, segmento: s.id }))}
                          className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-xs font-semibold transition-all duration-200"
                          style={{
                            background: business.segmento === s.id ? "rgba(220,38,38,0.08)" : "white",
                            border: `1.5px solid ${business.segmento === s.id ? "#DC2626" : "#e5e7eb"}`,
                            color: business.segmento === s.id ? "#DC2626" : "#6B7280",
                          }}>
                          <span className="text-xl">{s.icon}</span>
                          <span className="leading-tight text-center" style={{ fontSize: 10 }}>{s.id}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <FormInput
                    label="Telefone comercial"
                    placeholder="(00) 0000-0000"
                    value={business.telefone}
                    onChange={e => { setBusiness(b => ({ ...b, telefone: maskPhone(e.target.value) })); clearErr("telefone") }}
                    error={errors.telefone}
                    valid={!errors.telefone && business.telefone.replace(/\D/g, "").length >= 10}
                    maxLength={15}
                    required
                  />
                  <button onClick={next} className="btn-primary justify-center mt-2" style={{ padding: "14px" }}>
                    Próximo →
                  </button>
                </>)}
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
                  extra={
                    <FormInput
                      label="Ponto de referência"
                      placeholder="Ex: Próximo ao shopping"
                      value={pontoReferencia}
                      onChange={e => setPontoReferencia(e.target.value)}
                    />
                  }
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

            {/* ── ETAPA 3 — Dados do Responsável ──────────────────────── */}
            {step === 3 && (
              <div className="flex flex-col gap-4">
                <FormInput
                  label="Nome completo do responsável"
                  placeholder="Nome completo"
                  value={responsible.nome}
                  onChange={e => { setResponsible(r => ({ ...r, nome: e.target.value })); clearErr("nomeResp") }}
                  error={errors.nomeResp}
                  valid={!errors.nomeResp && responsible.nome.trim().length > 3}
                  required
                />
                <FormInput
                  label="CPF do responsável"
                  placeholder="000.000.000-00"
                  value={responsible.cpf}
                  onChange={e => {
                    const v = maskCPF(e.target.value)
                    setResponsible(r => ({ ...r, cpf: v }))
                    clearErr("cpfResp")
                  }}
                  error={errors.cpfResp}
                  valid={!errors.cpfResp && validateCPF(responsible.cpf)}
                  maxLength={14}
                  required
                />
                <div>
                  <label htmlFor="cargo-sel" className="label">Cargo *</label>
                  <select
                    id="cargo-sel"
                    className="input"
                    value={responsible.cargo}
                    onChange={e => setResponsible(r => ({ ...r, cargo: e.target.value }))}
                  >
                    <option>Proprietário</option>
                    <option>Gerente</option>
                    <option>Sócio</option>
                    <option>Representante Legal</option>
                  </select>
                </div>
                <FormInput
                  label="E-mail"
                  type="email"
                  placeholder="responsavel@email.com"
                  value={responsible.email}
                  onChange={e => { setResponsible(r => ({ ...r, email: e.target.value })); clearErr("emailResp") }}
                  error={errors.emailResp}
                  valid={!errors.emailResp && validateEmail(responsible.email)}
                  required
                />
                <FormInput
                  label="Celular / WhatsApp"
                  placeholder="(00) 00000-0000"
                  value={responsible.celular}
                  onChange={e => {
                    const v = maskPhone(e.target.value)
                    setResponsible(r => ({ ...r, celular: v }))
                    clearErr("celularResp")
                  }}
                  error={errors.celularResp}
                  valid={!errors.celularResp && responsible.celular.replace(/\D/g, "").length >= 10}
                  maxLength={15}
                  required
                />
                <PasswordField
                  label="Senha"
                  id="senha-loja"
                  value={responsible.senha}
                  onChange={v => { setResponsible(r => ({ ...r, senha: v })); clearErr("senhaResp") }}
                  error={errors.senhaResp}
                  required
                />
                <PasswordField
                  label="Confirmar senha"
                  id="confirmar-senha-loja"
                  value={responsible.confirmarSenha}
                  onChange={v => { setResponsible(r => ({ ...r, confirmarSenha: v })); clearErr("confirmarResp") }}
                  error={errors.confirmarResp}
                  required
                />
                <div className="flex gap-3 mt-2">
                  <button onClick={back} className="btn-ghost flex-1 justify-center">← Voltar</button>
                  <button onClick={next} className="btn-primary flex-1 justify-center" style={{ padding: "14px" }}>
                    Próximo →
                  </button>
                </div>
              </div>
            )}

            {/* ── ETAPA 4 — Configurações da Loja ─────────────────────── */}
            {step === 4 && (
              <div className="flex flex-col gap-5">
                <div>
                  <label className="label mb-3">Horários de funcionamento</label>
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ border: "1.5px solid #e5e7eb", background: "white" }}
                  >
                    {DIAS.map((dia, i) => (
                      <div
                        key={dia}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{ borderBottom: i < DIAS.length - 1 ? "1px solid #f3f4f6" : "none" }}
                      >
                        <button
                          type="button"
                          onClick={() => setHorario(i, "ativo", !config.horarios[i].ativo)}
                          className="relative w-9 h-5 rounded-full transition-all duration-200 shrink-0"
                          style={{ background: config.horarios[i].ativo ? "#DC2626" : "#e5e7eb" }}
                          aria-checked={config.horarios[i].ativo}
                          role="switch"
                          aria-label={`${dia} ativo`}
                        >
                          <span
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
                            style={{ left: config.horarios[i].ativo ? "calc(100% - 18px)" : "2px" }}
                          />
                        </button>
                        <span
                          className="text-xs font-semibold w-8 shrink-0"
                          style={{ color: config.horarios[i].ativo ? "#111" : "#9ca3af" }}
                        >
                          {dia}
                        </span>
                        {config.horarios[i].ativo ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="time"
                              className="input py-1.5 text-xs"
                              value={config.horarios[i].abertura}
                              onChange={e => setHorario(i, "abertura", e.target.value)}
                              style={{ flex: 1 }}
                            />
                            <span className="text-xs" style={{ color: "#9ca3af" }}>às</span>
                            <input
                              type="time"
                              className="input py-1.5 text-xs"
                              value={config.horarios[i].fechamento}
                              onChange={e => setHorario(i, "fechamento", e.target.value)}
                              style={{ flex: 1 }}
                            />
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: "#d1d5db" }}>Fechado</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="preparo-sel" className="label">Tempo médio de preparo *</label>
                  <select
                    id="preparo-sel"
                    className="input"
                    value={config.tempoPreparo}
                    onChange={e => setConfig(c => ({ ...c, tempoPreparo: e.target.value }))}
                  >
                    {["15", "20", "30", "45", "60", "90"].map(v => (
                      <option key={v} value={v}>{v} min</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: "white", border: "1.5px solid #e5e7eb" }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#111" }}>Aceita retirada no local</p>
                    <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                      Cliente pode retirar o pedido pessoalmente
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfig(c => ({ ...c, aceitaRetirada: !c.aceitaRetirada }))}
                    className="relative w-11 h-6 rounded-full transition-all duration-200 shrink-0"
                    style={{ background: config.aceitaRetirada ? "#DC2626" : "#e5e7eb" }}
                    role="switch"
                    aria-checked={config.aceitaRetirada}
                    aria-label="Aceita retirada"
                  >
                    <span
                      className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200"
                      style={{ left: config.aceitaRetirada ? "calc(100% - 18px)" : "4px" }}
                    />
                  </button>
                </div>

                <div>
                  <label htmlFor="valor-min" className="label">Valor mínimo do pedido</label>
                  <input
                    id="valor-min"
                    className="input"
                    placeholder="R$ 0,00"
                    value={config.valorMinimo}
                    onChange={e => setConfig(c => ({ ...c, valorMinimo: maskCurrency(e.target.value) }))}
                  />
                </div>

                <div className="flex gap-3 mt-2">
                  <button onClick={back} className="btn-ghost flex-1 justify-center">← Voltar</button>
                  <button onClick={next} className="btn-primary flex-1 justify-center" style={{ padding: "14px" }}>
                    Próximo →
                  </button>
                </div>
              </div>
            )}

            {/* ── ETAPA 5 — Dados Bancários + Resumo ─────────────────── */}
            {step === 5 && (
              <div className="flex flex-col gap-5">
                <BankFields
                  data={bank}
                  onChange={setBank}
                  autoFillDoc={business.cnpj}
                  errors={{
                    banco: errors.banco,
                    agencia: errors.agencia,
                    conta: errors.conta,
                    cpfTitular: errors.cpfTitular,
                  }}
                />

                {/* Chave PIX */}
                <div style={{ borderTop: "1.5px solid #f3f4f6", paddingTop: 20 }}>
                  <label className="label" style={{ marginBottom: 8, display: "block" }}>
                    Chave PIX (opcional)
                  </label>
                  <p style={{ color: "#6B7280", fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
                    Se preferir receber por PIX, informe sua chave. Caso contrário, usaremos os dados bancários acima.
                  </p>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    {[
                      { id: "cpf",      label: "CPF" },
                      { id: "cnpj",     label: "CNPJ" },
                      { id: "email",    label: "E-mail" },
                      { id: "telefone", label: "Telefone" },
                      { id: "aleatoria",label: "Chave aleatória" },
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setPixTipo(t.id); setPixKey("") }}
                        style={{
                          padding: "6px 14px", borderRadius: 50, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          background: pixTipo === t.id ? "rgba(220,38,38,0.08)" : "white",
                          border: `1.5px solid ${pixTipo === t.id ? "#DC2626" : "#e5e7eb"}`,
                          color: pixTipo === t.id ? "#DC2626" : "#6B7280",
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <input
                    className="input"
                    placeholder={
                      pixTipo === "cpf"       ? "000.000.000-00" :
                      pixTipo === "cnpj"      ? "00.000.000/0000-00" :
                      pixTipo === "email"     ? "seu@email.com" :
                      pixTipo === "telefone"  ? "(00) 00000-0000" :
                      "Chave aleatória (32 caracteres)"
                    }
                    value={pixKey}
                    onChange={e => setPixKey(e.target.value)}
                  />
                </div>

                {/* Resumo */}
                <div className="rounded-xl p-4 mt-2" style={{ background: "#FFF8F5", border: "1.5px solid #FED7AA" }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#9ca3af" }}>
                    Resumo do cadastro
                  </p>
                  <div className="flex flex-col gap-3">
                    <ResumoSecao titulo="Negócio" onEdit={() => { setErrors({}); setStep(1) }}>
                      <ResumoLinha label="CNPJ" valor={business.cnpj} />
                      <ResumoLinha label="Nome" valor={business.nomeFantasia} />
                      <ResumoLinha label="Segmento" valor={business.segmento} />
                      <ResumoLinha label="Telefone" valor={business.telefone} />
                    </ResumoSecao>
                    <ResumoSecao titulo="Endereço" onEdit={() => { setErrors({}); setStep(2) }}>
                      <ResumoLinha label="CEP" valor={address.cep} />
                      <ResumoLinha label="Logradouro" valor={`${address.logradouro}, ${address.numero}`} />
                      <ResumoLinha label="Cidade" valor={`${address.cidade}/${address.estado}`} />
                    </ResumoSecao>
                    <ResumoSecao titulo="Responsável" onEdit={() => { setErrors({}); setStep(3) }}>
                      <ResumoLinha label="Nome" valor={responsible.nome} />
                      <ResumoLinha label="Cargo" valor={responsible.cargo} />
                      <ResumoLinha label="E-mail" valor={responsible.email} />
                    </ResumoSecao>
                    <ResumoSecao titulo="Configurações" onEdit={() => { setErrors({}); setStep(4) }}>
                      <ResumoLinha label="Preparo" valor={`${config.tempoPreparo} min`} />
                      <ResumoLinha label="Valor mínimo" valor={config.valorMinimo || "Sem mínimo"} />
                      <ResumoLinha label="Retirada" valor={config.aceitaRetirada ? "Sim" : "Não"} />
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
    <div className="rounded-lg p-3" style={{ background: "white", border: "1px solid #f3f4f6" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold" style={{ color: "#9ca3af" }}>{titulo}</p>
        <button type="button" onClick={onEdit} className="text-xs font-semibold" style={{ color: "#DC2626" }}>
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
      <span style={{ color: "#9ca3af" }}>{label}</span>
      <span style={{ color: "#111", fontWeight: 600 }} className="text-right">{valor || "—"}</span>
    </div>
  )
}
