import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function gerarCodigo() {
  return `AV${Math.floor(1000 + Math.random() * 9000)}`
}

export async function POST(req: NextRequest) {
  try {
    const { loja_id, cliente_nome, cliente_tel, endereco, valor_pedido, taxa_entrega, observacao } =
      await req.json()

    if (!loja_id || !cliente_nome || !endereco) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })
    }

    const { data: loja } = await admin
      .from("lojas").select("plano, status").eq("id", loja_id).single()

    if (!loja || loja.status !== "ativo") {
      return NextResponse.json({ error: "Loja não está ativa" }, { status: 403 })
    }
    if (!loja.plano || loja.plano === "gold") {
      return NextResponse.json({ error: "Plano não inclui entrega avulsa" }, { status: 403 })
    }

    const { data: entrega, error } = await admin
      .from("entregas_avulsas")
      .insert({
        loja_id,
        cliente_nome,
        cliente_tel:   cliente_tel  || "",
        endereco,
        valor_pedido:  valor_pedido || 0,
        taxa_entrega:  taxa_entrega || 0,
        observacao:    observacao   || "",
        status:        "aguardando",
        codigo:        gerarCodigo(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, entrega })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const loja_id = req.nextUrl.searchParams.get("loja_id")
  if (!loja_id) return NextResponse.json({ error: "loja_id required" }, { status: 400 })

  const { data, error } = await admin
    .from("entregas_avulsas")
    .select("*")
    .eq("loja_id", loja_id)
    .order("criado_em", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entregas: data })
}
