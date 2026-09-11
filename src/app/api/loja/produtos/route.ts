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

function validarPrecos(dados: Record<string, any>): string | null {
  if (dados.preco != null && (!Number.isFinite(dados.preco) || dados.preco < 0)) {
    return "Preço do produto inválido."
  }
  for (const entry of dados.adicionais ?? []) {
    const itens = Array.isArray(entry.itens) ? entry.itens : [entry]
    for (const it of itens) {
      if (it.preco != null && (!Number.isFinite(it.preco) || it.preco < 0)) {
        return "Preço de adicional inválido."
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
