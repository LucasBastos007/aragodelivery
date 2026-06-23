import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { enviarBoasVindasLoja } from "@/lib/email"
import { requireAdmin, unauthorized } from "@/lib/session"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()

  const { loja_id } = await req.json()
  if (!loja_id) return NextResponse.json({ error: "loja_id obrigatório" }, { status: 400 })

  const sb = adminClient()

  const { data: loja, error: findErr } = await sb
    .from("lojas")
    .select("id, nome, email, senha")
    .eq("id", loja_id)
    .single()

  if (findErr || !loja) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 })

  const { error } = await sb.from("lojas").update({ status: "ativo" }).eq("id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (loja.email) {
    enviarBoasVindasLoja({
      nome: loja.nome,
      email: loja.email,
      senha: loja.senha ?? "",
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
