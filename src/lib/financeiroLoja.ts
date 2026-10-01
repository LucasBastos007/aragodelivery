import type { SupabaseClient } from "@supabase/supabase-js"

// Fonte única do saldo financeiro do lojista — usada por /api/loja/financeiro (exibição) e
// /api/loja/saque (autorização + gravação). O cálculo em si vive inteiro dentro da RPC
// `saldo_financeiro_loja` (financeiro_saldo_e_saque.sql, DEV) — o PostgREST deste projeto
// tem `sum()`/`count()` no `.select()` desligado por configuração (PGRST123, confirmado
// testando direto), então uma função SQL via `.rpc()` é o único jeito de agregar no banco
// sem buscar todos os pedidos entregues da loja pra somar em JS. As duas RPCs financeiras
// (`saldo_financeiro_loja`, `solicitar_saque_loja`) só têm GRANT pro service_role — chamadas
// exclusivamente daqui, com loja_id vindo da sessão validada por requireLoja(), nunca do
// cliente.
//
// Regra financeira preservada exatamente como estava: só pedido "entregue" conta como
// venda (nunca "cancelado", nem "coletado" enquanto não vira "entregue"), comissão =
// lojas.comissao% sobre subtotal, mensalidade só desconta se status="descontado" (regras
// vigentes documentadas em relatorioDiario.ts). Reembolso pós-entrega NÃO desconta da
// receita hoje (auditado em src/app/api/reembolso/processar/route.ts — o pedido continua
// "entregue" e o valor não é removido de lugar nenhum) — comportamento existente,
// preservado sem alteração; é uma decisão de negócio que fica pra fora deste checkpoint.
export type LojaFinanceira = {
  pix_key: string | null
  comissao: number | null
  plano_mensalidade: number | null
  banco: string | null
  banco_tipo_conta: string | null
  banco_agencia: string | null
  banco_conta: string | null
  asaas_wallet_id: string | null
}

export type FinanceiroTotais = {
  loja: LojaFinanceira | null
  mensalidades: { id: string; valor: number; status: string; referencia?: string; criado_em: string }[]
  saques: { id: string; valor: number; status: string; pix_chave?: string; criado_em: string; pago_em?: string }[]
  saldo: number
  receitaBruta: number
  qtdPedidos: number
  totalComissao: number
  totalMensalidades: number
  totalSaquesPagos: number
}

export async function carregarFinanceiroLoja(sb: SupabaseClient, loja_id: string): Promise<FinanceiroTotais> {
  const [{ data: lojaData }, { data: saldoRows, error: saldoErr }, { data: mensalidades }, { data: saques }] = await Promise.all([
    sb.from("lojas")
      .select("pix_key, comissao, plano_mensalidade, banco, banco_tipo_conta, banco_agencia, banco_conta, asaas_wallet_id")
      .eq("id", loja_id).single(),
    sb.rpc("saldo_financeiro_loja", { p_loja_id: loja_id }),
    sb.from("mensalidades").select("*").eq("loja_id", loja_id).order("criado_em", { ascending: false }),
    sb.from("saques").select("*").eq("loja_id", loja_id).eq("tipo", "lojista").order("criado_em", { ascending: false }),
  ])

  // Sem fallback silencioso aqui de propósito — saldo é usado pra liberar saque de dinheiro
  // de verdade; se a agregação falhar, é melhor a rota quebrar (500) do que calcular saldo
  // errado ou vazio sem avisar. Não é uma métrica secundária como o total do Histórico.
  if (saldoErr) throw saldoErr
  const r = (saldoRows ?? [])[0]

  return {
    loja: lojaData,
    mensalidades: mensalidades ?? [],
    saques: saques ?? [],
    saldo: Number(r?.saldo ?? 0),
    receitaBruta: Number(r?.receita_bruta ?? 0),
    qtdPedidos: Number(r?.qtd_pedidos ?? 0),
    totalComissao: Number(r?.total_comissao ?? 0),
    totalMensalidades: Number(r?.total_mensalidades ?? 0),
    totalSaquesPagos: Number(r?.total_saques_pagos ?? 0),
  }
}

export type PedidoExtrato = { id: string; codigo: string; subtotal: number; criado_em: string }

// Extrato paginado de verdade — .range() no banco, nunca busca tudo pra cortar depois.
// Ordenação por criado_em desc + id desc como critério de desempate estável (pedidos
// seedados/importados em lote podem ter o mesmo timestamp; sem o segundo critério a
// paginação podia repetir ou pular linha entre páginas).
export async function buscarExtratoLoja(
  sb: SupabaseClient, loja_id: string, pagina = 0, tamanhoPagina = 30
): Promise<PedidoExtrato[]> {
  const from = pagina * tamanhoPagina
  const { data } = await sb
    .from("pedidos")
    .select("id, codigo, subtotal, criado_em")
    .eq("loja_id", loja_id).eq("status", "entregue")
    .order("criado_em", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + tamanhoPagina - 1)
  return data ?? []
}

export type ResultadoSaque = { ok: boolean; saqueId: string | null; saldoDisponivel: number; motivo: string | null }

// Solicita o saque de forma transacional — todo o "recalcula saldo + valida + insere" roda
// dentro de uma única função SQL (solicitar_saque_loja), com um advisory lock por loja_id
// serializando chamadas concorrentes. Antes disso, o check ("valor <= saldo calculado em JS")
// e o insert eram 2 chamadas HTTP separadas ao Supabase sem lock nenhum entre elas — duas
// solicitações de saque simultâneas podiam ler o mesmo saldo antes de qualquer uma gravar e
// as duas passavam, ultrapassando o saldo real da loja (confirmado o cenário testando com
// duas requisições disparadas ao mesmo tempo antes desta correção).
export async function solicitarSaque(sb: SupabaseClient, loja_id: string, valor: number): Promise<ResultadoSaque> {
  const { data, error } = await sb.rpc("solicitar_saque_loja", { p_loja_id: loja_id, p_valor: valor })
  if (error) throw error
  const r = (data ?? [])[0]
  return {
    ok: !!r?.ok,
    saqueId: r?.saque_id ?? null,
    saldoDisponivel: Number(r?.saldo_disponivel ?? 0),
    motivo: r?.motivo ?? null,
  }
}
