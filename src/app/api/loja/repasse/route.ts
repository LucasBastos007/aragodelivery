export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"
import { adiantamentosCiclo, calcularRepasse, chaveCiclo, cicloAnterior, cicloDe, INICIO_REPASSES, repassesPagos, ymdBrt } from "@/lib/repasseLoja"

// Financeiro da loja (20/10/2026): ciclo de sexta a quinta, acumulado até agora, pedidos que
// formam cada linha (pra conferência) e os repasses já pagos.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

export async function GET(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()
  const v = new URL(req.url).searchParams.get("ciclo")
  const atual = cicloDe(ymdBrt())
  const c = v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? cicloDe(v) : atual
  if (c.fim < INICIO_REPASSES) return NextResponse.json({ error: "Antes de 16/10 os repasses já foram acertados." }, { status: 422 })
  const [resumo, pagos, ad] = await Promise.all([calcularRepasse(sb, sess.loja_id, c, { itens: true }), repassesPagos(sb, sess.loja_id), adiantamentosCiclo(sb, sess.loja_id, c)])
  const tag = chaveCiclo(sess.loja_id, c)
  const pagoCiclo = pagos.find(p => p.externo_id === tag || String(p.motivo ?? "").includes(`[${tag}]`)) ?? null
  const ant = cicloAnterior(atual)
  const hojeDia = new Date(`${ymdBrt()}T12:00:00Z`).getUTCDay()
  return NextResponse.json({ ciclo: c, atual: c.ini === atual.ini, adiantado: ad.total, aReceber: Math.max(0, Math.round((resumo.liquido - ad.total) * 100) / 100), podeAdiantar: c.ini === atual.ini && hojeDia === 2 && !ad.lista.length, anterior: ant.fim >= INICIO_REPASSES ? ant : null, resumo, pagoCiclo,
    pagos: pagos.map(p => ({ id: p.id, comprovante: !!p.comprovante_path, pelo_asaas: String(p.comprovante_path ?? "").startsWith("asaas:"), valor: p.valor, ocorrido_em: p.ocorrido_em, motivo: String(p.motivo ?? "").replace(/\s*\[repasse_ciclo:[^\]]+\]/, "") })) })
}
