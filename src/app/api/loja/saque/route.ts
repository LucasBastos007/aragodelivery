export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"
import { notificarSaqueLojistaSolicitado } from "@/lib/email"
import { solicitarSaque } from "@/lib/financeiroLoja"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const MOTIVO_STATUS: Record<string, number> = {
  VALOR_INVALIDO: 400,
  LOJA_NAO_ENCONTRADA: 404,
  SEM_PIX: 422,
  SALDO_INSUFICIENTE: 422,
}
const MOTIVO_MSG: Record<string, string> = {
  VALOR_INVALIDO: "Valor inválido",
  LOJA_NAO_ENCONTRADA: "Loja não encontrada",
  SEM_PIX: "Cadastre sua chave PIX no perfil antes de solicitar",
  SALDO_INSUFICIENTE: "Valor maior que o saldo disponível",
}

export async function POST(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()

  const { valor } = await req.json()
  const sb = adminSb()

  // Todo o "recalcula saldo + valida + insere" roda dentro de uma única transação SQL
  // (solicitar_saque_loja, com advisory lock por loja_id) — nunca mais um check em JS
  // seguido de um insert separado, que era vulnerável a duas solicitações simultâneas
  // consumindo o mesmo saldo.
  const resultado = await solicitarSaque(sb, sess.loja_id, Number(valor))

  if (!resultado.ok) {
    const motivo = resultado.motivo ?? "ERRO"
    return NextResponse.json(
      { error: MOTIVO_MSG[motivo] ?? "Erro ao solicitar saque" },
      { status: MOTIVO_STATUS[motivo] ?? 422 }
    )
  }

  const { data: loja } = await sb.from("lojas").select("nome, pix_key").eq("id", sess.loja_id).single()
  notificarSaqueLojistaSolicitado({
    nomeLoja: loja?.nome ?? "",
    valor: Number(valor),
    pixChave: loja?.pix_key ?? "",
    saqueId: resultado.saqueId!,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
