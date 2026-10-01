export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"
import { carregarFinanceiroLoja, buscarExtratoLoja } from "@/lib/financeiroLoja"

// Migração de segurança pontual (checkpoint corretivo, Fase 5) — src/app/loja/financeiro/page.tsx
// buscava lojas/pedidos/mensalidades/saques direto do Supabase no navegador usando o loja_id do
// localStorage (client-editável), o que expunha chave PIX e dados bancários de qualquer loja pra
// quem trocasse esse valor. Agora o loja_id vem exclusivamente da sessão assinada (requireLoja),
// nunca do client — mesmo padrão já usado em /api/loja/saque e nas outras 10 rotas /api/loja/*.
// Cálculo do saldo vem de src/lib/financeiroLoja.ts — mesma fonte usada por /api/loja/saque,
// nunca duas fórmulas.
function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function GET(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()

  const sb = adminSb()
  // ?pagina= é opcional (a tela hoje só mostra a página inicial) — existe pra permitir
  // paginar o extrato sem nunca reabrir esta rota pra aceitar loja_id do cliente.
  const paginaParam = req.nextUrl.searchParams.get("pagina")
  const pagina = Math.max(0, parseInt(paginaParam ?? "0", 10) || 0)

  const [totais, pedidos] = await Promise.all([
    carregarFinanceiroLoja(sb, sess.loja_id),
    buscarExtratoLoja(sb, sess.loja_id, pagina),
  ])

  // O saldo em `totais` já veio agregado no banco sobre TODOS os pedidos "entregue" —
  // `pedidos` aqui é só a página do extrato sendo exibida, nunca influencia esse número.
  return NextResponse.json({ ...totais, pedidos, pagina })
}
