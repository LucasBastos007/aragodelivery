export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSession, requireAdmin, requireLoja, requireMotoboy, unauthorized } from "@/lib/session"

// Leituras que saíram do navegador (24/11/2026). A chave pública do banco deixou de ver
// dados sensíveis (banco, Pix, CPF, senha, cupons, saques), então as telas que precisam
// deles pedem aqui, com a sessão de quem está logado. Cada consulta tem nome fixo:
// nada de tabela/coluna vinda do navegador.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

const semSenha = (x: any): any => {
  if (Array.isArray(x)) return x.map(semSenha)
  if (x && typeof x === "object") { const { senha: _s, ...resto } = x; return resto }
  return x
}

type Consulta = (req: NextRequest, p: Record<string, any>) => Promise<{ data: any; error: any } | NextResponse>

// ── Etapa 2 da segurança (27/11/2026): dados do cliente no pedido saem só por aqui ──
// A chave pública deixa de ver nome/telefone/endereço/e-mail/CPF/troco do pedido e o telefone do
// motoboy. Quem tem direito: admin (tudo), loja (pedidos dela), motoboy (os dele e os que estão
// sendo oferecidos sem motoboy: pronto/aguardando_aceite), cliente logado (os dele, pelo token).
const PII_COLS = "id,loja_id,motoboy_id,cliente_id,status,nome_cliente,telefone_cliente,endereco_entrega,email_cliente,cpf_cliente,troco_para"
const OFERTA = new Set(["pronto", "aguardando_aceite"])
async function clienteDoToken(req: NextRequest): Promise<string | null> {
  const tk = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!tk) return null
  const { data } = await sb.auth.getUser(tk)
  return data?.user?.id ?? null
}
async function piiPedidos(req: NextRequest, ids: string[]) {
  const lista = [...new Set(ids.map(String))].filter(x => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 1000)
  if (!lista.length) return { data: [], error: null }
  const s = getSession(req)
  const cliente = s ? null : await clienteDoToken(req)
  if (!s && !cliente) return unauthorized()
  const linhas: any[] = []
  for (let i = 0; i < lista.length; i += 200) {
    const { data, error } = await sb.from("pedidos").select(PII_COLS).in("id", lista.slice(i, i + 200))
    if (error) return { data: null, error }
    linhas.push(...(data ?? []))
  }
  const pode = (p: any) =>
    s?.role === "admin" ? true
    : s?.role === "loja" ? p.loja_id === s.loja_id
    : s?.role === "motoboy" ? (p.motoboy_id === s.motoboy_id || (!p.motoboy_id && OFERTA.has(p.status)))
    : !!cliente && p.cliente_id === cliente
  const ok = linhas.filter(pode)
  // telefone do motoboy do pedido (cliente liga pro motoboy; loja e admin também veem)
  const mbIds = [...new Set(ok.map(p => p.motoboy_id).filter(Boolean))]
  const tel = new Map<string, string | null>()
  if (mbIds.length && s?.role !== "motoboy") {
    const { data } = await sb.from("motoboys").select("id,telefone").in("id", mbIds)
    for (const m of data ?? []) tel.set(m.id, m.telefone ?? null)
  }
  const completo = s?.role === "admin" || !!cliente // e-mail e CPF só pro admin e pro próprio cliente
  return {
    data: ok.map(p => ({
      id: p.id, nome_cliente: p.nome_cliente, telefone_cliente: p.telefone_cliente, endereco_entrega: p.endereco_entrega, troco_para: p.troco_para,
      ...(completo ? { email_cliente: p.email_cliente, cpf_cliente: p.cpf_cliente } : {}),
      ...(p.motoboy_id && tel.has(p.motoboy_id) ? { motoboy_telefone: tel.get(p.motoboy_id) } : {}),
    })),
    error: null,
  }
}

