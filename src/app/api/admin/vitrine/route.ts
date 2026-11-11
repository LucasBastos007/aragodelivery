export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { periodoSemana } from "@/lib/periodoBrt"
import { PETISCARIA } from "@/lib/financeiroGestao"

// Vitrine (admin 2.0, 20/10/2026): o que o cliente vê primeiro e o que deixa a vitrine fraca.
// Famosos = Petiscaria fixa em 1º + as 9 que mais venderam na semana passada (mesma regra de
// /api/lojas/mais-vendidas). Mais pedidos = produtos que a loja marcou como destaque.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

async function tudo(q: () => any) {
  const out: any[] = []
  for (let i = 0; i < 200_000; i += 1000) { const { data, error } = await q().range(i, i + 999); if (error) throw error; out.push(...(data ?? [])); if ((data ?? []).length < 1000) break }
  return out
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const dias = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("dias")) || 30))
  const inicioSemana = periodoSemana().inicioUtc, desdeSemana = new Date(new Date(inicioSemana).getTime() - 7 * 86400000).toISOString()
  const desdeTop = new Date(Date.now() - dias * 86400000).toISOString()
  try {
    const [lojas, produtos, pedSemana, pedTop] = await Promise.all([
      tudo(() => sb.from("lojas").select("id,nome,logo_url,status,aberto,categoria").order("id")),
      tudo(() => sb.from("produtos").select("id,loja_id,nome,foto_url,disponivel,ncm,preco").order("id")),
      tudo(() => sb.from("pedidos").select("loja_id").eq("status", "entregue").gte("criado_em", desdeSemana).lt("criado_em", inicioSemana).order("id")),
      tudo(() => sb.from("pedidos").select("id").eq("status", "entregue").gte("criado_em", desdeTop).order("id")),
    ])
    const conta = new Map<string, number>(); for (const p of pedSemana) if (p.loja_id) conta.set(p.loja_id, (conta.get(p.loja_id) ?? 0) + 1)
    const L = new Map(lojas.map((l: any) => [l.id, l]))
    const ranking = [...conta.entries()].sort((a, b) => b[1] - a[1]).filter(([id]) => id !== PETISCARIA && (L.get(id) as any)?.status === "ativo").slice(0, 9)
    const famosos = [{ id: PETISCARIA, n: conta.get(PETISCARIA) ?? 0, fixa: true }, ...ranking.map(([id, n]) => ({ id, n, fixa: false }))]
      .map(f => ({ ...f, nome: (L.get(f.id) as any)?.nome ?? "Loja", logo: (L.get(f.id) as any)?.logo_url ?? null }))
    const porLoja = lojas.filter((l: any) => l.status === "ativo").map((l: any) => {
      const ps = produtos.filter((p: any) => p.loja_id === l.id)
      return { id: l.id, nome: l.nome, logo: l.logo_url, categoria: l.categoria, produtos: ps.length, disponiveis: ps.filter((p: any) => p.disponivel).length,
        semFoto: ps.filter((p: any) => p.disponivel && !p.foto_url).length, destaques: ps.filter((p: any) => p.ncm === "destaque").map((p: any) => p.nome) }
    })
    // Produtos mais vendidos (antes ficava no Relatório de vendas)
    const ids = pedTop.map((p: any) => p.id), itens: any[] = []
    for (let i = 0; i < ids.length; i += 300) { const { data } = await sb.from("itens_pedido").select("nome,quantidade,preco,pedido_id").in("pedido_id", ids.slice(i, i + 300)); itens.push(...(data ?? [])) }
    const m = new Map<string, { nome: string; q: number; v: number }>()
    for (const it of itens) { const a = m.get(it.nome) ?? { nome: it.nome, q: 0, v: 0 }; a.q += Number(it.quantidade ?? 0); a.v += Number(it.preco ?? 0) * Number(it.quantidade ?? 0); m.set(it.nome, a) }
    const top = [...m.values()].sort((a, b) => b.q - a.q).slice(0, 25).map(x => ({ ...x, v: Math.round(x.v * 100) / 100 }))
    return NextResponse.json({ semana: { de: desdeSemana, ate: inicioSemana }, famosos, porLoja, top, dias })
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "Erro" }, { status: 503 }) }
}
