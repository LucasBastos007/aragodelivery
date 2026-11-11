export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"
import { diaEMinutosAgoraBrt, hojeYmdBrt, limitesDoDiaBrt, ymdBrt } from "@/lib/periodoBrt"
import { inscricaoValida } from "@/lib/pushHosts"
import { DIAS_SUMIDO, msgAvaliar, msgSacola, msgSumido, primeiroNome } from "@/lib/lembretes"

// Lembretes automáticos pro cliente (03/11/2026, pedido do Lucas). Roda a cada 10 min (vercel.json).
// 1. Sacola abandonada: 40 min a 3 h depois de sair do app com item na sacola, loja aberta.
// 2. Avaliar pedido: 40 min a 3 h depois da entrega, se ainda não avaliou.
// 3. Cliente sumido: às 18h, pra quem fez o último pedido há 7, 14 ou 30 dias.
// Regras: no máximo 1 lembrete por dia por celular (lembretes_enviados) e nada entre 23h e 9h.
// ?teste=1 (com CRON_SECRET) só lista o que mandaria, sem enviar nem gravar nada.

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const MIN = 60_000
const LIMITE = 60 // por execução, somando os três tipos

type Envio = { sub: any; tipo: "sacola" | "avaliar" | "sumido"; ref: string; title: string; body: string; url: string; aoMorrer?: () => PromiseLike<unknown> }

