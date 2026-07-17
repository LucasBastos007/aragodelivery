"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Pedido, StatusPedido } from "@/types"

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

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [avulsas, setAvulsas] = useState<any[]>([])
  const [lojaFone, setLojaFone] = useState<Record<string, string>>({})
  const [loading, setLoading]  = useState(true)
  const [filtro, setFiltro]    = useState<Filtro>("todos")

  async function load() {
    const [{ data: pedData }, { data: avData }] = await Promise.all([
      supabase
        .from("pedidos")
        .select("*, loja:lojas(nome, telefone), motoboy:motoboys(nome)")
        .order("criado_em", { ascending: false })
        .limit(200),
      supabase
        .from("entregas_avulsas")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(200),
    ])
    setPedidos((pedData as Pedido[]) ?? [])

    const avList = avData ?? []
    setAvulsas(avList)

    // Busca telefones das lojas separadamente (sem depender de FK no Supabase)
    const lojaIds = [...new Set(avList.map((a: any) => a.loja_id).filter(Boolean))]
    if (lojaIds.length > 0) {
      const { data: lojasData } = await supabase
        .from("lojas").select("id, telefone").in("id", lojaIds)
      const fones: Record<string, string> = {}
      for (const l of lojasData ?? []) {
        if (l.telefone) fones[l.id] = l.telefone
      }
      setLojaFone(fones)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const iv = setInterval(load, 30_000)
    return () => clearInterval(iv)
  }, [])

  const hoje = new Date().toISOString().slice(0, 10)

  const pedidosFiltrados = filtro === "avulsas"
    ? []
    : filtro === "todos"
      ? pedidos
      : pedidos.filter(p => p.status === filtro)

  const avulsasFiltradas = filtro === "todos" || filtro === "avulsas" ? avulsas : []

  // Mistura e ordena por data desc quando filtro é "todos"
  type ItemLista =
    | { tipo: "pedido"; data: Pedido; criado_em: string }
    | { tipo: "avulsa"; data: any;    criado_em: string }

  const lista: ItemLista[] = filtro === "todos"
    ? [
        ...pedidosFiltrados.map(p => ({ tipo: "pedido" as const, data: p, criado_em: p.criado_em })),
        ...avulsasFiltradas.map(a => ({ tipo: "avulsa" as const, data: a, criado_em: a.criado_em })),
      ].sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    : filtro === "avulsas"
      ? avulsasFiltradas.map(a => ({ tipo: "avulsa" as const, data: a, criado_em: a.criado_em }))
      : pedidosFiltrados.map(p => ({ tipo: "pedido" as const, data: p, criado_em: p.criado_em }))

  const totalHoje = pedidos
    .filter(p => p.criado_em.slice(0, 10) === hoje && p.status === "entregue")
    .reduce((s, p) => s + p.total, 0)

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  const diffMin = (a: string, b: string) =>
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)

  const statusFiltros: Filtro[] = ["todos", "pendente", "aceito", "preparando", "pronto", "coletado", "entregue", "cancelado"]

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div style={{ minWidth: 0 }}>
          <h1 style={{ color: "#0F172A", fontSize: 22, fontWeight: 900 }}>Pedidos</h1>
          <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>
            Hoje: <span className="font-bold text-green-400">
              R$ {totalHoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </p>
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 sm:mb-6 flex-wrap">
        {statusFiltros.map(s => (
          <button key={s} onClick={() => setFiltro(s)}
            className="btn-ghost"
            style={{
              fontSize: 10, padding: "5px 9px",
              background: filtro === s ? "rgba(249,115,22,0.12)" : undefined,
              color:      filtro === s ? "#f97316" : undefined,
              border:     filtro === s ? "1px solid rgba(249,115,22,0.3)" : undefined,
            }}>
            {s === "todos" ? "Todos" : STATUS_LABEL[s as StatusPedido]}
            {s !== "todos" && (
              <span style={{ color: "#CBD5E1" }}>
                {" "}({pedidos.filter(p => p.status === s).length})
              </span>
            )}
          </button>
        ))}

        {/* Botão Avulsas */}
        <button onClick={() => setFiltro("avulsas")}
          className="btn-ghost"
          style={{
            fontSize: 10, padding: "5px 9px",
            background: filtro === "avulsas" ? "rgba(139,92,246,0.12)" : undefined,
            color:      filtro === "avulsas" ? "#8b5cf6" : undefined,
            border:     filtro === "avulsas" ? "1px solid rgba(139,92,246,0.3)" : undefined,
          }}>
          Avulsas
          <span style={{ color: "#CBD5E1" }}> ({avulsas.length})</span>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {loading ? (
          <p style={{ color: "#94a3b8", fontSize: 13 }}>Carregando...</p>
        ) : lista.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13 }}>Nenhum pedido encontrado.</p>
        ) : (
          lista.map(item => {
            if (item.tipo === "avulsa") {
              const a = item.data
              return (
                <div key={`avulsa-${a.id}`} className="card p-3 sm:p-4 flex items-start gap-3"
                  style={{ borderLeft: "3px solid #8b5cf6" }}>
                  <div className="flex-shrink-0 text-center" style={{ minWidth: 52 }}>
                    <p className="text-xs font-black">#{a.codigo}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#94a3b8" }}>{fmt(a.criado_em)}</p>
                    <span style={{
                      display: "inline-block", marginTop: 4,
                      fontSize: 8, fontWeight: 900, padding: "1px 5px", borderRadius: 4,
                      background: "rgba(139,92,246,0.1)", color: "#8b5cf6",
                      border: "1px solid rgba(139,92,246,0.25)", letterSpacing: 0.5,
                    }}>AVULSO</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`badge ${AVULSA_STATUS_BADGE[a.status] ?? "badge-yellow"}`}>
                        {AVULSA_STATUS_LABEL[a.status] ?? a.status}
                      </span>
                      <span className="text-xs truncate" style={{ color: "#64748b" }}>
                        {a.loja_nome ?? "—"}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "#94a3b8" }}>
                      {a.motoboy_nome ?? "Sem motoboy"}
                    </p>
                    <p className="text-xs truncate" style={{ color: "#94a3b8" }}>
                      {a.cliente_nome} · {a.endereco}
                    </p>

                    <ProgressoAvulsa status={a.status} />

                    <BotaoWhatsApp avulsa={a} fone={lojaFone[a.loja_id]} />
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-sm" style={{ color: "#0F172A" }}>
                      R$ {(a.taxa_entrega ?? 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#94a3b8" }}>Taxa</p>
                    {a.valor_pedido > 0 && (
                      <p className="text-[10px] mt-0.5" style={{ color: "#cbd5e1" }}>
                        Pedido R$ {(a.valor_pedido ?? 0).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              )
            }

            // Pedido regular
            const p = item.data
            return (
              <div key={`pedido-${p.id}`} className="card p-3 sm:p-4 flex items-start gap-3">
                <div className="flex-shrink-0 text-center" style={{ minWidth: 48 }}>
                  <p className="text-xs font-black">#{p.codigo}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#94a3b8" }}>
                    {fmt(p.criado_em)}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className={`badge ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                    <span className="text-xs truncate" style={{ color: "#64748b" }}>{(p.loja as any)?.nome ?? "—"}</span>
                  </div>
                  <p className="text-xs truncate" style={{ color: "#94a3b8" }}>
                    {(p.motoboy as any)?.nome ?? "Sem motoboy"}
                  </p>
                  <p className="text-xs truncate" style={{ color: "#94a3b8" }}>
                    {p.endereco_entrega}
                  </p>
                  {p.status === "entregue" && (p.coletado_em || p.entregue_em) && (
                    <div style={{
                      marginTop: 6, padding: "6px 10px", borderRadius: 8,
                      background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.15)",
                      display: "flex", flexWrap: "wrap", gap: "4px 14px",
                    }}>
                      {p.coletado_em && (
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          Coletou <strong style={{ color: "#0F172A" }}>{fmt(p.coletado_em)}</strong>
                        </span>
                      )}
                      {p.entregue_em && (
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          Entregou <strong style={{ color: "#0F172A" }}>{fmt(p.entregue_em)}</strong>
                        </span>
                      )}
                      {p.coletado_em && p.entregue_em && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>
                          {diffMin(p.coletado_em, p.entregue_em)} min
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-sm" style={{ color: "#0F172A" }}>
                    R$ {p.total.toFixed(2)}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#94a3b8" }}>
                    {PAGAMENTO_ICON[p.forma_pagamento]}
                  </p>
                  {p.status === "aguardando_pagamento" && p.forma_pagamento === "cartao" && (
                    <ConfirmarCartaoBtn pedidoId={p.id} onConfirmado={() => setPedidos(prev =>
                      prev.map(x => x.id === p.id ? { ...x, status: "pendente" as StatusPedido } : x)
                    )} />
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
