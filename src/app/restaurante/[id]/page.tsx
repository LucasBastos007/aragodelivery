"use client"

// Loja e cardápio no layout novo (proposta aprovada em 19/10/2026).
// Só a tela mudou: a consulta, o login obrigatório pra pedir, o preço dos adicionais
// (lib/precoAdicionais) e o que vai pra sacola (handleAddToCart/handleSimpleAdd) são os mesmos.
import { PrecoPromo, usePromoAtiva, usePromoUsados, usePromoVirada } from "@/components/cliente/PrecoPromo"
import { emPromo, emRelampago, descontoPromo, PROMO_FIM_TEXTO } from "@/lib/promoChego"
import { freteGratisAtivo, lojaComPonto } from "@/lib/freteGratisCampanha"
import { precoAdicionais } from "@/lib/precoAdicionais"
import { lerFavoritas, alternarFavorita } from "@/lib/favoritas"
import { precoExibicao, brl } from "@/lib/precoExibicao"
import { useEffect, useMemo, useRef, useState, Suspense } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useCart } from "@/lib/cart"
import { SacolaFlutuante } from "@/components/SacolaFlutuante"
import { useClienteAuth } from "@/lib/auth-cliente"
import { categoriaAtivaAgora, produtoDisponivelAgora } from "@/lib/sugestaoBebidas"
import { maisPedidos } from "@/lib/maisPedidos"
import type { Loja, Produto, CategoriaProduto, AdicionalProduto, GrupoAdicional } from "@/types"

interface AvaliacaoPublica {
  id: string; pedido_id: string; nota_loja: number | null; comentario: string | null
  resposta_loja: string | null; criado_em: string; clienteNome?: string
}

function isGrupo(a: AdicionalProduto | GrupoAdicional): a is GrupoAdicional {
  return "itens" in a
}

function legendaGrupo(g: GrupoAdicional): string {
  const { minimo, maximo } = g
  if (minimo === maximo && minimo === 1) return "Escolha 1 opção"
  if (minimo === maximo && minimo > 1) return `Escolha ${minimo} opções`
  if (minimo === 0 && maximo === 1) return "Escolha até 1 opção"
  if (minimo === 0) return `Escolha até ${maximo} opções`
  return `Escolha de ${minimo} a ${maximo} opções`
}

// Promoção "de/por" (2026-10-05): produtos.preco_antigo, só exibição.
function precoAntigo(prod: any, valor: number, aPartir: boolean) {
  const antigo = Number(prod?.preco_antigo)
  if (aPartir || !antigo || antigo <= valor) return null
  return <s>{brl(antigo)}</s>
}

function Preco({ prod }: { prod: Produto }) {
  const { valor, aPartir } = precoExibicao(prod)
  return <PrecoPromo produtoId={prod.id} valor={valor} aPartir={aPartir}
    normal={<span className="pr"><span className="preco">{aPartir && <small>a partir de </small>}{brl(valor)}</span>{precoAntigo(prod, valor, aPartir)}</span>} />
}

