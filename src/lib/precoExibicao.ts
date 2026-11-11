// Preço mostrado na vitrine (home, busca, cardápio). Só exibição: o valor cobrado continua
// vindo de produtos.preco + precoAdicionais. Mesma regra que estava dentro de
// restaurante/[id]/page.tsx (19/10/2026), movida pra cá pra home e busca usarem igual.
type Grupo = { itens: { preco: number }[]; obrigatorio?: boolean; minimo?: number; cobranca?: string }

export function precoExibicao(prod: { preco: number; adicionais?: unknown }): { valor: number; aPartir: boolean } {
  if (prod.preco > 0) return { valor: prod.preco, aPartir: false }
  const grupos = (Array.isArray(prod.adicionais) ? prod.adicionais : []).filter((a: any) => Array.isArray(a?.itens)) as Grupo[]
  // "A partir de" = o mínimo que o cliente paga de verdade: soma do item mais barato de cada
  // grupo OBRIGATÓRIO (ex.: sabor da pizza).
  const minimoObrig = grupos.filter(g => g.obrigatorio).reduce((s, g) => {
    const ps = g.itens.map(i => Number(i.preco) || 0).sort((x, y) => x - y)
    const qtd = Math.max(1, Number(g.minimo) || 1)
    return s + (g.cobranca === "maior" ? ps[0] ?? 0 : ps.slice(0, qtd).reduce((t, v) => t + v, 0))
  }, 0)
  if (minimoObrig > 0) return { valor: minimoObrig, aPartir: true }
  const precos = grupos.flatMap(g => g.itens.map(i => i.preco)).filter(p => p > 0)
  if (precos.length > 0) return { valor: Math.min(...precos), aPartir: true }
  return { valor: 0, aPartir: false }
}

export const brl = (v: number) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
