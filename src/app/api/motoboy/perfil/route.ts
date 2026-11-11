export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireMotoboy, unauthorized } from "@/lib/session"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Salva os dados do "Meu perfil" via admin client (bypassa RLS) — a tela usava o
// cliente supabase direto do navegador com a chave anon, e como esse app não usa
// Supabase Auth (sessão própria via cookie), qualquer RLS na tabela motoboys rejeitava
// o update silenciosamente (o código nem checava o erro). Bug real reportado: "não
// salva nada". Mesmo padrão já usado em /api/motoboy/status.
export async function POST(req: NextRequest) {
  const sess = requireMotoboy(req)
  if (!sess) return unauthorized()

  const { nome, telefone, pix_key } = await req.json()
  if (!nome?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })

  const { error } = await adminClient()
    .from("motoboys")
    .update({
      nome: nome.trim(),
      telefone: (telefone ?? "").trim(),
      pix_key: (pix_key ?? "").trim(),
    })
    .eq("id", sess.motoboy_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Só a chave Pix e o banco (tela Ganhos/financeiro). Antes gravava direto do navegador (20/10/2026).
export async function PATCH(req: NextRequest) {
  const sess = requireMotoboy(req)
  if (!sess) return unauthorized()
  const { pix_key } = await req.json().catch(() => ({}))
  if (typeof pix_key !== "string" || !pix_key.trim()) return NextResponse.json({ error: "Informe a chave Pix" }, { status: 400 })
  const { error } = await adminClient().from("motoboys").update({ pix_key: pix_key.trim().slice(0, 1000) }).eq("id", sess.motoboy_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
