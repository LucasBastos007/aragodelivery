// Campanha de almoço (18/11/2026, pedido da Amanda): 50 cupons de uso único, ALM001 a ALM050,
// distribuídos em cartões nos comércios de Aragoiânia. O que a tabela cupons já cobre fica nela
// (tipo, valor, pedido mínimo, validade, lojas_ids, max_usos = 1); aqui fica só o que ela não tem:
// - janela de todo dia das 10h30 às 14h, de 18/11 a 22/11 (o último dia acaba às 14h);
// - frete grátis só até 5 km da loja, medido como no ARAGO68;
// - uso único que um pedido cancelado devolve: o código conta como usado enquanto houver pedido
//   não cancelado com ele, então Pix vencido, cartão recusado e cancelamento liberam sozinhos,
//   sem mexer nas rotas de cancelamento. O contador "usos" da tabela continua só informativo.
import type { SupabaseClient } from "@supabase/supabase-js"
import { hojeYmdBrt, diaEMinutosAgoraBrt } from "@/lib/periodoBrt"

export const CUPOM_ALMOCO = {
  inicio: "2026-11-18",
  fim: "2026-11-22",
  abreMin: 10 * 60 + 30,
  fechaMin: 14 * 60,
  raioFreteKm: 5,
}

export const MSG_ALMOCO_HORARIO = "Este cupom vale de 18 a 22/11, só para pedidos entre 10h30 e 14h."
export const MSG_ALMOCO_RAIO = "O frete grátis deste cupom vale só para entregas até 5 km da loja, com o endereço marcado no mapa."
export const MSG_ALMOCO_USADO = "Este cupom já foi usado."

export const ehCupomAlmoco = (codigo: unknown) => /^ALM0(0[1-9]|[1-4]\d|50)$/.test(String(codigo ?? "").trim().toUpperCase())

export function cupomAlmocoNoHorario(): boolean {
  const hoje = hojeYmdBrt()
  if (hoje < CUPOM_ALMOCO.inicio || hoje > CUPOM_ALMOCO.fim) return false
  const { minutos } = diaEMinutosAgoraBrt()
  return minutos >= CUPOM_ALMOCO.abreMin && minutos < CUPOM_ALMOCO.fechaMin
}

/** Pedidos não cancelados com o código (o mais antigo primeiro). */
export async function pedidosComCupomAlmoco(sb: SupabaseClient, codigo: string): Promise<{ id: string }[]> {
  const { data } = await sb.from("pedidos").select("id").eq("cupom_codigo", codigo.trim().toUpperCase())
    .neq("status", "cancelado").order("criado_em").order("id")
  return (data ?? []) as { id: string }[]
}
