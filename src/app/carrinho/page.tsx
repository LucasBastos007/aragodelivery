"use client"

// Sacola no layout novo (proposta aprovada em 19/10/2026). Mesma sacola (useCart), mesmas
// ações (+, −, esvaziar, sugestão de bebida) e o mesmo caminho pro /checkout.
import { freteGratisAtivo, lojaComPonto } from "@/lib/freteGratisCampanha"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useCart } from "@/lib/cart"
import { bebidasDoCardapio } from "@/lib/sugestaoBebidas"
import { brl } from "@/lib/precoExibicao"
import { descontoPromo } from "@/lib/promoChego"
import { usePromoUsados } from "@/components/cliente/PrecoPromo"
import { lerCupomSacola, gravarCupomSacola, limparCupomSacola, validarCupom, descricaoCupom, type CupomValido } from "@/lib/cupomSacola"
import type { Loja, Produto, CategoriaProduto } from "@/types"

const IcVoltar = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>

export default function CarrinhoPage() {
  const router = useRouter()
  const { items, add, remove, clear, total } = useCart()
  const [loja, setLoja] = useState<Loja | null>(null)
  const [cardapio, setCardapio] = useState<{ categorias: CategoriaProduto[]; produtos: Produto[] } | null>(null)
  const [confirmaLimpar, setConfirmaLimpar] = useState(false)
  // Decidido uma vez só: o pedido chegou aqui sem bebida? Se sim, a sugestão fica na tela
  // mesmo depois que a pessoa adiciona uma (pra conseguir ajustar a quantidade ali).
  const [oferecerBebida, setOferecerBebida] = useState<boolean | null>(null)

  const loja_id = items[0]?.loja_id ?? null

  // Cupom na Sacola (layout da proposta, 20/10/2026). Confere com o último endereço salvo; o
  // Finalizar confere de novo com o endereço escolhido antes de dar o desconto.
  const [cupomTxt, setCupomTxt] = useState("")
  const [cupom, setCupom] = useState<CupomValido | null>(null)
  const [cupomErro, setCupomErro] = useState("")
  const [validando, setValidando] = useState(false)
  async function aplicar(codigo: string, silencioso = false) {
    if (!loja_id || !codigo.trim()) return
    let end: { lat?: number; lng?: number; cidade?: string } = {}
    try { end = JSON.parse(localStorage.getItem("arago_endereco_salvo") ?? "{}") ?? {} } catch {}
    setValidando(true); setCupomErro("")
    const r = await validarCupom({ codigo, lojaId: loja_id, subtotal: total, lat: end.lat, lng: end.lng, cidade: end.cidade })
    setValidando(false)
    if (r.ok) { setCupom(r.cupom); gravarCupomSacola(loja_id, r.cupom.codigo); setCupomTxt("") }
    else { setCupom(null); limparCupomSacola(); if (!silencioso) setCupomErro(r.erro) }
  }
  // Volta pra Sacola com cupom já aplicado (ou muda o subtotal): confere de novo
  useEffect(() => {
    const salvo = lerCupomSacola(loja_id)
    if (salvo && total > 0) aplicar(salvo, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loja_id, total])

  useEffect(() => {
    if (!loja_id) return
    supabase.from("lojas").select("*").eq("id", loja_id).single()
      .then(({ data }) => setLoja(data as Loja))
    Promise.all([
      supabase.from("categorias_produto").select("*").eq("loja_id", loja_id),
      supabase.from("produtos").select("*").eq("loja_id", loja_id).eq("disponivel", true),
    ]).then(([c, p]) => setCardapio({ categorias: (c.data as CategoriaProduto[]) ?? [], produtos: (p.data as Produto[]) ?? [] }))
  }, [loja_id])

  const bebidas = useMemo(() => cardapio && bebidasDoCardapio(cardapio.categorias, cardapio.produtos), [cardapio])
  if (bebidas && oferecerBebida === null) {
    setOferecerBebida(!bebidas.lojaSoDeBebida && !items.some(i => bebidas.idsBebida.has(i.produto_id ?? i.id)))
  }
  const sugestoes = oferecerBebida && bebidas ? bebidas.sugerir.slice(0, 10) : []
  const fotoDe = useMemo(() => new Map((cardapio?.produtos ?? []).map(p => [p.id, p.foto_url])), [cardapio])

  const taxa = Number(loja?.taxa_entrega ?? 0)
  const minimo = Number((loja as any)?.valor_minimo ?? 0)
  const falta = minimo - total
  // Frete grátis do aniversário de Aragoiânia (lib/freteGratisCampanha): a sacola não sabe a distância,
  // então mostra grátis e o Finalizar confirma pelo endereço (acima de 7 km volta a cobrar lá)
  const freteCampanha = freteGratisAtivo() && lojaComPonto((loja as any)?.lat, (loja as any)?.lng)
  const totalSacolaFn = (d: number) => Math.max(0, total - d) + (cupom?.tipo === "frete_gratis" || freteCampanha ? 0 : taxa)
  // Igual à proposta: entrega e total já na sacola. A taxa é a base da loja; o Finalizar
  // recalcula pela distância do endereço escolhido (e o total de lá é o que vale).
  const entregaGratis = cupom?.tipo === "frete_gratis" || freteCampanha
  const taxaSacola = entregaGratis ? 0 : taxa
  const descontoCupom = !cupom ? 0 : cupom.tipo === "percentual" ? Math.round(total * cupom.valor) / 100 : cupom.tipo === "fixo" ? Math.min(cupom.valor, total) : 0
  // Promoção Chegô 10% na 1ª unidade de cada produto da promoção (lib/promoChego)
  const promoUsados = usePromoUsados()
  const promo = descontoPromo(items.map(i => ({ produto_id: i.produto_id ?? i.id, preco: i.preco, quantidade: i.quantidade })), promoUsados)

  const topo = (
    <div className="topo branco">
      <div className="linha-topo">
        <button className="voltar" onClick={() => router.back()} aria-label="Voltar"><IcVoltar /></button>
        <span className="h2" style={{ flex: 1 }}>Sacola</span>
        {items.length > 0 && <button style={{ color: "var(--pimenta)", fontWeight: 700, fontSize: 14 }} onClick={() => setConfirmaLimpar(true)}>Limpar</button>}
      </div>
    </div>
  )

  if (items.length === 0) {
    return (
      <div className="cn sacola-nova">
        {topo}
        <div className="vazio" style={{ paddingTop: 100 }}>
          <div style={{ fontSize: 52 }}>🛍️</div>
          <div className="h2" style={{ margin: "12px 0 6px" }}>Sua sacola está vazia</div>
          <p>Escolha uma loja e adicione o que der vontade.</p>
          <Link className="btn btn-p" href="/" style={{ marginTop: 22 }}>Ver lojas</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="cn sacola-nova">
      {topo}
      <div style={{ padding: "14px 12px 24px" }}>
        {loja && !loja.aberto && <p className="aviso-vermelho">⛔ {loja.nome} está fechada agora. O pedido só pode ser feito quando ela abrir.</p>}

        <div className="cartao" style={{ padding: "6px 16px 4px" }}>
          <div className="sacola-loja">
            {loja?.logo_url && <img src={loja.logo_url} alt="" />}
            <span style={{ flex: 1, minWidth: 0 }}><b className="h3">{items[0]?.loja_nome}</b><small className="mut">{loja ? `Entrega em ${loja.tempo_min}-${loja.tempo_max} min` : ""}</small></span>
            {loja_id && <Link href={`/restaurante/${loja_id}`} style={{ color: "var(--pimenta)", fontWeight: 700, fontSize: 13.5, flex: "none" }}>Adicionar mais</Link>}
          </div>
          {items.map((item, idx) => {
            const dPromo = promo.porLinha.get(idx) ?? 0
            const foto = fotoDe.get(item.produto_id ?? item.id)
            return (
              <div key={item.id} className="item-s">
                {foto ? <img src={foto} alt="" /> : <span className="sem-foto">🍽️</span>}
                <div className="tx">
                  <b>{item.nome}</b>
                  {item.adicionais && item.adicionais.length > 0 && <small>{item.adicionais.map(a => a.nome).join(", ")}</small>}
                  {item.observacao && <small>Obs.: {item.observacao}</small>}
                  {dPromo > 0
                    ? <span className="preco-promo" style={{ marginTop: 6 }}><s>{brl(item.preco * item.quantidade)}</s><em>{promo.relampago.has(idx) ? "⚡ Oferta relâmpago" : "🚨 Hora Maluca −10%"}</em><span className="preco">{brl(item.preco * item.quantidade - dPromo)}</span></span>
                    : <span className="preco" style={{ display: "block", marginTop: 6, fontSize: 14.5 }}>{brl(item.preco * item.quantidade)}</span>}
                  {dPromo > 0 && item.quantidade > 1 && <small>O desconto vale em 1 unidade.</small>}
                </div>
                <div className="cont" style={{ alignSelf: "center" }}>
                  <button onClick={() => remove(item.id)} aria-label={item.quantidade === 1 ? `Tirar ${item.nome}` : "Menos"}>{item.quantidade === 1 ? "🗑" : "−"}</button>
                  <b>{item.quantidade}</b>
                  <button onClick={() => add({ id: item.id, produto_id: item.produto_id ?? item.id, nome: item.nome, preco: item.preco, loja_id: item.loja_id, loja_nome: item.loja_nome, observacao: item.observacao, adicionais: item.adicionais })} aria-label="Mais">+</button>
                </div>
              </div>
            )
          })}
        </div>

        {sugestoes.length > 0 && (
          <>
            <div style={{ padding: "18px 6px 8px" }}><span className="h3">Pra acompanhar</span></div>
            <div className="trilho" style={{ padding: "0 6px" }}>
              {sugestoes.map(prod => {
                const qtd = items.find(i => i.id === prod.id)?.quantidade ?? 0
                return (
                  <div key={prod.id} className={`sug ${qtd ? "on" : ""}`}>
                    {prod.foto_url ? <img src={prod.foto_url} alt="" loading="lazy" /> : <span className="sem-foto">🥤</span>}
                    <b>{prod.nome}</b>
                    <span className="preco" style={{ fontSize: 13.5 }}>+ {brl(prod.preco)}</span>
                    <span className="sug-acoes">
                      {qtd > 0 && <><button onClick={() => remove(prod.id)} aria-label={`Tirar ${prod.nome}`}>−</button><b>{qtd}</b></>}
                      <button onClick={() => add({ id: prod.id, produto_id: prod.id, nome: prod.nome, preco: prod.preco, loja_id: prod.loja_id, loja_nome: items[0]?.loja_nome ?? loja?.nome ?? "" })} aria-label={`Adicionar ${prod.nome}`}>+</button>
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div className="cartao" style={{ padding: 16, marginTop: 14 }}>
          <span className="h3" style={{ display: "block", marginBottom: 10 }}>Cupom</span>
          {cupom ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span><b className="verde">{cupom.codigo}</b> <span className="mut" style={{ fontSize: 13.5 }}>{descricaoCupom(cupom, brl)}</span></span>
              <button className="mut" style={{ fontWeight: 700 }} onClick={() => { setCupom(null); limparCupomSacola() }}>Remover</button>
            </div>
          ) : (
            <div className="cupom-in">
              <input value={cupomTxt} onChange={e => { setCupomTxt(e.target.value.toUpperCase()); setCupomErro("") }} onKeyDown={e => e.key === "Enter" && aplicar(cupomTxt)} placeholder="Código do cupom" />
              <button onClick={() => aplicar(cupomTxt)} disabled={!cupomTxt.trim() || validando}>{validando ? "…" : "Aplicar"}</button>
            </div>
          )}
          {cupomErro && <p className="erro-linha">{cupomErro}</p>}
        </div>

        <div className="cartao contas" style={{ padding: "14px 16px", marginTop: 14 }}>
          <div><span>Subtotal</span><span>{brl(total)}</span></div>
          <div><span>Entrega</span><span className={entregaGratis ? "verde" : ""}>{freteCampanha ? "Grátis até 7 km" : entregaGratis ? "Grátis" : loja ? brl(taxaSacola) : "…"}</span></div>
          {freteCampanha && <p className="mut" style={{ fontSize: 12.5, marginTop: 2 }}>Aniversário de Aragoiânia: frete pago pelo Chegô para endereços a até 7 km da loja. Confirmamos pelo seu endereço ao finalizar.</p>}
          {descontoCupom > 0 && <div><span>Desconto</span><span className="verde">− {brl(descontoCupom)}</span></div>}
          {promo.total > 0 && <div><span>Desconto promocional, custeado pelo Chegô</span><span className="verde">− {brl(promo.total)}</span></div>}
          <div className="tot"><span>Total</span><span>{brl(totalSacolaFn(descontoCupom + promo.total))}</span></div>
        </div>
        {falta > 0 && <p className="aviso-amarelo">Faltam {brl(falta)} pro pedido mínimo da loja ({brl(minimo)}).</p>}
      </div>

      <div className="rodape-fixo grudado">
        <span><small className="mut">Total</small><br /><b className="preco" style={{ fontSize: 19 }}>{brl(totalSacolaFn(descontoCupom + promo.total))}</b></span>
        <button className="btn btn-p" disabled={falta > 0} onClick={() => router.push("/checkout")}>{falta > 0 ? `Faltam ${brl(falta)}` : "Continuar"}</button>
      </div>

      {confirmaLimpar && (
        <div className="cn-veu on" onClick={() => setConfirmaLimpar(false)}>
          <div className="cn folha on" onClick={e => e.stopPropagation()} style={{ padding: "22px 20px calc(env(safe-area-inset-bottom,0px) + 22px)" }}>
            <div className="h2">Esvaziar a sacola?</div>
            <p className="mut" style={{ margin: "8px 0 20px", lineHeight: 1.5 }}>Todos os itens de {items[0]?.loja_nome} saem da sacola.</p>
            <button className="btn btn-p" onClick={() => { clear(); setConfirmaLimpar(false) }}>Esvaziar</button>
            <button className="btn btn-s" style={{ marginTop: 10 }} onClick={() => setConfirmaLimpar(false)}>Manter os itens</button>
          </div>
        </div>
      )}
    </div>
  )
}
