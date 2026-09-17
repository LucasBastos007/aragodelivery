"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth"

type Declaracao = { id: string; valor: number; observacao: string | null; criado_em: string }

export default function MotoboyCaixaPage() {
  const { sessao } = useAuth()
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null

  const [valor,        setValor]        = useState("")
  const [observacao,   setObservacao]   = useState("")
  const [enviando,     setEnviando]     = useState(false)
  const [erro,         setErro]         = useState("")
  const [sucesso,      setSucesso]      = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [declaracoes,  setDeclaracoes]  = useState<Declaracao[]>([])

  useEffect(() => { if (motoboy_id) carregar() }, [motoboy_id])

  async function carregar() {
    setLoading(true)
    const res = await fetch("/api/motoboy/caixa", { credentials: "include" })
    const json = await res.json().catch(() => ({}))
    setDeclaracoes(json.declaracoes ?? [])
    setLoading(false)
  }

  async function enviar() {
    const v = Number(valor.replace(",", "."))
    if (!Number.isFinite(v) || v < 0) { setErro("Informe um valor válido"); return }
    setEnviando(true)
    setErro("")
    const res = await fetch("/api/motoboy/caixa", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor: v, observacao }),
    })
    const json = await res.json().catch(() => ({}))
    setEnviando(false)
    if (!res.ok) { setErro(json.error ?? "Erro ao enviar"); return }
    setValor("")
    setObservacao("")
    setSucesso(true)
    setTimeout(() => setSucesso(false), 2500)
    carregar()
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 12, fontSize: 14,
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    color: "white", outline: "none", boxSizing: "border-box",
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 20px 100px" }}>
      <p style={{ color: "white", fontWeight: 900, fontSize: 20, marginBottom: 4 }}>Caixa do dia</p>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginBottom: 28 }}>
        Informe quanto dinheiro você tem em mãos ao parar de entregar hoje
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
            Valor em dinheiro (R$)
          </label>
          <input
            value={valor}
            onChange={e => setValor(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            style={inp}
          />
        </div>
        <div>
          <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
            Observação (opcional)
          </label>
          <input
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            placeholder="Ex: sobrou troco de..."
            style={inp}
          />
        </div>
      </div>

      <button onClick={enviar} disabled={enviando} style={{
        width: "100%", marginTop: 20, padding: "16px",
        borderRadius: 14, border: "none",
        background: enviando ? "rgba(249,115,22,0.4)" : "#f97316",
        color: "white", fontWeight: 900, fontSize: 15, cursor: enviando ? "not-allowed" : "pointer",
      }}>
        {enviando ? "Enviando..." : "Declarar caixa"}
      </button>

      {erro && (
        <p style={{ color: "#f87171", fontSize: 13, fontWeight: 600, marginTop: 12, textAlign: "center" }}>{erro}</p>
      )}

      {sucesso && (
        <div style={{
          position: "fixed", bottom: 90, left: 16, right: 16,
          background: "#22c55e", color: "white", fontWeight: 700, fontSize: 13,
          padding: "12px 20px", borderRadius: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          textAlign: "center",
        }}>
          Caixa declarado com sucesso
        </div>
      )}

      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 36, marginBottom: 12 }}>
        Declarações anteriores
      </p>

      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando...</p>
      ) : declaracoes.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 13 }}>Nenhuma declaração ainda</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {declaracoes.map(d => (
            <div key={d.id} style={{
              background: "#111", borderRadius: 14, padding: "12px 16px",
              border: "1px solid rgba(255,255,255,0.07)",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
            }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
                  {new Date(d.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                  {" · "}
                  {new Date(d.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                {d.observacao && (
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.observacao}
                  </p>
                )}
              </div>
              <p style={{ color: "#22c55e", fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
                R$ {d.valor.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
