"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

// Segunda a domingo da semana com o deslocamento `offset` (0 = semana atual, -1 = anterior...).
function limitesSemana(offset: number): { inicio: Date; fim: Date } {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const diaSemana = (hoje.getDay() + 6) % 7 // 0 = segunda
  const segundaAtual = new Date(hoje)
  segundaAtual.setDate(hoje.getDate() - diaSemana + offset * 7)
  const domingo = new Date(segundaAtual)
  domingo.setDate(segundaAtual.getDate() + 6)
  domingo.setHours(23, 59, 59, 999)
  return { inicio: segundaAtual, fim: domingo }
}

function fmtRotulo(inicio: Date, fim: Date): string {
  const f = (d: Date) => `${d.getDate()} ${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}`
  return `${f(inicio)} - ${f(fim)}`
}

function fmtMoeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function RelatorioPage() {
  const { sessao } = useAuth()
  const loja_id = sessao?.role === "lojista" ? sessao.loja_id : null

  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [porDia, setPorDia] = useState<number[]>(Array(7).fill(0))
  const [quantidade, setQuantidade] = useState(0)
  const [totalBruto, setTotalBruto] = useState(0)
  const [comissaoPct, setComissaoPct] = useState(0)
  const [comissaoValor, setComissaoValor] = useState(0)

  const { inicio, fim } = limitesSemana(offset)

  useEffect(() => {
    if (!loja_id) return
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loja_id, offset])

  async function carregar() {
    setLoading(true)

    const { data: lojaData } = await supabase.from("lojas").select("comissao").eq("id", loja_id).single()
    const pct = lojaData?.comissao ?? 0
    setComissaoPct(pct)

    const { data: ped } = await supabase
      .from("pedidos")
      .select("subtotal, criado_em")
      .eq("loja_id", loja_id)
      .eq("status", "entregue")
      .gte("criado_em", inicio.toISOString())
      .lte("criado_em", fim.toISOString())

    const lista = ped ?? []
    const dias = Array(7).fill(0)
    let bruto = 0
    for (const p of lista) {
      const d = new Date(p.criado_em)
      const idx = (d.getDay() + 6) % 7
      dias[idx] += p.subtotal ?? 0
      bruto += p.subtotal ?? 0
    }

    setPorDia(dias)
    setQuantidade(lista.length)
    setTotalBruto(bruto)
    setComissaoValor(bruto * pct / 100)
    setLoading(false)
  }

  const totalLiquido = totalBruto - comissaoValor
  const maxDia = Math.max(1, ...porDia)
  const podeAvancar = offset < 0

  return (
    <div style={{ padding: "24px 16px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #f97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(249,115,22,0.35)", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <rect x="7" y="13" width="3" height="5" rx="0.5" fill="white" stroke="none" />
              <rect x="11" y="14.5" width="3" height="3.5" rx="0.5" fill="white" stroke="none" />
              <rect x="15" y="12" width="3" height="6" rx="0.5" fill="white" stroke="none" />
            </svg>
          </div>
          <h1 style={{ color: "#111827", fontWeight: 900, fontSize: 20 }}>Relatório</h1>
        </div>
        <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>Somente pedidos entregues</p>
      </div>

      {/* Navegação de semana */}
      <div className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, background: "#dc2626" }}>
        <button onClick={() => setOffset(o => o - 1)} aria-label="Semana anterior" style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "white" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <p style={{ color: "white", fontWeight: 800, fontSize: 14 }}>{fmtRotulo(inicio, fim)}</p>
        <button onClick={() => podeAvancar && setOffset(o => o + 1)} aria-label="Próxima semana" disabled={!podeAvancar} style={{ background: "none", border: "none", cursor: podeAvancar ? "pointer" : "default", padding: 6, color: podeAvancar ? "white" : "rgba(255,255,255,0.35)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#9CA3AF" }}>Carregando dados...</p>
      ) : (
        <>
          {/* Gráfico de barras semanal */}
          <div className="card" style={{ padding: "20px 18px", marginBottom: 16 }}>
            <p style={{ color: "#111827", fontWeight: 900, fontSize: 14, marginBottom: 22, textAlign: "center" }}>Vendas semanais</p>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, height: 160 }}>
              {porDia.map((v, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", flex: 1, height: "100%" }}>
                  <span style={{ color: "#dc2626", fontSize: 10.5, fontWeight: 800, marginBottom: 6, whiteSpace: "nowrap" }}>
                    {v > 0 ? `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : ""}
                  </span>
                  <div style={{
                    width: "70%", maxWidth: 32, borderRadius: "6px 6px 2px 2px",
                    background: v > 0 ? "linear-gradient(180deg, #fca5a5, #f87171)" : "#F3F4F6",
                    height: `${Math.max(v > 0 ? 4 : 2, (v / maxDia) * 110)}px`,
                    transition: "height 0.4s",
                  }} />
                  <span style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 700, marginTop: 8 }}>{DIAS[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo */}
          <div className="card" style={{ padding: "4px 18px" }}>
            <LinhaResumo label="Quantidade de Vendas" valor={String(quantidade)} />
            <LinhaResumo label="Total Bruto Vendido" valor={`+${fmtMoeda(totalBruto)}`} cor="#16a34a" />
            <LinhaResumo label={`Comissão Chegô (${comissaoPct.toLocaleString("pt-BR")}%)`} valor={`-${fmtMoeda(comissaoValor)}`} cor="#dc2626" />
            <LinhaResumo label="Total Líquido a Receber" valor={fmtMoeda(totalLiquido)} cor="#16a34a" negrito ultima />
          </div>
        </>
      )}
    </div>
  )
}

function LinhaResumo({ label, valor, cor, negrito, ultima }: { label: string; valor: string; cor?: string; negrito?: boolean; ultima?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "13px 0", borderBottom: ultima ? "none" : "1px solid #F3F4F6",
    }}>
      <span style={{ color: "#374151", fontSize: 13, fontWeight: negrito ? 800 : 500 }}>{label}</span>
      <span style={{ color: cor ?? "#111827", fontSize: negrito ? 15 : 14, fontWeight: negrito ? 900 : 700 }}>{valor}</span>
    </div>
  )
}
