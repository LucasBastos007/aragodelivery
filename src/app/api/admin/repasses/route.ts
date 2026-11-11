export const dynamic = "force-dynamic"
export const maxDuration = 60
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { adiantamentosCiclo, calcularRepasse, chaveCiclo, chavePixLoja, chavePixParece, cicloAnterior, cicloDe, INICIO_REPASSES, tipoChaveSugerido, validarChavePix, ymdBrt, type Ciclo } from "@/lib/repasseLoja"
import { enviarPix, saldoConta, type TipoChavePix } from "@/lib/asaas"
import { marcarBorderoPago } from "@/lib/bordero"

// Repasses de sexta (20/10/2026). O admin vê quanto cada loja tem a receber no ciclo (sexta a
// quinta) e paga: "Pagar pelo Asaas" (Pix automático) ou "Já paguei por fora" (só registra).
// Trava: um registro por loja e ciclo (externo_id único), então nunca paga duas vezes.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`
const mascara = (k: string) => k.includes("@") ? k.replace(/^(.{2}).*(@.*)$/, "$1***$2") : k.length > 6 ? k.slice(0, 3) + "*".repeat(Math.max(3, k.length - 6)) + k.slice(-3) : "***"

function cicloPedido(v: string | null): Ciclo {
  // "pagar": o ciclo da próxima sexta (na sexta, o que fechou ontem; nos outros dias, o atual)
  if (v === "pagar") { const h = ymdBrt(), c = cicloDe(h); return h === c.ini ? cicloAnterior(c) : c }
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return cicloDe(v)
  return cicloAnterior(cicloDe(ymdBrt())) // padrão: o ciclo que fechou na última quinta
}
async function jaPago(lojaId: string, c: Ciclo) {
  const tag = chaveCiclo(lojaId, c)
  const base = () => sb.from("movimentos_financeiros").select("id,valor,ocorrido_em,origem,externo_id,responsavel,comprovante_path").eq("loja_id", lojaId).eq("tipo", "repasse").is("cancelado_em", null)
  const { data: a } = await base().eq("externo_id", tag).limit(1)
  if (a?.[0]) return a[0]
  const { data: b } = await base().like("motivo", `%[${tag}]%`).limit(1)
  return b?.[0] ?? null
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const u = new URL(req.url), c = cicloPedido(u.searchParams.get("ciclo")), lojaId = u.searchParams.get("loja_id")
  if (lojaId) {
    const [r, ad] = await Promise.all([calcularRepasse(sb, lojaId, c, { itens: true }), adiantamentosCiclo(sb, lojaId, c)])
    return NextResponse.json({ ciclo: c, resumo: r, adiantado: ad.total, pago: await jaPago(lojaId, c) })
  }
  const { data: lojas } = await sb.from("lojas").select("id,nome,logo_url,pix_key,pix_chave,status").eq("status", "ativo").order("nome")
  // Calcula 16 lojas por vez (antes era uma por vez e a tela levava ~25 s). A conta de cada loja é a mesma.
  const saldoP = saldoConta().then(s => s.balance as number).catch(() => null)
  const lista = lojas ?? [], linhas: any[] = new Array(lista.length).fill(null)
  for (let i = 0; i < lista.length; i += 16) {
    await Promise.all(lista.slice(i, i + 16).map(async (l: any, k: number) => {
      const [r, ad, pago] = await Promise.all([calcularRepasse(sb, l.id, c), adiantamentosCiclo(sb, l.id, c), jaPago(l.id, c)])
      if (!r.pedidos) return
      const aPagar = Math.max(0, Math.round((r.liquido - ad.total) * 100) / 100)
      const chave = chavePixLoja(l)
      linhas[i + k] = {
        loja_id: l.id, nome: l.nome, logo_url: l.logo_url, pedidos: r.pedidos, produtos: r.produtos, liquido: aPagar, adiantado: ad.total,
        // Saldo sem travar em zero: negativo = a loja recebeu direto mais do que tinha a receber e deve ao Chegô
        saldo: Math.round((r.liquido - ad.total) * 100) / 100,
        comissao: r.comissao, taxas: Math.round((r.taxaOnline + r.taxaMaquininha) * 100) / 100, cupom: r.cupomLoja, recebidoPelaLoja: r.recebidoPelaLoja,
        chave: chave ? mascara(chave) : null, chaveTipo: chave ? tipoChaveSugerido(chave) : null, chaveOk: chavePixParece(chave), pago,
      }
    }))
  }
  const saldo = await saldoP
  const hoje = ymdBrt()
  return NextResponse.json({ ciclo: c, encerrado: hoje > c.fim, inicio: INICIO_REPASSES, saldoAsaas: saldo, lojas: linhas.filter(Boolean) })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const { loja_id, ciclo_ini, modo, tipo_chave, valor_confirmado } = await req.json().catch(() => ({}))
  if (!loja_id || !/^\d{4}-\d{2}-\d{2}$/.test(String(ciclo_ini ?? ""))) return NextResponse.json({ error: "Loja e ciclo obrigatórios." }, { status: 400 })
  if (modo !== "manual" && modo !== "asaas") return NextResponse.json({ error: "Modo inválido." }, { status: 400 })
  const c = cicloDe(ciclo_ini)
  if (ymdBrt() <= c.fim) return NextResponse.json({ error: `O ciclo só fecha na quinta ${dm(c.fim)}. Dá pra pagar a partir de sexta ${dm(c.paga)}.` }, { status: 422 })
  if (c.fim < INICIO_REPASSES) return NextResponse.json({ error: "Ciclo anterior a 16/10 já foi acertado." }, { status: 422 })

  const [r0, ad] = await Promise.all([calcularRepasse(sb, loja_id, c), adiantamentosCiclo(sb, loja_id, c)])
  // Valor a pagar = ciclo menos o que a loja já adiantou na terça
  const r = { ...r0, liquido: Math.max(0, Math.round((r0.liquido - ad.total) * 100) / 100) }
  if (!(r.liquido > 0)) return NextResponse.json({ error: "Nada a repassar nesse ciclo." }, { status: 422 })
  // O valor pode ter mudado (pedido entregue/cancelado depois que a tela abriu): confere de novo
  if (Math.abs(Number(valor_confirmado) - r.liquido) > 0.009) return NextResponse.json({ error: `O valor mudou pra ${r.liquido.toFixed(2).replace(".", ",")}. Confira e confirme de novo.`, valor: r.liquido }, { status: 409 })

  const { data: loja } = await sb.from("lojas").select("id,nome,pix_key,pix_chave").eq("id", loja_id).single()
  if (!loja) return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 })
  const tag = chaveCiclo(loja_id, c), motivo = `Repasse de ${dm(c.ini)} a ${dm(c.fim)} [${tag}]`
  if (await jaPago(loja_id, c)) return NextResponse.json({ error: "Esse repasse já foi registrado." }, { status: 409 })

  let chave: string | null = null, tipo: TipoChavePix | null = null
  if (modo === "asaas") {
    chave = chavePixLoja(loja as any)
    if (!chave) return NextResponse.json({ error: "A loja não tem chave Pix cadastrada." }, { status: 422 })
    const vk = validarChavePix(chave, tipo_chave)
    if (!vk.ok) return NextResponse.json({ error: `Chave Pix da loja não serve (${vk.motivo}). Corrija o cadastro dela ou pague por fora e dê baixa.` }, { status: 422 })
    chave = vk.chave; tipo = tipo_chave
    try { const s = await saldoConta(); if (s.balance < r.liquido) return NextResponse.json({ error: `Saldo no Asaas (${s.balance.toFixed(2).replace(".", ",")}) não cobre esse repasse.` }, { status: 422 }) }
    catch (e: any) { return NextResponse.json({ error: "Não consegui ler o saldo do Asaas: " + (e?.message ?? e) }, { status: 502 }) }
  }

  // Trava: o externo_id é único. Se outra aba pagou ao mesmo tempo, este insert falha.
  const { data: mov, error: eIns } = await sb.from("movimentos_financeiros").insert({
    beneficiario_tipo: "loja", loja_id, destinatario_nome: (loja as any).nome, tipo: "repasse", valor: r.liquido,
    forma: "pix", ocorrido_em: new Date().toISOString(), responsavel: modo === "asaas" ? "Admin (Pix pelo Asaas)" : "Admin (Pix por fora)",
    motivo, origem: modo === "asaas" ? "asaas" : "manual", externo_id: tag, criado_por: "repasses-sexta",
  }).select("id").single()
  if (eIns || !mov) return NextResponse.json({ error: "Esse repasse já está sendo registrado." }, { status: 409 })

  // O borderô da loja nesse ciclo (se foi enviado) fica como pago
  if (modo === "manual") { await marcarBorderoPago(sb, "loja", loja_id, (mov as any).id, r0.ciclo.ini).catch(() => {}); return NextResponse.json({ ok: true, valor: r.liquido, movimento: (mov as any).id }) }

  try {
    const t = await enviarPix(r.liquido, chave!, tipo!, `Repasse Chegô ${dm(c.ini)} a ${dm(c.fim)}`)
    // Com o id da transferência, a importação diária do Asaas reconhece e não duplica
    await sb.from("movimentos_financeiros").update({ externo_id: `asaas_transfer:${t.id}`, comprovante_path: `asaas:${t.id}`, destinatario_nome: t.bankAccount?.ownerName || (loja as any).nome }).eq("id", (mov as any).id)
    await marcarBorderoPago(sb, "loja", loja_id, (mov as any).id, r0.ciclo.ini).catch(() => {})
    return NextResponse.json({ ok: true, valor: r.liquido, transferencia: t.id, status: t.status, recebedor: t.bankAccount?.ownerName ?? null, aguardando: (t as any).authorized === false })
  } catch (e: any) {
    await sb.from("movimentos_financeiros").delete().eq("id", (mov as any).id)
    return NextResponse.json({ error: "O Asaas recusou o Pix: " + (e?.message ?? e) }, { status: 502 })
  }
}
