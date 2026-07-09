"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { Loja, StatusLoja, PlanoLoja } from "@/types"

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pendente:          { label: "Pendente",          color: "#d97706", bg: "#FFFBEB", dot: "#f59e0b" },
  aprovado:          { label: "Aprovado",           color: "#2563eb", bg: "#EFF6FF", dot: "#3b82f6" },
  contrato_assinado: { label: "Contrato assinado",  color: "#7c3aed", bg: "#F5F3FF", dot: "#8b5cf6" },
  ativo:             { label: "Ativo",              color: "#059669", bg: "#ECFDF5", dot: "#10b981" },
  suspenso:          { label: "Suspenso",           color: "#dc2626", bg: "#FEF2F2", dot: "#ef4444" },
}

const CATEGORIAS = ["Todos", "Restaurante", "Mercadinho", "Farmácia", "Outros"]

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: "#64748b", bg: "#F1F5F9", dot: "#94a3b8" }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 50,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 700,
      border: `1px solid ${cfg.color}22`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

function LogoAvatar({ loja, size = 48 }: { loja: Loja; size?: number }) {
  const [err, setErr] = useState(false)
  const initials = (loja.nome || "?").slice(0, 2).toUpperCase()
  const colors = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#f59e0b"]
  const color = colors[(loja.nome?.charCodeAt(0) ?? 0) % colors.length]

  if (loja.logo_url && !err) {
    return (
      <img src={loja.logo_url} alt={loja.nome}
        onError={() => setErr(true)}
        style={{
          width: size, height: size, borderRadius: size * 0.25,
          objectFit: "cover", flexShrink: 0,
          border: "2px solid #F1F5F9",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.25, flexShrink: 0,
      background: `linear-gradient(135deg, ${color}22, ${color}44)`,
      border: `2px solid ${color}33`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 900, color,
      boxShadow: `0 2px 8px ${color}20`,
    }}>
      {initials}
    </div>
  )
}

const PLANO_CFG: Record<string, { label: string; valor: string; color: string; bg: string }> = {
  select: { label: "Select",  valor: "R$ 149/mês",  color: "#2563eb", bg: "#EFF6FF" },
  prime:  { label: "Prime",   valor: "R$ 497/mês",  color: "#7c3aed", bg: "#F5F3FF" },
  black:  { label: "Black",   valor: "R$ 997/mês",  color: "#111827", bg: "#F1F5F9" },
  gold:   { label: "Gold",    valor: "10% / pedido", color: "#d97706", bg: "#FFFBEB" },
}

function PlanoBadge({ plano }: { plano?: PlanoLoja | null }) {
  if (!plano) return null
  const cfg = PLANO_CFG[plano]
  if (!cfg) return <span style={{ fontSize: 10, fontWeight: 800, color: "#64748b", padding: "2px 8px", borderRadius: 50, background: "#F1F5F9", border: "1px solid #CBD5E1" }}>★ {plano}</span>
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 50,
      background: cfg.bg, color: cfg.color,
      fontSize: 10, fontWeight: 800, letterSpacing: 0.3,
      border: `1px solid ${cfg.color}33`,
    }}>
      ★ {cfg.label}
    </span>
  )
}

function gerarToken() { return crypto.randomUUID() }

