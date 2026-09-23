import type { StatusPedido } from "@/types"
import { statusOperacional } from "./statusPedido"

// Fonte única pro "tempo" de um pedido em qualquer tela — nunca fazer "agora -
// criado_em" direto num componente de novo. Bug real corrigido aqui (2026-09-22):
// "Últimos pedidos" no Dashboard aplicava esse cálculo pra QUALQUER pedido, inclusive
// entregue/cancelado há dias/semanas — um pedido entregue 51 dias atrás mostrava
// "73366 min" porque a rota simplesmente fazia agora - p.criado_em sem olhar o status.
// Não era timezone: os timestamps do banco são timestamptz (UTC) e `new Date(iso)` já
// interpreta isso corretamente em qualquer runtime — o problema era 100% de status.
export interface PedidoTempoInput {
  status: StatusPedido
  criado_em: string
  entregue_em?: string | null
  cancelado_em?: string | null
}

export type TipoTempoPedido = "decorrido" | "duracao" | "cancelado" | "indisponivel"
export interface TempoPedidoResultado {
  /** Texto pronto pra exibir — já inclui "atrás" quando fizer sentido. */
  label: string
  minutos: number | null
  tipo: TipoTempoPedido
}

function fmtMin(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`
}

export function tempoPedido(p: PedidoTempoInput, agora: number = Date.now()): TempoPedidoResultado {
  // Pedido ainda ativo (novo/preparo/aguardando motoboy/em entrega): tempo decorrido
  // desde a criação é a informação útil — "há quanto tempo está parado/em andamento".
  if (statusOperacional(p.status)) {
    const min = Math.max(0, Math.round((agora - new Date(p.criado_em).getTime()) / 60000))
    return { label: `${fmtMin(min)} atrás`, minutos: min, tipo: "decorrido" }
  }

  // Pedido entregue: duração REAL (criação até entrega) — nunca "agora menos criado".
  if (p.status === "entregue") {
    if (!p.entregue_em) return { label: "—", minutos: null, tipo: "indisponivel" }
    const min = Math.max(0, Math.round((new Date(p.entregue_em).getTime() - new Date(p.criado_em).getTime()) / 60000))
    return { label: fmtMin(min), minutos: min, tipo: "duracao" }
  }

  // Cancelado: NUNCA mostrar como se fosse uma entrega concluída (não é "duração"), e
  // nunca "agora - criado_em" (isso é o "tempo correndo" que só faz sentido pra pedido
  // ativo). `cancelado_em` existe desde a rodada 5 (2026-09-22) — só pedidos cancelados
  // A PARTIR de então têm o timestamp; cancelamentos antigos ficam null de propósito
  // (nunca estimar/backfillar com criado_em ou "agora").
  if (p.status === "cancelado") {
    if (!p.cancelado_em) return { label: "—", minutos: null, tipo: "indisponivel" }
    const min = Math.max(0, Math.round((agora - new Date(p.cancelado_em).getTime()) / 60000))
    return { label: `${fmtMin(min)} atrás`, minutos: min, tipo: "cancelado" }
  }

  // aguardando_pagamento: não existe timestamp confiável de conclusão no schema atual
  // (`atualizado_em` foi auditado e NÃO é atualizado — fica sempre igual a criado_em).
  return { label: "—", minutos: null, tipo: "indisponivel" }
}
