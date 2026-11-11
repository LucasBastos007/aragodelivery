export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"

// Reembolso feito pelo admin (20/10/2026, pedido do Lucas): sem o cliente pedir. Cria o reembolso
// do pedido como "solicitado" por admin; a decisão (devolver tudo ou parte) e o estorno pelo Asaas
// seguem o mesmo caminho de sempre (/api/reembolso/processar). GET busca o pedido pelo código.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const SEL = "id,codigo,total,status,forma_pagamento,forma_pagamento_2,nome_cliente,criado_em,loja:lojas(nome)"

async function achar(codigo: string) {
  const c = String(codigo ?? "").trim().replace(/^#/, "").toUpperCase()
  if (!/^[A-Z0-9]{4,10}$/.test(c)) return { erro: "Digite o código do pedido (ex.: Z5A4S3)." }
  const { data: p } = await sb.from("pedidos").select(SEL).eq("codigo", c).maybeSingle()
  if (!p) return { erro: `Pedido #${c} não encontrado.` }
  const { data: rs } = await sb.from("reembolsos").select("id,status,valor_aprovado").eq("pedido_id", (p as any).id).in("status", ["solicitado", "aprovado", "processando", "concluido"])
  return { p: p as any, abertos: rs ?? [] }
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const r = await achar(new URL(req.url).searchParams.get("codigo") ?? "")
  if ("erro" in r) return NextResponse.json({ error: r.erro }, { status: 404 })
  return NextResponse.json({ pedido: r.p, abertos: r.abertos })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const { codigo, motivo, descricao } = await req.json().catch(() => ({}))
  const r = await achar(codigo)
  if ("erro" in r) return NextResponse.json({ error: r.erro }, { status: 404 })
  if (r.abertos.some((x: any) => x.status === "solicitado")) return NextResponse.json({ error: "Esse pedido já tem um reembolso esperando decisão. Decida por ele na lista." }, { status: 409 })
  if (r.abertos.some((x: any) => x.status !== "solicitado")) return NextResponse.json({ error: "Esse pedido já teve reembolso aprovado. Não dá pra devolver de novo por aqui." }, { status: 409 })
  if (["pendente", "aguardando_pagamento"].includes(r.p.status)) return NextResponse.json({ error: "Esse pedido ainda não foi pago." }, { status: 422 })
  const { data, error } = await sb.from("reembolsos").insert({
    pedido_id: r.p.id, solicitado_por: "admin", motivo: String(motivo || "outro").slice(0, 40),
    descricao: String(descricao ?? "").trim().slice(0, 500) || "Reembolso feito pelo admin", status: "solicitado", valor_solicitado: Number(r.p.total),
  }).select("id").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, reembolso_id: (data as any).id })
}
