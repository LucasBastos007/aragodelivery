export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { destinacoesPeriodo, saldoMotoboys } from "@/lib/saldosRepasse"
import { chavePixLoja, chavePixParece, tipoChaveSugerido, ymdBrt } from "@/lib/repasseLoja"

// Repasses (admin 2.0, 20/10/2026): quanto cada loja e cada motoboy faturou no período e quanto
// cada motoboy tem a receber hoje. A conta é a do fechamento diário (calcularDestinacoes).
// O pagamento das lojas segue por ciclo em /api/admin/repasses (marca do ciclo no registro).
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const ymd = (v: string | null) => v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const u = new URL(req.url), hoje = ymdBrt(), de = ymd(u.searchParams.get("de")), ate = ymd(u.searchParams.get("ate"))
  if (!de || !ate || de > ate) return NextResponse.json({ error: "Período inválido." }, { status: 400 })
  try {
    const [per, saldo, { data: mbs }, { data: lojas }, { data: abertos }] = await Promise.all([
      destinacoesPeriodo(sb, de, ate), saldoMotoboys(sb, hoje),
      sb.from("motoboys").select("id,nome,telefone,pix_key,pix_chave,status"), sb.from("lojas").select("id,logo_url"),
      sb.from("saques").select("motoboy_id,valor").eq("tipo", "motoboy").eq("status", "solicitado"),
    ])
    const res = new Map<string, number>(); for (const a of (abertos ?? []) as any[]) res.set(a.motoboy_id, (res.get(a.motoboy_id) ?? 0) + Number(a.valor ?? 0))
    const M = new Map((mbs ?? []).map((m: any) => [m.id, m])), LG = new Map((lojas ?? []).map((l: any) => [l.id, l.logo_url]))
    const d = (v: number) => v / 100
    return NextResponse.json({
      de, ate, hoje, desde: per.desde, cortado: per.cortado,
      lojas: per.lojistas.lojas.map(l => ({ id: l.id, nome: l.nome, logo: LG.get(l.id) ?? null, pedidos: l.pedidos, comissaoPct: l.comissaoPct, produtos: d(l.produtos), cupom: d(l.descontoLoja), comissao: d(l.comissao), taxa: d(l.taxaPagamento), entrega: d(l.participacaoEntrega), avulsas: d(l.cobrancaAvulsas), balcao: d(l.recebidoPelaLoja), liquido: d(l.liquido) })),
      motoboys: per.motoboys.lista.map(m => ({ id: m.id, nome: m.nome, entregas: m.entregas, avulsas: m.avulsas, ganho: d(m.ganho), bonus: d(m.bonus), descontos: d(m.descontos), devido: d(m.devido), dinheiroClientes: d(m.dinheiroClientes) })),
      saldoMotoboys: saldo.map(s => { const m: any = M.get(s.id); const chave = m ? chavePixLoja({ pix_key: m.pix_key, pix_chave: m.pix_chave }) : null
        const reservado = Math.round((res.get(s.id) ?? 0) * 100) / 100
        return { ...s, reservado, livre: Math.max(0, Math.round((s.pendente - reservado) * 100) / 100), telefone: m?.telefone ?? null, chave, chaveTipo: chave ? tipoChaveSugerido(chave) : null, chaveOk: chavePixParece(chave) } }),
    })
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "Não foi possível calcular." }, { status: 503 }) }
}
