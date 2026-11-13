// Promoção Chegô 10%: desconto pago inteiro pela Chegô (a loja recebe o preço cheio).
// 1ª campanha: 05/11/2026, 17h–23h59 (produto escolhido à mão).
// 2ª campanha: 09/11/2026, até 23h45, o mais vendido de cada loja (backup em ~/Backups/claude/promo_0911_2026-11-09).
// 3ª campanha, HORA MALUCA (11/11/2026, 5º dia do aniversário de Aragoiânia): 10% nos 4 produtos
// mais vendidos (unidades, entre os disponíveis) de cada loja, em duas rodadas: tarde 16h–17h pras
// lojas que vendem à tarde (as que vendem tarde e noite ficam só na tarde) e noite 19h–20h pras que
// só vendem à noite. Lista aprovada pelo Lucas em 11/11 (sem Pizzaria Bom Demais, Atrius, Encantos,
// Requeijão e Lord's; Sushi e Armazém à noite). Backup da versão anterior em ~/Backups/claude/hora_maluca_2026-11-11.
// Regras do Lucas:
// - UM desconto por loja: só 1 unidade de 1 produto da promoção por cadastro (cliente_id ou
//   telefone) em cada loja; com 2 produtos da promoção na sacola, o desconto fica no de maior
//   desconto. Pedido cancelado ou Pix não pago libera de novo;
// - quem já usou numa loja vê o preço normal dela (app consulta /api/promo/usados);
// - a loja recebe como se vendesse pelo preço cheio: itens_pedido.preco fica o preço cheio,
//   o desconto vai em pedidos.desconto e o pedido sai com cupom_codigo = PROMO_CODIGO quando
//   não tem outro cupom (lib/regrasFinanceiras trata esse código como custo da Chegô);
// - durante a rodada os produtos sobem pro topo do cardápio só na tela (nada muda em
//   produtos.ordem nem em produtos.preco), então no fim tudo volta sozinho pro lugar de antes;
// - fora do horário da rodada nada aparece e o servidor não dá o desconto.
export const PROMO_CODIGO = "PROMOCHEGO10"
export const PROMO_PCT = 10
export const RODADAS = {
  tarde: { inicio: "2026-11-11T16:00:00-03:00", fim: "2026-11-11T17:00:00-03:00", texto: "hoje até 17h" },
  noite: { inicio: "2026-11-11T19:00:00-03:00", fim: "2026-11-11T20:00:00-03:00", texto: "hoje até 20h" },
} as const
export type Rodada = keyof typeof RODADAS
/** Janela do dia inteiro da campanha (conta o uso do cadastro em qualquer rodada) */
export const PROMO_INICIO = RODADAS.tarde.inicio
export const PROMO_FIM = RODADAS.noite.fim
/** Selo do produto na tela */
export const PROMO_SELO = "🚨 HORA MALUCA — 10% OFF"
export const PROMO_TITULO = "🚨 Hora Maluca −10%"
/** Marca gravada nos adicionais do item (preço 0) pra loja e o cupom impresso saberem qual item teve desconto. */
export const PROMO_MARCA_ID = "promo-chego-10"

