// Black Friday Chegô — parte do servidor: em quais lojas o cadastro (conta ou telefone) já
// bateu o limite de 2 pedidos promocionais na campanha. Só conta pedido que de fato usou o
// desconto (cupom_codigo = BLACK_CODIGO) e não foi cancelado — Pix não pago/cancelado libera.
import type { SupabaseClient } from "@supabase/supabase-js"
import { BLACK_CHAVE_SUSPENSA, BLACK_CODIGO, BLACK_FIM, BLACK_INICIO, BLACK_LIMITE_PEDIDOS, BLACK_MARCA_ID, chaveLojaBlack } from "@/lib/blackFriday"

const fim8 = (t?: string | null) => String(t ?? "").replace(/\D/g, "").slice(-8)

/** Conjunto de chaveLojaBlack() das lojas em que o cadastro já atingiu o limite de pedidos BF. */
export async function blackLojasCheias(
  sb: SupabaseClient,
  clienteId?: string | null,
  telefone?: string | null,
): Promise<Set<string>> {
  const f8 = fim8(telefone)
  const base = () => sb.from("pedidos").select("id, loja_id, telefone_cliente")
    .gte("criado_em", BLACK_INICIO).lt("criado_em", BLACK_FIM)
    .eq("cupom_codigo", BLACK_CODIGO).neq("status", "cancelado")
  const porPedido = new Map<string, string>() // id -> loja_id (dedup conta/telefone)
  if (clienteId) { const { data } = await base().eq("cliente_id", clienteId); (data ?? []).forEach(p => porPedido.set(p.id, p.loja_id)) }
  if (f8.length === 8) {
    const { data } = await base().ilike("telefone_cliente", `%${f8.slice(-4)}`)
    ;(data ?? []).filter(p => fim8(p.telefone_cliente) === f8).forEach(p => porPedido.set(p.id, p.loja_id))
  }
  const porLoja = new Map<string, number>()
  for (const loja of porPedido.values()) porLoja.set(loja, (porLoja.get(loja) || 0) + 1)
  const cheias = new Set<string>()
  for (const [loja, n] of porLoja) if (n >= BLACK_LIMITE_PEDIDOS) cheias.add(chaveLojaBlack(loja))
  return cheias
}

/** Quantos pedidos BF o cadastro já tem em cada loja na janela (pro app mostrar "resta 1"). */
export async function blackPedidosPorLoja(
  sb: SupabaseClient,
  clienteId?: string | null,
  telefone?: string | null,
): Promise<Record<string, number>> {
  const f8 = fim8(telefone)
  const base = () => sb.from("pedidos").select("id, loja_id, telefone_cliente")
    .gte("criado_em", BLACK_INICIO).lt("criado_em", BLACK_FIM)
    .eq("cupom_codigo", BLACK_CODIGO).neq("status", "cancelado")
  const porPedido = new Map<string, string>()
  if (clienteId) { const { data } = await base().eq("cliente_id", clienteId); (data ?? []).forEach(p => porPedido.set(p.id, p.loja_id)) }
  if (f8.length === 8) {
    const { data } = await base().ilike("telefone_cliente", `%${f8.slice(-4)}`)
    ;(data ?? []).filter(p => fim8(p.telefone_cliente) === f8).forEach(p => porPedido.set(p.id, p.loja_id))
  }
  const out: Record<string, number> = {}
  for (const loja of porPedido.values()) out[loja] = (out[loja] || 0) + 1
  return out
}

/**
 * Borderô: soma o split gravado nos itens (marca BLACK_MARCA_ID: custo_chego / custo_loja) e anexa
 * em cada pedido BLACKCHEGO como black_custo_chego / black_custo_loja (lido por calcularPedido).
 * Pedidos de outras campanhas passam intactos. Muta e devolve a mesma lista.
 */
export async function anexarSplitBlack<T extends { id: string; cupom_codigo?: string | null }>(sb: SupabaseClient, pedidos: T[]): Promise<T[]> {
  const ids = pedidos.filter(p => String(p.cupom_codigo ?? "").toUpperCase() === BLACK_CODIGO).map(p => p.id)
  if (!ids.length) return pedidos
  const soma = new Map<string, { chego: number; loja: number }>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from("itens_pedido").select("pedido_id, adicionais").in("pedido_id", ids.slice(i, i + 200))
    for (const it of data ?? []) {
      for (const a of (Array.isArray(it.adicionais) ? it.adicionais : []) as any[]) {
        if (a?.id !== BLACK_MARCA_ID) continue
        const s = soma.get(it.pedido_id) ?? { chego: 0, loja: 0 }
        s.chego += Number(a.custo_chego) || 0; s.loja += Number(a.custo_loja) || 0
        soma.set(it.pedido_id, s)
      }
    }
  }
  for (const p of pedidos as any[]) {
    const s = soma.get(p.id)
    if (s) { p.black_custo_chego = Math.round(s.chego * 100) / 100; p.black_custo_loja = Math.round(s.loja * 100) / 100 }
  }
  return pedidos
}

/** Campanha suspensa pelo admin? (configuracoes.black_friday_suspensa = "1") */
export async function blackSuspensa(sb: SupabaseClient): Promise<boolean> {
  const { data } = await sb.from("configuracoes").select("valor").eq("chave", BLACK_CHAVE_SUSPENSA).maybeSingle()
  return String(data?.valor ?? "") === "1"
}
