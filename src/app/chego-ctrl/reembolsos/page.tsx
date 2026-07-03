"use client"

import { useEffect, useState } from "react"

type Reembolso = {
  id: string
  pedido_id: string
  solicitado_em: string
  solicitado_por: string
  motivo: string
  descricao: string
  foto_url: string
  status: string
  aprovado_por: string | null
  aprovado_em: string | null
  valor_solicitado: number | null
  valor_aprovado: number | null
  asaas_refund_id: string | null
  negado_motivo: string | null
  pedido: {
    id: string
    codigo: string
    total: number
    nome_cliente: string | null
    forma_pagamento: string
    loja?: { nome: string }
  }
}

const STATUS_LABEL: Record<string, string> = {
  solicitado:  "Aguardando",
  aprovado:    "Aprovado",
  processando: "Processando",
  concluido:   "Concluído",
  negado:      "Negado",
}
const STATUS_COLOR: Record<string, string> = {
  solicitado:  "#f59e0b",
  aprovado:    "#3b82f6",
  processando: "#8b5cf6",
  concluido:   "#22c55e",
  negado:      "#ef4444",
}
const MOTIVO_LABEL: Record<string, string> = {
  nao_recebeu:    "Não recebeu o pedido",
  pedido_errado:  "Pedido errado",
  qualidade:      "Problema de qualidade",
  duplicado:      "Cobrança duplicada",
  cancelamento:   "Cancelamento",
  outro:          "Outro",
}

