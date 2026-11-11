// Promoção Chegô 10%: 10% num produto de cada loja, pago inteiro pela Chegô.
// 1ª campanha: 05/11/2026, 17h–23h59 (produto escolhido à mão).
// 2ª campanha: 09/11/2026, da ativação até 23h45 (Brasília). Produto = o mais vendido em unidades
// de cada loja ativa (pedidos não cancelados), entre os que estão à venda hoje; loja sem venda
// fica de fora. Lista gerada em 09/11 às 10h.
// Regras do Lucas:
// - só a 1ª unidade do produto tem desconto, e só uma vez por cadastro (cliente_id ou telefone)
//   em cada loja durante a campanha, mesmo em outro pedido; pedido cancelado libera de novo;
// - quem já usou numa loja vê o preço normal dela (app consulta /api/promo/usados);
// - a loja recebe como se vendesse pelo preço cheio: itens_pedido.preco fica o preço cheio,
//   o desconto vai em pedidos.desconto e o pedido sai com cupom_codigo = PROMO_CODIGO quando
//   não tem outro cupom (lib/regrasFinanceiras trata esse código como custo da Chegô);
// - durante a campanha o produto sobe pro topo do cardápio só na tela (nada muda em
//   produtos.ordem), então no fim tudo volta sozinho pro lugar de antes;
// - fora do horário nada aparece e o servidor não dá o desconto.
export const PROMO_CODIGO = "PROMOCHEGO10"
export const PROMO_PCT = 10
export const PROMO_INICIO = "2026-11-09T00:00:00-03:00"
export const PROMO_FIM = "2026-11-09T23:45:00-03:00"
/** Como o fim aparece pro cliente */
export const PROMO_FIM_TEXTO = "hoje até 23h45"
/** Marca gravada nos adicionais do item (preço 0) pra loja e o cupom impresso saberem qual item teve desconto. */
export const PROMO_MARCA_ID = "promo-chego-10"

