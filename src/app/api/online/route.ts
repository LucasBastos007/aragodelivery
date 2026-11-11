export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { inscricaoValida } from "@/lib/pushHosts"

// "Agora no app" (31/10/2026): o app do cliente avisa a cada 1 min enquanto está aberto e na
// tela. Uma linha por celular (código anônimo, sem dado pessoal), sobrescrita a cada aviso.
// Lembrete de sacola (01/11/2026): com item na sacola, guarda loja/itens/total em
// sacolas_abertas (atualizada_em = última vez visto com a sacola cheia); sacola vazia apaga.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const TELAS = ["lojas", "checkout", "pedido"]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  try {
    const { visitante, tela, sacola, sub } = await req.json()
    if (typeof visitante !== "string" || !/^[a-z0-9-]{8,48}$/i.test(visitante)) return NextResponse.json({ ok: false })
    const agora = new Date().toISOString()
    await sb.from("online_agora").upsert({ visitante, tela: TELAS.includes(tela) ? tela : "lojas", visto_em: agora })

    const valida = sacola && UUID.test(String(sacola.loja_id)) && Number(sacola.itens) > 0 && Number(sacola.total) >= 0 && Number(sacola.total) < 100000
    if (valida) {
      const row: Record<string, unknown> = { visitante, loja_id: sacola.loja_id, itens: Math.min(999, Math.floor(Number(sacola.itens))), total: Number(sacola.total), atualizada_em: agora }
      if (inscricaoValida(sub)) row.subscription = sub
      await sb.from("sacolas_abertas").upsert(row)
    } else if (sacola === null) {
      await sb.from("sacolas_abertas").delete().eq("visitante", visitante)
    }

    // Faxina de vez em quando
    if (Math.random() < 0.01) {
      await sb.from("online_agora").delete().lt("visto_em", new Date(Date.now() - 86400_000).toISOString())
      await sb.from("sacolas_abertas").delete().lt("atualizada_em", new Date(Date.now() - 2 * 86400_000).toISOString())
    }
  } catch {}
  return NextResponse.json({ ok: true })
}
