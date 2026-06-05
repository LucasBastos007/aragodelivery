"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

const STEP_LABELS = ["Dados da loja", "Responsável", "Financeiro"]

export default function CadastroLoja() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [form, setForm] = useState({
    nome: "", descricao: "", categoria: "Restaurante",
    endereco: "", telefone: "",
    taxa_entrega: "5.00", tempo_min: "30", tempo_max: "60",
    nome_responsavel: "", cpf_responsavel: "", cnpj: "", email: "",
    pix_key: "",
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function validarStep1() {
    if (!form.nome.trim()) { alert("Informe o nome da loja."); return false }
    if (!form.endereco.trim()) { alert("Informe o endereço."); return false }
    if (!form.telefone.trim()) { alert("Informe o WhatsApp."); return false }
    return true
  }

  function validarStep2() {
    if (!form.nome_responsavel.trim()) { alert("Informe o nome do responsável."); return false }
    if (!form.email.trim()) { alert("Informe o email."); return false }
    return true
  }

  function validarStep3() {
    if (!form.pix_key.trim()) { alert("Informe a chave PIX para receber pagamentos."); return false }
    return true
  }

  async function enviar() {
    if (!validarStep3()) return
    setLoading(true)
    try {
      const { error } = await supabase.from("lojas").insert({
        nome:             form.nome.trim(),
        descricao:        form.descricao.trim(),
        categoria:        form.categoria,
        endereco:         form.endereco.trim(),
        telefone:         form.telefone.trim(),
        taxa_entrega:     parseFloat(form.taxa_entrega),
        tempo_min:        parseInt(form.tempo_min),
        tempo_max:        parseInt(form.tempo_max),
        status:           "pendente",
        aberto:           false,
        comissao:         10,
        nome_responsavel: form.nome_responsavel.trim(),
        cpf_responsavel:  form.cpf_responsavel.trim(),
        cnpj:             form.cnpj.trim(),
        email:            form.email.trim().toLowerCase(),
        pix_key:          form.pix_key.trim(),
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
            Seu cadastro foi recebido e será analisado pela nossa equipe em até 48h.
          </p>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.3)" }}>
            Após aprovação, você receberá um link por WhatsApp para assinar o contrato digital e ativar sua loja.
          </p>
          <a href="/" className="btn-ghost w-full justify-center">Voltar ao início</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 flex flex-col items-center" style={{ background: "#0a0a0a" }}>
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <a href="/" className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>← Voltar</a>
          <h1 className="text-2xl font-black text-white mt-3">Cadastrar minha loja</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Preencha os dados abaixo. Nossa equipe analisará em até 48h.
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
              <label className="label">Nome da loja *</label>
              <input className="input" placeholder="Ex: Lanchonete do Zé" value={form.nome} onChange={e => set("nome", e.target.value)} />
            </div>
            <div>
              <label className="label">Categoria *</label>
              <select className="input" value={form.categoria} onChange={e => set("categoria", e.target.value)}>
                <option>Restaurante</option>
                <option>Mercadinho</option>
                <option>Farmácia</option>
                <option>Outros</option>
              </select>
            </div>
            <div>
              <label className="label">Descrição</label>
              <textarea className="input" rows={3} placeholder="Conte um pouco sobre sua loja..." value={form.descricao} onChange={e => set("descricao", e.target.value)} />
            </div>
            <div>
              <label className="label">Endereço completo *</label>
              <input className="input" placeholder="Rua, número, bairro" value={form.endereco} onChange={e => set("endereco", e.target.value)} />
            </div>
            <div>
              <label className="label">WhatsApp / Telefone *</label>
              <input className="input" placeholder="(64) 99999-9999" value={form.telefone} onChange={e => set("telefone", e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Taxa entrega (R$)</label>
                <input className="input" type="number" step="0.50" min="0" value={form.taxa_entrega} onChange={e => set("taxa_entrega", e.target.value)} />
              </div>
              <div>
                <label className="label">Tempo mín (min)</label>
                <input className="input" type="number" min="5" value={form.tempo_min} onChange={e => set("tempo_min", e.target.value)} />
              </div>
              <div>
                <label className="label">Tempo máx (min)</label>
                <input className="input" type="number" min="10" value={form.tempo_max} onChange={e => set("tempo_max", e.target.value)} />
              </div>
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
              <label className="label">Nome do responsável *</label>
              <input className="input" placeholder="Nome completo do dono / responsável" value={form.nome_responsavel} onChange={e => set("nome_responsavel", e.target.value)} />
            </div>
            <div>
              <label className="label">CPF do responsável</label>
              <input className="input" placeholder="000.000.000-00" value={form.cpf_responsavel} onChange={e => set("cpf_responsavel", e.target.value)} />
            </div>
            <div>
              <label className="label">CNPJ (se tiver)</label>
              <input className="input" placeholder="00.000.000/0001-00" value={form.cnpj} onChange={e => set("cnpj", e.target.value)} />
            </div>
            <div>
              <label className="label">Email de contato *</label>
              <input className="input" type="email" placeholder="voce@email.com" value={form.email} onChange={e => set("email", e.target.value)} />
            </div>
            <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 12, padding: "12px 16px" }}>
              <p className="text-xs font-bold" style={{ color: "#f97316" }}>ℹ️ Sem senha ainda</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                O acesso ao painel será configurado após a assinatura do contrato digital.
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
              <input className="input" placeholder="CPF, CNPJ, email ou número" value={form.pix_key} onChange={e => set("pix_key", e.target.value)} />
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                Usada para repasse das vendas após comissão de 10%.
              </p>
            </div>

            <div style={{ background: "#111", borderRadius: 12, padding: "16px" }}>
              <p className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>Resumo do cadastro</p>
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between"><span style={{ color: "rgba(255,255,255,0.3)" }}>Loja</span><span className="font-bold text-white">{form.nome}</span></div>
                <div className="flex justify-between"><span style={{ color: "rgba(255,255,255,0.3)" }}>Categoria</span><span className="text-white">{form.categoria}</span></div>
                <div className="flex justify-between"><span style={{ color: "rgba(255,255,255,0.3)" }}>Responsável</span><span className="text-white">{form.nome_responsavel}</span></div>
                <div className="flex justify-between"><span style={{ color: "rgba(255,255,255,0.3)" }}>Email</span><span className="text-white">{form.email}</span></div>
                <div className="flex justify-between"><span style={{ color: "rgba(255,255,255,0.3)" }}>Taxa entrega</span><span className="text-white">R$ {form.taxa_entrega}</span></div>
                <div className="flex justify-between"><span style={{ color: "rgba(255,255,255,0.3)" }}>Comissão</span><span className="text-white">10%</span></div>
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
