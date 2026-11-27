// Black Friday Chegô 2026 — 27/11 06h30 até 28/11 00h00 (BRT), liga/desliga por horário.
//
// Regras (escopo do Lucas, 26/11):
// - 20% OFF nos produtos participantes (exceto Aline: R$ 3,00 fixo no Morango cravejado).
// - Desconto só sobre o PREÇO BASE do produto — nunca sobre adicionais, taxa ou serviço.
// - Split: o Chegô arca SEMPRE com 10% do valor original; o resto do desconto é da loja.
//     · 20%  → Chegô 10% + loja 10% (metade cada).
//     · Aline R$3 em R$14 → Chegô R$1,40 (10%) + loja R$1,60.
// - Limite: no máximo 2 PEDIDOS promocionais por cadastro POR LOJA (não global, não por unidade).
//   Depois disso a loja aparece com preço normal e a mensagem MSG_LIMITE_LOJA. Pedido cancelado
//   ou Pix não pago libera (mesma lógica da promoChego: conta por pedido não cancelado na janela).
// - Pão de Mel da Cris: desconto só a partir de 3 unidades (sabores combináveis, sem máximo);
//   atingido o mínimo, vale em TODAS as unidades de pão de mel do pedido.
// - Não acumula com cupom. Marca cada item com BLACK_MARCA_ID gravando o split (custo_chego/custo_loja)
//   pro borderô. O pedido sai com cupom_codigo = BLACK_CODIGO.
import { BLACK_ITENS, BLACK_LOJAS, type BlackItem } from "@/lib/blackFridayConfig"
export { BLACK_ITENS, BLACK_LOJAS } from "@/lib/blackFridayConfig"
export type { BlackItem, BlackLojaKey } from "@/lib/blackFridayConfig"

export const BLACK_INICIO = "2026-11-27T06:30:00-03:00"
export const BLACK_FIM = "2026-11-28T00:00:00-03:00"
export const BLACK_CODIGO = "BLACKCHEGO"
export const BLACK_MARCA_ID = "black-friday-chego"
export const BLACK_PCT = 20
export const CHEGO_PCT = 10 // Chegô arca sempre com 10% do valor original
export const BLACK_LIMITE_PEDIDOS = 2 // por cadastro, por loja
export const PAODEMEL_MIN = 3
export const BLACK_SELO = "BLACK CHEGÔ"
export const BLACK_SELO_PCT = "20% OFF"
export const MSG_LIMITE_LOJA =
  "Você já aproveitou suas duas compras promocionais nesta loja! Continue aproveitando a Black Friday nos demais estabelecimentos participantes do CHEGÔ."
export const MSG_PAODEMEL_MIN = "Promoção válida a partir de 3 unidades (pode misturar os sabores)."
/** Horários em que a tela deve se atualizar sozinha (liga/desliga) */
export const BLACK_VIRADAS = [BLACK_INICIO, BLACK_FIM]

const r2 = (v: number) => Math.round(v * 100) / 100
/** Parte do Chegô arredondada PARA BAIXO no centavo: nunca passa de 10% do original. */
const baixo2 = (v: number) => Math.floor(v * 100 + 1e-6) / 100

// Suspensão emergencial (painel admin): no app vem de /api/black/usados; no servidor quem decide é
// blackSuspensa() (configuracoes.black_friday_suspensa), conferido no criar pedido.
let suspensaNoApp = false
export function marcarBlackSuspensa(v: boolean) { suspensaNoApp = v }
export const BLACK_CHAVE_SUSPENSA = "black_friday_suspensa"

export function blackAtiva(agora: number = Date.now()): boolean {
  if (suspensaNoApp) return false
  return agora >= new Date(BLACK_INICIO).getTime() && agora < new Date(BLACK_FIM).getTime()
}

/** Item participante (independe de horário/loja cheia) */
export const itemBlack = (id?: string | null): BlackItem | undefined => (id ? BLACK_ITENS[id] : undefined)
/** uuid da loja participante → essa loja está na campanha? */
export const lojaBlack = (lojaId?: string | null): boolean =>
  !!lojaId && Object.values(BLACK_LOJAS).some(l => l.id === lojaId)
/** chave usada no conjunto "lojas em que o cadastro já bateu o limite" */
export const chaveLojaBlack = (lojaId: string) => `bl:${lojaId}`
export const uuidLoja = (b: BlackItem) => BLACK_LOJAS[b.loja].id