const CONSULTAS: Record<string, Consulta> = {
  // PII dos pedidos (ver piiPedidos acima). p.ids: lista de ids de pedido.
  async pedidos_pii(req, p) { return piiPedidos(req, Array.isArray(p.ids) ? p.ids : []) },

  // Entregas avulsas (tabela fechada pra chave pública em 27/11/2026). Loja: só as dela.
  // Motoboy: as dele, ou as "aguardando" (oferta aberta). Admin: todas.
  async avulsas(req, p) {
    const s = getSession(req); if (!s) return unauthorized()
    let q = sb.from("entregas_avulsas").select("*")
    const st = Array.isArray(p.status) ? p.status.map(String) : p.status ? [String(p.status)] : null
    if (s.role === "loja") q = q.eq("loja_id", s.loja_id)
    else if (s.role === "motoboy") {
      if (st && st.length === 1 && st[0] === "aguardando" && !p.meu) { /* oferta aberta pra todos os motoboys */ }
      else q = q.eq("motoboy_id", s.motoboy_id)
    } else if (s.role !== "admin") return unauthorized()
    if (st) q = q.in("status", st)
    if (p.motoboy_nao_nulo && s.role === "admin") q = q.not("motoboy_id", "is", null)
    if (typeof p.desde === "string") q = q.gte("criado_em", p.desde)
    if (typeof p.ate === "string") q = q.lte("criado_em", p.ate)
    q = q.order("criado_em", { ascending: !!p.asc }).limit(Math.min(Number(p.limit) || 1000, 5000))
    return q
  },
  // Painel da loja: telefones dos pedidos entregues (contador "1º pedido / Nº pedido")
  async loja_telefones_entregues(req) {
    const s = requireLoja(req); if (!s) return unauthorized()
    const out: any[] = []
    for (let i = 0; i < 50_000; i += 1000) {
      const { data, error } = await sb.from("pedidos").select("telefone_cliente").eq("loja_id", s.loja_id).eq("status", "entregue").not("telefone_cliente", "is", null).range(i, i + 999)
      if (error) return { data: null, error }
      out.push(...(data ?? [])); if ((data ?? []).length < 1000) break
    }
    return { data: out, error: null }
  },
  // Fila do motoboy: pedidos aceitos/preparando que vão precisar de entrega (sem retirada).
  async motoboy_fila(req) {
    if (!requireMotoboy(req)) return unauthorized()
    return sb.from("pedidos").select("id, codigo, criado_em, status, loja:lojas(nome, lat, lng, cidade)")
      .in("status", ["aceito", "preparando"]).not("endereco_entrega", "ilike", "%Retirada%").order("criado_em", { ascending: false })
  },
  // Telefone dos motoboys (admin): despacho e SOS
  async admin_motoboys_telefones(req) {
    if (!requireAdmin(req)) return unauthorized()
    return sb.from("motoboys").select("id,telefone")
  },
  // Histórico da loja com busca por nome/telefone do cliente e filtro retirada/entrega (as colunas
  // do cliente não podem mais ser filtradas do navegador).
  async loja_historico_ids(req, p) {
    const s = requireLoja(req); if (!s) return unauthorized()
    let q = sb.from("pedidos").select("id").eq("loja_id", s.loja_id)
    const busca = String(p.busca ?? "").replace(/[%,()]/g, "").trim().slice(0, 60)
    if (busca) q = q.or(`codigo.ilike.%${busca}%,nome_cliente.ilike.%${busca}%,telefone_cliente.ilike.%${busca}%`)
    if (p.tipo === "retirada") q = q.ilike("endereco_entrega", "%Retirada%")
    if (p.tipo === "entrega") q = q.not("endereco_entrega", "ilike", "%Retirada%")
    if (typeof p.desde === "string") q = q.gte("criado_em", p.desde)
    if (typeof p.ate === "string") q = q.lte("criado_em", p.ate)
    const r = await q.order("criado_em", { ascending: false }).limit(5000)
    return { data: (r.data ?? []).map((x: any) => x.id), error: r.error }
  },
  // Loja logada
  async loja_perfil(req) {
    const s = requireLoja(req); if (!s) return unauthorized()
    return sb.from("lojas").select("*").eq("id", s.loja_id).single()
  },
  async loja_cupons(req) {
    const s = requireLoja(req); if (!s) return unauthorized()
    return sb.from("cupons").select("*").eq("loja_id", s.loja_id).order("criado_em", { ascending: false })
  },
  // Cardápio da própria loja, para a loja editar (inclui produtos pausados)
  async loja_cardapio_edit(req) {
    const s = requireLoja(req); if (!s) return unauthorized()
    const [cat, prod] = await Promise.all([
      sb.from("categorias_produto").select("*").eq("loja_id", s.loja_id).order("ordem"),
      sb.from("produtos").select("*").eq("loja_id", s.loja_id).order("criado_em"),
    ])
    return { data: { categorias: cat.data ?? [], produtos: prod.data ?? [] }, error: cat.error || prod.error }
  },
  // Cardápio disponível da própria loja (entrega avulsa)
  async loja_cardapio_disp(req) {
    const s = requireLoja(req); if (!s) return unauthorized()
    const [prod, cat] = await Promise.all([
      sb.from("produtos").select("id, nome, preco, adicionais, categoria_id, ordem, foto_url").eq("loja_id", s.loja_id).eq("disponivel", true),
      sb.from("categorias_produto").select("id, nome, ordem").eq("loja_id", s.loja_id),
    ])
    return { data: { produtos: prod.data ?? [], categorias: cat.data ?? [] }, error: prod.error || cat.error }
  },

  // Motoboy logado
  async motoboy_eu(req) {
    const s = requireMotoboy(req); if (!s) return unauthorized()
    return sb.from("motoboys").select("*").eq("id", s.motoboy_id).single()
  },
  async motoboy_saques(req) {
    const s = requireMotoboy(req); if (!s) return unauthorized()
    return sb.from("saques").select("*").eq("motoboy_id", s.motoboy_id).eq("tipo", "motoboy").order("criado_em", { ascending: false })
  },
  async motoboy_ajustes(req) {
    const s = requireMotoboy(req); if (!s) return unauthorized()
    return sb.from("saldo_ajustes").select("valor").eq("motoboy_id", s.motoboy_id).eq("tipo", "motoboy").is("quitado_em", null)
  },

  // Link do contrato do motoboy (quem tem o link é o próprio motoboy)
  async contrato_motoboy(_req, p) {
    const token = String(p.token ?? "")
    if (token.length < 16) return { data: null, error: { message: "Link inválido" } }
    return sb.from("motoboys")
      .select("id, nome, email, telefone, cpf, veiculo, placa, status, contrato_assinado, contrato_assinado_em, contrato_token_expira_em, documentos, selfie_contrato, foto, criado_em")
      .eq("contrato_token", token).single()
  },

  // Painel admin
  async admin_lojas(req) {
    if (!requireAdmin(req)) return unauthorized()
    return sb.from("lojas").select("*").order("criado_em", { ascending: false })
  },
  async admin_lojas_csv(req) {
    if (!requireAdmin(req)) return unauthorized()
    return sb.from("lojas").select("nome,status,categoria,telefone,email,plano,comissao,taxa_entrega,aberto,criado_em").order("nome")
  },
  async admin_motoboys(req) {
    if (!requireAdmin(req)) return unauthorized()
    return sb.from("motoboys").select("*").order("criado_em", { ascending: false })
  },
  async admin_motoboys_csv(req) {
    if (!requireAdmin(req)) return unauthorized()
    return sb.from("motoboys").select("nome,status,telefone,email,veiculo,placa,disponivel,criado_em").order("nome")
  },
  async admin_cadastro(req, p) {
    if (!requireAdmin(req)) return unauthorized()
    return sb.from(p.tipo === "loja" ? "lojas" : "motoboys").select("*").eq("id", String(p.id ?? "")).single()
  },
  async admin_cupons(req) {
    if (!requireAdmin(req)) return unauthorized()
    return sb.from("cupons").select("*, loja:lojas(nome)").order("criado_em", { ascending: false })
  },
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const fn = CONSULTAS[String(body?.q ?? "")]
  if (!fn) return NextResponse.json({ data: null, error: { message: "Consulta desconhecida" } }, { status: 400 })
  const r = await fn(req, body?.p ?? {})
  if (r instanceof NextResponse) return r
  return NextResponse.json({ data: semSenha(r.data ?? null), error: r.error ? { message: r.error.message } : null })
}
