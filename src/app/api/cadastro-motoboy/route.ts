import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

// Colunas reais da tabela motoboys (verificado no schema):
// nome, email, telefone, cpf, veiculo, placa, pix_key, status, disponivel
// NÃO existem: cnh, endereco, user_id

export async function POST(req: NextRequest) {
  const { nome, email, telefone, cpf, veiculo, placa, pix_key } = await req.json()

  if (!nome || !email || !cpf) {
    return NextResponse.json({ error: "Dados obrigatórios ausentes" }, { status: 400 })
  }

  const { error } = await sb.from("motoboys").insert({
    nome,
    email,
    telefone: telefone || null,
    cpf,
    veiculo: veiculo || null,
    placa: placa || "N/A",
    pix_key: pix_key || null,
    status: "pendente",
    disponivel: false,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
