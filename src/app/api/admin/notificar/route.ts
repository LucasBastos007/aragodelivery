export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"

// Notificações pelo admin (20/10/2026, pedido do Lucas): aviso no celular de clientes, lojas ou
// motoboys que ligaram as notificações. "teste" manda só pros celulares do admin.
// Inscrição que o celular já cancelou (410/404) sai da lista de clientes, pra não insistir.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
type Alvo = { sub: any; id?: string }
const PUBLICOS = ["clientes", "motoboys", "lojas", "teste"] as const

async function alvos(publico: string): Promise<{ lista: Alvo[]; pessoas: number }> {
  if (publico === "clientes" || publico === "teste") {
    const out: any[] = []
    for (let i = 0; i < 100_000; i += 1000) {
      const { data } = await sb.from("push_subscriptions").select("id,cliente_id,subscription").eq("tipo", publico === "teste" ? "admin" : "cliente").order("id").range(i, i + 999)
      out.push(...(data ?? [])); if ((data ?? []).length < 1000) break
    }
    // Mesmo celular inscrito duas vezes recebe uma só
    const vistos = new Set<string>(), lista: Alvo[] = []
    for (const r of out) { const ep = r.subscription?.endpoint; if (!ep || vistos.has(ep)) continue; vistos.add(ep); lista.push({ sub: r.subscription, id: r.id }) }
    return { lista, pessoas: publico === "teste" ? lista.length : new Set(out.map(r => r.cliente_id).filter(Boolean)).size }
  }
  const { data } = await sb.from(publico).select("id,push_subscription,status").not("push_subscription", "is", null)
  const lista: Alvo[] = []
  for (const r of (data ?? []) as any[]) {
    if (publico === "lojas" && r.status && r.status !== "ativo") continue
    const subs = Array.isArray(r.push_subscription) ? r.push_subscription : [r.push_subscription]
    for (const s of subs) if (s?.endpoint) lista.push({ sub: s })
  }
  return { lista, pessoas: (data ?? []).filter((r: any) => publico !== "lojas" || !r.status || r.status === "ativo").length }
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const [c, m, l, t, { data: hist }] = await Promise.all([alvos("clientes"), alvos("motoboys"), alvos("lojas"), alvos("teste"),
    sb.from("notificacoes_admin").select("id,publico,titulo,mensagem,link,alvo,enviados,falhas,criado_em").order("criado_em", { ascending: false }).limit(30)])
  return NextResponse.json({ publicos: { clientes: { celulares: c.lista.length, pessoas: c.pessoas }, motoboys: { celulares: m.lista.length, pessoas: m.pessoas }, lojas: { celulares: l.lista.length, pessoas: l.pessoas }, teste: { celulares: t.lista.length, pessoas: t.pessoas } },
    historico: hist ?? [], vapid: !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const { publico, titulo, mensagem, link } = await req.json().catch(() => ({}))
  const t = String(titulo ?? "").trim().slice(0, 60), m = String(mensagem ?? "").trim().slice(0, 180)
  const url = typeof link === "string" && /^\/[a-z0-9\-/_?=&.%]*$/i.test(link) ? link : "/"
  if (!PUBLICOS.includes(publico)) return NextResponse.json({ error: "Escolha pra quem mandar." }, { status: 400 })
  if (t.length < 3 || m.length < 3) return NextResponse.json({ error: "Escreva o título e a mensagem." }, { status: 400 })
  // Ambiente de teste usa as mesmas chaves da produção e tem inscrições copiadas: só deixa mandar o teste
  if (process.env.NODE_ENV !== "production" && publico !== "teste") return NextResponse.json({ error: "No ambiente de teste só dá pra mandar o teste pro seu celular. Clientes, lojas e motoboys só depois de publicar." }, { status: 403 })
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "", priv = process.env.VAPID_PRIVATE_KEY ?? ""
  if (!pub || !priv) return NextResponse.json({ error: "Notificações sem chave configurada no servidor." }, { status: 500 })
  const { lista } = await alvos(publico)
  if (!lista.length) return NextResponse.json({ error: publico === "teste" ? "Seu celular ainda não está inscrito: abra o painel no celular e ligue as notificações (o SOS usa a mesma)." : "Ninguém desse grupo ligou as notificações ainda." }, { status: 422 })

  const wp = (await import("web-push")).default
  wp.setVapidDetails(process.env.VAPID_EMAIL ?? "mailto:admin@chegodelivery.com", pub, priv)
  const payload = JSON.stringify({ title: t, body: m, url, tag: `aviso-${Date.now()}`, requireInteraction: false })
  let enviados = 0, falhas = 0; const mortos: string[] = []
  // 25 por vez pra não estourar o tempo do servidor
  for (let i = 0; i < lista.length; i += 25) {
    await Promise.all(lista.slice(i, i + 25).map(async a => {
      try { await wp.sendNotification(a.sub, payload, { TTL: 60 * 60 * 12 }); enviados++ }
      catch (e: any) { falhas++; if ((e?.statusCode === 404 || e?.statusCode === 410) && a.id) mortos.push(a.id) }
    }))
  }
  if (mortos.length && publico === "clientes") await sb.from("push_subscriptions").delete().in("id", mortos)
  await sb.from("notificacoes_admin").insert({ publico, titulo: t, mensagem: m, link: url, alvo: lista.length, enviados, falhas, criado_por: "admin" })
  return NextResponse.json({ ok: true, alvo: lista.length, enviados, falhas, removidos: publico === "clientes" ? mortos.length : 0 })
}
