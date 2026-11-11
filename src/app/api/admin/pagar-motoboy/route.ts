export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { saldoMotoboys } from "@/lib/saldosRepasse"
import { chavePixLoja, validarChavePix, ymdBrt } from "@/lib/repasseLoja"
import { enviarPix, saldoConta, type TipoChavePix } from "@/lib/asaas"
import { marcarBorderoPago } from "@/lib/bordero"

// Pagar motoboy pelo painel (admin 2.0, 20/10/2026), sem ele precisar pedir saque.
// O servidor recalcula o saldo (mesma conta do fechamento) e recusa valor acima do que ele tem a receber.
// modo "asaas": Pix pela conta do Chegô, comprovante anexado sozinho. modo "manual": já pagou por fora.
// Vira movimento "pagamento" (entra no fechamento das 23h59). O externo_id do Pix evita contar duas vezes
// quando a importação diária do Asaas trouxer a mesma transferência.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const r2 = (v: number) => Math.round(v * 100) / 100
const brl = (v: number) => v.toFixed(2).replace(".", ",")

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const { motoboy_id, valor, modo, tipo_chave, responsavel } = await req.json().catch(() => ({}))
  const v = r2(Number(valor))
  if (!motoboy_id || !(v > 0)) return NextResponse.json({ error: "Motoboy e valor obrigatórios." }, { status: 400 })
  if (modo !== "asaas" && modo !== "manual") return NextResponse.json({ error: "Modo inválido." }, { status: 400 })

  const saldo = (await saldoMotoboys(sb, ymdBrt())).find(s => s.id === motoboy_id)
  // Saque que ele já pediu e ainda não foi pago fica reservado: pagar por aqui e depois o saque pagaria duas vezes
  const { data: abertos } = await sb.from("saques").select("valor").eq("tipo", "motoboy").eq("motoboy_id", motoboy_id).eq("status", "solicitado")
  const reservado = r2((abertos ?? []).reduce((t: number, x: any) => t + Number(x.valor ?? 0), 0))
  const pendente = r2(Math.max(0, (saldo?.pendente ?? 0) - reservado))
  if (v > pendente + 0.009) return NextResponse.json({ error: reservado ? `Ele tem ${brl(pendente)} livre pra pagar (${brl(reservado)} já estão num saque pedido; pague esse saque em Pagamentos).` : `Ele tem ${brl(pendente)} a receber. Não dá pra pagar ${brl(v)}.`, pendente }, { status: 409 })

  const { data: mb } = await sb.from("motoboys").select("id,nome,pix_key,pix_chave").eq("id", motoboy_id).single()
  if (!mb) return NextResponse.json({ error: "Motoboy não encontrado." }, { status: 404 })

  // Trava contra clique duplo: mesmo motoboy e valor no mesmo minuto não grava de novo (externo_id é único)
  const trava = `pag_mb:${motoboy_id}:${v.toFixed(2)}:${new Date().toISOString().slice(0, 16)}`
  const base = { beneficiario_tipo: "motoboy", motoboy_id, destinatario_nome: (mb as any).nome, tipo: "pagamento", valor: v, ocorrido_em: new Date().toISOString(), criado_por: "repasses-painel", responsavel: String(responsavel || "Admin").slice(0, 80) }

  if (modo === "manual") {
    const { data, error } = await sb.from("movimentos_financeiros").insert({ ...base, forma: "pix", origem: "manual", externo_id: trava, motivo: `Pagamento ao motoboy (Pix por fora)` }).select("id").single()
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Esse pagamento já foi registrado." : error.message }, { status: 409 })
    await marcarBorderoPago(sb, "motoboy", motoboy_id, (data as any).id).catch(() => {})
    return NextResponse.json({ ok: true, valor: v, movimento: (data as any).id })
  }

  const chave = chavePixLoja(mb as any)
  if (!chave) return NextResponse.json({ error: "O motoboy não tem chave Pix cadastrada." }, { status: 422 })
  const vk = validarChavePix(chave, tipo_chave)
  if (!vk.ok) return NextResponse.json({ error: `Chave Pix do motoboy não serve (${vk.motivo}). Corrija o cadastro dele ou pague por fora e dê baixa.` }, { status: 422 })
  try { const s = await saldoConta(); if (s.balance < v) return NextResponse.json({ error: `Saldo no Asaas (${brl(s.balance)}) não cobre esse pagamento.` }, { status: 422 }) }
  catch (e: any) { return NextResponse.json({ error: "Não consegui ler o saldo do Asaas: " + (e?.message ?? e) }, { status: 502 }) }

  const { data: mov, error: eIns } = await sb.from("movimentos_financeiros").insert({ ...base, forma: "pix", origem: "asaas", externo_id: trava, motivo: "Pagamento ao motoboy (Pix pelo Asaas)" }).select("id").single()
  if (eIns || !mov) return NextResponse.json({ error: "Esse pagamento já está sendo registrado." }, { status: 409 })
  try {
    const t = await enviarPix(v, vk.chave, tipo_chave as TipoChavePix, "Pagamento motoboy Chegô")
    await sb.from("movimentos_financeiros").update({ externo_id: `asaas_transfer:${t.id}`, comprovante_path: `asaas:${t.id}`, destinatario_nome: t.bankAccount?.ownerName || (mb as any).nome }).eq("id", (mov as any).id)
    await marcarBorderoPago(sb, "motoboy", motoboy_id, (mov as any).id).catch(() => {})
    return NextResponse.json({ ok: true, valor: v, movimento: (mov as any).id, transferencia: t.id, recebedor: t.bankAccount?.ownerName ?? null, aguardando: (t as any).authorized === false })
  } catch (e: any) {
    await sb.from("movimentos_financeiros").delete().eq("id", (mov as any).id)
    return NextResponse.json({ error: "O Asaas recusou o Pix: " + (e?.message ?? e) }, { status: 502 })
  }
}
