export const dynamic = "force-dynamic"
export const maxDuration = 120
import { NextRequest, NextResponse } from "next/server"
import { DIAS_PARADO, gerarPlanilhaClientes } from "@/lib/relatorioClientes"

// Relatório mensal "clientes que pararam de pedir" — pedido do usuário, 2026-10-09: todo
// DIA 1 às 9h (BRT) vai pro e-mail da esposa dele (financeiro) a planilha com cada cliente,
// quantos pedidos fez, loja mais pedida e último pedido, destacando quem está 14+ dias
// sem pedir. Agendamento em vercel.json: "0 12 1 * *" (12h UTC = 9h BRT).
// Manual (mesma autenticação do cron): ?teste=1 gera a planilha e devolve o resumo SEM enviar.

const DESTINATARIO_PADRAO = "amanbpaula@gmail.com"
const esc = (s: string) => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const destinatario = process.env.EMAIL_RELATORIO_SEMANAL || DESTINATARIO_PADRAO
  const r = await gerarPlanilhaClientes()
  if (req.nextUrl.searchParams.get("teste") === "1") {
    return NextResponse.json({ ok: true, teste: true, destinatario, resumo: r.resumo, tamanho: r.buffer.length })
  }
  const key = process.env.RESEND_API_KEY
  if (!key) return NextResponse.json({ error: "RESEND_API_KEY não configurada" }, { status: 500 })

  const td = "border-bottom:1px solid #eee;padding:4px 8px"
  const resumo = r.resumo.map(([a, b]) => `<tr><td style="padding:4px 12px 4px 0">${esc(a)}</td><td style="font-weight:bold">${b}</td></tr>`).join("")
  const top = r.parados.slice(0, 15).map(l => {
    const [a, m, d] = l.ultimo.split("-")
    return `<tr><td style="${td}">${esc(l.nome)}</td><td style="${td};text-align:center">${l.pedidos}</td><td style="${td}">${esc(l.loja)}</td><td style="${td};text-align:center">${d}/${m}/${a}</td><td style="${td};text-align:center">${l.dias}</td></tr>`
  }).join("")
  const { Resend } = await import("resend")
  const { error } = await new Resend(key).emails.send({
    from: "Chegô Delivery <noreply@chegodelivery.com>",
    to: destinatario,
    subject: `Chegô — Clientes que pararam de pedir (${r.fmtHoje})`,
    html: `<div style="font-family:Arial,sans-serif;color:#222;max-width:720px">
      <h2 style="color:#5B2C83">Clientes que pararam de pedir — Chegô</h2>
      <p>Em anexo a planilha com os clientes que já pediram pelo app e estão há <b>${DIAS_PARADO} dias ou mais</b> sem pedir (só pedidos entregues, desde o início do app).</p>
      <table style="font-size:14px;margin-bottom:16px">${resumo}</table>
      <h3 style="color:#5B2C83;font-size:15px">Os 15 que mais pediam e sumiram</h3>
      <table style="border-collapse:collapse;font-size:13px;width:100%"><tr style="background:#5B2C83;color:#fff"><th style="padding:6px;text-align:left">Cliente</th><th>Pedidos</th><th style="text-align:left">Loja mais pedida</th><th>Último pedido</th><th>Dias</th></tr>${top}</table>
      <p style="font-size:13px;color:#555;margin-top:16px">Na planilha: aba <b>Pararam de pedir</b> (telefone, lojas, total gasto e faixa 14–29 / 30–59 / 60+ dias) e aba <b>Todos os clientes</b>.</p>
      <p style="color:#6B7280;font-size:12px">Enviado todo dia 1º do mês. Gerado automaticamente pelo sistema Chegô Delivery.</p></div>`,
    attachments: [{ filename: `Chego_Clientes_que_pararam_${r.hoje}.xlsx`, content: r.buffer }],
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, destinatario, resumo: r.resumo })
}
