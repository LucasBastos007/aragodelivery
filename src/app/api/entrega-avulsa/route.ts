import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"
import webpush from "web-push"

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function gerarCodigo() {
  return `AV${Math.floor(1000 + Math.random() * 9000)}`
}

function initVapid(): boolean {
  try {
    if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        process.env.VAPID_EMAIL,
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      )
      return true
    }
  } catch {}
  return false
}

async function notificarTodosMotoboys(avulsa_id: string, codigo: string, taxa_entrega: number) {
  const { data: motoboys } = await admin
    .from("motoboys")
    .select("id, push_subscription")
    .eq("disponivel", true)
    .eq("status", "ativo")

  if (!motoboys || motoboys.length === 0 || !initVapid()) return

  const payload = JSON.stringify({
    title:      "Nova entrega avulsa!",
    body:       `${codigo} — R$ ${taxa_entrega.toFixed(2)}`,
    tag:        `avulsa-${avulsa_id}`,
    url:        "/motoboy",
    avulsa_id,
    requireInteraction: true,
  })

  const expiredByMotoboy: Record<string, string[]> = {}

  await Promise.allSettled(
    motoboys.flatMap((m: any) => {
      const subs: any[] = Array.isArray(m.push_subscription)
        ? m.push_subscription
        : m.push_subscription ? [m.push_subscription] : []
      return subs.map(async sub => {
        try {
          await webpush.sendNotification(sub, payload)
        } catch (e: any) {
          if (e.statusCode === 410) {
            ;(expiredByMotoboy[m.id] ??= []).push(sub.endpoint)
          }
        }
      })
    })
  )

  // Limpa subscriptions expiradas
  for (const [motoboy_id, expiredEndpoints] of Object.entries(expiredByMotoboy)) {
    const m = motoboys.find((x: any) => x.id === motoboy_id)
    if (!m) continue
    const subs: any[] = Array.isArray(m.push_subscription)
      ? m.push_subscription
      : m.push_subscription ? [m.push_subscription] : []
    const filtradas = subs.filter((s: any) => !expiredEndpoints.includes(s?.endpoint))
    await admin.from("motoboys")
      .update({ push_subscription: filtradas.length ? filtradas : null })
      .eq("id", motoboy_id)
  }
}

export async function POST(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()
  const loja_id = sess.loja_id

  try {
    const { cliente_nome, cliente_tel, endereco, valor_pedido, taxa_entrega, observacao } =
      await req.json()

    if (!cliente_nome || !endereco) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })
    }

    const { data: loja } = await admin
      .from("lojas").select("nome, plano, status, lat, lng").eq("id", loja_id).single()

    if (!loja || loja.status !== "ativo") {
      return NextResponse.json({ error: "Loja não está ativa" }, { status: 403 })
    }
    if (!loja.plano || loja.plano === "gold") {
      return NextResponse.json({ error: "Plano não inclui entrega avulsa" }, { status: 403 })
    }

    const { data: entrega, error } = await admin
      .from("entregas_avulsas")
      .insert({
        loja_id,
        loja_nome:    loja.nome    || null,
        loja_lat:     loja.lat     ?? null,
        loja_lng:     loja.lng     ?? null,
        cliente_nome,
        cliente_tel:  cliente_tel  || "",
        endereco,
        valor_pedido: valor_pedido || 0,
        taxa_entrega: taxa_entrega || 0,
        observacao:   observacao   || "",
        status:       "aguardando",
        codigo:       gerarCodigo(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notifica TODOS os motoboys disponíveis simultaneamente
    notificarTodosMotoboys(
      entrega.id,
      entrega.codigo,
      taxa_entrega || 0
    ).catch(() => {})

    return NextResponse.json({ ok: true, entrega })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()
  const loja_id = sess.loja_id

  const { data, error } = await admin
    .from("entregas_avulsas")
    .select("*")
    .eq("loja_id", loja_id)
    .order("criado_em", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entregas: data })
}
