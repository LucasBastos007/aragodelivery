import { precoAdicionais } from "@/lib/precoAdicionais"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"
import { notificarMotoboysDisponiveisAvulsa } from "@/lib/notificacoesMotoboy"
import { calcularTaxaEntregaCompleta, EnderecoForaDoRaioError } from "@/lib/frete"

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function gerarCodigo() {
  return `AV${Math.floor(1000 + Math.random() * 9000)}`
}

export async function POST(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()
  const loja_id = sess.loja_id

  try {
    const body = await req.json()
    const { cliente_nome, cliente_tel, endereco, observacao, cidade, bairro, referencia, itens } = body
    // Coordenada fora do intervalo válido (já chegou lat=84,2 do geocoder) = sem coordenada
    const coordOk = typeof body.cliente_lat === "number" && typeof body.cliente_lng === "number"
      && Math.abs(body.cliente_lat) <= 90 && Math.abs(body.cliente_lng) <= 180
    const cliente_lat: number | null = coordOk ? body.cliente_lat : null
    const cliente_lng: number | null = coordOk ? body.cliente_lng : null

    // Obrigatórios (pedido do usuário, 2026-10-04): nome, telefone, endereço e ponto de
    // referência — sem isso o motoboy chega no local sem saber quem/onde procurar.
    const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "")
    if (!txt(cliente_nome)) return NextResponse.json({ error: "Informe o nome do cliente" }, { status: 400 })
    if (String(cliente_tel ?? "").replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Informe o telefone do cliente com DDD" }, { status: 400 })
    if (!txt(endereco)) return NextResponse.json({ error: "Informe o endereço de entrega" }, { status: 400 })
    if (!txt(referencia)) return NextResponse.json({ error: "Informe o ponto de referência" }, { status: 400 })
    if (!Array.isArray(itens) || itens.length === 0) return NextResponse.json({ error: "Adicione os itens do pedido" }, { status: 400 })

    const { data: loja } = await admin
      .from("lojas").select("nome, plano, status, lat, lng, taxa_entrega, comissao, entrega_avulsa_liberada").eq("id", loja_id).single()

    if (!loja || loja.status !== "ativo") {
      return NextResponse.json({ error: "Loja não está ativa" }, { status: 403 })
    }
    if (!loja.entrega_avulsa_liberada && (!loja.plano || loja.plano === "gold")) {
      return NextResponse.json({ error: "Plano não inclui entrega avulsa" }, { status: 403 })
    }

    // Itens do cardápio da própria loja — preço (e adicionais) sempre do banco, nunca do
    // body, mesma regra de /api/pedido/criar. É isso que permite cobrar a comissão da
    // Chegô sobre a avulsa (antes o "valor do pedido" era digitado à mão e não entrava em
    // comissão nenhuma).
    const { data: produtos } = await admin.from("produtos")
      .select("id, nome, preco, disponivel, loja_id, adicionais")
      .in("id", itens.map((i: any) => i?.produto_id).filter(Boolean))
    const itensValidados: { produto_id: string; nome: string; preco: number; quantidade: number; adicionais: { id: string; nome: string; preco: number }[]; observacao: string; precoAd: number }[] = []
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
      itensValidados.push({ produto_id: produto.id, nome: produto.nome, preco: Number(produto.preco), quantidade, adicionais, observacao: txt(item.observacao).slice(0, 200), precoAd: precoAdicionais(produto.adicionais, adicionais) })
    }
    const subtotal_itens = Math.round(itensValidados.reduce((s, i) =>
      s + (i.preco + i.precoAd) * i.quantidade, 0) * 100) / 100
    const comissao_pct = Number(loja.comissao ?? 0)
    const comissao_valor = Math.round(subtotal_itens * comissao_pct) / 100

    // Taxa calculada aqui com a MESMA função dos pedidos normais (tabela de bairro/município
    // da loja, distância real de rota) — nunca o valor que vem da tela. Antes a página
    // calculava sozinha a partir do centro do município e a taxa saía quase sempre a mínima.
    let taxa_entrega: number
    try {
      taxa_entrega = await calcularTaxaEntregaCompleta(admin, {
        loja_id,
        loja_lat: loja.lat,
        loja_lng: loja.lng,
        loja_taxa_base: (loja as any).taxa_entrega,
        tipo_entrega: "entrega",
        lat_entrega: cliente_lat,
        lng_entrega: cliente_lng,
        cidade_entrega: typeof cidade === "string" ? cidade : "",
        bairro_entrega: typeof bairro === "string" ? bairro : "",
      })
    } catch (e) {
      if (e instanceof EnderecoForaDoRaioError) return NextResponse.json({ error: e.message }, { status: 400 })
      throw e
    }

    const { data: entrega, error } = await admin
      .from("entregas_avulsas")
      .insert({
        loja_id,
        loja_nome:    loja.nome    || null,
        loja_lat:     loja.lat     ?? null,
        loja_lng:     loja.lng     ?? null,
        cliente_nome,
        cliente_tel:  cliente_tel  || "",
        endereco,
        valor_pedido: subtotal_itens,
        itens:        itensValidados.map(({ precoAd: _p, ...i }) => i), // grava igual a antes (sem o campo auxiliar)
        subtotal_itens,
        comissao_pct,
        comissao_valor,
        referencia:   txt(referencia),
        taxa_entrega,
        observacao:   observacao   || "",
        status:       "aguardando",
        codigo:       gerarCodigo(),
        cliente_lat:  cliente_lat  ?? null,
        cliente_lng:  cliente_lng  ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notifica TODOS os motoboys disponíveis simultaneamente
    notificarMotoboysDisponiveisAvulsa(admin, {
      avulsa_id: entrega.id,
      codigo: entrega.codigo,
      taxa_entrega,
    }).catch(() => {})

    return NextResponse.json({ ok: true, entrega })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()
  const loja_id = sess.loja_id

  const { data, error } = await admin
    .from("entregas_avulsas")
    .select("*")
    .eq("loja_id", loja_id)
    .order("criado_em", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entregas: data })
}
