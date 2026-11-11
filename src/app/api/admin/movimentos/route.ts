export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, unauthorized } from "@/lib/session"
import { adminSb } from "@/lib/fechamentoFinanceiro"

// Livro-caixa de movimentos (retiradas, adiantamentos, bônus, Pix, repasses, dinheiro
// entregue ao caixa, conferências) — base do fechamento financeiro diário. Registro
// financeiro não é apagado: o admin só pode CANCELAR um lançamento (com motivo) ou
// atribuir a uma loja/motoboy um Pix importado do Asaas sem identificação.

const TIPOS_MOTOBOY = ["retirada_dinheiro", "adiantamento", "bonus", "desconto", "pagamento", "entrega_caixa", "pagamento_autorizado_dinheiro", "conferencia_caixa", "ajuste_credito", "ajuste_debito"]
const TIPOS_LOJA = ["repasse", "ajuste_credito", "ajuste_debito"]

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const dias = Math.min(Number(req.nextUrl.searchParams.get("dias") ?? "30") || 30, 366)
  const desde = new Date(Date.now() - dias * 86400000).toISOString()
  const sb = adminSb()
  const [movs, mbs, lojas] = await Promise.all([
    sb.from("movimentos_financeiros").select("*, motoboy:motoboys(nome), loja:lojas(nome)").gte("ocorrido_em", desde).order("ocorrido_em", { ascending: false }).limit(1000),
    sb.from("motoboys").select("id, nome, status").order("nome"),
    sb.from("lojas").select("id, nome, status").order("nome"),
  ])
  if (movs.error) return NextResponse.json({ error: movs.error.message }, { status: 500 })
  return NextResponse.json({ movimentos: movs.data ?? [], motoboys: mbs.data ?? [], lojas: lojas.data ?? [] })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const b = await req.json().catch(() => ({}))
  const valor = Math.round(Number(b.valor) * 100) / 100
  const tipoBenef = b.beneficiario_tipo === "loja" ? "loja" : "motoboy"
  const tiposOk = tipoBenef === "loja" ? TIPOS_LOJA : TIPOS_MOTOBOY
  if (!tiposOk.includes(b.tipo)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })
  if (!Number.isFinite(valor) || valor < 0 || (valor === 0 && b.tipo !== "conferencia_caixa")) return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
  if (tipoBenef === "loja" ? !b.loja_id : !b.motoboy_id) return NextResponse.json({ error: "Escolha a loja ou o motoboy" }, { status: 400 })
  const motivo = String(b.motivo ?? "").trim(), responsavel = String(b.responsavel ?? "").trim()
  if (!motivo) return NextResponse.json({ error: "Informe o motivo" }, { status: 400 })
  if (!responsavel) return NextResponse.json({ error: "Informe o responsável" }, { status: 400 })
  const ocorrido = b.ocorrido_em ? new Date(b.ocorrido_em) : new Date()
  if (isNaN(ocorrido.getTime())) return NextResponse.json({ error: "Data/hora inválida" }, { status: 400 })
  let pedido_id: string | null = null
  const sb = adminSb()
  if (b.pedido_codigo) {
    const { data: p } = await sb.from("pedidos").select("id").eq("codigo", String(b.pedido_codigo).trim().toUpperCase()).maybeSingle()
    if (!p) return NextResponse.json({ error: `Pedido ${b.pedido_codigo} não encontrado` }, { status: 400 })
    pedido_id = p.id
  }
  const forma = ["dinheiro", "pix", "outro"].includes(b.forma) ? b.forma
    : ["retirada_dinheiro", "entrega_caixa", "pagamento_autorizado_dinheiro", "conferencia_caixa"].includes(b.tipo) ? "dinheiro" : null
  const { data, error } = await sb.from("movimentos_financeiros").insert({
    beneficiario_tipo: tipoBenef, motoboy_id: tipoBenef === "motoboy" ? b.motoboy_id : null, loja_id: tipoBenef === "loja" ? b.loja_id : null,
    tipo: b.tipo, valor, forma, ocorrido_em: ocorrido.toISOString(), responsavel, motivo, pedido_id, origem: "manual", criado_por: "admin",
  }).select("id").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })
  const sb = adminSb()
  const { data: m } = await sb.from("movimentos_financeiros").select("id, tipo, cancelado_em").eq("id", b.id).maybeSingle()
  if (!m) return NextResponse.json({ error: "Movimento não encontrado" }, { status: 404 })
  if (m.cancelado_em) return NextResponse.json({ error: "Movimento já cancelado" }, { status: 400 })

  if (b.acao === "cancelar") {
    const motivo = String(b.motivo ?? "").trim(), quem = String(b.responsavel ?? "").trim()
    if (!motivo || !quem) return NextResponse.json({ error: "Informe motivo e responsável do cancelamento" }, { status: 400 })
    const { error } = await sb.from("movimentos_financeiros").update({ cancelado_em: new Date().toISOString(), cancelado_por: quem, cancelado_motivo: motivo }).eq("id", b.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (b.acao === "atribuir") {
    if (m.tipo !== "nao_identificado") return NextResponse.json({ error: "Só Pix sem identificação pode ser atribuído" }, { status: 400 })
    const upd = b.loja_id ? { beneficiario_tipo: "loja", loja_id: b.loja_id, motoboy_id: null, tipo: "repasse" }
      : b.motoboy_id ? { beneficiario_tipo: "motoboy", motoboy_id: b.motoboy_id, loja_id: null, tipo: b.tipo === "adiantamento" ? "adiantamento" : "pagamento" }
      : b.interna ? { tipo: "transferencia_interna" } : null
    if (!upd) return NextResponse.json({ error: "Escolha a loja ou o motoboy" }, { status: 400 })
    const { error } = await sb.from("movimentos_financeiros").update(upd).eq("id", b.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: "Ação inválida" }, { status: 400 })
}
