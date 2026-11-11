/**
 * POST /api/pedido/criar
 *
 * Cria um pedido com validação de preço SERVIDOR-SIDE.
 * Nunca confia em subtotal/total/desconto vindos do cliente.
 * Calcula tudo no servidor consultando o banco.
 */
import { precoAdicionais } from "@/lib/precoAdicionais"
import { validarDivisao } from "@/lib/pagamentoDividido"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"
import { calcularTaxaEntregaCompleta, coordsPeloHistorico, distanciaEntregaKm, EnderecoForaDoRaioError } from "@/lib/frete"
import { freteGratisAtivo, freteGratisElegivel, ehCupomFreteAniversario, cupomFreteAniversarioNoPrazo, CUPOM_FRETE_ANIVERSARIO, MSG_CUPOM_FORA_DO_PRAZO, MSG_CUPOM_FORA_DO_RAIO } from "@/lib/freteGratisCampanha"
import { acrescimoDinamico } from "@/lib/corridaDinamica"
import { cupomValeNoRaio } from "@/lib/cupomRaio"
import { jaFezPedido, MSG_SO_PRIMEIRO } from "@/lib/primeiroPedido"
import { chaveBot } from "@/lib/whatsSuporte"
import { descontoPromo, promoAtiva, relampagoAtivo, PROMO_CODIGO, PROMO_MARCA_ID, PROMO_PRODUTOS, RELAMPAGO, ROTULO_CHEGO } from "@/lib/promoChego"
import { promoUsados } from "@/lib/promoChegoServidor"

// Teste do robô: loja fechada no app aceita pedido só quando vem do robô e está em robo_pedidos.abrir_no_whats
async function abertaSoNoWhats(req: NextRequest, sb: ReturnType<typeof adminSb>, lojaId: string) {
  const k = req.headers.get("x-robo-chave") ?? ""
  const certa = chaveBot()
  if (!k || k.length !== certa.length || !crypto.timingSafeEqual(Buffer.from(k), Buffer.from(certa))) return false
  const { data } = await sb.from("configuracoes").select("valor").eq("chave", "robo_pedidos").maybeSingle()
  try { return (JSON.parse(data?.valor ?? "{}").abrir_no_whats ?? []).includes(lojaId) } catch { return false }
}

function adminSb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada")
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Código aleatório criptograficamente seguro (6 chars alfanuméricos) */
function gerarCodigo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // sem 0/O e 1/I para evitar confusão
  const bytes = crypto.randomBytes(6)
  return Array.from(bytes).map(b => chars[b % chars.length]).join("")
}

