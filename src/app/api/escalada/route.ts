import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"
import { getSession, unauthorized } from "@/lib/session"

// Verifica se a requisição vem de código interno do servidor (cron, webhook, etc.)
function isInternalRequest(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  return req.headers.get("x-internal-secret") === secret
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

export async function POST(req: NextRequest) {
  // Aceita: sessão válida de qualquer role (browser) OU segredo interno (server-to-server)
  const sess = getSession(req)
  if (!sess && !isInternalRequest(req)) return unauthorized()

  const body = await req.json()
  let { pedido_id, motoboy_recusou_id } = body

  // BOLA fix: se o chamador é motoboy, impede que ele recuse no nome de outro
  if (sess?.role === "motoboy") {
    motoboy_recusou_id = sess.motoboy_id
  }

  if (!pedido_id) return NextResponse.json({ error: "pedido_id obrigatório" }, { status: 400 })

  // Busca o pedido — sem colunas opcionais que podem não existir
  const { data: pedido, error: pedidoErr } = await supabase
    .from("pedidos")
    .select("id, codigo, motoboy_id, status, loja_id, taxa_entrega, loja_lat, loja_lng, loja:lojas(lat, lng, endereco)")
    .eq("id", pedido_id)
    .single()

  if (pedidoErr || !pedido) {
    return NextResponse.json({ error: "pedido não encontrado", detail: pedidoErr?.message }, { status: 404 })
  }

  if (!["aguardando_aceite", "pronto", "preparando"].includes(pedido.status)) {
    return NextResponse.json({ ok: true, msg: "status não elegível para escalada" })
  }

  const lojaLat = (pedido as any).loja_lat ?? (pedido.loja as any)?.lat ?? null
  const lojaLng = (pedido.loja as any)?.lng ?? null

  // Busca motoboys disponíveis
  const { data: motoboyData } = await supabase
    .from("motoboys")
    .select("id, lat, lng, push_subscription")
    .eq("disponivel", true)
    .eq("status", "ativo")

  const motoboys = motoboyData ?? []

  if (motoboys.length === 0) {
    if (pedido.status === "aguardando_aceite") {
      await supabase.from("pedidos").update({ status: "pronto", motoboy_id: null }).eq("id", pedido_id)
    }
    return NextResponse.json({ ok: true, msg: "nenhum motoboy disponível" })
  }

  // Motoboys com entrega ativa (não disponíveis para nova)
  const { data: comEntrega } = await supabase
    .from("pedidos")
    .select("motoboy_id")
    .in("status", ["indo_para_loja", "na_loja", "em_rota", "aguardando_aceite", "coletado"])
    .neq("id", pedido_id)

  const ocupados = new Set((comEntrega ?? []).map((p: any) => p.motoboy_id).filter(Boolean))

  // Ignora o motoboy que recusou nesta tentativa
  const ignorar = new Set<string>()
  if (motoboy_recusou_id) ignorar.add(motoboy_recusou_id)
  // Se o pedido já estava atribuído a alguém, ignora esse também
  if (pedido.motoboy_id) ignorar.add(pedido.motoboy_id)

  const candidatos = motoboys
    .filter(m => m.id && !ignorar.has(m.id) && !ocupados.has(m.id) && m.lat && m.lng)
    .map(m => {
      const distLoja = lojaLat && lojaLng ? haversineKm(m.lat, m.lng, lojaLat, lojaLng) : 0
      return { ...m, distLoja }
    })
    .sort((a, b) => a.distLoja - b.distLoja)

  if (candidatos.length === 0) {
    if (pedido.status === "aguardando_aceite") {
      await supabase.from("pedidos").update({ status: "pronto", motoboy_id: null }).eq("id", pedido_id)
    }
    return NextResponse.json({ ok: true, msg: "sem candidatos elegíveis" })
  }

  const escolhido = candidatos[0]

  // Salva lat/lng da loja no pedido para o mapa do motoboy
  const lojaLatSalvar = lojaLat ?? (pedido.loja as any)?.lat
  const lojaLngSalvar = (pedido.loja as any)?.lng

  // Atualização atômica: só reatribui se o pedido ainda está no mesmo estado que lemos
  // (evita race condition entre duas chamadas de escalada simultâneas)
  const updateQuery = supabase.from("pedidos").update({
    motoboy_id: escolhido.id,
    status: "aguardando_aceite",
    ...(lojaLatSalvar != null ? { loja_lat: lojaLatSalvar } : {}),
    ...(lojaLngSalvar != null ? { loja_lng: lojaLngSalvar } : {}),
  }).eq("id", pedido_id).eq("status", pedido.status)

  if (pedido.motoboy_id) {
    await updateQuery.eq("motoboy_id", pedido.motoboy_id)
  } else {
    await updateQuery.is("motoboy_id", null)
  }

  // Push notification para o motoboy
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

  return NextResponse.json({ ok: true, motoboy_id: escolhido.id })
}
