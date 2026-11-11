export const dynamic = "force-dynamic"
export const maxDuration = 300
import { NextRequest, NextResponse } from "next/server"
import { adminSb, calcularFechamento, ymdBrt } from "@/lib/fechamentoFinanceiro"
import { dataBr, emailFechamento, excelFechamento, htmlFechamento } from "@/lib/fechamentoRelatorio"
import { renderHtmlParaPdf } from "@/lib/relatorioDiario"

// Fechamento financeiro diário — pedido do Lucas em 16/10/2026, substitui o fechamento
// das 10h (2026-09-18). Roda às 23h59 de Brasília (vercel.json: "59 2 * * *" UTC) e
// fecha o PRÓPRIO dia: o dia é calculado como "agora − 10 min" em Brasília, então um
// atraso do cron até 00h09 ainda fecha o dia certo.
//
// Parâmetros (todos exigem o CRON_SECRET):
//   ?data=YYYY-MM-DD  reprocessa um dia específico
//   ?forcar=1         reenvia mesmo se o dia já foi enviado
//   ?teste=1          não grava histórico nem importa Pix; envia só para ?para= (padrão: Lucas)
//   ?formato=html|json  só devolve o relatório, sem e-mail
//
// Nunca altera valores financeiros nem executa repasses. A única escrita é o histórico
// em `fechamentos_diarios` e a importação idempotente dos Pix enviados pelo Asaas.

const DESTINATARIOS_PADRAO = ["lucasbastos1965@gmail.com", "amanbpaula@gmail.com"]

function destinatarios(): string[] {
  const env = process.env.FECHAMENTO_DESTINATARIOS
  return env ? env.split(",").map(s => s.trim()).filter(Boolean) : DESTINATARIOS_PADRAO
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const q = req.nextUrl.searchParams
  const dataYmd = q.get("data") || ymdBrt(new Date(Date.now() - 10 * 60000))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataYmd)) return NextResponse.json({ error: "data inválida" }, { status: 400 })
  const teste = q.get("teste") === "1", forcar = q.get("forcar") === "1", formato = q.get("formato")
  const sb = adminSb()

  if (formato === "html" || formato === "json") {
    const f = await calcularFechamento(dataYmd, { persistir: false, sb })
    return formato === "html" ? new NextResponse(htmlFechamento(f), { headers: { "content-type": "text/html; charset=utf-8" } }) : NextResponse.json(f)
  }

  // Trava contra envio duplicado (um fechamento por dia)
  if (!teste) {
    const { data: atual } = await sb.from("fechamentos_diarios").select("status, iniciado_em, tentativas").eq("data", dataYmd).maybeSingle()
    if (atual?.status === "enviado" && !forcar) return NextResponse.json({ ok: true, ignorado: "já enviado", data: dataYmd })
    if (atual?.status === "processando" && Date.now() - new Date(atual.iniciado_em).getTime() < 10 * 60000 && !forcar)
      return NextResponse.json({ ok: true, ignorado: "em processamento", data: dataYmd })
    const { error } = await sb.from("fechamentos_diarios").upsert({
      data: dataYmd, status: "processando", iniciado_em: new Date().toISOString(), tentativas: (atual?.tentativas ?? 0) + 1, erro: null, atualizado_em: new Date().toISOString(),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const para = teste ? (q.get("para") ? [q.get("para")!] : ["lucasbastos1965@gmail.com"]) : destinatarios()
  try {
    const f = await calcularFechamento(dataYmd, { persistir: !teste, sb })
    const [pdf, xlsx] = await Promise.all([renderHtmlParaPdf(htmlFechamento(f)), excelFechamento(f)])
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error("RESEND_API_KEY não configurada")
    const { Resend } = await import("resend")
    const { assunto, html } = emailFechamento(f)
    const { data: env, error } = await new Resend(key).emails.send({
      from: "Chegô Delivery <noreply@chegodelivery.com>",
      to: para,
      subject: teste ? `[TESTE] ${assunto}` : assunto,
      html,
      attachments: [
        { filename: `Chego_Fechamento_${dataYmd}.pdf`, content: pdf },
        { filename: `Chego_Fechamento_${dataYmd}.xlsx`, content: xlsx },
      ],
    }, { idempotencyKey: teste ? undefined : `fechamento-${dataYmd}-${forcar ? Date.now() : "v1"}` })
    if (error) throw new Error(`Resend: ${error.message}`)

    if (!teste) {
      await sb.from("fechamentos_diarios").update({
        status: "enviado", corte_em: f.corteEm, ultimo_movimento_em: f.ultimoMovimentoEm, finalizado_em: new Date().toISOString(),
        email_id: env?.id ?? null, destinatarios: para, totais: { resumo: f.resumo, receita: { ...f.receita, despesasDetalhe: undefined }, alertas: f.alertas.length },
        pedidos_snapshot: f.snapshot, atualizado_em: new Date().toISOString(),
      }).eq("data", dataYmd)
    }
    return NextResponse.json({ ok: true, data: dataYmd, teste, para, emailId: env?.id, resumo: f.resumo, alertas: f.alertas.length })
  } catch (e: any) {
    const msg = e?.message ?? String(e)
    if (!teste) {
      await sb.from("fechamentos_diarios").update({ status: "erro", erro: msg, finalizado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() }).eq("data", dataYmd)
      try {
        const { Resend } = await import("resend")
        await new Resend(process.env.RESEND_API_KEY!).emails.send({
          from: "Chegô Delivery <noreply@chegodelivery.com>", to: ["lucasbastos1965@gmail.com"],
          subject: `CHEGÔ | ERRO no Fechamento Financeiro Diário | ${dataBr(dataYmd)}`,
          html: `<p>O fechamento de ${dataBr(dataYmd)} falhou e foi registrado para reprocessamento.</p><p><b>Erro:</b> ${msg.replace(/</g, "&lt;")}</p><p>Para reprocessar: chamar <code>/api/cron/fechamento-diario?data=${dataYmd}</code> com o CRON_SECRET.</p>`,
        })
      } catch {}
    }
    return NextResponse.json({ error: msg, data: dataYmd }, { status: 500 })
  }
}
