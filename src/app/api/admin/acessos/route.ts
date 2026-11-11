export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"

// Acessos ao app (admin 2.0, 20/10/2026): funil por dia, contado no servidor de 1000 em 1000
// (a tela antiga lia do navegador e parava em 1000 linhas, cortando o gráfico).
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const ymdBrt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d)

async function porDia(tabela: string, filtro: (q: any) => any, desde: string) {
  const m: Record<string, number> = {}
  for (let i = 0; i < 300_000; i += 1000) {
    const { data, error } = await filtro(sb.from(tabela).select("criado_em")).gte("criado_em", desde).order("criado_em").range(i, i + 999)
    if (error) throw error
    for (const r of data ?? []) { const k = ymdBrt(new Date((r as any).criado_em)); m[k] = (m[k] ?? 0) + 1 }
    if ((data ?? []).length < 1000) break
  }
  return m
}

// Pessoas diferentes (código anônimo do celular): por dia e no período todo
async function pessoas(desde: string) {
  const porDia: Record<string, Set<string>> = {}, todos = new Set<string>(); let semCodigo = 0
  for (let i = 0; i < 300_000; i += 1000) {
    const { data, error } = await sb.from("acessos_app").select("criado_em,visitante").eq("tipo", "acesso").gte("criado_em", desde).order("criado_em").range(i, i + 999)
    if (error) return null // coluna ainda não existe
    for (const r of (data ?? []) as any[]) { if (!r.visitante) { semCodigo++; continue } const k = ymdBrt(new Date(r.criado_em)); (porDia[k] ??= new Set()).add(r.visitante); todos.add(r.visitante) }
    if ((data ?? []).length < 1000) break
  }
  return { porDia: Object.fromEntries(Object.entries(porDia).map(([k, v]) => [k, v.size])), total: todos.size, semCodigo }
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const dias = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("dias")) || 7))
  const hoje = ymdBrt(new Date()), ini = new Date(`${hoje}T12:00:00Z`); ini.setUTCDate(ini.getUTCDate() - (dias - 1))
  const de = ini.toISOString().slice(0, 10), desde = `${de}T03:00:00Z`
  try {
    const [acessos, cadastros, pedidos, { data: ultimos }, pes] = await Promise.all([
      porDia("acessos_app", q => q.eq("tipo", "acesso"), desde),
      porDia("clientes", q => q, desde),
      porDia("pedidos", q => q.eq("status", "entregue"), desde),
      sb.from("clientes").select("nome,criado_em,endereco_bairro").gte("criado_em", desde).order("criado_em", { ascending: false }).limit(20),
      pessoas(desde),
    ])
    const lista: { dia: string; pessoas: number; acessos: number; cadastros: number; pedidos: number }[] = []
    for (let d = new Date(`${de}T12:00:00Z`); d.toISOString().slice(0, 10) <= hoje; d.setUTCDate(d.getUTCDate() + 1)) { const k = d.toISOString().slice(0, 10); lista.push({ dia: k, pessoas: pes?.porDia[k] ?? 0, acessos: acessos[k] ?? 0, cadastros: cadastros[k] ?? 0, pedidos: pedidos[k] ?? 0 }) }
    return NextResponse.json({ de, hoje, dias: lista, ultimos: ultimos ?? [], pessoas: pes ? { total: pes.total, semCodigo: pes.semCodigo } : null })
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "Não foi possível contar." }, { status: 503 }) }
}
