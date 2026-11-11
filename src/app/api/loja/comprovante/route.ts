export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"
import { consultarTransferencia } from "@/lib/asaas"

// Comprovante do repasse pra loja (20/10/2026): só abre pagamento da PRÓPRIA loja.
// Pix pelo Asaas abre o comprovante oficial; pago por fora abre o arquivo anexado (link de 2 minutos).
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

export async function GET(req: NextRequest) {
  const s = requireLoja(req); if (!s) return unauthorized()
  const id = new URL(req.url).searchParams.get("id") ?? ""
  if (!id) return NextResponse.json({ error: "Pagamento inválido." }, { status: 400 })
  const { data } = await sb.from("movimentos_financeiros").select("comprovante_path").eq("id", id).eq("loja_id", s.loja_id).in("tipo", ["repasse", "pagamento"]).is("cancelado_em", null).maybeSingle()
  const path = (data as any)?.comprovante_path
  if (!path) return NextResponse.json({ error: "O comprovante ainda não foi anexado." }, { status: 404 })
  if (String(path).startsWith("asaas:")) {
    try {
      const t = await consultarTransferencia(String(path).slice(6))
      if (t.transactionReceiptUrl) return NextResponse.redirect(t.transactionReceiptUrl)
      return new NextResponse(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font:16px system-ui;padding:24px;max-width:480px">O Pix está sendo processado. O comprovante aparece aqui em alguns minutos.</body>`, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    } catch { return NextResponse.json({ error: "Não foi possível abrir o comprovante agora." }, { status: 502 }) }
  }
  const { data: u, error } = await sb.storage.from("comprovantes").createSignedUrl(path, 120)
  if (error || !u) return NextResponse.json({ error: "Não foi possível abrir o comprovante." }, { status: 500 })
  return NextResponse.redirect(u.signedUrl)
}
