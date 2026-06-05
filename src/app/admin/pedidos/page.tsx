"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Pedido, StatusPedido } from "@/types"

const STATUS_LABEL: Record<StatusPedido, string> = {
  pendente:   "Pendente",
  aceito:     "Aceito",
  preparando: "Preparando",
  pronto:     "Pronto",
  coletado:   "Coletado",
  entregue:   "Entregue",
  cancelado:  "Cancelado",
}
const STATUS_BADGE: Record<StatusPedido, string> = {
  pendente:   "badge-yellow",
  aceito:     "badge-blue",
  preparando: "badge-orange",
  pronto:     "badge-blue",
  coletado:   "badge-blue",
  entregue:   "badge-green",
  cancelado:  "badge-red",
}
const PAGAMENTO_ICON: Record<string, string> = {
  pix: "💠", cartao: "💳", dinheiro: "💵", maquininha: "📱",
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
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Pedidos</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            Faturamento entregue hoje: <span className="font-bold text-green-400">
              R$ {totalHoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {["todos", "pendente", "aceito", "preparando", "pronto", "coletado", "entregue", "cancelado"].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className="btn-ghost"
            style={{
              fontSize: 11, padding: "6px 12px",
              background: status === s ? "rgba(249,115,22,0.12)" : undefined,
              color:      status === s ? "#f97316" : undefined,
              border:     status === s ? "1px solid rgba(249,115,22,0.3)" : undefined,
            }}>
            {s === "todos" ? "Todos" : STATUS_LABEL[s as StatusPedido]}
            {s !== "todos" && (
              <span style={{ color: "rgba(255,255,255,0.25)" }}>
                {" "}({pedidos.filter(p => p.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {loading ? (
          <p className="text-white/30 text-sm">Carregando...</p>
        ) : filtrados.length === 0 ? (
          <p className="text-white/30 text-sm">Nenhum pedido encontrado.</p>
        ) : (
          filtrados.map(p => (
            <div key={p.id} className="card p-4 flex items-center gap-4">
              <div className="flex-shrink-0 text-center" style={{ minWidth: 56 }}>
                <p className="text-xs font-black text-white/50">#{p.codigo}</p>
                <p className="text-[10px] mt-0.5 text-white/20">
                  {new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`badge ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  <span className="text-xs text-white/50">{(p.loja as any)?.nome ?? "—"}</span>
                </div>
                <p className="text-xs text-white/30">
                  Motoboy: {(p.motoboy as any)?.nome ?? "Não atribuído"}
                  {" · "}Entrega: {p.endereco_entrega}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-black text-white">
                  {PAGAMENTO_ICON[p.forma_pagamento]} R$ {p.total.toFixed(2)}
                </p>
                <p className="text-[10px] mt-0.5 text-white/25">
                  {p.forma_pagamento}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
