import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      email, senha, nome, descricao, categoria, endereco, telefone,
      taxa_entrega, tempo_min, tempo_max, comissao, nome_responsavel,
      cpf_responsavel, cnpj, pix_key, valor_minimo, aceita_retirada,
    } = body

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Cliente com service role para bypassar RLS
    const admin = createClient(url, serviceKey || anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Criar usuário no auth (service role permite criar sem confirmação de email)
    let userId: string | null = null
    if (serviceKey) {
      const { data, error } = await admin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: senha,
        email_confirm: true,
      })
      // Ignora erro de "já existe" — pega o id se veio
      if (!error || error.message.toLowerCase().includes("already")) {
        userId = data?.user?.id ?? null
      }
      // Se usuário já existe, busca o id pelo email
      if (!userId && error) {
        const { data: list } = await admin.auth.admin.listUsers()
        const found = list?.users?.find(
          (u: any) => u.email === email.trim().toLowerCase()
        )
        userId = found?.id ?? null
      }
    } else {
      // Fallback sem service role: signUp normal
      const anonClient = createClient(url, anonKey)
      const { data } = await anonClient.auth.signUp({
        email: email.trim().toLowerCase(),
        password: senha,
      })
      userId = data.user?.id ?? null
    }

    const senhaHash = senha ? await bcrypt.hash(senha, 12) : null

    // Inserir loja usando client com service role
    const { error: lojaError } = await admin.from("lojas").insert({
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
      senha: senhaHash,
      pix_key,
      valor_minimo,
      aceita_retirada,
      ...(userId ? { user_id: userId } : {}),
    })

    if (lojaError) {
      return NextResponse.json(
        { error: lojaError.message, code: lojaError.code, details: lojaError.details },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erro interno" }, { status: 500 })
  }
}
