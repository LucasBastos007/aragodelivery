export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { adminSb, clientesDoTelefone, hash, normalizarTelefone, tokenDeSessao } from "@/lib/loginWhats"

// Segunda etapa, depois do código conferido: escolher entre várias contas do mesmo
// telefone, ou criar a conta de um cliente novo (só com o nome; e-mail opcional).
export async function POST(req: NextRequest) {
  const { telefone, ticket, clienteId, nome, email } = await req.json().catch(() => ({}))
  const t = normalizarTelefone(telefone)
  if (!t || !ticket) return NextResponse.json({ error: "Sessão de verificação inválida." }, { status: 400 })

  const sb = adminSb()
  const { data: row } = await sb.from("codigos_acesso").select("*").eq("chave", t.chave).eq("ticket_hash", hash(String(ticket)))
    .is("usado_em", null).gte("verificado_em", new Date(Date.now() - 10 * 60000).toISOString()).maybeSingle()
  if (!row) return NextResponse.json({ error: "A verificação expirou. Peça um novo código." }, { status: 400 })

  let userId: string
  const contas = await clientesDoTelefone(sb, t.chave)
  if (clienteId) {
    if (!contas.some(c => c.id === clienteId)) return NextResponse.json({ error: "Conta não encontrada." }, { status: 400 })
    userId = clienteId
  } else {
    if (contas.length) return NextResponse.json({ error: "Este WhatsApp já tem conta." }, { status: 400 })
    const n = String(nome ?? "").trim()
    if (n.length < 2) return NextResponse.json({ error: "Informe seu nome." }, { status: 400 })
    const mail = String(email ?? "").trim().toLowerCase()
    const emailConta = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail) ? mail : `w${t.digitos}@cliente.chegodelivery.com`
    const { data, error } = await sb.auth.admin.createUser({
      email: emailConta, password: randomBytes(24).toString("base64url"), email_confirm: true,
      user_metadata: { nome: n, telefone: t.digitos, origem: "whatsapp" },
    })
    if (error || !data.user) {
      const msg = error?.message?.includes("already") ? "Esse e-mail já tem conta. Entre com e-mail e senha ou deixe o e-mail em branco." : "Não foi possível criar a conta."
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    userId = data.user.id
    await sb.from("clientes").upsert({ id: userId, nome: n, telefone: t.digitos, email: emailConta.endsWith("@cliente.chegodelivery.com") ? null : emailConta })
    fetch(new URL("/api/tracking/evento", req.url), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "cadastro" }) }).catch(() => {})
  }

  try {
    const token = await tokenDeSessao(sb, userId)
    await sb.from("codigos_acesso").update({ usado_em: new Date().toISOString() }).eq("id", row.id)
    return NextResponse.json({ token })
  } catch (e: any) {
    console.error("[login-whats] sessão:", e?.message)
    return NextResponse.json({ error: "Não foi possível entrar. Tente com e-mail e senha." }, { status: 500 })
  }
}