const subsDe = (v: any): any[] => (Array.isArray(v) ? v : v ? [v] : []).filter(inscricaoValida)

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const teste = req.nextUrl.searchParams.get("teste") === "1"
  const { minutos } = diaEMinutosAgoraBrt()
  const hora = Math.floor(minutos / 60)
  if (!teste && (hora < 9 || hora >= 23)) return NextResponse.json({ ok: true, pulado: "fora do horário (23h às 9h)" })
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return NextResponse.json({ error: "sem chave VAPID" }, { status: 500 })

  const agora = Date.now()
  const hoje = hojeYmdBrt()
  const [iniHoje] = limitesDoDiaBrt(hoje)
  const { data: jaHoje } = await sb.from("lembretes_enviados").select("endpoint").gte("enviado_em", iniHoje).limit(5000)
  const usados = new Set((jaHoje ?? []).map(r => r.endpoint))
  const envios: Envio[] = []
  const reservar = (e: Envio) => {
    if (envios.length >= LIMITE || usados.has(e.sub.endpoint)) return
    usados.add(e.sub.endpoint)
    envios.push(e)
  }

  // Celulares que fizeram pedido nas últimas 4 h: não recebem lembrete de sacola
  const { data: recentes } = await sb.from("pedidos").select("push_subscription").gte("criado_em", new Date(agora - 240 * MIN).toISOString()).not("push_subscription", "is", null).limit(1000)
  const pediuAgora = new Set((recentes ?? []).flatMap(p => subsDe(p.push_subscription).map(s => s.endpoint)))

  // 1. Sacola abandonada
  const { data: sacolas } = await sb.from("sacolas_abertas").select("visitante, loja_id, itens, total, subscription, atualizada_em")
    .is("lembrete_em", null).not("subscription", "is", null)
    .lte("atualizada_em", new Date(agora - 40 * MIN).toISOString()).gte("atualizada_em", new Date(agora - 180 * MIN).toISOString())
    .order("atualizada_em", { ascending: true }).limit(100)
  if (sacolas?.length) {
    const { data: lojas } = await sb.from("lojas").select("id, nome, aberto, status").in("id", [...new Set(sacolas.map(s => s.loja_id))])
    const lojaDe = new Map((lojas ?? []).map(l => [l.id, l]))
    for (const s of sacolas) {
      const l = lojaDe.get(s.loja_id)
      if (!l || !l.aberto || l.status !== "ativo" || !inscricaoValida(s.subscription) || pediuAgora.has(s.subscription.endpoint)) continue
      const m = msgSacola(hora, `${s.visitante}${hoje}`, l.nome, Number(s.total))
      reservar({ sub: s.subscription, tipo: "sacola", ref: s.visitante, ...m, url: "/carrinho",
        aoMorrer: () => sb.from("sacolas_abertas").update({ subscription: null }).eq("visitante", s.visitante) })
    }
  }

  // 2. Avaliar pedido
  const { data: entregues } = await sb.from("pedidos").select("id, codigo, nome_cliente, loja_id, push_subscription")
    .eq("status", "entregue").not("push_subscription", "is", null)
    .lte("entregue_em", new Date(agora - 40 * MIN).toISOString()).gte("entregue_em", new Date(agora - 180 * MIN).toISOString())
    .limit(100)
  if (entregues?.length) {
    const ids = entregues.map(p => p.id)
    const [{ data: aval }, { data: avisados }, { data: lojas }] = await Promise.all([
      sb.from("avaliacoes").select("pedido_id").in("pedido_id", ids),
      sb.from("lembretes_enviados").select("ref").eq("tipo", "avaliar").in("ref", ids),
      sb.from("lojas").select("id, nome").in("id", [...new Set(entregues.map(p => p.loja_id))]),
    ])
    const pular = new Set([...(aval ?? []).map(a => a.pedido_id), ...(avisados ?? []).map(a => a.ref)])
    const nomeLoja = new Map((lojas ?? []).map(l => [l.id, l.nome]))
    for (const p of entregues) {
      if (pular.has(p.id)) continue
      const sub = subsDe(p.push_subscription)[0]
      if (!sub) continue
      const m = msgAvaliar(p.id, primeiroNome(p.nome_cliente), nomeLoja.get(p.loja_id) ?? "loja")
      reservar({ sub, tipo: "avaliar", ref: p.id, ...m, url: `/pedido/${p.codigo}` })
    }
  }

  // 3. Cliente sumido (só na primeira execução depois das 18h; o ref com a data evita repetir)
  if (hora === 18 || teste) {
    const { data: inscritos } = await sb.from("push_subscriptions").select("id, subscription, cliente_id").eq("tipo", "cliente").not("cliente_id", "is", null).order("criado_em", { ascending: false }).limit(3000)
    const clientes = [...new Set((inscritos ?? []).map(i => i.cliente_id))]
    if (clientes.length) {
      // Último pedido de cada um nos últimos 31 dias (quem pediu há exatamente 30 dias não pediu depois)
      const ultimo = new Map<string, string>()
      for (let i = 0; i < clientes.length; i += 200) {
        const { data } = await sb.from("pedidos").select("cliente_id, criado_em").in("cliente_id", clientes.slice(i, i + 200))
          .neq("status", "cancelado").gte("criado_em", new Date(agora - 32 * 86400_000).toISOString()).limit(5000)
        for (const p of data ?? []) if (!ultimo.has(p.cliente_id) || ultimo.get(p.cliente_id)! < p.criado_em) ultimo.set(p.cliente_id, p.criado_em)
      }
      const diasDe = (iso: string) => Math.round((Date.parse(`${hoje}T12:00:00-03:00`) - Date.parse(`${ymdBrt(iso)}T12:00:00-03:00`)) / 86400_000)
      const alvo = new Map<string, number>()
      for (const [c, iso] of ultimo) { const d = diasDe(iso); if (DIAS_SUMIDO.includes(d)) alvo.set(c, d) }
      if (alvo.size) {
        const refs = [...alvo.keys()].map(c => `${c}:${hoje}`)
        const [{ data: nomes }, { data: avisados }] = await Promise.all([
          sb.from("clientes").select("id, nome").in("id", [...alvo.keys()]),
          sb.from("lembretes_enviados").select("ref").eq("tipo", "sumido").in("ref", refs),
        ])
        const nomeDe = new Map((nomes ?? []).map(n => [n.id, n.nome]))
        const feitos = new Set((avisados ?? []).map(a => a.ref))
        for (const i of inscritos ?? []) {
          const d = alvo.get(i.cliente_id)
          // Uma vez por pessoa, no celular inscrito mais recente
          if (!d || feitos.has(`${i.cliente_id}:${hoje}`) || !inscricaoValida(i.subscription)) continue
          feitos.add(`${i.cliente_id}:${hoje}`)
          const m = msgSumido(d, primeiroNome(nomeDe.get(i.cliente_id)))
          reservar({ sub: i.subscription, tipo: "sumido", ref: `${i.cliente_id}:${hoje}`, ...m, url: "/",
            aoMorrer: () => sb.from("push_subscriptions").delete().eq("id", i.id).eq("tipo", "cliente") })
        }
      }
    }
  }

  if (teste) return NextResponse.json({ teste: true, hora, mandaria: envios.map(({ tipo, ref, title, body, url }) => ({ tipo, ref, title, body, url })) })

  webpush.setVapidDetails(process.env.VAPID_EMAIL!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
  let enviados = 0, falhas = 0
  for (let i = 0; i < envios.length; i += 20) {
    await Promise.all(envios.slice(i, i + 20).map(async e => {
      try {
        await webpush.sendNotification(e.sub, JSON.stringify({ title: e.title, body: e.body, url: e.url, tag: `lembrete-${e.tipo}`, requireInteraction: false }), { TTL: 60 * 60 * 2, urgency: "normal" })
        enviados++
      } catch (err: any) {
        falhas++
        if (err?.statusCode === 404 || err?.statusCode === 410) await e.aoMorrer?.()
      }
      // Grava mesmo com falha, pra não ficar tentando o mesmo lembrete a cada 10 min
      await sb.from("lembretes_enviados").insert({ endpoint: e.sub.endpoint, tipo: e.tipo, ref: e.ref })
      if (e.tipo === "sacola") await sb.from("sacolas_abertas").update({ lembrete_em: new Date().toISOString() }).eq("visitante", e.ref)
    }))
  }
  return NextResponse.json({ ok: true, enviados, falhas })
}
