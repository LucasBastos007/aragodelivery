// Cupom de primeiro pedido (31/10/2026): cupons.so_primeiro_pedido = true só vale pra quem
// ainda não tem pedido (fora os cancelados), conferido pelo telefone (8 últimos dígitos) e,
// quando houver, pelo cliente_id.
import type { SupabaseClient } from "@supabase/supabase-js"

const fim8 = (t?: string | null) => String(t ?? "").replace(/\D/g, "").slice(-8)

export async function jaFezPedido(sb: SupabaseClient, telefone?: string | null, clienteId?: string | null): Promise<boolean> {
  if (clienteId) {
    const { count } = await sb.from("pedidos").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId).neq("status", "cancelado")
    if ((count ?? 0) > 0) return true
  }
  const f8 = fim8(telefone)
  if (f8.length < 8) return false
  // Telefone é gravado em formatos diferentes ("(62) 99615-1777", "62996151777"): filtra pelos
  // 4 últimos no banco e confere os 8 últimos aqui
  const { data } = await sb.from("pedidos").select("telefone_cliente").ilike("telefone_cliente", `%${f8.slice(-4)}`).neq("status", "cancelado").limit(1000)
  return (data ?? []).some(p => fim8(p.telefone_cliente) === f8)
}

export const MSG_SO_PRIMEIRO = "Esse cupom é só para o primeiro pedido."
