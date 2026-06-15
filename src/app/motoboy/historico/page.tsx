"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

type Periodo = "hoje" | "semana" | "mes" | "total"

const PGTO: Record<string, string> = {
  pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha",
}
const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "hoje",   label: "Hoje" },
  { key: "semana", label: "7 dias" },
  { key: "mes",    label: "Este mês" },
  { key: "total",  label: "Total" },
]
const PAGE_SIZE = 20

function dateInicio(periodo: Periodo): Date {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  if (periodo === "hoje")   return hoje
  if (periodo === "semana") { const d = new Date(hoje); d.setDate(d.getDate() - 6); return d }
  if (periodo === "mes")    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  return new Date(2020, 0, 1)
}

function ganhoReal(p: any): number {
  return p.ganho_motoboy ?? p.taxa_entrega ?? 0
}

export default function MotoboyHistoricoPage() {
  const { sessao } = useAuth()
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null

  const [periodo,  setPeriodo]  = useState<Periodo>("total")
  const [pedidos,  setPedidos]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [page,     setPage]     = useState(0)
  const [hasMore,  setHasMore]  = useState(false)
  const [total,    setTotal]    = useState(0)
  const [totalGanhos, setTotalGanhos] = useState(0)
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)

  useEffect(() => { if (motoboy_id) { setPedidos([]); setPage(0); carregar(0) } }, [motoboy_id, periodo])

  async function carregar(novaPagina: number) {
    setLoading(true)
    const inicio = dateInicio(periodo)
    const fim    = new Date(); fim.setHours(23, 59, 59, 999)
    const from   = novaPagina * PAGE_SIZE
    const to     = from + PAGE_SIZE - 1

    const { data, count } = await supabase
      .from("pedidos")
      .select("id, codigo, taxa_entrega, ganho_motoboy, foto_entrega, criado_em, forma_pagamento, endereco_entrega, loja:lojas(nome)", { count: "exact" })
      .eq("motoboy_id", motoboy_id)
      .eq("status", "entregue")
      .gte("criado_em", inicio.toISOString())
      .lte("criado_em", fim.toISOString())
      .order("criado_em", { ascending: false })
      .range(from, to)

    const rows = (data ?? []) as any[]
    setPedidos(novaPagina === 0 ? rows : prev => [...prev, ...rows])
    if (count !== null) setTotal(count)
    setHasMore(rows.length === PAGE_SIZE)
    setPage(novaPagina)

    // Calcular total de ganhos no período (sem paginação)
    if (novaPagina === 0) {
      const { data: todos } = await supabase
        .from("pedidos")
        .select("taxa_entrega, ganho_motoboy")
        .eq("motoboy_id", motoboy_id)
        .eq("status", "entregue")
        .gte("criado_em", inicio.toISOString())
        .lte("criado_em", fim.toISOString())
      setTotalGanhos((todos ?? []).reduce((s, p) => s + ganhoReal(p), 0))
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
      {/* Foto ampliada */}
      {fotoAmpliada && (
        <div
          onClick={() => setFotoAmpliada(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <img src={fotoAmpliada} alt="Comprovante" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 16, objectFit: "contain" }} />
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <h1 style={{ color: "white", fontWeight: 900, fontSize: 20 }}>Histórico</h1>
        {total > 0 && (
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 3 }}>
            {total} entrega{total !== 1 ? "s" : ""} · <span style={{ color: "#22c55e", fontWeight: 700 }}>R$ {totalGanhos.toFixed(2)}</span>
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {PERIODOS.map(p => (
          <button key={p.key} onClick={() => setPeriodo(p.key)} style={{
            padding: "7px 16px", borderRadius: 999, fontSize: 12, fontWeight: 700,
            cursor: "pointer", border: "none", transition: "all 0.15s",
            background: periodo === p.key ? "#f97316" : "rgba(255,255,255,0.07)",
            color: periodo === p.key ? "white" : "rgba(255,255,255,0.45)",
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {loading && pedidos.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando...</p>
      ) : pedidos.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 60 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Nenhuma entrega no período</p>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, marginTop: 4 }}>
            Suas entregas concluídas aparecerão aqui
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pedidos.map((p, i) => (
              <div key={p.id + i} style={{
                background: "#111", borderRadius: 14, padding: "14px 16px",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <p style={{ color: "white", fontSize: 14, fontWeight: 800 }}>#{p.codigo}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                        Entregue
                      </span>
                    </div>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 2 }}>{p.loja?.nome ?? "—"}</p>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.endereco_entrega}
                    </p>
                    <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                      <span>{new Date(p.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>
                      <span>·</span>
                      <span>{new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span>·</span>
                      <span>{PGTO[p.forma_pagamento] ?? p.forma_pagamento}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: "#22c55e", fontWeight: 900, fontSize: 16 }}>
                        R$ {ganhoReal(p).toFixed(2)}
                      </p>
                      {p.taxa_entrega !== ganhoReal(p) && (
                        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, marginTop: 1 }}>
                          taxa R$ {(p.taxa_entrega ?? 0).toFixed(2)}
                        </p>
                      )}
                    </div>
                    {p.foto_entrega && (
                      <img
                        src={p.foto_entrega}
                        alt="Comprovante"
                        onClick={() => setFotoAmpliada(p.foto_entrega)}
                        style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", cursor: "pointer", border: "1px solid rgba(255,255,255,0.12)" }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => carregar(page + 1)}
              disabled={loading}
              style={{
                width: "100%", marginTop: 16, padding: "12px",
                borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)",
                fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
              }}>
              {loading ? "Carregando..." : "Carregar mais"}
            </button>
          )}
        </>
      )}
    </div>
  )
}
