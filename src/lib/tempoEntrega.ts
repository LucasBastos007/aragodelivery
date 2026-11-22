// Tempo de entrega que o CLIENTE vê = tempo de preparo da loja (lojas.tempo_min/tempo_max, que a loja
// informa no cadastro e no painel) + deslocamento fixo (motoboy chegar, coletar e levar).
// Pedido do Lucas em 22/11/2026: somar 20 min em todas as lojas. Retirada não soma (cliente busca).
export const DESLOCAMENTO_MIN = 20

type ComTempo = { tempo_min?: number | string | null; tempo_max?: number | string | null } | null | undefined

export const preparoMin = (l: ComTempo, padrao = 30) => Number(l?.tempo_min) || padrao
export const preparoMax = (l: ComTempo, padrao = 50) => Number(l?.tempo_max) || padrao
export const entregaMin = (l: ComTempo, padrao = 30) => preparoMin(l, padrao) + DESLOCAMENTO_MIN
export const entregaMax = (l: ComTempo, padrao = 50) => preparoMax(l, padrao) + DESLOCAMENTO_MIN
export const textoEntrega = (l: ComTempo, sep = "-") => `${entregaMin(l)}${sep}${entregaMax(l)} min`
