export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { criarSubconta } from "@/lib/asaas"
import { requireAdmin } from "@/lib/session"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// POST /api/admin/loja/criar-subconta
// Body: { loja_id: string }
// Cria uma subconta Asaas para a loja e salva o walletId
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { loja_id } = await req.json()
  if (!loja_id) return NextResponse.json({ error: "loja_id obrigatório" }, { status: 400 })

  const sb = adminSb()

  const { data: loja, error: lojaErr } = await sb
    .from("lojas")
    .select("id, nome, email, cnpj, cpf_responsavel, telefone, asaas_wallet_id")
    .eq("id", loja_id)
    .single()

  if (lojaErr || !loja) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 })

  if (loja.asaas_wallet_id) {
    return NextResponse.json({ ok: true, walletId: loja.asaas_wallet_id, jaExistia: true })
  }

  const cpfCnpj = loja.cnpj ?? loja.cpf_responsavel
  if (!cpfCnpj) {
    return NextResponse.json({ error: "Loja sem CNPJ ou CPF cadastrado" }, { status: 422 })
  }
  if (!loja.email) {
    return NextResponse.json({ error: "Loja sem e-mail cadastrado" }, { status: 422 })
  }

  try {
    const subconta = await criarSubconta({
      nome:        loja.nome,
      email:       loja.email,
      cpfCnpj,
      telefone:    loja.telefone,
      tipoEmpresa: loja.cnpj ? "LTDA" : "INDIVIDUAL",
    })

    await sb.from("lojas").update({ asaas_wallet_id: subconta.walletId }).eq("id", loja_id)

    return NextResponse.json({ ok: true, walletId: subconta.walletId })
  } catch (e: any) {
    console.error("[criar-subconta]", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
