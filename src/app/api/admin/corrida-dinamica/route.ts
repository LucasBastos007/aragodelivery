export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { CHAVE_DINAMICA, dinamicaAtiva, lerCorridaDinamica } from "@/lib/corridaDinamica"

// Corrida dinâmica (chuva), 25/10/2026. GET: estado atual. POST:
//   { acao: "ligar", valor, ate }  → ate = "HH:MM" de hoje (Brasília); se já passou, vale pra amanhã
//   { acao: "desligar" }           → encerra agora (pedidos já feitos mantêm o acréscimo)
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const d = await lerCorridaDinamica(sb)
  return NextResponse.json({ ativa: dinamicaAtiva(d), config: d })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const body = await req.json().catch(() => ({}))
  const atual = await lerCorridaDinamica(sb)
  if (body.acao === "desligar") {
    if (!atual) return NextResponse.json({ ativa: false, config: null })
    const config = { ...atual, ate: new Date().toISOString() }
    const { error } = await sb.from("configuracoes").upsert({ chave: CHAVE_DINAMICA, valor: JSON.stringify(config), atualizado_em: new Date().toISOString() }, { onConflict: "chave" })
    if (error) return NextResponse.json({ error: "Não deu pra desligar agora. Tente de novo." }, { status: 500 })
    return NextResponse.json({ ativa: false, config })
  }
  if (body.acao !== "ligar") return NextResponse.json({ error: "Ação inválida." }, { status: 400 })
  const valor = Math.round(Number(body.valor) * 100) / 100
  if (!(valor > 0) || valor > 20) return NextResponse.json({ error: "Informe um valor entre R$ 0,01 e R$ 20,00." }, { status: 400 })
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(body.ate ?? ""))
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return NextResponse.json({ error: "Informe até que horas vale (ex. 21:00)." }, { status: 400 })
  const hojeBrt = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
  let ate = new Date(`${hojeBrt}T${m[1].padStart(2, "0")}:${m[2]}:00-03:00`)
  if (ate.getTime() <= Date.now()) ate = new Date(ate.getTime() + 86400000)
  const config = { valor, ate: ate.toISOString(), motivo: "chuva", ligada_em: new Date().toISOString() }
  const { error } = await sb.from("configuracoes").upsert({ chave: CHAVE_DINAMICA, valor: JSON.stringify(config), atualizado_em: new Date().toISOString() }, { onConflict: "chave" })
  if (error) return NextResponse.json({ error: "Não deu pra ligar agora. Tente de novo." }, { status: 500 })
  return NextResponse.json({ ativa: true, config })
}
