import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      email, senha, nome, descricao, categoria, endereco, telefone,
      taxa_entrega, tempo_min, tempo_max, comissao, nome_responsavel,
      cpf_responsavel, cnpj, pix_key, valor_minimo, aceita_retirada,
    } = body

    const supabase = adminClient()

    // Criar usuário no Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: senha,
      email_confirm: true,
    })

    if (authError && authError.message !== "User already registered") {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData?.user?.id ?? null

    // Inserir loja
    const { error: lojaError } = await supabase.from("lojas").insert({
      nome,
      descricao,
      categoria,
      endereco,
      telefone,
      taxa_entrega,
      tempo_min,
      tempo_max,
      status: "pendente",
      aberto: false,
      comissao,
      nome_responsavel,
      cpf_responsavel,
      cnpj,
      email: email.trim().toLowerCase(),
      pix_key,
      valor_minimo,
      aceita_retirada,
      ...(userId ? { user_id: userId } : {}),
    })

    if (lojaError) {
      return NextResponse.json({ error: lojaError.message, details: lojaError }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erro interno" }, { status: 500 })
  }
}
