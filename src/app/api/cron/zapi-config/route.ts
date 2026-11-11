export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { zapi, zapiOk, chaveBot } from "@/lib/whatsSuporte"

// Liga o robô de pagamento: aponta o "ao receber mensagem" do Z-API para /api/whats/bot e grava
// o número da instância (usado no botão do WhatsApp). Roda pelo botão em Ferramentas do admin.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "não autorizado" }, { status: 401 })
  if (!zapiOk()) return NextResponse.json({ error: "Z-API não configurada no servidor." }, { status: 500 })
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chegodelivery.com"
  const passos: Record<string, unknown> = {}
  const dev = await zapi("device").catch(e => ({ erro: String(e) }))
  const numero = String((dev as any)?.phone ?? "").replace(/\D/g, "")
  passos.numero = numero ? `final ${numero.slice(-4)}` : dev
  if (numero) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    await sb.from("configuracoes").upsert({ chave: "whats_suporte", valor: numero }, { onConflict: "chave" })
  }
  const r = await zapi("update-webhook-received", "PUT", { value: `${site}/api/whats/bot?k=${chaveBot()}` }).catch(e => ({ erro: String(e) }))
  passos.webhook = (r as any)?.erro ?? "ligado"
  // Avisar também as mensagens enviadas pelo próprio WhatsApp da Chegô (para o robô pausar quando alguém da equipe responder)
  await zapi("update-notify-sent-by-me", "PUT", { notifySentByMe: true }).catch(() => {})
  return NextResponse.json({ ok: !!numero && passos.webhook === "ligado", ...passos })
}
