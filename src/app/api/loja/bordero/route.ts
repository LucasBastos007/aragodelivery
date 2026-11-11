export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"

// Borderô no painel da loja (20/10/2026): a relação de pedidos que o Chegô mandou conferir antes do
// repasse. A loja responde "está certo" ou "tem algo errado" (com o que está errado).
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

export async function GET(req: NextRequest) {
  const s = requireLoja(req); if (!s) return unauthorized()
  const { data, error } = await sb.from("borderos").select("id,status,valor,qtd,periodo_ini,periodo_fim,enviado_em,respondido_em,resposta,pago_em,detalhe")
    .eq("tipo", "loja").eq("loja_id", s.loja_id).neq("status", "cancelado").order("enviado_em", { ascending: false }).limit(8)
  if (error) return NextResponse.json({ borderos: [] })
  return NextResponse.json({ borderos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const s = requireLoja(req); if (!s) return unauthorized()
  const { id, acao, resposta } = await req.json().catch(() => ({}))
  if (!id || (acao !== "conferido" && acao !== "contestado")) return NextResponse.json({ error: "Resposta inválida." }, { status: 400 })
  const txt = String(resposta ?? "").trim().slice(0, 600)
  if (acao === "contestado" && txt.length < 3) return NextResponse.json({ error: "Conte o que está errado (pedido, valor)." }, { status: 400 })
  const { data, error } = await sb.from("borderos").update({ status: acao, resposta: txt || null, respondido_em: new Date().toISOString() })
    .eq("id", id).eq("loja_id", s.loja_id).in("status", ["enviado", "conferido", "contestado"]).select("id").maybeSingle()
  if (error || !data) return NextResponse.json({ error: "Esse borderô não pode mais ser respondido." }, { status: 409 })
  return NextResponse.json({ ok: true })
}
