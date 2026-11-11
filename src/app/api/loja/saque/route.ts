export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireLoja, unauthorized } from "@/lib/session"
import { notificarSaqueLojistaSolicitado } from "@/lib/email"
import { adiantamentosCiclo, calcularRepasse, chavePixLoja, cicloDe, ymdBrt } from "@/lib/repasseLoja"
import { diaEMinutosAgoraBrt } from "@/lib/periodoBrt"

// Regra do Chegô (Lucas, 19/10/2026): o lojista não saca quando quer. O repasse é feito toda
// sexta-feira. Na terça existe um saque avulso opcional (adiantamento) que cobra R$ 5,00.
// A taxa fica gravada em saques.taxa_saque (coluna já existente); do saldo sai o valor pedido
// e a loja recebe o valor menos a taxa. Nada muda pra motoboy (rota própria).
const TAXA_SAQUE_TERCA = 5
const TERCA = 2

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const MOTIVO_STATUS: Record<string, number> = {
  VALOR_INVALIDO: 400,
  LOJA_NAO_ENCONTRADA: 404,
  SEM_PIX: 422,
  SALDO_INSUFICIENTE: 422,
}
const MOTIVO_MSG: Record<string, string> = {
  VALOR_INVALIDO: "Valor inválido",
  LOJA_NAO_ENCONTRADA: "Loja não encontrada",
  SEM_PIX: "Cadastre sua chave PIX no perfil antes de solicitar",
  SALDO_INSUFICIENTE: "Valor maior que o saldo disponível",
}

export async function POST(req: NextRequest) {
  const sess = requireLoja(req)
  if (!sess) return unauthorized()

  const { valor } = await req.json()
  const sb = adminSb()

  if (diaEMinutosAgoraBrt().diaSemana !== TERCA) {
    return NextResponse.json(
      { error: "O saque avulso é só na terça-feira, com taxa de R$ 5,00. Seu repasse cai toda sexta, sem precisar pedir." },
      { status: 422 }
    )
  }
  if (!(Number(valor) > TAXA_SAQUE_TERCA)) {
    return NextResponse.json({ error: "O valor precisa ser maior que a taxa de R$ 5,00" }, { status: 400 })
  }

  // Desde 20/10/2026 o saldo é o do ciclo (sexta a quinta): o adiantamento sai do acumulado
  // do ciclo atual, uma vez por ciclo, e depois é descontado do repasse de sexta.
  const c = cicloDe(ymdBrt())
  const [r, ad, { data: lojaPix }] = await Promise.all([
    calcularRepasse(sb, sess.loja_id, c), adiantamentosCiclo(sb, sess.loja_id, c),
    sb.from("lojas").select("pix_key, pix_chave").eq("id", sess.loja_id).single(),
  ])
  const chave = chavePixLoja((lojaPix ?? {}) as any)
  if (!chave) return NextResponse.json({ error: MOTIVO_MSG.SEM_PIX }, { status: 422 })
  if (ad.lista.length) return NextResponse.json({ error: "Você já adiantou nesta semana. O resto cai na sexta." }, { status: 422 })
  const disponivel = Math.round((r.liquido - ad.total) * 100) / 100
  if (Number(valor) > disponivel + 0.001) return NextResponse.json({ error: `Valor maior que o disponível (R$ ${disponivel.toFixed(2).replace(".", ",")}).` }, { status: 422 })
  const liquido0 = Math.round((Number(valor) - TAXA_SAQUE_TERCA) * 100) / 100
  const { data: ins, error: eIns } = await sb.from("saques").insert({ tipo: "lojista", loja_id: sess.loja_id, valor: Number(valor), pix_chave: chave, status: "solicitado",
    taxa_saque: TAXA_SAQUE_TERCA, observacao: `Saque de terça: transferir R$ ${liquido0.toFixed(2)} (pedido R$ ${Number(valor).toFixed(2)} menos taxa de R$ ${TAXA_SAQUE_TERCA.toFixed(2)})` }).select("id").single()
  if (eIns || !ins) return NextResponse.json({ error: "Erro ao solicitar o adiantamento" }, { status: 500 })
  const resultado = { saqueId: (ins as any).id as string }
  // Trava contra toque duplo (o app antigo fazia isso numa transação no banco): depois de gravar,
  // confere a semana. Se entraram dois ao mesmo tempo, só o primeiro fica e o outro é apagado.
  const depois = await adiantamentosCiclo(sb, sess.loja_id, c)
  const primeiro = [...depois.lista].sort((x: any, y: any) => String(x.criado_em).localeCompare(String(y.criado_em)) || String(x.id).localeCompare(String(y.id)))[0] as any
  if (primeiro && primeiro.id !== resultado.saqueId) {
    await sb.from("saques").delete().eq("id", resultado.saqueId).eq("status", "solicitado")
    return NextResponse.json({ error: "Você já adiantou nesta semana. O resto cai na sexta." }, { status: 409 })
  }

  const liquido = liquido0

  const { data: loja } = await sb.from("lojas").select("nome, pix_key").eq("id", sess.loja_id).single()
  notificarSaqueLojistaSolicitado({
    nomeLoja: loja?.nome ?? "",
    valor: liquido,
    pixChave: loja?.pix_key ?? "",
    saqueId: resultado.saqueId!,
  }).catch(() => {})

  return NextResponse.json({ ok: true, liquido, taxa: TAXA_SAQUE_TERCA })
}
