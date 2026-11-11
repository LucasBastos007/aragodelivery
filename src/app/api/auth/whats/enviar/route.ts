export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { adminSb, enviarWhats, errosDoDia, gerarCodigo, hash, ipDe, liberadoPara, MAX_ERROS_DIA, normalizarTelefone, VALIDADE_MIN } from "@/lib/loginWhats"

// Envia o código de acesso pro WhatsApp do cliente. Limites guardados no banco (vale
// entre instâncias da Vercel): 3 códigos por número a cada 15 min, 10 por IP por hora,
// 30 s entre um reenvio e outro, e nenhum código novo depois de 10 erros no dia.
export async function POST(req: NextRequest) {
  const { telefone } = await req.json().catch(() => ({}))
  const t = normalizarTelefone(telefone)
  if (!t) return NextResponse.json({ error: "Informe um WhatsApp válido, com DDD." }, { status: 400 })
  if (!liberadoPara(t.digitos)) return NextResponse.json({ error: "Entrada pelo WhatsApp ainda não está disponível." }, { status: 403 })

  const sb = adminSb(), ip = ipDe(req), agora = Date.now()
  const [{ data: doNumero }, { count: doIp }] = await Promise.all([
    sb.from("codigos_acesso").select("criado_em").eq("chave", t.chave).gte("criado_em", new Date(agora - 15 * 60000).toISOString()).order("criado_em", { ascending: false }),
    sb.from("codigos_acesso").select("id", { count: "exact", head: true }).eq("ip", ip).gte("criado_em", new Date(agora - 60 * 60000).toISOString()),
  ])
  if (doNumero?.[0] && agora - new Date(doNumero[0].criado_em).getTime() < 30000)
    return NextResponse.json({ error: "Aguarde 30 segundos para pedir outro código." }, { status: 429 })
  if ((doNumero?.length ?? 0) >= 3 || (doIp ?? 0) >= 10)
    return NextResponse.json({ error: "Muitos códigos pedidos. Tente de novo em alguns minutos." }, { status: 429 })

  if (await errosDoDia(sb, t.chave) >= MAX_ERROS_DIA)
    return NextResponse.json({ error: "Muitos códigos errados hoje. Entre com e-mail e senha ou tente de novo amanhã." }, { status: 429 })

  const codigo = gerarCodigo()
  const { error } = await sb.from("codigos_acesso").insert({
    telefone: t.digitos, chave: t.chave, codigo_hash: hash(`${t.chave}:${codigo}`),
    expira_em: new Date(agora + VALIDADE_MIN * 60000).toISOString(), ip,
  })
  if (error) return NextResponse.json({ error: "Não foi possível gerar o código." }, { status: 500 })

  const env = await enviarWhats(t.digitos, codigo)
  if (!env.ok) {
    console.error("[login-whats] falha no envio:", env.erro)
    return NextResponse.json({ error: "Não conseguimos enviar o código pro WhatsApp agora. Tente de novo ou entre com e-mail." }, { status: 502 })
  }
  return NextResponse.json({ ok: true, validadeMin: VALIDADE_MIN })
}
