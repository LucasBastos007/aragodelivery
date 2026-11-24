export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, requireLoja, requireMotoboy, unauthorized } from "@/lib/session"

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

const CONSULTAS: Record<string, Consulta> = {
  // Loja logada
  async loja_perfil(req) {
    const s = requireLoja(req); if (!s) return unauthorized()
    return sb.from("lojas").select("*").eq("id", s.loja_id).single()
  },
  async loja_cupons(req) {
    const s = requireLoja(req); if (!s) return unauthorized()
    return sb.from("cupons").select("*").eq("loja_id", s.loja_id).order("criado_em", { ascending: false })
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
