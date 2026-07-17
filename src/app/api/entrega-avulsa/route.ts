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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dL = (lat2 - lat1) * Math.PI / 180
  const dG = (lng2 - lng1) * Math.PI / 180
  const a  = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dG/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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

async function escalarMotoboy(avulsa_id: string, codigo: string, taxa_entrega: number, lojaLat: number | null, lojaLng: number | null) {
  const { data: motoboyData } = await admin
    .from("motoboys")
    .select("id, lat, lng, push_subscription")
    .eq("disponivel", true)
    .eq("status", "ativo")

  const motoboys = motoboyData ?? []
  if (motoboys.length === 0) return

  // Exclui motoboys já com entrega ativa
  const { data: comEntrega } = await admin
    .from("pedidos")
    .select("motoboy_id")
    .in("status", ["indo_para_loja", "na_loja", "em_rota", "aguardando_aceite", "coletado"])

  const ocupados = new Set((comEntrega ?? []).map((p: any) => p.motoboy_id).filter(Boolean))

  const candidatos = motoboys
    .filter(m => m.id && !ocupados.has(m.id) && m.lat && m.lng)
    .map(m => ({
      ...m,
      distLoja: lojaLat && lojaLng ? haversineKm(m.lat, m.lng, lojaLat, lojaLng) : 0,
    }))
    .sort((a, b) => a.distLoja - b.distLoja)

  if (candidatos.length === 0) return

  const escolhido = candidatos[0]

  await admin
    .from("entregas_avulsas")
    .update({ motoboy_id: escolhido.id, status: "aguardando_aceite" })
    .eq("id", avulsa_id)

  if (escolhido.push_subscription && initVapid()) {
    const subs: any[] = Array.isArray(escolhido.push_subscription)
      ? escolhido.push_subscription
      : [escolhido.push_subscription]
    const payload = JSON.stringify({
      title:      "Nova entrega avulsa!",
      body:       `${codigo} — R$ ${taxa_entrega.toFixed(2)}`,
      tag:        `motoboy-${escolhido.id}`,
      url:        "/motoboy",
      avulsa_id,
      motoboy_id: escolhido.id,
      requireInteraction: true,
    })
    const expiredEndpoints: string[] = []
    await Promise.allSettled(
      subs.map(async sub => {
        try { await webpush.sendNotification(sub, payload) }
        catch (e: any) { if (e.statusCode === 410) expiredEndpoints.push(sub.endpoint) }
      })
    )
    if (expiredEndpoints.length > 0) {
      const filtradas = subs.filter(s => !expiredEndpoints.includes(s?.endpoint))
      await admin.from("motoboys")
        .update({ push_subscription: filtradas.length ? filtradas : null })
        .eq("id", escolhido.id)
    }
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
      .from("lojas").select("plano, status, lat, lng").eq("id", loja_id).single()

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
        cliente_nome,
        cliente_tel:   cliente_tel  || "",
        endereco,
        valor_pedido:  valor_pedido || 0,
        taxa_entrega:  taxa_entrega || 0,
        observacao:    observacao   || "",
        status:        "aguardando",
        codigo:        gerarCodigo(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notifica motoboy disponível mais próximo (não bloqueia a resposta)
    escalarMotoboy(
      entrega.id,
      entrega.codigo,
      taxa_entrega || 0,
      loja.lat ?? null,
      loja.lng ?? null
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
