export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { consultarTransferencia } from "@/lib/asaas"

// Comprovantes de pagamento (20/10/2026): anexar (foto ou PDF) e abrir. Ficam na pasta privada
// "comprovantes"; pra abrir, o painel gera um link que vale 2 minutos.
// Pix pago pelo Asaas já nasce com comprovante: o campo guarda "asaas:<id da transferência>" e
// abrir leva direto ao comprovante oficial do Asaas.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const TABELA: Record<string, string> = { movimento: "movimentos_financeiros", saque: "saques", despesa: "despesas" }

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const fd = await req.formData().catch(() => null)
  const tipo = String(fd?.get("tipo") ?? ""), id = String(fd?.get("id") ?? ""), arq = fd?.get("arquivo") as File | null
  if (!TABELA[tipo] || !id || !arq) return NextResponse.json({ error: "Escolha o arquivo do comprovante." }, { status: 400 })
  if (arq.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Arquivo muito grande (até 8 MB)." }, { status: 400 })
  if (!/^(image\/|application\/pdf)/.test(arq.type)) return NextResponse.json({ error: "Use foto ou PDF." }, { status: 400 })
  const ext = (arq.name.split(".").pop() || (arq.type === "application/pdf" ? "pdf" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5)
  const path = `${tipo}/${id}-${Date.now()}.${ext}`
  const { error } = await sb.storage.from("comprovantes").upload(path, Buffer.from(await arq.arrayBuffer()), { contentType: arq.type, upsert: false })
  if (error) return NextResponse.json({ error: "Não foi possível guardar o arquivo: " + error.message }, { status: 500 })
  const { error: e2 } = await sb.from(TABELA[tipo]).update({ comprovante_path: path }).eq("id", id)
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  return NextResponse.json({ ok: true, path })
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const u = new URL(req.url), tipo = u.searchParams.get("tipo") ?? "", id = u.searchParams.get("id") ?? ""
  if (!TABELA[tipo] || !id) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 })
  const { data } = await sb.from(TABELA[tipo]).select("comprovante_path").eq("id", id).maybeSingle()
  const path = (data as any)?.comprovante_path
  if (!path) return NextResponse.json({ error: "Sem comprovante" }, { status: 404 })
  if (String(path).startsWith("asaas:")) {
    try {
      const t = await consultarTransferencia(String(path).slice(6))
      if (t.transactionReceiptUrl) return NextResponse.redirect(t.transactionReceiptUrl)
      const txt = t.status === "FAILED" || t.status === "CANCELLED" ? `O Asaas não concluiu este Pix (${t.failReason || t.status}). Confira no Asaas antes de pagar de novo.`
        : "O Pix ainda está sendo processado pelo Asaas. O comprovante aparece aqui em alguns minutos."
      return new NextResponse(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font:16px system-ui;padding:24px;max-width:480px">${txt}</body>`, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    } catch (e: any) { return NextResponse.json({ error: "Não consegui falar com o Asaas: " + (e?.message ?? e) }, { status: 502 }) }
  }
  const { data: s, error } = await sb.storage.from("comprovantes").createSignedUrl(path, 120)
  if (error || !s) return NextResponse.json({ error: "Não foi possível abrir" }, { status: 500 })
  return NextResponse.redirect(s.signedUrl)
}
