"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

const STEP_LABELS = ["Dados pessoais", "Veículo e CNH", "PIX"]

export default function CadastroMotoboy() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [form, setForm] = useState({
    nome: "", telefone: "", cpf: "", email: "",
    veiculo: "Moto", placa: "", cnh: "",
    pix_key: "",
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function validarStep1() {
    if (!form.nome.trim()) { alert("Informe seu nome completo."); return false }
    if (!form.cpf.trim()) { alert("Informe seu CPF."); return false }
    if (!form.telefone.trim()) { alert("Informe seu WhatsApp."); return false }
    if (!form.email.trim()) { alert("Informe seu email."); return false }
    return true
  }

  function validarStep2() {
    if (!form.placa.trim()) { alert("Informe a placa do veículo."); return false }
    return true
  }

  function validarStep3() {
    if (!form.pix_key.trim()) { alert("Informe sua chave PIX."); return false }
    return true
  }

  async function enviar() {
    if (!validarStep3()) return
    setLoading(true)
    try {
      const { error } = await supabase.from("motoboys").insert({
        nome:       form.nome.trim(),
        telefone:   form.telefone.trim(),
        cpf:        form.cpf.trim(),
        email:      form.email.trim().toLowerCase(),
        veiculo:    form.veiculo,
        placa:      form.placa.trim().toUpperCase(),
        cnh:        form.cnh.trim(),
        pix_key:    form.pix_key.trim(),
        status:     "pendente",
        disponivel: false,
      })
      if (error) throw error
      setSucesso(true)
    } catch {
      alert("Erro ao cadastrar. Tente novamente.")
    }
    setLoading(false)
  }

  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0a0a0a" }}>
        <div className="card p-8 text-center max-w-sm w-full">
          <p className="text-5xl mb-4">🎉</p>
          <h2 className="text-xl font-black text-white mb-2">Cadastro enviado!</h2>
          <p className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
            Recebemos seus dados! Nossa equipe analisará em até 48h.
          </p>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.3)" }}>
            Após aprovação, você receberá um link para assinar o contrato digital e começar a fazer entregas.
          </p>
          <a href="/" className="btn-ghost w-full justify-center">Voltar ao início</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 flex flex-col items-center" style={{ background: "#0a0a0a" }}>
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <a href="/" className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>← Voltar</a>
          <h1 className="text-2xl font-black text-white mt-3">Quero ser motoboy</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Preencha seus dados. Nossa equipe analisará em até 48h.
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-2">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex-1 h-1 rounded-full"
              style={{ background: step >= s ? "#f97316" : "rgba(255,255,255,0.1)" }} />
          ))}
        </div>
        <p className="text-xs mb-8" style={{ color: "rgba(255,255,255,0.3)" }}>
          Etapa {step} de 3 · {STEP_LABELS[step - 1]}
        </p>

        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <label className="label">Nome completo *</label>
              <input className="input" placeholder="Seu nome" value={form.nome} onChange={e => set("nome", e.target.value)} />
            </div>
            <div>
              <label className="label">CPF *</label>
              <input className="input" placeholder="000.000.000-00" value={form.cpf} onChange={e => set("cpf", e.target.value)} />
            </div>
            <div>
              <label className="label">WhatsApp *</label>
              <input className="input" placeholder="(64) 99999-9999" value={form.telefone} onChange={e => set("telefone", e.target.value)} />
            </div>
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" placeholder="seu@email.com" value={form.email} onChange={e => set("email", e.target.value)} />
            </div>
            <button onClick={() => { if (validarStep1()) setStep(2) }}
              className="btn-primary justify-center" style={{ padding: "14px" }}>
              Próximo →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <label className="label">Tipo de veículo</label>
              <select className="input" value={form.veiculo} onChange={e => set("veiculo", e.target.value)}>
                <option>Moto</option>
                <option>Bicicleta</option>
                <option>Carro</option>
              </select>
            </div>
            <div>
              <label className="label">Placa *</label>
              <input className="input" placeholder="ABC-1234" value={form.placa} onChange={e => set("placa", e.target.value)} />
            </div>
            <div>
              <label className="label">Número da CNH</label>
              <input className="input" placeholder="00000000000" value={form.cnh} onChange={e => set("cnh", e.target.value)} />
            </div>
            <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 12, padding: "12px 16px" }}>
              <p className="text-xs font-bold" style={{ color: "#f97316" }}>💡 Como funciona</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                Você recebe pedidos pelo app, aceita ou recusa, e ganha por entrega realizada. Você define seus próprios horários.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-ghost flex-1 justify-center">← Voltar</button>
              <button onClick={() => { if (validarStep2()) setStep(3) }}
                className="btn-primary flex-1 justify-center" style={{ padding: "14px" }}>
                Próximo →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div>
              <label className="label">Chave PIX para receber *</label>
              <input className="input" placeholder="CPF, email ou número" value={form.pix_key} onChange={e => set("pix_key", e.target.value)} />
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                Usada para pagamento das suas entregas.
              </p>
            </div>

            <div style={{ background: "#111", borderRadius: 12, padding: "16px" }}>
              <p className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>Resumo</p>
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between"><span style={{ color: "rgba(255,255,255,0.3)" }}>Nome</span><span className="font-bold text-white">{form.nome}</span></div>
                <div className="flex justify-between"><span style={{ color: "rgba(255,255,255,0.3)" }}>CPF</span><span className="text-white">{form.cpf}</span></div>
                <div className="flex justify-between"><span style={{ color: "rgba(255,255,255,0.3)" }}>WhatsApp</span><span className="text-white">{form.telefone}</span></div>
                <div className="flex justify-between"><span style={{ color: "rgba(255,255,255,0.3)" }}>Veículo</span><span className="text-white">{form.veiculo} · {form.placa}</span></div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-ghost flex-1 justify-center">← Voltar</button>
              <button onClick={enviar} disabled={loading}
                className="btn-primary flex-1 justify-center" style={{ padding: "14px" }}>
                {loading ? "Enviando..." : "Enviar cadastro ✓"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
