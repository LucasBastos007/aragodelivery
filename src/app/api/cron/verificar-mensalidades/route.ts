import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const DIAS_TOLERANCIA = 4

const PLANO_VALOR: Record<string, number> = {
  select: 149,
  prime:  497,
  black:  997,
}

function proximoVencimento(dia: number): Date {
  const hoje = new Date()
  const ano  = hoje.getFullYear()
  const mes  = hoje.getMonth()
  const d = new Date(ano, mes, dia)
  if (d <= hoje) {
    d.setMonth(d.getMonth() + 1)
  }
  return d
}

function mesReferencia(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  // Busca todas as lojas ativas com plano pago (não gold)
  const { data: lojas } = await sb.from("lojas")
    .select("id, nome, plano, mensalidade_dia, mensalidade_vencimento, mensalidade_paga_em, status")
    .in("plano", ["select", "prime", "black"])
    .in("status", ["ativo", "suspenso"])

  if (!lojas?.length) return NextResponse.json({ ok: true, processadas: 0 })

  let bloqueadas = 0
  let reativadas = 0
  let mensalidadesGeradas = 0

  for (const loja of lojas) {
    const dia = loja.mensalidade_dia ?? 10
    const valor = PLANO_VALOR[loja.plano] ?? 149

    // Garante que existe mensalidade do mês atual
    const mesAtual = mesReferencia(hoje)
    const vencimentoAtual = new Date(hoje.getFullYear(), hoje.getMonth(), dia)
    // Se o dia já passou nesse mês, a mensalidade desse mês venceu no dia certo
    const vencimento = new Date(hoje.getFullYear(), hoje.getMonth(), dia)

    const { data: mensExistente } = await sb.from("mensalidades")
      .select("id, status, vencimento, pago_em")
      .eq("loja_id", loja.id)
      .eq("mes_referencia", mesAtual)
      .single()

    if (!mensExistente) {
      await sb.from("mensalidades").insert({
        loja_id: loja.id,
        valor,
        mes_referencia: mesAtual,
        vencimento: vencimento.toISOString().slice(0, 10),
        status: "pendente",
      })
      mensalidadesGeradas++
    }

    // Verifica se está atrasada (vencimento + tolerância < hoje) e não foi paga
    const mens = mensExistente ?? null
    if (!mens || mens.pago_em || mens.status === "pago") continue

    const dataVenc = new Date(mens.vencimento)
    dataVenc.setHours(0, 0, 0, 0)
    const diasAtraso = Math.floor((hoje.getTime() - dataVenc.getTime()) / 86_400_000)

    if (diasAtraso >= DIAS_TOLERANCIA) {
      // Bloqueia loja
      if (loja.status === "ativo") {
        await sb.from("lojas").update({ status: "suspenso" }).eq("id", loja.id)
        await sb.from("mensalidades").update({ status: "bloqueado" }).eq("id", mens.id)
        bloqueadas++
      }
    } else if (loja.status === "suspenso" && diasAtraso < DIAS_TOLERANCIA) {
      // Não deveria estar suspenso por mensalidade ainda — reativa
      await sb.from("lojas").update({ status: "ativo" }).eq("id", loja.id)
      reativadas++
    }
  }

  return NextResponse.json({ ok: true, bloqueadas, reativadas, mensalidadesGeradas })
}
