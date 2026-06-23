import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

export async function POST(req: NextRequest) {
  const { nome, email, telefone, cpf, veiculo, placa, cnh, endereco, pix_key, user_id } = await req.json()

  if (!nome || !email || !cpf) {
    return NextResponse.json({ error: "Dados obrigatórios ausentes" }, { status: 400 })
  }

  const { error } = await sb.from("motoboys").insert({
    nome, email, telefone, cpf,
    veiculo, placa: placa || null, cnh: cnh || null,
    endereco, pix_key,
    status: "pendente",
    disponivel: false,
    ...(user_id ? { user_id } : {}),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
