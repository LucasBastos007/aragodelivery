export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Avaliação do pedido pelo cliente (20/10/2026). Antes a tela do pedido gravava a avaliação e
// recalculava a nota média da loja e do motoboy direto do navegador, com a chave pública.
// Quem pode avaliar: o celular que fez o pedido (cliente_push_token) ou o cliente logado dono
// do pedido. Só pedido entregue, uma avaliação por pedido.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

const nota = (v: unknown) => { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : null }

export async function POST(req: NextRequest) {
  const { pedido_id, cliente_push_token, nota_loja, nota_motoboy, comentario } = await req.json().catch(() => ({}))
  if (!pedido_id || !nota(nota_loja)) return NextResponse.json({ error: "Dê uma nota de 1 a 5 pra loja." }, { status: 400 })

  const { data: p } = await sb.from("pedidos").select("id, status, loja_id, motoboy_id, cliente_id, cliente_push_token").eq("id", pedido_id).maybeSingle()
  if (!p) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })

  let dono = !!cliente_push_token && cliente_push_token === p.cliente_push_token
  if (!dono && p.cliente_id) {
    const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    if (jwt) { const { data } = await sb.auth.getUser(jwt); dono = data.user?.id === p.cliente_id }
  }
  if (!dono) return NextResponse.json({ error: "Só quem fez o pedido pode avaliar." }, { status: 403 })
  if (p.status !== "entregue") return NextResponse.json({ error: "Dá pra avaliar depois que o pedido chega." }, { status: 422 })

  const { data: ja } = await sb.from("avaliacoes").select("id").eq("pedido_id", p.id).limit(1)
  if (ja?.length) return NextResponse.json({ ok: true, ja_avaliado: true })

  const nm = p.motoboy_id ? nota(nota_motoboy) : null
  const { error } = await sb.from("avaliacoes").insert({
    pedido_id: p.id, loja_id: p.loja_id, motoboy_id: p.motoboy_id ?? null,
    nota_loja: nota(nota_loja), nota_motoboy: nm,
    comentario: String(comentario ?? "").slice(0, 1000),
  })
  if (error) return NextResponse.json({ error: "Não foi possível salvar a avaliação." }, { status: 500 })

  // Médias, como a tela fazia antes
  const { data: avals } = await sb.from("avaliacoes").select("nota_loja").eq("loja_id", p.loja_id)
  if (avals?.length) {
    const media = avals.reduce((s, a: any) => s + Number(a.nota_loja || 0), 0) / avals.length
    await sb.from("lojas").update({ nota_media: Math.round(media * 10) / 10, total_avaliacoes: avals.length }).eq("id", p.loja_id)
  }
  if (p.motoboy_id && nm) {
    const { data: am } = await sb.from("avaliacoes").select("nota_motoboy").eq("motoboy_id", p.motoboy_id).not("nota_motoboy", "is", null)
    if (am?.length) {
      const media = am.reduce((s, a: any) => s + Number(a.nota_motoboy || 0), 0) / am.length
      await sb.from("motoboys").update({ nota_media: Math.round(media * 10) / 10, total_avaliacoes: am.length }).eq("id", p.motoboy_id)
    }
  }
  return NextResponse.json({ ok: true })
}
