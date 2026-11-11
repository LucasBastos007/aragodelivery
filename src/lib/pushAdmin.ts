// Push pro celular do admin (mesmas inscrições do SOS: push_subscriptions tipo "admin").
// Nunca derruba quem chamou: sem chave VAPID ou sem inscrição, só não envia.
import type { SupabaseClient } from "@supabase/supabase-js"

export async function enviarPushAdmin(sb: SupabaseClient, msg: { title: string; body: string; tag: string; url: string; requireInteraction?: boolean }) {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "", priv = process.env.VAPID_PRIVATE_KEY ?? ""
  if (!pub || !priv) return
  try {
    const { data: subs } = await sb.from("push_subscriptions").select("subscription").eq("tipo", "admin")
    if (!subs?.length) return
    const wp = await import("web-push")
    wp.setVapidDetails(process.env.VAPID_EMAIL ?? "mailto:admin@chegodelivery.com", pub, priv)
    const payload = JSON.stringify(msg)
    await Promise.allSettled(subs.map((s: any) => wp.sendNotification(s.subscription, payload)))
  } catch {}
}
