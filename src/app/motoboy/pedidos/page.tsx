"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"

const STATUS_LABEL: Record<string, { texto: string; cor: string; bg: string; border: string }> = {
  aceito:     { texto: "Aceito pela loja", cor: "#60a5fa", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.2)" },
  preparando: { texto: "Sendo preparado",  cor: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.2)" },
}

export default function MotoboyPedidosPage() {
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    // Só pedidos que ainda vão precisar de motoboy — retirada na loja nunca entra na fila
    // de despacho, então não faz sentido o motoboy ficar de olho nesses.
    const { data } = await supabase
      .from("pedidos")
      .select("id, codigo, criado_em, status, endereco_entrega, loja:lojas(nome)")
      .in("status", ["aceito", "preparando"])
      .not("endereco_entrega", "ilike", "%Retirada%")
      .order("criado_em", { ascending: false })
    setPedidos((data ?? []) as any[])
    setLoading(false)
  }, [])

  useEffect(() => {
    carregar()
    const iv = setInterval(carregar, 15_000)
    return () => clearInterval(iv)
  }, [carregar])

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 14px 90px", overflowX: "hidden" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ color: "white", fontWeight: 900, fontSize: 20 }}>Pedidos</h1>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 3 }}>
          Pedidos que as lojas já aceitaram e estão preparando — ainda não estão prontos pra corrida, mas fique de olho
        </p>
      </div>

      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando...</p>
      ) : pedidos.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 60 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Nenhum pedido sendo preparado agora</p>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, marginTop: 4 }}>
            Assim que uma loja aceitar um pedido, ele aparece aqui
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pedidos.map(p => {
            const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.aceito
            return (
              <div key={p.id} style={{
                background: "#111", borderRadius: 14, padding: "14px 16px",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <p style={{ color: "white", fontSize: 14, fontWeight: 800 }}>#{p.codigo}</p>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                    background: st.bg, color: st.cor, border: `1px solid ${st.border}`,
                  }}>
                    {st.texto}
                  </span>
                </div>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                  🍽️ Pedido sendo preparado em <strong>{p.loja?.nome ?? "loja"}</strong>
                </p>
                <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 6 }}>
                  {new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
