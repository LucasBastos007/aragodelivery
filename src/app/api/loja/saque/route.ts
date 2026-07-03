export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSession, unauthorized } from "@/lib/session"
import { notificarSaqueLojistaSolicitado } from "@/lib/email"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const sess = getSession(req)
  if (sess?.role !== "loja") return unauthorized()

  const { loja_id } = sess as any
  const { valor } = await req.json()

  if (!valor || valor <= 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
  }

  const sb = adminSb()

  const { data: loja } = await sb
    .from("lojas")
    .select("nome, pix_chave, comissao, plano_mensalidade")
    .eq("id", loja_id)
    .single()

  if (!loja) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 })
  if (!loja.pix_chave) return NextResponse.json({ error: "Cadastre sua chave PIX no perfil antes de solicitar" }, { status: 422 })

  const { data: saque, error } = await sb
    .from("saques")
    .insert({ tipo: "lojista", loja_id, valor, pix_chave: loja.pix_chave, status: "solicitado" })
    .select("id")
    .single()

  if (error || !saque) {
    return NextResponse.json({ error: "Erro ao criar saque" }, { status: 500 })
  }

  notificarSaqueLojistaSolicitado({
    nomeLoja: loja.nome,
    valor,
    pixChave: loja.pix_chave,
    saqueId: saque.id,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
