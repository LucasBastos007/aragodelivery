export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { cicloDe, iniUtc, somaDiasYmd, ymdBrt, tipoChaveSugerido } from "@/lib/repasseLoja"

// Pagamentos da semana (admin 2.0, 20/10/2026): adiantamentos de terça e saques dos motoboys
// (tabela saques), despesas do Chegô e os pagamentos recentes com ou sem comprovante.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const hoje = ymdBrt(), c = cicloDe(hoje), desde = somaDiasYmd(hoje, -14)
  const [{ data: saques }, { data: despesas }, { data: movs }] = await Promise.all([
    sb.from("saques").select("id,tipo,motoboy_id,valor,taxa_saque,status,pix_chave,criado_em,pago_em,observacao,comprovante_path,loja:lojas(nome,logo_url),motoboy:motoboys(nome)")
      .or(`status.eq.solicitado,pago_em.gte.${iniUtc(desde)}`).order("criado_em", { ascending: false }).limit(200),
    sb.from("despesas").select("id,descricao,categoria,valor,data,ativo,comprovante_path").gte("data", desde).order("data", { ascending: false }).limit(200),
    sb.from("movimentos_financeiros").select("id,valor,ocorrido_em,motivo,origem,externo_id,responsavel,destinatario_nome,comprovante_path,loja:lojas(nome,logo_url)")
      .eq("tipo", "repasse").is("cancelado_em", null).gte("ocorrido_em", iniUtc(desde)).order("ocorrido_em", { ascending: false }).limit(200),
  ])
  // Tipo provável da chave Pix (o admin confirma antes de pagar pelo Asaas)
  const sq = (saques ?? []).map((s: any) => ({ ...s, chaveTipo: s.pix_chave ? tipoChaveSugerido(String(s.pix_chave)) : null }))
  return NextResponse.json({ hoje, ciclo: c, saques: sq, despesas: despesas ?? [], repasses: movs ?? [] })
}

// Lançar despesa do Chegô (entra no fechamento do dia)
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const { descricao, valor, data, categoria } = await req.json().catch(() => ({}))
  const v = Number(valor)
  if (!String(descricao ?? "").trim() || !(v > 0)) return NextResponse.json({ error: "Diga o que é e o valor." }, { status: 400 })
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(data ?? "")) ? data : ymdBrt()
  const { data: ins, error } = await sb.from("despesas").insert({ descricao: String(descricao).trim().slice(0, 200), valor: Math.round(v * 100) / 100, data: dia, categoria: categoria || "outros", ativo: true }).select("id").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: (ins as any).id })
}
