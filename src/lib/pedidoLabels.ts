import type { StatusPedido } from "@/types"

// Fonte única pros textos exibidos de status/pagamento/cancelamento de um pedido — usado
// por Pedidos (Fase 3) e Histórico (Fase 4). Antes cada tela tinha sua própria cópia
// (STATUS_LABEL e PGTO duplicados, historico com um subconjunto de STATUS_LABEL) —
// extraído em 2026-09-23 pra nunca mais divergir. Conteúdo idêntico ao que já existia em
// src/app/loja/page.tsx (a versão mais completa, com os 12 status) — nenhum texto mudou.
export const STATUS_LABEL: Record<StatusPedido, string> = {
  aguardando_pagamento: "Aguard. pagamento",
  pendente:          "Novo pedido",
  aceito:            "Aceito",
  preparando:        "Preparando",
  pronto:            "Pronto para entrega",
  aguardando_aceite: "Aguardando motoboy",
  indo_para_loja:    "Motoboy a caminho",
  na_loja:           "Motoboy na loja",
  em_rota:           "Em rota de entrega",
  coletado:          "Coletado",
  entregue:          "Entregue",
  cancelado:         "Cancelado",
}

// Usado tanto na comanda impressa (imprimirPedido) quanto na listagem do Histórico —
// mesmo mapa, nunca duplicar.
export const PGTO: Record<string, string> = {
  pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro",
  maquininha: "Maquininha", apple_pay: "Apple Pay", google_pay: "Google Pay",
}

// Só existiam no Histórico até a Fase 4 (Pedidos não tem tela de detalhe de
// cancelamento hoje) — ficam aqui já centralizados pra não nascer duplicado se Pedidos
// vier a precisar no futuro.
export const CANCELADO_POR_LABEL: Record<string, string> = {
  loja: "Loja", pagamento: "Pagamento", cliente: "Cliente", sistema: "Sistema",
}

export const MOTIVO_CANCELAMENTO_LABEL: Record<string, string> = {
  produto_esgotado: "Produto indisponível",
  loja_ocupada: "Loja ocupada",
  timeout_aceite: "Tempo de aceite esgotado",
  cliente_cancelou: "Cliente cancelou",
  sem_entregador: "Sem entregador disponível",
  problema_pagamento: "Problema no pagamento",
  gateway_cancelado: "Pagamento não confirmado",
  outro: "Outro motivo",
}
