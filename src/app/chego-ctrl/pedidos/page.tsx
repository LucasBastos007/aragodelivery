"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Pedido, StatusPedido } from "@/types"

function ConfirmarCartaoBtn({ pedidoId, onConfirmado }: { pedidoId: string; onConfirmado: () => void }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")

  async function verificar() {
    setLoading(true)
    setMsg("")
    const r = await fetch("/api/pagamento/verificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: pedidoId }),
    }).then(r => r.json()).catch(() => ({}))
    if (r.confirmado) { onConfirmado() }
    else { setMsg(r.status === "cancelado" ? "Recusado" : "Pendente") }
    setLoading(false)
  }

  return (
    <div style={{ marginTop: 4 }}>
      <button onClick={verificar} disabled={loading} style={{
        fontSize: 10, padding: "2px 6px", borderRadius: 6, border: "1px solid #f97316",
        background: "none", color: "#f97316", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700,
      }}>
        {loading ? "..." : "Confirmar"}
      </button>
      {msg && <p style={{ fontSize: 9, color: msg === "Recusado" ? "#DC2626" : "#6B7280", marginTop: 2 }}>{msg}</p>}
    </div>
  )
}

const STATUS_LABEL: Record<StatusPedido, string> = {
  aguardando_pagamento: "Aguard. pagamento",
  pendente:          "Pendente",
  aceito:            "Aceito",
  preparando:        "Preparando",
  pronto:            "Pronto",
  aguardando_aceite: "Aguard. motoboy",
  indo_para_loja:    "Indo à loja",
  na_loja:           "Na loja",
  em_rota:           "Em rota",
  coletado:          "Coletado",
  entregue:          "Entregue",
  cancelado:         "Cancelado",
}
const STATUS_BADGE: Record<StatusPedido, string> = {
  aguardando_pagamento: "badge-yellow",
  pendente:          "badge-yellow",
  aceito:            "badge-blue",
  preparando:        "badge-orange",
  pronto:            "badge-blue",
  aguardando_aceite: "badge-orange",
  indo_para_loja:    "badge-blue",
  na_loja:           "badge-blue",
  em_rota:           "badge-orange",
  coletado:          "badge-blue",
  entregue:          "badge-green",
  cancelado:         "badge-red",
}
const PAGAMENTO_ICON: Record<string, string> = {
  pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha",
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus]   = useState("todos")

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("pedidos")
        .select("*, loja:lojas(nome), motoboy:motoboys(nome)")
        .order("criado_em", { ascending: false })
        .limit(200)
      setPedidos((data as Pedido[]) ?? [])
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [])

  const filtrados = pedidos.filter(p => status === "todos" || p.status === status)
  const totalHoje = pedidos.filter(p => {
    const hoje = new Date().toISOString().slice(0, 10)
    return p.criado_em.slice(0, 10) === hoje && p.status === "entregue"
  }).reduce((s, p) => s + p.total, 0)

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div style={{ minWidth: 0 }}>
          <h1 style={{ color: "#0F172A", fontSize: 22, fontWeight: 900 }}>Pedidos</h1>
          <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>
            Hoje: <span className="font-bold text-green-400">
              R$ {totalHoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </p>
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 sm:mb-6 flex-wrap">
        {["todos", "pendente", "aceito", "preparando", "pronto", "coletado", "entregue", "cancelado"].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className="btn-ghost"
            style={{
              fontSize: 10, padding: "5px 9px",
              background: status === s ? "rgba(249,115,22,0.12)" : undefined,
              color:      status === s ? "#f97316" : undefined,
              border:     status === s ? "1px solid rgba(249,115,22,0.3)" : undefined,
            }}>
            {s === "todos" ? "Todos" : STATUS_LABEL[s as StatusPedido]}
            {s !== "todos" && (
              <span style={{ color: "#CBD5E1" }}>
                {" "}({pedidos.filter(p => p.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {loading ? (
          <p style={{ color: "#94a3b8", fontSize: 13 }}>Carregando...</p>
        ) : filtrados.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13 }}>Nenhum pedido encontrado.</p>
        ) : (
          filtrados.map(p => {
              const fmt = (iso: string) =>
                new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
              const diffMin = (a: string, b: string) =>
                Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)

              return (
                <div key={p.id} className="card p-3 sm:p-4 flex items-start gap-3">
                  <div className="flex-shrink-0 text-center" style={{ minWidth: 48 }}>
                    <p className="text-xs font-black">#{p.codigo}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#94a3b8" }}>
                      {fmt(p.criado_em)}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`badge ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                      <span className="text-xs truncate" style={{ color: "#64748b" }}>{(p.loja as any)?.nome ?? "—"}</span>
                    </div>
                    <p className="text-xs truncate" style={{ color: "#94a3b8" }}>
                      {(p.motoboy as any)?.nome ?? "Sem motoboy"}
                    </p>
                    <p className="text-xs truncate" style={{ color: "#94a3b8" }}>
                      {p.endereco_entrega}
                    </p>
                    {p.status === "entregue" && (p.coletado_em || p.entregue_em) && (
                      <div style={{
                        marginTop: 6, padding: "6px 10px", borderRadius: 8,
                        background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.15)",
                        display: "flex", flexWrap: "wrap", gap: "4px 14px",
                      }}>
                        {p.coletado_em && (
                          <span style={{ fontSize: 11, color: "#64748b" }}>
                            Coletou <strong style={{ color: "#0F172A" }}>{fmt(p.coletado_em)}</strong>
                          </span>
                        )}
                        {p.entregue_em && (
                          <span style={{ fontSize: 11, color: "#64748b" }}>
                            Entregou <strong style={{ color: "#0F172A" }}>{fmt(p.entregue_em)}</strong>
                          </span>
                        )}
                        {p.coletado_em && p.entregue_em && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>
                            {diffMin(p.coletado_em, p.entregue_em)} min
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-sm" style={{ color: "#0F172A" }}>
                      R$ {p.total.toFixed(2)}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#94a3b8" }}>
                      {PAGAMENTO_ICON[p.forma_pagamento]}
                    </p>
                    {p.status === "aguardando_pagamento" && p.forma_pagamento === "cartao" && (
                      <ConfirmarCartaoBtn pedidoId={p.id} onConfirmado={() => setPedidos(prev =>
                        prev.map(x => x.id === p.id ? { ...x, status: "pendente" as StatusPedido } : x)
                      )} />
                    )}
                  </div>
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}