export const PROMO_ITENS: Record<string, { loja: string; rodada: Rodada; nome: string }> = {
  "eb2130f3-b044-4173-a662-a85e94251057": { loja: "ad77b090-2ef7-45d9-a24f-71fd5a593641", rodada: "tarde", nome: "Açaíteria e Sorveteria Mendonça, Açaí 500 ML" },
  "3eb568b7-6793-4423-8207-77347613a573": { loja: "ad77b090-2ef7-45d9-a24f-71fd5a593641", rodada: "tarde", nome: "Açaíteria e Sorveteria Mendonça, Pastel" },
  "5e58725b-51ea-443c-9c80-147bc03e758e": { loja: "ad77b090-2ef7-45d9-a24f-71fd5a593641", rodada: "tarde", nome: "Açaíteria e Sorveteria Mendonça, Açaí 300 ML" },
  "49074984-02ac-4776-9053-00b1d0c3915f": { loja: "ad77b090-2ef7-45d9-a24f-71fd5a593641", rodada: "tarde", nome: "Açaíteria e Sorveteria Mendonça, Milk-Shake  300 ML" },
  "fb26dd84-eae0-417a-81d2-c5147921fda8": { loja: "9fe32604-7a73-452b-a943-6e5f4abc90ff", rodada: "tarde", nome: "BELEZA AÇAI DISTRIBUIDORA, Açaí na garrafa com leite condensado" },
  "de3f07d4-b5fe-4cd1-89f0-89b424995731": { loja: "9fe32604-7a73-452b-a943-6e5f4abc90ff", rodada: "tarde", nome: "BELEZA AÇAI DISTRIBUIDORA, Açaí Com Banana 2L" },
  "165f7ea2-6499-4b60-a26e-379efbdb68e8": { loja: "9fe32604-7a73-452b-a943-6e5f4abc90ff", rodada: "tarde", nome: "BELEZA AÇAI DISTRIBUIDORA, Açaí Tradicional 1,5 L Fábrica di Açaí" },
  "a32fb3b9-682d-4f06-bf87-ee8aea529073": { loja: "9fe32604-7a73-452b-a943-6e5f4abc90ff", rodada: "tarde", nome: "BELEZA AÇAI DISTRIBUIDORA, Açaí Tradicional 5L" },
  "8cfd0fd6-6c9a-4100-a8c8-9a63a59955ff": { loja: "cea27ae9-1751-4b61-8661-049bcfb55d20", rodada: "tarde", nome: "BISCOITO DURO CAFE, Coxinha de Frango com Catupiry" },
  "0bbd90b7-fa34-4493-bbc1-e7aa339e087f": { loja: "cea27ae9-1751-4b61-8661-049bcfb55d20", rodada: "tarde", nome: "BISCOITO DURO CAFE, Misto Especial" },
  "053f5217-7b7e-4479-be13-09a2d0d00a15": { loja: "cea27ae9-1751-4b61-8661-049bcfb55d20", rodada: "tarde", nome: "BISCOITO DURO CAFE, Coxinha de Carne de Sol com Catupiry" },
  "5f0a16f8-20c1-40d6-b30e-7a62b5fc4aab": { loja: "cea27ae9-1751-4b61-8661-049bcfb55d20", rodada: "tarde", nome: "BISCOITO DURO CAFE, Presunto e Muçarela" },
  "b652f832-8db8-423c-97b7-68149860afcd": { loja: "6f004759-2f57-400b-85e9-f16fd32980bd", rodada: "tarde", nome: "Cantinho da Danny, Pastel X tudo" },
  "427ee473-89b4-4747-8ada-50b7475f0682": { loja: "6f004759-2f57-400b-85e9-f16fd32980bd", rodada: "tarde", nome: "Cantinho da Danny, Pastel de presunto e queijo" },
  "71933400-1157-4721-baf8-8c994b00fecc": { loja: "6f004759-2f57-400b-85e9-f16fd32980bd", rodada: "tarde", nome: "Cantinho da Danny, açaí 330 ml" },
  "3b740301-4fe0-4985-a27b-68dd9d347c0b": { loja: "6f004759-2f57-400b-85e9-f16fd32980bd", rodada: "tarde", nome: "Cantinho da Danny, Açaí 550 ml" },
  "df1e74db-b140-4d41-87a1-7610d96c1f37": { loja: "ac043b92-be24-4857-a879-60d26e2752cf", rodada: "tarde", nome: "Caseirinhos Marya, Bolo no Pote Brigadeiro com Morango" },
  "153b7483-f3d8-48ff-a008-97848ef75dfd": { loja: "ac043b92-be24-4857-a879-60d26e2752cf", rodada: "tarde", nome: "Caseirinhos Marya, Bolo no Pote Ninho com Morango" },
  "fc36b00b-3e54-4660-88b4-3920814b49ac": { loja: "ac043b92-be24-4857-a879-60d26e2752cf", rodada: "tarde", nome: "Caseirinhos Marya, Bombom Aberto de Morango" },
  "5c236ab5-5cfd-4222-bf85-bcf37898178a": { loja: "ac043b92-be24-4857-a879-60d26e2752cf", rodada: "tarde", nome: "Caseirinhos Marya, Bombom Aberto de Uva" },
  "71147c1f-0bb6-41a6-b611-637cc28a9986": { loja: "1344497b-de12-4255-984e-3336bd089122", rodada: "tarde", nome: "Empório de bebidas puro sangue, Água com gás 500ml" },
  "db209ce1-2a90-4beb-8901-b818975d2c05": { loja: "1344497b-de12-4255-984e-3336bd089122", rodada: "tarde", nome: "Empório de bebidas puro sangue, Brahma 259ml cx" },
  "47f47c6c-45b8-49f0-a94e-77d29f70c7a6": { loja: "1344497b-de12-4255-984e-3336bd089122", rodada: "tarde", nome: "Empório de bebidas puro sangue, Coca-Cola 2 litros" },
  "bddf9b91-05a7-499f-84fb-e16aab7660eb": { loja: "1344497b-de12-4255-984e-3336bd089122", rodada: "tarde", nome: "Empório de bebidas puro sangue, La Fruit 1 litro" },
  "1fbb1394-53ce-43cf-a035-33dbc193e3b9": { loja: "04253bd2-c4a7-4210-9c14-8b6c85beb501", rodada: "tarde", nome: "Empório Moreira, Coca cola 2L" },
  "067e28fd-2ad3-4825-8b59-13d320758912": { loja: "04253bd2-c4a7-4210-9c14-8b6c85beb501", rodada: "tarde", nome: "Empório Moreira, Brahma 269ml" },
  "fd24132c-6874-4075-b78e-32b5131ba821": { loja: "04253bd2-c4a7-4210-9c14-8b6c85beb501", rodada: "tarde", nome: "Empório Moreira, Água sem gás 500ml" },
  "183e5f10-5ea2-4c2d-b9b2-dfb877e5123c": { loja: "04253bd2-c4a7-4210-9c14-8b6c85beb501", rodada: "tarde", nome: "Empório Moreira, Brahma 269ml" },
  "4aaf1155-a3c3-4d7f-bfe5-ccfa194d5aa3": { loja: "17599fdf-9fc6-4796-93cc-7a985121f129", rodada: "tarde", nome: "Padaria Flor de Ipê, Pão francês (50g)" },
  "77aeb5c7-7200-44ad-b9e3-cab646e5729e": { loja: "17599fdf-9fc6-4796-93cc-7a985121f129", rodada: "tarde", nome: "Padaria Flor de Ipê, Pão de queijo (30g)" },
  "ee9b9da5-9091-4f05-9975-3577db30b567": { loja: "17599fdf-9fc6-4796-93cc-7a985121f129", rodada: "tarde", nome: "Padaria Flor de Ipê, Misto tudo" },
  "29dd055d-c325-4499-868b-715b5518abb9": { loja: "17599fdf-9fc6-4796-93cc-7a985121f129", rodada: "tarde", nome: "Padaria Flor de Ipê, Pastelão de presunto e queijo" },
  "0409c070-26b6-4b3e-a213-514a1e654b14": { loja: "b390b82a-fb54-4182-b1d9-4d39c3e8a0fb", rodada: "tarde", nome: "Pão de Mel da Cris, Brigadeiro" },
  "43eb256f-210c-48b7-8ad6-87e200ad50f5": { loja: "b390b82a-fb54-4182-b1d9-4d39c3e8a0fb", rodada: "tarde", nome: "Pão de Mel da Cris, Café" },
  "f1a667ca-aa7d-45c8-afb0-ae96a47b5094": { loja: "b390b82a-fb54-4182-b1d9-4d39c3e8a0fb", rodada: "tarde", nome: "Pão de Mel da Cris, Coco" },
  "3d910321-abb5-46aa-b2de-97498653729e": { loja: "b390b82a-fb54-4182-b1d9-4d39c3e8a0fb", rodada: "tarde", nome: "Pão de Mel da Cris, Limão" },
  "891ea4f3-b4df-4a07-81b0-e77ce60e28cb": { loja: "f76edbfd-aeed-49c2-8d50-5074423cfc23", rodada: "tarde", nome: "Salgados e CEA, Enroladinho de Queijo 14un" },
  "d9d57a07-a3d8-45e6-81d7-86b5c4f2d267": { loja: "f76edbfd-aeed-49c2-8d50-5074423cfc23", rodada: "tarde", nome: "Salgados e CEA, Salgadinhos 23 uni" },
  "26a31e16-164b-4842-bd6b-4e2e08b3a5a1": { loja: "0c33fd72-1a5a-48bd-bf9a-dceaae1d500f", rodada: "tarde", nome: "TRILHAS DA AMAZONIA, Copo de Açaí" },
  "f783e78d-9f69-47ad-9998-c83096ea4a16": { loja: "0c33fd72-1a5a-48bd-bf9a-dceaae1d500f", rodada: "tarde", nome: "TRILHAS DA AMAZONIA, Picolés Tradicionais" },
  "01fcd6cc-4cbb-4e61-8cd5-af8905a0c1f8": { loja: "0c33fd72-1a5a-48bd-bf9a-dceaae1d500f", rodada: "tarde", nome: "TRILHAS DA AMAZONIA, Picolés Retro" },
  "47bd64ee-1d83-4b6f-bdc8-20aa9c51a4f9": { loja: "0c33fd72-1a5a-48bd-bf9a-dceaae1d500f", rodada: "tarde", nome: "TRILHAS DA AMAZONIA, Picolés Premium" },
  "a128880c-3c16-432b-bebd-915306d88c3d": { loja: "73d8672b-595b-4c08-8115-b57d508a5320", rodada: "noite", nome: "Armazém Gastrobar, Strogonoff de Frango" },
  "5139d683-342f-4932-8104-61aa3aec469a": { loja: "73d8672b-595b-4c08-8115-b57d508a5320", rodada: "noite", nome: "Armazém Gastrobar, Contra Filé Acebola" },
  "6d480d20-5fe8-4251-989f-ddd4bb504f3c": { loja: "73d8672b-595b-4c08-8115-b57d508a5320", rodada: "noite", nome: "Armazém Gastrobar, Filé de Frango Acebola" },
  "60e63d25-bf6d-43f7-92cb-2ad236f98c71": { loja: "73d8672b-595b-4c08-8115-b57d508a5320", rodada: "noite", nome: "Armazém Gastrobar, Filé de Tilápia" },
  "c886d2f3-21f5-4f50-b067-0c0869f008e7": { loja: "6d17b397-99c1-4377-9400-67a69da65103", rodada: "noite", nome: "Casa da Pizza, Pizza Frango com Catupiry" },
  "74a76ec7-c49f-406c-b958-b75611e2924e": { loja: "6d17b397-99c1-4377-9400-67a69da65103", rodada: "noite", nome: "Casa da Pizza, Pizza Calabresa Especial" },
  "0e98ea15-3840-49bf-b7f5-8cf3874e0656": { loja: "6d17b397-99c1-4377-9400-67a69da65103", rodada: "noite", nome: "Casa da Pizza, Coca cola 2L" },
  "2e50d77e-9205-478c-bec8-9ee0afd07a58": { loja: "6d17b397-99c1-4377-9400-67a69da65103", rodada: "noite", nome: "Casa da Pizza, Pizza 4 Queijos" },
  "738fd1de-03a3-4a89-bf1b-e1f289fed7fd": { loja: "6e2f55c7-59c1-44bb-b20e-5cf68a78c424", rodada: "noite", nome: "Dudu Lanches, Monte Seu Pastel" },
  "9a3b6d5c-92ff-44a1-98b1-d3961eb8be80": { loja: "6e2f55c7-59c1-44bb-b20e-5cf68a78c424", rodada: "noite", nome: "Dudu Lanches, X-Tudo" },
  "9684bc2d-4c55-4787-9dbf-27a1501cec55": { loja: "6e2f55c7-59c1-44bb-b20e-5cf68a78c424", rodada: "noite", nome: "Dudu Lanches, X-Simples" },
  "5d524d5c-1f61-45aa-a4e1-ca93b2621280": { loja: "6e2f55c7-59c1-44bb-b20e-5cf68a78c424", rodada: "noite", nome: "Dudu Lanches, X-Especial + Coca-Cola lata" },
  "e81d17b7-b0e3-487c-82fb-8b754eaf6a2d": { loja: "01fd2afd-8037-4ddd-afb9-f518884eb58d", rodada: "noite", nome: "Jantinha Master, Jantinha completa" },
  "79db5847-6ef8-4797-b880-552495606a8a": { loja: "01fd2afd-8037-4ddd-afb9-f518884eb58d", rodada: "noite", nome: "Jantinha Master, Contra-filé" },
  "7d3783e2-4003-438d-acaf-4916646cdd6c": { loja: "01fd2afd-8037-4ddd-afb9-f518884eb58d", rodada: "noite", nome: "Jantinha Master, Caldão de frango" },
  "079bfbe8-2dfb-4939-a7ad-0a13f0728478": { loja: "01fd2afd-8037-4ddd-afb9-f518884eb58d", rodada: "noite", nome: "Jantinha Master, Frango com bacon" },
  "9d24a175-f92b-4110-a08c-aa8bbdff7a1d": { loja: "294d456a-2eef-416b-9165-9c9b14096c01", rodada: "noite", nome: "Macarrão da Poly, Monte seu Macarrão" },
  "12230605-7a74-428d-bdb7-507993e02507": { loja: "df25e272-d02e-4c1d-a954-e7dfc735ab5e", rodada: "noite", nome: "Moreira na brasa, Espetinho com Mandioca" },
  "c03a9d85-327e-4d5f-ad38-7851cc718aa4": { loja: "df25e272-d02e-4c1d-a954-e7dfc735ab5e", rodada: "noite", nome: "Moreira na brasa, Pão com Espetinho" },
  "3fc3cdfc-7d18-4d8e-a8c0-69041455d1d3": { loja: "df25e272-d02e-4c1d-a954-e7dfc735ab5e", rodada: "noite", nome: "Moreira na brasa, Espetinho" },
  "55c0b6ce-b873-4b39-8f06-14f132209310": { loja: "df25e272-d02e-4c1d-a954-e7dfc735ab5e", rodada: "noite", nome: "Moreira na brasa, Combo Pão com Espetinho + Coca Lata 350ml" },
  "2e3ffe72-1910-4d34-9e17-3f5e422ce535": { loja: "29f50d38-c46f-4274-81c4-9ab3cc1413e9", rodada: "noite", nome: "Petiscaria Tábua dos Sabores, 41 - Prato Executivo" },
  "76fd7fc4-b83f-4232-97b4-0312cc10b588": { loja: "29f50d38-c46f-4274-81c4-9ab3cc1413e9", rodada: "noite", nome: "Petiscaria Tábua dos Sabores, 39 - Espetinho (servidos com mandioca cozida e molho verde da casa)" },
  "9634006e-adcb-416d-bce6-ce9732d2900d": { loja: "29f50d38-c46f-4274-81c4-9ab3cc1413e9", rodada: "noite", nome: "Petiscaria Tábua dos Sabores, 40 - Espetinho Gourmet (Servidos com mandioca e molho verde caseiro.)" },
  "856eea26-9ee4-494f-aa00-d9550b5568dc": { loja: "29f50d38-c46f-4274-81c4-9ab3cc1413e9", rodada: "noite", nome: "Petiscaria Tábua dos Sabores, EXECUTIVO ESPECIAL DE FILÉ DE CONTRA COM FRITAS" },
  "fe2bcbaf-685a-4c11-82ae-a98172144464": { loja: "6b85b3d8-2de0-4897-832a-786228ae5703", rodada: "noite", nome: "QUINTAL GASTROBAR E HAMBURGUERIA, X Salada Simples" },
  "b3f02a52-0ebe-4251-88c6-aa5fec98a3eb": { loja: "6b85b3d8-2de0-4897-832a-786228ae5703", rodada: "noite", nome: "QUINTAL GASTROBAR E HAMBURGUERIA, Gourmet Cheddar Supremo" },
  "8ff237bb-a5da-4b47-b4ca-7c8bf214f65d": { loja: "6b85b3d8-2de0-4897-832a-786228ae5703", rodada: "noite", nome: "QUINTAL GASTROBAR E HAMBURGUERIA, X-Tudo" },
  "9e6a5e2e-9eac-499b-a6d9-d5a3d0341a08": { loja: "6b85b3d8-2de0-4897-832a-786228ae5703", rodada: "noite", nome: "QUINTAL GASTROBAR E HAMBURGUERIA, X-Bacon" },
  "323d375d-848f-445a-83f2-6ef205f9868d": { loja: "dd7bf546-aca8-485c-9d2a-c09002b28563", rodada: "noite", nome: "Sabor Raiz, Caldo de Costela 500 ml" },
  "2bc5b089-6909-40f9-824d-414708623f7a": { loja: "dd7bf546-aca8-485c-9d2a-c09002b28563", rodada: "noite", nome: "Sabor Raiz, Caldo de Frango 500 ml" },
  "9772b128-b8cc-4ac6-950c-b078ecb53f0a": { loja: "dd7bf546-aca8-485c-9d2a-c09002b28563", rodada: "noite", nome: "Sabor Raiz, Chica Doida" },
  "c7ed6081-0034-468d-9199-2a1927088447": { loja: "dd7bf546-aca8-485c-9d2a-c09002b28563", rodada: "noite", nome: "Sabor Raiz, Fricassê de Frango" },
  "b84a233d-45c8-4dbf-8cc9-c0d31185b8fb": { loja: "c4f7b62b-bf2c-4c4d-9118-2b309902d648", rodada: "noite", nome: "Sushi Biscuit, Gunkan Saint Peter (6 unds)" },
  "c5e66745-f82c-4391-98a1-028d31f3f73a": { loja: "c4f7b62b-bf2c-4c4d-9118-2b309902d648", rodada: "noite", nome: "Sushi Biscuit, Gunkan Salmão Cheese (6 unds)" },
  "22dd15de-f6ec-4180-bd68-20a45f8e7f04": { loja: "c4f7b62b-bf2c-4c4d-9118-2b309902d648", rodada: "noite", nome: "Sushi Biscuit, Combo 50 peças. Brinde: 12 Hot crispy de couve" },
  "3631b601-1c3a-464b-a1f6-262262de0846": { loja: "c4f7b62b-bf2c-4c4d-9118-2b309902d648", rodada: "noite", nome: "Sushi Biscuit, Filadélfia (180g)" },
  "29ca6147-3886-4a93-8eda-22fcd19c8a0f": { loja: "8c7251ad-c533-481e-98b0-50d86af33a13", rodada: "noite", nome: "TEMPERO DA NILMA, Monte seu macarrão" },
  "93fd507a-0c18-41af-879e-3915b7fa72e9": { loja: "8c7251ad-c533-481e-98b0-50d86af33a13", rodada: "noite", nome: "TEMPERO DA NILMA, Panelinha Tradicional da casa" },
  "80810952-2134-4d20-8cc3-ea4f36ba1984": { loja: "7ffb51e8-60d1-4f75-8e36-95cc920f4cfe", rodada: "noite", nome: "Wagner Lanches, Creme" },
  "c04d1bd4-9736-4688-bc78-c878909aca8e": { loja: "7ffb51e8-60d1-4f75-8e36-95cc920f4cfe", rodada: "noite", nome: "Wagner Lanches, X-Tudo" },
  "e3a15945-f065-4179-a014-e09fe25f5b1b": { loja: "7ffb51e8-60d1-4f75-8e36-95cc920f4cfe", rodada: "noite", nome: "Wagner Lanches, Refrigerante 2 Litros" },
  "b25e4105-409d-43b9-9b10-494ecc07d8fd": { loja: "7ffb51e8-60d1-4f75-8e36-95cc920f4cfe", rodada: "noite", nome: "Wagner Lanches, Bacon Especial" },
  "d763ef1a-d25e-429d-8d40-24ffcd306097": { loja: "bf26366c-6ffb-48bf-b824-354c54c1b57b", rodada: "noite", nome: "Winderson Lanches, Pastel Presunto e Queijo" },
  "b81308e9-4529-4815-850b-05fc043a613d": { loja: "bf26366c-6ffb-48bf-b824-354c54c1b57b", rodada: "noite", nome: "Winderson Lanches, X-Tudo" },
  "eafad628-4ffe-4219-8b0f-395d44f1d0db": { loja: "bf26366c-6ffb-48bf-b824-354c54c1b57b", rodada: "noite", nome: "Winderson Lanches, Creme" },
  "cafb64e4-57ae-437f-b917-598fa04296b3": { loja: "bf26366c-6ffb-48bf-b824-354c54c1b57b", rodada: "noite", nome: "Winderson Lanches, Pastel Frango e Catupiry" },
}
export const PROMO_PRODUTOS: Record<string, string> = Object.fromEntries(Object.entries(PROMO_ITENS).map(([id, i]) => [id, i.nome]))
/** Horários em que alguma rodada começa ou acaba (a tela se atualiza sozinha nessas viradas) */
export const PROMO_VIRADAS = Object.values(RODADAS).flatMap(r => [r.inicio, r.fim])
export const chaveLoja = (lojaId: string) => `l:${lojaId}`
const rodadaNoAr = (r: Rodada, agora: number) => agora >= new Date(RODADAS[r].inicio).getTime() && agora < new Date(RODADAS[r].fim).getTime()
/** Produto da promoção com a rodada dele no ar agora */
export function produtoNoAr(id?: string | null, agora: number = Date.now()): boolean {
  const it = id ? PROMO_ITENS[id] : undefined
  return !!it && rodadaNoAr(it.rodada, agora)
}
/** "hoje até 17h" / "hoje até 20h" */
export const fimTexto = (id?: string | null) => { const it = id ? PROMO_ITENS[id] : undefined; return it ? RODADAS[it.rodada].texto : "" }
/** Compatibilidade: textos antigos */
export const PROMO_FIM_TEXTO = "só durante a Hora Maluca"

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
  return (Object.keys(RODADAS) as Rodada[]).some(r => rodadaNoAr(r, agora))
}

