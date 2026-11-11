export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSession, unauthorized } from "@/lib/session"
import { enviarComprovanteTransferencia } from "@/lib/email"
import { enviarPix, saldoConta, type TipoChavePix } from "@/lib/asaas"
import { validarChavePix } from "@/lib/repasseLoja"

// Pagar saque (motoboy ou adiantamento de terça da loja). Dois jeitos (20/10/2026):
//   modo "asaas": o painel manda o Pix pela conta do Chegô e o comprovante do Asaas fica anexado sozinho
//   modo "manual" (padrão): já pagou por fora, só marca como pago; o comprovante é anexado depois
// Trava: o saque só sai de "solicitado" uma vez (update condicional), então nunca paga duas vezes.

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const r2 = (v: number) => Math.round(v * 100) / 100
const brl = (v: number) => v.toFixed(2).replace(".", ",")

export async function POST(req: NextRequest) {
  const sess = getSession(req)
  if (sess?.role !== "admin") return unauthorized()

  const { saque_id, modo = "manual", tipo_chave } = await req.json().catch(() => ({}))
  if (!saque_id) return NextResponse.json({ error: "saque_id obrigatório" }, { status: 400 })
  if (modo !== "manual" && modo !== "asaas") return NextResponse.json({ error: "Modo inválido." }, { status: 400 })

  const sb = adminSb()

  const { data: saque } = await sb
    .from("saques")
    .select("*, loja:lojas(nome, email), motoboy:motoboys(nome, email)")
    .eq("id", saque_id)
    .single()

  if (!saque) return NextResponse.json({ error: "Saque não encontrado" }, { status: 404 })
  if (saque.status !== "solicitado") return NextResponse.json({ error: "Saque já processado" }, { status: 422 })

  const valor = r2(Number(saque.valor) - Number(saque.taxa_saque ?? 0)) // o que de fato é transferido
  const nome  = saque.tipo === "lojista" ? saque.loja?.nome  : saque.motoboy?.nome
  const email = saque.tipo === "lojista" ? saque.loja?.email : saque.motoboy?.email

  let chaveOk = ""
  if (modo === "asaas") {
    if (!saque.pix_chave) return NextResponse.json({ error: "Esse saque não tem chave Pix." }, { status: 422 })
    const vk = validarChavePix(String(saque.pix_chave), tipo_chave)
    if (!vk.ok) return NextResponse.json({ error: `Chave Pix do saque não serve (${vk.motivo}). Troque a chave na janela de pagar ou pague por fora.` }, { status: 422 })
    chaveOk = vk.chave
    if (!(valor > 0)) return NextResponse.json({ error: "Valor do saque inválido." }, { status: 422 })
    try { const s = await saldoConta(); if (s.balance < valor) return NextResponse.json({ error: `Saldo no Asaas (${brl(s.balance)}) não cobre esse saque.` }, { status: 422 }) }
    catch (e: any) { return NextResponse.json({ error: "Não consegui ler o saldo do Asaas: " + (e?.message ?? e) }, { status: 502 }) }
  }

  // Trava: só um pedido consegue tirar o saque de "solicitado"
  const { data: travou } = await sb.from("saques").update({ status: "pago", pago_em: new Date().toISOString() })
    .eq("id", saque_id).eq("status", "solicitado").select("id")
  if (!travou?.length) return NextResponse.json({ error: "Esse saque já está sendo pago." }, { status: 409 })

  let transferencia: string | null = null, aguardandoToken = false
  if (modo === "asaas") {
    try {
      const t = await enviarPix(valor, chaveOk, tipo_chave as TipoChavePix,
        saque.tipo === "lojista" ? "Adiantamento Chegô" : "Saque motoboy Chegô")
      transferencia = t.id; aguardandoToken = (t as any).authorized === false
      await sb.from("saques").update({ comprovante_path: `asaas:${t.id}`, observacao: [saque.observacao, `Pix pelo Asaas ${t.id}`].filter(Boolean).join(" | ") }).eq("id", saque_id)
    } catch (e: any) {
      await sb.from("saques").update({ status: "solicitado", pago_em: null }).eq("id", saque_id)
      return NextResponse.json({ error: "O Asaas recusou o Pix: " + (e?.message ?? e) }, { status: 502 })
    }
  }

  // Envia comprovante de transferência para quem recebeu
  if (email && nome) {
    enviarComprovanteTransferencia({
      email,
      nome,
      valor,
      pixChave: saque.pix_chave,
      tipo:     saque.tipo,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, valor, transferencia, aguardando: aguardandoToken })
}
