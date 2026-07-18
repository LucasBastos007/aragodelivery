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
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
  const sess = getSession(req)
  const isAdmin   = sess?.role === "admin"
  const isLojista = sess?.role === "loja"
  if (!isAdmin && !isLojista && !isInternalRequest(req)) return unauthorized()

  const body = await req.json()
  const { pedido_id, motoboy_recusou_id } = body

  if (!pedido_id) return NextResponse.json({ error: "pedido_id obrigatório" }, { status: 400 })

  // Busca o pedido — sem colunas opcionais que podem não existir
  const { data: pedido, error: pedidoErr } = await supabase
    .from("pedidos")
    .select("id, codigo, motoboy_id, status, loja_id, taxa_entrega, loja_lat, loja_lng, endereco_entrega, loja:lojas(lat, lng, endereco)")
    .eq("id", pedido_id)
    .single()

  if (pedidoErr || !pedido) {
    return NextResponse.json({ error: "pedido não encontrado", detail: pedidoErr?.message }, { status: 404 })
  }

  // Lojista só pode escalar pedidos da própria loja
  if (isLojista && (sess as any).loja_id !== pedido.loja_id) {
    return NextResponse.json({ error: "não autorizado" }, { status: 403 })
  }

  if (!["aguardando_aceite", "pronto", "preparando", "aceito"].includes(pedido.status)) {
    return NextResponse.json({ ok: true, msg: "status não elegível para escalada" })
  }

  // Pedidos de retirada não precisam de motoboy
  if ((pedido as any).endereco_entrega?.includes("Retirada")) {
    return NextResponse.json({ ok: true, msg: "pedido de retirada — sem motoboy necessário" })
  }

  const lojaLat = (pedido as any).loja_lat ?? (pedido.loja as any)?.lat ?? null
  const lojaLng = (pedido.loja as any)?.lng ?? null

  // Busca motoboys disponíveis e ativos
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

  // Candidatos com localização: ordenados por distância
  // Candidatos sem localização: incluídos no final (não filtrados por lat/lng)
  const comLoc = motoboys
    .filter(m => m.id && !ignorar.has(m.id) && !ocupados.has(m.id) && m.lat && m.lng)
    .map(m => ({ ...m, distLoja: lojaLat && lojaLng ? haversineKm(m.lat, m.lng, lojaLat, lojaLng) : 9999 }))
    .sort((a, b) => a.distLoja - b.distLoja)

  const semLoc = motoboys
    .filter(m => m.id && !ignorar.has(m.id) && !ocupados.has(m.id) && (!m.lat || !m.lng))
    .map(m => ({ ...m, distLoja: 9999 }))

  const candidatos = [...comLoc, ...semLoc]

  if (candidatos.length === 0) {
    if (pedido.status === "aguardando_aceite") {
      await supabase.from("pedidos").update({ status: "pronto", motoboy_id: null }).eq("id", pedido_id)
    }
    return NextResponse.json({ ok: true, msg: "sem candidatos elegíveis" })
  }

  // Salva lat/lng da loja no pedido para o mapa do motoboy
  const lojaLatSalvar = lojaLat ?? (pedido.loja as any)?.lat
  const lojaLngSalvar = (pedido.loja as any)?.lng

  // Broadcast: limpa motoboy_id e sinaliza para todos os motoboys disponíveis
  await supabase.from("pedidos").update({
    motoboy_id: null,
    status: "aguardando_aceite",
    ...(lojaLatSalvar != null ? { loja_lat: lojaLatSalvar } : {}),
    ...(lojaLngSalvar != null ? { loja_lng: lojaLngSalvar } : {}),
  }).eq("id", pedido_id).eq("status", pedido.status)

  // Push para TODOS os candidatos disponíveis
  if (initVapid()) {
    const pushPayload = JSON.stringify({
      title:      "Nova corrida disponível!",
      body:       `Pedido #${pedido.codigo} — R$ ${(pedido.taxa_entrega ?? 0).toFixed(2)}`,
      tag:        "corrida-nova",
      url:        "/motoboy",
      pedido_id,
      requireInteraction: true,
    })

    const expiredPorMotoboy: Record<string, string[]> = {}

    await Promise.allSettled(
      candidatos.map(async m => {
        if (!m.push_subscription) return
        const subs: any[] = Array.isArray(m.push_subscription) ? m.push_subscription : [m.push_subscription]
        for (const sub of subs) {
          try { await webpush.sendNotification(sub, pushPayload) }
          catch (e: any) {
            if (e.statusCode === 410) {
              if (!expiredPorMotoboy[m.id]) expiredPorMotoboy[m.id] = []
              expiredPorMotoboy[m.id].push(sub.endpoint)
            }
          }
        }
      })
    )

    // Limpa subscrições expiradas de cada motoboy
    await Promise.allSettled(
      Object.entries(expiredPorMotoboy).map(async ([mid, expired]) => {
        const m = candidatos.find(c => c.id === mid)
        if (!m) return
        const subs: any[] = Array.isArray(m.push_subscription) ? m.push_subscription : [m.push_subscription]
        const filtradas = subs.filter(s => !expired.includes(s?.endpoint))
        await supabase.from("motoboys")
          .update({ push_subscription: filtradas.length ? filtradas : null })
          .eq("id", mid)
      })
    )
  }

  // Re-escalada em background: pedidos presos em aguardando_aceite há mais de 60s
  void (async () => {
    const limite = new Date(Date.now() - 60_000).toISOString()
    const { data: presos } = await supabase
      .from("pedidos")
      .select("id, motoboy_id, endereco_entrega")
      .eq("status", "aguardando_aceite")
      .lt("atualizado_em", limite)
      .not("endereco_entrega", "ilike", "%Retirada%")
      .neq("id", pedido_id) // não re-escalar o próprio pedido que acabou de ser tratado

    for (const preso of presos ?? []) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://chegodelivery.com"}/api/escalada`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "" },
        body: JSON.stringify({ pedido_id: preso.id, motoboy_recusou_id: preso.motoboy_id ?? undefined }),
      }).catch(() => {})
    }
  })()

  return NextResponse.json({ ok: true, broadcast: candidatos.length })
}
