export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireMotoboy, unauthorized } from "@/lib/session"
import { saldoDoMotoboy } from "@/lib/saldosRepasse"
import { ymdBrt } from "@/lib/repasseLoja"

// Saldo do motoboy no app dele (20/10/2026): a mesma conta do fechamento e do admin, desde 16/10.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

export async function GET(req: NextRequest) {
  const s = requireMotoboy(req); if (!s) return unauthorized()
  const id = (s as any).motoboy_id
  try {
    const [saldo, ultimoPagamento] = await Promise.all([saldoDoMotoboy(sb, id, ymdBrt()), ultimoPagamentoDe(id)])
    return NextResponse.json({ ...saldo, ultimoPagamento })
  }
  catch { return NextResponse.json({ error: "Não foi possível calcular o saldo agora." }, { status: 503 }) }
}

// Último pagamento (24/10/2026): mostra no app pra o motoboy entender por que o saldo não é "ontem + hoje"
// quando o Pix sai no meio do dia. Vale o pago pelo painel (movimento) ou saque pago, o mais recente.
async function ultimoPagamentoDe(id: string): Promise<{ valor: number; em: string } | null> {
  const [{ data: mov }, { data: saq }] = await Promise.all([
    sb.from("movimentos_financeiros").select("valor, ocorrido_em").eq("motoboy_id", id).eq("tipo", "pagamento").is("cancelado_em", null).order("ocorrido_em", { ascending: false }).limit(1),
    sb.from("saques").select("valor, pago_em").eq("motoboy_id", id).eq("tipo", "motoboy").eq("status", "pago").not("pago_em", "is", null).order("pago_em", { ascending: false }).limit(1),
  ])
  const a = mov?.[0] ? { valor: Number(mov[0].valor), em: mov[0].ocorrido_em as string } : null
  const b = saq?.[0] ? { valor: Number(saq[0].valor), em: saq[0].pago_em as string } : null
  if (!a || !b) return a ?? b
  return new Date(a.em) >= new Date(b.em) ? a : b
}
