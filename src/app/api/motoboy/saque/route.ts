export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSession, unauthorized } from "@/lib/session"
import { notificarSaqueSolicitado } from "@/lib/email"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const sess = getSession(req)
  if (sess?.role !== "motoboy") return unauthorized()

  const { motoboy_id } = sess as any
  const { valor } = await req.json()

  if (!valor || valor <= 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
  }

  const sb = adminSb()

  const { data: mb } = await sb
    .from("motoboys")
    .select("nome, pix_chave, saldo")
    .eq("id", motoboy_id)
    .single()

  if (!mb) return NextResponse.json({ error: "Motoboy não encontrado" }, { status: 404 })
  if (!mb.pix_chave) return NextResponse.json({ error: "Cadastre sua chave PIX antes de solicitar" }, { status: 422 })
  if (valor > (mb.saldo ?? 0) + 0.001) return NextResponse.json({ error: "Valor maior que o saldo disponível" }, { status: 422 })

  const { data: saque, error } = await sb
    .from("saques")
    .insert({ tipo: "motoboy", motoboy_id, valor, pix_chave: mb.pix_chave, status: "solicitado" })
    .select("id")
    .single()

  if (error || !saque) {
    return NextResponse.json({ error: "Erro ao criar saque" }, { status: 500 })
  }

  // Notifica o admin por email (não bloqueia a resposta)
  notificarSaqueSolicitado({
    nomeMotoboy: mb.nome,
    valor,
    pixChave: mb.pix_chave,
    saqueId: saque.id,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
