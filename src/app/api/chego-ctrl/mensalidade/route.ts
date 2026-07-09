import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

const PLANO_VALOR: Record<string, number> = { select: 149, prime: 497, black: 997 }

function mesReferencia(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function proxVencimento(dia: number): Date {
  const hoje = new Date()
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), dia)
  if (d <= hoje) d.setMonth(d.getMonth() + 1)
  return d
}

async function getAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get("admin_token")?.value
  if (!token) return null
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data } = await sb.from("admins").select("nome").eq("token", token).single()
  return data
}

// POST /api/chego-ctrl/mensalidade — confirma pagamento ou atualiza dia
export async function POST(req: Request) {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const body = await req.json()
  const { acao, loja_id, mensalidade_id, dia } = body

  // Atualizar dia de vencimento
  if (acao === "atualizar_dia") {
    if (!dia || dia < 1 || dia > 28) {
      return NextResponse.json({ error: "Dia inválido (1–28)" }, { status: 400 })
    }
    const proximoVenc = proxVencimento(Number(dia))
    await sb.from("lojas").update({
      mensalidade_dia: dia,
      mensalidade_vencimento: proximoVenc.toISOString().slice(0, 10),
    }).eq("id", loja_id)
    return NextResponse.json({ ok: true })
  }

  // Confirmar pagamento
  if (acao === "confirmar_pagamento") {
    const { data: mens } = await sb.from("mensalidades").select("*, loja:lojas(plano, mensalidade_dia)").eq("id", mensalidade_id).single()
    if (!mens) return NextResponse.json({ error: "Mensalidade não encontrada" }, { status: 404 })

    const agora = new Date()
    await sb.from("mensalidades").update({
      status: "pago",
      pago_em: agora.toISOString(),
      confirmado_por: admin.nome,
    }).eq("id", mensalidade_id)

    // Reativa a loja se estava suspensa por inadimplência
    const { data: loja } = await sb.from("lojas").select("status").eq("id", mens.loja_id).single()
    if (loja?.status === "suspenso") {
      await sb.from("lojas").update({ status: "ativo", mensalidade_paga_em: agora.toISOString() }).eq("id", mens.loja_id)
    } else {
      await sb.from("lojas").update({ mensalidade_paga_em: agora.toISOString() }).eq("id", mens.loja_id)
    }

    // Gera mensalidade do próximo mês automaticamente
    const dia = (mens.loja as any)?.mensalidade_dia ?? 10
    const valor = PLANO_VALOR[(mens.loja as any)?.plano] ?? 149
    const proximoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, dia)
    const refProximo = mesReferencia(proximoMes)
    await sb.from("mensalidades").upsert({
      loja_id: mens.loja_id,
      valor,
      mes_referencia: refProximo,
      vencimento: proximoMes.toISOString().slice(0, 10),
      status: "pendente",
    }, { onConflict: "loja_id,mes_referencia", ignoreDuplicates: true })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 })
}

// GET /api/chego-ctrl/mensalidade — lista mensalidades com status
export async function GET() {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const hoje = new Date()
  const mesAtual = mesReferencia(hoje)

  // Busca lojas com plano pago
  const { data: lojas } = await sb.from("lojas")
    .select("id, nome, plano, mensalidade_dia, status, logo_url, mensalidade_paga_em")
    .in("plano", ["select", "prime", "black"])
    .order("nome")

  // Busca mensalidades dos últimos 2 meses
  const { data: mens } = await sb.from("mensalidades")
    .select("*")
    .in("mes_referencia", [mesAtual, mesReferencia(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1))])
    .order("vencimento")

  return NextResponse.json({ lojas: lojas ?? [], mensalidades: mens ?? [] })
}