export default function ReembolsosPage() {
  const [reembolsos, setReembolsos] = useState<Reembolso[]>([])
  const [loading, setLoading]       = useState(true)
  const [filtroStatus, setFiltro]   = useState("todos")
  const [selecionado, setSelecionado] = useState<Reembolso | null>(null)
  const [processando, setProcessando] = useState(false)
  const [valorInput, setValorInput] = useState("")
  const [motivoNegar, setMotivoNegar] = useState("")
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    const params = filtroStatus !== "todos" ? `?status=${filtroStatus}` : ""
    const res = await fetch(`/api/reembolso/listar${params}`)
    const json = await res.json().catch(() => ({}))
    setReembolsos(json.reembolsos ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filtroStatus])

  async function processar(acao: "aprovar" | "negar") {
    if (!selecionado) return
    setProcessando(true)

    const body: Record<string, unknown> = { reembolso_id: selecionado.id, acao }
    if (acao === "aprovar" && valorInput.trim()) {
      body.valor_aprovado = parseFloat(valorInput.replace(",", "."))
    }
    if (acao === "negar") {
      body.negado_motivo = motivoNegar.trim() || "Solicitação negada"
    }

    const res = await fetch("/api/reembolso/processar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    setProcessando(false)

    if (!res.ok || json.error) {
      showToast(json.error ?? "Erro ao processar", false)
      return
    }

    showToast(acao === "aprovar" ? "Reembolso aprovado! Estorno iniciado." : "Solicitação negada.")
    setSelecionado(null)
    setValorInput("")
    setMotivoNegar("")
    load()
  }

  const filtrados = filtroStatus === "todos" ? reembolsos : reembolsos.filter(r => r.status === filtroStatus)
  const pendentes = reembolsos.filter(r => r.status === "solicitado").length

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: toast.ok ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${toast.ok ? "#bbf7d0" : "#fecaca"}`,
          color: toast.ok ? "#15803d" : "#dc2626",
          padding: "12px 20px", borderRadius: 12, fontWeight: 700, fontSize: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", margin: 0 }}>
            Reembolsos
            {pendentes > 0 && (
              <span style={{ marginLeft: 10, background: "#fef3c7", color: "#d97706", border: "1px solid #fcd34d", fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 999, verticalAlign: "middle" }}>
                {pendentes} pendente{pendentes > 1 ? "s" : ""}
              </span>
            )}
          </h1>
          <p style={{ color: "#64748B", fontSize: 13, marginTop: 4 }}>Gerenciar solicitações de reembolso</p>
        </div>
        <button onClick={load} style={{ padding: "8px 16px", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "white", color: "#475569", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {["todos", "solicitado", "aprovado", "processando", "concluido", "negado"].map(s => (
          <button key={s} onClick={() => setFiltro(s)} style={{
            padding: "6px 16px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
            border: `1.5px solid ${filtroStatus === s ? STATUS_COLOR[s] ?? "#475569" : "#E2E8F0"}`,
            background: filtroStatus === s ? `${STATUS_COLOR[s] ?? "#475569"}15` : "white",
            color: filtroStatus === s ? STATUS_COLOR[s] ?? "#475569" : "#64748B",
            transition: "all 0.15s",
          }}>
            {s === "todos" ? "Todos" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <p style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>Nenhuma solicitação encontrada</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtrados.map(r => (
            <div key={r.id} style={{
              background: "white", borderRadius: 16, padding: "20px 24px",
              border: "1.5px solid #E2E8F0",
              boxShadow: r.status === "solicitado" ? "0 0 0 2px #fcd34d40" : "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{
                      padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                      background: `${STATUS_COLOR[r.status]}15`,
                      color: STATUS_COLOR[r.status],
                      border: `1px solid ${STATUS_COLOR[r.status]}30`,
                    }}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>
                      #{r.pedido?.codigo} · {r.pedido?.loja?.nome ?? "—"}
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>
                      {new Date(r.solicitado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Cliente</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{r.pedido?.nome_cliente ?? "—"}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Motivo</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{MOTIVO_LABEL[r.motivo] ?? r.motivo}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Valor pedido</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
                        R$ {Number(r.pedido?.total ?? 0).toFixed(2)}
                        {r.valor_solicitado != null && (
                          <span style={{ color: "#f59e0b", marginLeft: 4 }}>
                            (solicitado: R$ {Number(r.valor_solicitado).toFixed(2)})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {r.descricao && (
                    <p style={{ fontSize: 12, color: "#64748B", marginTop: 8, fontStyle: "italic" }}>
                      "{r.descricao}"
                    </p>
                  )}

                  {r.negado_motivo && (
                    <p style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>
                      Motivo da negação: {r.negado_motivo}
                    </p>
                  )}

                  {r.valor_aprovado != null && (
                    <p style={{ fontSize: 12, color: "#22c55e", marginTop: 4, fontWeight: 700 }}>
                      Valor aprovado: R$ {Number(r.valor_aprovado).toFixed(2)} · por {r.aprovado_por}
                    </p>
                  )}

                  {r.foto_url && (
                    <a href={r.foto_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#3b82f6", marginTop: 6, display: "inline-block" }}>
                      Ver foto anexada
                    </a>
                  )}
                </div>

                {r.status === "solicitado" && (
                  <button
                    onClick={() => { setSelecionado(r); setValorInput(String(r.pedido?.total ?? "")); setMotivoNegar("") }}
                    style={{
                      padding: "8px 18px", borderRadius: 10, border: "none",
                      background: "#f59e0b", color: "white", fontSize: 13, fontWeight: 800,
                      cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                    }}
                  >
                    Analisar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de análise */}
      {selecionado && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }} onClick={e => { if (e.target === e.currentTarget) setSelecionado(null) }}>
          <div style={{
            background: "white", borderRadius: 20, padding: "32px",
            width: "100%", maxWidth: 500,
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", margin: "0 0 4px" }}>
              Analisar Reembolso
            </h2>
            <p style={{ color: "#64748B", fontSize: 13, marginBottom: 24 }}>
              Pedido #{selecionado.pedido?.codigo} · {selecionado.pedido?.nome_cliente ?? "Cliente"}
            </p>

            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>Motivo da solicitação</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>
                {MOTIVO_LABEL[selecionado.motivo] ?? selecionado.motivo}
              </p>
              {selecionado.descricao && (
                <p style={{ fontSize: 12, color: "#475569", marginTop: 6, fontStyle: "italic" }}>
                  "{selecionado.descricao}"
                </p>
              )}
              <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
                Valor total do pedido: <strong>R$ {Number(selecionado.pedido?.total ?? 0).toFixed(2)}</strong>
              </p>
            </div>

            {/* Valor a reembolsar */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
                Valor a reembolsar (R$) — deixe em branco para valor total
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={selecionado.pedido?.total}
                value={valorInput}
                onChange={e => setValorInput(e.target.value)}
                placeholder={`Máx. ${Number(selecionado.pedido?.total ?? 0).toFixed(2)}`}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  border: "1.5px solid #E2E8F0", fontSize: 14,
                  outline: "none", boxSizing: "border-box" as const,
                }}
              />
            </div>

            {/* Motivo para negar */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
                Motivo (preenchido apenas ao negar)
              </label>
              <input
                type="text"
                value={motivoNegar}
                onChange={e => setMotivoNegar(e.target.value)}
                placeholder="Ex: Fora do prazo, pedido entregue corretamente..."
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  border: "1.5px solid #E2E8F0", fontSize: 14,
                  outline: "none", boxSizing: "border-box" as const,
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => processar("negar")}
                disabled={processando}
                style={{
                  flex: 1, padding: "12px", borderRadius: 12, border: "none",
                  background: "#fef2f2", color: "#dc2626", fontSize: 14, fontWeight: 800,
                  cursor: processando ? "not-allowed" : "pointer", opacity: processando ? 0.6 : 1,
                }}
              >
                Negar
              </button>
              <button
                onClick={() => processar("aprovar")}
                disabled={processando}
                style={{
                  flex: 2, padding: "12px", borderRadius: 12, border: "none",
                  background: "#22c55e", color: "white", fontSize: 14, fontWeight: 800,
                  cursor: processando ? "not-allowed" : "pointer", opacity: processando ? 0.6 : 1,
                }}
              >
                {processando ? "Processando..." : "Aprovar e Estornar"}
              </button>
            </div>

            <button
              onClick={() => setSelecionado(null)}
              style={{
                width: "100%", marginTop: 12, padding: "10px", borderRadius: 10,
                border: "none", background: "transparent", color: "#94a3b8", fontSize: 13,
                cursor: "pointer", fontWeight: 600,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
