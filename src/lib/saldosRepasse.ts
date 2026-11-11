// Saldos de repasse (admin 2.0, 20/10/2026). Usa a MESMA conta do fechamento diário
// (calcularDestinacoes), pra tela de Repasses, o pagamento e o fechamento nunca darem números diferentes.
import type { SupabaseClient } from "@supabase/supabase-js"
import { calcularDestinacoes, DESTINACOES_DESDE } from "@/lib/destinacoesFinanceiras"

const iniUtc = (ymd: string) => `${ymd}T03:00:00.000Z`
const fimUtcExcl = (ymd: string) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return `${d.toISOString().slice(0, 10)}T03:00:00.000Z` }

async function ler(sb: SupabaseClient, tabela: string, colunas: string, campoData?: string, de?: string, ate?: string) {
  const out: any[] = []
  for (let i = 0; i < 200_000; i += 1000) {
    let q = sb.from(tabela).select(colunas).order("id").range(i, i + 999)
    if (campoData && de && ate) q = q.gte(campoData, iniUtc(de)).lt(campoData, fimUtcExcl(ate))
    const { data, error } = await q
    if (error) throw new Error(`Falha ao consultar ${tabela}`)
    out.push(...(data ?? [])); if ((data ?? []).length < 1000) break
  }
  return out
}

/** Lojas e motoboys de um período (ganhos, descontos, pagos e pendente), pela conta do fechamento. */
export async function destinacoesPeriodo(sb: SupabaseClient, de: string, ate: string) {
  const [pedidos, avulsas, lojas, cupons, motoboys, movimentos, saques] = await Promise.all([
    ler(sb, "pedidos", "id,codigo,loja_id,motoboy_id,status,criado_em,forma_pagamento,forma_pagamento_2,valor_pagamento_1,valor_pagamento_2,tipo_cartao_entrega,subtotal,total,taxa_entrega,taxa_dinamica,desconto,cupom_codigo,tipo,endereco_entrega,frete_gratis,frete_absorvido_por", "criado_em", de, ate),
    ler(sb, "entregas_avulsas", "id,codigo,loja_id,motoboy_id,status,criado_em,taxa_entrega,comissao_valor,subtotal_itens", "criado_em", de, ate),
    ler(sb, "lojas", "id,nome,comissao,plano,plano_mensalidade,participacao_entrega"),
    ler(sb, "cupons", "id,codigo,loja_id"),
    ler(sb, "motoboys", "id,nome,ajuda_custo_semanal,ajuda_custo_dia_semana"),
    ler(sb, "movimentos_financeiros", "id,tipo,valor,loja_id,motoboy_id,ocorrido_em,origem,cancelado_em", "ocorrido_em", de, ate),
    ler(sb, "saques", "id,tipo,loja_id,motoboy_id,valor,status,criado_em,pago_em"),
  ])
  return calcularDestinacoes({ pedidos, avulsas, lojas, cupons, motoboys, movimentos, saques, mensalidades: [], inicio: de, fim: ate } as never)
}

/** Saldo de cada motoboy desde o início do sistema novo (16/10) até hoje: o que ele tem a receber. */
export async function saldoMotoboys(sb: SupabaseClient, hoje: string) {
  const d = await destinacoesPeriodo(sb, DESTINACOES_DESDE, hoje)
  return d.motoboys.lista.map(m => ({ id: m.id, nome: m.nome, ganho: m.ganho / 100, bonus: m.bonus / 100, descontos: m.descontos / 100, devido: m.devido / 100, pago: m.pago / 100, compensado: m.compensado / 100, pendente: m.pendente / 100, dinheiroClientes: m.dinheiroClientes / 100, dinheiroAPrestar: m.dinheiroAPrestar / 100, entregas: m.entregas }))
}

/** Saldo de UM motoboy pra tela e pro saque do app dele (decisão do Lucas, 20/10/2026): a mesma conta
 *  do fechamento e do admin, desde 16/10. Ganhos − pagos (saque ou painel) + ajustes manuais lançados
 *  desde 16/10; o que ele já pediu de saque e não foi pago fica reservado. */
export async function saldoDoMotoboy(sb: SupabaseClient, motoboyId: string, hoje: string) {
  const [lista, { data: abertos }, { data: ajustes }] = await Promise.all([
    saldoMotoboys(sb, hoje),
    sb.from("saques").select("valor").eq("tipo", "motoboy").eq("motoboy_id", motoboyId).eq("status", "solicitado"),
    sb.from("saldo_ajustes").select("valor").eq("tipo", "motoboy").eq("motoboy_id", motoboyId).is("quitado_em", null).gte("criado_em", iniUtc(DESTINACOES_DESDE)),
  ])
  const m = lista.find(x => x.id === motoboyId)
  const r2 = (v: number) => Math.round(v * 100) / 100
  const ajuste = r2((ajustes ?? []).reduce((t: number, a: any) => t + Number(a.valor ?? 0), 0))
  const reservado = r2((abertos ?? []).reduce((t: number, a: any) => t + Number(a.valor ?? 0), 0))
  const pendente = r2((m?.pendente ?? 0) + ajuste)
  return { desde: DESTINACOES_DESDE, ganho: m?.ganho ?? 0, bonus: m?.bonus ?? 0, descontos: m?.descontos ?? 0, ajuste, pago: r2((m?.pago ?? 0) + (m?.compensado ?? 0)), pendente, reservado, livre: r2(Math.max(0, pendente - reservado)), entregas: m?.entregas ?? 0 }
}
