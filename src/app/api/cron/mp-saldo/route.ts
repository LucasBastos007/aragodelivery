export const dynamic = "force-dynamic"
// Saldo do Mercado Pago lido da conta (24/10/2026): a cada rodada lê o relatório pedido na rodada
// anterior, grava em configuracoes.mp_saldo e pede um novo. A Carteira soma os Pix depois disso.
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { listarRelatoriosMp, pedirRelatorioMp, saldoDoRelatorioMp } from "@/lib/mercadopago"

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "não autorizado" }, { status: 401 })
  if (!process.env.MP_ACCESS_TOKEN) return NextResponse.json({ ok: false, motivo: "sem token do Mercado Pago" })
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data } = await sb.from("configuracoes").select("valor").eq("chave", "mp_relatorio").maybeSingle()
  let pend: { pedido_em?: string; ultimo_id?: number } = {}
  try { pend = JSON.parse(String(data?.valor ?? "{}")) } catch {}

  const lista = await listarRelatoriosMp()
  let lido: number | null = null
  // Relatório novo (id maior que o último visto antes do pedido) = o que pedimos na rodada anterior
  const novo = pend.pedido_em ? lista.find(r => r.id > (pend.ultimo_id ?? 0)) : undefined
  if (novo) {
    lido = await saldoDoRelatorioMp(novo.file_name)
    if (lido != null) {
      const valor = { saldo: lido, em: pend.pedido_em, fonte: "mercadopago" }
      await sb.from("configuracoes").upsert({ chave: "mp_saldo", valor: JSON.stringify(valor), atualizado_em: new Date().toISOString() }, { onConflict: "chave" })
    }
  }
  // Ainda esperando o arquivo (menos de 30 min): não pede outro
  if (pend.pedido_em && !novo && Date.now() - +new Date(pend.pedido_em) < 30 * 60_000) return NextResponse.json({ ok: true, esperando: true })
  const pedidoEm = new Date().toISOString()
  await pedirRelatorioMp()
  await sb.from("configuracoes").upsert({ chave: "mp_relatorio", valor: JSON.stringify({ pedido_em: pedidoEm, ultimo_id: lista[0]?.id ?? 0 }), atualizado_em: pedidoEm }, { onConflict: "chave" })
  return NextResponse.json({ ok: true, saldo: lido })
}
