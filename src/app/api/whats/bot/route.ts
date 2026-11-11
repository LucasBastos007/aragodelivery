export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"
import { chaveBot, enviarTexto, final8 } from "@/lib/whatsSuporte"
import { criarCliente, criarPix, getPixQrCode, cancelarPagamento } from "@/lib/asaas"
import { after } from "next/server"
import { atenderMensagem, lerConfig, pausarConversa } from "@/lib/roboPedidos"

export const maxDuration = 60

// Robô do WhatsApp (Z-API), só para problema de pagamento (pedido do Lucas, 24/10/2026).
// Responde apenas quando a mensagem cita "#CODIGO" de um pedido que ainda espera Pix e veio do
// mesmo telefone do cliente. Gera um Pix novo pelo Asaas (reserva do Mercado Pago), cancela o
// anterior e manda o copia e cola. Máximo de 2 Pix novos por pedido. Qualquer outra mensagem é
// ignorada (fica para o atendimento humano).
const LIMITE = 2

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export async function POST(req: NextRequest) {
  const k = req.nextUrl.searchParams.get("k") ?? ""
  const certa = chaveBot()
  if (k.length !== certa.length || !crypto.timingSafeEqual(Buffer.from(k), Buffer.from(certa))) return NextResponse.json({ error: "não autorizado" }, { status: 401 })
  // Na Vercel o token OIDC (que autentica no AI Gateway) chega no cabeçalho da requisição, não no ambiente
  const oidc = req.headers.get("x-vercel-oidc-token")
  if (oidc) process.env.VERCEL_OIDC_TOKEN = oidc

  const b = await req.json().catch(() => null) as any
  if (!b || b.isGroup || b.isNewsletter || b.type !== "ReceivedCallback") return NextResponse.json({ ok: true })
  const telefone: string = String(b.phone ?? "").replace(/\D/g, "")
  // Alguém da equipe respondeu pelo próprio WhatsApp da Chegô: o robô sai dessa conversa por 2h
  if (b.fromMe) { if (!b.fromApi && telefone) await pausarConversa(telefone).catch(() => {}); return NextResponse.json({ ok: true }) }
  const texto: string = b.text?.message ?? b.image?.caption ?? ""
  const cod = texto.match(/#\s*([A-Z0-9]{5,8})\b/i)?.[1]?.toUpperCase()
  const db = sb()
  if (!cod || !/pag/i.test(texto)) return roboPedidos(db, b, telefone, texto)

  // Mesma mensagem não processa duas vezes (o Z-API pode reenviar)
  if (b.messageId) {
    const { error } = await db.from("webhook_events").insert({ provider: "zapi-msg", external_event_id: String(b.messageId), payload: { phone: final8(telefone), cod } })
    if (error?.code === "23505") return NextResponse.json({ ok: true, duplicado: true })
  }

  const { data: p } = await db.from("pedidos")
    .select("id, codigo, status, total, forma_pagamento, forma_pagamento_2, asaas_payment_id, cpf_cliente, nome_cliente, telefone_cliente, cliente_id")
    .eq("codigo", cod).maybeSingle()
  let telCliente: string | null = p?.telefone_cliente ?? null
  if (p && !telCliente && p.cliente_id) telCliente = (await db.from("clientes").select("telefone").eq("id", p.cliente_id).maybeSingle()).data?.telefone ?? null

  if (!p || !telCliente || final8(telCliente) !== final8(telefone)) {
    await enviarTexto(telefone, `Não encontrei o pedido #${cod} neste número. Um atendente da Chegô vai te responder por aqui.`).catch(() => {})
    return NextResponse.json({ ok: true, motivo: "pedido ou telefone não confere" })
  }
  if (p.status !== "aguardando_pagamento") {
    const msg = ["cancelado", "expirado", "recusado"].includes(p.status)
      ? `O pedido #${cod} foi cancelado. Se quiser, faça um novo pedido pelo app.`
      : `O pagamento do pedido #${cod} já foi confirmado e ele está com a loja.`
    await enviarTexto(telefone, msg).catch(() => {})
    return NextResponse.json({ ok: true, motivo: "status " + p.status })
  }
  if (p.forma_pagamento !== "pix" || p.forma_pagamento_2) {
    await enviarTexto(telefone, `Recebemos sua mensagem sobre o pedido #${cod}. Um atendente da Chegô vai te ajudar por aqui.`).catch(() => {})
    return NextResponse.json({ ok: true, motivo: "não é Pix simples" })
  }

  const { count } = await db.from("webhook_events").select("id", { count: "exact", head: true }).eq("provider", "whats-bot-pix").like("external_event_id", `${p.id}#%`)
  if ((count ?? 0) >= LIMITE) {
    await enviarTexto(telefone, `Já geramos ${LIMITE} códigos Pix novos para o pedido #${cod}. Um atendente da Chegô vai te ajudar por aqui.`).catch(() => {})
    return NextResponse.json({ ok: true, motivo: "limite" })
  }

  try {
    const cliente = await criarCliente(p.nome_cliente || "Cliente Chegô", {
      cpf: p.cpf_cliente ?? undefined, telefone: telCliente,
      email: `pedido_${p.id.replace(/-/g, "").slice(0, 12)}@chegodelivery.com`,
    })
    const cobranca = await criarPix(cliente.id, Number(p.total), p.id)
    const qr = await getPixQrCode(cobranca.id)
    const anterior = p.asaas_payment_id
    await db.from("pedidos").update({ asaas_payment_id: cobranca.id, pix_copia_cola: qr.payload }).eq("id", p.id).eq("status", "aguardando_pagamento")
    await db.from("webhook_events").insert({ provider: "whats-bot-pix", external_event_id: `${p.id}#${(count ?? 0) + 1}`, payload: { cobranca: cobranca.id, anterior } })
    if (anterior && anterior !== cobranca.id) cancelarPagamento(anterior).catch(() => {})
    const falhaEnvio = (e: unknown) => console.error("[WHATS BOT] Pix gerado mas a mensagem não saiu", cod, e)
    await enviarTexto(telefone, `Pronto! Geramos um Pix novo para o pedido #${cod}, no valor de ${brl(Number(p.total))}.\n\nCopie o código da próxima mensagem e cole em "Pix copia e cola" no app do seu banco. Assim que o pagamento cair, o pedido vai para a loja.`).catch(falhaEnvio)
    await enviarTexto(telefone, qr.payload).catch(falhaEnvio)
    return NextResponse.json({ ok: true, gerado: true })
  } catch (e) {
    console.error("[WHATS BOT] falha ao gerar Pix", cod, e)
    await enviarTexto(telefone, `Não consegui gerar um Pix novo agora para o pedido #${cod}. Um atendente da Chegô vai te ajudar por aqui.`).catch(() => {})
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}

// Robô de pedidos (24/10/2026). Só responde se estiver ligado e, no período de teste, só para
// os números liberados. Processa depois de responder 200 ao Z-API (a IA pode levar alguns segundos).
async function roboPedidos(db: any, b: any, telefone: string, texto: string) {
  const cfg = await lerConfig(db)
  if (!cfg.ativo || !telefone || telefone.length < 10) return NextResponse.json({ ok: true, robo: "desligado" })
  if (cfg.so_numeros.length && !cfg.so_numeros.includes(telefone.slice(-8))) return NextResponse.json({ ok: true, robo: "fora do teste" })
  if (b.messageId) {
    const { error } = await db.from("webhook_events").insert({ provider: "zapi-robo", external_event_id: String(b.messageId), payload: { t: telefone.slice(-4) } })
    if (error?.code === "23505") return NextResponse.json({ ok: true, duplicado: true })
  }
  const entrada: any = {}
  if (b.audio?.audioUrl) entrada.audio = { url: b.audio.audioUrl, mime: b.audio.mimeType }
  else if (b.location?.latitude) entrada.localizacao = { lat: Number(b.location.latitude), lng: Number(b.location.longitude) }
  else if (texto) entrada.texto = texto
  else if (b.image) entrada.texto = "[o cliente mandou uma foto sem texto]"
  else return NextResponse.json({ ok: true })
  after(async () => { await atenderMensagem(telefone, entrada).catch(e => console.error("[ROBO] falha", e)) })
  return NextResponse.json({ ok: true, robo: "processando" })
}