export default function LojasPage() {
  const router = useRouter()
  const [lojas, setLojas]           = useState<Loja[]>([])
  const [loading, setLoading]       = useState(true)
  const [filtro, setFiltro]         = useState("Todos")
  const [status, setStatus]         = useState("todos")
  const [selecionada, setSelecionada] = useState<Loja | null>(null)
  const [salvando, setSalvando]     = useState(false)
  const [copiado, setCopiado]       = useState(false)
  const [linkGerado, setLinkGerado] = useState("")
  const [atribuindoPlano, setAtribuindoPlano]     = useState(false)
  const [planoSelecionado, setPlanoSelecionado]   = useState<string>("")
  const [marcandoPresencial, setMarcandoPresencial] = useState(false)
  const [criandoSubconta,   setCriandoSubconta]    = useState(false)
  const [certFormAberto,    setCertFormAberto]      = useState(false)
  const [salvandoCert,      setSalvandoCert]        = useState(false)
  const [certForm, setCertForm] = useState({
    fileB64: "", fileName: "", password: "", expires: "", cscId: "", cscToken: "",
  })
  const [registrandoFocus,  setRegistrandoFocus]   = useState(false)
  const [togglingFiscal,    setTogglingFiscal]      = useState(false)
  const [confirmExcluir,    setConfirmExcluir]      = useState(false)
  const [excluindo,         setExcluindo]           = useState(false)
  const [enviandoEmail,     setEnviandoEmail]       = useState(false)
  const [emailEnviado,      setEmailEnviado]        = useState(false)

  async function load() {
    const { data } = await supabase.from("lojas").select("*").order("criado_em", { ascending: false })
    setLojas(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function atualizarStatus(id: string, novoStatus: StatusLoja, extra?: Record<string, unknown>) {
    setSalvando(true)
    await supabase.from("lojas").update({ status: novoStatus, ...extra }).eq("id", id)
    await load()
    setSelecionada(prev => prev ? { ...prev, status: novoStatus, ...extra } as Loja : null)
    setSalvando(false)
  }

  async function ativarLoja(loja: Loja) {
    setSalvando(true)
    await fetch("/api/chego-ctrl/ativar-loja", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loja_id: loja.id }),
    })
    await load()
    setSelecionada(prev => prev ? { ...prev, status: "ativo" } as Loja : null)
    setSalvando(false)
  }

  async function aprovar(loja: Loja) {
    if (!loja.plano) {
      alert("⚠️ Defina o plano da loja antes de gerar o contrato.\nO plano precisa estar discriminado no contrato.")
      return
    }
    const token = gerarToken()
    await atualizarStatus(loja.id, "aprovado", { contrato_token: token })
  }

  async function reenviarContrato(loja: Loja) {
    if (!loja.plano) {
      alert("⚠️ Defina o plano da loja antes de gerar o contrato.\nO plano precisa estar discriminado no contrato.")
      return
    }
    setSalvando(true)
    try {
      const token = gerarToken()
      await supabase.from("lojas").update({
        contrato_token: token,
        contrato_assinado: false,
        contrato_assinatura: null,
        contrato_assinado_em: null,
      }).eq("id", loja.id)
      await load()
      const link = `${window.location.origin}/contrato/loja/${token}`
      setSelecionada(prev => prev ? { ...prev, contrato_token: token, contrato_assinado: false } as Loja : null)
      try { await navigator.clipboard.writeText(link) } catch {}
      setLinkGerado(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 4000)
    } finally {
      setSalvando(false)
    }
  }

  async function marcarPresencial(loja: Loja) {
    setMarcandoPresencial(true)
    try {
      const res = await fetch("/api/chego-ctrl/presencial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "loja", id: loja.id }),
      })
      if (!res.ok) { alert("Erro ao marcar como presencial"); return }
      await load()
      setSelecionada(prev => prev ? { ...prev, contrato_assinado: true, modalidade_assinatura: "presencial", status: "contrato_assinado" } as Loja : null)
    } finally {
      setMarcandoPresencial(false)
    }
  }

  async function criarSubconta(loja: Loja) {
    if (!confirm(`Criar subconta Asaas para "${loja.nome}"? Isso não pode ser desfeito.`)) return
    setCriandoSubconta(true)
    try {
      const res = await fetch("/api/admin/loja/criar-subconta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loja_id: loja.id }),
      })
      const json = await res.json()
      if (!res.ok) { alert("Erro: " + json.error); return }
      if (json.jaExistia) { alert("Subconta já existia: " + json.walletId); return }
      await load()
      setSelecionada(prev => prev ? { ...prev, asaas_wallet_id: json.walletId } as Loja : null)
      alert("Subconta criada com sucesso! WalletId: " + json.walletId)
    } finally {
      setCriandoSubconta(false)
    }
  }

  async function salvarCert(loja: Loja) {
    const { fileB64, password, expires, cscId, cscToken } = certForm
    if (!fileB64 && !password && !cscId && !cscToken) {
      alert("Preencha ao menos um campo para salvar."); return
    }
    setSalvandoCert(true)
    try {
      const res = await fetch("/api/admin/loja/cert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loja_id:       loja.id,
          cert_b64:      fileB64   || undefined,
          cert_password: password  || undefined,
          cert_expires:  expires   || undefined,
          csc_id:        cscId     || undefined,
          csc_token:     cscToken  || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { alert("Erro: " + json.error); return }
      await load()
      setCertFormAberto(false)
      setCertForm({ fileB64: "", fileName: "", password: "", expires: "", cscId: "", cscToken: "" })
      alert("Certificado salvo com sucesso!")
    } finally {
      setSalvandoCert(false)
    }
  }

  async function registrarNoFocusNfe(loja: Loja) {
    if (!confirm(`Registrar "${loja.nome}" no Focus NFe? O certificado será enviado.`)) return
    setRegistrandoFocus(true)
    try {
      const res = await fetch("/api/admin/loja/focusnfe-empresa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loja_id: loja.id }),
      })
      const json = await res.json()
      if (!res.ok) { alert("Erro: " + json.error); return }
      await load()
      alert("Loja registrada no Focus NFe com sucesso!")
    } finally {
      setRegistrandoFocus(false)
    }
  }

  async function toggleFiscalAtivo(loja: Loja) {
    const novo = !loja.fiscal_ativo
    if (novo && !confirm(`Ativar emissão de NFC-e para "${loja.nome}"? A partir de agora, notas serão emitidas automaticamente ao entregar.`)) return
    setTogglingFiscal(true)
    try {
      const res = await fetch("/api/admin/loja/fiscal-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loja_id: loja.id, fiscal_ativo: novo }),
      })
      const json = await res.json()
      if (!res.ok) { alert("Erro: " + json.error); return }
      await load()
      setSelecionada(prev => prev ? { ...prev, fiscal_ativo: novo } as Loja : null)
    } finally {
      setTogglingFiscal(false)
    }
  }

  async function enviarContratoPorEmail(loja: Loja) {
    setEnviandoEmail(true)
    setEmailEnviado(false)
    const res = await fetch("/api/chego-ctrl/enviar-contrato", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ loja_id: loja.id }),
    })
    const json = await res.json()
    if (!res.ok) { alert("Erro: " + (json.error ?? "Tente novamente")); setEnviandoEmail(false); return }
    setEmailEnviado(true)
    setEnviandoEmail(false)
    setTimeout(() => setEmailEnviado(false), 4000)
  }

  async function excluirLoja(loja: Loja) {
    setExcluindo(true)
    const res = await fetch("/api/chego-ctrl/excluir-loja", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ loja_id: loja.id }),
    })
    if (!res.ok) {
      const json = await res.json()
      alert("Erro ao excluir: " + (json.error ?? "Tente novamente"))
      setExcluindo(false)
      setConfirmExcluir(false)
      return
    }
    setLojas(prev => prev.filter(l => l.id !== loja.id))
    setSelecionada(null)
    setConfirmExcluir(false)
    setExcluindo(false)
  }

  async function atribuirPlano(loja: Loja) {
    setAtribuindoPlano(true)
    try {
      const res = await fetch("/api/chego-ctrl/plano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loja_id: loja.id, plano: planoSelecionado || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      await load()
      setSelecionada(prev => prev ? { ...prev, plano: (planoSelecionado || null) as PlanoLoja | null } as Loja : null)
    } catch (e: any) {
      alert("Erro: " + e.message)
    } finally {
      setAtribuindoPlano(false)
    }
  }

  function linkContrato(loja: Loja) {
    return `${window.location.origin}/contrato/loja/${loja.contrato_token}`
  }

  async function copiarLink(loja: Loja) {
    await navigator.clipboard.writeText(linkContrato(loja))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const filtradas = lojas.filter(l => {
    const catOk    = filtro === "Todos" || l.categoria === filtro
    const statusOk = status === "todos" || l.status === status
    return catOk && statusOk
  })

  const pendentes = lojas.filter(l => l.status === "pendente").length

  return (
    <div style={{ padding: "32px 36px", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Gestão
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.5px" }}>Lojas</h1>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 3 }}>
            {lojas.length} cadastradas
            {pendentes > 0 && <span style={{ marginLeft: 8, color: "#d97706", fontWeight: 700 }}>· {pendentes} pendente{pendentes > 1 ? "s" : ""}</span>}
          </p>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{
            padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
            border: "1.5px solid #E2E8F0", background: "white", color: "#374151",
            cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}>
            <option value="todos">Todos os status</option>
            <option value="pendente">Pendentes</option>
            <option value="aprovado">Aprovados</option>
            <option value="contrato_assinado">Contrato assinado</option>
            <option value="ativo">Ativos</option>
            <option value="suspenso">Suspensos</option>
          </select>

          <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 10, padding: 4, border: "1.5px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            {CATEGORIAS.map(c => (
              <button key={c} onClick={() => setFiltro(c)} style={{
                padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: "none", cursor: "pointer", transition: "all 0.15s",
                background: filtro === c ? "linear-gradient(135deg, #f97316, #ea580c)" : "transparent",
                color: filtro === c ? "white" : "#64748B",
                boxShadow: filtro === c ? "0 2px 8px rgba(249,115,22,0.3)" : "none",
              }}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Layout lista + painel */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

        {/* Lista */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          {loading ? (
            [1,2,3].map(i => (
              <div key={i} style={{ height: 80, borderRadius: 14, background: "white", border: "1.5px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))
          ) : filtradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", background: "white", borderRadius: 16, border: "1.5px solid #F1F5F9" }}>
              <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>Nenhuma loja encontrada</p>
            </div>
          ) : filtradas.map(l => {
            const active = selecionada?.id === l.id
            const cfg = STATUS_CFG[l.status] ?? STATUS_CFG.pendente
            return (
              <div key={l.id} onClick={() => { setSelecionada(active ? null : l); setConfirmExcluir(false) }} style={{
                background: "white",
                borderRadius: 14,
                border: active ? `1.5px solid #f97316` : "1.5px solid #F1F5F9",
                boxShadow: active
                  ? "0 4px 20px rgba(249,115,22,0.15)"
                  : "0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)",
                padding: "14px 18px",
                display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer",
                transition: "all 0.18s",
              }}
                onMouseEnter={e => {
                  if (active) return
                  const el = e.currentTarget as HTMLDivElement
                  el.style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)"
                  el.style.transform = "translateY(-1px)"
                }}
                onMouseLeave={e => {
                  if (active) return
                  const el = e.currentTarget as HTMLDivElement
                  el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)"
                  el.style.transform = ""
                }}
              >
                <LogoAvatar loja={l} size={52} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>{l.nome}</p>
                    <StatusBadge status={l.status} />
                    <PlanoBadge plano={l.plano} />
                    {l.asaas_wallet_id && (
                      <span style={{ fontSize: 9, fontWeight: 800, color: "#059669", background: "#ECFDF5", padding: "1px 6px", borderRadius: 50, border: "1px solid #A7F3D0" }}>
                        ⚡ split
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.categoria} · {l.endereco}
                  </p>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#f97316" }}>R$ {l.taxa_entrega?.toFixed(2)}</p>
                  <p style={{ fontSize: 10, color: "#CBD5E1", marginTop: 2, fontWeight: 600 }}>taxa entrega</p>
                </div>

                <div style={{ color: active ? "#f97316" : "#CBD5E1", transition: "all 0.15s" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
            )
          })}
        </div>

        {/* Painel lateral */}
        {selecionada && (
          <div style={{
            width: 380, flexShrink: 0, alignSelf: "flex-start",
            background: "white", borderRadius: 18,
            border: "1.5px solid #F1F5F9",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            overflow: "hidden",
            position: "sticky", top: 24,
          }}>
            {/* Banner / Logo hero */}
            <div style={{
              height: 100, position: "relative",
              background: `linear-gradient(135deg, #FFF7ED, #FEF3C7)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(249,115,22,0.08), rgba(220,38,38,0.06))" }} />
              <div style={{ position: "absolute", top: 12, right: 12 }}>
                <button onClick={() => setSelecionada(null)} style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "white", border: "1.5px solid #E2E8F0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  color: "#94a3b8", fontSize: 14, fontWeight: 700,
                }}>✕</button>
              </div>
            </div>

            {/* Logo sobreposta */}
            <div style={{ padding: "0 20px", marginTop: -28, marginBottom: 4, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div style={{ borderRadius: 14, border: "3px solid white", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
                <LogoAvatar loja={selecionada} size={56} />
              </div>
              <StatusBadge status={selecionada.status} />
            </div>

            {/* Nome */}
            <div style={{ padding: "8px 20px 16px" }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.3px" }}>{selecionada.nome}</p>
              {selecionada.descricao && (
                <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, lineHeight: 1.5 }}>{selecionada.descricao}</p>
              )}
            </div>

            {/* Infos */}
            <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 1 }}>
              {[
                { label: "Categoria",    value: selecionada.categoria },
                { label: "Telefone",     value: selecionada.telefone },
                { label: "Endereço",     value: selecionada.endereco },
                { label: "Taxa entrega", value: `R$ ${selecionada.taxa_entrega?.toFixed(2)}` },
                { label: "Tempo",        value: `${selecionada.tempo_min}–${selecionada.tempo_max} min` },
                { label: "Comissão",     value: `${(selecionada as any).comissao ?? 10}%` },
                selecionada.nome_responsavel ? { label: "Responsável", value: selecionada.nome_responsavel } : null,
                selecionada.email         ? { label: "E-mail",       value: selecionada.email }         : null,
                selecionada.cnpj          ? { label: "CNPJ",         value: selecionada.cnpj }          : null,
                selecionada.cpf_responsavel ? { label: "CPF",         value: selecionada.cpf_responsavel } : null,
                selecionada.pix_key       ? { label: "PIX",          value: selecionada.pix_key }       : null,
                { label: "Cadastro", value: new Date(selecionada.criado_em).toLocaleDateString("pt-BR") },
                selecionada.contrato_assinado_em
                  ? { label: "Assinado em", value: new Date(selecionada.contrato_assinado_em).toLocaleDateString("pt-BR") }
                  : null,
              ].filter(Boolean).map((row: any, i, arr) => (
                <div key={row.label} style={{
                  display: "flex", justifyContent: "space-between", gap: 8,
                  padding: "8px 0",
                  borderBottom: i < arr.length - 1 ? "1px solid #F8FAFC" : "none",
                }}>
                  <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, flexShrink: 0 }}>{row.label}</span>
                  <span style={{
                    fontSize: 12, color: "#1E293B", fontWeight: 700,
                    textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }} title={row.value}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Contrato assinado */}
            {selecionada.contrato_assinado && (
              <div style={{ margin: "0 20px 16px", borderRadius: 12, overflow: "hidden", border: "1.5px solid #D1FAE5" }}>
                <div style={{ padding: "10px 14px", background: "#F0FDF4", borderBottom: "1px solid #D1FAE5", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 800, color: "#059669" }}>
                      ✓ Contrato assinado
                      {selecionada.modalidade_assinatura === "gov_br"     && " · Gov.br (ICP-Brasil)"}
                      {selecionada.modalidade_assinatura === "presencial"  && " · Presencial"}
                    </p>
                    {selecionada.contrato_assinado_em && (
                      <p style={{ fontSize: 10, color: "#6b7280", marginTop: 1 }}>
                        {new Date(selecionada.contrato_assinado_em).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {selecionada.contrato_pdf_url && (
                      <a href={selecionada.contrato_pdf_url} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", textDecoration: "none" }}>
                        PDF Gov.br ↗
                      </a>
                    )}
                    <a
                      href={`/api/chego-ctrl/contrato?tipo=loja&id=${selecionada.id}`}
                      target="_blank" rel="noreferrer"
                      style={{ fontSize: 11, fontWeight: 700, color: "#f97316", textDecoration: "none" }}
                    >
                      ⬇ Contrato PDF
                    </a>
                  </div>
                </div>
                {selecionada.contrato_assinatura && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selecionada.contrato_assinatura}
                    alt="Assinatura"
                    style={{ width: "100%", display: "block", background: "white", cursor: "zoom-in", maxHeight: 100, objectFit: "contain" }}
                    onClick={() => window.open(`/api/chego-ctrl/contrato?tipo=loja&id=${selecionada.id}`, "_blank")}
                  />
                )}
                {selecionada.modalidade_assinatura === "gov_br" && !selecionada.contrato_assinatura && (
                  <div style={{ padding: "12px 14px", background: "#EFF6FF", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🔐</span>
                    <p style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 600 }}>Assinatura digital via Gov.br — certificado ICP-Brasil</p>
                  </div>
                )}
                {selecionada.modalidade_assinatura === "presencial" && !selecionada.contrato_assinatura && (
                  <div style={{ padding: "12px 14px", background: "#F0FDF4", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🤝</span>
                    <p style={{ fontSize: 11, color: "#15803d", fontWeight: 600 }}>Contrato físico assinado presencialmente</p>
                  </div>
                )}
              </div>
            )}

            {/* Plano de assinatura */}
            <div style={{ margin: "0 20px 16px", padding: "14px 14px", borderRadius: 12, background: selecionada.plano ? "#FAFAFA" : "#FFF7ED", border: `1.5px solid ${selecionada.plano ? "#F1F5F9" : "#FED7AA"}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: selecionada.plano ? 10 : 6 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: selecionada.plano ? "#374151" : "#d97706" }}>
                  {selecionada.plano ? "Plano" : "⚠ Defina o plano antes do contrato"}
                </p>
                {selecionada.plano ? <PlanoBadge plano={selecionada.plano} /> : (
                  <span style={{ fontSize: 11, color: "#d97706", fontWeight: 700 }}>Obrigatório</span>
                )}
              </div>
              {selecionada.plano && selecionada.plano_ativo_desde && (
                <p style={{ fontSize: 10, color: "#94a3b8", marginBottom: 10 }}>
                  Ativo desde {new Date(selecionada.plano_ativo_desde).toLocaleDateString("pt-BR")}
                  {selecionada.plano !== "gold" && ` · ${PLANO_CFG[selecionada.plano]?.valor}`}
                </p>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <select
                  value={planoSelecionado}
                  onChange={e => setPlanoSelecionado(e.target.value)}
                  style={{
                    flex: 1, padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: "1.5px solid #E2E8F0", background: "white", color: "#374151", cursor: "pointer",
                  }}
                >
                  <option value="">Sem plano</option>
                  <option value="select">Select — R$ 149/mês</option>
                  <option value="prime">Prime — R$ 497/mês</option>
                  <option value="black">Black — R$ 997/mês</option>
                  <option value="gold">Gold — 10% / pedido</option>
                </select>
                <button
                  onClick={() => atribuirPlano(selecionada)}
                  disabled={atribuindoPlano}
                  style={{
                    padding: "7px 12px", borderRadius: 8,
                    border: "none", background: "#f97316",
                    color: "white", fontWeight: 700, fontSize: 12,
                    cursor: atribuindoPlano ? "not-allowed" : "pointer",
                    opacity: atribuindoPlano ? 0.7 : 1,
                  }}
                >
                  {atribuindoPlano ? "…" : "Salvar"}
                </button>
              </div>
            </div>

            {/* Subconta Asaas / Split */}
            <div style={{ margin: "0 20px 16px", padding: "14px", borderRadius: 12, background: "#FAFAFA", border: "1.5px solid #F1F5F9" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>Repasse Asaas</p>
                {selecionada.asaas_wallet_id ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 50, background: "#ECFDF5", color: "#059669", fontSize: 10, fontWeight: 800, border: "1px solid #A7F3D0" }}>
                    ✓ Split automático
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 50, background: "#FFF7ED", color: "#d97706", fontSize: 10, fontWeight: 800, border: "1px solid #FED7AA" }}>
                    Manual (saque)
                  </span>
                )}
              </div>
              {selecionada.asaas_wallet_id ? (
                <p style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>
                  WalletId: {selecionada.asaas_wallet_id}
                </p>
              ) : (
                <button
                  onClick={() => criarSubconta(selecionada)}
                  disabled={criandoSubconta || selecionada.status !== "ativo"}
                  style={{
                    width: "100%", padding: "9px", borderRadius: 8, marginTop: 4,
                    border: "1.5px solid #FED7AA", background: "#FFF7ED",
                    color: selecionada.status === "ativo" ? "#d97706" : "#d1d5db",
                    fontWeight: 700, fontSize: 12,
                    cursor: criandoSubconta || selecionada.status !== "ativo" ? "not-allowed" : "pointer",
                    opacity: criandoSubconta ? 0.7 : 1,
                  }}
                >
                  {criandoSubconta ? "Criando…" : selecionada.status === "ativo" ? "Criar subconta Asaas" : "Ative a loja primeiro"}
                </button>
              )}
            </div>

            {/* Certificado Digital A1 + CSC */}
            <div style={{ margin: "0 20px 16px", padding: "14px", borderRadius: 12, background: "#FAFAFA", border: "1.5px solid #F1F5F9" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>Certificado Digital</p>
                <button
                  onClick={() => { setCertFormAberto(o => !o); setCertForm({ fileB64: "", fileName: "", password: "", expires: "", cscId: selecionada.csc_id ?? "", cscToken: "" }) }}
                  style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", background: "none", border: "none", cursor: "pointer" }}
                >
                  {certFormAberto ? "Cancelar" : selecionada.cert_a1_path ? "Atualizar" : "Configurar"}
                </button>
              </div>

              {/* Status resumido */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: certFormAberto ? 12 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, width: 14, textAlign: "center" }}>{selecionada.cert_a1_path ? "✓" : "○"}</span>
                  <span style={{ fontSize: 11, color: selecionada.cert_a1_path ? "#059669" : "#9CA3AF", fontWeight: 600 }}>
                    {selecionada.cert_a1_path
                      ? `Cert A1 carregado${selecionada.cert_a1_expires_at ? ` · Vence ${new Date(selecionada.cert_a1_expires_at).toLocaleDateString("pt-BR")}` : ""}`
                      : "Sem certificado A1"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, width: 14, textAlign: "center" }}>{selecionada.cert_a1_senha_vault_id ? "✓" : "○"}</span>
                  <span style={{ fontSize: 11, color: selecionada.cert_a1_senha_vault_id ? "#059669" : "#9CA3AF", fontWeight: 600 }}>
                    {selecionada.cert_a1_senha_vault_id ? "Senha salva no Vault" : "Sem senha no Vault"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, width: 14, textAlign: "center" }}>{selecionada.csc_id ? "✓" : "○"}</span>
                  <span style={{ fontSize: 11, color: selecionada.csc_id ? "#059669" : "#9CA3AF", fontWeight: 600 }}>
                    {selecionada.csc_id ? `CSC ID: ${selecionada.csc_id}` : "Sem CSC"}
                  </span>
                </div>
              </div>

              {/* Formulário de upload */}
              {certFormAberto && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #E2E8F0", paddingTop: 12 }}>
                  {/* Arquivo .pfx */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Arquivo .pfx / .p12</p>
                    <label style={{
                      display: "block", padding: "8px 10px", borderRadius: 8,
                      border: "1.5px dashed #CBD5E1", background: "#F8FAFC",
                      cursor: "pointer", fontSize: 11, color: "#6B7280", textAlign: "center",
                    }}>
                      {certForm.fileName || "Clique para selecionar"}
                      <input
                        type="file"
                        accept=".pfx,.p12"
                        style={{ display: "none" }}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = ev => {
                            const b64 = (ev.target?.result as string).split(",")[1]
                            setCertForm(prev => ({ ...prev, fileB64: b64, fileName: file.name }))
                          }
                          reader.readAsDataURL(file)
                        }}
                      />
                    </label>
                  </div>

                  {/* Senha */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Senha do certificado</p>
                    <input
                      type="password"
                      value={certForm.password}
                      onChange={e => setCertForm(p => ({ ...p, password: e.target.value }))}
                      placeholder={selecionada.cert_a1_senha_vault_id ? "Deixe em branco para manter" : "Senha do .pfx"}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>

                  {/* Validade */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Validade do certificado</p>
                    <input
                      type="date"
                      value={certForm.expires}
                      onChange={e => setCertForm(p => ({ ...p, expires: e.target.value }))}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>

                  {/* CSC */}
                  <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 10 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>CSC ID</p>
                    <input
                      value={certForm.cscId}
                      onChange={e => setCertForm(p => ({ ...p, cscId: e.target.value }))}
                      placeholder="Ex: 000001"
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>CSC Token</p>
                    <input
                      type="password"
                      value={certForm.cscToken}
                      onChange={e => setCertForm(p => ({ ...p, cscToken: e.target.value }))}
                      placeholder={selecionada.csc_token_vault_id ? "Deixe em branco para manter" : "Token CSC (SEFAZ)"}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>

                  <button
                    onClick={() => salvarCert(selecionada)}
                    disabled={salvandoCert}
                    style={{
                      padding: "9px", borderRadius: 8, border: "none",
                      background: salvandoCert ? "#e5e7eb" : "#6366f1",
                      color: salvandoCert ? "#9CA3AF" : "white",
                      fontWeight: 700, fontSize: 12,
                      cursor: salvandoCert ? "not-allowed" : "pointer",
                    }}
                  >
                    {salvandoCert ? "Salvando…" : "Salvar certificado"}
                  </button>
                </div>
              )}
            </div>

            {/* Focus NFe / Emissão fiscal */}
            <div style={{ margin: "0 20px 16px", padding: "14px", borderRadius: 12, background: "#FAFAFA", border: "1.5px solid #F1F5F9" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>Emissão NFC-e</p>
                {selecionada.focusnfe_cadastrado && (
                  <span style={{ fontSize: 9, fontWeight: 800, color: "#059669", background: "#ECFDF5", padding: "2px 8px", borderRadius: 50, border: "1px solid #A7F3D0" }}>
                    Focus NFe ✓
                  </span>
                )}
              </div>

              {!selecionada.cert_a1_path ? (
                <p style={{ fontSize: 11, color: "#9CA3AF" }}>Configure o certificado A1 primeiro.</p>
              ) : !selecionada.focusnfe_cadastrado ? (
                <button
                  onClick={() => registrarNoFocusNfe(selecionada)}
                  disabled={registrandoFocus}
                  style={{
                    width: "100%", padding: "9px", borderRadius: 8,
                    border: "1.5px solid #C7D2FE", background: "#EEF2FF",
                    color: registrandoFocus ? "#9CA3AF" : "#4338ca",
                    fontWeight: 700, fontSize: 12,
                    cursor: registrandoFocus ? "not-allowed" : "pointer",
                    opacity: registrandoFocus ? 0.7 : 1,
                  }}
                >
                  {registrandoFocus ? "Registrando…" : "Registrar no Focus NFe"}
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: selecionada.fiscal_ativo ? "#059669" : "#6B7280" }}>
                      {selecionada.fiscal_ativo ? "Emissão ativa" : "Emissão inativa"}
                    </p>
                    <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
                      {selecionada.fiscal_ativo ? "NFC-e emitida automaticamente ao entregar" : "Nenhuma nota será emitida"}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFiscalAtivo(selecionada)}
                    disabled={togglingFiscal}
                    style={{
                      padding: "6px 14px", borderRadius: 8, fontWeight: 700, fontSize: 12,
                      border: "none", cursor: togglingFiscal ? "not-allowed" : "pointer",
                      background: selecionada.fiscal_ativo ? "#FEF2F2" : "#ECFDF5",
                      color:      selecionada.fiscal_ativo ? "#DC2626"  : "#059669",
                      opacity: togglingFiscal ? 0.6 : 1,
                    }}
                  >
                    {selecionada.fiscal_ativo ? "Desativar" : "Ativar"}
                  </button>
                </div>
              )}
            </div>

            {/* Link contrato */}
            {selecionada.status === "aprovado" && selecionada.contrato_token && (
              <div style={{ margin: "0 20px 16px", padding: 12, borderRadius: 10, background: "#EEF2FF", border: "1px solid #C7D2FE" }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: "#4338ca", marginBottom: 6 }}>🔗 Link do contrato gerado</p>
                <p style={{ fontSize: 11, color: "#818cf8", marginBottom: 8, wordBreak: "break-all" }}>
                  /contrato/loja/{selecionada.contrato_token.slice(0, 16)}…
                </p>
                <button onClick={() => copiarLink(selecionada)} style={{
                  width: "100%", padding: "8px", borderRadius: 8,
                  border: "1.5px solid #818cf8", background: copiado ? "#6366f1" : "white",
                  color: copiado ? "white" : "#6366f1", fontWeight: 700, fontSize: 12, cursor: "pointer",
                  transition: "all 0.2s",
                }}>
                  {copiado ? "✓ Copiado!" : "Copiar link"}
                </button>
              </div>
            )}

            {/* Botão documentação */}
            <div style={{ padding: "0 20px 14px" }}>
              <button
                onClick={() => router.push(`/chego-ctrl/documentos/loja?id=${selecionada.id}`)}
                style={{
                  width: "100%", padding: "11px", borderRadius: 10,
                  border: "1.5px solid #E2E8F0", background: "#F8FAFC",
                  color: "#374151", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>
                </svg>
                Ver documentação completa
              </button>
            </div>

            {/* Ações */}
            <div style={{ padding: "16px 20px", borderTop: "1.5px solid #F1F5F9", display: "flex", flexDirection: "column", gap: 8 }}>
              {selecionada.status === "pendente" && (<>
                <button onClick={() => aprovar(selecionada)} disabled={salvando} style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "none",
                  background: salvando ? "#e5e7eb" : "linear-gradient(135deg, #f97316, #dc2626)",
                  color: "white", fontWeight: 800, fontSize: 13, cursor: salvando ? "not-allowed" : "pointer",
                  boxShadow: salvando ? "none" : "0 4px 16px rgba(249,115,22,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  {salvando ? "Salvando…" : "✓ Aprovar e gerar contrato"}
                </button>
                <button onClick={() => atualizarStatus(selecionada.id, "suspenso")} disabled={salvando} style={{
                  width: "100%", padding: "11px", borderRadius: 10,
                  border: "1.5px solid #FECACA", background: "#FEF2F2",
                  color: "#dc2626", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}>
                  Recusar cadastro
                </button>
              </>)}
              {selecionada.status === "aprovado" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ textAlign: "center", padding: "6px 0" }}>
                    <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>⏳ Aguardando assinatura do contrato</p>
                  </div>
                  <button
                    onClick={() => marcarPresencial(selecionada)}
                    disabled={marcandoPresencial}
                    style={{
                      width: "100%", padding: "11px", borderRadius: 10,
                      border: "1.5px solid #BBF7D0", background: "#F0FDF4",
                      color: "#15803d", fontWeight: 700, fontSize: 12,
                      cursor: marcandoPresencial ? "not-allowed" : "pointer",
                      opacity: marcandoPresencial ? 0.7 : 1,
                    }}
                  >
                    {marcandoPresencial ? "Salvando…" : "🤝 Marcar como assinado presencialmente"}
                  </button>
                </div>
              )}
              {selecionada.status === "contrato_assinado" && (
                <button onClick={() => ativarLoja(selecionada)} disabled={salvando} style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "white", fontWeight: 800, fontSize: 13, cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
                }}>
                  {salvando ? "Ativando…" : "✓ Ativar loja"}
                </button>
              )}
              {["ativo", "contrato_assinado", "aprovado"].includes(selecionada.status) && (
                <button onClick={() => atualizarStatus(selecionada.id, "suspenso")} disabled={salvando} style={{
                  width: "100%", padding: "11px", borderRadius: 10,
                  border: "1.5px solid #FECACA", background: "#FEF2F2",
                  color: "#dc2626", fontWeight: 700, fontSize: 13, cursor: salvando ? "not-allowed" : "pointer",
                }}>
                  {salvando ? "Salvando…" : "⛔ Suspender lojista"}
                </button>
              )}

              {/* Ações de contrato */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>Contrato</p>

                {/* Ver PDF */}
                <a
                  href={`/api/chego-ctrl/contrato?tipo=loja&id=${selecionada.id}&modo=preview`}
                  target="_blank" rel="noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    width: "100%", padding: "10px", borderRadius: 10, textDecoration: "none",
                    border: "1.5px solid #BFDBFE", background: "#EFF6FF",
                    color: "#1d4ed8", fontWeight: 700, fontSize: 13,
                  }}
                >
                  📄 Ver / baixar PDF
                </a>

                {/* Enviar por email */}
                <button
                  onClick={() => enviarContratoPorEmail(selecionada)}
                  disabled={enviandoEmail || !selecionada.email}
                  title={!selecionada.email ? "Loja sem e-mail cadastrado" : ""}
                  style={{
                    width: "100%", padding: "10px", borderRadius: 10,
                    border: "1.5px solid #BBF7D0", background: emailEnviado ? "#F0FDF4" : "#F0FDF4",
                    color: emailEnviado ? "#15803d" : "#15803d", fontWeight: 700, fontSize: 13,
                    cursor: (enviandoEmail || !selecionada.email) ? "not-allowed" : "pointer",
                    opacity: !selecionada.email ? 0.5 : 1,
                  }}
                >
                  {enviandoEmail ? "Enviando…" : emailEnviado ? "✓ Email enviado!" : "📧 Enviar por email"}
                </button>

                {/* Gerar / copiar link */}
                <button onClick={() => { setLinkGerado(""); reenviarContrato(selecionada) }} disabled={salvando} style={{
                  width: "100%", padding: "10px", borderRadius: 10,
                  border: "1.5px solid #C7D2FE", background: "#EEF2FF",
                  color: "#4338ca", fontWeight: 700, fontSize: 13, cursor: salvando ? "not-allowed" : "pointer",
                }}>
                  {salvando ? "Gerando…" : "🔗 Copiar link do contrato"}
                </button>
                {linkGerado && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 12px" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#15803d", marginBottom: 6 }}>Link do contrato:</p>
                    <p style={{ fontSize: 10, color: "#166534", wordBreak: "break-all", marginBottom: 8 }}>{linkGerado}</p>
                    <button onClick={() => navigator.clipboard.writeText(linkGerado).catch(() => prompt("Copie o link:", linkGerado))} style={{
                      width: "100%", padding: "6px", borderRadius: 7,
                      border: "1px solid #86efac", background: "white",
                      color: "#15803d", fontWeight: 700, fontSize: 11, cursor: "pointer",
                    }}>Copiar link</button>
                  </div>
                )}
              </div>
              {selecionada.status === "suspenso" && (
                <button onClick={() => atualizarStatus(selecionada.id, "ativo")} disabled={salvando} style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "white", fontWeight: 800, fontSize: 13, cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
                }}>
                  Reativar loja
                </button>
              )}

              {/* Excluir loja — disponível para qualquer status */}
              {!confirmExcluir ? (
                <button onClick={() => setConfirmExcluir(true)} style={{
                  width: "100%", padding: "10px", borderRadius: 10,
                  border: "1.5px solid #fca5a5", background: "transparent",
                  color: "#dc2626", fontWeight: 700, fontSize: 12,
                  cursor: "pointer", marginTop: 4,
                }}>
                  🗑 Excluir loja permanentemente
                </button>
              ) : (
                <div style={{
                  border: "1.5px solid #fca5a5", borderRadius: 10,
                  padding: "12px", background: "#FEF2F2", marginTop: 4,
                }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>
                    Excluir "{selecionada.nome}"?
                  </p>
                  <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>
                    Todos os produtos, pedidos e dados da loja serão removidos. Esta ação é irreversível.
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setConfirmExcluir(false)} style={{
                      flex: 1, padding: "8px", borderRadius: 8,
                      border: "1px solid #e5e7eb", background: "white",
                      color: "#6b7280", fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>Cancelar</button>
                    <button onClick={() => excluirLoja(selecionada)} disabled={excluindo} style={{
                      flex: 1, padding: "8px", borderRadius: 8, border: "none",
                      background: "#dc2626", color: "white",
                      fontWeight: 800, fontSize: 12,
                      cursor: excluindo ? "not-allowed" : "pointer",
                      opacity: excluindo ? 0.7 : 1,
                    }}>
                      {excluindo ? "Excluindo…" : "Confirmar exclusão"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  )
}
