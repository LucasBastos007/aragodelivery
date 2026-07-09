"use client"

import { useEffect, useState, useCallback } from "react"

const PLANO_VALOR: Record<string, number> = { select: 149, prime: 497, black: 997 }
const PLANO_LABEL: Record<string, string>  = { select: "Select", prime: "Prime", black: "Black" }
const PLANO_COR:   Record<string, string>  = { select: "#2563eb", prime: "#7c3aed", black: "#111827" }

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pago:      { label: "Em dia",    color: "#059669", bg: "#F0FDF4", border: "#A7F3D0" },
  pendente:  { label: "Pendente",  color: "#d97706", bg: "#FFFBEB", border: "#FDE68A" },
  atrasado:  { label: "Atrasado",  color: "#dc2626", bg: "#FEF2F2", border: "#FECACA" },
  bloqueado: { label: "Bloqueado", color: "#7c3aed", bg: "#F5F3FF", border: "#DDD6FE" },
}

type Loja = {
  id: string; nome: string; plano: string; mensalidade_dia: number
  status: string; logo_url?: string; mensalidade_paga_em?: string
}
type Mensalidade = {
  id: string; loja_id: string; valor: number; mes_referencia: string
  vencimento: string; pago_em?: string; confirmado_por?: string; status: string
}

function fmtR(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function fmtData(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR")
}
function diasAtraso(vencimento: string): number {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const venc = new Date(vencimento + "T00:00:00")
  return Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / 86_400_000))
}

