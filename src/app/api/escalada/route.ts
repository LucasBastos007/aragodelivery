import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MAX_TENTATIVAS = 3

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dL = (lat2 - lat1) * Math.PI / 180
  const dG = (lng2 - lng1) * Math.PI / 180
  const a  = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dG/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function initVapid() {
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

// POST /api/escalada — chamado quando motoboy recusa ou timeout expira
export async function POST(req: NextRequest) {
  const { pedido_id, motoboy_recusou_id } = await req.json()
  if (!pedido_id) return NextResponse.json({ error: "pedido_id obrigatório" }, { status: 400 })

  // Busca o pedido
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, codigo, motoboy_id, status, loja_id, taxa_entrega, historico_atribuicao, loja:lojas(lat, lng, endereco)")
    .eq("id", pedido_id)
    .single()

  if (!pedido) return NextResponse.json({ error: "pedido não encontrado" }, { status: 404 })

  // Só escalada se o pedido está em aguardando_aceite ou pronto
  if (!["aguardando_aceite", "pronto"].includes(pedido.status)) {
    return NextResponse.json({ ok: true, msg: "status não elegível para escalada" })
  }

  // Histórico de tentativas (quem já foi tentado)
  const historico: { motoboy_id: string; ts: string; motivo: string }[] =
    Array.isArray(pedido.historico_atribuicao) ? pedido.historico_atribuicao : []

  // Registra recusa do motoboy atual
  if (motoboy_recusou_id) {
    historico.push({ motoboy_id: motoboy_recusou_id, ts: new Date().toISOString(), motivo: "recusou" })
  }

  // Limite de tentativas atingido → fila geral
  if (historico.length >= MAX_TENTATIVAS) {
    await supabase.from("pedidos").update({
      status: "pronto", motoboy_id: null,
      historico_atribuicao: historico,
    }).eq("id", pedido_id)
    return NextResponse.json({ ok: true, msg: "limite de tentativas — pedido em fila geral" })
  }

  // IDs já tentados
  const jaTestados = new Set(historico.map(h => h.motoboy_id))
  const lojaLat    = (pedido.loja as any)?.lat as number | null
  const lojaLng    = (pedido.loja as any)?.lng as number | null

  // Busca motoboys disponíveis sem entrega ativa
  const { data: motoboys } = await supabase
    .from("motoboys")
    .select("id, lat, lng, raio_km, push_subscription")
    .eq("disponivel", true)
    .eq("status", "ativo")

  if (!motoboys || motoboys.length === 0) {
    // Nenhum disponível — volta para fila geral
    await supabase.from("pedidos").update({
      status: "pronto", motoboy_id: null, historico_atribuicao: historico,
    }).eq("id", pedido_id)
    return NextResponse.json({ ok: true, msg: "nenhum motoboy disponível" })
  }

  // Filtra já tentados e verifica se têm entrega ativa
  const { data: comEntrega } = await supabase
    .from("pedidos")
    .select("motoboy_id")
    .in("status", ["indo_para_loja", "na_loja", "em_rota", "aguardando_aceite", "coletado"])

  const ocupados = new Set((comEntrega ?? []).map((p: any) => p.motoboy_id))

  const candidatos = motoboys
    .filter(m => m.id && !jaTestados.has(m.id) && !ocupados.has(m.id) && m.lat && m.lng)
    .map(m => {
      const distLoja = lojaLat && lojaLng ? haversineKm(m.lat, m.lng, lojaLat, lojaLng) : 999
      const dentroRaio = !m.raio_km || distLoja <= m.raio_km
      return { ...m, distLoja, dentroRaio }
    })
    .filter(m => m.dentroRaio)
    .sort((a, b) => a.distLoja - b.distLoja)

  if (candidatos.length === 0) {
    // Nenhum candidato elegível — fila geral
    await supabase.from("pedidos").update({
      status: "pronto", motoboy_id: null, historico_atribuicao: historico,
    }).eq("id", pedido_id)
    return NextResponse.json({ ok: true, msg: "sem candidatos elegíveis — fila geral" })
  }

  // Atribui ao mais próximo
  const escolhido = candidatos[0]
  historico.push({ motoboy_id: escolhido.id, ts: new Date().toISOString(), motivo: "escalada" })

  await supabase.from("pedidos").update({
    motoboy_id: escolhido.id,
    status: "aguardando_aceite",
    historico_atribuicao: historico,
    ...(lojaLat != null && lojaLng != null ? { loja_lat: lojaLat, loja_lng: lojaLng } : {}),
  }).eq("id", pedido_id)

  // Envia push para o motoboy escalado
  if (escolhido.push_subscription) {
    try {
      if (initVapid()) {
        await webpush.sendNotification(
          escolhido.push_subscription as any,
          JSON.stringify({
            title: "Nova corrida disponível!",
            body:  `Pedido #${pedido.codigo} — R$ ${(pedido.taxa_entrega ?? 0).toFixed(2)}`,
            tag:   `motoboy-${escolhido.id}`,
            url:   "/motoboy",
            requireInteraction: true,
          })
        )
      }
    } catch {}
  }

  return NextResponse.json({ ok: true, motoboy_id: escolhido.id, tentativa: historico.length })
}
