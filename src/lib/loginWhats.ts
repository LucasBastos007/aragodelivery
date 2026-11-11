// Login do cliente por código no WhatsApp (Z-API) — pedido do Lucas, 18/10/2026.
// Só roda no servidor. Códigos ficam em `codigos_acesso` (hash, prazo, tentativas).
// Liberado para todos só com LOGIN_WHATS_ATIVO=1; antes disso, só para os números em
// LOGIN_WHATS_TESTE (lista separada por vírgula) — assim dá pra testar em produção sem
// mudar nada pros clientes.

import { createHmac, randomBytes, randomInt } from "crypto"
import { createClient } from "@supabase/supabase-js"

export const VALIDADE_MIN = 10
export const MAX_TENTATIVAS = 5
export const DIGITOS = 6
// Erros somados de todos os códigos do número nas últimas 24 h. Sem isso dava pra pedir
// código novo sem parar e ir chutando até acertar.
export const MAX_ERROS_DIA = 10

export async function errosDoDia(sb: ReturnType<typeof adminSb>, chave: string): Promise<number> {
  const { data } = await sb.from("codigos_acesso").select("tentativas").eq("chave", chave).gte("criado_em", new Date(Date.now() - 24 * 3600000).toISOString())
  return (data ?? []).reduce((s, r: any) => s + (r.tentativas ?? 0), 0)
}

export function adminSb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** "(62) 9 9103-2686" → { digitos: "62991032686", chave: "6291032686" } ou null se inválido.
 *  A chave ignora o 9º dígito, pra achar cadastros antigos salvos sem ele. */
export function normalizarTelefone(entrada: string): { digitos: string; chave: string } | null {
  let d = String(entrada ?? "").replace(/\D/g, "")
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2)
  if (d.length !== 10 && d.length !== 11) return null
  const ddd = d.slice(0, 2)
  if (Number(ddd) < 11) return null
  return { digitos: d, chave: ddd + d.slice(-8) }
}

export function liberadoPara(digitos: string): boolean {
  if (process.env.LOGIN_WHATS_ATIVO === "1") return true
  const teste = (process.env.LOGIN_WHATS_TESTE ?? "").split(",").map(s => s.replace(/\D/g, "")).filter(Boolean)
  return teste.some(t => normalizarTelefone(t)?.chave === normalizarTelefone(digitos)?.chave)
}

const segredo = () => process.env.SUPABASE_SERVICE_ROLE_KEY!
export const hash = (valor: string) => createHmac("sha256", segredo()).update(valor).digest("hex")
export const gerarCodigo = () => String(randomInt(0, 10 ** DIGITOS)).padStart(DIGITOS, "0")
export const gerarTicket = () => randomBytes(24).toString("base64url")

export async function enviarWhats(digitos: string, codigo: string): Promise<{ ok: boolean; erro?: string }> {
  const id = process.env.ZAPI_INSTANCE_ID, token = process.env.ZAPI_TOKEN, client = process.env.ZAPI_CLIENT_TOKEN
  if (!id || !token || !client) return { ok: false, erro: "Z-API não configurada" }
  const mensagem = `*${codigo}* é o seu código de verificação do Chegô.\n\nPor segurança, não compartilhe este código. Ele expira em ${VALIDADE_MIN} minutos.`
  try {
    const r = await fetch(`https://api.z-api.io/instances/${id}/token/${token}/send-text`, {
      method: "POST",
      headers: { "Client-Token": client, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "55" + digitos, message: mensagem }),
      cache: "no-store",
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !(j.messageId || j.zaapId)) return { ok: false, erro: j.error || j.message || `HTTP ${r.status}` }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, erro: e?.message ?? String(e) }
  }
}

/** Clientes cujo telefone bate com a chave (DDD + últimos 8 dígitos). */
export async function clientesDoTelefone(sb: ReturnType<typeof adminSb>, chave: string) {
  const ddd = chave.slice(0, 2), fim = chave.slice(2)
  const { data } = await sb.from("clientes").select("id, nome, telefone, criado_em").ilike("telefone", `%${fim.slice(0, 4)}%${fim.slice(4)}%`)
  return (data ?? []).filter(c => normalizarTelefone(c.telefone)?.chave === ddd + fim)
}

/** Gera o token de uso único que o navegador troca por uma sessão (supabase.auth.verifyOtp). */
export async function tokenDeSessao(sb: ReturnType<typeof adminSb>, userId: string): Promise<string> {
  const { data: u, error } = await sb.auth.admin.getUserById(userId)
  if (error || !u.user?.email) throw new Error("Conta sem e-mail de acesso")
  const { data, error: e2 } = await sb.auth.admin.generateLink({ type: "magiclink", email: u.user.email })
  if (e2 || !data.properties?.hashed_token) throw new Error(e2?.message ?? "Falha ao gerar sessão")
  return data.properties.hashed_token
}

export const mascararEmail = (e?: string | null) => {
  if (!e || e.endsWith("@cliente.chegodelivery.com")) return null
  const [u, d] = e.split("@")
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`
}

export function ipDe(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "?"
}
