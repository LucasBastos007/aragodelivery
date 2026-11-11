export const dynamic = "force-dynamic"
import { saldoDoMotoboy } from "@/lib/saldosRepasse"
import { ymdBrt } from "@/lib/repasseLoja"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSession, unauthorized } from "@/lib/session"
import { notificarSaqueSolicitado } from "@/lib/email"
import { diaEMinutosAgoraBrt } from "@/lib/periodoBrt"

// Regra do Chegô (Lucas, 20/10/2026), igual à do lojista: o motoboy não saca quando quer.
// O repasse é feito toda sexta-feira. Na terça existe um saque avulso opcional (adiantamento)
// que cobra R$ 5,00. A taxa fica em saques.taxa_saque; do saldo sai o valor pedido e o
// motoboy recebe o valor menos a taxa (o painel /chego-ctrl/saques já mostra o líquido).
const TAXA_SAQUE_TERCA = 5
const TERCA = 2

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const sess = getSession(req)
  if (sess?.role !== "motoboy") return unauthorized()

  const { motoboy_id } = sess as any
  const { valor } = await req.json()

  if (!valor || valor <= 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
  }
  if (diaEMinutosAgoraBrt().diaSemana !== TERCA) {
    return NextResponse.json(
      { error: "O saque avulso é só na terça-feira, com taxa de R$ 5,00. Seu repasse cai toda sexta, sem precisar pedir." },
      { status: 422 }
    )
  }
  if (!(Number(valor) > TAXA_SAQUE_TERCA)) {
    return NextResponse.json({ error: "O valor precisa ser maior que a taxa de R$ 5,00" }, { status: 400 })
  }

  const sb = adminSb()

  const { data: mb } = await sb
    .from("motoboys")
    .select("nome, pix_key")
    .eq("id", motoboy_id)
    .single()

  if (!mb) return NextResponse.json({ error: "Motoboy não encontrado" }, { status: 404 })
  if (!mb.pix_key) return NextResponse.json({ error: "Cadastre sua chave PIX antes de solicitar" }, { status: 422 })

  // Saldo = a mesma conta do fechamento e do admin, desde 16/10 (decisão do Lucas, 20/10/2026):
  // ganhos − o que já foi pago (saque ou pagamento pelo painel) + ajustes desde 16/10, menos saque
  // já pedido. Antes somava desde julho e não via os pagamentos feitos por fora.
  const { livre: saldo } = await saldoDoMotoboy(sb, motoboy_id, ymdBrt())
  if (valor > saldo + 0.001) return NextResponse.json({ error: "Valor maior que o saldo disponível" }, { status: 422 })

  const liquido = Math.round((Number(valor) - TAXA_SAQUE_TERCA) * 100) / 100
  const { data: saque, error } = await sb
    .from("saques")
    .insert({
      tipo: "motoboy", motoboy_id, valor, pix_chave: mb.pix_key, status: "solicitado",
      taxa_saque: TAXA_SAQUE_TERCA,
      observacao: `Saque de terça: transferir R$ ${liquido.toFixed(2)} (pedido R$ ${Number(valor).toFixed(2)} menos taxa de R$ ${TAXA_SAQUE_TERCA.toFixed(2)})`,
    })
    .select("id")
    .single()

  if (error || !saque) {
    return NextResponse.json({ error: "Erro ao criar saque" }, { status: 500 })
  }
  // Trava contra toque duplo: com o saque gravado, o reservado não pode passar do que ele tem.
  // Se dois pedidos entraram juntos e estouraram o saldo, este é desfeito.
  const depois = await saldoDoMotoboy(sb, motoboy_id, ymdBrt())
  if (depois.reservado > depois.pendente + 0.001) {
    await sb.from("saques").delete().eq("id", (saque as any).id).eq("status", "solicitado")
    return NextResponse.json({ error: "Você já pediu esse saque. Aguarde o pagamento." }, { status: 409 })
  }

  // Notifica o admin por email (não bloqueia a resposta)
  notificarSaqueSolicitado({
    nomeMotoboy: mb.nome,
    valor: liquido, // o que deve ser transferido (já sem a taxa de terça)
    pixChave: mb.pix_key,
    saqueId: saque.id,
  }).catch(() => {})

  return NextResponse.json({ ok: true, liquido, taxa: TAXA_SAQUE_TERCA })
}
