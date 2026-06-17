"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useCart } from "@/lib/cart"
import { useClienteAuth } from "@/lib/auth-cliente"
import type { Loja, Produto, CategoriaProduto } from "@/types"

const CAT_ICONS: Record<string, string> = {
  Restaurante: "🍽️", Mercadinho: "🛒", "Farmácia": "💊", Outros: "📦",
}

// ── Modal de produto ───────────────────────────────────────────────────────

function ProdutoModal({ prod, loja, qtdInCart, onClose, onConfirm }: {
  prod: Produto
  loja: Loja
  qtdInCart: number
  onClose: () => void
  onConfirm: (delta: number) => void
}) {
  const [qty, setQty] = useState(Math.max(1, qtdInCart))

  // Fecha no Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  // Bloqueia scroll do body
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  const isAdding   = qtdInCart === 0
  const totalItem  = prod.preco * qty
  const btnLabel   = isAdding
    ? `Adicionar ${qty > 1 ? `(${qty}) ` : ""}· R$ ${totalItem.toFixed(2)}`
    : `Atualizar pedido · R$ ${totalItem.toFixed(2)}`

  function handleConfirm() {
    const delta = qty - qtdInCart
    onConfirm(delta)
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0 0 0",
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#ffffff", borderRadius: "24px 24px 0 0", width: "100%",
          maxWidth: "min(520px, 100vw)",
          border: "1px solid #e5e7eb", overflow: "hidden",
          animation: "slideUp 0.22s ease-out",
        }}>
        {/* Foto */}
        {prod.foto_url ? (
          <div style={{ position: "relative", height: 240 }}>
            <img src={prod.foto_url} alt={prod.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(20,20,20,0.9) 100%)" }} />
          </div>
        ) : (
          <div style={{ height: 120, background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56 }}>
            🍽️
          </div>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%",
            background: "rgba(0,0,0,0.6)", border: "1px solid #E5E7EB",
            color: "#111827", fontSize: 18, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 10,
          }}>
          ✕
        </button>

        <div style={{ padding: "20px 22px 28px" }}>
          {/* Info */}
          <p style={{ color: "#111827", fontWeight: 900, fontSize: 20, marginBottom: 6, lineHeight: 1.2 }}>{prod.nome}</p>
          {prod.descricao && (
            <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.55, marginBottom: 14 }}>
              {prod.descricao}
            </p>
          )}
          <p style={{ color: "#DC2626", fontWeight: 800, fontSize: 20, marginBottom: 24 }}>
            R$ {prod.preco.toFixed(2)}
          </p>

          {/* Qty + button */}
          {loja.aberto ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* Counter */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#F9FAFB", borderRadius: 12, padding: "8px 14px", border: "1px solid #E5E7EB" }}>
                <button
                  onClick={() => setQty(q => Math.max(qtdInCart > 0 ? 0 : 1, q - 1))}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: "none",
                    background: qty <= (qtdInCart > 0 ? 0 : 1) ? "#F3F4F6" : "rgba(220,38,38,0.15)",
                    color: qty <= (qtdInCart > 0 ? 0 : 1) ? "#D1D5DB" : "#DC2626",
                    fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  −
                </button>
                <span style={{ color: "#111827", fontWeight: 800, fontSize: 18, minWidth: 24, textAlign: "center" }}>{qty}</span>
                <button
                  onClick={() => setQty(q => q + 1)}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: "none",
                    background: "rgba(220,38,38,0.15)", color: "#DC2626",
                    fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  +
                </button>
              </div>

              {/* Confirm */}
              <button
                onClick={handleConfirm}
                disabled={qty === qtdInCart}
                style={{
                  flex: 1, padding: "14px", borderRadius: 12, border: "none",
                  background: qty === qtdInCart ? "rgba(220,38,38,0.3)" : "#DC2626",
                  color: "#111827", fontWeight: 800, fontSize: 14, cursor: qty === qtdInCart ? "not-allowed" : "pointer",
                }}>
                {qty === 0 && qtdInCart > 0 ? "🗑 Remover do carrinho" : btnLabel}
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
  const { items, add, remove, setQty, count, total } = useCart()

  const { user } = useClienteAuth()
  const [loja,           setLoja]           = useState<Loja | null>(null)
  const [categorias,     setCategorias]     = useState<CategoriaProduto[]>([])
  const [produtos,       setProdutos]       = useState<Produto[]>([])
  const [loading,        setLoading]        = useState(true)
  const [catAtiva,       setCatAtiva]       = useState<string | null>(null)
  const [modalProd,      setModalProd]      = useState<Produto | null>(null)
  const [loginRequired,  setLoginRequired]  = useState(false)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const tabsRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const [{ data: lojaData }, { data: catData }, { data: prodData }] = await Promise.all([
        supabase.from("lojas").select("*").eq("id", id).single(),
        supabase.from("categorias_produto").select("*").eq("loja_id", id).order("ordem"),
        supabase.from("produtos").select("*").eq("loja_id", id).eq("disponivel", true).order("nome"),
      ])
      setLoja(lojaData as Loja)
      setCategorias((catData as CategoriaProduto[]) ?? [])
      setProdutos((prodData as Produto[]) ?? [])
      if (catData && catData.length > 0) setCatAtiva((catData as CategoriaProduto[])[0].id)
      setLoading(false)
    }
    load()
  }, [id])

  // Atualiza aba ativa conforme scroll
  useEffect(() => {
    if (categorias.length === 0) return
    const HEADER_H = 94
    function onScroll() {
      let best: string | null = null
      let bestTop = -Infinity
      for (const [catId, el] of Object.entries(sectionRefs.current)) {
        if (!el) continue
        const top = el.getBoundingClientRect().top - HEADER_H
        if (top <= 10 && top > bestTop) { bestTop = top; best = catId }
      }
      if (best) setCatAtiva(best)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [categorias])

  // Centra a aba ativa na barra horizontal
  useEffect(() => {
    if (!catAtiva || !tabsRef.current) return
    const el = tabsRef.current.querySelector(`[data-cat-tab="${catAtiva}"]`) as HTMLElement | null
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [catAtiva])

  function scrollToCategory(catId: string) {
    setCatAtiva(catId)
    sectionRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function prodQtd(prodId: string) {
    return items.find(i => i.id === prodId)?.quantidade ?? 0
  }

  function handleModalConfirm(prod: Produto, delta: number) {
    if (!loja) return
    if (delta > 0) {
      for (let i = 0; i < delta; i++) add({ id: prod.id, nome: prod.nome, preco: prod.preco, loja_id: loja.id, loja_nome: loja.nome })
    } else if (delta < 0) {
      for (let i = 0; i < Math.abs(delta); i++) remove(prod.id)
    } else {
      setQty(prod.id, 0)
    }
  }

  // Destaques: prefere produtos com foto, máx 6
  const destaques = useMemo(() => {
    if (produtos.length < 4) return []
    const comFoto = produtos.filter(p => p.foto_url)
    const base = comFoto.length >= 3 ? comFoto : produtos
    return base.slice(0, 6)
  }, [produtos])

  const semCategoria   = produtos.filter(p => !p.categoria_id)
  const lojaItensCart  = items.filter(i => i.loja_id === id)
  const cartTotal      = lojaItensCart.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const cartCount      = lojaItensCart.reduce((s, i) => s + i.quantidade, 0)

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
    <div style={{ minHeight: "100vh", background: "#f8fafc", paddingBottom: cartCount > 0 ? 90 : 0, overflowX: "hidden" }}>

      {/* Modal produto */}
      {modalProd && (
        <ProdutoModal
          prod={modalProd}
          loja={loja}
          qtdInCart={prodQtd(modalProd.id)}
          onClose={() => setModalProd(null)}
          onConfirm={delta => handleModalConfirm(modalProd, delta)}
        />
      )}

      {/* Modal login obrigatório */}
      {loginRequired && (
        <div onClick={() => setLoginRequired(false)} style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)",
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
              color: "#111827", fontWeight: 800, fontSize: 15, textDecoration: "none", marginBottom: 10,
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

      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#ffffff", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ color: "#6B7280", fontSize: 20, textDecoration: "none", lineHeight: 1 }}>←</Link>
          <div style={{ flex: 1 }}>
            <p style={{ color: "#111827", fontWeight: 800, fontSize: 15 }}>{loja.nome}</p>
            <p style={{ color: "#9CA3AF", fontSize: 11 }}>
              {loja.tempo_min}–{loja.tempo_max} min ·{" "}
              {loja.taxa_entrega === 0 ? "🎉 Entrega grátis" : `Entrega R$ ${loja.taxa_entrega.toFixed(2)}`}
            </p>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
            background: loja.aberto ? "rgba(34,197,94,0.12)" : "#F3F4F6",
            color: loja.aberto ? "#16a34a" : "#9CA3AF",
          }}>
            {loja.aberto ? "Aberto" : "Fechado"}
          </span>
        </div>

        {/* Category nav */}
        {categorias.length > 0 && (
          <div
            ref={tabsRef}
            style={{
              display: "flex", gap: 4, overflowX: "auto", padding: "0 16px 10px",
              maxWidth: 720, margin: "0 auto",
              scrollbarWidth: "none",
            }}
            className="cat-chips-wrap">
            {categorias.map(cat => {
              const ativo = catAtiva === cat.id
              return (
                <button
                  key={cat.id}
                  data-cat-tab={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  style={{
                    padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700,
                    whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.18s",
                    flexShrink: 0,
                    background: ativo ? "#DC2626" : "#F3F4F6",
                    color: ativo ? "white" : "#6B7280",
                    border: ativo ? "none" : "1px solid #E5E7EB",
                    boxShadow: ativo ? "0 2px 8px rgba(220,38,38,0.25)" : "none",
                  }}>
                  {cat.nome}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px" }}>

        {/* Store banner */}
        <div style={{ borderRadius: 16, marginBottom: 24, overflow: "hidden", border: "1px solid #E5E7EB" }}>
          {loja.logo_url ? (
            <div style={{ position: "relative" }}>
              <img src={loja.logo_url} alt={loja.nome} style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 20px" }}>
                <h1 style={{ color: "white", fontWeight: 900, fontSize: 22, marginBottom: 2 }}>{loja.nome}</h1>
                {loja.descricao && <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>{loja.descricao}</p>}
              </div>
            </div>
          ) : (
            <div style={{ padding: "20px 24px", background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{CAT_ICONS[loja.categoria]}</div>
              <h1 style={{ color: "#111827", fontWeight: 900, fontSize: 22, marginBottom: 4 }}>{loja.nome}</h1>
              {loja.descricao && <p style={{ color: "#6B7280", fontSize: 13 }}>{loja.descricao}</p>}
            </div>
          )}

          {/* Avaliação da loja */}
          {(loja as any).nota_media != null && (
            <div style={{
              padding: "12px 20px", borderTop: "1px solid #F3F4F6",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#fff",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span style={{ color: "#111827", fontWeight: 800, fontSize: 15 }}>{Number((loja as any).nota_media).toFixed(1)}</span>
                {(loja as any).total_avaliacoes > 0 && (
                  <span style={{ color: "#6B7280", fontSize: 13 }}>({(loja as any).total_avaliacoes} avaliações)</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 3 }}>
                {[1,2,3,4,5].map(s => {
                  const nota = Number((loja as any).nota_media)
                  const fill = nota >= s ? "#f59e0b" : nota >= s - 0.5 ? "url(#halfStar)" : "#E5E7EB"
                  return (
                    <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill={fill} stroke="none">
                      <defs>
                        <linearGradient id="halfStar"><stop offset="50%" stopColor="#f59e0b"/><stop offset="50%" stopColor="#E5E7EB"/></linearGradient>
                      </defs>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Fechado warning */}
        {!loja.aberto && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <p style={{ color: "#EF4444", fontWeight: 600, fontSize: 13 }}>⛔ Esta loja está fechada no momento</p>
          </div>
        )}

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
                  key={prod.id}
                  prod={prod}
                  loja={loja}
                  isMaisPedido={idx < 2}
                  qtd={prodQtd(prod.id)}
                  onOpen={() => { if (!user) { setLoginRequired(true); return }; setModalProd(prod) }}
                  onAdd={() => { if (!user) { setLoginRequired(true); return }; add({ id: prod.id, nome: prod.nome, preco: prod.preco, loja_id: loja.id, loja_nome: loja.nome }) }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Products by category */}
        {categorias.map(cat => {
          const prods = produtos.filter(p => p.categoria_id === cat.id)
          if (prods.length === 0) return null
          return (
            <div key={cat.id} ref={el => { sectionRefs.current[cat.id] = el }} data-cat-id={cat.id} style={{ marginBottom: 32, scrollMarginTop: 100 }}>
              <h2 style={{ color: "#111827", fontWeight: 800, fontSize: 17, marginBottom: 12, paddingTop: 4 }}>{cat.nome}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {prods.map(prod => (
                  <ProdutoRow
                    key={prod.id} prod={prod} loja={loja} qtd={prodQtd(prod.id)}
                    onOpen={() => { if (!user) { setLoginRequired(true); return }; setModalProd(prod) }}
                    onAdd={() => { if (!user) { setLoginRequired(true); return }; add({ id: prod.id, nome: prod.nome, preco: prod.preco, loja_id: loja.id, loja_nome: loja.nome }) }}
                    onRemove={() => remove(prod.id)}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {/* Sem categoria */}
        {semCategoria.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ color: "#111827", fontWeight: 800, fontSize: 17, marginBottom: 12 }}>Outros</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {semCategoria.map(prod => (
                <ProdutoRow
                  key={prod.id} prod={prod} loja={loja} qtd={prodQtd(prod.id)}
                  onOpen={() => { if (!user) { setLoginRequired(true); return }; setModalProd(prod) }}
                  onAdd={() => { if (!user) { setLoginRequired(true); return }; add({ id: prod.id, nome: prod.nome, preco: prod.preco, loja_id: loja.id, loja_nome: loja.nome }) }}
                  onRemove={() => remove(prod.id)}
                />
              ))}
            </div>
          </div>
        )}

        {produtos.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>🍽️</p>
            <p style={{ color: "#9CA3AF", fontWeight: 600 }}>Nenhum produto disponível</p>
          </div>
        )}
      </div>

      {/* Cart bar */}
      {cartCount > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60, padding: "12px 20px",
          background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)",
          borderTop: "1px solid #E5E7EB",
        }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <button onClick={() => router.push("/carrinho")} style={{
              width: "100%", padding: "14px 12px", borderRadius: 14, border: "none", cursor: "pointer",
              background: "#DC2626", color: "#111827", fontWeight: 800, fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 8,
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
        position: "relative",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}>

      {/* Foto quadrada */}
      <div style={{ aspectRatio: "1 / 1", position: "relative", background: "#F3F4F6", overflow: "hidden" }}>
        {prod.foto_url
          ? <img src={prod.foto_url} alt={prod.nome} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, background: "linear-gradient(135deg,rgba(249,115,22,0.12),rgba(249,115,22,0.04))" }}>🍽️</div>
        }
        {/* Badge Mais pedido */}
        {isMaisPedido && (
          <div style={{
            position: "absolute", top: 6, left: 6,
            background: "#DC2626", color: "white",
            fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 20,
            boxShadow: "0 1px 4px rgba(220,38,38,0.4)",
          }}>
            + pedido
          </div>
        )}
        {/* Badge qtd no carrinho */}
        {qtd > 0 && (
          <div style={{
            position: "absolute", top: 6, right: 6,
            background: "#DC2626", color: "white",
            width: 20, height: 20, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 800,
            boxShadow: "0 1px 4px rgba(220,38,38,0.4)",
          }}>
            {qtd}
          </div>
        )}
      </div>

      {/* Texto */}
      <div style={{ padding: "8px 9px 10px" }}>
        <p style={{
          color: "#111827", fontWeight: 600, fontSize: 12, lineHeight: 1.35, marginBottom: 5,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {prod.nome}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
          <p style={{ color: "#DC2626", fontWeight: 800, fontSize: 12 }}>R$ {prod.preco.toFixed(2)}</p>
          {loja.aberto && (
            <button
              onClick={e => { e.stopPropagation(); onAdd() }}
              style={{
                width: 22, height: 22, borderRadius: 6, border: "none",
                background: "#DC2626", color: "white", fontSize: 16, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
              +
            </button>
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

      {/* Foto */}
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
          }}>
            {prod.descricao}
          </p>
        )}
        <p style={{ color: "#DC2626", fontWeight: 700, fontSize: 14 }}>R$ {prod.preco.toFixed(2)}</p>
      </div>

      {/* Qty controls (stop propagation to not open modal) */}
      {loja.aberto ? (
        qtd === 0 ? (
          <button
            onClick={e => { e.stopPropagation(); onOpen() }}
            style={{
              width: 36, height: 36, borderRadius: 10, border: "2px solid #DC2626",
              background: "transparent", color: "#DC2626", fontSize: 22, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
            +
          </button>
        ) : (
          <div
            onClick={e => e.stopPropagation()}
            style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button onClick={onRemove} style={{
              width: 30, height: 30, borderRadius: 8, border: "1px solid #E5E7EB",
              background: "transparent", color: "#111827", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>−</button>
            <span style={{ color: "#111827", fontWeight: 700, minWidth: 16, textAlign: "center" }}>{qtd}</span>
            <button onClick={onAdd} style={{
              width: 30, height: 30, borderRadius: 8, border: "none",
              background: "#DC2626", color: "#111827", fontSize: 18, cursor: "pointer",
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
