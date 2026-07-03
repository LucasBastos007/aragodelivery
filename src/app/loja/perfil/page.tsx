"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

type DiaSemana = "dom" | "seg" | "ter" | "qua" | "qui" | "sex" | "sab"
type DiaConfig = { aberto: boolean; inicio: string; fim: string }
type Horarios = { tipo: "sempre_aberto" | "por_horario"; dias: Record<DiaSemana, DiaConfig> }

const DIAS: { key: DiaSemana; label: string }[] = [
  { key: "dom", label: "Domingo" },
  { key: "seg", label: "Segunda" },
  { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
]

const HORARIOS_PADRAO: Horarios = {
  tipo: "sempre_aberto",
  dias: {
    dom: { aberto: true, inicio: "08:00", fim: "22:00" },
    seg: { aberto: true, inicio: "08:00", fim: "22:00" },
    ter: { aberto: true, inicio: "08:00", fim: "22:00" },
    qua: { aberto: true, inicio: "08:00", fim: "22:00" },
    qui: { aberto: true, inicio: "08:00", fim: "22:00" },
    sex: { aberto: true, inicio: "08:00", fim: "22:00" },
    sab: { aberto: true, inicio: "08:00", fim: "22:00" },
  },
}

type Form = {
  nome: string; descricao: string; categoria: string
  cep: string; logradouro: string; numero: string; complemento: string
  bairro: string; cidade: string; estado: string
  telefone: string; taxa_entrega: string; tempo_min: string; tempo_max: string
  nome_responsavel: string; email: string; logo_url: string; pix_chave: string
}

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const query = `${address}, Aragoiânia, GO, Brasil`

  // Tenta Google Maps se a chave estiver configurada
  try {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
    if (key) {
      const q   = encodeURIComponent(query)
      const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${key}`)
      const data = await res.json()
      if (data.status === "OK" && data.results[0]) {
        const loc = data.results[0].geometry.location
        return [loc.lat, loc.lng]
      }
    }
  } catch {}

  // Fallback: Nominatim (OpenStreetMap, gratuito)
  try {
    const q   = encodeURIComponent(query)
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=br`,
      { headers: { "Accept-Language": "pt-BR", "User-Agent": "ChegôDelivery/1.0" } }
    )
    const data = await res.json()
    if (data?.[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
  } catch {}

  return null
}

async function uploadBanner(file: File, loja_id: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `lojas/${loja_id}/banner.${ext}`
  const form = new FormData()
  form.append("file", file)
  form.append("path", path)
  const res = await fetch("/api/upload", { method: "POST", body: form })
  if (!res.ok) return ""
  const data = await res.json()
  return data.url ?? ""
}

async function buscarCep(cep: string) {
  const clean = cep.replace(/\D/g, "")
  if (clean.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
    const d = await res.json()
    if (d.erro) return null
    return d
  } catch { return null }
}

function horariosEstaAberto(horarios: Horarios): boolean {
  if (horarios.tipo === "sempre_aberto") return true
  const agora = new Date()
  const diasSemana: DiaSemana[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"]
  const diaAtual = diasSemana[agora.getDay()]
  const config = horarios.dias[diaAtual]
  if (!config.aberto) return false
  const [hIni, mIni] = config.inicio.split(":").map(Number)
  const [hFim, mFim] = config.fim.split(":").map(Number)
  const minutos = agora.getHours() * 60 + agora.getMinutes()
  return minutos >= hIni * 60 + mIni && minutos < hFim * 60 + mFim
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
  const [erroSalvar, setErroSalvar] = useState("")
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string>("")
  const bannerRef = useRef<HTMLInputElement>(null)
  const [horarios, setHorarios] = useState<Horarios>(HORARIOS_PADRAO)

  const [form, setForm] = useState<Form>({
    nome: "", descricao: "", categoria: "Restaurante",
    cep: "", logradouro: "", numero: "", complemento: "",
    bairro: "", cidade: "Aragoiânia", estado: "GO",
    telefone: "", taxa_entrega: "", tempo_min: "", tempo_max: "",
    nome_responsavel: "", email: "", logo_url: "", pix_chave: "",
  })

  useEffect(() => {
    if (!loja_id) return
    supabase.from("lojas").select("*").eq("id", loja_id).single().then(({ data }) => {
      if (!data) return
      setAberto(data.aberto)
      setStatus(data.status)
      if (data.horarios) {
        setHorarios({ ...HORARIOS_PADRAO, ...data.horarios, dias: { ...HORARIOS_PADRAO.dias, ...(data.horarios.dias ?? {}) } })
      }
      // Compatibilidade: endereco legado pode estar no campo endereco
      const enderecoParts = (data.endereco ?? "").split(",")
      setForm({
        nome: data.nome ?? "",
        descricao: data.descricao ?? "",
        categoria: data.categoria ?? "Restaurante",
        cep: data.cep ?? "",
        logradouro: data.logradouro ?? enderecoParts[0]?.trim() ?? "",
        numero: data.numero ?? "",
        complemento: data.complemento ?? "",
        bairro: data.bairro ?? "",
        cidade: data.cidade ?? "Aragoiânia",
        estado: data.estado ?? "GO",
        telefone: data.telefone ?? "",
        taxa_entrega: String(data.taxa_entrega ?? "5"),
        tempo_min: String(data.tempo_min ?? "30"),
        tempo_max: String(data.tempo_max ?? "60"),
        nome_responsavel: data.nome_responsavel ?? "",
        email: data.email ?? "",
        logo_url: data.logo_url ?? "",
        pix_chave: data.pix_chave ?? "",
      })
      setBannerPreview(data.logo_url ?? "")
      setLoading(false)
    })
  }, [loja_id])

  function set(field: keyof Form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleCepBlur() {
    const cep = form.cep.replace(/\D/g, "")
    if (cep.length !== 8) return
    setBuscandoCep(true)
    const d = await buscarCep(cep)
    if (d) {
      setForm(f => ({
        ...f,
        logradouro: d.logradouro ?? f.logradouro,
        bairro: d.bairro ?? f.bairro,
        cidade: d.localidade ?? f.cidade,
        estado: d.uf ?? f.estado,
      }))
    }
    setBuscandoCep(false)
  }

  function formatarCep(v: string) {
    const n = v.replace(/\D/g, "").slice(0, 8)
    return n.length > 5 ? n.slice(0, 5) + "-" + n.slice(5) : n
  }

  function setDia(dia: DiaSemana, campo: keyof DiaConfig, valor: string | boolean) {
    setHorarios(h => ({
      ...h,
      dias: { ...h.dias, [dia]: { ...h.dias[dia], [campo]: valor } },
    }))
  }

  async function toggleAberto() {
    if (!loja_id) return
    setTogglingAberto(true)
    const novoEstado = !aberto
    await supabase.from("lojas").update({ aberto: novoEstado }).eq("id", loja_id)
    setAberto(novoEstado)
    setTogglingAberto(false)
  }

  async function sincronizarHorarios(horariosAtuais: Horarios, loja_id_atual: string) {
    // sempre_aberto = sem restrição de horário, mas o toggle manual controla o aberto
    if (horariosAtuais.tipo === "sempre_aberto") return
    const deveEstarAberto = horariosEstaAberto(horariosAtuais)
    await supabase.from("lojas").update({ aberto: deveEstarAberto }).eq("id", loja_id_atual)
    setAberto(deveEstarAberto)
  }

  async function salvar() {
    if (!loja_id) return
    setSalvando(true)
    setErroSalvar("")

    let logoFinal = form.logo_url
    if (bannerFile) {
      logoFinal = await uploadBanner(bannerFile, loja_id)
      if (!logoFinal) {
        setErroSalvar("Falha ao enviar a foto. Tente novamente.")
        setSalvando(false)
        return
      }
    }

    const enderecoCompleto = [form.logradouro, form.numero, form.complemento, form.bairro, form.cidade + (form.estado ? " - " + form.estado : "")]
      .filter(Boolean).join(", ")
    const coords = enderecoCompleto ? await geocodeAddress(enderecoCompleto) : null

    const { error: errUpdate } = await supabase.from("lojas").update({
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      cep: form.cep.replace(/\D/g, "") || null,
      logradouro: form.logradouro.trim() || null,
      numero: form.numero.trim() || null,
      complemento: form.complemento.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || "Aragoiânia",
      estado: form.estado.trim() || "GO",
      endereco: enderecoCompleto || null,
      telefone: form.telefone.trim(),
      taxa_entrega: parseFloat(form.taxa_entrega) || 0,
      tempo_min: parseInt(form.tempo_min) || 30,
      tempo_max: parseInt(form.tempo_max) || 60,
      nome_responsavel: form.nome_responsavel.trim(),
      logo_url: logoFinal || null,
      pix_chave: form.pix_chave.trim() || null,
      horarios,
      ...(coords ? { lat: coords[0], lng: coords[1] } : {}),
    }).eq("id", loja_id)

    if (errUpdate) {
      setErroSalvar(errUpdate.message)
      setSalvando(false)
      return
    }

    await sincronizarHorarios(horarios, loja_id)

    setSalvando(false)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 3000)
  }

  if (loading) return (
    <div className="p-6 sm:p-8">
      <p style={{ color: "#9CA3AF" }}>Carregando...</p>
    </div>
  )

  const statusColor: Record<string, string> = { ativo: "#22c55e", pendente: "#f59e0b", suspenso: "#ef4444" }
  const statusLabel: Record<string, string> = { ativo: "Ativa", pendente: "Aguardando aprovação", suspenso: "Suspensa" }

  return (
    <div style={{ padding: "24px 16px", maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black" style={{ color: "#111827" }}>Minha loja</h1>
          <div className="flex items-center gap-2 mt-1">
            <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: statusColor[status] ?? "#888" }} />
            <p className="text-sm font-semibold" style={{ color: "#6B7280" }}>{statusLabel[status] ?? status}</p>
          </div>
        </div>
        {salvo && <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 13 }}>✓ Salvo!</span>}
      </div>

      {/* Foto */}
      <div className="card p-4 mb-4">
        <p className="font-black mb-3" style={{ color: "#111827", fontSize: 14 }}>Foto da loja</p>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ width: 100, height: 100, borderRadius: 14, overflow: "hidden", flexShrink: 0, background: "#F3F4F6", border: "2px dashed #D1D5DB", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {bannerPreview
              ? <img src={bannerPreview} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <p className="text-sm mb-3" style={{ color: "#6B7280" }}>Foto exibida na listagem e na página do estabelecimento.</p>
            <input ref={bannerRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; setBannerFile(f); setBannerPreview(URL.createObjectURL(f)) }} />
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => bannerRef.current?.click()} className="btn-ghost" style={{ fontSize: 12 }}>
                {bannerPreview ? "📷 Trocar foto" : "📷 Adicionar foto"}
              </button>
              {bannerPreview && (
                <button type="button" onClick={() => { setBannerFile(null); setBannerPreview(""); setForm(f => ({ ...f, logo_url: "" })); if (bannerRef.current) bannerRef.current.value = "" }} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", padding: "7px 12px", fontSize: 12, fontWeight: 600 }}>
                  Remover
                </button>
              )}
            </div>
            <p className="text-xs mt-2" style={{ color: "#D1D5DB" }}>JPG, PNG ou WEBP · máx. 5MB</p>
          </div>
        </div>
      </div>

      {/* Toggle Aberto/Fechado */}
      <div className="card p-4 mb-4" style={{ border: aberto ? "1px solid rgba(34,197,94,0.3)" : "1px solid #e5e7eb", background: aberto ? "rgba(34,197,94,0.06)" : undefined }}>
        <div className="flex items-center justify-between gap-3">
          <div style={{ flex: 1 }}>
            <p className="font-black text-base" style={{ color: "#111827" }}>{aberto ? "🟢 Loja aberta" : "🔴 Loja fechada"}</p>
            <p className="text-sm mt-0.5" style={{ color: "#6B7280", fontSize: 13 }}>{aberto ? "Clientes podem fazer pedidos agora" : "Nenhum pedido será recebido enquanto fechada"}</p>
          </div>
          <button onClick={toggleAberto} disabled={togglingAberto || status !== "ativo"} style={{ width: 52, height: 28, borderRadius: 14, border: "none", cursor: status !== "ativo" ? "not-allowed" : "pointer", background: aberto ? "#22c55e" : "#E5E7EB", position: "relative", transition: "background 0.25s", flexShrink: 0, opacity: togglingAberto ? 0.5 : 1 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "white", position: "absolute", top: 4, transition: "left 0.25s", left: aberto ? 28 : 4 }} />
          </button>
        </div>
        {status !== "ativo" && <p className="text-xs mt-2 font-semibold" style={{ color: "#f59e0b" }}>Atenção: só é possível abrir a loja após aprovação pelo administrador.</p>}
      </div>

      {/* Dados da loja */}
      <div className="card p-4 mb-4">
        <p className="font-black mb-4" style={{ color: "#111827", fontSize: 14 }}>Dados da loja</p>
        <div className="flex flex-col gap-3">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <label className="label">Nome da loja</label>
              <input className="input" value={form.nome} onChange={e => set("nome", e.target.value)} />
            </div>
            <div>
              <label className="label">Categoria</label>
              <select className="input" value={form.categoria} onChange={e => set("categoria", e.target.value)}>
                <option>Restaurante</option>
                <option>Mercadinho</option>
                <option>Farmácia</option>
                <option>Lanchonete</option>
                <option>Pizzaria</option>
                <option>Outros</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea className="input" rows={2} value={form.descricao} onChange={e => set("descricao", e.target.value)} />
          </div>
          <div>
            <label className="label">WhatsApp / Telefone</label>
            <input className="input" value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(62) 99999-9999" />
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div className="card p-4 mb-4">
        <p className="font-black mb-4" style={{ color: "#111827", fontSize: 14 }}>Endereço</p>
        <div className="flex flex-col gap-3">
          {/* CEP */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, alignItems: "end" }}>
            <div>
              <label className="label">CEP</label>
              <div style={{ position: "relative" }}>
                <input className="input" value={form.cep} placeholder="00000-000"
                  onChange={e => set("cep", formatarCep(e.target.value))}
                  onBlur={handleCepBlur}
                  style={{ paddingRight: buscandoCep ? 36 : undefined }}
                />
                {buscandoCep && <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, border: "2px solid #f97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
              </div>
            </div>
            <div>
              <label className="label">Logradouro</label>
              <input className="input" value={form.logradouro} onChange={e => set("logradouro", e.target.value)} placeholder="Rua, Avenida..." />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12 }}>
            <div>
              <label className="label">Número</label>
              <input className="input" value={form.numero} onChange={e => set("numero", e.target.value)} placeholder="123" style={{ width: "100%" }} />
            </div>
            <div>
              <label className="label">Complemento</label>
              <input className="input" value={form.complemento} onChange={e => set("complemento", e.target.value)} placeholder="Apto, Bloco..." style={{ width: "100%" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 70px", gap: 12 }}>
            <div>
              <label className="label">Bairro</label>
              <input className="input" value={form.bairro} onChange={e => set("bairro", e.target.value)} />
            </div>
            <div>
              <label className="label">Cidade</label>
              <input className="input" value={form.cidade} onChange={e => set("cidade", e.target.value)} />
            </div>
            <div>
              <label className="label">UF</label>
              <input className="input" value={form.estado} onChange={e => set("estado", e.target.value)} maxLength={2} style={{ textTransform: "uppercase" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Horários de funcionamento */}
      <div className="card p-4 mb-4">
        <p className="font-black mb-1" style={{ color: "#111827", fontSize: 14 }}>Horários de funcionamento</p>
        <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>Configure quando sua loja fica aberta automaticamente.</p>

        <div className="flex flex-col gap-3 mb-4">
          {/* Tipo de horário */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {([
              { v: "sempre_aberto", label: "Sempre aberto" },
              { v: "por_horario", label: "Por horário" },
            ] as const).map(op => (
              <button key={op.v} type="button" onClick={() => setHorarios(h => ({ ...h, tipo: op.v }))}
                style={{ padding: "8px 16px", borderRadius: 10, border: horarios.tipo === op.v ? "2px solid #f97316" : "1px solid #e5e7eb", background: horarios.tipo === op.v ? "rgba(249,115,22,0.08)" : "#fff", color: horarios.tipo === op.v ? "#f97316" : "#6B7280", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {op.label}
              </button>
            ))}
          </div>

          {horarios.tipo === "sempre_aberto" && (
            <p className="text-sm" style={{ color: "#6B7280" }}>A loja permanece aberta 24h por dia, todos os dias.</p>
          )}

          {horarios.tipo === "por_horario" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 400 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", fontSize: 11, color: "#9CA3AF", fontWeight: 700, padding: "4px 0", width: 90 }}>DIA</th>
                    <th style={{ textAlign: "left", fontSize: 11, color: "#9CA3AF", fontWeight: 700, padding: "4px 8px", width: 60 }}>ABERTO</th>
                    <th style={{ textAlign: "left", fontSize: 11, color: "#9CA3AF", fontWeight: 700, padding: "4px 8px" }}>ABRE</th>
                    <th style={{ textAlign: "left", fontSize: 11, color: "#9CA3AF", fontWeight: 700, padding: "4px 8px" }}>FECHA</th>
                  </tr>
                </thead>
                <tbody>
                  {DIAS.map(({ key, label }) => {
                    const d = horarios.dias[key]
                    return (
                      <tr key={key} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ fontSize: 13, fontWeight: 600, color: "#374151", padding: "8px 0" }}>{label}</td>
                        <td style={{ padding: "8px 8px" }}>
                          <button type="button" onClick={() => setDia(key, "aberto", !d.aberto)}
                            style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: d.aberto ? "#22c55e" : "#E5E7EB", position: "relative", transition: "background 0.2s" }}>
                            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: d.aberto ? 21 : 3, transition: "left 0.2s" }} />
                          </button>
                        </td>
                        <td style={{ padding: "8px 8px" }}>
                          <input type="time" value={d.inicio} onChange={e => setDia(key, "inicio", e.target.value)}
                            disabled={!d.aberto}
                            style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "4px 8px", fontSize: 13, color: d.aberto ? "#111827" : "#D1D5DB", background: "white", cursor: d.aberto ? "pointer" : "not-allowed", minWidth: 90 }} />
                        </td>
                        <td style={{ padding: "8px 8px" }}>
                          <input type="time" value={d.fim} onChange={e => setDia(key, "fim", e.target.value)}
                            disabled={!d.aberto}
                            style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "4px 8px", fontSize: 13, color: d.aberto ? "#111827" : "#D1D5DB", background: "white", cursor: d.aberto ? "pointer" : "not-allowed", minWidth: 90 }} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-xs mt-3" style={{ color: "#9CA3AF" }}>💡 A loja abre e fecha automaticamente nos horários definidos.</p>
            </div>
          )}
        </div>
      </div>

      {/* Entrega */}
      <div className="card p-4 mb-4">
        <p className="font-black mb-4" style={{ color: "#111827", fontSize: 14 }}>Entrega</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 12 }}>
          <div>
            <label className="label">Taxa (R$)</label>
            <input className="input" type="number" step="0.50" min="0" value={form.taxa_entrega} onChange={e => set("taxa_entrega", e.target.value)} />
          </div>
          <div>
            <label className="label">Mín. (min)</label>
            <input className="input" type="number" min="5" value={form.tempo_min} onChange={e => set("tempo_min", e.target.value)} />
          </div>
          <div>
            <label className="label">Máx. (min)</label>
            <input className="input" type="number" min="10" value={form.tempo_max} onChange={e => set("tempo_max", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Conta */}
      <div className="card p-4 mb-4">
        <p className="font-black mb-4" style={{ color: "#111827", fontSize: 14 }}>Conta</p>
        <div className="flex flex-col gap-3">
          <div>
            <label className="label">Nome do responsável</label>
            <input className="input" value={form.nome_responsavel} onChange={e => set("nome_responsavel", e.target.value)} />
          </div>
          <div>
            <label className="label">Email de acesso</label>
            <input className="input" type="email" value={form.email} disabled style={{ opacity: 0.5, cursor: "not-allowed" }} />
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>Para alterar o email, entre em contato com o suporte.</p>
          </div>
        </div>
      </div>

      {/* Financeiro */}
      <div className="card p-4 mb-6">
        <p className="font-black mb-1" style={{ color: "#111827", fontSize: 14 }}>Financeiro</p>
        <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>Chave PIX usada para receber saques da plataforma.</p>
        <div>
          <label className="label">Chave PIX para saque</label>
          <input className="input" value={form.pix_chave} onChange={e => set("pix_chave", e.target.value)} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
          {!form.pix_chave && <p className="text-xs mt-2 font-semibold" style={{ color: "#f59e0b" }}>Atenção: sem chave PIX você não poderá solicitar saques.</p>}
        </div>
      </div>

      {erroSalvar && (
        <p style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, background: "rgba(239,68,68,0.08)", padding: "12px 16px", borderRadius: 10, marginBottom: 12 }}>
          ⚠️ {erroSalvar}
        </p>
      )}
      <button onClick={salvar} disabled={salvando} className="btn-primary" style={{ padding: "14px 32px", width: "100%" }}>
        {salvando ? "Salvando..." : "Salvar alterações"}
      </button>

      <style>{`
        @keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }
        @media (max-width: 500px) {
          .card { border-radius: 14px; }
        }
      `}</style>
    </div>
  )
}