export const PROMO_PRODUTOS: Record<string, string> = {
  "35ccc92d-064f-4470-a574-9d85110d1b46": "Armazém Gastrobar, Prato do Dia",
  "d2ab9a79-4ed1-4073-9997-a4379d7f9a78": "Atrius Carnes Artesanais, Coxa e Sobrecoxa PCT",
  "3eb568b7-6793-4423-8207-77347613a573": "Açaíteria e Sorveteria Mendonça, Pastel",
  "fb26dd84-eae0-417a-81d2-c5147921fda8": "BELEZA AÇAI DISTRIBUIDORA, Açaí na garrafa com leite condensado",
  "8cfd0fd6-6c9a-4100-a8c8-9a63a59955ff": "BISCOITO DURO CAFE, Coxinha de Frango com Catupiry",
  "b652f832-8db8-423c-97b7-68149860afcd": "Cantinho da Danny, Pastel X tudo",
  "c886d2f3-21f5-4f50-b067-0c0869f008e7": "Casa da Pizza, Pizza Frango com Catupiry",
  "df1e74db-b140-4d41-87a1-7610d96c1f37": "Caseirinhos Marya, Bolo no Pote Brigadeiro com Morango",
  "738fd1de-03a3-4a89-bf1b-e1f289fed7fd": "Dudu Lanches, Monte Seu Pastel",
  "71147c1f-0bb6-41a6-b611-637cc28a9986": "Empório de bebidas puro sangue, Água com gás 500ml",
  "1fbb1394-53ce-43cf-a035-33dbc193e3b9": "Empório Moreira, Coca cola 2L",
  "5eaace29-89d1-49fd-b3e1-836b56290941": "Encantos do Amor, Baralho Hétero Kama Sutra Com 55 Cartas Hard",
  "50a97e9f-6199-4c87-87e9-ef3e7715ed14": "Festiva Pipocas, Pipoca Caramelizada 350ml",
  "ae9a1399-529e-43bf-9a76-606087648bb9": "Festiva Pipocas (Unidade Feira), Monte sua pipoca",
  "e81d17b7-b0e3-487c-82fb-8b754eaf6a2d": "Jantinha Master, Jantinha completa",
  "a7fba259-fff9-4e8a-8863-e0dd4e16fdc3": "LORD'S BURGUER, Vikings",
  "9d24a175-f92b-4110-a08c-aa8bbdff7a1d": "Macarrão da Poly, Monte seu Macarrão",
  "7eab8151-76c3-44c8-8d3e-f21a710a2cd8": "Marmitas do Dudu lanches, Refri 2lt",
  "12230605-7a74-428d-bdb7-507993e02507": "Moreira na brasa, Espetinho com Mandioca",
  "4aaf1155-a3c3-4d7f-bfe5-ccfa194d5aa3": "Padaria Flor de Ipê, Pão francês (50g)",
  "9ad22eef-068f-462f-b816-d89b02441e64": "Pamonharia Cidade Nova, Pamonha de Sal com Queijo",
  "2e3ffe72-1910-4d34-9e17-3f5e422ce535": "Petiscaria Tábua dos Sabores, 41 - Prato Executivo",
  "90d8b998-33cb-4bac-825d-6b8f5887bcb5": "Pizzaria Bom Demais, Pizza Grande",
  "0409c070-26b6-4b3e-a213-514a1e654b14": "Pão de Mel da Cris, Brigadeiro",
  "fe2bcbaf-685a-4c11-82ae-a98172144464": "QUINTAL GASTROBAR E HAMBURGUERIA, X Salada Simples",
  "42fe66f2-efc7-45ae-9fca-03363e41531c": "Requeijão da roça, Requeijão 500g",
  "323d375d-848f-445a-83f2-6ef205f9868d": "Sabor Raiz, Caldo de Costela 500 ml",
  "b84a233d-45c8-4dbf-8cc9-c0d31185b8fb": "Sushi Biscuit, Gunkan Saint Peter (6 unds)",
  "26a31e16-164b-4842-bd6b-4e2e08b3a5a1": "TRILHAS DA AMAZONIA, Copo de Açaí",
  "80810952-2134-4d20-8cc3-ea4f36ba1984": "Wagner Lanches, Creme",
  "d763ef1a-d25e-429d-8d40-24ffcd306097": "Winderson Lanches, Pastel Presunto e Queijo",
}

// Oferta Relâmpago Chegô (09/11/2026, 20h45–21h30, estendida às 21h14): preço final fixo em 5 produtos, a diferença
// paga pela Chegô. Mesma engrenagem dos 10% (1ª unidade, uma vez por cadastro por produto na
// oferta, loja recebe o preço cheio, cupom PROMOCHEGO10 = custo da Chegô); a marca do item leva
// campanha "relampago" pra contar o uso separado. Durante a oferta o produto fica só com ela
// (não soma com os 10%); depois das 21h30 volta a valer só a regra dos 10% até 23h45.
export const RELAMPAGO_INICIO = "2026-11-09T20:45:00-03:00"
export const RELAMPAGO_FIM = "2026-11-09T21:30:00-03:00"
export const RELAMPAGO: Record<string, { nome: string; original: number; promo: number }> = {
  "2e3ffe72-1910-4d34-9e17-3f5e422ce535": { nome: "Petiscaria Tábua dos Sabores, 41 - Prato Executivo", original: 22.99, promo: 10.69 },
  "e0efac93-f3dd-4643-84e2-0b1fe5dd1c44": { nome: "Armazém Gastrobar, Omelete", original: 18.9, promo: 9.99 },
  "1e6d7080-88d2-41fb-8844-fbc5fe205fce": { nome: "Sushi Biscuit, Combo 2x Sushiburguer Patê Salmão Grelhado + Coca Lata", original: 54.89, promo: 44.9 },
  "0390ff98-b2eb-4ef4-a098-542e0a8238d0": { nome: "Jantinha Master, Jantinha com peixe", original: 24, promo: 14 },
  "8060b61e-4733-4b4e-af5c-f8574fd44168": { nome: "Wagner Lanches, Simples", original: 21, promo: 11 },
}
export const ROTULO_CHEGO = "DESCONTO PROMOCIONAL — CUSTEADO PELO CHEGÔ"
export const chaveRelampago = (id: string) => `r:${id}`
export function relampagoAtivo(agora: number = Date.now()): boolean {
  return agora >= new Date(RELAMPAGO_INICIO).getTime() && agora < new Date(RELAMPAGO_FIM).getTime()
}
/** Produto na oferta relâmpago agora e o cadastro ainda não usou? */
export function emRelampago(produtoId?: string | null, agora: number = Date.now(), usados?: Iterable<string>): boolean {
  if (!produtoId || !(produtoId in RELAMPAGO) || !relampagoAtivo(agora)) return false
  return !usados || !new Set(usados).has(chaveRelampago(produtoId))
}
/** Desconto fixo da oferta (preço cheio cadastrado − preço da oferta) e o % arredondado. */
export const descontoRelampago = (id: string) => { const r = RELAMPAGO[id]; return r ? r2(r.original - r.promo) : 0 }
export const pctRelampago = (id: string) => { const r = RELAMPAGO[id]; return r ? Math.round((1 - r.promo / r.original) * 100) : 0 }

