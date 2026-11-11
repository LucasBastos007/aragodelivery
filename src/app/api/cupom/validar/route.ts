export const dynamic = "force-dynamic"
import { jaFezPedido, MSG_SO_PRIMEIRO } from "@/lib/primeiroPedido"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cupomValeNoRaio } from "@/lib/cupomRaio"
import { ehCupomFreteAniversario, cupomFreteAniversarioNoPrazo, lojaComPonto, distanciaRetaKm, CUPOM_FRETE_ANIVERSARIO, MSG_CUPOM_FORA_DO_PRAZO, MSG_CUPOM_FORA_DO_RAIO } from "@/lib/freteGratisCampanha"

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// GET /api/cupom/validar?codigo=XXX&loja_id=YYY&subtotal=ZZZ&lat=AA&lng=BB
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const codigo   = searchParams.get("codigo")?.trim().toUpperCase()
  const loja_id  = searchParams.get("loja_id")
  const subtotal = parseFloat(searchParams.get("subtotal") ?? "0")
  const lat      = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null
  const lng      = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : null
  const cidade   = searchParams.get("cidade")

  if (!codigo) return NextResponse.json({ error: "Código obrigatório" }, { status: 400 })

  const client = sb()

  // Busca só pelo código — elegibilidade por loja/raio é decidida abaixo, porque um cupom
  // pode valer por loja_id único, por uma lista (lojas_ids) ou global.
  const { data: cupom, error } = await client
    .from("cupons")
    .select("id, codigo, tipo, valor, pedido_minimo, validade, ativo, usos, max_usos, loja_id, lojas_ids, centro_lat, centro_lng, raio_km, so_primeiro_pedido")
    .eq("codigo", codigo)
    .eq("ativo", true)
    .maybeSingle()

  if (error) {
    console.error("[cupom/validar]", error.message)
    return NextResponse.json({ error: "Erro ao consultar cupom." }, { status: 500 })
  }

  if (!cupom || !cupom.ativo) return NextResponse.json({ error: "Cupom inválido ou expirado." }, { status: 404 })

  const valeParaLoja =
    (!cupom.loja_id && !(cupom.lojas_ids?.length)) ||
    cupom.loja_id === loja_id ||
    (loja_id != null && (cupom.lojas_ids ?? []).includes(loja_id))
  if (!valeParaLoja) return NextResponse.json({ error: "Cupom não é válido para esta loja." }, { status: 422 })

  if (cupom.raio_km != null && cupom.centro_lat != null && cupom.centro_lng != null) {
    const { data: loja } = loja_id
      ? await client.from("lojas").select("lat, lng, cidade").eq("id", loja_id).maybeSingle()
      : { data: null }
    if (!cupomValeNoRaio(cupom, loja, { lat, lng, cidade })) {
      return NextResponse.json({ error: "Cupom não é válido para esta entrega (fora da área do cupom)." }, { status: 422 })
    }
  }

  // Cupom ARAGO68: prazo com hora (11/11 0h até 14/11 23h) e até 5 km da loja. Aqui é a prévia
  // (linha reta); o /api/pedido/criar mede pela rota e confere de novo.
  if (ehCupomFreteAniversario(codigo)) {
    if (!cupomFreteAniversarioNoPrazo()) return NextResponse.json({ error: MSG_CUPOM_FORA_DO_PRAZO }, { status: 422 })
    const { data: loja } = loja_id ? await client.from("lojas").select("lat, lng").eq("id", loja_id).maybeSingle() : { data: null }
    if (loja && !lojaComPonto(loja.lat, loja.lng)) return NextResponse.json({ error: "Essa loja ainda não marcou o ponto no mapa, então o cupom ARAGO68 não vale para ela." }, { status: 422 })
    if (loja && lat != null && lng != null && distanciaRetaKm(Number(loja.lat), Number(loja.lng), lat, lng) > CUPOM_FRETE_ANIVERSARIO.raioKm) {
      return NextResponse.json({ error: MSG_CUPOM_FORA_DO_RAIO }, { status: 422 })
    }
  }

  // "validade" é só a data (sem hora) — precisa valer até o FIM do dia em horário de
  // Brasília, não meia-noite UTC. Sem o offset -03:00, o cupom "válido até 13/09" expirava
  // às 21h de BRT do dia 12 (a Vercel roda em UTC, então "2026-09-13" virava meia-noite UTC
  // = 21h de 12/09 em Brasília) — 3h antes do dia sequer começar aqui. Bug real: cupom
  // SABADOU, válido até 13/09, dando "expirado" ainda na noite de 12/09.
  if (cupom.validade && new Date(cupom.validade + "T23:59:59-03:00") < new Date()) {
    return NextResponse.json({ error: "Este cupom expirou." }, { status: 422 })
  }
  if (cupom.max_usos != null && (cupom.usos ?? 0) >= cupom.max_usos) {
    return NextResponse.json({ error: "Este cupom já atingiu o limite de usos." }, { status: 422 })
  }
  if (cupom.pedido_minimo > 0 && subtotal < cupom.pedido_minimo) {
    return NextResponse.json({ error: `Pedido mínimo de R$ ${Number(cupom.pedido_minimo).toFixed(2)} para este cupom.` }, { status: 422 })
  }

  // Primeiro pedido: confere a conta LOGADA (token do login), nunca um telefone vindo da URL,
  // pra rota pública não dizer se um número já pediu. O /api/pedido/criar confere de novo.
  if (cupom.so_primeiro_pedido) {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
    const { data: u } = token ? await client.auth.getUser(token) : { data: null }
    if (!u?.user) return NextResponse.json({ error: "Entre na sua conta para usar o cupom de primeiro pedido." }, { status: 422 })
    const { data: cli } = await client.from("clientes").select("telefone").eq("id", u.user.id).maybeSingle()
    if (await jaFezPedido(client, cli?.telefone, u.user.id)) return NextResponse.json({ error: MSG_SO_PRIMEIRO }, { status: 422 })
  }

  return NextResponse.json({
    id:     cupom.id,
    codigo: cupom.codigo,
    tipo:   cupom.tipo,
    valor:  cupom.valor,
  })
}