/** Desconto e parte do Chegô de UMA unidade, sobre o preço BASE do produto (sem adicionais). */
export function descontoUnidadeBlack(b: BlackItem, precoBase: number): { desc: number; chego: number } {
  const base = Number(precoBase) || 0
  if (b.tipo === "fixo") {
    const d = Math.min(b.fixo || 0, base)
    return { desc: r2(d), chego: baixo2(Math.min(d, base * CHEGO_PCT / 100)) }
  }
  return { desc: r2(base * BLACK_PCT / 100), chego: baixo2(base * CHEGO_PCT / 100) }
}

/** % de desconto mostrado no selo do produto (20, ou o arredondado do fixo da Aline). */
export function pctBlack(b: BlackItem, precoBase: number): number {
  if (b.tipo !== "fixo") return BLACK_PCT
  const base = Number(precoBase) || 0
  return base > 0 ? Math.round((Math.min(b.fixo || 0, base) / base) * 100) : 0
}

export type LinhaBlack = { produto_id?: string | null; precoBase: number; quantidade: number }
export type ResultadoBlack = {
  total: number
  porLinha: Map<number, { desc: number; chego: number; loja: number; qtd: number; original: number }>
}

/**
 * Desconto da Black Friday de um carrinho/pedido. App e servidor usam esta mesma função.
 * `precoBase` é o preço base do produto (sem adicionais). `lojasCheias` = conjunto de
 * chaveLojaBlack() das lojas em que o cadastro já bateu o limite de 2 pedidos (recebem preço normal).
 * `agora` fora da janela → nada.
 */
export function descontoBlack(
  itens: LinhaBlack[],
  lojasCheias: Set<string> = new Set(),
  agora: number = Date.now(),
): ResultadoBlack {
  const porLinha = new Map<number, { desc: number; chego: number; loja: number; qtd: number; original: number }>()
  if (!blackAtiva(agora)) return { total: 0, porLinha }

  // Pão de Mel: soma as unidades por loja (sabores combináveis) pra checar o mínimo de 3.
  const pmQtd = new Map<string, number>()
  for (const it of itens) {
    const b = itemBlack(it.produto_id)
    if (!b || b.grupo !== "paodemel") continue
    if (lojasCheias.has(chaveLojaBlack(uuidLoja(b)))) continue
    pmQtd.set(b.loja, (pmQtd.get(b.loja) || 0) + (Number(it.quantidade) || 0))
  }

  itens.forEach((it, idx) => {
    const b = itemBlack(it.produto_id)
    const q = Number(it.quantidade) || 0
    if (!b || q < 1) return
    if (lojasCheias.has(chaveLojaBlack(uuidLoja(b)))) return
    if (b.grupo === "paodemel" && (pmQtd.get(b.loja) || 0) < PAODEMEL_MIN) return
    const u = descontoUnidadeBlack(b, Number(it.precoBase) || 0)
    if (u.desc <= 0) return
    porLinha.set(idx, { desc: r2(u.desc * q), chego: r2(u.chego * q), loja: r2((u.desc - u.chego) * q), qtd: q, original: r2((Number(it.precoBase) || 0) * q) })
  })
  const total = r2([...porLinha.values()].reduce((s, v) => s + v.desc, 0))
  return { total, porLinha }
}

/** Itens do carrinho → linhas da BF. O preço do item no carrinho já vem com adicionais; o
 *  desconto é só sobre o preço base, então tira a soma dos adicionais (nenhuma loja da campanha
 *  usa o grupo "cobrança pelo maior", então a soma simples bate com o servidor). */
export function linhasBlackCarrinho(
  items: { produto_id?: string; id: string; preco: number; quantidade: number; adicionais?: { preco?: number | null }[] }[],
): LinhaBlack[] {
  return items.map(i => {
    const ad = (i.adicionais ?? []).reduce((s, a) => s + (Number(a?.preco) || 0), 0)
    return { produto_id: i.produto_id ?? i.id, quantidade: i.quantidade, precoBase: Math.max(0, r2((Number(i.preco) || 0) - ad)) }
  })
}

/** Rótulo da participação da loja no borderô (escopo 26/11): Aline (desconto fixo) tem o próprio. */
export function rotuloBorderoBlack(lojaId?: string | null): string {
  return lojaId === BLACK_LOJAS.aline.id ? "Desconto Black Friday — Participação do estabelecimento" : "Desconto 10% — Black Friday CHEGÔ"
}

/** Preço base já com desconto (pra exibição no app). */
export const comBlack = (b: BlackItem, precoBase: number) => r2((Number(precoBase) || 0) - descontoUnidadeBlack(b, precoBase).desc)
