// Lojas favoritas (layout da proposta, 20/10/2026): o coração na página da loja e a lista no
// Perfil. Fica salvo no próprio aparelho (localStorage), sem mexer no banco.
const CHAVE = "chego_favoritas"
export function lerFavoritas(): string[] {
  try { const v = JSON.parse(localStorage.getItem(CHAVE) ?? "[]"); return Array.isArray(v) ? v.filter(x => typeof x === "string") : [] } catch { return [] }
}
export function alternarFavorita(id: string): boolean {
  const atual = lerFavoritas()
  const tem = atual.includes(id)
  const nova = tem ? atual.filter(x => x !== id) : [id, ...atual]
  try { localStorage.setItem(CHAVE, JSON.stringify(nova.slice(0, 50))) } catch {}
  return !tem
}
