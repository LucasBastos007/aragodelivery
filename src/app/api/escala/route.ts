export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, requireMotoboy, unauthorized } from "@/lib/session"

// Escala dos motoboys (03/11/2026, pedido do Lucas): calendário da semana com o horário de cada
// motoboy. Admin e motoboys veem; só o admin cria, muda, apaga e copia a semana anterior.
// Turno com fim menor que o início vira a noite (18:00 às 02:00).
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const YMD = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Por enquanto a escala mostra só estes quatro (pedido do Lucas, 03/11/2026): Amanda Bastos, Efraim Levi,
// Henrique Rodrigues de Souza e Rodrigo Silva. Lista vazia = todos os ativos.
const SO_ESTES = ["a35addf4-4398-4ff8-bf3a-f42ad15afdcf", "cc14cf9d-9eb8-471a-aa9c-0f4599cd8fac", "1d1984f8-e7c6-48c8-bd1a-03f0373e31d4", "eea0f7e5-f32e-42f7-99ca-d17e52f84ef5"]
const naEscala = (id: string) => !SO_ESTES.length || SO_ESTES.includes(id)

const maisDias = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req), mb = admin ? null : requireMotoboy(req)
  if (!admin && !mb) return unauthorized()
  const inicio = req.nextUrl.searchParams.get("inicio") ?? ""
  if (!YMD.test(inicio)) return NextResponse.json({ error: "Semana inválida." }, { status: 400 })
  const fim = maisDias(inicio, 6)
  const [{ data: turnos, error }, { data: motoboys }] = await Promise.all([
    sb.from("escala_motoboys").select("id, motoboy_id, data, inicio, fim, observacao").gte("data", inicio).lte("data", fim).order("data").order("inicio"),
    sb.from("motoboys").select("id, nome, status").order("nome"),
  ])
  if (error) return NextResponse.json({ error: "Não foi possível carregar a escala." }, { status: 500 })
  // Motoboy suspenso só aparece se tiver turno na semana (pra escala antiga não ficar sem nome)
  const doQuadro = (turnos ?? []).filter(t => naEscala(t.motoboy_id))
  const comTurno = new Set(doQuadro.map(t => t.motoboy_id))
  const lista = (motoboys ?? []).filter(m => naEscala(m.id) && (m.status === "ativo" || comTurno.has(m.id))).map(m => ({ id: m.id, nome: m.nome, ativo: m.status === "ativo" }))
  return NextResponse.json({
    inicio, fim, eu: mb?.motoboy_id ?? null, podeEditar: !!admin, motoboys: lista,
    turnos: doQuadro.map(t => ({ ...t, inicio: String(t.inicio).slice(0, 5), fim: String(t.fim).slice(0, 5) })),
  })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const b = await req.json().catch(() => ({}))

  if (b.acao === "apagar") {
    if (!Number.isInteger(b.id)) return NextResponse.json({ error: "Turno inválido." }, { status: 400 })
    const { error } = await sb.from("escala_motoboys").delete().eq("id", b.id)
    return error ? NextResponse.json({ error: "Não foi possível apagar." }, { status: 500 }) : NextResponse.json({ ok: true })
  }

  if (b.acao === "copiar") {
    // Copia a semana anterior inteira pra semana aberta, pulando o que já existe igual
    if (!YMD.test(b.para ?? "")) return NextResponse.json({ error: "Semana inválida." }, { status: 400 })
    const de = maisDias(b.para, -7)
    const [{ data: velhos }, { data: atuais }] = await Promise.all([
      sb.from("escala_motoboys").select("motoboy_id, data, inicio, fim, observacao").gte("data", de).lte("data", maisDias(de, 6)),
      sb.from("escala_motoboys").select("motoboy_id, data, inicio").gte("data", b.para).lte("data", maisDias(b.para, 6)),
    ])
    if (!velhos?.length) return NextResponse.json({ error: "A semana anterior está vazia." }, { status: 422 })
    const ja = new Set((atuais ?? []).map(t => `${t.motoboy_id}|${t.data}|${String(t.inicio).slice(0, 5)}`))
    const novos = velhos.map(t => ({ motoboy_id: t.motoboy_id, data: maisDias(t.data, 7), inicio: t.inicio, fim: t.fim, observacao: t.observacao }))
      .filter(t => !ja.has(`${t.motoboy_id}|${t.data}|${String(t.inicio).slice(0, 5)}`))
    if (novos.length) {
      const { error } = await sb.from("escala_motoboys").insert(novos)
      if (error) return NextResponse.json({ error: "Não foi possível copiar." }, { status: 500 })
    }
    return NextResponse.json({ ok: true, copiados: novos.length })
  }

  // Criar ou mudar um turno
  const { id, motoboy_id, data, inicio, fim } = b
  const observacao = typeof b.observacao === "string" ? b.observacao.trim().slice(0, 120) || null : null
  if (!UUID.test(motoboy_id ?? "") || !YMD.test(data ?? "")) return NextResponse.json({ error: "Escolha o motoboy e o dia." }, { status: 400 })
  if (!naEscala(motoboy_id)) return NextResponse.json({ error: "Esse motoboy não está na escala por enquanto." }, { status: 400 })
  if (!HORA.test(inicio ?? "") || !HORA.test(fim ?? "")) return NextResponse.json({ error: "Coloque o horário de início e de fim." }, { status: 400 })
  if (inicio === fim) return NextResponse.json({ error: "O início e o fim não podem ser iguais." }, { status: 400 })
  const row = { motoboy_id, data, inicio, fim, observacao, atualizado_em: new Date().toISOString() }
  const { error } = Number.isInteger(id)
    ? await sb.from("escala_motoboys").update(row).eq("id", id)
    : await sb.from("escala_motoboys").insert(row)
  return error ? NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 }) : NextResponse.json({ ok: true })
}
