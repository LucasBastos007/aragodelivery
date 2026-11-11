// "Mais pedidos" de uma loja (20/10/2026): a MESMA regra na página da loja e na vitrine
// "Pra matar a fome agora" do Início (pedido do Lucas: a vitrine só mostra os mais pedidos de cada loja).
//  1) promoção "de/por" (preco_antigo maior que o preço) sempre em 1º;
//     logo depois, o prato do dia (produto marcado pra um dia só da semana, no dia dele), mesmo em
//     loja com poucos produtos, como as marmitas (pedido do Lucas, 21/10/2026);
//  2) os que a loja marcou como destaque (se marcou 2 ou mais), na ordem dela;
//  3) senão, do cardápio (ordenado por preço e nome): com foto, comida antes de bebida
//     (loja da categoria "Bebidas" continua destacando bebida).
// Recebe os produtos disponíveis da loja ordenados por preço e nome, como a página da loja carrega.
import { categoriaEhBebida } from "@/lib/sugestaoBebidas"

type P = { id: string; preco: number | string; preco_antigo?: number | string | null; ncm?: string | null; foto_url?: string | null; categoria_id?: string | null; ordem?: number | null; dias_semana?: number[] | null }
// Dia da semana em Brasília (0 = domingo)
const diaBrt = () => new Date(Date.now() - 3 * 3600_000).getUTCDay()

function base<T extends P>(produtos: T[], categorias: { id: string; nome: string }[], lojaCategoria?: string | null): T[] {
  if (produtos.length < 4) return []
  const marcados = produtos.filter(p => p.ncm === "destaque").sort((a, b) => Number(a.ordem ?? 99) - Number(b.ordem ?? 99))
  if (marcados.length >= 2) return marcados.slice(0, 6)
  const catsBebida = new Set(categorias.filter(c => categoriaEhBebida(c.nome)).map(c => c.id))
  const ehBebida = (p: T) => !!p.categoria_id && catsBebida.has(p.categoria_id)
  const comFoto = produtos.filter(p => p.foto_url)
  const lista = comFoto.length >= 3 ? comFoto : produtos
  return lojaCategoria === "Bebidas" ? lista.slice(0, 6) : [...lista.filter(p => !ehBebida(p)), ...lista.filter(ehBebida)].slice(0, 6)
}

export function maisPedidos<T extends P>(produtos: T[], categorias: { id: string; nome: string }[], lojaCategoria?: string | null): T[] {
  const promo = produtos.filter(p => Number(p.preco_antigo) > Number(p.preco))
  const hoje = diaBrt()
  const doDia = produtos.filter(p => p.dias_semana?.length === 1 && p.dias_semana[0] === hoje && p.foto_url && !promo.some(x => x.id === p.id))
  const frente = [...promo, ...doDia]
  const resto = base(produtos, categorias, lojaCategoria).filter(p => !frente.some(x => x.id === p.id))
  return frente.length ? [...frente, ...resto].slice(0, 6) : resto
}
