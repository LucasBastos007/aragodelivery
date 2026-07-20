"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Pedido, StatusPedido } from "@/types"

const WA_SVG = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M11.999 0C5.372 0 0 5.373 0 12c0 2.117.554 4.103 1.523 5.829L.054 23.5l5.832-1.528A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12.001-12zm.001 21.818a9.822 9.822 0 01-5.004-1.372l-.36-.213-3.463.908.924-3.375-.234-.374A9.816 9.816 0 012.182 12C2.182 6.57 6.569 2.182 12 2.182S21.818 6.57 21.818 12c0 5.43-4.387 9.818-9.818 9.818z"/>
  </svg>
)

function BotaoWA({ telefone, msg, label }: { telefone?: string | null; msg: string; label: string }) {
  if (!telefone) return null
  const tel = telefone.replace(/\D/g, "")
  if (!tel) return null
  return (
    <a
      href={`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`}
      target="_blank" rel="noopener noreferrer"
      title={`WhatsApp ${label}`}
      onClick={e => e.stopPropagation()}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 10, padding: "3px 8px", borderRadius: 6,
        border: "1px solid rgba(37,211,102,0.35)",
        background: "rgba(37,211,102,0.07)", color: "#16a34a",
        fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap",
      }}
    >
      {WA_SVG} {label}
    </a>
  )
}

// Etapas da timeline com campo de timestamp correspondente
const ETAPAS_PEDIDO = [
  { key: "pedido",   label: "Pedido",   statuses: ["pendente", "aguardando_pagamento"], tsKey: "criado_em"  },
  { key: "aceito",   label: "Aceito",   statuses: ["aceito"],                           tsKey: "aceito_em"  },
  { key: "preparo",  label: "Pronto",   statuses: ["preparando", "pronto"],             tsKey: "pronto_em"  },
  { key: "motoboy",  label: "Motoboy",  statuses: ["aguardando_aceite", "indo_para_loja", "na_loja"], tsKey: null },
  { key: "rota",     label: "Coletou",  statuses: ["em_rota", "coletado"],              tsKey: "coletado_em" },
  { key: "entregue", label: "Entregue", statuses: ["entregue"],                         tsKey: "entregue_em" },
] as const

const ETAPAS_RETIRADA = [
  { key: "pedido",   label: "Pedido",          statuses: ["pendente", "aguardando_pagamento"],                                     tsKey: "criado_em"  },
  { key: "aceito",   label: "Aceito",          statuses: ["aceito"],                                                               tsKey: "aceito_em"  },
  { key: "preparo",  label: "Em Preparo",      statuses: ["preparando"],                                                           tsKey: "pronto_em"  },
  { key: "pronto",   label: "Pronto p/ Ret.",  statuses: ["pronto", "aguardando_aceite", "indo_para_loja", "na_loja", "em_rota", "coletado"], tsKey: "pronto_em" },
  { key: "entregue", label: "Retirado",        statuses: ["entregue"],                                                             tsKey: "entregue_em" },
] as const

