// Mensagens dos lembretes automáticos (03/11/2026, textos aprovados pelo Lucas em 31/10).
// Cada situação tem algumas versões; a escolha é fixa por pessoa+dia (não repete a mesma
// todo dia e não muda se o cron rodar de novo). Nunca usar "entregue" no título: o sw.js
// trata título com essa palavra como aviso de entrega (vibração longa e botão de avaliar).

type Msg = { title: string; body: string }

const SACOLA_ALMOCO: Msg[] = [
  { title: "🍽️ Seu almoço tá quase pronto!", body: "Falta só finalizar o pedido da {loja}. Bora resolver a fome?" },
  { title: "😋 Almoço garantido em 1 toque", body: "Seu pedido da {loja} ficou na sacola. Toca aqui pra terminar." },
]
const SACOLA_JANTA: Msg[] = [
  { title: "🌙 A janta tá te esperando", body: "Seu pedido da {loja} ainda está na sacola. Finaliza e relaxa!" },
  { title: "🍕 Bateu a fome da noite?", body: "Separamos seu pedido da {loja}. É só tocar pra terminar." },
]
const SACOLA_GERAL: Msg[] = [
  { title: "🛵 Sua sacola está te esperando!", body: "{valor} em delícias da {loja}. Volta pra finalizar?" },
  { title: "👀 Esqueceu alguma coisa?", body: "Seu pedido da {loja} ainda está aqui, do jeitinho que você deixou." },
  { title: "🥺 Ficamos com saudade!", body: "Você saiu e deixou seu pedido da {loja} pra trás. Volta, vai!" },
]
const AVALIAR: Msg[] = [
  { title: "⭐ Como estava, {nome}?", body: "Conta pra gente o que achou do pedido da {loja}. Leva 10 segundos." },
  { title: "💬 Sua opinião ajuda a {loja}", body: "Dá uma nota rapidinho pro seu pedido de hoje?" },
]
const SUMIDO: Record<number, Msg> = {
  7: { title: "🍔 Faz uma semana, hein, {nome}!", body: "Bateu vontade daquele lanche? As lojas estão abertas agora." },
  14: { title: "🥺 Sentimos sua falta, {nome}", body: "Faz tempo que você não aparece. Vem ver as novidades!" },
  30: { title: "💛 Volta pra gente, {nome}?", body: "Muita coisa nova no Chegô. Dá uma olhadinha nas lojas de hoje." },
}
export const DIAS_SUMIDO = [7, 14, 30]

function escolher(lista: Msg[], chave: string): Msg {
  let h = 0
  for (const c of chave) h = (h * 31 + c.charCodeAt(0)) | 0
  return lista[Math.abs(h) % lista.length]
}

function preencher(m: Msg, v: Record<string, string>): Msg {
  const f = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "")
    // Sem nome, tira a vírgula/espaço que sobraria ("Como estava, ?" vira "Como estava?")
    .replace(/,\s*([?!])/g, "$1").replace(/\s+([?!])/g, "$1").replace(/,\s*$/, "").trim()
  return { title: f(m.title), body: f(m.body) }
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
export const primeiroNome = (n?: string | null) => {
  const p = String(n ?? "").trim().split(/\s+/)[0] ?? ""
  return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ""
}

export function msgSacola(hora: number, chave: string, loja: string, total: number): Msg {
  const lista = hora >= 11 && hora < 14 ? SACOLA_ALMOCO : hora >= 18 ? SACOLA_JANTA : SACOLA_GERAL
  return preencher(escolher(lista, chave), { loja, valor: brl(total) })
}

export function msgAvaliar(chave: string, nome: string, loja: string): Msg {
  return preencher(escolher(AVALIAR, chave), { nome, loja })
}

export function msgSumido(dias: number, nome: string): Msg {
  return preencher(SUMIDO[dias], { nome })
}
