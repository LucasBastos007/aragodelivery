import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { nome, email, senha, telefone, cpf, veiculo, placa, pix_key, documentos } = body

  if (!nome || !email || !cpf) {
    return NextResponse.json({ error: "Dados obrigatórios ausentes" }, { status: 400 })
  }

  const senhaHash = senha ? await bcrypt.hash(senha, 12) : null

  const { error } = await sb.from("motoboys").insert({
    nome,
    email,
    senha:     senhaHash || null,
    telefone:  telefone  || null,
    cpf,
    veiculo:   veiculo   || null,
    placa:     placa     || "N/A",
    pix_key:   pix_key   || null,
    documentos: documentos ?? null,
    status: "pendente",
    disponivel: false,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
