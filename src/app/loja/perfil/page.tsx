"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

type Form = {
  nome: string
  descricao: string
  categoria: string
  endereco: string
  telefone: string
  taxa_entrega: string
  tempo_min: string
  tempo_max: string
  nome_responsavel: string
  email: string
  logo_url: string
  pix_chave: string
}

async function uploadBanner(file: File, loja_id: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `lojas/${loja_id}/banner.${ext}`
  const { data, error } = await supabase.storage
    .from("imagens")
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error || !data) return ""
  const { data: { publicUrl } } = supabase.storage.from("imagens").getPublicUrl(data.path)
  return publicUrl
}

export default function PerfilPage() {
  const { sessao } = useAuth()
  const loja_id = sessao?.role === "lojista" ? sessao.loja_id : null

  const [aberto, setAberto] = useState(false)
  const [status, setStatus] = useState("")
  const [togglingAberto, setTogglingAberto] = useState(false)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string>("")
  const bannerRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<Form>({
    nome: "", descricao: "", categoria: "Restaurante",
    endereco: "", telefone: "",
    taxa_entrega: "", tempo_min: "", tempo_max: "",
    nome_responsavel: "", email: "", logo_url: "", pix_chave: "",
  })

  useEffect(() => {
    if (!loja_id) return
    supabase.from("lojas").select("*").eq("id", loja_id).single().then(({ data }) => {
      if (!data) return
      setAberto(data.aberto)
      setStatus(data.status)
      setForm({
        nome:             data.nome ?? "",
        descricao:        data.descricao ?? "",
        categoria:        data.categoria ?? "Restaurante",
        endereco:         data.endereco ?? "",
        telefone:         data.telefone ?? "",
        taxa_entrega:     String(data.taxa_entrega ?? "5"),
        tempo_min:        String(data.tempo_min ?? "30"),
        tempo_max:        String(data.tempo_max ?? "60"),
        nome_responsavel: data.nome_responsavel ?? "",
        email:            data.email ?? "",
        logo_url:         data.logo_url ?? "",
        pix_chave:        data.pix_chave ?? "",
      })
      setBannerPreview(data.logo_url ?? "")
      setLoading(false)
    })
  }, [loja_id])

  function set(field: keyof Form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function toggleAberto() {
    if (!loja_id) return
    setTogglingAberto(true)
    const novoEstado = !aberto
    await supabase.from("lojas").update({ aberto: novoEstado }).eq("id", loja_id)
    setAberto(novoEstado)
    setTogglingAberto(false)
  }

  async function salvar() {
    if (!loja_id) return
    setSalvando(true)

    let logoFinal = form.logo_url
    if (bannerFile) {
      logoFinal = await uploadBanner(bannerFile, loja_id)
    }

    await supabase.from("lojas").update({
      nome:             form.nome.trim(),
      descricao:        form.descricao.trim(),
      categoria:        form.categoria,
      endereco:         form.endereco.trim(),
      telefone:         form.telefone.trim(),
      taxa_entrega:     parseFloat(form.taxa_entrega) || 0,
      tempo_min:        parseInt(form.tempo_min) || 30,
      tempo_max:        parseInt(form.tempo_max) || 60,
      nome_responsavel: form.nome_responsavel.trim(),
      logo_url:         logoFinal || null,
      pix_chave:        form.pix_chave.trim() || null,
    }).eq("id", loja_id)
    setSalvando(false)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 3000)
  }

  if (loading) return (
    <div className="p-8">
      <p style={{ color: "#9CA3AF" }}>Carregando...</p>
    </div>
  )

  const statusColor: Record<string, string> = {
    ativo: "#22c55e", pendente: "#f59e0b", suspenso: "#ef4444",
  }
  const statusLabel: Record<string, string> = {
    ativo: "Ativa", pendente: "Aguardando aprovação", suspenso: "Suspensa",
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "#111827" }}>Minha loja</h1>
          <div className="flex items-center gap-2 mt-1">
            <span style={{
              display: "inline-block", width: 7, height: 7, borderRadius: "50%",
              background: statusColor[status] ?? "#888",
            }} />
            <p className="text-sm font-semibold" style={{ color: "#6B7280" }}>
              {statusLabel[status] ?? status}
            </p>
          </div>
        </div>
        {salvo && (
          <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 13 }}>✓ Salvo!</span>
        )}
      </div>

      {/* Foto/Banner da loja */}
      <div className="card p-5 mb-6">
        <p className="font-black mb-4" style={{ color: "#111827" }}>Foto da loja</p>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{
            width: 110, height: 110, borderRadius: 16, overflow: "hidden", flexShrink: 0,
            background: "#F3F4F6", border: "2px dashed #D1D5DB",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {bannerPreview ? (
              <img src={bannerPreview} alt="Banner" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p className="text-sm mb-3" style={{ color: "#6B7280" }}>
              Foto exibida na listagem de lojas e na página do seu estabelecimento.
            </p>
            <input
              ref={bannerRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                setBannerFile(f)
                setBannerPreview(URL.createObjectURL(f))
              }}
            />
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => bannerRef.current?.click()} className="btn-ghost" style={{ fontSize: 12 }}>
                {bannerPreview ? "📷 Trocar foto" : "📷 Adicionar foto"}
              </button>
              {bannerPreview && (
                <button type="button"
                  onClick={() => { setBannerFile(null); setBannerPreview(""); setForm(f => ({ ...f, logo_url: "" })); if (bannerRef.current) bannerRef.current.value = "" }}
                  className="text-xs font-semibold"
                  style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", padding: "7px 12px" }}>
                  Remover
                </button>
              )}
            </div>
            <p className="text-xs mt-2" style={{ color: "#D1D5DB" }}>JPG, PNG ou WEBP · recomendado 800×600px</p>
          </div>
        </div>
      </div>

      {/* Toggle Aberto/Fechado */}
      <div className="card p-5 mb-6" style={{
        border: aberto ? "1px solid rgba(34,197,94,0.3)" : "1px solid #e5e7eb",
        background: aberto ? "rgba(34,197,94,0.06)" : undefined,
      }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-black text-base" style={{ color: "#111827" }}>
              {aberto ? "🟢 Loja aberta" : "🔴 Loja fechada"}
            </p>
            <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
              {aberto
                ? "Clientes podem fazer pedidos agora"
                : "Nenhum pedido será recebido enquanto fechada"}
            </p>
          </div>
          <button
            onClick={toggleAberto}
            disabled={togglingAberto || status !== "ativo"}
            style={{
              width: 56, height: 30, borderRadius: 15, border: "none", cursor: status !== "ativo" ? "not-allowed" : "pointer",
              background: aberto ? "#22c55e" : "#E5E7EB",
              position: "relative", transition: "background 0.25s", flexShrink: 0,
              opacity: togglingAberto ? 0.5 : 1,
            }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", background: "white",
              position: "absolute", top: 4, transition: "left 0.25s",
              left: aberto ? 30 : 4,
            }} />
          </button>
        </div>
        {status !== "ativo" && (
          <p className="text-xs mt-3 font-semibold" style={{ color: "#f59e0b" }}>
            Atenção: Só é possível abrir a loja após a aprovação pelo administrador.
          </p>
        )}
      </div>

      {/* Form: Dados da loja */}
      <div className="card p-6 mb-4">
        <p className="font-black mb-5" style={{ color: "#111827" }}>Dados da loja</p>
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div style={{ flex: 2 }}>
              <label className="label">Nome da loja</label>
              <input className="input" value={form.nome} onChange={e => set("nome", e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Categoria</label>
              <select className="input" value={form.categoria} onChange={e => set("categoria", e.target.value)}>
                <option>Restaurante</option>
                <option>Mercadinho</option>
                <option>Farmácia</option>
                <option>Outros</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea className="input" rows={2} value={form.descricao} onChange={e => set("descricao", e.target.value)} />
          </div>
          <div>
            <label className="label">Endereço</label>
            <input className="input" value={form.endereco} onChange={e => set("endereco", e.target.value)} />
          </div>
          <div>
            <label className="label">WhatsApp / Telefone</label>
            <input className="input" value={form.telefone} onChange={e => set("telefone", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Form: Entrega */}
      <div className="card p-6 mb-4">
        <p className="font-black mb-5" style={{ color: "#111827" }}>Entrega</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Taxa de entrega (R$)</label>
            <input className="input" type="number" step="0.50" min="0" value={form.taxa_entrega}
              onChange={e => set("taxa_entrega", e.target.value)} />
          </div>
          <div>
            <label className="label">Tempo mín. (min)</label>
            <input className="input" type="number" min="5" value={form.tempo_min}
              onChange={e => set("tempo_min", e.target.value)} />
          </div>
          <div>
            <label className="label">Tempo máx. (min)</label>
            <input className="input" type="number" min="10" value={form.tempo_max}
              onChange={e => set("tempo_max", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Form: Conta */}
      <div className="card p-6 mb-4">
        <p className="font-black mb-5" style={{ color: "#111827" }}>Conta</p>
        <div className="flex flex-col gap-4">
          <div>
            <label className="label">Nome do responsável</label>
            <input className="input" value={form.nome_responsavel} onChange={e => set("nome_responsavel", e.target.value)} />
          </div>
          <div>
            <label className="label">Email de acesso</label>
            <input className="input" type="email" value={form.email} disabled
              style={{ opacity: 0.5, cursor: "not-allowed" }} />
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
              Para alterar o email, entre em contato com o suporte.
            </p>
          </div>
        </div>
      </div>

      {/* Form: Financeiro */}
      <div className="card p-6 mb-6">
        <p className="font-black mb-2" style={{ color: "#111827" }}>Financeiro</p>
        <p className="text-xs mb-5" style={{ color: "#9CA3AF" }}>
          Chave PIX usada para receber saques da plataforma.
        </p>
        <div>
          <label className="label">Chave PIX para saque</label>
          <input className="input" value={form.pix_chave} onChange={e => set("pix_chave", e.target.value)}
            placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
          {!form.pix_chave && (
            <p className="text-xs mt-2 font-semibold" style={{ color: "#f59e0b" }}>
              Atenção: sem chave PIX você não poderá solicitar saques.
            </p>
          )}
        </div>
      </div>

      <button onClick={salvar} disabled={salvando} className="btn-primary" style={{ padding: "14px 32px" }}>
        {salvando ? "Salvando..." : "Salvar alterações"}
      </button>
    </div>
  )
}
