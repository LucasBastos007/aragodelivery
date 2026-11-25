// Cliente do cardápio pelo servidor (25/11/2026 — etapa 3). Substitui as leituras diretas
// de produtos/categorias no navegador. Ver src/app/api/cardapio/route.ts.
async function pega(qs: string): Promise<any> {
  const r = await fetch(`/api/cardapio?${qs}`, { credentials: "same-origin" })
  if (!r.ok) return {}
  return r.json().catch(() => ({}))
}

/** Cardápio de uma loja: { categorias, produtos }. */
export async function cardapioDaLoja(lojaId: string): Promise<{ categorias: any[]; produtos: any[] }> {
  const j = await pega(`loja=${encodeURIComponent(lojaId)}`)
  return { categorias: j.categorias ?? [], produtos: j.produtos ?? [] }
}

/** Produtos por id (para reordenar um pedido). */
export async function produtosPorIds(ids: string[]): Promise<any[]> {
  if (!ids.length) return []
  const j = await pega(`ids=${ids.map(encodeURIComponent).join(",")}`)
  return j.produtos ?? []
}

/** Vitrine da home: produtos em destaque das lojas abertas. */
export async function vitrineHome(lojaIds: string[]): Promise<{ produtos: any[]; categorias: any[] }> {
  if (!lojaIds.length) return { produtos: [], categorias: [] }
  const j = await pega(`vitrine=1&lojas=${lojaIds.map(encodeURIComponent).join(",")}`)
  return { produtos: j.produtos ?? [], categorias: j.categorias ?? [] }
}

/** Busca de produtos pelo nome/descrição. */
export async function buscarProdutos(termo: string): Promise<any[]> {
  const t = termo.trim()
  if (t.length < 2) return []
  const j = await pega(`busca=${encodeURIComponent(t)}`)
  return j.produtos ?? []
}
