import type { SupabaseClient } from "@supabase/supabase-js"
import webpush from "web-push"

// Extraído de src/app/api/entrega-avulsa/route.ts (2026-09-24) pra ser reutilizado também
// por src/app/api/escalada-avulsa/route.ts (re-chamar motoboys quando o admin aciona
// "Chamar outro" numa entrega avulsa) — mesma implementação, nunca duas cópias divergentes
// do envio de push. Comportamento idêntico ao que já estava em produção pra criação de
// entrega avulsa; `excluirIds` é a única adição, usada só na re-chamada (pra não notificar
// de novo o motoboy que acabou de ser tirado da corrida).
export function initVapid(): boolean {
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

export async function notificarMotoboysDisponiveisAvulsa(
  admin: SupabaseClient,
  params: { avulsa_id: string; codigo: string; taxa_entrega: number; excluirIds?: string[] }
) {
  const { avulsa_id, codigo, taxa_entrega, excluirIds = [] } = params
  let query = admin.from("motoboys").select("id, push_subscription").eq("disponivel", true).eq("status", "ativo")
  const { data: motoboysRaw } = await query
  const motoboys = (motoboysRaw ?? []).filter((m: any) => !excluirIds.includes(m.id))

  if (motoboys.length === 0 || !initVapid()) return

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

// Avisa um motoboy específico que perdeu a corrida (usado quando o admin tira ele de uma
// entrega avulsa já aceita pra chamar outro) — mesmo padrão já usado em
// src/app/api/escalada/route.ts pros pedidos normais.
export async function avisarMotoboyPerdeuAvulsa(admin: SupabaseClient, motoboy_id: string, codigo: string) {
  if (!initVapid()) return
  const { data: motoboy } = await admin.from("motoboys").select("push_subscription").eq("id", motoboy_id).single()
  if (!motoboy?.push_subscription) return
  const subs: any[] = Array.isArray(motoboy.push_subscription) ? motoboy.push_subscription : [motoboy.push_subscription]
  const payload = JSON.stringify({
    title: "Entrega reatribuída",
    body:  `A entrega avulsa ${codigo} foi passada pra outro entregador pelo admin.`,
    tag:   "avulsa-reatribuida",
    url:   "/motoboy",
  })
  await Promise.allSettled(subs.map(sub => webpush.sendNotification(sub, payload, { urgency: "high" }).catch(() => {})))
}
