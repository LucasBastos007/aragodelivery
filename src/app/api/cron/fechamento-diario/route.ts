export const dynamic = "force-dynamic"
export const maxDuration = 120
import { NextRequest, NextResponse } from "next/server"
import { gerarPdfLojistas, gerarPdfMotoboys } from "@/lib/relatorioDiario"

// Fechamento diário automático — pedido explícito do usuário, 2026-09-18: 1 e-mail
// todo dia às 10h (BRT) com 2 PDFs anexados (lojistas separados por loja dentro do
// mesmo arquivo + motoboys separados por entregador dentro do outro), cobrindo o dia
// anterior completo (00h-23h59 BRT). Ver vercel.json pro agendamento (0 13 * * * UTC =
// 10h BRT) e src/lib/relatorioDiario.ts pro cálculo/geração dos PDFs.
//
// Suporta `?data=YYYY-MM-DD` (mesma autenticação do cron) pra reprocessar um dia
// específico manualmente — nunca usado pelo cron em si (que sempre usa "ontem").

function ontemBrasilia(): string {
  const agora = new Date()
  const ontem = new Date(agora.getTime() - 24 * 3600000)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(ontem)
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const dataYmd = req.nextUrl.searchParams.get("data") || ontemBrasilia()
  const destinatario = process.env.EMAIL_FECHAMENTO_DIARIO || "lucasbastos1965@gmail.com"

  const [lojistas, motoboys] = await Promise.all([
    gerarPdfLojistas(dataYmd),
    gerarPdfMotoboys(dataYmd),
  ])

  const key = process.env.RESEND_API_KEY
  if (!key) return NextResponse.json({ error: "RESEND_API_KEY não configurada" }, { status: 500 })
  const { Resend } = await import("resend")
  const resend = new Resend(key)

  const dataLabel = (() => { const [a, m, d] = dataYmd.split("-"); return `${d}/${m}/${a}` })()

  // Lucro do app do dia = comissão cobrada dos lojistas (10%, respeitando isenções) +
  // corte retido da taxa de entrega do motoboy (`taxaMotoboy`, hoje R$0 pra pedidos
  // desde 17/09 por decisão do usuário — "não vamos retirar taxa pro Chegô" — mas a
  // conta é mantida corretamente caso a regra mude ou pra reprocessar dias antigos).
  // NÃO inclui mensalidade/assinatura de loja — isso é receita recorrente separada, não
  // por pedido, e não tem fonte confiável de cálculo diário confirmada nesta sessão.
  const lucroApp = lojistas.comissaoTotal + motoboys.corteAppTotal
  const R = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const { error } = await resend.emails.send({
    from: "Chegô Delivery <noreply@chegodelivery.com>",
    to: destinatario,
    subject: `Fechamento diário Chegô — ${dataLabel}`,
    html: `<h2>Fechamento diário — ${dataLabel}</h2>
      <p style="font-size:16px"><strong>Lucro do app no dia: R$ ${R(lucroApp)}</strong></p>
      <p style="color:#6B7280;font-size:12px;margin-top:-8px">Comissão dos lojistas (R$ ${R(lojistas.comissaoTotal)}) + corte retido da taxa de entrega (R$ ${R(motoboys.corteAppTotal)}). Não inclui mensalidade de loja.</p>
      <p>Em anexo:</p>
      <ul>
        <li><strong>Repasse aos lojistas</strong> — separado por loja${lojistas.temMovimento ? "" : " (sem movimento nesse dia)"}.</li>
        <li><strong>Repasse aos motoboys</strong> — separado por entregador${motoboys.temMovimento ? "" : " (sem movimento nesse dia)"}.</li>
      </ul>
      <p style="color:#6B7280;font-size:12px">Gerado automaticamente pelo sistema Chegô Delivery.</p>`,
    attachments: [
      { filename: `Chego_Repasse_Lojistas_${dataYmd}.pdf`, content: lojistas.buffer },
      { filename: `Chego_Repasse_Motoboys_${dataYmd}.pdf`, content: motoboys.buffer },
    ],
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data: dataYmd, destinatario, lucroApp, comissaoTotal: lojistas.comissaoTotal, corteAppTotal: motoboys.corteAppTotal, lojistasTemMovimento: lojistas.temMovimento, motoboysTemMovimento: motoboys.temMovimento })
}
