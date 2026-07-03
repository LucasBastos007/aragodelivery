export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSession, unauthorized } from "@/lib/session"
import { enviarComprovanteTransferencia } from "@/lib/email"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const sess = getSession(req)
  if (sess?.role !== "admin") return unauthorized()

  const { saque_id } = await req.json()
  if (!saque_id) return NextResponse.json({ error: "saque_id obrigatório" }, { status: 400 })

  const sb = adminSb()

  const { data: saque } = await sb
    .from("saques")
    .select("*, loja:lojas(nome, email), motoboy:motoboys(nome, email)")
    .eq("id", saque_id)
    .single()

  if (!saque) return NextResponse.json({ error: "Saque não encontrado" }, { status: 404 })
  if (saque.status !== "solicitado") return NextResponse.json({ error: "Saque já processado" }, { status: 422 })

  await sb.from("saques").update({ status: "pago", pago_em: new Date().toISOString() }).eq("id", saque_id)

  // Envia comprovante de transferência para quem recebeu
  const nome  = saque.tipo === "lojista" ? saque.loja?.nome  : saque.motoboy?.nome
  const email = saque.tipo === "lojista" ? saque.loja?.email : saque.motoboy?.email

  if (email && nome) {
    enviarComprovanteTransferencia({
      email,
      nome,
      valor:    Number(saque.valor),
      pixChave: saque.pix_chave,
      tipo:     saque.tipo,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
