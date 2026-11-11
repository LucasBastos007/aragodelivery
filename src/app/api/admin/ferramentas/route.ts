export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, unauthorized } from "@/lib/session"

// Ferramentas (admin 2.0, 20/10/2026): roda na hora, com um botão, rotinas que já existem.
// O segredo das rotinas fica só no servidor. Só ações seguras e da lista abaixo.
const ACOES: Record<string, (hoje: string) => string> = {
  saude: () => "/api/cron/monitorar-saude",
  fechamento_teste: (hoje) => `/api/cron/fechamento-diario?teste=1&data=${hoje}`,
  reescalar: () => "/api/cron/re-escalar",
  zapi_bot: () => "/api/cron/zapi-config",
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const { acao } = await req.json().catch(() => ({}))
  const rota = ACOES[acao]; if (!rota) return NextResponse.json({ error: "Ferramenta desconhecida." }, { status: 400 })
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "Rotinas sem senha configurada no servidor." }, { status: 500 })
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
  const r = await fetch(new URL(rota(hoje), req.nextUrl.origin), { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, cache: "no-store" }).catch(() => null)
  if (!r) return NextResponse.json({ error: "A rotina não respondeu." }, { status: 502 })
  const j = await r.json().catch(() => ({}))
  return NextResponse.json({ ok: r.ok, status: r.status, resultado: j }, { status: r.ok ? 200 : 502 })
}