const r2 = (v: number) => Math.round(v * 100) / 100

export function promoAtiva(agora: number = Date.now()): boolean {
  return agora >= new Date(PROMO_INICIO).getTime() && agora < new Date(PROMO_FIM).getTime()
}

/** Produto está na promoção agora? (só exibição no app; quem decide o desconto é o servidor) */
export function emPromo(produtoId?: string | null, agora: number = Date.now(), usados?: Iterable<string>): boolean {
  if (!produtoId || !(produtoId in PROMO_PRODUTOS) || !promoAtiva(agora)) return false
  if (produtoId in RELAMPAGO && relampagoAtivo(agora)) return false
  return !usados || !new Set(usados).has(produtoId)
}

export const comPromo = (v: number) => r2(v * (1 - PROMO_PCT / 100))
export const descontoUnidade = (v: number) => r2(v * PROMO_PCT / 100)

/**
 * Desconto da promoção num carrinho/pedido: 10% sobre UMA unidade (preço do item com
 * adicionais) de cada produto da promoção que o cadastro ainda não usou. Pega a 1ª linha
 * do produto na ordem dos itens; app e servidor usam esta mesma função.
 */
export function descontoPromo(
  itens: { produto_id?: string | null; preco: number; quantidade: number }[],
  usados: Iterable<string> = [],
  agora: number = Date.now(),
): { total: number; porLinha: Map<number, number>; relampago: Set<number> } {
  const porLinha = new Map<number, number>()
  const relampago = new Set<number>()
  const ja = new Set(usados)
  const rel = relampagoAtivo(agora), dez = promoAtiva(agora)
  itens.forEach((it, idx) => {
    const id = it.produto_id
    if (!id || it.quantidade < 1) return
    if (rel && id in RELAMPAGO) {
      // Oferta relâmpago: só ela vale pra esse produto enquanto estiver no ar
      const k = chaveRelampago(id)
      if (ja.has(k)) return
      ja.add(k)
      const d = Math.min(descontoRelampago(id), Number(it.preco) || 0)
      if (d > 0) { porLinha.set(idx, r2(d)); relampago.add(idx) }
      return
    }
    if (!dez || !(id in PROMO_PRODUTOS) || ja.has(id)) return
    ja.add(id)
    const d = descontoUnidade(Number(it.preco) || 0)
    if (d > 0) porLinha.set(idx, d)
  })
  return { total: r2(Array.from(porLinha.values()).reduce((s, v) => s + v, 0)), porLinha, relampago }
}
