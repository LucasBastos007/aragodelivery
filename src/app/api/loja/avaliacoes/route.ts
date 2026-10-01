import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// PATCH — lojista responde uma avaliação (avaliacoes.resposta_loja/respondido_em já
// existiam no schema, só não tinha nenhuma tela usando — pedido do usuário, 2026-09-25).
export async function PATCH(req: NextRequest) {
  const _sess = requireLoja(req)
  if (!_sess) return unauthorized()
  const loja_id = _sess.loja_id

  const { id, resposta } = await req.json()
  if (!id || !resposta || !String(resposta).trim()) {
    return NextResponse.json({ error: "id e resposta são obrigatórios" }, { status: 400 })
  }
  const { error } = await adminClient()
    .from("avaliacoes")
    .update({ resposta_loja: String(resposta).trim(), respondido_em: new Date().toISOString() })
    .eq("id", id).eq("loja_id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
