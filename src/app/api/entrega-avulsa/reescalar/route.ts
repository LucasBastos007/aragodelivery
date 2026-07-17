import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireMotoboy, unauthorized } from "@/lib/session"
import webpush from "web-push"

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

export async function POST(req: NextRequest) {
  const sess = requireMotoboy(req)
  if (!sess) return unauthorized()

  const { avulsa_id } = await req.json()
  if (!avulsa_id) return NextResponse.json({ error: "avulsa_id obrigatório" }, { status: 400 })

  const excludeId = sess.motoboy_id

  const { data: avulsa } = await admin
    .from("entregas_avulsas")
    .select("id, codigo, taxa_entrega, loja_lat, loja_lng, status, motoboy_id")
    .eq("id", avulsa_id)
    .single()

  if (!avulsa) return NextResponse.json({ error: "Avulsa não encontrada" }, { status: 404 })
  if (avulsa.status !== "aguardando_aceite") return NextResponse.json({ ok: true })
  if (avulsa.motoboy_id !== excludeId) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  await admin.from("entregas_avulsas")
    .update({ status: "aguardando", motoboy_id: null, motoboy_nome: null })
    .eq("id", avulsa_id)

  const { data: motoboyData } = await admin
    .from("motoboys")
    .select("id, nome, lat, lng, push_subscription")
    .eq("disponivel", true)
    .eq("status", "ativo")

  const motoboys = (motoboyData ?? []).filter((m: any) => m.id !== excludeId)
  if (motoboys.length === 0) return NextResponse.json({ ok: true, sem_motoboy: true })

  const { data: comEntrega } = await admin
    .from("pedidos")
    .select("motoboy_id")
    .in("status", ["indo_para_loja", "na_loja", "em_rota", "aguardando_aceite", "coletado"])

  const ocupados = new Set((comEntrega ?? []).map((p: any) => p.motoboy_id).filter(Boolean))
  const lojaLat  = avulsa.loja_lat
  const lojaLng  = avulsa.loja_lng

  const candidatos = motoboys
    .filter((m: any) => m.id && !ocupados.has(m.id))
    .map((m: any) => ({
      ...m,
      distLoja: (lojaLat && lojaLng && m.lat && m.lng)
        ? haversineKm(m.lat, m.lng, lojaLat, lojaLng)
        : Infinity,
    }))
    .sort((a: any, b: any) => a.distLoja - b.distLoja)

  if (candidatos.length === 0) return NextResponse.json({ ok: true, sem_motoboy: true })

  const escolhido = candidatos[0]

  await admin.from("entregas_avulsas")
    .update({ motoboy_id: escolhido.id, motoboy_nome: escolhido.nome ?? null, status: "aguardando_aceite" })
    .eq("id", avulsa_id)

  if (escolhido.push_subscription && initVapid()) {
    const subs: any[] = Array.isArray(escolhido.push_subscription)
      ? escolhido.push_subscription
      : [escolhido.push_subscription]
    const payload = JSON.stringify({
      title:      "Nova entrega avulsa!",
      body:       `${avulsa.codigo} — R$ ${Number(avulsa.taxa_entrega).toFixed(2)}`,
      tag:        `motoboy-${escolhido.id}`,
      url:        "/motoboy",
      avulsa_id,
      motoboy_id: escolhido.id,
      requireInteraction: true,
    })
    await Promise.allSettled(
      subs.map(async (sub: any) => {
        try { await webpush.sendNotification(sub, payload) }
        catch {}
      })
    )
  }

  return NextResponse.json({ ok: true, motoboy_nome: escolhido.nome })
}