function TimelinePedido({ status, pedido }: { status: StatusPedido; pedido: Pedido }) {
  const fmtTs = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null

  if (status === "cancelado") {
    return (
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700 }}>Pedido cancelado</span>
      </div>
    )
  }

  const isRetirada = pedido.endereco_entrega?.includes("Retirada") ?? false
  const etapas = isRetirada ? ETAPAS_RETIRADA : ETAPAS_PEDIDO
  const idxAtual = etapas.findIndex(e => (e.statuses as readonly string[]).includes(status))

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0, marginTop: 10 }}>
      {etapas.map((e, i) => {
        const done    = i < idxAtual
        const current = i === idxAtual
        const dotColor  = (done || current) ? "#f97316" : "#e2e8f0"
        const lineColor = done ? "#f97316" : "#e2e8f0"
        const textColor = (done || current) ? "#f97316" : "#94a3b8"
        const hora = e.tsKey ? fmtTs((pedido as any)[e.tsKey]) : null

        return (
          <div key={e.key} style={{ display: "flex", alignItems: "flex-start", flex: i < etapas.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{
                width: current ? 10 : 8, height: current ? 10 : 8,
                borderRadius: "50%", background: dotColor, flexShrink: 0,
                boxShadow: current ? "0 0 0 3px rgba(249,115,22,0.2)" : "none",
                marginTop: 1,
              }} />
              <span style={{ fontSize: 8, color: textColor, fontWeight: current ? 800 : done ? 600 : 400, whiteSpace: "nowrap", textAlign: "center" }}>
                {e.label}
              </span>
              {hora && (
                <span style={{ fontSize: 8, color: done ? "#64748b" : "#f97316", fontWeight: 700, whiteSpace: "nowrap" }}>
                  {hora}
                </span>
              )}
            </div>
            {i < etapas.length - 1 && (
              <div style={{ flex: 1, height: 2, background: lineColor, margin: "0 2px", marginTop: 4, minWidth: 6, transition: "background 0.3s" }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function PercursoItem({ cor, label, hora, linha }: { cor: string; label: string; hora: string; linha: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: cor, flexShrink: 0, marginTop: 2 }} />
        {linha && <div style={{ width: 2, flex: 1, background: "#e2e8f0", margin: "2px 0 2px" }} />}
      </div>
      <div style={{ paddingBottom: linha ? 10 : 0, display: "flex", justifyContent: "space-between", flex: 1 }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{hora}</span>
      </div>
    </div>
  )
}

function ConfirmarCartaoBtn({ pedidoId, onConfirmado }: { pedidoId: string; onConfirmado: () => void }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")

  async function verificar() {
    setLoading(true)
    setMsg("")
    const r = await fetch("/api/pagamento/verificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: pedidoId }),
    }).then(r => r.json()).catch(() => ({}))
    if (r.confirmado) { onConfirmado() }
    else { setMsg(r.status === "cancelado" ? "Recusado" : "Pendente") }
    setLoading(false)
  }

  return (
    <div style={{ marginTop: 4 }}>
      <button onClick={verificar} disabled={loading} style={{
        fontSize: 10, padding: "2px 6px", borderRadius: 6, border: "1px solid #f97316",
        background: "none", color: "#f97316", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700,
      }}>
        {loading ? "..." : "Confirmar"}
      </button>
      {msg && <p style={{ fontSize: 9, color: msg === "Recusado" ? "#DC2626" : "#6B7280", marginTop: 2 }}>{msg}</p>}
    </div>
  )
}

const STATUS_LABEL: Record<StatusPedido, string> = {
  aguardando_pagamento: "Aguard. pagamento",
  pendente:          "Pendente",
  aceito:            "Aceito",
  preparando:        "Preparando",
  pronto:            "Pronto",
  aguardando_aceite: "Aguard. motoboy",
  indo_para_loja:    "Indo à loja",
  na_loja:           "Na loja",
  em_rota:           "Em rota",
  coletado:          "Coletado",
  entregue:          "Entregue",
  cancelado:         "Cancelado",
}
const STATUS_BADGE: Record<StatusPedido, string> = {
  aguardando_pagamento: "badge-yellow",
  pendente:          "badge-yellow",
  aceito:            "badge-blue",
  preparando:        "badge-orange",
  pronto:            "badge-blue",
  aguardando_aceite: "badge-orange",
  indo_para_loja:    "badge-blue",
  na_loja:           "badge-blue",
  em_rota:           "badge-orange",
  coletado:          "badge-blue",
  entregue:          "badge-green",
  cancelado:         "badge-red",
}
const PAGAMENTO_ICON: Record<string, string> = {
  pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha",
}

const AVULSA_STATUS_LABEL: Record<string, string> = {
  aguardando: "Aguardando motoboy",
  aceito:     "Indo à loja",
  coletado:   "Pedido coletado",
  em_rota:    "Em rota",
  entregue:   "Entregue",
  cancelado:  "Cancelado",
}
const AVULSA_STATUS_BADGE: Record<string, string> = {
  aguardando: "badge-yellow",
  aceito:     "badge-blue",
  coletado:   "badge-blue",
  em_rota:    "badge-orange",
  entregue:   "badge-green",
  cancelado:  "badge-red",
}

const ETAPAS_AVULSA = [
  { key: "aguardando", label: "Aguardando" },
  { key: "aceito",     label: "Indo à loja" },
  { key: "coletado",   label: "Coletado" },
  { key: "em_rota",    label: "Em rota" },
  { key: "entregue",   label: "Entregue" },
]

function ProgressoAvulsa({ status }: { status: string }) {
  const idx = ETAPAS_AVULSA.findIndex(e => e.key === status)
  if (idx < 0 || status === "cancelado") return null
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 8 }}>
      {ETAPAS_AVULSA.map((e, i) => {
        const done    = i < idx
        const current = i === idx
        const color   = done || current ? "#8b5cf6" : "#e2e8f0"
        const textClr = done || current ? "#8b5cf6" : "#94a3b8"
        return (
          <div key={e.key} style={{ display: "flex", alignItems: "center", flex: i < ETAPAS_AVULSA.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: current ? "#8b5cf6" : done ? "#8b5cf6" : "#e2e8f0",
                border: current ? "2px solid #8b5cf6" : "none",
                boxShadow: current ? "0 0 0 3px rgba(139,92,246,0.2)" : "none",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 8, color: textClr, fontWeight: current ? 800 : 400, whiteSpace: "nowrap" }}>
                {e.label}
              </span>
            </div>
            {i < ETAPAS_AVULSA.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? "#8b5cf6" : "#e2e8f0", margin: "0 2px", marginBottom: 14, minWidth: 8 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function BotaoWhatsApp({ avulsa, fone }: { avulsa: any; fone?: string }) {
  if (!fone) return null
  const tel = fone.replace(/\D/g, "")
  if (!tel) return null

  const msgs: Record<string, string> = {
    aguardando: `Olá! Temos uma entrega avulsa *${avulsa.codigo}* aguardando motoboy para o cliente *${avulsa.cliente_nome}* (${avulsa.endereco}). Já tem alguém confirmado?`,
    aceito:     `Olá! O motoboy *${avulsa.motoboy_nome ?? ""}* aceitou a entrega *${avulsa.codigo}* e está a caminho da sua loja. Aguarde!`,
    coletado:   `Olá! O motoboy *${avulsa.motoboy_nome ?? ""}* já coletou o pedido *${avulsa.codigo}* e está a caminho do cliente *${avulsa.cliente_nome}*.`,
    em_rota:    `Olá! O motoboy *${avulsa.motoboy_nome ?? ""}* está em rota entregando o pedido *${avulsa.codigo}* para *${avulsa.cliente_nome}*.`,
  }
  const txt = msgs[avulsa.status]
  if (!txt) return null

  return (
    <a
      href={`https://wa.me/55${tel}?text=${encodeURIComponent(txt)}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 10, padding: "3px 8px", borderRadius: 6,
        border: "1px solid rgba(37,211,102,0.4)",
        background: "rgba(37,211,102,0.08)", color: "#16a34a",
        fontWeight: 700, textDecoration: "none",
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="#16a34a">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M11.999 0C5.372 0 0 5.373 0 12c0 2.117.554 4.103 1.523 5.829L.054 23.5l5.832-1.528A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12.001-12zm.001 21.818a9.822 9.822 0 01-5.004-1.372l-.36-.213-3.463.908.924-3.375-.234-.374A9.816 9.816 0 012.182 12C2.182 6.57 6.569 2.182 12 2.182S21.818 6.57 21.818 12c0 5.43-4.387 9.818-9.818 9.818z"/>
      </svg>
      WhatsApp loja
    </a>
  )
}

type Filtro = "todos" | "avulsas" | StatusPedido
type Periodo = "hoje" | "7d" | "15d" | "30d" | "custom"

const PERIODO_LABELS: Record<Periodo, string> = {
  hoje: "Hoje", "7d": "7 dias", "15d": "15 dias", "30d": "30 dias", custom: "Personalizado",
}

// Retorna "YYYY-MM-DD" no fuso de Brasília (UTC-3, sem DST desde 2019)
function dataBRT(offsetDias = 0): string {
  const d = new Date(Date.now() + offsetDias * 86_400_000)
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(d)
}

// criado_em é timestamptz em UTC no Supabase.
// 00:00 BRT = 03:00 UTC | 23:59:59 BRT = 02:59:59 UTC do dia seguinte.
function rangeDatas(periodo: Periodo, ci: string, cf: string) {
  if (periodo === "hoje") return {
    inicio: `${dataBRT()}T03:00:00`,
    fim:    `${dataBRT(1)}T02:59:59`,
  }
  if (periodo === "7d") return {
    inicio: `${dataBRT(-6)}T03:00:00`,
    fim:    `${dataBRT(1)}T02:59:59`,
  }
  if (periodo === "15d") return {
    inicio: `${dataBRT(-14)}T03:00:00`,
    fim:    `${dataBRT(1)}T02:59:59`,
  }
  if (periodo === "30d") return {
    inicio: `${dataBRT(-29)}T03:00:00`,
    fim:    `${dataBRT(1)}T02:59:59`,
  }
  if (ci && cf) return { inicio: `${ci}T03:00:00`, fim: `${cf}T02:59:59` }  // custom: datas já em BRT
  return { inicio: `${dataBRT()}T03:00:00`, fim: `${dataBRT(1)}T02:59:59` }
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [avulsas, setAvulsas] = useState<any[]>([])
  const [lojaFone,    setLojaFone]    = useState<Record<string, string>>({})
  const [motoboyFone, setMotoboyFone] = useState<Record<string, string>>({})
  const [loading, setLoading]  = useState(true)
  const [filtro, setFiltro]    = useState<Filtro>("todos")
  const [expandido, setExpandido] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deletando, setDeletando] = useState(false)

  async function excluirPedido(id: string) {
    setDeletando(true)
    await fetch("/api/chego-ctrl/excluir-pedido", {
      method: "DELETE", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: id }),
    })
    setPedidos(prev => prev.filter(p => p.id !== id))
    setConfirmDelete(null)
    setDeletando(false)
  }
  const [periodo, setPeriodo]  = useState<Periodo>("hoje")
  const [customInicio, setCustomInicio] = useState("")
  const [customFim,    setCustomFim]    = useState("")

  async function load(per = periodo, ci = customInicio, cf = customFim) {
    const { inicio, fim } = rangeDatas(per, ci, cf)
    const [{ data: pedData }, { data: avData }] = await Promise.all([
      supabase
        .from("pedidos")
        .select("*, loja:lojas(nome, telefone), motoboy:motoboys(nome, telefone), itens:itens_pedido(*)")
        .gte("criado_em", inicio)
        .lte("criado_em", fim)
        .order("criado_em", { ascending: false })
        .limit(1000),
      supabase
        .from("entregas_avulsas")
        .select("*")
        .gte("criado_em", inicio)
        .lte("criado_em", fim)
        .order("criado_em", { ascending: false })
        .limit(1000),
    ])
    setPedidos((pedData as Pedido[]) ?? [])

    const avList = avData ?? []
    setAvulsas(avList)

    // Busca telefones das lojas e motoboys das avulsas
    const lojaIds    = [...new Set(avList.map((a: any) => a.loja_id).filter(Boolean))]
    const motoboyIds = [...new Set(avList.map((a: any) => a.motoboy_id).filter(Boolean))]

    const [{ data: lojasData }, { data: motoboysData }] = await Promise.all([
      lojaIds.length    > 0 ? supabase.from("lojas").select("id, telefone").in("id", lojaIds)       : Promise.resolve({ data: [] }),
      motoboyIds.length > 0 ? supabase.from("motoboys").select("id, telefone").in("id", motoboyIds) : Promise.resolve({ data: [] }),
    ])

    const fones: Record<string, string> = {}
    for (const l of lojasData ?? []) { if (l.telefone) fones[l.id] = l.telefone }
    setLojaFone(fones)

    const mFones: Record<string, string> = {}
    for (const m of motoboysData ?? []) { if (m.telefone) mFones[m.id] = m.telefone }
    setMotoboyFone(mFones)

    setLoading(false)
  }

  useEffect(() => {
    if (periodo === "custom" && (!customInicio || !customFim)) return
    load(periodo, customInicio, customFim)
    if (periodo === "hoje") {
      const iv = setInterval(() => load("hoje", "", ""), 5_000)
      return () => clearInterval(iv)
    }
  }, [periodo, customInicio, customFim])

  const totalPeriodo = pedidos
    .filter(p => p.status === "entregue")
    .reduce((s, p) => s + p.total, 0)

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  const diffMin = (a: string, b: string) =>
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)

  // ── Definição das colunas do kanban ─────────────────────────────────────────
  const COLUNAS = [
    { id: "aguardando_pagamento", label: "Aguard. Pagamento", color: "#f59e0b", statuses: ["aguardando_pagamento"], tsKey: "criado_em",   tsLabel: "Criado"   },
    { id: "pendente",   label: "Pendente",   color: "#f97316", statuses: ["pendente"],                                    tsKey: "criado_em",   tsLabel: "Criado"   },
    { id: "aceito",     label: "Aceito",     color: "#3b82f6", statuses: ["aceito"],                                      tsKey: "aceito_em",   tsLabel: "Aceito"   },
    { id: "preparando", label: "Preparando", color: "#8b5cf6", statuses: ["preparando"],                                  tsKey: "aceito_em",   tsLabel: "Iniciado" },
    { id: "pronto",     label: "Pronto",     color: "#06b6d4", statuses: ["pronto","aguardando_aceite","indo_para_loja","na_loja"], tsKey: "pronto_em", tsLabel: "Pronto" },
    { id: "coletado",   label: "Coletado",   color: "#f97316", statuses: ["em_rota","coletado"],                          tsKey: "coletado_em", tsLabel: "Coletado" },
    { id: "entregue",   label: "Entregue",   color: "#22c55e", statuses: ["entregue"],                                    tsKey: "entregue_em", tsLabel: "Entregue" },
  ] as const

  // Mapeia status da entrega avulsa para coluna do kanban
  function avulsaColuna(status: string): string {
    if (status === "aguardando" || status === "aguardando_aceite") return "pendente"
    if (status === "aceito") return "aceito"
    if (status === "coletado" || status === "em_rota") return "coletado"
    if (status === "entregue") return "entregue"
    return ""
  }

  const cancelados = pedidos.filter(p => p.status === "cancelado")
  const avulsasCanceladas = avulsas.filter((a: any) => a.status === "cancelado")

  return (
    <div style={{ padding: "24px 24px 40px" }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <h1 style={{ color: "#0F172A", fontSize: 22, fontWeight: 900, margin: 0 }}>Pipeline de Pedidos</h1>
          <span style={{ color: "#22c55e", fontWeight: 800, fontSize: 15 }}>
            R$ {totalPeriodo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>
            ({pedidos.filter(p => p.status === "entregue").length} entregues · {pedidos.length} total)
          </span>
        </div>

        {/* Seletor de período */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["hoje", "7d", "15d", "30d", "custom"] as Periodo[]).map(p => (
            <button key={p} onClick={() => setPeriodo(p)} style={{
              fontSize: 11, padding: "4px 12px", borderRadius: 20, border: "1px solid",
              background:   periodo === p ? "rgba(99,102,241,0.1)" : "#f8fafc",
              color:        periodo === p ? "#6366f1" : "#64748b",
              borderColor:  periodo === p ? "rgba(99,102,241,0.4)" : "#e2e8f0",
              fontWeight:   periodo === p ? 700 : 400, cursor: "pointer",
            }}>
              {PERIODO_LABELS[p]}
            </button>
          ))}
        </div>
        {periodo === "custom" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
            <input type="date" value={customInicio} onChange={e => setCustomInicio(e.target.value)}
              style={{ fontSize: 12, padding: "5px 8px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#0F172A" }} />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>até</span>
            <input type="date" value={customFim} onChange={e => setCustomFim(e.target.value)}
              style={{ fontSize: 12, padding: "5px 8px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#0F172A" }} />
          </div>
        )}
      </div>

      {/* ── Kanban ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <p style={{ color: "#94a3b8", fontSize: 13 }}>Carregando...</p>
      ) : (
        <>
          {/* Board horizontal */}
          <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>
            {COLUNAS.map(col => {
              const cards = pedidos
                .filter(p => (col.statuses as readonly string[]).includes(p.status))
                .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
              const avulsasCol = avulsas
                .filter((a: any) => avulsaColuna(a.status) === col.id)
                .sort((a: any, b: any) => b.criado_em.localeCompare(a.criado_em))
              const totalCol = cards.length + avulsasCol.length
              return (
                <div key={col.id} style={{ minWidth: 240, maxWidth: 260, flex: "0 0 250px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Cabeçalho da coluna */}
                  <div style={{
                    padding: "8px 12px", borderRadius: 10,
                    background: `${col.color}15`,
                    border: `1px solid ${col.color}35`,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: col.color }}>{col.label}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 900, color: "white",
                      background: col.color, borderRadius: 20, padding: "1px 8px", minWidth: 22, textAlign: "center",
                    }}>{totalCol}</span>
                  </div>

                  {/* Cards avulsas (roxo) */}
                  {avulsasCol.map((a: any) => (
                    <div key={a.id} style={{
                      background: "white", borderRadius: 12,
                      border: "1px solid rgba(139,92,246,0.25)",
                      borderTop: "3px solid #8b5cf6",
                      padding: "10px 12px",
                      boxShadow: "0 1px 4px rgba(139,92,246,0.08)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>#{a.codigo}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, color: "#8b5cf6", background: "rgba(139,92,246,0.1)", borderRadius: 5, padding: "1px 6px" }}>🛵 AVULSA</span>
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.loja_nome ?? "—"}
                      </p>
                      {a.cliente_nome && (
                        <p style={{ fontSize: 11, color: "#64748b", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.cliente_nome}</p>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 900, color: "#8b5cf6" }}>R$ {(a.taxa_entrega ?? 0).toFixed(2)}</span>
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>🕐 {fmt(a.criado_em)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 4, marginTop: 6 }} onClick={e => e.stopPropagation()}>
                        <BotaoWA telefone={lojaFone[a.loja_id]} label="Loja" msg={`Entrega avulsa *#${a.codigo}*`} />
                        <BotaoWA telefone={a.cliente_tel} label="Cliente" msg={`Entrega avulsa *#${a.codigo}*`} />
                        <BotaoWA telefone={motoboyFone[a.motoboy_id]} label="Motoboy" msg={`Entrega avulsa *#${a.codigo}*`} />
                      </div>
                    </div>
                  ))}

                  {/* Cards pedidos normais */}
                  {totalCol === 0 ? (
                    <div style={{ padding: "16px 0", textAlign: "center" }}>
                      <span style={{ fontSize: 11, color: "#cbd5e1" }}>Vazio</span>
                    </div>
                  ) : cards.map(p => {
                    const aberto = expandido === p.id
                    const itens: any[] = (p as any).itens ?? []
                    const ts = col.tsKey ? (p as any)[col.tsKey] : null
                    return (
                      <div key={p.id} style={{
                        background: "white", borderRadius: 12,
                        border: `1px solid #e2e8f0`,
                        borderTop: `3px solid ${col.color}`,
                        overflow: "hidden",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      }}>
                        {/* Card header */}
                        <div
                          onClick={() => setExpandido(aberto ? null : p.id)}
                          style={{ padding: "10px 12px", cursor: "pointer" }}
                        >
                          {/* Código + timestamp + lixeira */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>#{p.codigo}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={e => e.stopPropagation()}>
                              {ts && (
                                <span style={{
                                  fontSize: 10, fontWeight: 700,
                                  background: `${col.color}15`, color: col.color,
                                  borderRadius: 6, padding: "2px 7px",
                                }}>
                                  {col.tsLabel} {fmt(ts)}
                                </span>
                              )}
                              {confirmDelete === p.id ? (
                                <div style={{ display: "flex", gap: 3 }}>
                                  <button
                                    onClick={() => excluirPedido(p.id)}
                                    disabled={deletando}
                                    style={{
                                      fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5, border: "none",
                                      background: "#ef4444", color: "white", cursor: "pointer",
                                    }}
                                  >
                                    {deletando ? "..." : "Confirmar"}
                                  </button>
                                  <button
                                    onClick={() => setConfirmDelete(null)}
                                    style={{
                                      fontSize: 10, padding: "2px 6px", borderRadius: 5, border: "1px solid #e2e8f0",
                                      background: "#f8fafc", color: "#64748b", cursor: "pointer",
                                    }}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDelete(p.id)}
                                  title="Excluir pedido"
                                  style={{
                                    background: "none", border: "none", cursor: "pointer",
                                    padding: "2px 4px", borderRadius: 4,
                                    color: "#cbd5e1", lineHeight: 1,
                                  }}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Loja */}
                          <p style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {(p.loja as any)?.nome ?? "—"}
                          </p>

                          {/* Cliente */}
                          {p.nome_cliente && (
                            <p style={{ fontSize: 11, color: "#64748b", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.nome_cliente}
                            </p>
                          )}

                          {/* Motoboy */}
                          {(p.motoboy as any)?.nome && (
                            <p style={{ fontSize: 11, color: "#8b5cf6", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              🛵 {(p.motoboy as any).nome}
                            </p>
                          )}

                          {/* Valor + pagamento */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 900, color: "#0F172A" }}>
                              R$ {p.total.toFixed(2)}
                            </span>
                            <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>
                              {PAGAMENTO_ICON[p.forma_pagamento]}
                            </span>
                          </div>

                          {/* Timeline de horários */}
                          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: "3px 8px" }}>
                            <span style={{ fontSize: 10, color: "#94a3b8" }}>🕐 {fmt(p.criado_em)}</span>
                            {(p as any).aceito_em   && <span style={{ fontSize: 10, color: "#3b82f6" }}>✓ {fmt((p as any).aceito_em)}</span>}
                            {(p as any).pronto_em   && <span style={{ fontSize: 10, color: "#06b6d4" }}>📦 {fmt((p as any).pronto_em)}</span>}
                            {(p as any).coletado_em && <span style={{ fontSize: 10, color: "#f97316" }}>🛵 {fmt((p as any).coletado_em)}</span>}
                            {(p as any).entregue_em && <span style={{ fontSize: 10, color: "#22c55e" }}>✅ {fmt((p as any).entregue_em)}</span>}
                          </div>

                          {/* WhatsApp */}
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }} onClick={e => e.stopPropagation()}>
                            <BotaoWA telefone={(p.loja as any)?.telefone} label="Loja" msg={`Pedido *#${p.codigo}*`} />
                            <BotaoWA telefone={p.telefone_cliente} label="Cliente" msg={`Pedido *#${p.codigo}*`} />
                            <BotaoWA telefone={(p.motoboy as any)?.telefone} label="Motoboy" msg={`Entrega *#${p.codigo}*`} />
                          </div>

                          {p.status === "aguardando_pagamento" && p.forma_pagamento === "cartao" && (
                            <div onClick={e => e.stopPropagation()}>
                              <ConfirmarCartaoBtn pedidoId={p.id} onConfirmado={() => setPedidos(prev =>
                                prev.map(x => x.id === p.id ? { ...x, status: "pendente" as StatusPedido } : x)
                              )} />
                            </div>
                          )}

                          <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 6, textAlign: "right" }}>
                            {aberto ? "▲ fechar" : "▼ ver itens"}
                          </p>
                        </div>

                        {/* Itens expandidos */}
                        {aberto && (
                          <div style={{ borderTop: "1px solid #f1f5f9", padding: "10px 12px 12px", background: "#f8fafc" }}>
                            {itens.length === 0 ? (
                              <p style={{ fontSize: 12, color: "#94a3b8" }}>Sem itens.</p>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {itens.map((it: any, i: number) => (
                                  <div key={it.id ?? i} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <p style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{it.quantidade}x {it.nome}</p>
                                      {Array.isArray(it.adicionais) && it.adicionais.length > 0 && it.adicionais.map((ad: any, j: number) => (
                                        <p key={j} style={{ fontSize: 10, color: "#64748b" }}>+ {ad.nome ?? ad}{ad.preco > 0 ? ` R$ ${Number(ad.preco).toFixed(2)}` : ""}</p>
                                      ))}
                                      {it.observacao && <p style={{ fontSize: 10, color: "#f97316" }}>Obs: {it.observacao}
                                </p>
                              }
                            </div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", flexShrink: 0 }}>
                              R$ {(it.preco * it.quantidade).toFixed(2)}
                            </p>
                          </div>
                        ))}
                        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "#64748b" }}>Subtotal</span>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>R$ {p.subtotal.toFixed(2)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "#64748b" }}>Taxa entrega</span>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>R$ {p.taxa_entrega.toFixed(2)}</span>
                        </div>
                        {p.observacao && (
                          <p style={{ fontSize: 11, color: "#f97316", background: "rgba(249,115,22,0.06)", padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(249,115,22,0.15)" }}>
                            Obs do cliente: {p.observacao}
                          </p>
                        )}

                        {/* Percurso */}
                        {(p.coletado_em || p.entregue_em) && (
                          <div style={{ marginTop: 4 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                              Percurso
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                              {/* Pedido criado */}
                              <PercursoItem cor="#94a3b8" label="Pedido criado" hora={fmt(p.criado_em)} linha />
                              {/* Coletado na loja */}
                              {p.coletado_em && (
                                <PercursoItem cor="#f97316" label="Saiu para entrega" hora={fmt(p.coletado_em)} linha={!!p.entregue_em} />
                              )}
                              {/* Entregue */}
                              {p.entregue_em && (
                                <PercursoItem cor="#22c55e" label="Entregue ao cliente" hora={fmt(p.entregue_em)} linha={false} />
                              )}
                            </div>
                            {p.coletado_em && p.entregue_em && (
                              <div style={{ marginTop: 10, padding: "6px 12px", borderRadius: 8, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 11, color: "#64748b" }}>Tempo de entrega</span>
                                <span style={{ fontSize: 13, fontWeight: 900, color: "#22c55e" }}>{diffMin(p.coletado_em, p.entregue_em)} min</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        }
                </div>
              )
            })}
          </div>

          {/* ── Cancelados ─────────────────────────────────────────────── */}
          {cancelados.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: "#ef4444", marginBottom: 10 }}>
                ✕ Cancelados ({cancelados.length})
              </h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {cancelados.map(p => (
                  <div key={p.id} style={{
                    background: "white", borderRadius: 10,
                    border: "1px solid #fee2e2", borderLeft: "3px solid #ef4444",
                    padding: "10px 14px", minWidth: 200, maxWidth: 240,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>#{p.codigo}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>{fmt(p.criado_em)}</span>
                        {confirmDelete === p.id ? (
                          <div style={{ display: "flex", gap: 3 }}>
                            <button onClick={() => excluirPedido(p.id)} disabled={deletando}
                              style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5, border: "none", background: "#ef4444", color: "white", cursor: "pointer" }}>
                              {deletando ? "..." : "Confirmar"}
                            </button>
                            <button onClick={() => setConfirmDelete(null)}
                              style={{ fontSize: 10, padding: "2px 6px", borderRadius: 5, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer" }}>
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(p.id)} title="Excluir pedido"
                            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4, color: "#cbd5e1", lineHeight: 1 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{(p.loja as any)?.nome}</p>
                    {p.nome_cliente && <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0" }}>{p.nome_cliente}</p>}
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#ef4444", marginTop: 4 }}>R$ {p.total.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </>
      )}
    </div>
  )
}
