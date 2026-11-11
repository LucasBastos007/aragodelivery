export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { enviarTexto, zapiOk } from "@/lib/whatsSuporte"
import { STATUS_MSG } from "@/lib/roboPedidos"

// Avisos de andamento dos pedidos feitos pelo robô do WhatsApp (roda a cada minuto).
// Compara o status atual com o último avisado e manda a mensagem da etapa nova.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "não autorizado" }, { status: 401 })
  if (!zapiOk()) return NextResponse.json({ ok: true, zapi: "não configurada" })
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const desde = new Date(Date.now() - 2 * 86400_000).toISOString()
  const { data } = await sb.from("whats_pedidos").select("pedido_id, telefone, ultimo_status, pedidos!inner(codigo, status, motoboy:motoboys(nome))").gte("criado_em", desde)
  let enviados = 0
  for (const w of (data ?? []) as any[]) {
    const p = w.pedidos, atual: string = p.status
    if (atual === w.ultimo_status) continue
    // Etapas parecidas não geram aviso repetido (aceito/preparando, coletado/em_rota)
    const grupo = (s: string | null) => ({ aceito: "prep", preparando: "prep", pronto: "pronto", aguardando_aceite: "pronto", indo_para_loja: "pronto", na_loja: "pronto", coletado: "rota", em_rota: "rota" } as Record<string, string>)[s ?? ""] ?? s
    let msg: string | null = null
    if (w.ultimo_status === "aguardando_pagamento" && atual === "pendente") msg = `Pagamento confirmado! ✅ O pedido #${p.codigo} foi para a loja.`
    else if (grupo(atual) !== grupo(w.ultimo_status)) {
      const f = STATUS_MSG[atual === "aguardando_aceite" || atual === "indo_para_loja" || atual === "na_loja" ? "pronto" : atual]
      msg = f ? f(p.codigo, p.motoboy?.nome?.split(" ")[0]) : (atual === "recusado" ? `A loja não conseguiu aceitar o pedido #${p.codigo}. Se foi pago online, o valor volta sozinho. Responda "atendente" se precisar.` : null)
    }
    if (msg) { await enviarTexto(w.telefone, msg).catch(e => console.error("[ROBO STATUS]", e)); enviados++ }
    await sb.from("whats_pedidos").update({ ultimo_status: atual }).eq("pedido_id", w.pedido_id)
  }
  return NextResponse.json({ ok: true, enviados })
}
