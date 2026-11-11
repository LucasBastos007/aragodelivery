export const dynamic = "force-dynamic"
import { precoAdicionais } from "@/lib/precoAdicionais"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"
import { requireLoja, unauthorized } from "@/lib/session"
import { calcularTaxaEntregaCompleta, EnderecoForaDoRaioError } from "@/lib/frete"

// "Pedido da loja" (pedido do usuário, 2026-10-04): o lojista lança um pedido que recebeu
// por fora (WhatsApp/telefone) escolhendo os itens do PRÓPRIO cardápio. Vira um pedido
// normal da tabela `pedidos` (tipo "loja", código com prefixo AV), criado já em
// "preparando" — segue o mesmo fluxo de um pedido do app no painel (Pronto → Chamar
// motoboy), entra igual no fechamento/comissão/saldo, e aparece pro motoboy como corrida
// normal. Substitui o fluxo antigo de entrega avulsa (que chamava motoboy na criação).

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const FORMAS = ["dinheiro", "maquininha", "pix_loja"] as const

/** Código "AV" + 4 dígitos (mantém a inicial das avulsas) — único entre pedidos e avulsas antigas. */
async function codigoLivre(sb: ReturnType<typeof adminSb>): Promise<string | null> {
  for (let i = 0; i < 15; i++) {
    const codigo = `AV${crypto.randomInt(1000, 10000)}`
    const [{ count: emPedidos }, { count: emAvulsas }] = await Promise.all([
      sb.from("pedidos").select("id", { count: "exact", head: true }).eq("codigo", codigo),
      sb.from("entregas_avulsas").select("id", { count: "exact", head: true }).eq("codigo", codigo),
    ])
    if (!emPedidos && !emAvulsas) return codigo
  }
  return null
}

