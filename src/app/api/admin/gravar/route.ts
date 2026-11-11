export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"

// Gravações das telas do admin (chego-ctrl) que antes iam direto do navegador pro banco com a
// chave pública (20/10/2026). Só com sessão de admin e só nas tabelas que essas telas usam.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const TABELAS = new Set(["lojas", "motoboys", "saques", "mensalidades", "alertas_sos"])

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const { tabela, acao, id, campos, filtro } = await req.json().catch(() => ({}))
  if (!TABELAS.has(tabela)) return NextResponse.json({ error: "Tabela não permitida" }, { status: 400 })
  if (!campos || typeof campos !== "object") return NextResponse.json({ error: "Nada pra gravar" }, { status: 400 })

  if (acao === "inserir") {
    const { data, error } = await sb.from(tabela).insert(campos).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  }
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })
  let q = sb.from(tabela).update(campos).eq("id", id)
  // Guarda opcional (ex.: só muda se ainda estiver "pendente")
  if (filtro && typeof filtro === "object") for (const [k, v] of Object.entries(filtro)) q = q.eq(k, v as any)
  const { data, error } = await q.select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}
