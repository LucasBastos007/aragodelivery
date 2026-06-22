import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()
    if (!email || !senha) return NextResponse.json({ error: "Email e senha obrigatórios." }, { status: 400 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Usa service role para bypassar RLS ao buscar a loja
    const client = createClient(url, serviceKey || anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await client
      .from("lojas")
      .select("id, nome, status, email, senha")
      .eq("email", email.trim().toLowerCase())
      .single()

    if (error || !data) return NextResponse.json({ error: "Email não encontrado. Verifique o e-mail informado no cadastro." }, { status: 404 })
    if (!data.senha || data.senha !== senha) return NextResponse.json({ error: "Senha incorreta." }, { status: 401 })
    if (data.status === "pendente") return NextResponse.json({ error: "Seu cadastro ainda não foi processado. Assine o contrato enviado por e-mail ou aguarde contato da nossa equipe." }, { status: 403 })
    if (data.status === "contrato_assinado") return NextResponse.json({ error: "Contrato assinado! Sua loja será ativada em breve pela equipe Chegô." }, { status: 403 })
    if (data.status === "suspenso") return NextResponse.json({ error: "Esta conta foi suspensa. Entre em contato com o suporte." }, { status: 403 })

    return NextResponse.json({ ok: true, loja_id: data.id, loja_nome: data.nome })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erro interno" }, { status: 500 })
  }
}