export default function MensalidadesPage() {
  const [lojas,  setLojas]  = useState<Loja[]>([])
  const [mens,   setMens]   = useState<Mensalidade[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [editandoDia, setEditandoDia] = useState<string | null>(null)
  const [novoDia, setNovoDia]         = useState("")
  const [salvandoDia, setSalvandoDia] = useState(false)
  const [filtro, setFiltro] = useState<"todos" | "pendente" | "atrasado" | "bloqueado" | "pago">("todos")

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch("/api/chego-ctrl/mensalidade", { credentials: "include" })
    const d = await r.json()
    setLojas(d.lojas ?? [])
    setMens(d.mensalidades ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Merge: loja + mensalidade do mês atual
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`

  type LojaRow = {
    loja: Loja
    mens: Mensalidade | null
    statusEfetivo: string
    atraso: number
  }

  const rows: LojaRow[] = lojas.map(l => {
    const m = mens.find(m => m.loja_id === l.id && m.mes_referencia === mesAtual) ?? null
    const atraso = m ? diasAtraso(m.vencimento) : 0
    const statusEfetivo = m?.status ?? "pendente"
    return { loja: l, mens: m, statusEfetivo, atraso }
  }).sort((a, b) => {
    const ord = { bloqueado: 0, atrasado: 1, pendente: 2, pago: 3 }
    return (ord[a.statusEfetivo as keyof typeof ord] ?? 2) - (ord[b.statusEfetivo as keyof typeof ord] ?? 2)
  })

  const filtradas = filtro === "todos" ? rows : rows.filter(r => r.statusEfetivo === filtro)

  const totais = {
    emDia:    rows.filter(r => r.statusEfetivo === "pago").length,
    pendente: rows.filter(r => r.statusEfetivo === "pendente").length,
    atrasado: rows.filter(r => r.statusEfetivo === "atrasado").length,
    bloqueado: rows.filter(r => r.statusEfetivo === "bloqueado").length,
    aReceber: rows.filter(r => r.statusEfetivo !== "pago").reduce((s, r) => s + (PLANO_VALOR[r.loja.plano] ?? 0), 0),
    recebido:  rows.filter(r => r.statusEfetivo === "pago").reduce((s, r) => s + (PLANO_VALOR[r.loja.plano] ?? 0), 0),
  }

  async function confirmarPagamento(mensalidadeId: string) {
    setConfirmando(mensalidadeId)
    await fetch("/api/chego-ctrl/mensalidade", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "confirmar_pagamento", mensalidade_id: mensalidadeId }),
    })
    await load()
    setConfirmando(null)
  }

  async function salvarDia(lojaId: string) {
    setSalvandoDia(true)
    await fetch("/api/chego-ctrl/mensalidade", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "atualizar_dia", loja_id: lojaId, dia: Number(novoDia) }),
    })
    await load()
    setEditandoDia(null)
    setNovoDia("")
    setSalvandoDia(false)
  }

  const inp: React.CSSProperties = {
    padding: "6px 10px", borderRadius: 8, border: "1.5px solid #E2E8F0",
    fontSize: 13, fontWeight: 600, color: "#374151", outline: "none",
  }

  return (
    <div style={{ padding: "32px 36px", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Financeiro
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.5px" }}>Mensalidades</h1>
        <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 3 }}>
          {mesAtual.split("-").reverse().join("/")} · vencimento padrão todo dia <strong style={{ color: "#0F172A" }}>10</strong> · bloqueio automático após <strong style={{ color: "#0F172A" }}>4 dias</strong> de atraso
        </p>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Em dia",      value: totais.emDia,    color: "#059669", bg: "#F0FDF4" },
          { label: "Pendentes",   value: totais.pendente, color: "#d97706", bg: "#FFFBEB" },
          { label: "Atrasados",   value: totais.atrasado, color: "#dc2626", bg: "#FEF2F2" },
          { label: "Bloqueados",  value: totais.bloqueado,color: "#7c3aed", bg: "#F5F3FF" },
          { label: "Recebido",    value: fmtR(totais.recebido),  color: "#059669", bg: "#F0FDF4" },
          { label: "A receber",   value: fmtR(totais.aReceber),  color: "#d97706", bg: "#FFFBEB" },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 14, padding: "16px", border: `1.5px solid ${c.color}22` }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>{c.label}</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {(["todos", "pendente", "atrasado", "bloqueado", "pago"] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: "6px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer",
            border: `1.5px solid ${filtro === f ? "#8b5cf6" : "#E2E8F0"}`,
            background: filtro === f ? "#F5F3FF" : "white",
            color: filtro === f ? "#7c3aed" : "#64748b",
          }}>
            {f === "todos" ? "Todas" : STATUS_CFG[f]?.label ?? f}
            {f !== "todos" && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>
                ({rows.filter(r => r.statusEfetivo === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
          <div style={{ width: 32, height: 32, border: "3px solid #8b5cf6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ fontSize: 13 }}>Carregando…</p>
        </div>
      ) : (
        <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #F1F5F9", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          {/* Header tabela */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 120px 110px 120px 110px 1fr", gap: 0, padding: "10px 20px", background: "#F8FAFC", borderBottom: "1.5px solid #F1F5F9" }}>
            {["Loja", "Plano", "Vencimento", "Status", "Dias atraso", "Ações"].map((h, i) => (
              <p key={h} style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8, textAlign: i >= 5 ? "right" : "left" }}>{h}</p>
            ))}
          </div>

          {filtradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>✓</p>
              <p style={{ fontSize: 14, fontWeight: 700 }}>Nenhuma loja neste filtro</p>
            </div>
          ) : filtradas.map((row, idx) => {
            const { loja, mens: m, statusEfetivo, atraso } = row
            const cfg = STATUS_CFG[statusEfetivo] ?? STATUS_CFG.pendente
            const editando = editandoDia === loja.id

            return (
              <div key={loja.id} style={{ borderBottom: idx < filtradas.length - 1 ? "1px solid #F8FAFC" : "none" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 120px 110px 120px 110px 1fr", gap: 0, padding: "14px 20px", alignItems: "center" }}>

                  {/* Loja */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {loja.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={loja.logo_url} alt={loja.nome} style={{ width: 32, height: 32, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#64748b", flexShrink: 0 }}>
                        {loja.nome.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{loja.nome}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <p style={{ fontSize: 10, color: "#94a3b8" }}>Dia {loja.mensalidade_dia ?? 10}</p>
                        {!editando ? (
                          <button onClick={() => { setEditandoDia(loja.id); setNovoDia(String(loja.mensalidade_dia ?? 10)) }}
                            style={{ fontSize: 10, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 700 }}>
                            alterar
                          </button>
                        ) : (
                          <div style={{ display: "flex", gap: 4 }}>
                            <input type="number" min={1} max={28} value={novoDia} onChange={e => setNovoDia(e.target.value)}
                              style={{ ...inp, width: 52, fontSize: 11, padding: "3px 6px" }} />
                            <button onClick={() => salvarDia(loja.id)} disabled={salvandoDia}
                              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "none", background: "#6366f1", color: "white", fontWeight: 700, cursor: "pointer" }}>
                              {salvandoDia ? "…" : "OK"}
                            </button>
                            <button onClick={() => setEditandoDia(null)}
                              style={{ fontSize: 10, padding: "3px 6px", borderRadius: 6, border: "1px solid #E2E8F0", background: "white", color: "#94a3b8", cursor: "pointer" }}>
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Plano */}
                  <div>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 10px", borderRadius: 50, fontSize: 11, fontWeight: 800,
                      background: `${PLANO_COR[loja.plano]}15`, color: PLANO_COR[loja.plano],
                      border: `1px solid ${PLANO_COR[loja.plano]}30`,
                    }}>
                      {PLANO_LABEL[loja.plano]}
                    </span>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginTop: 3 }}>{fmtR(PLANO_VALOR[loja.plano] ?? 0)}</p>
                  </div>

                  {/* Vencimento */}
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                    {m ? fmtData(m.vencimento) : `dia ${loja.mensalidade_dia ?? 10}`}
                  </p>

                  {/* Status */}
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "4px 10px", borderRadius: 50, fontSize: 11, fontWeight: 700,
                    background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color }} />
                    {cfg.label}
                  </span>

                  {/* Dias atraso */}
                  <p style={{
                    fontSize: 13, fontWeight: 800,
                    color: atraso >= 4 ? "#dc2626" : atraso > 0 ? "#d97706" : "#94a3b8",
                  }}>
                    {statusEfetivo === "pago" ? "—" : atraso > 0 ? `${atraso}d` : "—"}
                  </p>

                  {/* Ações */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                    {m && statusEfetivo !== "pago" && (
                      <button
                        onClick={() => confirmarPagamento(m.id)}
                        disabled={confirmando === m.id}
                        style={{
                          padding: "6px 12px", borderRadius: 9, border: "none",
                          background: confirmando === m.id ? "#e5e7eb" : "#059669",
                          color: confirmando === m.id ? "#9ca3af" : "white",
                          fontSize: 12, fontWeight: 700,
                          cursor: confirmando === m.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {confirmando === m.id ? "…" : "✓ Confirmar pgt."}
                      </button>
                    )}
                    {statusEfetivo === "pago" && m?.pago_em && (
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>Pago em {new Date(m.pago_em).toLocaleDateString("pt-BR")}</p>
                        {m.confirmado_por && <p style={{ fontSize: 10, color: "#94a3b8" }}>por {m.confirmado_por}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Nota */}
      <div style={{ marginTop: 20, padding: "12px 16px", background: "white", borderRadius: 12, border: "1.5px solid #F1F5F9", fontSize: 11, color: "#94a3b8" }}>
        · Plano <strong style={{ color: "#374151" }}>Gold</strong> não gera mensalidade (cobrado por comissão sobre pedidos).<br />
        · Lojas bloqueadas não conseguem acessar o painel de lojista até o pagamento ser confirmado.<br />
        · O bloqueio automático ocorre <strong style={{ color: "#374151" }}>4 dias</strong> após o vencimento via cron diário.
      </div>
    </div>
  )
}
