// Regra de faixas nova (motoboy=taxa+1/app=0 abaixo de R$6, loja repassa R$1) — vale pra
// pedidos criados entre essa data e REGRA_SEM_CORTE_DESDE. Pedidos antigos continuam na
// fórmula legada, sem recalcular retroativamente.
export const REGRA_FAIXAS_DESDE = "2026-08-09T00:00:00-03:00"

// Pedido explícito do usuário, 2026-09-17: "não vamos retirar taxa pro Chegô" — o corte
// do app (taxaMotoboy) some pra pedidos a partir daqui. Motoboy sempre recebe a taxa de
// entrega real, com piso de TAXA_MINIMA_MOTOBOY quando a taxa for menor (entrega barata
// ou cupom de frete grátis) — a loja continua cobrindo essa diferença até o piso, exatamente
// como já cobria o "+1" da faixa antiga, só que agora fixo em R$4 em vez da fórmula por faixa.
export const REGRA_SEM_CORTE_DESDE = "2026-09-17T00:00:00-03:00"
export const TAXA_MINIMA_MOTOBOY = 4

function usaFaixaNova(criadoEm?: string | Date | null): boolean {
  if (!criadoEm) return false
  const d = typeof criadoEm === "string" ? new Date(criadoEm) : criadoEm
  return d.getTime() >= new Date(REGRA_FAIXAS_DESDE).getTime()
}

function usaSemCorte(criadoEm?: string | Date | null): boolean {
  if (!criadoEm) return false
  const d = typeof criadoEm === "string" ? new Date(criadoEm) : criadoEm
  return d.getTime() >= new Date(REGRA_SEM_CORTE_DESDE).getTime()
}

/** Fórmula legada: R$1 até R$10, 10% acima disso. */
function taxaMotoboyLegada(taxa_entrega: number): number {
  return taxa_entrega > 10 ? taxa_entrega * 0.1 : 1
}

/** Taxa cobrada do motoboy por entrega (corte do app) — 0 desde REGRA_SEM_CORTE_DESDE. */
export function taxaMotoboy(taxa_entrega: number, criadoEm?: string | Date | null): number {
  const t = taxa_entrega ?? 0
  if (usaSemCorte(criadoEm)) return 0
  if (!usaFaixaNova(criadoEm)) return taxaMotoboyLegada(t)
  return t >= 6 ? 1 : 0
}

/** Quanto o motoboy recebe por entrega. */
export function ganhoMotoboy(taxa_entrega: number, criadoEm?: string | Date | null): number {
  const t = taxa_entrega ?? 0
  if (usaSemCorte(criadoEm)) return Math.max(t, TAXA_MINIMA_MOTOBOY)
  if (!usaFaixaNova(criadoEm)) return Math.max(0, t - taxaMotoboyLegada(t))
  return t >= 6 ? Math.max(0, t - 1) : t + 1
}

/** Quanto a LOJA deve repassar ao motoboy pra completar o piso mínimo. 0 se não se aplica
 * ou pedido é de regra antiga. */
export function repasseLojaPorPedido(taxa_entrega: number, criadoEm?: string | Date | null): number {
  const t = taxa_entrega ?? 0
  if (usaSemCorte(criadoEm)) return Math.max(0, TAXA_MINIMA_MOTOBOY - t)
  if (!usaFaixaNova(criadoEm)) return 0
  return t >= 6 ? 0 : 1
}
