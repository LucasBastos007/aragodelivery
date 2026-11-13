// Recado da equipe pelo WhatsApp do Chegô (pedido do Lucas, 10/11/2026): o Claude manda avisos
// (ex.: resumo das promoções para a Amanda) pelo número da instância Z-API. Só com o CRON_SECRET.
import { NextResponse } from "next/server"
import { enviarTexto, zapi, zapiOk } from "@/lib/whatsSuporte"

export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "não autorizado" }, { status: 401 })
  if (!zapiOk()) return NextResponse.json({ error: "WhatsApp do Chegô não configurado" }, { status: 503 })
  const { telefone, mensagem, pdf_base64, nome_arquivo } = await req.json().catch(() => ({}))
  const digitos = String(telefone ?? "").replace(/\D/g, "")
  const fone = digitos.startsWith("55") ? digitos : "55" + digitos
  // PDF (13/11/2026): relatório pra equipe, ex. clientes do dia pra Amanda. A mensagem vira a legenda.
  if (pdf_base64) {
    if (digitos.length < 10 || !/^[A-Za-z0-9+/=]+$/.test(String(pdf_base64))) return NextResponse.json({ error: "telefone ou PDF inválidos" }, { status: 400 })
    try {
      const r = await zapi("send-document/pdf", "POST", { phone: fone, document: `data:application/pdf;base64,${pdf_base64}`, fileName: String(nome_arquivo ?? "relatorio").replace(/[^\w .-]/g, "").slice(0, 80) || "relatorio", caption: String(mensagem ?? "").slice(0, 1000) })
      return NextResponse.json({ ok: true, id: (r as any)?.messageId ?? (r as any)?.id ?? null })
    } catch (e: any) { return NextResponse.json({ error: e?.message ?? "falha ao enviar" }, { status: 502 }) }
  }
  if (digitos.length < 10 || !String(mensagem ?? "").trim()) return NextResponse.json({ error: "telefone ou mensagem inválidos" }, { status: 400 })
  try {
    const r = await enviarTexto(fone, String(mensagem))
    return NextResponse.json({ ok: true, id: (r as any)?.messageId ?? (r as any)?.id ?? null })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "falha ao enviar" }, { status: 502 })
  }
}
