export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { consultarTransferencia } from "@/lib/asaas"

// Situação real dos Pix feitos pelo painel (21/10/2026). O Asaas da conta exige autorização por
// token pra transferência via sistema: até lá o Pix fica "aguardando". Esta rota consulta os Pix
// dos últimos 10 dias e:
//  - aguardando token → avisa na tela (o valor fica reservado, não pode pagar de novo);
//  - cancelado ou falhou no Asaas → DESFAZ o pagamento no painel (o valor volta a "a receber").
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const desde = () => new Date(Date.now() - 10 * 86400000).toISOString()

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const [{ data: movs }, { data: saqs }] = await Promise.all([
    sb.from("movimentos_financeiros").select("id,valor,tipo,loja_id,motoboy_id,destinatario_nome,comprovante_path").like("comprovante_path", "asaas:%").is("cancelado_em", null).gte("criado_em", desde()),
    sb.from("saques").select("id,valor,taxa_saque,tipo,loja_id,motoboy_id,comprovante_path,status").like("comprovante_path", "asaas:%").eq("status", "pago").gte("criado_em", desde()),
  ])
  const itens = [...(movs ?? []).map((m: any) => ({ k: "movimento", ...m })), ...(saqs ?? []).map((s: any) => ({ k: "saque", ...s, valor: Number(s.valor) - Number(s.taxa_saque ?? 0) }))]
  const out: any[] = []
  for (let i = 0; i < itens.length; i += 8) {
    await Promise.all(itens.slice(i, i + 8).map(async (x: any) => {
      let t: any
      try { t = await consultarTransferencia(String(x.comprovante_path).slice(6)) } catch { out.push({ ...x, situacao: "sem_resposta" }); return }
      const st = String(t.status ?? "")
      if (st === "DONE") { out.push({ ...x, situacao: "concluido" }); return }
      if (st === "CANCELLED" || st === "FAILED") {
        // Desfaz: o dinheiro não saiu
        if (x.k === "movimento") {
          await sb.from("movimentos_financeiros").update({ cancelado_em: new Date().toISOString(), cancelado_por: "sistema", cancelado_motivo: st === "FAILED" ? `Pix falhou no Asaas: ${t.failReason ?? ""}`.trim() : "Pix cancelado no Asaas (não autorizado)" }).eq("id", x.id).is("cancelado_em", null)
          await sb.from("borderos").update({ status: "enviado", movimento_id: null, pago_em: null }).eq("movimento_id", x.id).eq("status", "pago")
        } else {
          await sb.from("saques").update({ status: "solicitado", pago_em: null, comprovante_path: null }).eq("id", x.id).eq("status", "pago")
        }
        out.push({ ...x, situacao: "desfeito", motivo: st }); return
      }
      out.push({ ...x, situacao: t.authorized === false ? "aguardando_token" : "processando" })
    }))
  }
  const ag = out.filter(x => x.situacao === "aguardando_token")
  return NextResponse.json({ itens: out.map(({ comprovante_path, ...r }) => r), aguardando: ag.length, valorAguardando: Math.round(ag.reduce((t, x) => t + Number(x.valor), 0) * 100) / 100, desfeitos: out.filter(x => x.situacao === "desfeito").length })
}
