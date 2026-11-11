"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { diaEMinutosAgoraBrt } from "@/lib/periodoBrt"
import dynamic from "next/dynamic"

const MapaPicker = dynamic(() => import("@/components/MapaPicker"), { ssr: false })
// Coordenada padrão gravada em loja que nunca marcou o ponto (centro de Aragoiânia).
const COORD_PADRAO_LAT = -16.9146388
const coordReal = (lat: any) => lat != null && Math.abs(Number(lat) - COORD_PADRAO_LAT) >= 0.0001

// Grava os dados da loja pelo servidor, com a sessão da loja (20/10/2026). Antes gravava direto
// no banco pelo navegador com a chave pública.
async function atualizarLoja(campos: Record<string, unknown>): Promise<{ error: string | null }> {
  const r = await fetch("/api/loja/atualizar", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(campos) }).catch(() => null)
  if (!r) return { error: "Sem conexão. Tente de novo." }
  if (!r.ok) { const j = await r.json().catch(() => ({})); return { error: j.error ?? "Não foi possível salvar." } }
  return { error: null }
}

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
  nome_responsavel: string; email: string; logo_url: string; pix_key: string
  banco: string; banco_agencia: string; banco_conta: string; banco_tipo_conta: string
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
  const diasSemana: DiaSemana[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"]
  const { diaSemana, minutos } = diaEMinutosAgoraBrt()
  const diaAtual = diasSemana[diaSemana]
  const config = horarios.dias[diaAtual]
  if (!config.aberto) return false
  const [hIni, mIni] = config.inicio.split(":").map(Number)
  const [hFim, mFim] = config.fim.split(":").map(Number)
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
  // Ponto da loja no mapa (20/10/2026). O motoboy navega até este ponto; antes só existia o
  // endereço geocodificado, que errava a rua e às vezes nem achava (ficava a coordenada padrão).
  const [ponto, setPonto] = useState<{ lat: number; lng: number } | null>(null)
  const [pontoMarcado, setPontoMarcado] = useState(false) // marcado à mão nesta tela
  const [marcando, setMarcando] = useState<{ lat: number; lng: number } | null>(null)
  const enderecoInicial = useRef("")

  const [form, setForm] = useState<Form>({
    nome: "", descricao: "", categoria: "Restaurante",
    cep: "", logradouro: "", numero: "", complemento: "",
    bairro: "", cidade: "", estado: "GO",
    telefone: "", taxa_entrega: "", tempo_min: "", tempo_max: "",
    nome_responsavel: "", email: "", logo_url: "", pix_key: "",
    banco: "", banco_agencia: "", banco_conta: "", banco_tipo_conta: "Corrente",
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
        cidade: data.cidade ?? "",
        estado: data.estado ?? "GO",
        telefone: data.telefone ?? "",
        taxa_entrega: String(data.taxa_entrega ?? "6"),
        tempo_min: String(data.tempo_min ?? "30"),
        tempo_max: String(data.tempo_max ?? "60"),
        nome_responsavel: data.nome_responsavel ?? "",
        email: data.email ?? "",
        logo_url: data.logo_url ?? "",
        pix_key: data.pix_key ?? "",
        banco: data.banco ?? "",
        banco_agencia: data.banco_agencia ?? "",
        banco_conta: data.banco_conta ?? "",
        banco_tipo_conta: data.banco_tipo_conta ?? "Corrente",
      })
      setBannerPreview(data.logo_url ?? "")
      if (coordReal(data.lat) && data.lng) setPonto({ lat: Number(data.lat), lng: Number(data.lng) })
      enderecoInicial.current = [data.logradouro, data.numero, data.bairro, data.cidade].join("|")
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
      // "cidade" NUNCA vem do CEP — Guapó não tem CEP próprio por rua em boa parte das
      // vezes (só o genérico 75350-000), e um CEP inválido/inexistente faz o ViaCEP
      // retornar nada, deixando o valor anterior no campo sem o lojista perceber. Bug
      // real (2026-09-26): várias lojas de Guapó ficaram salvas com cidade="Aragoiânia"
      // porque o campo começava com esse valor e nunca era corrigido. Cidade agora é
      // sempre escolha explícita do lojista (dropdown abaixo).
      setForm(f => ({
        ...f,
        logradouro: d.logradouro ?? f.logradouro,
        bairro: d.bairro ?? f.bairro,
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
    const r = await atualizarLoja({ aberto: novoEstado })
    if (!r.error) setAberto(novoEstado)
    setTogglingAberto(false)
  }

  async function sincronizarHorarios(horariosAtuais: Horarios, loja_id_atual: string) {
    // sempre_aberto = sem restrição de horário, mas o toggle manual controla o aberto
    if (horariosAtuais.tipo === "sempre_aberto") return
    void loja_id_atual
    const deveEstarAberto = horariosEstaAberto(horariosAtuais)
    const r = await atualizarLoja({ aberto: deveEstarAberto })
    if (!r.error) setAberto(deveEstarAberto)
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
    // Ponto marcado no mapa vale sempre. Sem ponto marcado, só geocodifica se a loja ainda não
    // tem ponto real ou se o endereço mudou; antes, todo "Salvar" geocodificava de novo e podia
    // trocar um ponto certo por um errado.
    const enderecoMudou = [form.logradouro, form.numero, form.bairro, form.cidade].join("|") !== enderecoInicial.current
    const coords: [number, number] | null = pontoMarcado && ponto
      ? [ponto.lat, ponto.lng]
      : (!ponto || enderecoMudou) && enderecoCompleto ? await geocodeAddress(enderecoCompleto) : null

    const { error: errUpdate } = await atualizarLoja({
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      cep: form.cep.replace(/\D/g, "") || null,
      logradouro: form.logradouro.trim() || null,
      numero: form.numero.trim() || null,
      complemento: form.complemento.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim() || "GO",
      endereco: enderecoCompleto || null,
      telefone: form.telefone.trim(),
      tempo_min: parseInt(form.tempo_min) || 30,
      tempo_max: parseInt(form.tempo_max) || 60,
      nome_responsavel: form.nome_responsavel.trim(),
      logo_url: logoFinal || null,
      pix_key: form.pix_key.trim() || null,
      banco: form.banco.trim() || null,
      banco_agencia: form.banco_agencia.trim() || null,
      banco_conta: form.banco_conta.trim() || null,
      banco_tipo_conta: form.banco_tipo_conta || "Corrente",
      horarios,
      ...(coords ? { lat: coords[0], lng: coords[1] } : {}),
    })

    if (errUpdate) {
      setErroSalvar(errUpdate)
      setSalvando(false)
      return
    }
    if (coords) { setPonto({ lat: coords[0], lng: coords[1] }); setPontoMarcado(false) }
    enderecoInicial.current = [form.logradouro, form.numero, form.bairro, form.cidade].join("|")

    await sincronizarHorarios(horarios, loja_id)

    setSalvando(false)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 3000)
  }

  if (loading) return (
    <div className="p-6 sm:p-8">
      <p style={{ color: "var(--suave)" }}>Carregando...</p>
    </div>
  )

  const statusColor: Record<string, string> = { ativo: "var(--folha)", pendente: "var(--pequi)", suspenso: "var(--pimenta)" }
  const statusLabel: Record<string, string> = { ativo: "Ativa", pendente: "Aguardando aprovação", suspenso: "Suspensa" }

  return (
    <div style={{ padding: "4px 0 24px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          
          <div className="flex items-center gap-2 mt-1">
            <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: statusColor[status] ?? "#888" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--suave)" }}>{statusLabel[status] ?? status}</p>
          </div>
        </div>
        {salvo && <span style={{ color: "var(--folha)", fontWeight: 700, fontSize: 13 }}>✓ Salvo!</span>}
      </div>

      {/* Foto */}
      <div className="card p-4 mb-4">
        <p className="font-black mb-3" style={{ color: "var(--grafite)", fontSize: 14 }}>Foto da loja</p>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ width: 100, height: 100, borderRadius: 14, overflow: "hidden", flexShrink: 0, background: "var(--pedra)", border: "2px dashed var(--linha)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {bannerPreview
              ? <img src={bannerPreview} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--linha)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <p className="text-sm mb-3" style={{ color: "var(--suave)" }}>Foto exibida na listagem e na página do estabelecimento.</p>
            <input ref={bannerRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; setBannerFile(f); setBannerPreview(URL.createObjectURL(f)) }} />
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => bannerRef.current?.click()} className="btn-ghost" style={{ fontSize: 12 }}>
                {bannerPreview ? "📷 Trocar foto" : "📷 Adicionar foto"}
              </button>
              {bannerPreview && (
                <button type="button" onClick={() => { setBannerFile(null); setBannerPreview(""); setForm(f => ({ ...f, logo_url: "" })); if (bannerRef.current) bannerRef.current.value = "" }} style={{ background: "none", border: "none", color: "var(--suave)", cursor: "pointer", padding: "7px 12px", fontSize: 12, fontWeight: 600 }}>
                  Remover
                </button>
              )}
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--linha)" }}>JPG, PNG ou WEBP · máx. 5MB</p>
          </div>
        </div>
      </div>

      {/* Toggle Aberto/Fechado */}
      <div className="card p-4 mb-4" style={{ border: aberto ? "1px solid rgba(34,197,94,0.3)" : "1px solid var(--linha)", background: aberto ? "rgba(34,197,94,0.06)" : undefined }}>
        <div className="flex items-center justify-between gap-3">
          <div style={{ flex: 1 }}>
            <p className="font-black text-base" style={{ color: "var(--grafite)" }}>{aberto ? "🟢 Loja aberta" : "🔴 Loja fechada"}</p>
            <p className="text-sm mt-0.5" style={{ color: "var(--suave)", fontSize: 13 }}>{aberto ? "Clientes podem fazer pedidos agora" : "Nenhum pedido será recebido enquanto fechada"}</p>
          </div>
          <button onClick={toggleAberto} disabled={togglingAberto || status !== "ativo"} style={{ width: 52, height: 28, borderRadius: 14, border: "none", cursor: status !== "ativo" ? "not-allowed" : "pointer", background: aberto ? "var(--folha)" : "var(--linha)", position: "relative", transition: "background 0.25s", flexShrink: 0, opacity: togglingAberto ? 0.5 : 1 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "white", position: "absolute", top: 4, transition: "left 0.25s", left: aberto ? 28 : 4 }} />
          </button>
        </div>
        {status !== "ativo" && <p className="text-xs mt-2 font-semibold" style={{ color: "var(--pequi)" }}>Atenção: só é possível abrir a loja após aprovação pelo administrador.</p>}
      </div>

      {/* Dados da loja */}
      <div className="card p-4 mb-4">
        <p className="font-black mb-4" style={{ color: "var(--grafite)", fontSize: 14 }}>Dados da loja</p>
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
        <p className="font-black mb-4" style={{ color: "var(--grafite)", fontSize: 14 }}>Endereço</p>
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
                {buscandoCep && <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, border: "2px solid var(--pimenta)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
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
              <select className="input" value={form.cidade} onChange={e => set("cidade", e.target.value)}>
                <option value="">Selecione...</option>
                <option value="Aragoiânia">Aragoiânia</option>
                <option value="Guapó">Guapó</option>
              </select>
            </div>
            <div>
              <label className="label">UF</label>
              <input className="input" value={form.estado} onChange={e => set("estado", e.target.value)} maxLength={2} style={{ textTransform: "uppercase" }} />
            </div>
          </div>
          {/* Ponto da loja no mapa */}
          <div style={{ borderRadius: 12, padding: "12px 14px", background: ponto ? "var(--folha-claro)" : "var(--pimenta-claro)", border: `1px solid ${ponto ? "#A7F3D0" : "#FED7AA"}` }}>
            <p style={{ fontWeight: 800, fontSize: 14, color: "var(--grafite)" }}>{ponto ? (pontoMarcado ? "Ponto marcado. Clique em Salvar alterações." : "Ponto da loja marcado no mapa") : "Ponto da loja não marcado no mapa"}</p>
            <p style={{ fontSize: 13, color: "#4B5563", marginTop: 4, lineHeight: 1.45 }}>
              {ponto ? "É para este ponto que o motoboy navega quando vai buscar o pedido." : "Sem o ponto, o GPS do motoboy pode levar para a rua errada. Marque onde fica a porta da loja."}
            </p>
            <button type="button" onClick={() => setMarcando(ponto ?? { lat: -16.9214, lng: -49.4497 })}
              style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, border: "none", background: "#D7261E", color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
              {ponto ? "Ajustar ponto no mapa" : "Marcar ponto no mapa"}
            </button>
          </div>
        </div>
      </div>

      {/* Horários de funcionamento */}
      <div className="card p-4 mb-4">
        <p className="font-black mb-1" style={{ color: "var(--grafite)", fontSize: 14 }}>Horários de funcionamento</p>
        <p className="text-xs mb-4" style={{ color: "var(--suave)" }}>Configure quando sua loja fica aberta automaticamente.</p>

        <div className="flex flex-col gap-3 mb-4">
          {/* Tipo de horário */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {([
              { v: "sempre_aberto", label: "Sempre aberto" },
              { v: "por_horario", label: "Por horário" },
            ] as const).map(op => (
              <button key={op.v} type="button" onClick={() => setHorarios(h => ({ ...h, tipo: op.v }))}
                style={{ padding: "8px 16px", borderRadius: 10, border: horarios.tipo === op.v ? "2px solid var(--pimenta)" : "1px solid var(--linha)", background: horarios.tipo === op.v ? "rgba(215,38,30,0.08)" : "#fff", color: horarios.tipo === op.v ? "var(--pimenta)" : "var(--suave)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {op.label}
              </button>
            ))}
          </div>

          {horarios.tipo === "sempre_aberto" && (
            <p className="text-sm" style={{ color: "var(--suave)" }}>A loja permanece aberta 24h por dia, todos os dias.</p>
          )}

          {horarios.tipo === "por_horario" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 400 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", fontSize: 11, color: "var(--suave)", fontWeight: 700, padding: "4px 0", width: 90 }}>DIA</th>
                    <th style={{ textAlign: "left", fontSize: 11, color: "var(--suave)", fontWeight: 700, padding: "4px 8px", width: 60 }}>ABERTO</th>
                    <th style={{ textAlign: "left", fontSize: 11, color: "var(--suave)", fontWeight: 700, padding: "4px 8px" }}>ABRE</th>
                    <th style={{ textAlign: "left", fontSize: 11, color: "var(--suave)", fontWeight: 700, padding: "4px 8px" }}>FECHA</th>
                  </tr>
                </thead>
                <tbody>
                  {DIAS.map(({ key, label }) => {
                    const d = horarios.dias[key]
                    return (
                      <tr key={key} style={{ borderTop: "1px solid var(--pedra)" }}>
                        <td style={{ fontSize: 13, fontWeight: 600, color: "var(--texto)", padding: "8px 0" }}>{label}</td>
                        <td style={{ padding: "8px 8px" }}>
                          <button type="button" onClick={() => setDia(key, "aberto", !d.aberto)}
                            style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: d.aberto ? "var(--folha)" : "var(--linha)", position: "relative", transition: "background 0.2s" }}>
                            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: d.aberto ? 21 : 3, transition: "left 0.2s" }} />
                          </button>
                        </td>
                        <td style={{ padding: "8px 8px" }}>
                          <input type="time" value={d.inicio} onChange={e => setDia(key, "inicio", e.target.value)}
                            disabled={!d.aberto}
                            style={{ border: "1px solid var(--linha)", borderRadius: 8, padding: "4px 8px", fontSize: 13, color: d.aberto ? "var(--grafite)" : "var(--linha)", background: "white", cursor: d.aberto ? "pointer" : "not-allowed", minWidth: 90 }} />
                        </td>
                        <td style={{ padding: "8px 8px" }}>
                          <input type="time" value={d.fim} onChange={e => setDia(key, "fim", e.target.value)}
                            disabled={!d.aberto}
                            style={{ border: "1px solid var(--linha)", borderRadius: 8, padding: "4px 8px", fontSize: 13, color: d.aberto ? "var(--grafite)" : "var(--linha)", background: "white", cursor: d.aberto ? "pointer" : "not-allowed", minWidth: 90 }} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-xs mt-3" style={{ color: "var(--suave)" }}>💡 A loja abre e fecha automaticamente nos horários definidos.</p>
            </div>
          )}
        </div>
      </div>

      {/* Entrega */}
      <div className="card p-4 mb-4">
        <p className="font-black mb-4" style={{ color: "var(--grafite)", fontSize: 14 }}>Entrega</p>
        <p style={{ fontSize: 12, color: "var(--suave)", marginBottom: 12 }}>
          Taxa definida pela plataforma: <strong>R$ 6,00</strong> até 6 km · +R$ 1,00/km adicional
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
        <p className="font-black mb-4" style={{ color: "var(--grafite)", fontSize: 14 }}>Conta</p>
        <div className="flex flex-col gap-3">
          <div>
            <label className="label">Nome do responsável</label>
            <input className="input" value={form.nome_responsavel} onChange={e => set("nome_responsavel", e.target.value)} />
          </div>
          <div>
            <label className="label">Email de acesso</label>
            <input className="input" type="email" value={form.email} disabled style={{ opacity: 0.5, cursor: "not-allowed" }} />
            <p className="text-xs mt-1" style={{ color: "var(--suave)" }}>Para alterar o email, entre em contato com o suporte.</p>
          </div>
        </div>
      </div>

      {/* Financeiro */}
      <div className="card p-4 mb-6">
        <p className="font-black mb-1" style={{ color: "var(--grafite)", fontSize: 14 }}>Financeiro</p>
        <p className="text-xs mb-4" style={{ color: "var(--suave)" }}>Dados bancários e chave PIX para receber saques da plataforma.</p>
        <div className="flex flex-col gap-3">
          <div>
            <label className="label">Chave PIX para saque</label>
            <input className="input" value={form.pix_key} onChange={e => set("pix_key", e.target.value)} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
            {!form.pix_key && <p className="text-xs mt-2 font-semibold" style={{ color: "var(--pequi)" }}>Atenção: sem chave PIX você não poderá solicitar saques.</p>}
          </div>
          <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 12 }}>
            <p className="text-xs font-bold mb-3" style={{ color: "var(--suave)", textTransform: "uppercase", letterSpacing: 1 }}>Dados bancários</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Banco</label>
                <input className="input" value={form.banco} onChange={e => set("banco", e.target.value)} placeholder="Ex: Bradesco, Itaú, Nubank..." />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="label">Agência</label>
                  <input className="input" value={form.banco_agencia} onChange={e => set("banco_agencia", e.target.value)} placeholder="Ex: 1234" />
                </div>
                <div>
                  <label className="label">Conta</label>
                  <input className="input" value={form.banco_conta} onChange={e => set("banco_conta", e.target.value)} placeholder="Ex: 56789-0" />
                </div>
              </div>
              <div>
                <label className="label">Tipo de conta</label>
                <select className="input" value={form.banco_tipo_conta} onChange={e => set("banco_tipo_conta", e.target.value)}>
                  <option value="Corrente">Corrente</option>
                  <option value="Poupança">Poupança</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {erroSalvar && (
        <p style={{ color: "var(--pimenta)", fontSize: 13, fontWeight: 600, background: "rgba(239,68,68,0.08)", padding: "12px 16px", borderRadius: 10, marginBottom: 12 }}>
          ⚠️ {erroSalvar}
        </p>
      )}
      <button onClick={salvar} disabled={salvando} className="btn-primary" style={{ padding: "14px 32px", width: "100%" }}>
        {salvando ? "Salvando..." : "Salvar alterações"}
      </button>

      {marcando && (
        <div onClick={() => setMarcando(null)} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: "white", borderRadius: "20px 20px 0 0", padding: "18px 16px calc(env(safe-area-inset-bottom,0px) + 16px)" }}>
            <p style={{ fontWeight: 900, fontSize: 17, color: "var(--grafite)" }}>Onde fica a porta da loja?</p>
            <p style={{ fontSize: 13, color: "#4B5563", margin: "4px 0 12px", lineHeight: 1.45 }}>Arraste o mapa até o pino ficar em cima da loja. Se você está na loja agora, toque no botão de localização no canto do mapa.</p>
            <MapaPicker lat={marcando.lat} lng={marcando.lng} onMove={(lat, lng) => setMarcando({ lat, lng })} />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button type="button" onClick={() => setMarcando(null)} style={{ flex: 1, padding: 13, borderRadius: 12, border: "1px solid var(--linha)", background: "white", fontWeight: 700, fontSize: 15 }}>Cancelar</button>
              <button type="button" onClick={() => { setPonto(marcando); setPontoMarcado(true); setMarcando(null) }} style={{ flex: 2, padding: 13, borderRadius: 12, border: "none", background: "#D7261E", color: "white", fontWeight: 800, fontSize: 15 }}>Usar este ponto</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }
        @media (max-width: 500px) {
          .card { border-radius: 14px; }
        }
      `}</style>
    </div>
  )
}