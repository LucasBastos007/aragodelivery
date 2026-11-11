// "Pedir de novo" (histórico e perfil do cliente). Bug real 2026-10-09 (pedido E92TBV,
// Dudu Lanches): o botão copiava só id/nome/preço do item e perdia sabores obrigatórios e
// adicionais — o pedido chegou à loja sem o sabor do creme e sem os 4 adicionais do X-Tudo
// (cobrados a menos). Agora remonta cada item a partir do cardápio ATUAL: preço atual,
// adicionais que ainda existem (casando por id, ou por grupo+nome se a loja recriou o grupo)
// e mesma chave de carrinho de restaurante/[id]/page.tsx::handleAddToCart. Item indisponível
// ou que ficou sem escolha obrigatória NÃO entra — volta em `pendentes` pro cliente escolher.
import { supabase } from "@/lib/supabase"
import { precoAdicionais } from "@/lib/precoAdicionais"
import type { CartItem } from "@/lib/cart"

type Adic = { id: string; nome: string; preco: number }
type Grupo = { id?: string; nome: string; obrigatorio?: boolean; minimo?: number; maximo?: number; itens: Adic[] }
const ehGrupo = (e: any): e is Grupo => Array.isArray(e?.itens)
const norm = (s: string) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()

export async function montarReordem(pedido: any): Promise<{ itens: Omit<CartItem, "quantidade">[][]; pendentes: string[] }> {
  const loja = pedido.loja
  const itensPedido: any[] = pedido.itens ?? []
  const ids = [...new Set(itensPedido.map(i => i.produto_id).filter(Boolean))]
  const { data: produtos } = ids.length
    ? await supabase.from("produtos").select("id, nome, preco, disponivel, adicionais").in("id", ids)
    : { data: [] as any[] }
  const porId = new Map((produtos ?? []).map((p: any) => [p.id, p]))

  const itens: Omit<CartItem, "quantidade">[][] = []
  const pendentes: string[] = []
  for (const it of itensPedido) {
    const prod: any = porId.get(it.produto_id)
    if (!prod || !prod.disponivel) { pendentes.push(`${it.nome} (indisponível)`); continue }
    const entradas: any[] = prod.adicionais ?? []
    const grupos = entradas.filter(ehGrupo)
    const avulsos = entradas.filter(e => !ehGrupo(e)) as Adic[]
    const antigos: Adic[] = Array.isArray(it.adicionais) ? it.adicionais : []

    const escolhidos: Adic[] = []
    for (const a of antigos) {
      let achado: Adic | undefined
      for (const g of grupos) achado ??= g.itens.find(x => x.id === a.id)
      achado ??= avulsos.find(x => x.id === a.id)
      if (!achado) for (const g of grupos) achado ??= g.itens.find(x => norm(x.nome) === norm(a.nome))
      achado ??= avulsos.find(x => norm(x.nome) === norm(a.nome))
      if (achado && !escolhidos.some(e => e.id === achado!.id)) escolhidos.push({ id: achado.id, nome: achado.nome, preco: Number(achado.preco) || 0 })
    }
    const faltaEscolha = grupos.some(g => {
      const min = Math.max(g.obrigatorio ? 1 : 0, Number(g.minimo) || 0)
      return min > 0 && escolhidos.filter(e => g.itens.some(x => x.id === e.id)).length < min
    })
    if (faltaEscolha) { pendentes.push(`${it.nome} (escolha o sabor/opção de novo)`); continue }

    const obs = String(it.observacao ?? "").trim()
    const chave = escolhidos.length > 0 || obs
      ? `${prod.id}_${escolhidos.map(a => a.id).sort().join("+")}${obs ? "_" + obs.slice(0, 20) : ""}`
      : prod.id
    const unidade = {
      id: chave, produto_id: prod.id, nome: prod.nome,
      // mesma regra do cardápio e do servidor: pizza meio a meio cobra só o sabor mais caro
      preco: Number(prod.preco) + precoAdicionais(prod.adicionais, escolhidos),
      loja_id: loja.id, loja_nome: loja.nome, observacao: obs, adicionais: escolhidos,
    }
    itens.push(Array.from({ length: Math.max(1, Number(it.quantidade) || 1) }, () => unidade))
  }
  return { itens, pendentes }
}
