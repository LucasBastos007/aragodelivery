// Promoção Chegô 10% (lib/promoChego), parte do servidor: produtos da promoção que esse cadastro
// (conta ou telefone) já levou COM o desconto na campanha. Pedido cancelado ou Pix não pago não
// conta (libera de novo). Só conta o item marcado com PROMO_MARCA_ID: quem comprou o produto
// antes da ativação, sem desconto, continua com direito (09/11/2026).
import type { SupabaseClient } from "@supabase/supabase-js"
import { chaveLoja, chaveRelampago, PROMO_FIM, PROMO_INICIO, PROMO_ITENS, PROMO_MARCA_ID, PROMO_PRODUTOS, RELAMPAGO } from "@/lib/promoChego"

export async function promoUsados(sb: SupabaseClient, clienteId?: string | null, telefone?: string | null): Promise<string[]> {
  const fim8 = (t?: string | null) => String(t ?? "").replace(/\D/g, "").slice(-8)
  const f8 = fim8(telefone)
  const base = () => sb.from("pedidos").select("id, telefone_cliente").gte("criado_em", PROMO_INICIO).lt("criado_em", PROMO_FIM)
    .not("status", "in", "(cancelado,aguardando_pagamento)")
  const ids = new Set<string>()
  if (clienteId) { const { data } = await base().eq("cliente_id", clienteId); (data ?? []).forEach(p => ids.add(p.id)) }
  if (f8.length === 8) { const { data } = await base().ilike("telefone_cliente", `%${f8.slice(-4)}`); (data ?? []).filter(p => fim8(p.telefone_cliente) === f8).forEach(p => ids.add(p.id)) }
  if (!ids.size) return []
  const { data: itens } = await sb.from("itens_pedido").select("produto_id, adicionais").in("pedido_id", Array.from(ids)).in("produto_id", Array.from(new Set([...Object.keys(PROMO_PRODUTOS), ...Object.keys(RELAMPAGO)])))
  // Uso da oferta relâmpago (marca com campanha "relampago") volta como "r:<produto>", separado dos 10%
  const usos = (itens ?? []).flatMap(i => (Array.isArray(i.adicionais) ? i.adicionais : [])
    .filter((a: any) => a?.id === PROMO_MARCA_ID)
    .flatMap((a: any) => a?.campanha === "relampago" ? [chaveRelampago(i.produto_id as string)]
      // Hora Maluca (11/11): 1 desconto por loja, então o uso também bloqueia a loja ("l:<loja>")
      : PROMO_ITENS[i.produto_id as string] ? [i.produto_id as string, chaveLoja(PROMO_ITENS[i.produto_id as string].loja)] : [i.produto_id as string]))
  return Array.from(new Set(usos))
}