async function inserirComCodigo(
  sb: ReturnType<typeof adminSb>,
  payload: Record<string, unknown>,
  tentativa = 0
): Promise<{ data: { id: string; codigo: string } | null; error: unknown; codigo: string }> {
  const codigo = gerarCodigo()
  const { data, error } = await sb
    .from("pedidos")
    .insert({ ...payload, codigo })
    .select("id, codigo")
    .single()
  if ((error as any)?.code === "23505" && tentativa < 5)
    return inserirComCodigo(sb, payload, tentativa + 1)
  return { data: data as any, error, codigo }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    loja_id,
    cliente_id,
    items,           // [{ produto_id, quantidade, observacao }]
    forma_pagamento,
    tipo_entrega,    // "entrega" | "retirada"
    endereco_entrega,
    lat_entrega: latBruto,
    lng_entrega: lngBruto,
    cidade_entrega,
    bairro_entrega,
    observacao,
    cupom_codigo,
    nome_cliente,
    telefone_cliente,
    email_cliente,
    troco_para,      // pagamento em dinheiro: valor pra troco (null = sem troco)
    forma_pagamento_2, // pagamento em 2 formas (null = uma forma só)
    valor_pagamento_1, // valor da 1ª forma; a 2ª é calculada aqui (total − 1ª)
    tipo = "normal", // "normal" | "manual"
    zona_rural,      // checkout: "mora em zona rural / estrada de chão?" — ausente (app antigo em cache) = não
    desconto_promo_visto, // promoção Chegô: desconto que o app mostrou (ausente = app antigo, não confere)
  } = body
  const zonaRural = tipo_entrega !== "retirada" && zona_rural === true

  if (!loja_id || !items?.length || !forma_pagamento) {
    return NextResponse.json({ error: "Dados obrigatórios ausentes." }, { status: 400 })
  }

  // Endereço de entrega precisa ter rua e número real (pedido #5VKMCR, 2026-10-06, saiu só
  // com "00 — Condomínio" e o motoboy não achou). O checkout valida campo a campo; aqui é a
  // trava final: 1º trecho "Rua, número" com nome de rua e número que não seja só zeros.
  if (tipo_entrega !== "retirada" && tipo !== "manual") {
    const primeiro = String(endereco_entrega ?? "").split(" — ")[0].trim()
    const partes = primeiro.split(",").map(t => t.trim())
    const num = (partes.length > 1 ? partes[partes.length - 1] : "").toUpperCase().replace(/\s+/g, "")
    const rua = partes.length > 1 ? partes.slice(0, -1).join(",") : primeiro
    const numOk = num === "S/N" || num === "SN" || num === "S.N." || (/\d/.test(num) && !/^0+$/.test(num))
    if (!/[A-Za-zÀ-ú]{3,}/.test(rua.replace(/^Nº/i, "")) || !numOk) {
      return NextResponse.json({ error: "Endereço incompleto: informe rua, número (ou S/N), bairro e um ponto de referência." }, { status: 422 })
    }
  }

  const sb = adminSb()

  // 1. Busca a loja para obter taxa de entrega real
  const { data: loja, error: lojaErr } = await sb
    .from("lojas")
    .select("id, lat, lng, cidade, status, aberto, aceita_retirada, taxa_entrega, valor_minimo")
    .eq("id", loja_id)
    .single()

  if (lojaErr || !loja) return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 })
  if (loja.status !== "ativo") return NextResponse.json({ error: "Loja não está ativa." }, { status: 422 })
  if (!loja.aberto && !(await abertaSoNoWhats(req, sb, loja_id))) return NextResponse.json({ error: "Loja está fechada no momento." }, { status: 422 })
  if (tipo_entrega === "retirada" && !loja.aceita_retirada) {
    return NextResponse.json({ error: "Esta loja não aceita retirada." }, { status: 422 })
  }

  // 2. Busca os preços reais dos produtos no banco (nunca confia no cliente)
  const produtoIds = items.map((i: any) => i.produto_id)
  const { data: produtos, error: prodErr } = await sb
    .from("produtos")
    .select("id, nome, preco, disponivel, loja_id, adicionais")
    .in("id", produtoIds)

  if (prodErr || !produtos?.length) {
    return NextResponse.json({ error: "Produtos não encontrados." }, { status: 404 })
  }

  // Valida que todos os produtos pertencem à loja e estão disponíveis
  for (const item of items) {
    const produto = produtos.find((p: any) => p.id === item.produto_id)
    if (!produto) return NextResponse.json({ error: `Produto ${item.produto_id} não encontrado.` }, { status: 404 })
    if (produto.loja_id !== loja_id) return NextResponse.json({ error: "Produto não pertence a esta loja." }, { status: 422 })
    if (!produto.disponivel) return NextResponse.json({ error: `Produto "${produto.nome}" está indisponível.` }, { status: 422 })
    if (!item.quantidade || item.quantidade < 1) return NextResponse.json({ error: "Quantidade inválida." }, { status: 422 })
  }

  // Limite de unidades por cliente cadastrado, pra produtos promocionais (2026-09-26:
  // "Combo lendário" da categoria "Lord's + Chegô" da Lord's Burguer, máx. 2 por
  // cadastro). Soma o que o cliente já tem em pedidos não cancelados + o que está
  // pedindo agora — sem cliente_id (convidado/pedido manual sem conta) não dá pra
  // identificar "o mesmo cadastro", então não há como aplicar o limite.
  const LIMITE_POR_CLIENTE: Record<string, number> = {
    "37c4f5af-87c9-472e-a958-a7e718761739": 2, // Combo lendário — Lord's Burguer
  }
  if (cliente_id) {
    for (const [produtoLimitadoId, limite] of Object.entries(LIMITE_POR_CLIENTE)) {
      const quantidadeSolicitada = items
        .filter((i: any) => i.produto_id === produtoLimitadoId)
        .reduce((s: number, i: any) => s + Number(i.quantidade), 0)
      if (quantidadeSolicitada === 0) continue

      const { data: pedidosCliente } = await sb
        .from("pedidos")
        .select("id")
        .eq("cliente_id", cliente_id)
        .neq("status", "cancelado")
      const pedidoIds = (pedidosCliente ?? []).map((p: any) => p.id)

      let jaComprado = 0
      if (pedidoIds.length > 0) {
        const { data: itensAnteriores } = await sb
          .from("itens_pedido")
          .select("quantidade")
          .eq("produto_id", produtoLimitadoId)
          .in("pedido_id", pedidoIds)
        jaComprado = (itensAnteriores ?? []).reduce((s: number, i: any) => s + Number(i.quantidade), 0)
      }

      if (jaComprado + quantidadeSolicitada > limite) {
        const produtoNome = produtos.find((p: any) => p.id === produtoLimitadoId)?.nome ?? "este item"
        return NextResponse.json({
          error: jaComprado > 0
            ? `Limite de ${limite} unidades por cliente para "${produtoNome}" — você já pediu ${jaComprado}.`
            : `Limite de ${limite} unidades por cliente para "${produtoNome}".`,
        }, { status: 422 })
      }
    }
  }

  // 3. Calcula subtotal com preços reais do banco — inclusive dos adicionais, nunca
  // confiando no "preco"/"nome" que vêm no body (cliente pode mandar qualquer valor).
  // Preço do adicional é por unidade do item, igual ao que o carrinho já mostra pro
  // cliente (restaurante/[id]/page.tsx: preco = prod.preco + totalAdicionais, somado
  // ao carrinho quantidade vezes) — soma na mesma multiplicação por quantidade abaixo.
  // Mesmo id pode existir em mais de um grupo (Petiscaria, 05/11/2026: "Bacon crocante" no grupo
  // grátis "Escolha até 2 ingredientes" e no "Ingrediente extra (R$ 5,00)"). Antes pegava sempre
  // o 1º do catálogo e o extra saía de graça (pedido NG293R). Agora: o grupo que o app mandou
  // (grupo_id); sem ele (app antigo), o 1º grupo com o id que ainda tem vaga (respeitando o máximo).
  function adicionaisValidados(produto: any, adicionaisPedidos: any[]): { id: string; nome: string; preco: number; grupo_id?: string }[] {
    if (!Array.isArray(adicionaisPedidos) || adicionaisPedidos.length === 0) return []
    const grupos = ((produto.adicionais ?? []) as any[]).filter(e => Array.isArray(e?.itens))
    const avulsos = ((produto.adicionais ?? []) as any[]).filter(e => !Array.isArray(e?.itens))
    const usados = new Map<string, number>()
    const vaga = (g: any) => (usados.get(g.id) ?? 0) < (Number(g.maximo) > 0 ? Number(g.maximo) : Infinity)
    const saida: { id: string; nome: string; preco: number; grupo_id?: string }[] = []
    for (const a of adicionaisPedidos) {
      let g = a?.grupo_id ? grupos.find(x => x.id === a.grupo_id && x.itens.some((i: any) => i.id === a.id)) : undefined
      if (g && !vaga(g)) g = undefined
      g ??= grupos.find(x => x.itens.some((i: any) => i.id === a?.id) && vaga(x))
      if (g) {
        const it = g.itens.find((i: any) => i.id === a.id)
        usados.set(g.id, (usados.get(g.id) ?? 0) + 1)
        saida.push({ id: it.id, nome: it.nome, preco: Number(it.preco) || 0, grupo_id: g.id })
        continue
      }
      const av = avulsos.find(x => x.id === a?.id)
      if (av) saida.push({ id: av.id, nome: av.nome, preco: Number(av.preco) || 0 })
    }
    return saida
  }

  const adicionaisPorItem = new Map<number, { id: string; nome: string; preco: number; grupo_id?: string }[]>()
  const subtotal = items.reduce((sum: number, item: any, idx: number) => {
    const produto = produtos.find((p: any) => p.id === item.produto_id)!
    const reais = adicionaisValidados(produto, item.adicionais)
    adicionaisPorItem.set(idx, reais)
    const precoDosAdicionais = precoAdicionais(produto.adicionais, reais)
    return sum + (Number(produto.preco) + precoDosAdicionais) * Number(item.quantidade)
  }, 0)

  // Promoção Chegô 10% (lib/promoChego): 1ª unidade de cada produto da promoção, uma vez por
  // cadastro na campanha. Preço da unidade com adicionais, na ordem dos itens (igual ao app).
  const temPromo = (promoAtiva() && items.some((i: any) => i.produto_id in PROMO_PRODUTOS)) || (relampagoAtivo() && items.some((i: any) => i.produto_id in RELAMPAGO))
  const usadosPromo = temPromo ? await promoUsados(sb, cliente_id, telefone_cliente) : []
  const promo = temPromo
    ? descontoPromo(items.map((item: any, idx: number) => {
        const produto = produtos.find((p: any) => p.id === item.produto_id)!
        return { produto_id: item.produto_id, quantidade: Number(item.quantidade), preco: Number(produto.preco) + precoAdicionais(produto.adicionais, adicionaisPorItem.get(idx) ?? []) }
      }), usadosPromo)
    : { total: 0, porLinha: new Map<number, number>(), relampago: new Set<number>() }
  // App mostrou um desconto e o servidor calculou outro (campanha acabou, ou o cadastro já usou):
  // não cobra diferente do que o cliente viu, devolve pro app atualizar.
  // Só barra quando o app mostrou MAIS desconto que o servidor; se mostrou menos (app aberto antes de
  // a oferta ser estendida), segue com o desconto do servidor e o cliente paga menos.
  if (desconto_promo_visto != null && Number(desconto_promo_visto) - promo.total > 0.01) {
    return NextResponse.json({
      error: promo.total < Number(desconto_promo_visto)
        ? (promoAtiva() || relampagoAtivo() ? "Você já usou o desconto da promoção Chegô em algum desses produtos, ou a oferta relâmpago acabou. Confira o novo total." : "A promoção Chegô acabou. Confira o novo total.")
        : "O desconto da promoção Chegô mudou. Confira o novo total.",
      promo_desconto: promo.total, promo_usados: usadosPromo,
    }, { status: 409 })
  }

  // Grupo obrigatório (ex: "Escolha o sabor") sem escolha válida → recusa. Antes passava
  // calado e a loja recebia o item sem sabor (bug real 2026-10-09, pedido E92TBV, via
  // "Pedir de novo"; também pega carrinho antigo cujo grupo a loja recriou com ids novos).
  for (const [idx, item] of items.entries()) {
    const produto = produtos.find((p: any) => p.id === item.produto_id)!
    const reais = adicionaisPorItem.get(idx) ?? []
    for (const g of (produto.adicionais ?? []) as any[]) {
      if (!Array.isArray(g?.itens)) continue
      const minimo = Math.max(g.obrigatorio ? 1 : 0, Number(g.minimo) || 0)
      if (minimo > 0 && reais.filter(a => a.grupo_id ? a.grupo_id === g.id : g.itens.some((x: any) => x.id === a.id)).length < minimo) {
        return NextResponse.json({ error: `"${produto.nome}": falta escolher "${g.nome}". Remova o item do carrinho e adicione de novo pelo cardápio.` }, { status: 422 })
      }
    }
  }

  // Pedido mínimo da loja (soma dos produtos, antes de cupom e entrega). Antes só aparecia o
  // aviso na sacola e o pedido passava (Açaíteria Mendonça, mínimo R$ 20, 31/10/2026).
  const minimoLoja = Number((loja as any).valor_minimo) || 0
  if (minimoLoja > 0 && subtotal + 0.001 < minimoLoja) {
    const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    return NextResponse.json({ error: `O pedido mínimo desta loja é ${brl(minimoLoja)}. Faltam ${brl(minimoLoja - subtotal)} em produtos.` }, { status: 422 })
  }

  // Endereço de sempre do cliente: coordenada das entregas anteriores quando a do checkout
  // veio vazia ou longe demais (geocoder errou). Vale pra taxa, cupom e o pino do motoboy.
  const coordsEnt = tipo_entrega === "entrega"
    ? await coordsPeloHistorico(sb, { cliente_id, bairro: bairro_entrega, cidade: cidade_entrega, lat: latBruto ?? null, lng: lngBruto ?? null, loja_lat: loja.lat, loja_lng: loja.lng })
    : { lat: latBruto ?? null, lng: lngBruto ?? null, corrigido: false }
  if (coordsEnt.corrigido) console.log("[frete] coordenada corrigida pelo histórico do cliente", { cliente_id, de: [latBruto, lngBruto], para: [coordsEnt.lat, coordsEnt.lng] })
  const lat_entrega = coordsEnt.lat, lng_entrega = coordsEnt.lng

  // 4. Taxa de entrega — mesma função usada na prévia do checkout (/api/frete/calcular),
  // pra nunca divergir entre o que o cliente vê antes de confirmar e o que é cobrado.
  // (let, não const: cupom frete_gratis zera essa variável e frete_percentual reduz ela mais abaixo)
  let taxa_entrega: number
  const freteDetalhe: { distancia_km?: number | null; fonte?: string } = {}
  try {
    taxa_entrega = await calcularTaxaEntregaCompleta(sb, {
      loja_id,
      loja_lat: loja.lat,
      loja_lng: loja.lng,
      loja_taxa_base: (loja as any).taxa_entrega,
      tipo_entrega,
      lat_entrega,
      lng_entrega,
      cidade_entrega,
      bairro_entrega,
      cliente_id,
      zona_rural: zonaRural,
      exigir_ponto_rural: true,
    }, freteDetalhe)
    if (freteDetalhe.fonte) console.log("[frete]", { loja_id, cidade_entrega, taxa_entrega, ...freteDetalhe })
  } catch (e) {
    if (e instanceof EnderecoForaDoRaioError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    throw e
  }

  // 4b. Frete grátis do aniversário de Aragoiânia (lib/freteGratisCampanha): até 7 km medidos, pago
  // pelo Chegô. A taxa fica gravada cheia (o motoboy ganha igual) e só sai do total do cliente.
  // Cliente com frete fixo não passa pela medição no cálculo acima: mede aqui.
  let freteGratisCampanha = false
  if (tipo_entrega === "entrega" && taxa_entrega > 0 && freteGratisAtivo()) {
    const dist = freteDetalhe.distancia_km ?? await distanciaEntregaKm(loja.lat, loja.lng, lat_entrega ?? null, lng_entrega ?? null)
    freteGratisCampanha = freteGratisElegivel({ distanciaKm: dist, lojaLat: loja.lat, lojaLng: loja.lng, latEntrega: lat_entrega, lngEntrega: lng_entrega })
    console.log("[frete-gratis]", { loja_id, dist, gratis: freteGratisCampanha })
  }

  // 5. Valida e aplica cupom no servidor
  let desconto = 0
  let cupomId: string | null = null
  if (cupom_codigo) {
    // Busca só pelo código — a elegibilidade por loja/raio é decidida em JS logo abaixo,
    // porque um cupom pode valer por loja_id único, por uma lista (lojas_ids) ou global.
    const { data: cupom } = await sb
      .from("cupons")
      .select("id, tipo, valor, pedido_minimo, validade, ativo, usos, max_usos, loja_id, lojas_ids, centro_lat, centro_lng, raio_km, so_primeiro_pedido")
      .eq("codigo", cupom_codigo.toUpperCase().trim())
      .maybeSingle()

    if (cupom && cupom.ativo) {
      const valeParaLoja =
        (!cupom.loja_id && !(cupom.lojas_ids?.length)) || // global — sem restrição de loja
        cupom.loja_id === loja_id ||
        (cupom.lojas_ids ?? []).includes(loja_id)

      const dentroDoRaio = cupomValeNoRaio(cupom, { lat: loja.lat, lng: loja.lng, cidade: (loja as any).cidade ?? null },
        { lat: lat_entrega ?? null, lng: lng_entrega ?? null, cidade: cidade_entrega ?? null })

      // "validade" só tem data, sem hora — vale até o FIM do dia em horário de Brasília,
      // não meia-noite UTC (mesma correção de /api/cupom/validar).
      const expirado = cupom.validade && new Date(cupom.validade + "T23:59:59-03:00") < new Date()
      const lotado   = cupom.max_usos != null && (cupom.usos ?? 0) >= cupom.max_usos
      const minOk    = !cupom.pedido_minimo || subtotal >= cupom.pedido_minimo

      // Cupom de primeiro pedido: só com conta, e nem a conta, nem o telefone cadastrado nela,
      // nem o telefone do pedido podem ter pedido antes (fora cancelados). Recusa com aviso
      // em vez de cobrar sem desconto.
      if (cupom.so_primeiro_pedido) {
        if (!cliente_id) return NextResponse.json({ error: "Entre na sua conta para usar o cupom de primeiro pedido." }, { status: 422 })
        const { data: cadastro } = await sb.from("clientes").select("telefone").eq("id", cliente_id).maybeSingle()
        if (!cadastro) return NextResponse.json({ error: "Entre na sua conta para usar o cupom de primeiro pedido." }, { status: 422 })
        if (await jaFezPedido(sb, telefone_cliente, cliente_id) || await jaFezPedido(sb, cadastro.telefone)) {
          return NextResponse.json({ error: `${MSG_SO_PRIMEIRO} Tire o cupom para finalizar.` }, { status: 422 })
        }
      }

      if (valeParaLoja && dentroDoRaio && !expirado && !lotado && minOk) {
        // Cupom pago pela loja não soma com a promoção da Chegô (o pedido só guarda um cupom e o
        // desconto todo seria cobrado da loja no repasse)
        if (cupom.loja_id && promo.total > 0) {
          return NextResponse.json({ error: "Esse cupom não vale junto com a promoção Chegô. Tire o cupom para finalizar com os 10% da promoção." }, { status: 422 })
        }
        // Cupom ARAGO68 (aniversário): no prazo e até 5 km medidos; vira o mesmo frete grátis pago
        // pelo Chegô da campanha (taxa cheia gravada, fora do total). Fora disso recusa com aviso.
        if (ehCupomFreteAniversario(cupom_codigo) && tipo_entrega === "entrega") {
          if (!cupomFreteAniversarioNoPrazo()) return NextResponse.json({ error: `${MSG_CUPOM_FORA_DO_PRAZO} Tire o cupom para finalizar.` }, { status: 422 })
          if (taxa_entrega > 0 && !freteGratisCampanha) {
            const dist = freteDetalhe.distancia_km ?? await distanciaEntregaKm(loja.lat, loja.lng, lat_entrega ?? null, lng_entrega ?? null)
            const ok = freteGratisElegivel({ distanciaKm: dist, lojaLat: loja.lat, lojaLng: loja.lng, latEntrega: lat_entrega, lngEntrega: lng_entrega, raioKm: CUPOM_FRETE_ANIVERSARIO.raioKm, porCupom: true })
            console.log("[cupom-arago68]", { loja_id, dist, ok })
            if (!ok) return NextResponse.json({ error: `${MSG_CUPOM_FORA_DO_RAIO} Tire o cupom para finalizar.` }, { status: 422 })
            freteGratisCampanha = true
          }
        }
        cupomId = cupom.id
        if (freteGratisCampanha && (cupom.tipo === "frete_gratis" || cupom.tipo === "frete_percentual")) {
          // frete já é grátis pela campanha do Chegô: o cupom não muda nada
        } else if (cupom.tipo === "frete_gratis") {
          taxa_entrega = 0
        } else if (cupom.tipo === "frete_percentual") {
          taxa_entrega = Math.round(taxa_entrega * (1 - cupom.valor / 100) * 100) / 100
        } else {
          desconto = cupom.tipo === "percentual"
            ? Math.round(subtotal * (cupom.valor / 100) * 100) / 100
            : Math.min(cupom.valor, subtotal)
        }
      }
    }
  }

  // Promoção Chegô soma no desconto (pago pela Chegô; a loja recebe pelo preço cheio)
  if (promo.total > 0) desconto = Math.min(subtotal, Math.round((desconto + promo.total) * 100) / 100)

  // 5b. Corrida dinâmica (chuva): acréscimo fixo que o cliente paga e vai inteiro pro motoboy.
  // Fica fora de taxa_entrega pra todo o cálculo atual (piso, cupom, repasse) seguir igual.
  const taxa_dinamica = await acrescimoDinamico(sb, tipo_entrega)

  // 6. Total final (nunca pode ser negativo)
  const total = Math.max(0, subtotal - desconto) + (freteGratisCampanha ? 0 : taxa_entrega) + taxa_dinamica

  // Pagamento em 2 formas: validado aqui, nunca confiando na 2ª parte do cliente.
  const divisao = validarDivisao(forma_pagamento, forma_pagamento_2, valor_pagamento_1, Math.round(total * 100) / 100)
  if (!divisao.ok) return NextResponse.json({ error: divisao.erro }, { status: 400 })
  const partes = divisao.partes
  const valorDinheiro = partes
    ? partes.filter(x => x.forma === "dinheiro").reduce((s, x) => s + x.valor, 0)
    : forma_pagamento === "dinheiro" ? total : 0

  // Troco só faz sentido pagando em dinheiro com valor maior que a parte em dinheiro
  const trocoValido = valorDinheiro > 0 && troco_para != null && Number(troco_para) > valorDinheiro
    ? Math.round(Number(troco_para) * 100) / 100
    : null

  // 7. Gera token secreto do cliente para autenticar subscribe de push
  const cliente_push_token = crypto.randomBytes(32).toString("hex")

  // 8. Insere pedido
  const statusInicial = (partes ? partes.some(x => ["pix", "cartao"].includes(x.forma)) : ["pix", "cartao"].includes(forma_pagamento))
    ? "aguardando_pagamento" : "pendente"

  const { data: pedido, error: pedidoErr, codigo } = await inserirComCodigo(sb, {
    loja_id,
    cliente_id: cliente_id ?? null,
    status: statusInicial,
    forma_pagamento,
    ...(partes ? {
      forma_pagamento_2: partes[1].forma,
      valor_pagamento_1: partes[0].valor,
      valor_pagamento_2: partes[1].valor,
    } : {}),
    tipo,
    subtotal: Math.round(subtotal * 100) / 100,
    taxa_entrega,
    ...(freteGratisCampanha ? { frete_gratis: true, frete_absorvido_por: "app" } : {}),
    // Distância de rota usada no frete (03/11/2026): antes ficava vazia e não dava pra conferir frete errado depois
    ...(freteDetalhe.distancia_km != null ? { distancia_km: freteDetalhe.distancia_km } : {}),
    // Só manda a coluna quando há dinâmica: pedido normal fica idêntico ao de antes
    ...(taxa_dinamica > 0 ? { taxa_dinamica } : {}),
    desconto: Math.round(desconto * 100) / 100,
    cupom_codigo: cupomId ? cupom_codigo?.toUpperCase().trim() : promo.total > 0 ? PROMO_CODIGO : null,
    total: Math.round(total * 100) / 100,
    endereco_entrega: endereco_entrega ?? "",
    lat_entrega: lat_entrega ?? null,
    lng_entrega: lng_entrega ?? null,
    observacao: observacao ?? "",
    troco_para: trocoValido,
    zona_rural: zonaRural,
    cliente_push_token,
    nome_cliente:    nome_cliente    ?? null,
    telefone_cliente: telefone_cliente ?? null,
    email_cliente:   email_cliente   ?? null,
  })

  if (pedidoErr || !pedido) {
    console.error("[pedido/criar] Supabase insert error:", JSON.stringify(pedidoErr))
    return NextResponse.json({ error: "Erro ao criar pedido." }, { status: 500 })
  }

  // 9. Insere itens com preços do banco — adicionais também validados (nunca o que o
  // cliente mandou), senão o cupom impresso/painel admin mostra um preço de adicional
  // diferente do que foi de fato somado no subtotal calculado acima.
  await sb.from("itens_pedido").insert(
    items.map((item: any, idx: number) => {
      const produto = produtos.find((p: any) => p.id === item.produto_id)!
      return {
        pedido_id:  pedido.id,
        produto_id: item.produto_id,
        nome:       produto.nome,
        preco:      Number(produto.preco),
        quantidade: Number(item.quantidade),
        observacao: item.observacao ?? "",
        adicionais: promo.porLinha.has(idx)
          ? [...(adicionaisPorItem.get(idx) ?? []), promo.relampago.has(idx)
            ? { id: PROMO_MARCA_ID, campanha: "relampago", nome: `Oferta Relâmpago Chegô, 1 un.: ${ROTULO_CHEGO} (R$ ${promo.porLinha.get(idx)!.toFixed(2).replace(".", ",")})`, preco: 0, desconto_chego: promo.porLinha.get(idx) }
            : { id: PROMO_MARCA_ID, nome: `Promoção Chegô: 1 un. com 10% off (R$ ${promo.porLinha.get(idx)!.toFixed(2).replace(".", ",")} pago pela Chegô)`, preco: 0, desconto_chego: promo.porLinha.get(idx) }]
          : adicionaisPorItem.get(idx) ?? [],
      }
    })
  )

  // 10. Incrementa uso do cupom (server-side, com service role key) — compare-and-swap: o
  // update só é aceito se "usos" ainda for o mesmo valor lido, senão outro pedido concorrente
  // já incrementou e tentamos de novo com o valor atual (evita passar de max_usos sob
  // concorrência, já que não temos acesso a criar uma função de incremento atômico no banco).
  if (cupomId) {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const { data: cupomAtual } = await sb.from("cupons").select("usos").eq("id", cupomId).single()
      const usosLidos = (cupomAtual as any)?.usos ?? 0
      const { data: atualizado } = await sb
        .from("cupons").update({ usos: usosLidos + 1 })
        .eq("id", cupomId).eq("usos", usosLidos)
        .select("id")
      if (atualizado && atualizado.length > 0) break
    }
  }

  // Rastreia pedido realizado
  void sb.from("acessos_app").insert({ tipo: "pedido" })

  return NextResponse.json({
    ok: true,
    pedido_id: pedido.id,
    codigo: pedido.codigo,
    total: Math.round(total * 100) / 100,
    cliente_push_token,
  })
}
