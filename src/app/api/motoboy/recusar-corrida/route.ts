export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireMotoboy, unauthorized } from "@/lib/session"

// Motoboy recusou (ou deixou o tempo acabar) numa corrida oferecida (20/10/2026).
// Antes o app chamava /api/escalada direto, que não aceita sessão de motoboy (401), e o
// "plano B" gravava no banco pelo navegador. Agora tudo acontece aqui, com a sessão dele:
// conta a recusa, oferece ao próximo motoboy e, se a escalada falhar, devolve pra fila.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

export async function POST(req: NextRequest) {
  const sess = requireMotoboy(req)
  if (!sess) return unauthorized()
  const motoboy_id = sess.motoboy_id
  const { pedido_id, por_tempo } = await req.json().catch(() => ({}))
  if (!pedido_id) return NextResponse.json({ error: "pedido_id obrigatório" }, { status: 400 })

  // Só mexe se a oferta ainda está parada nele (ou sem dono)
  const { data: p } = await sb.from("pedidos").select("id, status, motoboy_id").eq("id", pedido_id).maybeSingle()
  if (!p || p.status !== "aguardando_aceite" || (p.motoboy_id && p.motoboy_id !== motoboy_id)) return NextResponse.json({ ok: true, ignorado: true })

  if (!por_tempo) {
    const { data: mb } = await sb.from("motoboys").select("recusas").eq("id", motoboy_id).maybeSingle()
    if (mb) await sb.from("motoboys").update({ recusas: (Number((mb as any).recusas) || 0) + 1 }).eq("id", motoboy_id)
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
  let escalou = false
  try {
    const r = await fetch(`${site}/api/escalada`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "" },
      body: JSON.stringify({ pedido_id, motoboy_recusou_id: motoboy_id }),
    })
    escalou = r.ok
  } catch {}
  if (!escalou) {
    await sb.from("pedidos").update({ motoboy_id: null, status: "pronto" }).eq("id", pedido_id).eq("status", "aguardando_aceite")
  }
  return NextResponse.json({ ok: true, escalou })
}
