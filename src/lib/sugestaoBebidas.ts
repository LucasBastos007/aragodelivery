import { diaEMinutosAgoraBrt } from "@/lib/periodoBrt"
import type { Produto, CategoriaProduto } from "@/types"

// Sugestão "Que tal uma bebida?" no carrinho. Não existe marcação de "bebida" no banco —
// cada loja dá o nome que quer pra categoria ("Bebidas", "🥤 Refrigerantes", "Cervejas
// Lata 350ml", "Copão e Doses"…), então a bebida é reconhecida pelo nome da categoria.
const RE_BEBIDA = /(bebid|refri|suco|[aá]gua|cervej|chopp?\b|drink|vinho|espumante|energ[eé]tic|isot[oô]nic|destilad|cacha[cç]a|\bdoses?\b|cop[aã]o|long ?neck|\blatas?\b|garrafa)/i
// Nomes que casam com a regra acima mas não são bebida (vistos no banco em 07/10/2026:
// "LUBRIFICANTE ICE", "Mix Energetico" de suplemento)
const RE_NAO_BEBIDA = /(lubrific|\bmix\b|suplement)/i

export function categoriaEhBebida(nome: string): boolean {
  return RE_BEBIDA.test(nome) && !RE_NAO_BEBIDA.test(nome)
}

/** Categoria de "cardápio do dia" só vale dentro do horário/dias dela (BRT). */
export function categoriaAtivaAgora(cat: CategoriaProduto): boolean {
  if (!cat.cardapio_do_dia) return true
  // sem horário definido = bloqueado indefinidamente
  if (!cat.horario_inicio && !cat.horario_fim) return false
  const { diaSemana, minutos } = diaEMinutosAgoraBrt()
  const horaAtual = `${Math.floor(minutos / 60).toString().padStart(2, "0")}:${(minutos % 60).toString().padStart(2, "0")}`
  const ini = cat.horario_inicio ?? "00:00", fim = cat.horario_fim ?? "23:59"
  // Janela que atravessa a meia-noite (ex.: 17:00 → 09:59, pedido da Dudu Lanches em
  // 2026-10-13: sanduíches trancados das 10h às 17h): vale das 17h até 9h59 do dia seguinte.
  const dentro = ini <= fim ? horaAtual >= ini && horaAtual <= fim : horaAtual >= ini || horaAtual <= fim
  if (!dentro) return false
  const dias = cat.dias_semana ?? []
  return dias.length === 0 || dias.includes(diaSemana)
}

/** Mesmo filtro do cardápio da loja: dia da semana do produto e almoço só 11h–14h (BRT). */
export function produtoDisponivelAgora(p: Produto): boolean {
  const { diaSemana, minutos } = diaEMinutosAgoraBrt()
  if (p.dias_semana && p.dias_semana.length > 0 && !p.dias_semana.includes(diaSemana)) return false
  if (p.ncm === "almoco" && (minutos < 11 * 60 || minutos >= 14 * 60)) return false
  return true
}

// Ordem da sugestão: refri, suco, água, outras sem álcool e álcool por último. Muita loja põe tudo numa
// categoria "Bebidas", então olha o nome do produto junto com o da categoria.
const RE_ALCOOL = /(cervej|chopp?\b|vinho|espumante|whisk|vodka|\bgin\b|cacha[cç]a|pinga|conhaque|destilad|\bdoses?\b|cop[aã]o|\bice\b|long ?neck|skol|brahma|heineken|budweiser|amstel|antar[c]?tica|\boriginal\b|itaipava|bavaria|corona|stella|michelob|spaten|eisenbahn|petra|devassa|\bsol\b|caipirinha|caipiroska|licor|tequila|\brum\b|smirnoff|alco[oó]lic)/i
const RE_REFRI = /(refri|coca|guaran|pepsi|fanta|sprite|kuat|soda|schweppes|t[oô]nica|h2oh)/i
const RE_SUCO = /(suco|del ?valle|la ?fruit|\bmate\b|ch[aá]\b)/i
const RE_AGUA = /([aá]gua|h2o)/i

function prioridadeBebida(p: Produto, nomeCategoria: string): number {
  const semAlcoolNoNome = RE_REFRI.test(p.nome) || RE_SUCO.test(p.nome) || RE_AGUA.test(p.nome)
  if (RE_ALCOOL.test(p.nome) || (RE_ALCOOL.test(nomeCategoria) && !semAlcoolNoNome)) return 4
  const texto = `${p.nome} ${nomeCategoria}`
  // nome do produto manda: "Água Tônica" é refri, "Suco Lata" numa categoria "Refrigerantes" é suco
  for (const [re, n] of [[RE_REFRI, 0], [RE_SUCO, 1], [RE_AGUA, 2]] as const) if (re.test(p.nome)) return n
  for (const [re, n] of [[RE_REFRI, 0], [RE_SUCO, 1], [RE_AGUA, 2]] as const) if (re.test(texto)) return n
  return 3 // energético, creme, drink sem álcool…
}

/** Produto que dá pra pôr no carrinho com um toque: sem escolha obrigatória (ex.: refri
 * "Pepsi ou Guaraná"). Adicionais opcionais ficam de fora, igual ao "+" do cardápio. */
function adicionaDireto(p: Produto): boolean {
  return !(p.adicionais ?? []).some(a => "itens" in a && a.obrigatorio)
}

/**
 * Separa as bebidas do cardápio. `sugerir` = bebidas que dá pra adicionar com um toque,
 * refri → suco → água → outras → álcool; dentro disso, com foto e mais baratas antes. Loja que só vende bebida (adega, depósito)
 * não tem o que sugerir — `lojaSoDeBebida` avisa pra não mostrar.
 */
export function bebidasDoCardapio(categorias: CategoriaProduto[], produtos: Produto[]) {
  const catsBebida = new Set(categorias.filter(c => categoriaEhBebida(c.nome)).map(c => c.id))
  const nomeCat = new Map(categorias.map(c => [c.id, c.nome]))
  const prioridade = (p: Produto) => prioridadeBebida(p, nomeCat.get(p.categoria_id ?? "") ?? "")
  const catsAtivas = new Set(categorias.filter(categoriaAtivaAgora).map(c => c.id))
  const idsBebida = new Set(produtos.filter(p => p.categoria_id && catsBebida.has(p.categoria_id)).map(p => p.id))
  const lojaSoDeBebida = produtos.length > 0 && produtos.every(p => idsBebida.has(p.id))
  const sugerir = produtos
    .filter(p => idsBebida.has(p.id) && p.categoria_id && catsAtivas.has(p.categoria_id) && produtoDisponivelAgora(p) && adicionaDireto(p))
    .sort((a, b) => prioridade(a) - prioridade(b) || Number(!a.foto_url) - Number(!b.foto_url) || a.preco - b.preco)
  return { idsBebida, sugerir, lojaSoDeBebida }
}
