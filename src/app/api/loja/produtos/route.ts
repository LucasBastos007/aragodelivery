import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Campos que a loja pode de fato editar — nunca repassar o body inteiro pro update/insert,
// senão dá pra injetar loja_id (move o produto pra outra loja) ou outras colunas arbitrárias.
const CAMPOS_PERMITIDOS = [
  "nome", "descricao", "preco", "categoria_id", "foto_url",
  "disponivel", "adicionais", "dias_semana", "ncm",
] as const

// "preco != null" deixava passar quando o cliente mandava preco:null de propósito —
// que é exatamente o que JSON.stringify faz com NaN (campo de preço esvaziado no
// formulário vira NaN no parseFloat, vira null no JSON). Isso gravava produto sem preço
// no banco (incidente real, 2026-09-23 — "preço sumiu tudo" depois de editar o
// Espetinho). "preco" in dados já garante que o campo foi realmente enviado (sanitizar()
// só inclui campos presentes no body) — se veio, tem que ser um número válido, nunca null.
function validarPrecos(dados: Record<string, any>): string | null {
  if ("preco" in dados && !Number.isFinite(dados.preco)) {
    return "Preço do produto inválido — não pode ficar em branco."
  }
  if (dados.preco != null && dados.preco < 0) {
    return "Preço do produto inválido."
  }
  for (const entry of dados.adicionais ?? []) {
    const itens = Array.isArray(entry.itens) ? entry.itens : [entry]
    for (const it of itens) {
      if (!Number.isFinite(it.preco) || it.preco < 0) {
        return "Preço de adicional inválido — não pode ficar em branco."
      }
    }
  }
  return null
}

function sanitizar(body: Record<string, any>): Record<string, any> {
  const dados: Record<string, any> = {}
  for (const campo of CAMPOS_PERMITIDOS) {
    if (campo in body) dados[campo] = body[campo]
  }
  return dados
}

// POST — insert ou update
export async function POST(req: NextRequest) {
  const _sess = requireLoja(req)
  if (!_sess) return unauthorized()
  const sessLojaId = _sess.loja_id

  const body = await req.json()
  const { id } = body
  const dados = sanitizar(body)
  const loja_id = sessLojaId

  if (!loja_id) return NextResponse.json({ error: "loja_id obrigatório" }, { status: 400 })

  const erroPreco = validarPrecos(dados)
  if (erroPreco) return NextResponse.json({ error: erroPreco }, { status: 422 })

  const sb = adminClient()

  if (id) {
    const { error } = await sb.from("produtos").update(dados).eq("id", id).eq("loja_id", loja_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await sb.from("produtos").insert({ loja_id, ...dados })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE — remove por id
export async function DELETE(req: NextRequest) {
  const _sess = requireLoja(req)
  if (!_sess) return unauthorized()
  const sessLojaId = _sess.loja_id

  const { id } = await req.json()
  const loja_id = sessLojaId
  if (!id || !loja_id) return NextResponse.json({ error: "id e loja_id obrigatórios" }, { status: 400 })

  const { error } = await adminClient().from("produtos").delete().eq("id", id).eq("loja_id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH — toggle disponivel
export async function PATCH(req: NextRequest) {
  const _sess = requireLoja(req)
  if (!_sess) return unauthorized()
  const sessLojaId = _sess.loja_id

  const { id, disponivel } = await req.json()
  const loja_id = sessLojaId
  if (!id || !loja_id) return NextResponse.json({ error: "id e loja_id obrigatórios" }, { status: 400 })

  const { error } = await adminClient().from("produtos").update({ disponivel }).eq("id", id).eq("loja_id", loja_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PUT — "Mais pedidos" escolhidos pela loja (20/10/2026): recebe até 6 ids na ordem em que
// aparecem no app. O marcador continua sendo ncm = "destaque" (o mesmo que o app do cliente e a
// NFC-e já entendem) e a posição vai em `ordem`. Produto com NCM fiscal de verdade ou marcado
// como "almoco" nunca é tocado.
export async function PUT(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()
  const { ids } = await req.json().catch(() => ({}))
  if (!Array.isArray(ids) || ids.length > 6 || ids.some(x => typeof x !== "string")) return NextResponse.json({ error: "Escolha até 6 produtos." }, { status: 400 })
  const sb = adminClient()
  const { data: prods } = await sb.from("produtos").select("id, ncm").eq("loja_id", sess.loja_id)
  const livre = (ncm: string | null) => !ncm || ncm === "destaque"
  const meus = new Map((prods ?? []).map((p: any) => [p.id, p.ncm as string | null]))
  for (const id of ids) {
    if (!meus.has(id)) return NextResponse.json({ error: "Produto não é desta loja." }, { status: 400 })
    if (!livre(meus.get(id)!)) return NextResponse.json({ error: "Esse produto tem código fiscal (NCM) e não pode virar destaque por aqui. Fale com o suporte." }, { status: 422 })
  }
  // Tira dos destaques quem saiu da lista
  const sair = (prods ?? []).filter((p: any) => p.ncm === "destaque" && !ids.includes(p.id)).map((p: any) => p.id)
  if (sair.length) { const { error } = await sb.from("produtos").update({ ncm: null }).in("id", sair).eq("loja_id", sess.loja_id); if (error) return NextResponse.json({ error: error.message }, { status: 500 }) }
  for (const [i, id] of ids.entries()) {
    const { error } = await sb.from("produtos").update({ ncm: "destaque", ordem: i }).eq("id", id).eq("loja_id", sess.loja_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
