"use client"
// Preço com a promoção Chegô 10% (lib/promoChego): preço cheio riscado, selo da Hora Maluca e o
// valor com desconto. Fora da promoção, depois do fim, ou se o cliente já usou o desconto
// nessa loja, mostra o preço normal.
import { useEffect, useState } from "react"
import { brl } from "@/lib/precoExibicao"
import { supabase } from "@/lib/supabase"
import { comPromo, emPromo, emRelampago, pctRelampago, promoAtiva, relampagoAtivo, PROMO_SELO, PROMO_VIRADAS, RELAMPAGO, RELAMPAGO_FIM, RELAMPAGO_INICIO, RODADAS } from "@/lib/promoChego"

/** Re-renderiza na virada da campanha (início e fim) pra o selo aparecer e sumir sozinho. */
export function usePromoAtiva(): boolean {
  usePromoVirada()
  return promoAtiva() || relampagoAtivo()
}
/** Muda de valor em cada virada de campanha; use nas dependências de useMemo. */
export function usePromoVirada(): string {
  // estado = qual campanha está no ar; muda nas viradas (10%: início/fim; relâmpago: 20h45/21h15)
  const estado = () => `${Object.values(RODADAS).map(r => Date.now() >= new Date(r.inicio).getTime() && Date.now() < new Date(r.fim).getTime() ? 1 : 0).join("")}${relampagoAtivo() ? 1 : 0}`
  const [ativa, setAtiva] = useState(estado)
  useEffect(() => {
    const agora = Date.now()
    const proxima = [...PROMO_VIRADAS, RELAMPAGO_INICIO, RELAMPAGO_FIM].map(t => new Date(t).getTime()).filter(t => t > agora).sort((a, b) => a - b)[0]
    if (proxima == null || proxima - agora > 2 ** 31 - 1) return
    const id = setTimeout(() => setAtiva(`${estado()}.${Date.now()}`), proxima - agora + 500)
    return () => clearTimeout(id)
  }, [ativa])
  return ativa
}

// Produtos da promoção que o cliente logado já usou (/api/promo/usados). Uma consulta por
// carregamento do app, compartilhada por todos os preços da tela; sem login fica vazio.
let usadosCache: string[] = []
let usadosPromessa: Promise<string[]> | null = null
const ouvintes = new Set<(u: string[]) => void>()
function buscarUsados(forcar = false): Promise<string[]> {
  if (usadosPromessa && !forcar) return usadosPromessa
  usadosPromessa = supabase.auth.getSession()
    .then(({ data }) => {
      const tk = data.session?.access_token
      if (!tk || !(promoAtiva() || relampagoAtivo())) return []
      return fetch("/api/promo/usados", { headers: { Authorization: `Bearer ${tk}` }, cache: "no-store" })
        .then(r => r.ok ? r.json() : { usados: [] }).then(j => Array.isArray(j?.usados) ? j.usados as string[] : [])
    })
    .catch(() => [] as string[])
    .then(u => { usadosCache = u; ouvintes.forEach(f => f(u)); return u })
  return usadosPromessa
}
/** Chamar depois de um pedido com a promoção, pra a tela já mostrar o preço normal. */
export function recarregarPromoUsados() { return buscarUsados(true) }

export function usePromoUsados(): string[] {
  const [u, setU] = useState<string[]>(usadosCache)
  // Na virada da rodada (16h, 19h) busca de novo: quem abriu o app antes do início ficava sem a lista
  const virada = usePromoVirada()
  useEffect(() => { if (promoAtiva()) buscarUsados(true) }, [virada])
  useEffect(() => {
    ouvintes.add(setU)
    buscarUsados().then(setU)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { buscarUsados(true) })
    return () => { ouvintes.delete(setU); subscription.unsubscribe() }
  }, [])
  return u
}

export function PrecoPromo({ produtoId, valor, aPartir, normal }: { produtoId: string; valor: number; aPartir?: boolean; normal: React.ReactNode }) {
  usePromoAtiva()
  const usados = usePromoUsados()
  if (emRelampago(produtoId, Date.now(), usados) && valor > 0) {
    // Oferta Relâmpago: preço fixo da oferta (mais o que a opção escolhida somar ao preço base)
    const promo = Math.max(0, valor - (RELAMPAGO[produtoId].original - RELAMPAGO[produtoId].promo))
    return (
      <span className="preco-promo relampago">
        <span className="selo-relampago">⚡ OFERTA RELÂMPAGO CHEGÔ</span>
        <s>{brl(valor)}</s>
        <em>−{pctRelampago(produtoId)}%</em>
        <span className="preco">{aPartir && <small>a partir de </small>}{brl(promo)}</span>
        <small className="regra">1 unidade promocional por cadastro</small>
      </span>
    )
  }
  if (!emPromo(produtoId, Date.now(), usados) || !(valor > 0)) return <>{normal}</>
  return (
    <span className="preco-promo relampago">
      <span className="selo-relampago">{PROMO_SELO}</span>
      <s>{brl(valor)}</s>
      <span className="preco">{aPartir && <small>a partir de </small>}{brl(comPromo(valor))} 🔥</span>
    </span>
  )
}
