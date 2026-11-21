import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function GET(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()

  const { data, error } = await adminClient()
    .from("clientes_avulsos")
    .select("*")
    .eq("loja_id", sess.loja_id)
    .order("total_pedidos", { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()

  const { nome, telefone, endereco, valor_pedido, lat, lng, zona_rural, detalhe_rural } = await req.json()
  // Local no mapa do cliente (Lucas, 21/11/2026): o último pino usado vale pro próximo pedido.
  // Se as colunas ainda não existirem no banco, grava sem elas.
  const coordOk = typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  const local = coordOk ? { lat, lng, zona_rural: zona_rural === true, detalhe_rural: typeof detalhe_rural === "string" ? detalhe_rural.slice(0, 300) || null : null } : {}
  const semColuna = (e: any) => /lat|lng|zona_rural|detalhe_rural/.test(String(e?.message ?? "")) && /column|schema/i.test(String(e?.message ?? ""))
  if (!nome) return NextResponse.json({ error: "nome obrigatório" }, { status: 400 })

  const db = adminClient()
  const loja_id = sess.loja_id
  const valor = parseFloat(valor_pedido) || 0

  // Tenta encontrar cliente existente
  let existente: any = null
  if (telefone && telefone.trim()) {
    const { data } = await db
      .from("clientes_avulsos")
      .select("id, total_pedidos, valor_total")
      .eq("loja_id", loja_id)
      .eq("telefone", telefone.trim())
      .maybeSingle()
    existente = data
  }
  if (!existente) {
    const { data } = await db
      .from("clientes_avulsos")
      .select("id, total_pedidos, valor_total")
      .eq("loja_id", loja_id)
      .ilike("nome", nome.trim())
      .maybeSingle()
    existente = data
  }

  if (existente) {
    const upd = (extra: object) => db
      .from("clientes_avulsos")
      .update({
        nome: nome.trim(),
        telefone: telefone?.trim() || existente.telefone,
        endereco: endereco?.trim() || existente.endereco,
        total_pedidos: existente.total_pedidos + 1,
        valor_total: (existente.valor_total ?? 0) + valor,
        atualizado_em: new Date().toISOString(),
        ...extra,
      })
      .eq("id", existente.id)
    const r = await upd(local)
    if (r.error && semColuna(r.error)) await upd({})
  } else {
    const ins = (extra: object) => db.from("clientes_avulsos").insert({
      ...extra,
      loja_id,
      nome: nome.trim(),
      telefone: telefone?.trim() || null,
      endereco: endereco?.trim() || null,
      total_pedidos: 1,
      valor_total: valor,
    })
    const r = await ins(local)
    if (r.error && semColuna(r.error)) await ins({})
  }

  return NextResponse.json({ ok: true })
}
