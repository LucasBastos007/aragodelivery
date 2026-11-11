export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { enviarTexto, zapiOk } from "@/lib/whatsSuporte"

// Monitoramento de saúde do banco — criado depois do incidente de 2026-09-17 (Nano
// Compute ficou sem memória e o banco parou de responder consultas reais por ~1h30,
// confirmado pelo próprio suporte da Supabase). Roda via Vercel Cron (ver vercel.json)
// e testa consultas reais nas tabelas mais usadas — a mesma checagem que foi feita na
// mão durante o incidente (uma tabela raiz "saudável" não pega isso, só um SELECT real
// revela lentidão/OOM). Usa webhook_events como registro de estado pra não mandar um
// e-mail de alerta a cada execução enquanto o problema persiste (throttle de 30min) e
// pra avisar quando normalizar de novo.

const TABELAS = ["motoboys", "pedidos", "lojas"]
const TIMEOUT_MS = 5000
const LIMIAR_LENTO_MS = 3000
const THROTTLE_ALERTA_MIN = 30
// Alarme no celular (pedido do Lucas depois do travamento de 31/10/2026): além do e-mail,
// manda WhatsApp pelo Z-API. Roda a cada 2 min (vercel.json).
const WHATS_ALERTA = "5562991032686"

async function avisarWhats(msg: string) {
  if (!zapiOk()) return
  await enviarTexto(WHATS_ALERTA, msg).catch(e => console.error("[MONITOR] whats falhou", e))
}

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

async function testarTabela(tabela: string) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${tabela}?select=id&limit=1`
  const inicio = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      signal: controller.signal,
    })
    clearTimeout(timer)
    const tempoMs = Date.now() - inicio
    return { tabela, ok: res.ok, tempoMs, status: res.status }
  } catch {
    return { tabela, ok: false, tempoMs: Date.now() - inicio, status: 0 }
  }
}

async function enviarAlerta(assunto: string, htmlCorpo: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) return
  const { Resend } = await import("resend")
  const resend = new Resend(key)
  await resend.emails.send({
    from: "Chegô Delivery <noreply@chegodelivery.com>",
    to: "lucasbastos1965@gmail.com",
    subject: assunto,
    html: htmlCorpo,
  })
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  // ?teste=1 (com a mesma senha do cron): só manda uma mensagem de teste do alarme
  if (new URL(req.url).searchParams.get("teste") === "1") {
    if (!zapiOk()) return NextResponse.json({ ok: false, erro: "Z-API não configurada" })
    const hora = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
    try {
      await enviarTexto(WHATS_ALERTA, `🔴 Chegô (TESTE do alarme, ${hora}): o banco NÃO está respondendo. Cliente, loja e admin podem estar travados.\n\nIsto é só um teste, está tudo funcionando.`)
      return NextResponse.json({ ok: true, enviado: true })
    } catch (e: any) { return NextResponse.json({ ok: false, erro: e.message }) }
  }

  const sb = adminSb()
  const resultados = await Promise.all(TABELAS.map(testarTabela))
  const falhas = resultados.filter(r => !r.ok)
  const lentas = resultados.filter(r => r.ok && r.tempoMs > LIMIAR_LENTO_MS)
  const statusAtual: "down" | "lento" | "saudavel" = falhas.length > 0 ? "down" : lentas.length > 0 ? "lento" : "saudavel"

  const { data: ultimoEvento, error: erroEstado } = await sb
    .from("webhook_events")
    .select("payload, created_at")
    .eq("provider", "monitoramento_saude")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const statusAnterior = (ultimoEvento?.payload as any)?.status ?? "saudavel"
  const minutosDesdeUltimoAlerta = ultimoEvento
    ? (Date.now() - new Date(ultimoEvento.created_at).getTime()) / 60000
    : Infinity

  const tabelaResultados = resultados.map(r => `<li>${r.tabela}: ${r.ok ? `OK (${r.tempoMs}ms)` : `FALHOU (status ${r.status}, ${r.tempoMs}ms)`}</li>`).join("")

  let acao = "nenhuma"

  if (statusAtual !== "saudavel") {
    // Com o banco fora, nem o registro do último alerta dá pra ler: aí avisa no máximo
    // a cada ~10 min (minutos 0–1 de cada dezena) em vez de a cada execução.
    const podeAlertar = erroEstado
      ? new Date().getUTCMinutes() % 10 < 2
      : statusAnterior === "saudavel" || minutosDesdeUltimoAlerta >= THROTTLE_ALERTA_MIN
    if (podeAlertar) {
      await avisarWhats(statusAtual === "down"
        ? `🔴 Chegô: o banco NÃO está respondendo (${new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}). Cliente, loja e admin podem estar travados.`
        : `🟡 Chegô: o banco está lento (${resultados.map(r => `${r.tabela} ${r.tempoMs}ms`).join(", ")}). Pode travar se piorar.`)
      await enviarAlerta(
        statusAtual === "down" ? "🔴 Banco fora do ar — Arago Delivery" : "🟡 Banco lento — Arago Delivery",
        `<h2>${statusAtual === "down" ? "Banco de dados não está respondendo" : "Banco de dados respondendo devagar"}</h2>
         <p>Detectado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
         <ul>${tabelaResultados}</ul>
         <p>Confira o painel do Supabase (Observability) e considere reiniciar o projeto se persistir.</p>`
      )
      await sb.from("webhook_events").insert({
        provider: "monitoramento_saude",
        external_event_id: `alerta-${Date.now()}`,
        payload: { status: statusAtual, resultados },
      })
      acao = `alerta enviado (${statusAtual})`
    } else {
      acao = "já alertado recentemente, sem novo e-mail"
    }
  } else if (statusAnterior !== "saudavel") {
    await avisarWhats(`🟢 Chegô: o banco voltou ao normal (${new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}).`)
    await enviarAlerta(
      "🟢 Banco normalizado — Arago Delivery",
      `<h2>Banco de dados voltou ao normal</h2>
       <p>Confirmado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
       <ul>${tabelaResultados}</ul>`
    )
    await sb.from("webhook_events").insert({
      provider: "monitoramento_saude",
      external_event_id: `recuperado-${Date.now()}`,
      payload: { status: "saudavel", resultados },
    })
    acao = "alerta de recuperação enviado"
  }

  return NextResponse.json({ status: statusAtual, resultados, acao })
}
