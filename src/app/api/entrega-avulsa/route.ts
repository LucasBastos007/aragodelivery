import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"
import { notificarMotoboysDisponiveisAvulsa } from "@/lib/notificacoesMotoboy"

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function gerarCodigo() {
  return `AV${Math.floor(1000 + Math.random() * 9000)}`
}

export async function POST(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()
  const loja_id = sess.loja_id

  try {
    const { cliente_nome, cliente_tel, endereco, valor_pedido, taxa_entrega, observacao, cliente_lat, cliente_lng } =
      await req.json()

    if (!cliente_nome || !endereco) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })
    }
    if (!cliente_tel || !String(cliente_tel).trim()) {
      return NextResponse.json({ error: "Telefone do cliente é obrigatório" }, { status: 400 })
    }

    const { data: loja } = await admin
      .from("lojas").select("nome, plano, status, lat, lng, entrega_avulsa_liberada").eq("id", loja_id).single()

    if (!loja || loja.status !== "ativo") {
      return NextResponse.json({ error: "Loja não está ativa" }, { status: 403 })
    }
    if (!loja.entrega_avulsa_liberada && (!loja.plano || loja.plano === "gold")) {
      return NextResponse.json({ error: "Plano não inclui entrega avulsa" }, { status: 403 })
    }

    const { data: entrega, error } = await admin
      .from("entregas_avulsas")
      .insert({
        loja_id,
        loja_nome:    loja.nome    || null,
        loja_lat:     loja.lat     ?? null,
        loja_lng:     loja.lng     ?? null,
        cliente_nome,
        cliente_tel:  cliente_tel  || "",
        endereco,
        valor_pedido: valor_pedido || 0,
        taxa_entrega: taxa_entrega || 0,
        observacao:   observacao   || "",
        status:       "aguardando",
        codigo:       gerarCodigo(),
        cliente_lat:  cliente_lat  ?? null,
        cliente_lng:  cliente_lng  ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notifica TODOS os motoboys disponíveis simultaneamente
    notificarMotoboysDisponiveisAvulsa(admin, {
      avulsa_id: entrega.id,
      codigo: entrega.codigo,
      taxa_entrega: taxa_entrega || 0,
    }).catch(() => {})

    return NextResponse.json({ ok: true, entrega })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()
  const loja_id = sess.loja_id

  const { data, error } = await admin
    .from("entregas_avulsas")
    .select("*")
    .eq("loja_id", loja_id)
    .order("criado_em", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entregas: data })
}
