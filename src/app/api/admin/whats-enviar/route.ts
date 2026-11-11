// Recado da equipe pelo WhatsApp do Chegô (pedido do Lucas, 10/11/2026): o Claude manda avisos
// (ex.: resumo das promoções para a Amanda) pelo número da instância Z-API. Só com o CRON_SECRET.
import { NextResponse } from "next/server"
import { enviarTexto, zapiOk } from "@/lib/whatsSuporte"

export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "não autorizado" }, { status: 401 })
  if (!zapiOk()) return NextResponse.json({ error: "WhatsApp do Chegô não configurado" }, { status: 503 })
  const { telefone, mensagem } = await req.json().catch(() => ({}))
  const digitos = String(telefone ?? "").replace(/\D/g, "")
  if (digitos.length < 10 || !String(mensagem ?? "").trim()) return NextResponse.json({ error: "telefone ou mensagem inválidos" }, { status: 400 })
  try {
    const r = await enviarTexto(digitos.startsWith("55") ? digitos : "55" + digitos, String(mensagem))
    return NextResponse.json({ ok: true, id: (r as any)?.messageId ?? (r as any)?.id ?? null })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "falha ao enviar" }, { status: 502 })
  }
}
