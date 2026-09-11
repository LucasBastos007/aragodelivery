export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSession, unauthorized } from "@/lib/session"
import { notificarSaqueLojistaSolicitado } from "@/lib/email"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const sess = getSession(req)
  if (sess?.role !== "loja") return unauthorized()

  const { loja_id } = sess as any
  const { valor } = await req.json()

  if (!valor || valor <= 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
  }

  const sb = adminSb()

  const { data: loja } = await sb
    .from("lojas")
    .select("nome, pix_key, comissao, plano_mensalidade")
    .eq("id", loja_id)
    .single()

  if (!loja) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 })
  if (!loja.pix_key) return NextResponse.json({ error: "Cadastre sua chave PIX no perfil antes de solicitar" }, { status: 422 })

  // Calcula saldo real — mesma fórmula da tela (src/app/loja/financeiro/page.tsx) — antes de
  // aceitar o pedido de saque. Sem isso, a rota aceitava qualquer valor > 0 sem checar contra
  // o que a loja realmente tem a receber.
  const comissao_pct = loja.comissao ?? 0
  const [{ data: pedidos }, { data: mensalidades }, { data: saquesAnt }] = await Promise.all([
    sb.from("pedidos").select("subtotal").eq("loja_id", loja_id).eq("status", "entregue"),
    sb.from("mensalidades").select("valor, status").eq("loja_id", loja_id),
    sb.from("saques").select("valor, status").eq("loja_id", loja_id).eq("tipo", "lojista"),
  ])
  const bruta       = (pedidos ?? []).reduce((s, p) => s + (p.subtotal ?? 0), 0)
  const liquida     = bruta - (bruta * comissao_pct / 100)
  const mensTot     = (mensalidades ?? []).filter(m => m.status === "descontado").reduce((s, m) => s + m.valor, 0)
  const pagosTot    = (saquesAnt    ?? []).filter(s => s.status === "pago").reduce((s, x) => s + x.valor, 0)
  const solicitado  = (saquesAnt    ?? []).filter(s => s.status === "solicitado").reduce((s, x) => s + x.valor, 0)
  const saldo       = Math.max(0, liquida - mensTot - pagosTot - solicitado)

  if (valor > saldo + 0.001) return NextResponse.json({ error: "Valor maior que o saldo disponível" }, { status: 422 })

  const { data: saque, error } = await sb
    .from("saques")
    .insert({ tipo: "lojista", loja_id, valor, pix_chave: loja.pix_key, status: "solicitado" })
    .select("id")
    .single()

  if (error || !saque) {
    return NextResponse.json({ error: "Erro ao criar saque" }, { status: 500 })
  }

  notificarSaqueLojistaSolicitado({
    nomeLoja: loja.nome,
    valor,
    pixChave: loja.pix_key,
    saqueId: saque.id,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
