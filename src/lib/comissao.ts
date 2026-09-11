// Regra de faixas nova (motoboy=taxa+1/app=0 abaixo de R$6, loja repassa R$1) — só vale
// pra pedidos criados a partir daqui. Pedidos antigos continuam na fórmula legada, sem
// recalcular retroativamente.
export const REGRA_FAIXAS_DESDE = "2026-08-09T00:00:00-03:00"

function usaFaixaNova(criadoEm?: string | Date | null): boolean {
  if (!criadoEm) return false
  const d = typeof criadoEm === "string" ? new Date(criadoEm) : criadoEm
  return d.getTime() >= new Date(REGRA_FAIXAS_DESDE).getTime()
}

/** Fórmula legada: R$1 até R$10, 10% acima disso. */
function taxaMotoboyLegada(taxa_entrega: number): number {
  return taxa_entrega > 10 ? taxa_entrega * 0.1 : 1
}

/** Taxa cobrada do motoboy por entrega (corte do app). */
export function taxaMotoboy(taxa_entrega: number, criadoEm?: string | Date | null): number {
  const t = taxa_entrega ?? 0
  if (!usaFaixaNova(criadoEm)) return taxaMotoboyLegada(t)
  return t >= 6 ? 1 : 0
}

/** Quanto o motoboy recebe por entrega. */
export function ganhoMotoboy(taxa_entrega: number, criadoEm?: string | Date | null): number {
  const t = taxa_entrega ?? 0
  if (!usaFaixaNova(criadoEm)) return Math.max(0, t - taxaMotoboyLegada(t))
  return t >= 6 ? Math.max(0, t - 1) : t + 1
}

/** Quanto a LOJA deve repassar ao motoboy (faixa < R$6). 0 se não se aplica ou pedido é legado. */
export function repasseLojaPorPedido(taxa_entrega: number, criadoEm?: string | Date | null): number {
  const t = taxa_entrega ?? 0
  if (!usaFaixaNova(criadoEm)) return 0
  return t >= 6 ? 0 : 1
}