export async function POST(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()
  const loja_id = sess.loja_id

  const body = await req.json().catch(() => ({}))
  const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const cliente_nome = txt(body.cliente_nome)
  const cliente_tel = txt(body.cliente_tel)
  const endereco = txt(body.endereco)
  const bairro = txt(body.bairro)
  const cidade = txt(body.cidade)
  const referencia = txt(body.referencia)
  const observacao = txt(body.observacao)
  const forma_pagamento = body.forma_pagamento as (typeof FORMAS)[number]
  const itens = body.itens

  if (!cliente_nome) return NextResponse.json({ error: "Informe o nome do cliente" }, { status: 400 })
  if (cliente_tel.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Informe o telefone do cliente com DDD" }, { status: 400 })
  if (!cidade) return NextResponse.json({ error: "Informe o município" }, { status: 400 })
  if (!endereco) return NextResponse.json({ error: "Informe o endereço de entrega" }, { status: 400 })
  if (!referencia) return NextResponse.json({ error: "Informe o ponto de referência" }, { status: 400 })
  if (!Array.isArray(itens) || itens.length === 0) return NextResponse.json({ error: "Adicione os itens do pedido" }, { status: 400 })
  if (!FORMAS.includes(forma_pagamento)) return NextResponse.json({ error: "Informe a forma de pagamento" }, { status: 400 })
  const tipo_maquininha = body.tipo_maquininha === "debito" ? "debito" : body.tipo_maquininha === "credito" ? "credito" : null
  if (forma_pagamento === "maquininha" && !tipo_maquininha) return NextResponse.json({ error: "Informe se a maquininha é crédito ou débito" }, { status: 400 })

  const coordOk = typeof body.cliente_lat === "number" && typeof body.cliente_lng === "number"
    && Math.abs(body.cliente_lat) <= 90 && Math.abs(body.cliente_lng) <= 180
  const lat_entrega: number | null = coordOk ? body.cliente_lat : null
  const lng_entrega: number | null = coordOk ? body.cliente_lng : null

  const sb = adminSb()
  const { data: loja } = await sb.from("lojas")
    .select("nome, plano, status, lat, lng, taxa_entrega, entrega_avulsa_liberada")
    .eq("id", loja_id).single()
  if (!loja || loja.status !== "ativo") return NextResponse.json({ error: "Loja não está ativa" }, { status: 403 })
  if (!loja.entrega_avulsa_liberada && (!loja.plano || loja.plano === "gold")) {
    return NextResponse.json({ error: "Plano não inclui pedido da loja" }, { status: 403 })
  }

  // Itens: preço e adicionais sempre do banco, só do cardápio da própria loja.
  const { data: produtos } = await sb.from("produtos")
    .select("id, nome, preco, disponivel, loja_id, adicionais")
    .in("id", itens.map((i: any) => i?.produto_id).filter(Boolean))
  const itensValidados: { produto_id: string; nome: string; preco: number; quantidade: number; observacao: string; adicionais: { id: string; nome: string; preco: number }[]; precoAd: number }[] = []
  for (const item of itens) {
    const produto = (produtos ?? []).find((p: any) => p.id === item?.produto_id)
    if (!produto || produto.loja_id !== loja_id) return NextResponse.json({ error: "Item não encontrado no cardápio da loja" }, { status: 422 })
    if (!produto.disponivel) return NextResponse.json({ error: `"${produto.nome}" está indisponível no cardápio` }, { status: 422 })
    const quantidade = Math.floor(Number(item.quantidade))
    if (!quantidade || quantidade < 1 || quantidade > 99) return NextResponse.json({ error: "Quantidade inválida" }, { status: 422 })
    const catalogo: { id: string; nome: string; preco: number }[] = []
    for (const entry of produto.adicionais ?? []) {
      if (Array.isArray(entry.itens)) catalogo.push(...entry.itens)
      else catalogo.push(entry)
    }
    const adicionais = (Array.isArray(item.adicionais) ? item.adicionais : [])
      .map((a: any) => catalogo.find(c => c.id === (typeof a === "string" ? a : a?.id)))
      .filter(Boolean)
      .map((a: any) => ({ id: a.id, nome: a.nome, preco: Number(a.preco) }))
    itensValidados.push({ produto_id: produto.id, nome: produto.nome, preco: Number(produto.preco), quantidade, observacao: txt(item.observacao).slice(0, 200), adicionais, precoAd: precoAdicionais(produto.adicionais, adicionais) })
  }
  const subtotal = Math.round(itensValidados.reduce((s, i) =>
    s + (i.preco + i.precoAd) * i.quantidade, 0) * 100) / 100

  // Taxa — mesma função dos pedidos do app.
  let taxa_entrega: number
  try {
    taxa_entrega = await calcularTaxaEntregaCompleta(sb, {
      loja_id, loja_lat: loja.lat, loja_lng: loja.lng, loja_taxa_base: (loja as any).taxa_entrega,
      tipo_entrega: "entrega", lat_entrega, lng_entrega, cidade_entrega: cidade, bairro_entrega: bairro,
    })
  } catch (e) {
    if (e instanceof EnderecoForaDoRaioError) return NextResponse.json({ error: e.message }, { status: 400 })
    throw e
  }
  const total = Math.round((subtotal + taxa_entrega) * 100) / 100

  const trocoNum = Number(body.troco_para)
  const troco_para = forma_pagamento === "dinheiro" && body.troco_para != null && trocoNum > total
    ? Math.round(trocoNum * 100) / 100 : null

  // Mesmo formato da observação do checkout — o app do motoboy lê "💳 Maquininha: Crédito/
  // Débito" daqui (não existe coluna própria lida por ele).
  const observacaoFinal = [
    `Cliente: ${cliente_nome}`,
    `Tel: ${cliente_tel}`,
    forma_pagamento === "maquininha" ? `💳 Maquininha: ${tipo_maquininha === "credito" ? "Crédito" : "Débito"}` : "",
    forma_pagamento === "pix_loja" ? "✅ Pix já pago direto à loja" : "",
    observacao,
  ].filter(Boolean).join(" | ")
  const endereco_entrega = `${[endereco, bairro, cidade].filter(Boolean).join(", ")} — Ref: ${referencia}`

  const codigo = await codigoLivre(sb)
  if (!codigo) return NextResponse.json({ error: "Não foi possível gerar o código do pedido. Tente de novo." }, { status: 500 })

  const agora = new Date().toISOString()
  const { data: pedido, error } = await sb.from("pedidos").insert({
    loja_id,
    codigo,
    tipo: "loja",
    status: "preparando",
    aceito_em: agora,
    forma_pagamento,
    tipo_cartao_entrega: tipo_maquininha,
    troco_para,
    subtotal,
    taxa_entrega,
    desconto: 0,
    total,
    endereco_entrega,
    lat_entrega,
    lng_entrega,
    observacao: observacaoFinal,
    nome_cliente: cliente_nome,
    telefone_cliente: cliente_tel,
    cliente_push_token: crypto.randomBytes(16).toString("hex"),
    ...(loja.lat != null && loja.lng != null ? { loja_lat: loja.lat, loja_lng: loja.lng } : {}),
  }).select("*").single()

  if (error || !pedido) {
    console.error("[pedido-loja] insert:", error?.message)
    return NextResponse.json({ error: "Erro ao criar o pedido" }, { status: 500 })
  }

  const { data: itensGravados, error: itensErr } = await sb.from("itens_pedido").insert(
    itensValidados.map(i => ({ pedido_id: pedido.id, produto_id: i.produto_id, nome: i.nome, preco: i.preco, quantidade: i.quantidade, observacao: i.observacao, adicionais: i.adicionais }))
  ).select("*")
  if (itensErr) {
    // Sem itens o pedido não serve (cupom/painel/relatório) — desfaz pra não deixar órfão.
    await sb.from("pedidos").delete().eq("id", pedido.id)
    console.error("[pedido-loja] itens:", itensErr.message)
    return NextResponse.json({ error: "Erro ao gravar os itens do pedido" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, pedido: { ...pedido, itens: itensGravados ?? [] } })
}
