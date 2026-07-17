/**
 * POST /api/pedido/criar
 *
 * Cria um pedido com validação de preço SERVIDOR-SIDE.
 * Nunca confia em subtotal/total/desconto vindos do cliente.
 * Calcula tudo no servidor consultando o banco.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calcularTaxaEntrega(latLoja: number | null, lngLoja: number | null, latCliente: number | null, lngCliente: number | null, base = 6.00): number {
  if (!latLoja || !lngLoja || !latCliente || !lngCliente) return base
  const dist = haversineKm(latLoja, lngLoja, latCliente, lngCliente)
  if (dist <= 6) return base
  return Math.round((base + (dist - 6) * 1.00) * 100) / 100
}

function normalizar(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
}

function buscarTabelaFrete(tabela: { municipio: string; taxa: number }[], nome: string): number | null {
  if (!nome) return null
  const n = normalizar(nome)
  for (const entry of tabela) {
    const e = normalizar(entry.municipio)
    if (n.includes(e) || e.includes(n)) return entry.taxa
  }
  return null
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
    lat_entrega,
    lng_entrega,
    cidade_entrega,
    bairro_entrega,
    observacao,
    cupom_codigo,
    nome_cliente,
    telefone_cliente,
    email_cliente,
    tipo = "normal", // "normal" | "manual"
  } = body

  if (!loja_id || !items?.length || !forma_pagamento) {
    return NextResponse.json({ error: "Dados obrigatórios ausentes." }, { status: 400 })
  }

  const sb = adminSb()

  // 1. Busca a loja para obter taxa de entrega real
  const { data: loja, error: lojaErr } = await sb
    .from("lojas")
    .select("id, lat, lng, status, aberto, aceita_retirada, taxa_entrega")
    .eq("id", loja_id)
    .single()

  if (lojaErr || !loja) return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 })
  if (loja.status !== "ativo") return NextResponse.json({ error: "Loja não está ativa." }, { status: 422 })
  if (!loja.aberto) return NextResponse.json({ error: "Loja está fechada no momento." }, { status: 422 })
  if (tipo_entrega === "retirada" && !loja.aceita_retirada) {
    return NextResponse.json({ error: "Esta loja não aceita retirada." }, { status: 422 })
  }

  // 2. Busca os preços reais dos produtos no banco (nunca confia no cliente)
  const produtoIds = items.map((i: any) => i.produto_id)
  const { data: produtos, error: prodErr } = await sb
    .from("produtos")
    .select("id, nome, preco, disponivel, loja_id")
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

  // 3. Calcula subtotal com preços reais do banco
  const subtotal = items.reduce((sum: number, item: any) => {
    const produto = produtos.find((p: any) => p.id === item.produto_id)!
    return sum + Number(produto.preco) * Number(item.quantidade)
  }, 0)

  // 4. Taxa de entrega: tabela fixa por município tem prioridade sobre distância
  let taxa_entrega = 0
  if (tipo_entrega !== "retirada") {
    const { data: tabelaFrete } = await sb
      .from("tabela_frete")
      .select("municipio, taxa")
      .eq("loja_id", loja_id)

    const taxaFixa = buscarTabelaFrete(tabelaFrete ?? [], cidade_entrega)
      ?? buscarTabelaFrete(tabelaFrete ?? [], bairro_entrega)

    taxa_entrega = taxaFixa !== null
      ? taxaFixa
      : calcularTaxaEntrega(loja.lat, loja.lng, lat_entrega, lng_entrega, (loja as any).taxa_entrega ?? 6.00)
  }

  // 5. Valida e aplica cupom no servidor
  let desconto = 0
  let cupomId: string | null = null
  if (cupom_codigo) {
    const { data: cupom } = await sb
      .from("cupons")
      .select("id, tipo, valor, pedido_minimo, validade, ativo, usos, usos_maximos")
      .eq("codigo", cupom_codigo.toUpperCase().trim())
      .or(`loja_id.is.null,loja_id.eq.${loja_id}`)
      .maybeSingle()

    if (cupom && cupom.ativo) {
      const expirado = cupom.validade && new Date(cupom.validade) < new Date()
      const lotado   = cupom.usos_maximos != null && (cupom.usos ?? 0) >= cupom.usos_maximos
      const minOk    = !cupom.pedido_minimo || subtotal >= cupom.pedido_minimo

      if (!expirado && !lotado && minOk) {
        cupomId = cupom.id
        desconto = cupom.tipo === "percentual"
          ? Math.round(subtotal * (cupom.valor / 100) * 100) / 100
          : Math.min(cupom.valor, subtotal)
      }
    }
  }

  // 6. Total final (nunca pode ser negativo)
  const total = Math.max(0, subtotal - desconto) + taxa_entrega

  // 7. Gera token secreto do cliente para autenticar subscribe de push
  const cliente_push_token = crypto.randomBytes(32).toString("hex")

  // 8. Insere pedido
  const statusInicial = ["pix", "cartao"].includes(forma_pagamento) ? "aguardando_pagamento" : "pendente"

  const { data: pedido, error: pedidoErr, codigo } = await inserirComCodigo(sb, {
    loja_id,
    cliente_id: cliente_id ?? null,
    status: statusInicial,
    forma_pagamento,
    tipo,
    subtotal: Math.round(subtotal * 100) / 100,
    taxa_entrega,
    desconto: Math.round(desconto * 100) / 100,
    cupom_codigo: cupomId ? cupom_codigo?.toUpperCase().trim() : null,
    total: Math.round(total * 100) / 100,
    endereco_entrega: endereco_entrega ?? "",
    lat_entrega: lat_entrega ?? null,
    lng_entrega: lng_entrega ?? null,
    observacao: observacao ?? "",
    cliente_push_token,
    nome_cliente:    nome_cliente    ?? null,
    telefone_cliente: telefone_cliente ?? null,
    email_cliente:   email_cliente   ?? null,
  })

  if (pedidoErr || !pedido) {
    console.error("[pedido/criar] Supabase insert error:", JSON.stringify(pedidoErr))
    return NextResponse.json({ error: "Erro ao criar pedido." }, { status: 500 })
  }

  // 9. Insere itens com preços do banco
  await sb.from("itens_pedido").insert(
    items.map((item: any) => {
      const produto = produtos.find((p: any) => p.id === item.produto_id)!
      return {
        pedido_id:  pedido.id,
        produto_id: item.produto_id,
        nome:       produto.nome,
        preco:      Number(produto.preco),
        quantidade: Number(item.quantidade),
        observacao: item.observacao ?? "",
        adicionais: item.adicionais ?? [],
      }
    })
  )

  // 10. Incrementa uso do cupom (server-side, com service role key)
  if (cupomId) {
    const { data: cupomAtual } = await sb.from("cupons").select("usos").eq("id", cupomId).single()
    await sb.from("cupons").update({ usos: ((cupomAtual as any)?.usos ?? 0) + 1 }).eq("id", cupomId)
  }

  return NextResponse.json({
    ok: true,
    pedido_id: pedido.id,
    codigo: pedido.codigo,
    total: Math.round(total * 100) / 100,
    cliente_push_token,
  })
}
