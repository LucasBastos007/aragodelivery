"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

type Tipo = "percentual" | "fixo"

interface Cupom {
  id: string; codigo: string; tipo: Tipo; valor: number
  pedido_minimo: number; validade: string | null; ativo: boolean; usos: number; criado_em: string
}

const inp: React.CSSProperties = {
  width: "100%", padding: "10px 13px", borderRadius: 10, fontSize: 14,
  background: "#F9FAFB", border: "1px solid #E5E7EB",
  color: "#111827", outline: "none", boxSizing: "border-box",
}

export default function LojaCuponsPage() {
  const { sessao } = useAuth()
  const loja_id = sessao?.role === "lojista" ? sessao.loja_id : null

  const [cupons,   setCupons]   = useState<Cupom[]>([])
  const [loading,  setLoading]  = useState(true)
  const [criando,  setCriando]  = useState(false)

  const [codigo,       setCodigo]       = useState("")
  const [tipo,         setTipo]         = useState<Tipo>("percentual")
  const [valor,        setValor]        = useState("")
  const [minimo,       setMinimo]       = useState("")
  const [validade,     setValidade]     = useState("")
  const [salvando,     setSalvando]     = useState(false)
  const [erro,         setErro]         = useState("")

  useEffect(() => { if (loja_id) carregar() }, [loja_id])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from("cupons").select("*").eq("loja_id", loja_id).order("criado_em", { ascending: false })
    setCupons((data as Cupom[]) ?? [])
    setLoading(false)
  }

  async function handleCriar() {
    if (!codigo.trim()) { setErro("Informe o código do cupom"); return }
    if (!valor || isNaN(Number(valor)) || Number(valor) <= 0) { setErro("Informe um valor válido"); return }
    setErro(""); setSalvando(true)
    const res = await fetch("/api/loja/cupons", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loja_id, codigo, tipo, valor: Number(valor), pedido_minimo: Number(minimo) || 0, validade: validade || null }),
    })
    const json = await res.json()
    if (!res.ok) { setErro(json.error?.includes("unique") ? "Esse código já existe." : json.error); setSalvando(false); return }
    setCodigo(""); setValor(""); setMinimo(""); setValidade(""); setTipo("percentual")
    setCriando(false); setSalvando(false); carregar()
  }

  async function toggleAtivo(c: Cupom) {
    await fetch("/api/loja/cupons", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, loja_id, ativo: !c.ativo }),
    })
    setCupons(prev => prev.map(x => x.id === c.id ? { ...x, ativo: !x.ativo } : x))
  }

  async function excluir(id: string) {
    if (!confirm("Excluir cupom?")) return
    await fetch("/api/loja/cupons", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, loja_id }),
    })
    setCupons(prev => prev.filter(x => x.id !== id))
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 780 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#111827", fontWeight: 900, fontSize: 22 }}>🎟️ Cupons</h1>
          <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 3 }}>Desconto exclusivo para sua loja</p>
        </div>
        <button
          onClick={() => { setCriando(c => !c); setErro("") }}
          style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: "#f97316", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {criando ? "Cancelar" : "+ Novo cupom"}
        </button>
      </div>

      {/* Formulário de criação */}
      {criando && (
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid rgba(249,115,22,0.2)", padding: "20px 22px", marginBottom: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>Novo cupom</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>Código *</label>
              <input style={inp} value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="PROMO10" />
            </div>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>Tipo</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["percentual", "fixo"] as Tipo[]).map(t => (
                  <button key={t} onClick={() => setTipo(t)} style={{
                    flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
                    background: tipo === t ? "rgba(249,115,22,0.12)" : "#F3F4F6",
                    color: tipo === t ? "#f97316" : "#6B7280",
                    outline: tipo === t ? "1px solid rgba(249,115,22,0.4)" : "none",
                  }}>
                    {t === "percentual" ? "% Percentual" : "R$ Fixo"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>
                {tipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"} *
              </label>
              <input style={inp} type="number" min="0" value={valor} onChange={e => setValor(e.target.value)} placeholder={tipo === "percentual" ? "10" : "5.00"} />
            </div>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>Pedido mínimo (R$)</label>
              <input style={inp} type="number" min="0" value={minimo} onChange={e => setMinimo(e.target.value)} placeholder="0 = sem mínimo" />
            </div>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>Válido até</label>
              <input style={inp} type="date" value={validade} onChange={e => setValidade(e.target.value)} />
            </div>
          </div>
          {erro && <p style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>{erro}</p>}
          <button onClick={handleCriar} disabled={salvando} style={{
            padding: "12px 24px", borderRadius: 12, border: "none", background: salvando ? "rgba(249,115,22,0.4)" : "#f97316",
            color: "white", fontWeight: 800, fontSize: 14, cursor: salvando ? "not-allowed" : "pointer", alignSelf: "flex-start",
          }}>
            {salvando ? "Criando..." : "✓ Criar cupom"}
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p style={{ color: "#9CA3AF" }}>Carregando...</p>
      ) : cupons.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 48 }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>🎟️</p>
          <p style={{ color: "#6B7280", fontWeight: 600 }}>Nenhum cupom criado</p>
          <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>Crie cupons de desconto para atrair clientes</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cupons.map(c => (
            <div key={c.id} style={{
              background: "#ffffff", borderRadius: 14, padding: "16px 18px",
              border: `1px solid ${c.ativo ? "#e5e7eb" : "#F3F4F6"}`,
              opacity: c.ativo ? 1 : 0.5,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <p style={{ color: "#f97316", fontWeight: 900, fontSize: 16, fontFamily: "monospace", letterSpacing: 1 }}>{c.codigo}</p>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                    background: c.ativo ? "rgba(34,197,94,0.12)" : "#F3F4F6",
                    color: c.ativo ? "#22c55e" : "#9CA3AF",
                  }}>
                    {c.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6B7280", flexWrap: "wrap" }}>
                  <span>
                    {c.tipo === "percentual" ? `${c.valor}% de desconto` : `R$ ${Number(c.valor).toFixed(2)} de desconto`}
                  </span>
                  {c.pedido_minimo > 0 && <span>· Mín. R$ {Number(c.pedido_minimo).toFixed(2)}</span>}
                  {c.validade && <span>· Válido até {new Date(c.validade + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
                  <span>· {c.usos} uso{c.usos !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => toggleAtivo(c)} style={{
                  padding: "7px 14px", borderRadius: 10, border: "1px solid #E5E7EB",
                  background: "transparent", color: "#6B7280", fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>
                  {c.ativo ? "Desativar" : "Ativar"}
                </button>
                <button onClick={() => excluir(c.id)} style={{
                  padding: "7px 12px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)",
                  background: "rgba(239,68,68,0.06)", color: "#f87171", fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
