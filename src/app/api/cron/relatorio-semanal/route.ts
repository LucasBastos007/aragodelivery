export const dynamic = "force-dynamic"
export const maxDuration = 300
import { NextRequest, NextResponse } from "next/server"
import { gerarPdfAvulsas, gerarPdfLojistas, gerarPdfMotoboys } from "@/lib/relatorioDiario"

// Relatório semanal pro financeiro — pedido do usuário, 2026-10-09: toda SEXTA às 9h
// (BRT) vai pro e-mail da esposa dele (que cuida do financeiro) o fechamento da semana
// FECHADA de sexta a quinta (dias inteiros, 00h–23h59 BRT), com 2 PDFs: repasse aos
// lojistas (consolidado, cada loja detalhada pedido a pedido) e repasse aos motoboys.
// Agendamento em vercel.json: "0 12 * * 5" (12h UTC de sexta = 9h BRT).
//
// Manual (mesma autenticação do cron): ?de=YYYY-MM-DD&ate=YYYY-MM-DD reprocessa um
// período; ?teste=1 gera os PDFs e devolve o resumo SEM enviar e-mail; ?apenas=avulsas
// manda só o relatório das entregas avulsas (3º anexo, incluído em 2026-10-09).

const DESTINATARIO_PADRAO = "amanbpaula@gmail.com"

function diaBrt(offsetDias: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + offsetDias * 86400000))
}
const fmt = (ymd: string) => { const [a, m, d] = ymd.split("-"); return `${d}/${m}/${a}` }
const fmtCurto = (ymd: string) => { const [, m, d] = ymd.split("-"); return `${d}-${m}` }
const DATA = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const sp = req.nextUrl.searchParams
  // Rodando na sexta: semana = sexta passada (hoje − 7) até ontem (quinta, hoje − 1)
  const de = DATA.test(sp.get("de") ?? "") ? sp.get("de")! : diaBrt(-7)
  const ate = DATA.test(sp.get("ate") ?? "") ? sp.get("ate")! : diaBrt(-1)
  const destinatario = process.env.EMAIL_RELATORIO_SEMANAL || DESTINATARIO_PADRAO

  const soAvulsas = sp.get("apenas") === "avulsas"
  // Um PDF por vez: cada um sobe um Chromium — em paralelo estoura memória da função
  const lojistas = soAvulsas ? null : await gerarPdfLojistas(de, ate)
  const motoboys = soAvulsas ? null : await gerarPdfMotoboys(de, ate)
  const avulsas = await gerarPdfAvulsas(de, ate)
  if (soAvulsas) {
    if (sp.get("teste") === "1") return NextResponse.json({ ok: true, teste: true, de, ate, destinatario, avulsasTemMovimento: avulsas.temMovimento })
    const keyA = process.env.RESEND_API_KEY
    if (!keyA) return NextResponse.json({ error: "RESEND_API_KEY não configurada" }, { status: 500 })
    const { Resend } = await import("resend")
    const { error } = await new Resend(keyA).emails.send({
      from: "Chegô Delivery <noreply@chegodelivery.com>", to: destinatario,
      subject: `Entregas avulsas Chegô — ${fmt(de)} a ${fmt(ate)}`,
      html: `<h2>Entregas avulsas — ${fmt(de)} a ${fmt(ate)}</h2><p>Em anexo o relatório das corridas avulsas da semana: resumo por loja e por motoboy e a lista completa (cliente, endereço, motoboy, itens, taxa, repasse e comissão).</p><p style="color:#6B7280;font-size:12px">Gerado automaticamente pelo sistema Chegô Delivery.</p>`,
      attachments: [{ filename: `Chego_Entregas_Avulsas_${fmtCurto(de)}_a_${fmtCurto(ate)}.pdf`, content: avulsas.buffer }],
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, apenas: "avulsas", de, ate, destinatario })
  }
  if (!lojistas || !motoboys) return NextResponse.json({ error: "Falha ao gerar" }, { status: 500 })
  const lucroApp = lojistas.comissaoTotal + motoboys.corteAppTotal
  const R = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const resumo = { de, ate, destinatario, lucroApp, comissaoTotal: lojistas.comissaoTotal, lojistasTemMovimento: lojistas.temMovimento, motoboysTemMovimento: motoboys.temMovimento, avulsasTemMovimento: avulsas.temMovimento }
  if (sp.get("teste") === "1") return NextResponse.json({ ok: true, teste: true, ...resumo, tamanhos: { lojistas: lojistas.buffer.length, motoboys: motoboys.buffer.length, avulsas: avulsas.buffer.length } })

  const key = process.env.RESEND_API_KEY
  if (!key) return NextResponse.json({ error: "RESEND_API_KEY não configurada" }, { status: 500 })
  const { Resend } = await import("resend")
  const { error } = await new Resend(key).emails.send({
    from: "Chegô Delivery <noreply@chegodelivery.com>",
    to: destinatario,
    subject: `Relatório semanal Chegô — ${fmt(de)} a ${fmt(ate)}`,
    html: `<h2>Relatório semanal — ${fmt(de)} a ${fmt(ate)}</h2>
      <p style="font-size:16px"><strong>Comissão da Chegô na semana: R$ ${R(lucroApp)}</strong></p>
      <p style="color:#6B7280;font-size:12px;margin-top:-8px">Comissão dos lojistas (R$ ${R(lojistas.comissaoTotal)}) + corte da taxa de entrega (R$ ${R(motoboys.corteAppTotal)}). Não inclui mensalidade de loja.</p>
      <p>Em anexo:</p>
      <ul>
        <li><strong>Repasse aos lojistas</strong> — cada loja com resumo, formas de pagamento e todos os pedidos (itens, valores, comissão e taxas)${lojistas.temMovimento ? "" : " (sem movimento na semana)"}.</li>
        <li><strong>Repasse aos motoboys</strong> — separado por entregador${motoboys.temMovimento ? "" : " (sem movimento na semana)"}.</li>
        <li><strong>Entregas avulsas</strong> — corrida a corrida, por loja e por motoboy${avulsas.temMovimento ? "" : " (sem avulsas na semana)"}.</li>
      </ul>
      <p style="color:#6B7280;font-size:12px">Semana de sexta a quinta (dias inteiros). Gerado automaticamente pelo sistema Chegô Delivery.</p>`,
    attachments: [
      { filename: `Chego_Repasse_Lojistas_${fmtCurto(de)}_a_${fmtCurto(ate)}.pdf`, content: lojistas.buffer },
      { filename: `Chego_Repasse_Motoboys_${fmtCurto(de)}_a_${fmtCurto(ate)}.pdf`, content: motoboys.buffer },
      { filename: `Chego_Entregas_Avulsas_${fmtCurto(de)}_a_${fmtCurto(ate)}.pdf`, content: avulsas.buffer },
    ],
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, ...resumo })
}
