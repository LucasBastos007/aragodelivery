import type { StatusPedido } from "@/types"

// Fonte única de verdade pro agrupamento operacional de um pedido — usado pelo
// Dashboard do lojista (Operação Agora), pelas colunas da tela de Pedidos e pelo
// filtro "?foco=". Não duplicar esse mapeamento em outro componente.
//
// Mapeamento corrigido em 2026-09-22 (rodada de separação Pronto/Aguardando motoboy) —
// confirmado lendo o código real de despacho (`src/app/api/escalada/route.ts` +
// `src/app/motoboy/page.tsx::loadPedidos`), não só o schema. Detalhe importante: são
// DUAS camadas de despacho, não uma — ver nota completa no AGENTS.md.
//   pendente                    -> novo (loja ainda não aceitou)
//   aceito, preparando          -> preparo
//   pronto                      -> pronto (loja terminou de preparar). ATENÇÃO: mesmo
//     sem a loja ter clicado "Chamar motoboy", todo pedido "pronto" já fica visível e
//     aceitável por QUALQUER motoboy disponível via polling passivo (lista que o app
//     dele consulta a cada 15s) — não é um estado "seguro"/sem despacho.
//   aguardando_aceite           -> aguardando_motoboy (camada ADICIONAL de push ativo:
//     a loja clicou "Chamar motoboy" (ou o cron re-escalar disparou de novo), o
//     /api/escalada mudou o status e mandou push HTTP + popup com timer de 30s pra
//     TODOS os candidatos elegíveis ao mesmo tempo — não é "proposta a um motoboy só".
//     Se não sobrar candidato, reverte pra "pronto" de novo, voltando só a lista passiva)
//   indo_para_loja, na_loja, em_rota, coletado -> em_entrega (motoboy já comprometido)
//   aguardando_pagamento, entregue, cancelado  -> null (fora da operação ativa)
export type StatusOperacional = "novo" | "preparo" | "pronto" | "aguardando_motoboy" | "em_entrega"

export const OPERACIONAL_LABEL: Record<StatusOperacional, string> = {
  novo: "Novos pedidos",
  preparo: "Em preparo",
  pronto: "Pronto",
  aguardando_motoboy: "Aguardando motoboy",
  em_entrega: "Em entrega",
}

export function statusOperacional(status: StatusPedido): StatusOperacional | null {
  switch (status) {
    case "pendente":
      return "novo"
    case "aceito":
    case "preparando":
      return "preparo"
    case "pronto":
      return "pronto"
    case "aguardando_aceite":
      return "aguardando_motoboy"
    case "indo_para_loja":
    case "na_loja":
    case "em_rota":
    case "coletado":
      return "em_entrega"
    default:
      return null
  }
}

// "Pedido válido" pra métricas financeiras/de volume (Vendas, Pedidos, Ticket médio) —
// mesma regra já usada em financeiro/page.tsx e relatorio/page.tsx: só pedido
// efetivamente entregue conta como venda real. Não criar regra paralela.
export function pedidoValido(status: StatusPedido): boolean {
  return status === "entregue"
}

// Pra Taxa de Conclusão: pedidos que já chegaram a um resultado final no período
// (entregue ou cancelado) — pedidos ainda em andamento no fim do período não entram
// nem no numerador nem no denominador, porque ainda não se sabe o desfecho deles.
export function pedidoConcluidoOuCancelado(status: StatusPedido): boolean {
  return status === "entregue" || status === "cancelado"
}

// Fonte única pra "isso é Histórico" (Fase 4, 2026-09-23). Deliberadamente EXPLÍCITA —
// nunca "statusOperacional(status) === null", porque isso incluiria "aguardando_pagamento"
// (pedido que nem chegou a existir de verdade pra loja) como se fosse um pedido encerrado.
// Só existem dois status verdadeiramente finais hoje: entregue e cancelado. "coletado" NÃO
// entra aqui — é operação ativa (motoboy a caminho), classificado como "em_entrega" acima;
// um pedido não pode estar em "Em entrega" e no Histórico ao mesmo tempo.
export const STATUS_FINAIS = ["entregue", "cancelado"] as const satisfies readonly StatusPedido[]

export function ehStatusFinal(status: StatusPedido): boolean {
  return (STATUS_FINAIS as readonly StatusPedido[]).includes(status)
}
