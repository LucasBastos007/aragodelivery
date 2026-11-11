export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { chaveCiclo, cicloDe } from "@/lib/repasseLoja"
import { borderoAtual, borderoLoja, borderoMotoboy } from "@/lib/bordero"

// Borderô (admin, 20/10/2026): GET calcula a relação de pedidos de uma loja (ciclo) ou de um motoboy;
// GET ?lista=1 traz a situação dos borderôs do ciclo; POST "enviar" grava a relação (a loja vê no
// painel dela e responde se está certo) e "cancelar" desfaz um envio.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const ymd = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
const SEL = "id,tipo,loja_id,motoboy_id,status,valor,qtd,enviado_em,respondido_em,resposta,movimento_id,pago_em,periodo_ini,periodo_fim"

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const u = new URL(req.url), ciclo = ymd(u.searchParams.get("ciclo"))
  if (u.searchParams.get("lista")) {
    if (!ciclo) return NextResponse.json({ error: "Ciclo obrigatório." }, { status: 400 })
    const c = cicloDe(ciclo)
    const [{ data: bl, error }, { data: bm }] = await Promise.all([
      sb.from("borderos").select(SEL).eq("tipo", "loja").eq("periodo_ini", c.ini).neq("status", "cancelado").order("criado_em"),
      sb.from("borderos").select(SEL).eq("tipo", "motoboy").neq("status", "cancelado").neq("status", "pago").order("criado_em"),
    ])
    if (error) return NextResponse.json({ error: "Tabela de borderôs não encontrada. Rode o SQL dos borderôs." }, { status: 500 })
    // O mais recente de cada um vence
    return NextResponse.json({ lojas: Object.fromEntries((bl ?? []).map((b: any) => [b.loja_id, b])), motoboys: Object.fromEntries((bm ?? []).map((b: any) => [b.motoboy_id, b])) })
  }
  const tipo = u.searchParams.get("tipo"), id = u.searchParams.get("id")
  if (!id || (tipo !== "loja" && tipo !== "motoboy") || (tipo === "loja" && !ciclo)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  try {
    if (tipo === "loja") {
      const c = cicloDe(ciclo!)
      const [b, reg, { data: l }] = await Promise.all([borderoLoja(sb, id, c), borderoAtual(sb, "loja", id, c.ini > "2026-10-16" ? c.ini : "2026-10-16"), sb.from("lojas").select("telefone").eq("id", id).single()])
      return NextResponse.json({ bordero: b, registro: reg, telefone: (l as any)?.telefone ?? null })
    }
    const [b, reg, { data: m }] = await Promise.all([borderoMotoboy(sb, id), borderoAtual(sb, "motoboy", id), sb.from("motoboys").select("telefone").eq("id", id).single()])
    return NextResponse.json({ bordero: b, registro: reg, telefone: (m as any)?.telefone ?? null })
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "Não foi possível montar o borderô." }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const { acao, tipo, id, ciclo_ini, bordero_id } = await req.json().catch(() => ({}))
  if (acao === "cancelar") {
    if (!bordero_id) return NextResponse.json({ error: "Borderô obrigatório." }, { status: 400 })
    const { error } = await sb.from("borderos").update({ status: "cancelado" }).eq("id", bordero_id).neq("status", "pago")
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true })
  }
  if (acao !== "enviar" || !id || (tipo !== "loja" && tipo !== "motoboy") || (tipo === "loja" && !ymd(ciclo_ini))) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  if (tipo === "loja") {
    // Repasse do ciclo já pago (com ou sem borderô): não manda conferir de novo
    const tag = chaveCiclo(id, cicloDe(ciclo_ini))
    const { data: pg } = await sb.from("movimentos_financeiros").select("id").eq("loja_id", id).eq("tipo", "repasse").is("cancelado_em", null).or(`externo_id.eq.${tag},motivo.like.%[${tag}]%`).limit(1)
    if (pg?.length) return NextResponse.json({ error: "O repasse desse ciclo já foi pago." }, { status: 409 })
  }
  const b = tipo === "loja" ? await borderoLoja(sb, id, cicloDe(ciclo_ini)) : await borderoMotoboy(sb, id)
  if (!(b.valor > 0)) return NextResponse.json({ error: "Nada a receber pra mandar conferir." }, { status: 422 })
  // Um borderô aberto por vez: o envio novo substitui o anterior que ainda não foi pago
  const ant = await borderoAtual(sb, tipo, id, b.periodo_ini)
  if (ant?.status === "pago") return NextResponse.json({ error: "Esse repasse já foi pago." }, { status: 409 })
  if (ant) await sb.from("borderos").update({ status: "cancelado" }).eq("id", ant.id)
  const { data, error } = await sb.from("borderos").insert({ tipo, loja_id: tipo === "loja" ? id : null, motoboy_id: tipo === "motoboy" ? id : null, periodo_ini: b.periodo_ini, periodo_fim: b.periodo_fim,
    valor: b.valor, qtd: b.linhas.length, detalhe: b, status: "enviado", criado_por: "admin" }).select(SEL).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, registro: data })
}
