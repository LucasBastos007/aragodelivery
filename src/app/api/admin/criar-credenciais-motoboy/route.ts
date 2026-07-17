import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { requireAdmin } from "@/lib/session"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function gerarSenhaTemp(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"
  let s = ""
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const { motoboy_id } = await req.json()
  if (!motoboy_id) return NextResponse.json({ error: "motoboy_id obrigatório." }, { status: 400 })

  const sb = adminClient()

  const { data: motoboy, error: findErr } = await sb
    .from("motoboys")
    .select("id, nome, email, status")
    .eq("id", motoboy_id)
    .single()

  if (findErr || !motoboy) return NextResponse.json({ error: "Motoboy não encontrado." }, { status: 404 })
  if (!motoboy.email) return NextResponse.json({ error: "Motoboy não possui e-mail cadastrado." }, { status: 400 })

  const senhaTemp = gerarSenhaTemp()
  const hash = await bcrypt.hash(senhaTemp, 12)

  const { error: updateErr } = await sb
    .from("motoboys")
    .update({ senha: hash })
    .eq("id", motoboy_id)

  if (updateErr) return NextResponse.json({ error: "Erro ao salvar credenciais." }, { status: 500 })

  return NextResponse.json({ ok: true, email: motoboy.email, senhaTemporaria: senhaTemp })
}
