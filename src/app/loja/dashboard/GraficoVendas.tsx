"use client"

import { useState } from "react"

interface PontoSerie { rotulo: string; vendas: number; pedidos: number }

// Gráfico de barras da Visão Geral — genérico o bastante pra atender os 4 granularidades
// (hoje = 2h em 2h, semana = dia da semana, mês = dia, personalizado = auto), já que o
// backend entrega tudo pré-agrupado em {rotulo, vendas, pedidos}. Mobile reduz a
// quantidade de labels visíveis (spec: "reduzir quantidade de labels", "nunca scroll
// horizontal no gráfico principal").
//
// Tooltip próprio (não `title` do navegador) — `title` não funciona por toque no
// mobile, só em hover de mouse (round 2: spec pede tooltip claro em Horário/valor).
export default function GraficoVendas({ serie }: { serie: PontoSerie[] }) {
  const [metrica, setMetrica] = useState<"vendas" | "pedidos">("vendas")
  const [ativo, setAtivo] = useState<number | null>(null)
  const temDados = serie.some(p => p.vendas > 0 || p.pedidos > 0)
  const max = Math.max(1, ...serie.map(p => (metrica === "vendas" ? p.vendas : p.pedidos)))
  // No mobile, com muitos buckets (ex: mês inteiro), só mostra rótulo de 1 a cada N barras
  const passoLabel = serie.length > 15 ? Math.ceil(serie.length / 8) : serie.length > 8 ? 2 : 1
  const pontoAtivo = ativo != null ? serie[ativo] : null

  return (
    <div className="card" style={{ padding: "18px 16px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <p style={{ color: "#111827", fontWeight: 900, fontSize: 15 }}>Vendas</p>
        <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 10, padding: 3 }}>
          {(["vendas", "pedidos"] as const).map(m => (
            <button key={m} onClick={() => setMetrica(m)} style={{
              padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 700,
              background: metrica === m ? "#ffffff" : "transparent",
              color: metrica === m ? "#f97316" : "#6B7280",
              boxShadow: metrica === m ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}>
              {m === "vendas" ? "Faturamento" : "Pedidos"}
            </button>
          ))}
        </div>
      </div>

      {!temDados ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 160 }}>
          <p style={{ color: "#9CA3AF", fontSize: 13 }}>Sem vendas neste período</p>
        </div>
      ) : (
        <div style={{ position: "relative", flex: 1 }}>
          {pontoAtivo && (
            <div style={{
              position: "absolute", top: -6, left: `${(ativo! / Math.max(1, serie.length - 1)) * 100}%`,
              transform: `translate(${ativo === 0 ? "0%" : ativo === serie.length - 1 ? "-100%" : "-50%"}, -100%)`,
              background: "#111827", color: "white", borderRadius: 8, padding: "6px 10px",
              fontSize: 11, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 2,
            }}>
              <p style={{ margin: 0, opacity: 0.7, fontWeight: 700 }}>{pontoAtivo.rotulo}</p>
              <p style={{ margin: 0, fontWeight: 800 }}>
                {metrica === "vendas" ? fmtMoeda(pontoAtivo.vendas) : `${pontoAtivo.pedidos} pedido${pontoAtivo.pedidos !== 1 ? "s" : ""}`}
              </p>
            </div>
          )}
          <div
            style={{ display: "flex", alignItems: "flex-end", gap: Math.max(2, 8 - Math.floor(serie.length / 8)), height: 160, overflow: "hidden" }}
            onMouseLeave={() => setAtivo(null)}
          >
            {serie.map((p, i) => {
              const valor = metrica === "vendas" ? p.vendas : p.pedidos
              const alturaPct = Math.max(valor > 0 ? 3 : 1, (valor / max) * 100)
              return (
                <div key={i}
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => setAtivo(ativo === i ? null : i)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", flex: 1, height: "100%", minWidth: 0, cursor: "pointer" }}>
                  <div style={{
                    width: "100%", maxWidth: 26, borderRadius: "4px 4px 1px 1px",
                    background: valor > 0 ? (ativo === i ? "linear-gradient(180deg, #fb923c, #ea580c)" : "linear-gradient(180deg, #fdba74, #f97316)") : "#F3F4F6",
                    height: `${alturaPct}%`, transition: "height 0.4s",
                  }} />
                  <span style={{ fontSize: 9.5, color: "#9CA3AF", fontWeight: 600, marginTop: 6, whiteSpace: "nowrap" }}>
                    {i % passoLabel === 0 ? p.rotulo : ""}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
