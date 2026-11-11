// Preço dos adicionais escolhidos num item — fonte única pra tela da loja, carrinho e servidor.
//
// Regra padrão (todas as lojas, como sempre foi): soma o preço de cada adicional escolhido.
// Exceção: grupo marcado com `cobranca: "maior"` (pizza meio a meio — cada sabor vem com o
// preço da pizza inteira) cobra SÓ o sabor mais caro escolhido naquele grupo. Antes disso a
// Pizzaria Bom Demais cobrava 2 sabores como 2 pizzas (relato do Lucas, 19/10/2026).
// Grupos sem a marcação continuam somando exatamente igual.
// Com `grupo_id` (05/11/2026) o adicional conta no grupo certo quando o mesmo id existe em
// mais de um grupo; sem ele, no 1º grupo que tem o id (como antes).
type Escolhido = { id: string; preco: number; grupo_id?: string }

export function precoAdicionais(adicionaisDoProduto: unknown, escolhidos: Escolhido[]): number {
  const grupos = (Array.isArray(adicionaisDoProduto) ? adicionaisDoProduto : [])
    .filter((g: any) => Array.isArray(g?.itens)) as { id?: string; itens: { id: string }[]; cobranca?: string }[]
  let total = 0
  const contados = new Set<number>()
  for (const g of grupos) {
    const idx: number[] = []
    escolhidos.forEach((a, i) => { if (!contados.has(i) && (a.grupo_id ? a.grupo_id === g.id : true) && g.itens.some(x => x.id === a.id)) idx.push(i) })
    if (!idx.length) continue
    idx.forEach(i => contados.add(i))
    const precos = idx.map(i => Number(escolhidos[i].preco) || 0)
    total += g.cobranca === "maior" ? Math.max(...precos) : precos.reduce((s, v) => s + v, 0)
  }
  escolhidos.forEach((a, i) => { if (!contados.has(i)) total += Number(a.preco) || 0 }) // adicionais avulsos
  return Math.round(total * 100) / 100
}