const hh = (t: string, mais1 = false) => { let [h, m] = t.split(":").map(Number); if (mais1) { m += 1; if (m === 60) { m = 0; h = (h + 1) % 24 } } return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h` }
function horarioCategoria(cat: CategoriaProduto) {
  if (!cat.cardapio_do_dia || !cat.horario_inicio) return "Indisponível agora"
  return cat.horario_fim ? `Disponível das ${hh(cat.horario_inicio)} às ${hh(cat.horario_fim, true)}` : `Disponível a partir das ${hh(cat.horario_inicio)}`
}

const IcVoltar = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
const IcFechar = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
const IcCompartilhar = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" /></svg>
const IcCoracao = ({ cheio }: { cheio: boolean }) => <svg width="20" height="20" viewBox="0 0 24 24" fill={cheio ? "var(--pimenta)" : "none"} stroke={cheio ? "var(--pimenta)" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7.5-4.8-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.2 12 20 12 20z" /></svg>
const IcBusca = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7.5" /><path d="m20.5 20.5-4.2-4.2" /></svg>

// ── Folha do produto ──────────────────────────────────────────────────────

function ProdutoModal({ prod, loja, onClose, onAdd }: {
  prod: Produto
  loja: Loja
  onClose: () => void
  onAdd: (qty: number, adicionais: AdicionalProduto[], obs: string) => void
}) {
  const [qty, setQty] = useState(1)
  const [obs, setObs] = useState("")

  const promoUsados = usePromoUsados()
  const grupos = useMemo(() => (prod.adicionais ?? []).filter(isGrupo) as GrupoAdicional[], [prod.adicionais])
  const adicionaisFlat = useMemo(() => (prod.adicionais ?? []).filter(a => !isGrupo(a)) as AdicionalProduto[], [prod.adicionais])

  const [selGrupos, setSelGrupos] = useState<Record<string, AdicionalProduto[]>>({})
  const [selFlat, setSelFlat] = useState<AdicionalProduto[]>([])
  const [entrou, setEntrou] = useState(false)
  useEffect(() => { const t = requestAnimationFrame(() => setEntrou(true)); return () => cancelAnimationFrame(t) }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.overflow = "hidden"
    document.body.style.position = "fixed"
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = "100%"
    return () => {
      document.body.style.overflow = ""
      document.body.style.position = ""
      document.body.style.top = ""
      document.body.style.width = ""
      window.scrollTo(0, scrollY)
    }
  }, [])

  function toggleRadio(g: GrupoAdicional, item: AdicionalProduto) {
    setSelGrupos(prev => ({ ...prev, [g.id]: prev[g.id]?.[0]?.id === item.id ? [] : [item] }))
  }

  function toggleMulti(g: GrupoAdicional, item: AdicionalProduto) {
    const atual = selGrupos[g.id] ?? []
    if (atual.find(x => x.id === item.id)) {
      setSelGrupos(prev => ({ ...prev, [g.id]: atual.filter(x => x.id !== item.id) }))
    } else if (atual.length < g.maximo) {
      setSelGrupos(prev => ({ ...prev, [g.id]: [...atual, item] }))
    }
  }

  function toggleFlat(a: AdicionalProduto) {
    setSelFlat(prev => prev.find(x => x.id === a.id) ? prev.filter(x => x.id !== a.id) : [...prev, a])
  }

  const gruposValidos = useMemo(() =>
    grupos.every(g => !g.obrigatorio || (selGrupos[g.id]?.length ?? 0) >= (g.minimo || 1)),
    [grupos, selGrupos])

  // Grupos (ex: "Sabor") e adicionais avulsos (ex: "Mandioca") somam juntos.
  const totalAdicionais = useMemo(() => {
    // regra única (lib/precoAdicionais): soma, exceto grupo "meio a meio" que cobra o sabor mais caro
    return precoAdicionais(prod.adicionais, [...Object.entries(selGrupos).flatMap(([gid, xs]) => xs.map(x => ({ ...x, grupo_id: gid }))), ...selFlat])
  }, [selGrupos, selFlat, prod.adicionais])

  const totalItem = (prod.preco + totalAdicionais) * qty

  function handleConfirm() {
    if (!gruposValidos) return
    // grupo_id: o mesmo ingrediente pode estar no grupo grátis e no extra pago
    onAdd(qty, [...Object.entries(selGrupos).flatMap(([gid, xs]) => xs.map(x => ({ ...x, grupo_id: gid }))), ...selFlat], obs)
    onClose()
  }

  return (
    <div className={`cn-veu ${entrou ? "on" : ""}`} onClick={onClose}>
      <div className={`cn folha ${entrou ? "on" : ""}`} onClick={e => e.stopPropagation()} role="dialog" aria-label={prod.nome}>
        <div className="folha-rolagem">
          {prod.foto_url
            ? <div className="prod-foto"><img src={prod.foto_url} alt="" /><button className="voltar fechar" onClick={onClose} aria-label="Fechar"><IcFechar /></button></div>
            : <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 14px 0" }}><button className="voltar" onClick={onClose} aria-label="Fechar"><IcFechar /></button></div>}
          <div className="prod-corpo">
            <div className="h1" style={{ fontSize: 24 }}>{prod.nome}</div>
            {prod.descricao && <p className="mut" style={{ marginTop: 8, lineHeight: 1.5, fontSize: 14.5 }}>{prod.descricao}</p>}
            <div style={{ marginTop: 12 }}><Preco prod={prod} /></div>
            {emRelampago(prod.id, Date.now(), promoUsados) && <p className="mut" style={{ fontSize: 13, marginTop: 6 }}>Oferta Relâmpago Chegô até 21h30: 1 unidade promocional por cadastro. O desconto é pago pelo Chegô e aparece na sacola.</p>}
            {emPromo(prod.id, Date.now(), promoUsados) && <p className="mut" style={{ fontSize: 13, marginTop: 6 }}>Promoção Chegô: 10% de desconto em 1 unidade, uma vez por cadastro nesta loja, {PROMO_FIM_TEXTO}. O desconto aparece na sacola.</p>}

            {loja.aberto && (
              <>
                {grupos.map(g => {
                  const sel = selGrupos[g.id] ?? []
                  const eRadio = g.maximo === 1
                  const atingiuMax = sel.length >= g.maximo
                  const faltando = g.obrigatorio && sel.length < (g.minimo || 1)
                  return (
                    <div key={g.id} className="grupo">
                      <div className="grupo-cab">
                        <span><b className="h3">{g.nome}</b><small style={{ color: faltando ? "var(--pimenta)" : undefined }}>{legendaGrupo(g)}</small></span>
                        {g.obrigatorio
                          ? <span className={`tag-ob ${faltando ? "" : "ok"}`}>{faltando ? "Obrigatório" : "✓ Pronto"}</span>
                          : <span className="tag-op">{sel.length}/{g.maximo}</span>}
                      </div>
                      {g.itens.map(item => {
                        const itemSel = !!sel.find(x => x.id === item.id)
                        const desabilitado = !itemSel && atingiuMax && !eRadio
                        return (
                          <button key={item.id} className="opc" role={eRadio ? "radio" : "checkbox"} aria-checked={itemSel} disabled={desabilitado}
                            onClick={() => eRadio ? toggleRadio(g, item) : toggleMulti(g, item)}>
                            <span className="n">{item.nome}{item.preco > 0 && <small>+ {brl(item.preco)}</small>}</span>
                            <span className={eRadio ? "radio" : "check"} />
                          </button>
                        )
                      })}
                    </div>
                  )
                })}

                {adicionaisFlat.length > 0 && (
                  <div className="grupo">
                    <div className="grupo-cab"><span><b className="h3">Adicionais</b><small>Opcional</small></span><span className="tag-op">{selFlat.length} escolhidos</span></div>
                    {adicionaisFlat.map(a => {
                      const sel = !!selFlat.find(x => x.id === a.id)
                      return (
                        <button key={a.id} className="opc" role="checkbox" aria-checked={sel} onClick={() => toggleFlat(a)}>
                          <span className="n">{a.nome}{a.preco > 0 && <small>+ {brl(a.preco)}</small>}</span>
                          <span className="check" />
                        </button>
                      )
                    })}
                  </div>
                )}

                <label className="campo" style={{ marginTop: 20 }}>
                  <span>Alguma observação?</span>
                  <textarea value={obs} onChange={e => setObs(e.target.value.slice(0, 200))} rows={2} placeholder="Ex.: sem cebola, maionese à parte" />
                  <small className="mut" style={{ textAlign: "right" }}>{obs.length}/200</small>
                </label>
              </>
            )}
          </div>
        </div>

        <div className="rodape-fixo">
          {loja.aberto ? (
            <>
              <div className="cont">
                <button disabled={qty <= 1} onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Menos">−</button>
                <b>{qty}</b>
                <button onClick={() => setQty(q => q + 1)} aria-label="Mais">+</button>
              </div>
              <button className="btn btn-p" disabled={!gruposValidos} onClick={handleConfirm}>
                {gruposValidos ? `Adicionar · ${brl(totalItem)}` : "Faça as escolhas obrigatórias"}
              </button>
            </>
          ) : (
            <button className="btn btn-p" disabled>Loja fechada agora</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────

function RestauranteConteudo() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const params = useSearchParams()
  const { items, add, remove } = useCart()

  const { user } = useClienteAuth()
  const [loja,          setLoja]          = useState<Loja | null>(null)
  const [categorias,    setCategorias]    = useState<CategoriaProduto[]>([])
  const [produtos,      setProdutos]      = useState<Produto[]>([])
  const [loading,       setLoading]       = useState(true)
  const [modalProd,     setModalProd]     = useState<Produto | null>(null)
  const [loginRequired, setLoginRequired] = useState(false)
  const [busca,         setBusca]         = useState("")
  const [favorita, setFavorita] = useState(false)
  useEffect(() => { setFavorita(lerFavoritas().includes(String(id))) }, [id])
  const [buscaAberta,   setBuscaAberta]   = useState(false)
  const [avaliacoes,    setAvaliacoes]    = useState<AvaliacaoPublica[]>([])
  const [catAtiva,      setCatAtiva]      = useState<string | null>(null)
  // Categoria-vitrine aberta (22/10/2026): cardápio separado que abre pelo card no "Mais pedidos"
  const [vitrineAberta, setVitrineAberta] = useState<string | null>(null)
  const [aviso,         setAviso]         = useState<string | null>(null)
  const [modo,          setModo]          = useState<"entrega" | "retirada">("entrega")

  // Cardápio (20/10/2026): mostra assim que loja, categorias e produtos chegam. Os nomes de
  // quem avaliou (2 buscas a mais, uma depois da outra) vêm depois, sem segurar a tela.
  // A última versão vista fica guardada nesta aba pra reabrir a loja na hora; a busca
  // ao banco roda sempre e atualiza por cima.
  useEffect(() => {
    let vivo = true
    const chave = `chego_cardapio_${id}`
    try {
      const c = JSON.parse(sessionStorage.getItem(chave) ?? "null")
      if (c?.loja) {
        setLoja(c.loja); setCategorias(c.categorias ?? [])
        setProdutos((c.produtos ?? []).filter(produtoDisponivelAgora)); setLoading(false)
      }
    } catch {}

    async function load() {
      const [{ data: lojaData }, { data: catData }, { data: prodData }, { data: avalData }] = await Promise.all([
        supabase.from("lojas").select("*").eq("id", id).single(),
        supabase.from("categorias_produto").select("*").eq("loja_id", id).order("ordem"),
        supabase.from("produtos").select("*").eq("loja_id", id).eq("disponivel", true).order("preco").order("nome"),
        supabase.from("avaliacoes").select("id, pedido_id, nota_loja, comentario, resposta_loja, criado_em")
          .eq("loja_id", id).not("comentario", "eq", "").order("criado_em", { ascending: false }).limit(15),
      ])
      if (!vivo) return
      setLoja(lojaData as Loja)
      setCategorias((catData as CategoriaProduto[]) ?? [])
      // Dia da semana do produto e almoço (ncm="almoco") só das 11h às 14h — BRT
      setProdutos(((prodData as Produto[]) ?? []).filter(produtoDisponivelAgora))
      setLoading(false)
      try { if (lojaData) sessionStorage.setItem(chave, JSON.stringify({ loja: lojaData, categorias: catData ?? [], produtos: prodData ?? [] })) } catch {}

      const listaAval = (avalData as AvaliacaoPublica[]) ?? []
      setAvaliacoes(listaAval.map(a => ({ ...a, clienteNome: a.clienteNome ?? "Cliente" })))
      const pedidoIds = [...new Set(listaAval.map(a => a.pedido_id))]
      if (pedidoIds.length > 0) {
        const { data: pedidos } = await supabase.from("pedidos").select("id, cliente_id").in("id", pedidoIds)
        const clienteIds = [...new Set((pedidos ?? []).map((p: any) => p.cliente_id).filter(Boolean))]
        const { data: clientes } = clienteIds.length > 0
          ? await supabase.from("clientes").select("id, nome").in("id", clienteIds)
          : { data: [] as any[] }
        if (!vivo) return
        const pedidoPorId = new Map((pedidos ?? []).map((p: any) => [p.id, p]))
        const nomePorClienteId = new Map((clientes ?? []).map((c: any) => [c.id, c.nome]))
        setAvaliacoes(listaAval.map(a => {
          const clienteId = pedidoPorId.get(a.pedido_id)?.cliente_id
          return { ...a, clienteNome: clienteId ? (nomePorClienteId.get(clienteId)?.split(" ")[0] ?? "Cliente") : "Cliente" }
        }))
      }
    }
    load()
    return () => { vivo = false }
  }, [id])

  // Entrega ou retirada: o checkout já lê esta mesma chave (sessionStorage) ao abrir
  useEffect(() => {
    try { const s = sessionStorage.getItem(`checkout_tipo_entrega_${id}`); if (s === "retirada" || s === "entrega") setModo(s) } catch {}
  }, [id])
  function escolherModo(m: "entrega" | "retirada") {
    setModo(m)
    try { sessionStorage.setItem(`checkout_tipo_entrega_${id}`, m) } catch {}
  }

  function avisar(t: string) { setAviso(t); setTimeout(() => setAviso(a => a === t ? null : a), 2200) }

  function prodQtd(prodId: string) {
    return items.filter(i => (i.produto_id ?? i.id) === prodId).reduce((s, i) => s + i.quantidade, 0)
  }

  function handleAddToCart(prod: Produto, qty: number, adicionais: AdicionalProduto[], obs: string) {
    if (!loja) return
    const totalAdicionais = precoAdicionais(prod.adicionais, adicionais)
    const cartKey = adicionais.length > 0 || obs.trim()
      ? `${prod.id}_${adicionais.map(a => a.grupo_id ? `${a.grupo_id}:${a.id}` : a.id).sort().join("+")}${obs.trim() ? "_" + obs.trim().slice(0, 20) : ""}`
      : prod.id
    for (let i = 0; i < qty; i++) {
      add({
        id: cartKey, produto_id: prod.id, nome: prod.nome,
        preco: prod.preco + totalAdicionais,
        loja_id: loja.id, loja_nome: loja.nome,
        observacao: obs.trim(), adicionais,
      })
    }
    avisar(`${qty}× ${prod.nome} na sacola`)
  }

  function handleSimpleAdd(prod: Produto) {
    if (!loja) return
    add({ id: prod.id, produto_id: prod.id, nome: prod.nome, preco: prod.preco, loja_id: loja.id, loja_nome: loja.nome })
    avisar(`${prod.nome} na sacola`)
  }

  function handleRemoveLast(prodId: string) {
    const last = [...items].reverse().find(i => (i.produto_id ?? i.id) === prodId)
    if (last) remove(last.id)
  }

  function abrir(prod: Produto) {
    if (!loja?.aberto) { setModalProd(prod); return }
    if (!user) { setLoginRequired(true); return }
    setModalProd(prod)
  }
  function maisRapido(prod: Produto) {
    if (!loja?.aberto) { avisar("Loja fechada agora"); return }
    if (!user) { setLoginRequired(true); return }
    if (prod.adicionais && prod.adicionais.length > 0) { setModalProd(prod); return }
    handleSimpleAdd(prod)
  }

  // Abre o produto que veio da home/busca (?produto=)
  const abriuDoLink = useRef(false)
  useEffect(() => {
    const pid = params.get("produto")
    if (loading || abriuDoLink.current || !pid) return
    abriuDoLink.current = true
    const p = produtos.find(x => x.id === pid)
    if (p) abrir(p)
  }, [loading, produtos, params]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mesma regra da vitrine do Início (lib/maisPedidos): promoção em 1º, depois os destaques da loja
  const promoNoAr = usePromoAtiva()
  const promoVirada = usePromoVirada()
  const promoUsados = usePromoUsados()
  const destaquesBase = useMemo(() => maisPedidos(produtos as any[], categorias, loja?.categoria) as Produto[], [produtos, categorias, loja?.categoria])
  const destaques = useMemo(() => {
    const d = destaquesBase
    const promo = promoNoAr ? produtos.filter(p => emRelampago(p.id, Date.now(), promoUsados) || emPromo(p.id, Date.now(), promoUsados)) : []
    return promo.length && d.length ? [...promo, ...d.filter(p => !promo.some(x => x.id === p.id))].slice(0, 6) : d
  }, [destaquesBase, produtos, promoNoAr, promoUsados, promoVirada])
  const campeoes = useMemo(() => new Set(destaques.slice(0, 2).map(p => p.id)), [destaques])

  // Categorias-vitrine (coluna categorias_produto.vitrine, 22/10/2026, Petiscaria "NOVIDADES DA CASA"):
  // aparecem como o 1º card do "Mais pedidos" e abrem um cardápio separado; ficam fora da lista normal.
  const vitrines = useMemo(() => categorias.filter(c => (c as any).vitrine && produtos.some(p => p.categoria_id === c.id))
    .map(c => { const ps = produtos.filter(p => p.categoria_id === c.id).sort((a, b) => (Number((a as any).ordem ?? 999) - Number((b as any).ordem ?? 999)) || Number(a.preco) - Number(b.preco)); return { id: c.id, nome: c.nome, foto: c.foto_url || ps.find(p => p.foto_url)?.foto_url || null, ativa: categoriaAtivaAgora(c), legenda: categoriaAtivaAgora(c) ? null : horarioCategoria(c), ps } }), [categorias, produtos])
  function abrirVitrine(cid: string) {
    setVitrineAberta(cid)
    try { history.pushState({ vitrine: cid }, "") } catch {}
  }
  function fecharVitrine() {
    if (history.state?.vitrine) history.back(); else setVitrineAberta(null)
  }
  useEffect(() => {
    const volta = () => setVitrineAberta(null)
    window.addEventListener("popstate", volta)
    return () => window.removeEventListener("popstate", volta)
  }, [])
  useEffect(() => {
    if (!vitrineAberta) return
    const ant = document.body.style.overflow; document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = ant }
  }, [vitrineAberta])

  // Blocos do cardápio: categorias com produto (as fora do horário aparecem trancadas) + "Outros"
  // Vitrine com "mostrar_tambem_em" (22/10/2026): os produtos dela também entram, primeiro, na
  // categoria indicada (Petiscaria: NOVIDADES DA CASA também na aba "Pastéis").
  const blocos = useMemo(() => {
    const extras = (cid: string) => vitrines.filter(v => (categorias.find(c => c.id === v.id) as any)?.mostrar_tambem_em === cid).flatMap(v => v.ps)
    const cats = categorias.filter(c => !(c as any).vitrine && (produtos.some(p => p.categoria_id === c.id) || extras(c.id).length))
      .map(c => ({ id: c.id, nome: c.nome, ativa: categoriaAtivaAgora(c), legenda: categoriaAtivaAgora(c) ? null : horarioCategoria(c), ps: [...extras(c.id), ...produtos.filter(p => p.categoria_id === c.id)] }))
    const idsCat = new Set(categorias.map(c => c.id))
    const sem = produtos.filter(p => !p.categoria_id || !idsCat.has(p.categoria_id))
    if (sem.length) cats.push({ id: "outros", nome: "Outros", ativa: true, legenda: null, ps: sem })
    const ordenadas = [...cats.filter(c => c.ativa), ...cats.filter(c => !c.ativa)]
    // Promoção Chegô 10% (09/11/2026): o produto da promoção sobe pro topo do cardápio, numa seção
    // própria, e sai da categoria dele. Só na tela: produtos.ordem não muda, então quando a
    // campanha acaba (ou o cliente já usou o desconto nesta loja) tudo volta pro lugar de antes.
    const rel = promoNoAr ? produtos.filter(p => emRelampago(p.id, Date.now(), promoUsados)) : []
    const promo = promoNoAr ? [...rel, ...produtos.filter(p => emPromo(p.id, Date.now(), promoUsados))] : []
    if (!promo.length) return ordenadas
    const ids = new Set(promo.map(p => p.id))
    const ativaDe = (p: Produto) => ordenadas.find(b => b.ps.some(x => x.id === p.id))?.ativa ?? true
    const topo = { id: "promo-chego", nome: rel.length ? "⚡ Oferta Relâmpago Chegô" : "Promoção Chegô −10%", ativa: promo.some(ativaDe), legenda: null, ps: promo }
    return [topo, ...ordenadas.map(b => ({ ...b, ps: b.ps.filter(p => !ids.has(p.id)) })).filter(b => b.ps.length)]
  }, [categorias, produtos, vitrines, promoNoAr, promoUsados, promoVirada])

  // Aba do cardápio acompanha a rolagem
  useEffect(() => {
    if (loading) return
    const obs = new IntersectionObserver(es => {
      const vis = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (vis) setCatAtiva(vis.target.id.replace("cat-", ""))
    }, { rootMargin: "-120px 0px -60% 0px" })
    document.querySelectorAll("section[id^=cat-]").forEach(s => obs.observe(s))
    return () => obs.disconnect()
  }, [loading, blocos.length])
  useEffect(() => {
    if (!catAtiva) return
    document.querySelector(`.abas-cat [data-cat="${catAtiva}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })
  }, [catAtiva])
  function irCat(cid: string) {
    const el = document.getElementById(`cat-${cid}`)
    if (!el) return
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 60, behavior: "smooth" })
    setCatAtiva(cid)
  }

  async function compartilhar() {
    const url = typeof window !== "undefined" ? window.location.origin + `/restaurante/${id}` : ""
    try {
      if (navigator.share) { await navigator.share({ title: loja?.nome ?? "Chegô", url }); return }
      await navigator.clipboard.writeText(url); avisar("Link da loja copiado")
    } catch {}
  }

  const termo = busca.trim().toLowerCase()
  const achados = termo ? produtos.filter(p => p.nome.toLowerCase().includes(termo) || (p.descricao ?? "").toLowerCase().includes(termo)) : []

  const lojaItensCart = items.filter(i => i.loja_id === id)
  // Já com a promoção Chegô 10%, igual à sacola
  const cartTotal = lojaItensCart.reduce((s, i) => s + i.preco * i.quantidade, 0) - descontoPromo(lojaItensCart.map(i => ({ produto_id: i.produto_id ?? i.id, preco: i.preco, quantidade: i.quantidade }))).total
  const cartCount = lojaItensCart.reduce((s, i) => s + i.quantidade, 0)

  if (loading) return <div className="cn" style={{ display: "grid", placeItems: "center" }}><p className="mut">Carregando cardápio…</p></div>

  if (!loja) return (
    <div className="cn" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 40 }}>😕</p>
      <p className="mut">Loja não encontrada</p>
      <Link href="/" style={{ color: "var(--pimenta)", fontWeight: 700 }}>Ver todas as lojas</Link>
    </div>
  )

  const capa = destaquesBase.find(p => p.foto_url)?.foto_url ?? produtos.find(p => p.foto_url)?.foto_url ?? loja.logo_url
  const taxa = Number(loja.taxa_entrega ?? 0)
  const minimo = Number((loja as any).valor_minimo ?? 0)
  const retirada = !!(loja as any).aceita_retirada

  const linhaProduto = (prod: Produto, ativa: boolean) => {
    const q = prodQtd(prod.id)
    return (
      <div key={prod.id} className={`prod ${ativa ? "" : "trancado"}`} role="button" tabIndex={ativa ? 0 : -1}
        onClick={() => ativa && abrir(prod)} onKeyDown={e => { if (ativa && (e.key === "Enter" || e.key === " ")) abrir(prod) }}>
        <span className="tx">
          {campeoes.has(prod.id) && <span className="selo-top">🔥 Mais pedido</span>}
          <b>{prod.nome}</b>
          {prod.descricao && <p>{prod.descricao}</p>}
          <Preco prod={prod} />
          {q > 0 && ativa && loja.aberto && (
            <span className="cont mini" onClick={e => e.stopPropagation()}>
              <button onClick={() => handleRemoveLast(prod.id)} aria-label={`Tirar ${prod.nome}`}>−</button><b>{q}</b>
              <button onClick={() => maisRapido(prod)} aria-label={`Mais ${prod.nome}`}>+</button>
            </span>
          )}
        </span>
        {prod.foto_url
          ? <span className="mais"><img className="im" src={prod.foto_url} alt="" loading="lazy" />{ativa && loja.aberto && <button className="add" onClick={e => { e.stopPropagation(); maisRapido(prod) }} aria-label={`Adicionar ${prod.nome}`}>+</button>}{q > 0 && <span className="qtd-badge">{q}</span>}</span>
          : ativa && loja.aberto && <button className="add solto" onClick={e => { e.stopPropagation(); maisRapido(prod) }} aria-label={`Adicionar ${prod.nome}`}>+</button>}
      </div>
    )
  }

  return (
    <div className="cn loja-nova" style={{ paddingBottom: cartCount > 0 ? 110 : 30 }}>
      {modalProd && (
        <ProdutoModal
          prod={modalProd} loja={loja}
          onClose={() => setModalProd(null)}
          onAdd={(qty, adicionais, obs) => handleAddToCart(modalProd, qty, adicionais, obs)}
        />
      )}

      {loginRequired && (
        <div className="cn-veu on centro" onClick={() => setLoginRequired(false)}>
          <div className="cn caixa" onClick={e => e.stopPropagation()}>
            <img src="/logo-chego-transparente.png" alt="Chegô" style={{ width: 110, margin: "0 auto 12px" }} />
            <div className="h2" style={{ textAlign: "center" }}>Entre pra fazer o pedido</div>
            <p className="mut" style={{ textAlign: "center", margin: "8px 0 20px", lineHeight: 1.5, fontSize: 14.5 }}>Leva menos de 1 minuto, com o seu WhatsApp.</p>
            <Link className="btn btn-p" href={`/cliente/entrar?next=/restaurante/${id}`}>Entrar ou criar conta</Link>
            <button className="btn btn-s" style={{ marginTop: 10 }} onClick={() => setLoginRequired(false)}>Continuar olhando</button>
          </div>
        </div>
      )}

      <div className="capa">
        {capa && <img src={capa} alt="" />}
        <div className="acoes">
          <button className="voltar" onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))} aria-label="Voltar"><IcVoltar /></button>
          <span style={{ display: "flex", gap: 8 }}>
            <button className="voltar" onClick={compartilhar} aria-label="Compartilhar"><IcCompartilhar /></button>
            <button className="voltar" onClick={() => setFavorita(alternarFavorita(String(id)))} aria-label={favorita ? "Tirar dos favoritos" : "Salvar nos favoritos"} aria-pressed={favorita}><IcCoracao cheio={favorita} /></button>
          </span>
        </div>
      </div>

      <div className="loja-cab">
        {loja.logo_url ? <img className="logo" src={loja.logo_url} alt="" /> : <span className="logo" />}
        <div className="nome">
          <h1 className="h1" style={{ fontSize: 26 }}>{loja.nome}</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
            <span className={`selo ${loja.aberto ? "aberto" : "fechado"}`}>{loja.aberto ? "● Aberta" : "Fechada agora"}</span>
            <span className="mut" style={{ fontSize: 13.5 }}>{loja.categoria} · {loja.cidade || "Aragoiânia"}</span>
          </div>
          {loja.descricao && <p className="mut" style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.45 }}>{loja.descricao}</p>}
        </div>
        <div className="fatos">
          <button onClick={() => avaliacoes.length && irCat("avals")}><b>{loja.nota_media ? `★ ${Number(loja.nota_media).toFixed(1).replace(".", ",")}` : "Nova"}</b>{loja.total_avaliacoes ? `${loja.total_avaliacoes} avaliações` : "sem avaliações"}</button>
          <div><b>{modo === "retirada" ? "20" : `${loja.tempo_min}-${loja.tempo_max}`}</b>{modo === "retirada" ? "min pra retirar" : "minutos"}</div>
          <div><b>{modo === "retirada" ? "Grátis" : freteGratisAtivo() && lojaComPonto((loja as any).lat, (loja as any).lng) ? "Frete" : taxa > 0 ? brl(taxa) : "Grátis"}</b>{modo === "retirada" ? "retirada" : freteGratisAtivo() && lojaComPonto((loja as any).lat, (loja as any).lng) ? "grátis até 7 km" : "entrega"}</div>
          {minimo > 0 && <div><b>{brl(minimo)}</b>mínimo</div>}
        </div>
        {retirada && (
          <div className="modo">
            <button aria-pressed={modo === "entrega"} onClick={() => escolherModo("entrega")}>Entrega</button>
            <button aria-pressed={modo === "retirada"} onClick={() => escolherModo("retirada")}>Retirar na loja</button>
          </div>
        )}
        {!loja.aberto && <p className="aviso-fechada">A loja está fechada agora. Dá pra ver o cardápio, e os pedidos voltam quando ela abrir.</p>}
      </div>

      {buscaAberta && (
        <div className="busca-loja">
          <label className="busca-real"><IcBusca /><input autoFocus value={busca} onChange={e => setBusca(e.target.value)} placeholder={`Buscar em ${loja.nome}`} /></label>
          {busca && <button className="limpar" onClick={() => setBusca("")}>Limpar</button>}
        </div>
      )}

      {termo ? (
        <section className="bloco-cat">
          <div className="h2">{achados.length} {achados.length === 1 ? "resultado" : "resultados"}</div>
          {achados.length ? achados.map(p => linhaProduto(p, blocos.find(b => b.ps.includes(p))?.ativa ?? true)) : <div className="vazio">Nenhum produto com “{busca}”.</div>}
        </section>
      ) : (
        <>
          <nav className="abas-cat" aria-label="Categorias do cardápio">
            <button onClick={() => setBuscaAberta(v => !v)} aria-label="Buscar no cardápio" style={{ display: "inline-flex", alignItems: "center" }}><IcBusca /></button>
            {blocos.map((b, i) => <button key={b.id} data-cat={b.id} aria-current={(catAtiva ?? blocos[0]?.id) === b.id || (!catAtiva && i === 0)} onClick={() => irCat(b.id)}>{b.ativa ? "" : "🔒 "}{b.nome}</button>)}
            {avaliacoes.length > 0 && <button data-cat="avals" aria-current={catAtiva === "avals"} onClick={() => irCat("avals")}>Avaliações</button>}
          </nav>

          {blocos.filter(b => b.id === "promo-chego").map(b => (
            <section key={b.id} className="bloco-cat" id={`cat-${b.id}`}>
              <div className="h2">{b.nome}</div>
              {b.ps.map(p => linhaProduto(p, b.ativa))}
            </section>
          ))}

          {(destaques.length > 2 || vitrines.length > 0) && (
            <div className="bloco-cat">
              <div className="h2">Mais pedidos</div>
              <div className="trilho">
                {vitrines.map(v => (
                  <button key={v.id} className="dest vitrine" onClick={() => abrirVitrine(v.id)}>
                    {v.foto ? <img src={v.foto} alt="" loading="lazy" /> : <span className="sem-foto">🍽️</span>}
                    <b>{v.nome}</b>
                    <span className="ver">Ver cardápio, {v.ps.length} {v.ps.length === 1 ? "opção" : "opções"}</span>
                  </button>
                ))}
                {destaques.map(p => (
                  <button key={p.id} className="dest" onClick={() => abrir(p)}>
                    {p.foto_url ? <img src={p.foto_url} alt="" loading="lazy" /> : <span className="sem-foto">🍽️</span>}
                    <b>{p.nome}</b>
                    <Preco prod={p} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {blocos.filter(b => b.id !== "promo-chego").map(b => (
            <section key={b.id} className="bloco-cat" id={`cat-${b.id}`}>
              <div className="h2">{b.nome}</div>
              {b.legenda && <p className="trava">🔒 {b.legenda}</p>}
              {b.ps.map(p => linhaProduto(p, b.ativa))}
            </section>
          ))}

          {produtos.length === 0 && <div className="vazio">Nenhum produto disponível agora.</div>}

          {avaliacoes.length > 0 && (
            <section className="bloco-cat" id="cat-avals" style={{ padding: "16px 16px" }}>
              <div className="h2" style={{ padding: "0 0 4px" }}>O que dizem da loja</div>
              {avaliacoes.map(a => (
                <div key={a.id} className="aval">
                  <span className="estrela">{"★".repeat(Math.max(1, Math.round(a.nota_loja ?? 5)))}</span>{" "}
                  <b style={{ color: "var(--grafite)", fontSize: 13 }}>{a.clienteNome ?? "Cliente"}</b>{" "}
                  <span className="mut" style={{ fontSize: 12.5 }}>{new Date(a.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                  {a.comentario && <p style={{ marginTop: 4 }}>{a.comentario}</p>}
                  {a.resposta_loja && <p className="resposta"><b>Resposta da loja</b>{a.resposta_loja}</p>}
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {(() => {
        const v = vitrines.find(x => x.id === vitrineAberta)
        if (!v) return null
        return (
          <div className="vitrine-tela" role="dialog" aria-label={v.nome}>
            <div className="vitrine-cab">
              <button className="voltar" onClick={fecharVitrine} aria-label="Voltar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
              <span className="h2">{v.nome}</span>
            </div>
            {v.foto && <img className="vitrine-capa" src={v.foto} alt="" />}
            <section className="bloco-cat">
              {v.legenda && <p className="trava">🔒 {v.legenda}</p>}
              {v.ps.map(p => linhaProduto(p, v.ativa))}
            </section>
          </div>
        )
      })()}

      {aviso && <div className="cn-toast" role="status">{aviso}</div>}

      {cartCount > 0 && (
        <button className="barra-sacola" onClick={() => router.push("/carrinho")}>
          <span><span className="qtd">{cartCount}</span>Ver sacola</span>
          <span>{brl(cartTotal)}</span>
        </button>
      )}
      {/* Sacola de outra loja: atalho pra voltar a ela sem precisar achar a loja de novo */}
      {cartCount === 0 && items.length > 0 && <SacolaFlutuante />}
    </div>
  )
}

export default function RestaurantePage() {
  return <Suspense><RestauranteConteudo /></Suspense>
}
