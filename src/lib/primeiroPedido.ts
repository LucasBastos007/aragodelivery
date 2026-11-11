// Cupom de primeiro pedido (31/10/2026): cupons.so_primeiro_pedido = true só vale pra quem
// ainda não tem pedido (fora os cancelados), conferido pelo telefone (8 últimos dígitos) e,
// quando houver, pelo cliente_id.
import type { SupabaseClient } from "@supabase/supabase-js"
import { haversineKm } from "@/lib/frete"

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

// Trava de várias contas (11/11/2026, pedido do Lucas): mãe cria conta no nome do filho, filho no
// da mãe, e cada conta nova levava o frete grátis de novo. Agora o primeiro pedido é UM POR CASA
// e POR CELULAR, e zona rural não tem esse frete grátis.
// Casos reais que motivaram: Ana Clara (9G2CJU) no mesmo ponto de 20+ pedidos da Ana Clara
// Rigoni; João Pedro Matos (JZXCDZ) e Samuel Matos (3Y99DD) na mesma chácara, a 2 m.

/** Outro pedido (de qualquer conta) até essa distância do pino = mesma casa. Os abusos reais ficaram
 *  a 0–7 m; vizinhos de lote ficam a 16 m ou mais (testado nos 11 usos do PRIMEIROPEDIDO, 11/11). */
export const RAIO_MESMA_CASA_M = 15
const RURAL_NO_ENDERECO = /ch[aá]cara|fazenda|s[ií]tio\b|zona rural|estrada de ch[aã]o|povoado|assentamento|gleba/i

export const MSG_PRIMEIRO_RURAL = "O frete grátis do primeiro pedido não vale para zona rural."
export const MSG_PRIMEIRO_MESMA_CASA = "Esse endereço já recebeu pedido do Chegô. O frete grátis do primeiro pedido é um por casa."
export const MSG_PRIMEIRO_MESMO_CELULAR = "Esse celular já usou o frete grátis do primeiro pedido em outra conta."

type Pedido = { lat_entrega: number | null; lng_entrega: number | null; cliente_id: string | null }

async function pedidosPerto(sb: SupabaseClient, lat: number, lng: number, raioM: number): Promise<Pedido[]> {
  const dLat = raioM / 111_000, dLng = raioM / (111_000 * Math.cos(lat * Math.PI / 180))
  const { data } = await sb.from("pedidos").select("lat_entrega, lng_entrega, cliente_id")
    .neq("status", "cancelado")
    .gte("lat_entrega", lat - dLat).lte("lat_entrega", lat + dLat)
    .gte("lng_entrega", lng - dLng).lte("lng_entrega", lng + dLng).limit(500)
  return (data ?? []).filter(p => p.lat_entrega != null && p.lng_entrega != null
    && haversineKm(lat, lng, Number(p.lat_entrega), Number(p.lng_entrega)) * 1000 <= raioM)
}

/**
 * Motivo pra recusar o cupom de primeiro pedido, ou null se pode usar. A conta/telefone (jaFezPedido)
 * continua sendo conferida à parte. Sem pino no mapa só dá pra olhar o texto do endereço; o
 * /api/pedido/criar confere de novo com o pino de verdade.
 */
export async function bloqueioPrimeiroPedido(sb: SupabaseClient, p: {
  clienteId?: string | null; lat?: number | null; lng?: number | null
  zonaRural?: boolean; endereco?: string | null; dispositivo?: string | null; retirada?: boolean
}): Promise<string | null> {
  if (!p.retirada) {
    if (p.zonaRural || RURAL_NO_ENDERECO.test(String(p.endereco ?? ""))) return MSG_PRIMEIRO_RURAL
    if (p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
      // Não deduz zona rural pelos vizinhos: há rua de chão marcada como rural dentro da cidade
      // (Parque das Acácias, Jardim das Flores) e isso barraria cliente urbano.
      const perto = await pedidosPerto(sb, p.lat, p.lng, RAIO_MESMA_CASA_M)
      if (perto.some(x => !p.clienteId || x.cliente_id !== p.clienteId)) return MSG_PRIMEIRO_MESMA_CASA
    }
  }
  const disp = String(p.dispositivo ?? "").trim()
  if (disp.length >= 16) {
    let q = sb.from("pedidos").select("id", { count: "exact", head: true }).eq("dispositivo", disp).neq("status", "cancelado")
    if (p.clienteId) q = q.neq("cliente_id", p.clienteId)
    const { count } = await q
    if ((count ?? 0) > 0) return MSG_PRIMEIRO_MESMO_CELULAR
  }
  return null
}
