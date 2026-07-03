export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSession, unauthorized } from "@/lib/session"
import crypto from "crypto"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function gerarCodigo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = crypto.randomBytes(6)
  return Array.from(bytes).map(b => chars[b % chars.length]).join("")
}

export async function POST(req: NextRequest) {
  const sess = getSession(req)
  if (sess?.role !== "loja") return unauthorized()
  const { loja_id } = sess as any

  const { nome_cliente, endereco_entrega, observacao, taxa_entrega } = await req.json()

  if (!nome_cliente?.trim() || !endereco_entrega?.trim()) {
    return NextResponse.json({ error: "Nome do cliente e endereço são obrigatórios" }, { status: 400 })
  }

  const sb = adminSb()

  const { data: loja } = await sb.from("lojas").select("lat, lng").eq("id", loja_id).single()

  const codigo = gerarCodigo()
  const taxaFinal = parseFloat(taxa_entrega) || 0

  const { data: pedido, error } = await sb
    .from("pedidos")
    .insert({
      loja_id,
      codigo,
      tipo:             "manual",
      status:           "pronto",       // já pula direto para buscar motoboy
      forma_pagamento:  "externo",      // pago fora do app
      subtotal:         0,
      taxa_entrega:     taxaFinal,
      desconto:         0,
      total:            taxaFinal,
      endereco_entrega: endereco_entrega.trim(),
      observacao:       observacao?.trim() ?? "",
      nome_cliente:     nome_cliente.trim(),
      cliente_push_token: crypto.randomBytes(16).toString("hex"),
      ...(loja?.lat ? { loja_lat: loja.lat, loja_lng: loja.lng } : {}),
    })
    .select("id")
    .single()

  if (error || !pedido) {
    return NextResponse.json({ error: "Erro ao criar pedido manual" }, { status: 500 })
  }

  // Chama escalação de motoboy imediatamente
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chegodelivery.com"
  fetch(`${site}/api/escalada`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
    },
    body: JSON.stringify({ pedido_id: pedido.id }),
  }).catch(() => {})

  return NextResponse.json({ ok: true, pedido_id: pedido.id, codigo })
}
