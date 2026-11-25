export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Cardápio pelo servidor (25/11/2026 — etapa 3 de segurança). O navegador parou de ler
// produtos/categorias direto do banco; passa por aqui. Serve UMA loja por vez (ou a vitrine
// da home / a busca), com limite por IP e registro de abuso, para impedir que alguém copie
// o catálogo inteiro de uma vez (caso do app concorrente que clonava os cardápios).
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

const PROD_PUB = "id, loja_id, categoria_id, nome, descricao, preco, preco_antigo, foto_url, disponivel, adicionais, dias_semana, ncm, ordem, indisponivel_desde, criado_em"
const CAT_PUB = "id, loja_id, nome, ordem, foto_url, cardapio_do_dia, horario_inicio, horario_fim, dias_semana, vitrine, mostrar_tambem_em"

// ── Limite por IP ────────────────────────────────────────────────────────────
// Uso normal (ver uma loja, abrir o carrinho) são poucos pedidos por minuto. Um raspador
// que tenta puxar tudo estoura o limite, toma 429 e fica registrado no log.
const JANELA_MS = 60 * 1000
const MAX_LOJA = 90   // ver cardápios de lojas: generoso (quem navega abre várias)
const MAX_AMPLO = 25  // vitrine da home / busca: leituras grandes, mais apertado
const store = new Map<string, { n: number; ate: number }>()
function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "desconhecido"
}
function limite(req: NextRequest, max: number): NextResponse | null {
  const k = ip(req), now = Date.now()
  let e = store.get(k)
  if (!e || now > e.ate) { e = { n: 1, ate: now + JANELA_MS }; store.set(k, e); return null }
  e.n++
  if (e.n > max) {
    console.warn(`[cardapio] limite estourado ip=${k} n=${e.n} path=${req.nextUrl.search}`)
    return NextResponse.json({ error: "Muitos acessos. Aguarde um minuto." }, { status: 429, headers: { "Retry-After": "60" } })
  }
  return null
}
// Limpa o mapa de vez em quando para não crescer sem parar
function limpa() { const now = Date.now(); if (store.size > 5000) for (const [k, e] of store) if (now > e.ate) store.delete(k) }

export async function GET(req: NextRequest) {
  limpa()
  const q = req.nextUrl.searchParams
  const loja = q.get("loja")
  const ids = q.get("ids")        // reordenar: lista de ids de produto
  const vitrine = q.get("vitrine") // home: lojas=id1,id2,...
  const busca = q.get("busca")

  try {
    // 1) Cardápio de UMA loja (tela do restaurante, carrinho)
    if (loja) {
      const rl = limite(req, MAX_LOJA); if (rl) return rl
      const [cat, prod] = await Promise.all([
        sb.from("categorias_produto").select(CAT_PUB).eq("loja_id", loja).order("ordem"),
        sb.from("produtos").select(PROD_PUB).eq("loja_id", loja).eq("disponivel", true).order("preco").order("nome"),
      ])
      return NextResponse.json({ categorias: cat.data ?? [], produtos: prod.data ?? [] })
    }
    // 2) Produtos por id (reordenar o pedido)
    if (ids) {
      const rl = limite(req, MAX_LOJA); if (rl) return rl
      const lista = ids.split(",").map(s => s.trim()).filter(Boolean).slice(0, 100)
      const { data } = await sb.from("produtos").select("id, nome, preco, disponivel, adicionais").in("id", lista)
      return NextResponse.json({ produtos: data ?? [] })
    }
    // 3) Vitrine da home (produtos em destaque de várias lojas abertas)
    if (vitrine) {
      const rl = limite(req, MAX_AMPLO); if (rl) return rl
      const lojas = (q.get("lojas") || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 120)
      if (!lojas.length) return NextResponse.json({ produtos: [], categorias: [] })
      const [prod, cat] = await Promise.all([
        sb.from("produtos").select("id, loja_id, categoria_id, nome, descricao, preco, preco_antigo, ncm, ordem, foto_url, adicionais, dias_semana")
          .in("loja_id", lojas).eq("disponivel", true).order("preco").order("nome").order("id").limit(4000),
        sb.from("categorias_produto").select("id, loja_id, nome").in("loja_id", lojas),
      ])
      return NextResponse.json({ produtos: prod.data ?? [], categorias: cat.data ?? [] })
    }
    // 4) Busca de produtos
    if (busca != null) {
      const rl = limite(req, MAX_AMPLO); if (rl) return rl
      const termo = busca.trim().slice(0, 60)
      if (termo.length < 2) return NextResponse.json({ produtos: [] })
      const { data } = await sb.from("produtos").select("id, loja_id, nome, descricao, preco, foto_url, adicionais")
        .eq("disponivel", true).or(`nome.ilike.%${termo}%,descricao.ilike.%${termo}%`).limit(300)
      return NextResponse.json({ produtos: data ?? [] })
    }
    return NextResponse.json({ error: "Parâmetro faltando (loja, ids, vitrine ou busca)." }, { status: 400 })
  } catch (e: any) {
    console.error("[cardapio] erro", e?.message)
    return NextResponse.json({ error: "Não foi possível carregar o cardápio agora." }, { status: 503 })
  }
}
