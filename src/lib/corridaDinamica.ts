// Corrida dinâmica (25/10/2026, pedido do Lucas): em chuva, o admin liga um acréscimo fixo
// (ex. R$ 1,00) por um período. O CLIENTE paga e o valor vai inteiro pro MOTOBOY.
// Fica gravado em pedidos.taxa_dinamica, separado de taxa_entrega, pra todo o resto do
// cálculo (taxa por distância/bairro/zona rural, piso de R$ 4,00, comissão, repasse da
// loja) seguir exatamente igual. Vale em todas as lojas, só em entrega (retirada não).
// Config: configuracoes.corrida_dinamica = {"valor":1,"ate":"<ISO>","motivo":"chuva"}.
import type { SupabaseClient } from "@supabase/supabase-js"

export type CorridaDinamica = { valor: number; ate: string; motivo: string }

export const CHAVE_DINAMICA = "corrida_dinamica"

/** Config salva, mesmo vencida (pro painel mostrar a última). */
export async function lerCorridaDinamica(sb: SupabaseClient): Promise<CorridaDinamica | null> {
  const { data } = await sb.from("configuracoes").select("valor").eq("chave", CHAVE_DINAMICA).maybeSingle()
  if (!data?.valor) return null
  try {
    const v = typeof data.valor === "string" ? JSON.parse(data.valor) : data.valor
    const valor = Math.round(Number(v?.valor) * 100) / 100
    if (!(valor > 0) || !v?.ate) return null
    return { valor, ate: String(v.ate), motivo: String(v.motivo ?? "chuva") }
  } catch { return null }
}

export function dinamicaAtiva(d: CorridaDinamica | null, agora = new Date()): d is CorridaDinamica {
  return !!d && new Date(d.ate).getTime() > agora.getTime()
}

/** Quanto somar na corrida AGORA (0 se desligada, vencida ou retirada). */
export async function acrescimoDinamico(sb: SupabaseClient, tipoEntrega: string): Promise<number> {
  if (tipoEntrega === "retirada") return 0
  const d = await lerCorridaDinamica(sb).catch(() => null)
  return dinamicaAtiva(d) ? d.valor : 0
}
