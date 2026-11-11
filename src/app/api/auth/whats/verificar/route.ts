export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { adminSb, clientesDoTelefone, DIGITOS, errosDoDia, gerarTicket, hash, liberadoPara, mascararEmail, MAX_ERROS_DIA, MAX_TENTATIVAS, normalizarTelefone, tokenDeSessao } from "@/lib/loginWhats"

// Confere o código. Resultado:
//  - 1 conta com esse telefone  → { token } (o navegador troca por sessão)
//  - mais de 1 conta            → { contas, ticket } (cliente escolhe em /concluir)
//  - nenhuma conta              → { novo: true, ticket } (cliente informa o nome em /concluir)
export async function POST(req: NextRequest) {
  const { telefone, codigo } = await req.json().catch(() => ({}))
  const t = normalizarTelefone(telefone)
  if (!t || !new RegExp(`^\\d{${DIGITOS}}$`).test(String(codigo ?? ""))) return NextResponse.json({ error: "Código inválido." }, { status: 400 })
  if (!liberadoPara(t.digitos)) return NextResponse.json({ error: "Entrada pelo WhatsApp ainda não está disponível." }, { status: 403 })

  const sb = adminSb()
  const { data: row } = await sb.from("codigos_acesso").select("*").eq("chave", t.chave).is("verificado_em", null)
    .gte("expira_em", new Date().toISOString()).order("criado_em", { ascending: false }).limit(1).maybeSingle()
  if (!row) return NextResponse.json({ error: "Código expirado. Peça um novo." }, { status: 400 })
  if (row.tentativas >= MAX_TENTATIVAS) return NextResponse.json({ error: "Muitas tentativas. Peça um novo código." }, { status: 429 })
  const bloqueio = { error: "Muitos códigos errados hoje. Entre com e-mail e senha ou tente de novo amanhã." }
  const erros = await errosDoDia(sb, t.chave)
  if (erros >= MAX_ERROS_DIA) return NextResponse.json(bloqueio, { status: 429 })

  if (row.codigo_hash !== hash(`${t.chave}:${codigo}`)) {
    await sb.from("codigos_acesso").update({ tentativas: row.tentativas + 1 }).eq("id", row.id)
    // Bateu o limite do dia: invalida os códigos ainda abertos desse número.
    if (erros + 1 >= MAX_ERROS_DIA) {
      await sb.from("codigos_acesso").update({ expira_em: new Date().toISOString() }).eq("chave", t.chave).is("verificado_em", null)
      return NextResponse.json(bloqueio, { status: 429 })
    }
    const resta = MAX_TENTATIVAS - row.tentativas - 1
    return NextResponse.json({ error: resta > 0 ? `Código incorreto. Você tem mais ${resta} tentativa${resta > 1 ? "s" : ""}.` : "Muitas tentativas. Peça um novo código.", resta }, { status: 400 })
  }

  const ticket = gerarTicket()
  await sb.from("codigos_acesso").update({ verificado_em: new Date().toISOString(), ticket_hash: hash(ticket) }).eq("id", row.id)
  const contas = await clientesDoTelefone(sb, t.chave)

  if (contas.length === 1) {
    try {
      const token = await tokenDeSessao(sb, contas[0].id)
      await sb.from("codigos_acesso").update({ usado_em: new Date().toISOString() }).eq("id", row.id)
      return NextResponse.json({ token })
    } catch (e: any) {
      console.error("[login-whats] sessão:", e?.message)
      return NextResponse.json({ error: "Não foi possível entrar nessa conta. Use e-mail e senha." }, { status: 500 })
    }
  }
  if (contas.length > 1) {
    const lista = await Promise.all(contas.map(async c => {
      const { data } = await sb.auth.admin.getUserById(c.id)
      return { id: c.id, nome: (c.nome || "").split(" ")[0] || "Conta", email: mascararEmail(data.user?.email), desde: String(c.criado_em ?? "").slice(0, 10) }
    }))
    return NextResponse.json({ contas: lista, ticket })
  }
  return NextResponse.json({ novo: true, ticket })
}
