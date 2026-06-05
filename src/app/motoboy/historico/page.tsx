"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

const PGTO: Record<string, string> = {
  pix: "💠 PIX", cartao: "💳 Cartão", dinheiro: "💵 Dinheiro", maquininha: "📱 Maquininha",
}

const PAGE_SIZE = 15

export default function MotoboyHistoricoPage() {
  const { sessao } = useAuth()
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null

  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total,   setTotal]   = useState(0)

  useEffect(() => {
    if (!motoboy_id) return
    carregar(0)
  }, [motoboy_id])

  async function carregar(novaPagina: number) {
    setLoading(true)
    const from = novaPagina * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    const { data, count } = await supabase
      .from("pedidos")
      .select("*, loja:lojas(nome)", { count: "exact" })
      .eq("motoboy_id", motoboy_id)
      .eq("status", "entregue")
      .order("criado_em", { ascending: false })
      .range(from, to)

    const rows = (data ?? []) as any[]
    setPedidos(novaPagina === 0 ? rows : prev => [...prev, ...rows])
    if (count !== null) setTotal(count)
    setHasMore(rows.length === PAGE_SIZE)
    setPage(novaPagina)
    setLoading(false)
  }

  function carregarMais() {
    carregar(page + 1)
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: "white", fontWeight: 900, fontSize: 20 }}>📋 Histórico</h1>
        {total > 0 && (
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 3 }}>
            {total} entrega{total !== 1 ? "s" : ""} no total
          </p>
        )}
      </div>

      {loading && pedidos.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando...</p>
      ) : pedidos.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 60 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📭</p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Nenhuma entrega ainda</p>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <p style={{ color: "white", fontSize: 14, fontWeight: 800 }}>#{p.codigo}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                        ✓ Entregue
                      </span>
                    </div>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 3 }}>
                      🏪 {p.loja?.nome ?? "—"}
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      📍 {p.endereco_entrega}
                    </p>
                    <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                      <span>{new Date(p.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>
                      <span>·</span>
                      <span>{new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span>·</span>
                      <span>{PGTO[p.forma_pagamento] ?? p.forma_pagamento}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                    <p style={{ color: "#22c55e", fontWeight: 900, fontSize: 16 }}>
                      R$ {(p.taxa_entrega ?? 0).toFixed(2)}
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 2 }}>
                      pedido R$ {p.total.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={carregarMais}
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