/** Produto está na promoção agora? (só exibição no app; quem decide o desconto é o servidor) */
export function emPromo(produtoId?: string | null, agora: number = Date.now(), usados?: Iterable<string>): boolean {
  if (!produtoId || !produtoNoAr(produtoId, agora)) return false
  if (produtoId in RELAMPAGO && relampagoAtivo(agora)) return false
  if (!usados) return true
  const u = new Set(usados)
  return !u.has(produtoId) && !u.has(chaveLoja(PROMO_ITENS[produtoId].loja))
}

export const comPromo = (v: number) => r2(v * (1 - PROMO_PCT / 100))
export const descontoUnidade = (v: number) => r2(v * PROMO_PCT / 100)

/**
 * Desconto da promoção num carrinho/pedido: 10% sobre UMA unidade (preço do item com
 * adicionais) de UM produto da promoção por loja, se o cadastro ainda não usou nessa loja.
 * Com mais de um produto da promoção, fica na linha de maior desconto. App e servidor usam
 * esta mesma função.
 */
export function descontoPromo(
  itens: { produto_id?: string | null; preco: number; quantidade: number }[],
  usados: Iterable<string> = [],
  agora: number = Date.now(),
): { total: number; porLinha: Map<number, number>; relampago: Set<number> } {
  const porLinha = new Map<number, number>()
  const relampago = new Set<number>()
  const ja = new Set(usados)
  const rel = relampagoAtivo(agora)
  const melhorPorLoja = new Map<string, { idx: number; d: number }>()
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
    if (!produtoNoAr(id, agora) || ja.has(id)) return
    const loja = PROMO_ITENS[id].loja
    if (ja.has(chaveLoja(loja))) return
    const d = descontoUnidade(Number(it.preco) || 0)
    const atual = melhorPorLoja.get(loja)
    if (d > 0 && (!atual || d > atual.d)) melhorPorLoja.set(loja, { idx, d })
  })
  melhorPorLoja.forEach(({ idx, d }) => porLinha.set(idx, d))
  return { total: r2(Array.from(porLinha.values()).reduce((s, v) => s + v, 0)), porLinha, relampago }
}
