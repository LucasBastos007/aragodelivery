"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import type { EntregaAvulsa } from "@/types"

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  aguardando: { label: "Aguardando motoboy", color: "#d97706", bg: "#FFFBEB" },
  aceito:     { label: "Aceito",             color: "#2563eb", bg: "#EFF6FF" },
  em_rota:    { label: "Em rota",            color: "#7c3aed", bg: "#F5F3FF" },
  entregue:   { label: "Entregue",           color: "#059669", bg: "#ECFDF5" },
  cancelado:  { label: "Cancelado",          color: "#dc2626", bg: "#FEF2F2" },
}

const PLANOS_COM_AVULSA = ["select", "prime", "black"]

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: "#64748b", bg: "#F1F5F9" }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 50,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 700,
    }}>
      {cfg.label}
    </span>
  )
}

const campoStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1.5px solid #E2E8F0", fontSize: 13, fontWeight: 500,
  color: "#1E293B", background: "white", outline: "none",
  boxSizing: "border-box",
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#64748b",
  textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5,
}

export default function EntregaAvulsaPage() {
  const { sessao } = useAuth()
  const loja_id = sessao?.role === "lojista" ? (sessao as any).loja_id : null

  const [plano, setPlano]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [enviando, setEnviando]   = useState(false)
  const [entregas, setEntregas]   = useState<EntregaAvulsa[]>([])
  const [sucesso, setSucesso]     = useState(false)

  const [form, setForm] = useState({
    cliente_nome:  "",
    cliente_tel:   "",
    endereco:      "",
    valor_pedido:  "",
    taxa_entrega:  "",
    observacao:    "",
  })

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function carregar() {
    if (!loja_id) return
    const [{ data: lojaData }, { data: entregasData }] = await Promise.all([
      supabase.from("lojas").select("plano").eq("id", loja_id).single(),
      supabase.from("entregas_avulsas").select("*").eq("loja_id", loja_id).order("criado_em", { ascending: false }).limit(50),
    ])
    setPlano(lojaData?.plano ?? null)
    setEntregas(entregasData ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [loja_id])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!loja_id) return
    setEnviando(true)
    try {
      const res = await fetch("/api/entrega-avulsa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loja_id,
          cliente_nome:  form.cliente_nome,
          cliente_tel:   form.cliente_tel,
          endereco:      form.endereco,
          valor_pedido:  parseFloat(form.valor_pedido || "0"),
          taxa_entrega:  parseFloat(form.taxa_entrega || "0"),
          observacao:    form.observacao,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setForm({ cliente_nome: "", cliente_tel: "", endereco: "", valor_pedido: "", taxa_entrega: "", observacao: "" })
      setSucesso(true)
      setTimeout(() => setSucesso(false), 4000)
      await carregar()
    } catch (err: any) {
      alert("Erro: " + err.message)
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <p style={{ color: "#9CA3AF" }}>Carregando…</p>
      </div>
    )
  }

  if (!plano || !PLANOS_COM_AVULSA.includes(plano)) {
    return (
      <div style={{ padding: "40px 24px", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🛵</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", marginBottom: 8 }}>
          Entrega Avulsa
        </h2>
        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          A entrega avulsa permite acionar um motoboy para clientes que pediram pelo WhatsApp, sem precisar do app.
          Disponível nos planos <strong>Select, Prime e Black</strong>.
        </p>
        <div style={{
          background: "linear-gradient(135deg, #f97316, #dc2626)",
          borderRadius: 14, padding: "20px 24px", color: "white", textAlign: "left",
        }}>
          <p style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Faça upgrade do seu plano</p>
          <p style={{ fontSize: 12, opacity: 0.85 }}>Entre em contato com o suporte para assinar o plano Select (R$ 149/mês) e liberar este recurso.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: "24px 20px", maxWidth: 680, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Loja
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.3px" }}>
          Solicitar Motoboy
        </h1>
        <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 3 }}>
          Para pedidos recebidos fora do app (WhatsApp, telefone etc.)
        </p>
      </div>

      {/* Formulário */}
      <form onSubmit={enviar} style={{
        background: "white", borderRadius: 16, border: "1.5px solid #F1F5F9",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)", padding: "20px 20px", marginBottom: 24,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <p style={labelStyle}>Nome do cliente *</p>
            <input
              required value={form.cliente_nome}
              onChange={e => set("cliente_nome", e.target.value)}
              placeholder="Ex: João Silva"
              style={campoStyle}
            />
          </div>
          <div>
            <p style={labelStyle}>Telefone</p>
            <input
              value={form.cliente_tel}
              onChange={e => set("cliente_tel", e.target.value)}
              placeholder="(99) 99999-9999"
              style={campoStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <p style={labelStyle}>Endereço de entrega *</p>
          <input
            required value={form.endereco}
            onChange={e => set("endereco", e.target.value)}
            placeholder="Rua, número, bairro"
            style={campoStyle}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <p style={labelStyle}>Valor do pedido (R$)</p>
            <input
              type="number" min="0" step="0.01"
              value={form.valor_pedido}
              onChange={e => set("valor_pedido", e.target.value)}
              placeholder="0,00"
              style={campoStyle}
            />
          </div>
          <div>
            <p style={labelStyle}>Taxa de entrega (R$)</p>
            <input
              type="number" min="0" step="0.01"
              value={form.taxa_entrega}
              onChange={e => set("taxa_entrega", e.target.value)}
              placeholder="0,00"
              style={campoStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <p style={labelStyle}>Observação</p>
          <textarea
            value={form.observacao}
            onChange={e => set("observacao", e.target.value)}
            placeholder="Ponto de referência, instruções especiais…"
            rows={2}
            style={{ ...campoStyle, resize: "none", fontFamily: "inherit" }}
          />
        </div>

        <button type="submit" disabled={enviando} style={{
          width: "100%", padding: "13px", borderRadius: 12, border: "none",
          background: enviando ? "#e5e7eb" : "linear-gradient(135deg, #f97316, #dc2626)",
          color: enviando ? "#9ca3af" : "white",
          fontWeight: 800, fontSize: 14, cursor: enviando ? "not-allowed" : "pointer",
          boxShadow: enviando ? "none" : "0 4px 16px rgba(249,115,22,0.35)",
          transition: "all 0.2s",
        }}>
          {enviando ? "Solicitando…" : sucesso ? "✓ Motoboy solicitado!" : "🛵 Solicitar motoboy"}
        </button>
      </form>

      {/* Histórico de avulsas */}
      {entregas.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 12 }}>
            Histórico ({entregas.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entregas.map(e => (
              <div key={e.id} style={{
                background: "white", borderRadius: 12, border: "1.5px solid #F1F5F9",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "12px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#f97316" }}>#{e.codigo}</span>
                    <StatusBadge status={e.status} />
                  </div>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>
                    {new Date(e.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>{e.cliente_nome}</p>
                <p style={{ fontSize: 12, color: "#64748b" }}>{e.endereco}</p>
                {(e.valor_pedido > 0 || e.taxa_entrega > 0) && (
                  <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                    Pedido: R$ {e.valor_pedido.toFixed(2)}
                    {e.taxa_entrega > 0 && ` · Entrega: R$ ${e.taxa_entrega.toFixed(2)}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
