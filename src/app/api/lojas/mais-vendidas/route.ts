import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { periodoSemana } from "@/lib/periodoBrt"

// Ordem das lojas que mais venderam na SEMANA PASSADA inteira (segunda a domingo, horário de
// Brasília, pedidos entregues), usada no "Famosos no Chegô" da tela inicial. Muda uma vez por
// semana, na virada de domingo pra segunda (pedido do Lucas, 20/10/2026). A Petiscaria fica
// sempre em 1º na tela, fora deste ranking. Só leitura; devolve só os ids na ordem, sem números
// de venda (o cliente não precisa ver quanto cada loja vende).
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

export async function GET() {
  try {
    const inicioEstaSemana = periodoSemana().inicioUtc            // segunda 00:00 BRT
    const desde = new Date(new Date(inicioEstaSemana).getTime() - 7 * 86400000).toISOString()
    const conta = new Map<string, number>()
    for (let i = 0; i < 20000; i += 1000) {
      const { data, error } = await sb.from("pedidos").select("loja_id")
        .eq("status", "entregue").gte("criado_em", desde).lt("criado_em", inicioEstaSemana).range(i, i + 999)
      if (error || !data) break
      for (const p of data) if (p.loja_id) conta.set(p.loja_id, (conta.get(p.loja_id) ?? 0) + 1)
      if (data.length < 1000) break
    }
    const ids = [...conta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id]) => id)
    return NextResponse.json({ ids }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } })
  } catch {
    return NextResponse.json({ ids: [] })
  }
}
