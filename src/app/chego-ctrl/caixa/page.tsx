"use client"

import { useEffect, useState } from "react"

type Declaracao = {
  id: string
  valor: number
  observacao: string | null
  criado_em: string
  motoboy: { id: string; nome: string } | null
}

const PERIODOS = [
  { dias: 1,   label: "Hoje" },
  { dias: 7,   label: "7 dias" },
  { dias: 30,  label: "30 dias" },
  { dias: 90,  label: "90 dias" },
]

export default function AdminCaixaPage() {
  const [declaracoes, setDeclaracoes] = useState<Declaracao[]>([])
  const [loading, setLoading]         = useState(true)
  const [dias, setDias]               = useState(7)

  useEffect(() => { carregar() }, [dias])

  async function carregar() {
    setLoading(true)
    const res = await fetch(`/api/admin/caixa?dias=${dias}`)
    const json = await res.json().catch(() => ({}))
    setDeclaracoes(json.declaracoes ?? [])
    setLoading(false)
  }

  const total = declaracoes.reduce((s, d) => s + d.valor, 0)

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", margin: 0 }}>Caixa dos motoboys</h1>
      <p style={{ color: "#64748B", fontSize: 14, marginTop: 6, marginBottom: 20 }}>
        Valores em dinheiro declarados pelos motoboys ao encerrar o dia
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {PERIODOS.map(p => (
          <button key={p.dias} onClick={() => setDias(p.dias)} style={{
            padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700,
            cursor: "pointer", border: "1px solid #E2E8F0",
            background: dias === p.dias ? "#0F172A" : "white",
            color: dias === p.dias ? "white" : "#475569",
          }}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ background: "white", borderRadius: 16, padding: "20px 24px", marginBottom: 20, border: "1px solid #E2E8F0" }}>
        <p style={{ color: "#64748B", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Total declarado no período
        </p>
        <p style={{ color: "#0F172A", fontWeight: 900, fontSize: 28, marginTop: 4 }}>
          R$ {total.toFixed(2)}
        </p>
      </div>

      {loading ? (
        <p style={{ color: "#94A3B8" }}>Carregando...</p>
      ) : declaracoes.length === 0 ? (
        <p style={{ color: "#94A3B8" }}>Nenhuma declaração no período</p>
      ) : (
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Motoboy", "Data", "Valor", "Observação"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 20px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {declaracoes.map(d => (
                <tr key={d.id} style={{ borderTop: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "12px 20px", fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                    {d.motoboy?.nome ?? "—"}
                  </td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: "#475569" }}>
                    {new Date(d.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    {" "}
                    {new Date(d.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ padding: "12px 20px", fontSize: 14, fontWeight: 800, color: "#16A34A" }}>
                    R$ {d.valor.toFixed(2)}
                  </td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: "#94A3B8" }}>
                    {d.observacao ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
