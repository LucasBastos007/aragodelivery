// Lógica de emissão de NFC-e — chamada pelo avancar-etapa e pela rota manual
import type { SupabaseClient } from "@supabase/supabase-js"
import { emitirNfce as focusEmitir, type FocusNfce } from "./focusnfe"

const PAGAMENTO_MAP: Record<string, string> = {
  pix:        "17",
  cartao:     "03",
  dinheiro:   "01",
  maquininha: "03",
  apple_pay:  "03",
  google_pay: "03",
}

function mapRegime(r: string | null | undefined): "1" | "3" {
  if (!r || r === "mei" || r === "simples") return "1"
  return "3"
}

function buildRef(pedidoId: string): string {
  return pedidoId.replace(/-/g, "").slice(0, 20)
}

function brTimestamp(): string {
  // ISO 8601 com offset fixo de Brasília (-03:00)
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  return `${brt.getUTCFullYear()}-${pad(brt.getUTCMonth() + 1)}-${pad(brt.getUTCDate())}T` +
         `${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}:${pad(brt.getUTCSeconds())}-03:00`
}

export async function emitirNfcePedido(
  pedidoId: string,
  sb: SupabaseClient
): Promise<{ ok: boolean; ref?: string; error?: string }> {

  // 1. Busca pedido com loja e itens
  const { data: pedido } = await sb
    .from("pedidos")
    .select(`
      id, loja_id, forma_pagamento, total, subtotal, cpf_cliente, nome_cliente,
      itens_pedido ( id, produto_id, nome, preco, quantidade, adicionais ),
      lojas!inner (
        cnpj, nome, fiscal_ativo, focusnfe_cadastrado,
        regime_tributario, inscricao_estadual,
        logradouro, numero, bairro, cidade, estado, cep
      )
    `)
    .eq("id", pedidoId)
    .single()

  if (!pedido) return { ok: false, error: "Pedido não encontrado" }

  const loja = pedido.lojas as unknown as Record<string, unknown>
  if (!loja?.fiscal_ativo)        return { ok: false, error: "Fiscal não ativo para esta loja" }
  if (!loja?.focusnfe_cadastrado) return { ok: false, error: "Loja não registrada no Focus NFe" }
  if (!loja?.cnpj)                return { ok: false, error: "CNPJ da loja não configurado" }

  const ref = buildRef(pedidoId)

  // 2. Verifica se já está autorizado
  const { data: existing } = await sb
    .from("notas_fiscais")
    .select("id, status, tentativas")
    .eq("ref", ref)
    .maybeSingle()

  if (existing?.status === "autorizado") return { ok: true, ref }

  // 3. Busca NCM dos produtos
  const itens = (pedido.itens_pedido as Record<string, unknown>[]) ?? []
  const prodIds = itens.map(i => i.produto_id as string).filter(Boolean)
  const { data: prods } = prodIds.length > 0
    ? await sb.from("produtos").select("id, ncm").in("id", prodIds)
    : { data: [] as { id: string; ncm: string | null }[] }
  const ncmMap = Object.fromEntries((prods ?? []).map(p => [p.id, p.ncm]))

  // 4. Monta itens NFC-e
  const isSimples = mapRegime(loja.regime_tributario as string) === "1"

  const nfceItems = itens.map((item, idx) => {
    const adics = (item.adicionais as { nome: string }[] | null)?.map(a => a.nome).join(", ")
    const descricao = (adics ? `${item.nome} (${adics})` : String(item.nome)).slice(0, 120)
    const ncmRaw = (ncmMap[(item.produto_id as string)] || "21069090") as string
    const ncm = ncmRaw.replace(/\D/g, "").padStart(8, "0")
    const preco = Number(item.preco)
    const qty   = Number(item.quantidade)

    const base: Record<string, unknown> = {
      numero_item:              idx + 1,
      codigo_produto:           String(idx + 1).padStart(3, "0"),
      descricao,
      cfop:                     "5102",
      unidade_comercial:        "UN",
      quantidade_comercial:     qty,
      valor_unitario_comercial: Number(preco.toFixed(2)),
      valor_bruto:              Number((preco * qty).toFixed(2)),
      codigo_ncm:               ncm,
      icms_origem:              0,
    }
    if (isSimples) base.icms_csosn = "400"
    else           base.icms_cst   = "60"
    return base
  })

  if (nfceItems.length === 0) return { ok: false, error: "Pedido sem itens" }

  // 5. Monta corpo NFC-e
  const nfce: FocusNfce = {
    cnpj_emitente:     (loja.cnpj as string).replace(/\D/g, ""),
    ref,
    natureza_operacao: "Venda ao consumidor",
    data_emissao:      brTimestamp(),
    tipo_documento:    1,
    finalidade_emissao: 1,
    consumidor_final:  1,
    presenca_comprador: 4,
    modalidade_frete:  9,
    local_destino:     1,
    items:             nfceItems as unknown as FocusNfce["items"],
    forma_pagamento:   [{
      forma_pagamento: PAGAMENTO_MAP[pedido.forma_pagamento] ?? "99",
      // valor = subtotal dos produtos (sem taxa de entrega, que é serviço da Chegô)
      valor_pagamento: Number(Number(pedido.subtotal ?? pedido.total).toFixed(2)),
    }],
  }

  if (pedido.cpf_cliente) {
    nfce.cpf_destinatario  = (pedido.cpf_cliente as string).replace(/\D/g, "")
    nfce.nome_destinatario = (pedido.nome_cliente as string | null) || "CONSUMIDOR"
  }

  // 6. Upsert registro como "processando"
  await sb.from("notas_fiscais").upsert({
    pedido_id:     pedidoId,
    loja_id:       pedido.loja_id,
    ref,
    status:        "processando",
    tentativas:    ((existing as Record<string, unknown> | null)?.tentativas as number ?? 0) + 1,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: "ref" })

  // 7. Chama Focus NFe
  try {
    const result = await focusEmitir(nfce, true)
    const status = result.status === "autorizado" ? "autorizado"
                 : result.status === "cancelado"  ? "cancelado"
                 : "erro"

    await sb.from("notas_fiscais").update({
      status,
      numero:       result.numero   ?? null,
      serie:        result.serie    ?? null,
      chave_acesso: result.chave_nfe        ?? null,
      danfe_url:    result.danfe_nfce_url   ?? null,
      xml_url:      result.xml_url          ?? null,
      erro_msg:     status === "erro"
        ? (result.erros?.[0]?.mensagem ?? "Erro desconhecido")
        : null,
      atualizado_em: new Date().toISOString(),
    }).eq("ref", ref)

    return { ok: status === "autorizado", ref }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await sb.from("notas_fiscais").update({
      status:        "erro",
      erro_msg:      msg,
      atualizado_em: new Date().toISOString(),
    }).eq("ref", ref)
    return { ok: false, error: msg }
  }
}
