"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useCart } from "@/lib/cart"
import { useClienteAuth } from "@/lib/auth-cliente"
import type { Loja, Produto, CategoriaProduto, AdicionalProduto, GrupoAdicional } from "@/types"

const CAT_ICONS: Record<string, string> = {
  Restaurante: "🍽️", Mercadinho: "🛒", "Farmácia": "💊", Outros: "📦",
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

// ── Modal de produto ───────────────────────────────────────────────────────

function ProdutoModal({ prod, loja, onClose, onAdd }: {
  prod: Produto
  loja: Loja
  onClose: () => void
  onAdd: (qty: number, adicionais: AdicionalProduto[], obs: string) => void
}) {
  const [qty, setQty] = useState(1)
  const [obs, setObs] = useState("")

  const grupos = useMemo(() => (prod.adicionais ?? []).filter(isGrupo) as GrupoAdicional[], [prod.adicionais])
  const adicionaisFlat = useMemo(() => (prod.adicionais ?? []).filter(a => !isGrupo(a)) as AdicionalProduto[], [prod.adicionais])
  const temGrupos = grupos.length > 0

  const [selGrupos, setSelGrupos] = useState<Record<string, AdicionalProduto[]>>({})
  const [selFlat, setSelFlat] = useState<AdicionalProduto[]>([])

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

  const totalAdicionais = useMemo(() => {
    if (temGrupos) return Object.values(selGrupos).flat().reduce((s, a) => s + a.preco, 0)
    return selFlat.reduce((s, a) => s + a.preco, 0)
  }, [temGrupos, selGrupos, selFlat])

  const totalItem = (prod.preco + totalAdicionais) * qty

  function handleConfirm() {
    if (!gruposValidos) return
    onAdd(qty, temGrupos ? Object.values(selGrupos).flat() : selFlat, obs)
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#ffffff", borderRadius: "24px 24px 0 0", width: "100%",
          maxWidth: "min(520px, 100vw)",
          border: "1px solid #e5e7eb", overflow: "hidden",
          animation: "slideUp 0.22s ease-out",
          maxHeight: "90vh", display: "flex", flexDirection: "column",
        }}>

        <div style={{ flexShrink: 0, position: "relative" }}>
          {prod.foto_url ? (
            <div style={{ height: 200, overflow: "hidden" }}>
              <img src={prod.foto_url} alt={prod.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(20,20,20,0.9) 100%)" }} />
            </div>
          ) : (
            <div style={{ height: 100, background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>
              🍽️
            </div>
          )}
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%",
              background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)",
              color: "white", fontSize: 18, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", zIndex: 10,
            }}>
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>
          <div style={{ padding: "20px 20px 16px" }}>
            <p style={{ color: "#111827", fontWeight: 900, fontSize: 20, marginBottom: 6, lineHeight: 1.2 }}>{prod.nome}</p>
            {prod.descricao && (
              <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.55, marginBottom: 10 }}>{prod.descricao}</p>
            )}
            <p style={{ color: "#DC2626", fontWeight: 800, fontSize: 18 }}>
              {prod.preco === 0 ? "A partir de R$ 0,00" : `R$ ${prod.preco.toFixed(2)}`}
            </p>
          </div>

          {loja.aberto && (
            <>
              {temGrupos && grupos.map(g => {
                const sel = selGrupos[g.id] ?? []
                const eRadio = g.maximo === 1
                const atingiuMax = sel.length >= g.maximo
                const faltando = g.obrigatorio && sel.length < (g.minimo || 1)
                return (
                  <div key={g.id} style={{ borderTop: "8px solid #F3F4F6" }}>
                    <div style={{ padding: "14px 20px 10px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <p style={{ color: "#111827", fontWeight: 800, fontSize: 15, marginBottom: 2 }}>{g.nome}</p>
                        <p style={{ color: faltando ? "#DC2626" : "#6B7280", fontSize: 12 }}>{legendaGrupo(g)}</p>
                      </div>
                      {g.obrigatorio
                        ? <span style={{ background: "#111827", color: "white", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 4, flexShrink: 0, letterSpacing: 0.3 }}>OBRIGATÓRIO</span>
                        : <span style={{ background: "#F3F4F6", color: "#6B7280", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, flexShrink: 0 }}>OPCIONAL</span>
                      }
                    </div>
                    {g.itens.map(item => {
                      const itemSel = !!sel.find(x => x.id === item.id)
                      const desabilitado = !itemSel && atingiuMax
                      return (
                        <div
                          key={item.id}
                          onClick={() => desabilitado ? undefined : eRadio ? toggleRadio(g, item) : toggleMulti(g, item)}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "14px 20px", borderBottom: "1px solid #F3F4F6",
                            cursor: desabilitado ? "not-allowed" : "pointer",
                            opacity: desabilitado ? 0.4 : 1,
                            background: itemSel ? "rgba(220,38,38,0.04)" : "white",
                          }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: "#111827", fontWeight: 500, fontSize: 14 }}>{item.nome}</p>
                            {item.preco > 0 && (
                              <p style={{ color: "#DC2626", fontSize: 13, fontWeight: 600, marginTop: 2 }}>+ R$ {item.preco.toFixed(2)}</p>
                            )}
                          </div>
                          {eRadio ? (
                            <div style={{
                              width: 20, height: 20, borderRadius: "50%",
                              border: `2px solid ${itemSel ? "#DC2626" : "#D1D5DB"}`,
                              background: itemSel ? "#DC2626" : "white",
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                              {itemSel && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
                            </div>
                          ) : (
                            <div style={{
                              width: 22, height: 22, borderRadius: 6,
                              border: `2px solid ${itemSel ? "#DC2626" : "#D1D5DB"}`,
                              background: itemSel ? "#DC2626" : "white",
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                              {itemSel && <span style={{ color: "white", fontSize: 13, lineHeight: 1, fontWeight: 900 }}>✓</span>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {!temGrupos && adicionaisFlat.length > 0 && (
                <div style={{ borderTop: "8px solid #F3F4F6" }}>
                  <div style={{ padding: "14px 20px 10px" }}>
                    <p style={{ color: "#111827", fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Adicionais</p>
                    <p style={{ color: "#6B7280", fontSize: 12 }}>Opcional</p>
                  </div>
                  {adicionaisFlat.map(a => {
                    const sel = !!selFlat.find(x => x.id === a.id)
                    return (
                      <div
                        key={a.id}
                        onClick={() => toggleFlat(a)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "14px 20px", borderBottom: "1px solid #F3F4F6",
                          cursor: "pointer", background: sel ? "rgba(220,38,38,0.04)" : "white",
                        }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: "#111827", fontWeight: 500, fontSize: 14 }}>{a.nome}</p>
                          {a.preco > 0 && <p style={{ color: "#DC2626", fontSize: 13, fontWeight: 600, marginTop: 2 }}>+ R$ {a.preco.toFixed(2)}</p>}
                        </div>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6,
                          border: `2px solid ${sel ? "#DC2626" : "#D1D5DB"}`,
                          background: sel ? "#DC2626" : "white",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          {sel && <span style={{ color: "white", fontSize: 13, lineHeight: 1, fontWeight: 900 }}>✓</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ borderTop: "8px solid #F3F4F6", padding: "16px 20px" }}>
                <p style={{ color: "#111827", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Alguma observação? (opcional)</p>
                <textarea
                  value={obs}
                  onChange={e => setObs(e.target.value.slice(0, 200))}
                  placeholder="Ex: sem cebola, bem passado, molho à parte..."
                  rows={2}
                  style={{
                    width: "100%", borderRadius: 10, border: "1.5px solid #E5E7EB",
                    padding: "10px 12px", fontSize: 16, color: "#374151",
                    resize: "none", outline: "none", boxSizing: "border-box",
                    fontFamily: "inherit", lineHeight: 1.5,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#DC2626" }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB" }}
                />
                <p style={{ color: "#D1D5DB", fontSize: 11, textAlign: "right", marginTop: 2 }}>{obs.length}/200</p>
              </div>
            </>
          )}
        </div>

        <div style={{ flexShrink: 0, padding: "12px 20px 20px", borderTop: "1px solid #E5E7EB", background: "white" }}>
          {loja.aberto ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F9FAFB", borderRadius: 12, padding: "6px 12px", border: "1px solid #E5E7EB", flexShrink: 0 }}>
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  style={{
                    width: 38, height: 38, borderRadius: 10, border: "none",
                    background: qty <= 1 ? "#F3F4F6" : "rgba(220,38,38,0.15)",
                    color: qty <= 1 ? "#D1D5DB" : "#DC2626",
                    fontSize: 22, cursor: qty <= 1 ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  −
                </button>
                <span style={{ color: "#111827", fontWeight: 800, fontSize: 17, minWidth: 22, textAlign: "center" }}>{qty}</span>
                <button
                  onClick={() => setQty(q => q + 1)}
                  style={{
                    width: 38, height: 38, borderRadius: 10, border: "none",
                    background: "rgba(220,38,38,0.15)", color: "#DC2626",
                    fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  +
                </button>
              </div>
              <button
                onClick={handleConfirm}
                disabled={!gruposValidos}
                style={{
                  flex: 1, padding: "14px", borderRadius: 12, border: "none",
                  background: gruposValidos ? "#DC2626" : "#D1D5DB",
                  color: "white", fontWeight: 800, fontSize: 14,
                  cursor: gruposValidos ? "pointer" : "not-allowed",
                  transition: "background 0.15s",
                }}>
                {gruposValidos ? `Adicionar · R$ ${totalItem.toFixed(2)}` : "Escolha as opções obrigatórias"}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "12px", borderRadius: 12, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)" }}>
              <p style={{ color: "#EF4444", fontSize: 13, fontWeight: 600 }}>⛔ Loja fechada no momento</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────

export default function RestaurantePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { items, add, remove } = useCart()

  const { user } = useClienteAuth()
  const [loja,          setLoja]          = useState<Loja | null>(null)
  const [categorias,    setCategorias]    = useState<CategoriaProduto[]>([])
  const [produtos,      setProdutos]      = useState<Produto[]>([])
  const [loading,       setLoading]       = useState(true)
  const [catSelecionada, setCatSelecionada] = useState<string | null>(null)
  const [modalProd,     setModalProd]     = useState<Produto | null>(null)
  const [loginRequired, setLoginRequired] = useState(false)
  const [busca,         setBusca]         = useState("")

  useEffect(() => {
    async function load() {
      const [{ data: lojaData }, { data: catData }, { data: prodData }] = await Promise.all([
        supabase.from("lojas").select("*").eq("id", id).single(),
        supabase.from("categorias_produto").select("*").eq("loja_id", id).order("ordem"),
        supabase.from("produtos").select("*").eq("loja_id", id).eq("disponivel", true).order("preco").order("nome"),
      ])
      setLoja(lojaData as Loja)
      setCategorias((catData as CategoriaProduto[]) ?? [])
      const agora  = new Date()
      const hoje   = agora.getDay()
      const minutos = agora.getHours() * 60 + agora.getMinutes()
      const todos  = (prodData as Produto[]) ?? []
      setProdutos(todos.filter(p => {
        if (p.dias_semana && p.dias_semana.length > 0 && !p.dias_semana.includes(hoje)) return false
        // Produtos de almoço (ncm="almoco") só aparecem das 11h às 14h
        if ((p as any).ncm === "almoco" && (minutos < 11 * 60 || minutos >= 14 * 60)) return false
        return true
      }))
      setLoading(false)
    }
    load()
  }, [id])

  function prodQtd(prodId: string) {
    return items.filter(i => (i.produto_id ?? i.id) === prodId).reduce((s, i) => s + i.quantidade, 0)
  }

  function handleAddToCart(prod: Produto, qty: number, adicionais: AdicionalProduto[], obs: string) {
    if (!loja) return
    const totalAdicionais = adicionais.reduce((s, a) => s + a.preco, 0)
    const cartKey = adicionais.length > 0 || obs.trim()
      ? `${prod.id}_${adicionais.map(a => a.id).sort().join("+")}${obs.trim() ? "_" + obs.trim().slice(0, 20) : ""}`
      : prod.id
    for (let i = 0; i < qty; i++) {
      add({
        id: cartKey, produto_id: prod.id, nome: prod.nome,
        preco: prod.preco + totalAdicionais,
        loja_id: loja.id, loja_nome: loja.nome,
        observacao: obs.trim(), adicionais,
      })
    }
  }

  function handleSimpleAdd(prod: Produto) {
    if (!loja) return
    add({ id: prod.id, produto_id: prod.id, nome: prod.nome, preco: prod.preco, loja_id: loja.id, loja_nome: loja.nome })
  }

  function handleRemoveLast(prodId: string) {
    const last = [...items].reverse().find(i => (i.produto_id ?? i.id) === prodId)
    if (last) remove(last.id)
  }

  const destaques = useMemo(() => {
    if (produtos.length < 4) return []
    const marcados = produtos.filter(p => p.ncm === "destaque")
    if (marcados.length >= 2) return marcados.slice(0, 6)
    const comFoto = produtos.filter(p => p.foto_url)
    const base = comFoto.length >= 3 ? comFoto : produtos
    return base.slice(0, 6)
  }, [produtos])

  const buscaAtiva = busca.trim().length > 0
  const produtosFiltrados = buscaAtiva
    ? produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.descricao ?? "").toLowerCase().includes(busca.toLowerCase()))
    : []
  const semCategoria = produtos.filter(p => !p.categoria_id)

  function categoriaAtiva(cat: CategoriaProduto): boolean {
    if (!cat.cardapio_do_dia) return true
    const agora = new Date()
    const hh = agora.getHours().toString().padStart(2, "0")
    const mm = agora.getMinutes().toString().padStart(2, "0")
    const horaAtual = `${hh}:${mm}`
    const inicio = cat.horario_inicio ?? "00:00"
    const fim = cat.horario_fim ?? "23:59"
    if (horaAtual < inicio || horaAtual > fim) return false
    const dias = cat.dias_semana ?? []
    if (dias.length > 0 && !dias.includes(agora.getDay())) return false
    return true
  }

  // Categorias com pelo menos 1 produto e dentro do horário programado
  const categoriasComProdutos = useMemo(() =>
    categorias.filter(cat =>
      produtos.some(p => p.categoria_id === cat.id) && categoriaAtiva(cat)
    ),
    [categorias, produtos])

  const catAtual = catSelecionada ? categorias.find(c => c.id === catSelecionada) : null
  const produtosDaCat = catSelecionada ? produtos.filter(p => p.categoria_id === catSelecionada) : []

  const lojaItensCart = items.filter(i => i.loja_id === id)
  const cartTotal = lojaItensCart.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const cartCount = lojaItensCart.reduce((s, i) => s + i.quantidade, 0)

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#9CA3AF" }}>Carregando cardápio...</p>
    </div>
  )

  if (!loja) return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 40 }}>😕</p>
      <p style={{ color: "#6B7280" }}>Loja não encontrada</p>
      <Link href="/" style={{ color: "#DC2626" }}>← Ver todas as lojas</Link>
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", paddingBottom: cartCount > 0 ? 90 : 0 }}>

      {/* Modal produto */}
      {modalProd && (
        <ProdutoModal
          prod={modalProd} loja={loja}
          onClose={() => setModalProd(null)}
          onAdd={(qty, adicionais, obs) => handleAddToCart(modalProd, qty, adicionais, obs)}
        />
      )}

      {/* Modal login */}
      {loginRequired && (
        <div onClick={() => setLoginRequired(false)} style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#ffffff", borderRadius: 24, padding: "28px 20px", maxWidth: "min(360px, calc(100vw - 32px))", width: "100%",
            border: "1px solid #e5e7eb", textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
            <h2 style={{ color: "#111827", fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Faça login para pedir</h2>
            <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Para adicionar itens ao carrinho você precisa estar logado.
            </p>
            <Link href={`/cliente/entrar?next=/restaurante/${id}`} style={{
              display: "block", padding: "14px", borderRadius: 12, background: "#DC2626",
              color: "white", fontWeight: 800, fontSize: 15, textDecoration: "none", marginBottom: 10,
            }}>
              Entrar / Criar conta →
            </Link>
            <button onClick={() => setLoginRequired(false)} style={{
              width: "100%", padding: "12px", borderRadius: 12, border: "1px solid #E5E7EB",
              background: "transparent", color: "#9CA3AF", fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}>
              Continuar navegando
            </button>
          </div>
        </div>
      )}

      {/* Hero banner */}
      <div style={{ position: "relative", height: 220, background: "#1f2937", overflow: "hidden" }}>
        {loja.logo_url ? (
          <img src={loja.logo_url} alt={loja.nome} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #DC2626, #9B1C1C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80 }}>
            {CAT_ICONS[loja.categoria] ?? "🍽️"}
          </div>
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.55) 100%)" }} />
        <Link href="/" style={{
          position: "absolute", top: 16, left: 16,
          width: 38, height: 38, borderRadius: "50%",
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", textDecoration: "none", fontSize: 20, lineHeight: 1,
        }}>←</Link>
        <span style={{
          position: "absolute", top: 18, right: 16,
          fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999,
          background: loja.aberto ? "rgba(22,163,74,0.85)" : "rgba(0,0,0,0.55)",
          color: "white", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        }}>
          {loja.aberto ? "● Aberto" : "● Fechado"}
        </span>
      </div>

      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#ffffff", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", gap: 10 }}>
          {catSelecionada && !buscaAtiva ? (
            <button
              onClick={() => setCatSelecionada(null)}
              style={{ color: "#6B7280", fontSize: 20, background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, flexShrink: 0 }}>
              ←
            </button>
          ) : (
            <Link href="/" style={{ color: "#6B7280", fontSize: 20, textDecoration: "none", lineHeight: 1, flexShrink: 0 }}>←</Link>
          )}
          <p style={{ color: "#111827", fontWeight: 800, fontSize: 15, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {catSelecionada && !buscaAtiva ? (catAtual?.nome ?? loja.nome) : loja.nome}
          </p>
        </div>

        {/* Busca */}
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 10px" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 16, pointerEvents: "none" }}>🔍</span>
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder={`Buscar em ${loja.nome}`}
              style={{
                width: "100%", padding: "9px 12px 9px 36px",
                borderRadius: 999, border: "1.5px solid #E5E7EB",
                background: "#F9FAFB", fontSize: 16, color: "#111827",
                outline: "none", boxSizing: "border-box", fontFamily: "inherit",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "#DC2626"; e.currentTarget.style.background = "#fff" }}
              onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#F9FAFB" }}
            />
            {busca && (
              <button
                onClick={() => setBusca("")}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "#9CA3AF", border: "none", borderRadius: "50%",
                  width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "white", fontSize: 11, fontWeight: 700,
                }}>✕</button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px 20px" }}>

        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: -48, marginBottom: 12, position: "relative", zIndex: 10 }}>
          <div style={{
            width: 96, height: 96, borderRadius: "50%",
            border: "4px solid white", overflow: "hidden",
            background: "white", boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {loja.logo_url
              ? <img src={loja.logo_url} alt={loja.nome} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
              : <span style={{ fontSize: 40 }}>{CAT_ICONS[loja.categoria] ?? "🍽️"}</span>
            }
          </div>
        </div>

        {/* Info card */}
        <div style={{ background: "white", borderRadius: 16, padding: "16px 20px 20px", border: "1px solid #E5E7EB", marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <h1 style={{ color: "#111827", fontWeight: 900, fontSize: 22, textAlign: "center", marginBottom: 4 }}>{loja.nome}</h1>
          {loja.descricao && (
            <p style={{
              color: "#6B7280", fontSize: 12, textAlign: "center", lineHeight: 1.45, marginBottom: 12,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>{loja.descricao}</p>
          )}
          <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 12 }}>
            {loja.nota_media != null && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #F3F4F6" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span style={{ color: "#111827", fontWeight: 800, fontSize: 15 }}>{Number(loja.nota_media).toFixed(1)}</span>
                {loja.total_avaliacoes != null && loja.total_avaliacoes > 0 && (
                  <span style={{ color: "#6B7280", fontSize: 13 }}>({loja.total_avaliacoes} avaliações)</span>
                )}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: "#374151", fontSize: 13, fontWeight: 600 }}>🕐 {loja.tempo_min}–{loja.tempo_max} min</span>
              <span style={{ color: "#D1D5DB" }}>•</span>
              <span style={{ color: "#374151", fontSize: 13, fontWeight: 600 }}>
                {loja.taxa_entrega === 0 ? "🛵 Entrega grátis" : `🛵 R$ ${loja.taxa_entrega.toFixed(2)} entrega`}
              </span>
            </div>
          </div>
        </div>

        {!loja.aberto && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <p style={{ color: "#EF4444", fontWeight: 600, fontSize: 13 }}>⛔ Esta loja está fechada no momento</p>
          </div>
        )}

        {/* ── Busca ── */}
        {buscaAtiva && (
          <div style={{ marginBottom: 32 }}>
            {produtosFiltrados.length === 0 ? (
              <div style={{ textAlign: "center", marginTop: 40 }}>
                <p style={{ fontSize: 36, marginBottom: 8 }}>🔍</p>
                <p style={{ color: "#9CA3AF", fontWeight: 600 }}>Nenhum produto encontrado</p>
              </div>
            ) : (
              <>
                <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 12 }}>
                  {produtosFiltrados.length} resultado{produtosFiltrados.length !== 1 ? "s" : ""} para &quot;{busca}&quot;
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {produtosFiltrados.map(prod => (
                    <ProdutoRow
                      key={prod.id} prod={prod} loja={loja} qtd={prodQtd(prod.id)}
                      onOpen={() => { if (!user) { setLoginRequired(true); return }; setModalProd(prod) }}
                      onAdd={() => {
                        if (!user) { setLoginRequired(true); return }
                        if (prod.adicionais && prod.adicionais.length > 0) { setModalProd(prod); return }
                        handleSimpleAdd(prod)
                      }}
                      onRemove={() => handleRemoveLast(prod.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Tela de categorias ── */}
        {!buscaAtiva && !catSelecionada && (
          <>
            {/* Destaques */}
            {destaques.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <h2 style={{ color: "#111827", fontWeight: 900, fontSize: 17, lineHeight: 1 }}>Destaques</h2>
                  <span style={{ background: "rgba(220,38,38,0.1)", color: "#DC2626", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>
                    Mais pedidos
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10 }}>
                  {destaques.map((prod, idx) => (
                    <DestaqueProdCard
                      key={prod.id} prod={prod} loja={loja} isMaisPedido={idx < 2} qtd={prodQtd(prod.id)}
                      onOpen={() => { if (!user) { setLoginRequired(true); return }; setModalProd(prod) }}
                      onAdd={() => {
                        if (!user) { setLoginRequired(true); return }
                        if (prod.adicionais && prod.adicionais.length > 0) { setModalProd(prod); return }
                        handleSimpleAdd(prod)
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Grid de categorias */}
            {categoriasComProdutos.length > 0 && (
              <div>
                <h2 style={{ color: "#111827", fontWeight: 900, fontSize: 17, marginBottom: 14 }}>Categorias</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  {categoriasComProdutos.map(cat => {
                    const qtdProdutos = produtos.filter(p => p.categoria_id === cat.id).length
                    const thumb = cat.foto_url || produtos.find(p => p.categoria_id === cat.id && p.foto_url)?.foto_url
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setCatSelecionada(cat.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "14px 10px", borderRadius: 14,
                          background: "white", border: "1.5px solid #E5E7EB",
                          cursor: "pointer", textAlign: "left", width: "100%", minWidth: 0,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                          transition: "border-color 0.15s, box-shadow 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(220,38,38,0.4)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(220,38,38,0.12)" }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)" }}
                      >
                        {/* Thumbnail */}
                        <div style={{
                          width: 44, height: 44, borderRadius: 10, flexShrink: 0, overflow: "hidden",
                          background: "linear-gradient(135deg, rgba(220,38,38,0.1), rgba(220,38,38,0.04))",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {thumb
                            ? <img src={thumb} alt={cat.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontSize: 22 }}>🛍️</span>
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            color: "#111827", fontWeight: 700, fontSize: 13, lineHeight: 1.3,
                            overflow: "hidden", display: "-webkit-box",
                            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                          }}>{cat.nome}</p>
                          <p style={{ color: "#9CA3AF", fontSize: 11, marginTop: 3 }}>
                            {qtdProdutos} {qtdProdutos === 1 ? "item" : "itens"}
                          </p>
                        </div>
                        <span style={{ color: "#D1D5DB", fontSize: 16, flexShrink: 0 }}>›</span>
                      </button>
                    )
                  })}

                  {/* Sem categoria */}
                  {semCategoria.length > 0 && (
                    <button
                      onClick={() => setCatSelecionada("__sem_categoria__")}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "14px 14px", borderRadius: 14,
                        background: "white", border: "1.5px solid #E5E7EB",
                        cursor: "pointer", textAlign: "left",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      }}>
                      <div style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 22 }}>📦</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: "#111827", fontWeight: 700, fontSize: 13 }}>Outros</p>
                        <p style={{ color: "#9CA3AF", fontSize: 11, marginTop: 3 }}>{semCategoria.length} itens</p>
                      </div>
                      <span style={{ color: "#D1D5DB", fontSize: 16 }}>›</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {produtos.length === 0 && (
              <div style={{ textAlign: "center", marginTop: 60 }}>
                <p style={{ fontSize: 36, marginBottom: 12 }}>🍽️</p>
                <p style={{ color: "#9CA3AF", fontWeight: 600 }}>Nenhum produto disponível</p>
              </div>
            )}
          </>
        )}

        {/* ── Produtos da categoria selecionada ── */}
        {!buscaAtiva && catSelecionada && (
          <div>
            {(catSelecionada === "__sem_categoria__" ? semCategoria : produtosDaCat).length === 0 ? (
              <div style={{ textAlign: "center", marginTop: 60 }}>
                <p style={{ fontSize: 36, marginBottom: 12 }}>📭</p>
                <p style={{ color: "#9CA3AF", fontWeight: 600 }}>Nenhum produto nesta categoria</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(catSelecionada === "__sem_categoria__" ? semCategoria : produtosDaCat).map(prod => (
                  <ProdutoRow
                    key={prod.id} prod={prod} loja={loja} qtd={prodQtd(prod.id)}
                    onOpen={() => { if (!user) { setLoginRequired(true); return }; setModalProd(prod) }}
                    onAdd={() => {
                      if (!user) { setLoginRequired(true); return }
                      if (prod.adicionais && prod.adicionais.length > 0) { setModalProd(prod); return }
                      handleSimpleAdd(prod)
                    }}
                    onRemove={() => handleRemoveLast(prod.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Barra do carrinho */}
      {cartCount > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60, padding: "12px 20px",
          background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid #E5E7EB",
        }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <button onClick={() => router.push("/carrinho")} style={{
              width: "100%", padding: "14px 12px", borderRadius: 14, border: "none", cursor: "pointer",
              background: "#DC2626", color: "white", fontWeight: 800, fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            }}>
              <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 8, padding: "2px 8px", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {cartCount} {cartCount === 1 ? "item" : "itens"}
              </span>
              <span style={{ flex: 1, textAlign: "center" }}>Ver carrinho →</span>
              <span style={{ flexShrink: 0 }}>R$ {cartTotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DestaqueProdCard({ prod, loja, isMaisPedido, qtd, onOpen, onAdd }: {
  prod: Produto; loja: Loja; isMaisPedido: boolean; qtd: number
  onOpen: () => void; onAdd: () => void
}) {
  return (
    <div
      onClick={loja.aberto ? onOpen : undefined}
      style={{
        borderRadius: 14, overflow: "hidden", background: "#ffffff",
        border: "1px solid #e5e7eb", cursor: loja.aberto ? "pointer" : "default",
        position: "relative", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}>
      <div style={{ aspectRatio: "1 / 1", position: "relative", background: "#F3F4F6", overflow: "hidden" }}>
        {prod.foto_url
          ? <img src={prod.foto_url} alt={prod.nome} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, background: "linear-gradient(135deg,rgba(249,115,22,0.12),rgba(249,115,22,0.04))" }}>🍽️</div>
        }
        {isMaisPedido && (
          <div style={{
            position: "absolute", top: 6, left: 6, background: "#DC2626", color: "white",
            fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 20,
            boxShadow: "0 1px 4px rgba(220,38,38,0.4)",
          }}>+ pedido</div>
        )}
        {qtd > 0 && (
          <div style={{
            position: "absolute", top: 6, right: 6, background: "#DC2626", color: "white",
            width: 20, height: 20, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 800, boxShadow: "0 1px 4px rgba(220,38,38,0.4)",
          }}>{qtd}</div>
        )}
      </div>
      <div style={{ padding: "8px 9px 10px" }}>
        <p style={{
          color: "#111827", fontWeight: 600, fontSize: 12, lineHeight: 1.35, marginBottom: 5,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>{prod.nome}</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
          <p style={{ color: "#DC2626", fontWeight: 800, fontSize: 12 }}>R$ {prod.preco.toFixed(2)}</p>
          {loja.aberto && (
            <button
              onClick={e => { e.stopPropagation(); onAdd() }}
              style={{
                width: 22, height: 22, borderRadius: 6, border: "none",
                background: "#DC2626", color: "white", fontSize: 16, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>+</button>
          )}
        </div>
      </div>
    </div>
  )
}

function ProdutoRow({ prod, loja, qtd, onOpen, onAdd, onRemove }: {
  prod: Produto; loja: Loja; qtd: number
  onOpen: () => void; onAdd: () => void; onRemove: () => void
}) {
  return (
    <div
      onClick={loja.aberto ? onOpen : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
        borderRadius: 12, background: "#ffffff", border: "1px solid #e5e7eb",
        transition: "border-color 0.15s", cursor: loja.aberto ? "pointer" : "default",
      }}
      onMouseEnter={e => { if (loja.aberto) e.currentTarget.style.borderColor = "rgba(249,115,22,0.3)" }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB" }}>

      {prod.foto_url && (
        <div style={{ width: 76, height: 76, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
          <img src={prod.foto_url} alt={prod.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "#111827", fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{prod.nome}</p>
        {prod.descricao && (
          <p style={{
            color: "#9CA3AF", fontSize: 12, lineHeight: 1.4, marginBottom: 6,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{prod.descricao}</p>
        )}
        <p style={{ color: "#DC2626", fontWeight: 700, fontSize: 14 }}>R$ {prod.preco.toFixed(2)}</p>
      </div>

      {loja.aberto ? (
        qtd === 0 ? (
          <button
            onClick={e => { e.stopPropagation(); onOpen() }}
            style={{
              width: 36, height: 36, borderRadius: 10, border: "2px solid #DC2626",
              background: "transparent", color: "#DC2626", fontSize: 22, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>+</button>
        ) : (
          <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button onClick={onRemove} style={{
              width: 30, height: 30, borderRadius: 8, border: "1px solid #E5E7EB",
              background: "transparent", color: "#111827", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>−</button>
            <span style={{ color: "#111827", fontWeight: 700, minWidth: 16, textAlign: "center" }}>{qtd}</span>
            <button onClick={e => { e.stopPropagation(); onAdd() }} style={{
              width: 30, height: 30, borderRadius: 8, border: "none",
              background: "#DC2626", color: "white", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>+</button>
          </div>
        )
      ) : (
        <span style={{ color: "#D1D5DB", fontSize: 12, flexShrink: 0 }}>Fechado</span>
      )}
    </div>
  )
}
