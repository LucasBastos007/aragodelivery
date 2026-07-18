import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://chegodelivery.com"
const INTERNAL = process.env.INTERNAL_API_SECRET ?? ""

// Pedidos em aguardando_aceite há mais de 2 min → re-escalada
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 })
  }

  const doisMinAtras = new Date(Date.now() - 45 * 1000).toISOString()

  const { data: travados } = await supabase
    .from("pedidos")
    .select("id, motoboy_id")
    .eq("status", "aguardando_aceite")
    .lt("atualizado_em", doisMinAtras)

  if (!travados || travados.length === 0) {
    return NextResponse.json({ ok: true, re_escalados: 0 })
  }

  let count = 0
  for (const pedido of travados) {
    await fetch(`${BASE}/api/escalada`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL,
      },
      body: JSON.stringify({
        pedido_id:          pedido.id,
        motoboy_recusou_id: pedido.motoboy_id ?? undefined,
      }),
    }).catch(() => {})
    count++
  }

  return NextResponse.json({ ok: true, re_escalados: count })
}
