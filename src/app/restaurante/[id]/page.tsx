"use client"

import { useEffect, useRef, useState } from "react"
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
          background: "#141414", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 520,
          border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden",
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
            background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)",
            color: "white", fontSize: 18, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 10,
          }}>
          ✕
        </button>

        <div style={{ padding: "20px 22px 28px" }}>
          {/* Info */}
          <p style={{ color: "white", fontWeight: 900, fontSize: 20, marginBottom: 6, lineHeight: 1.2 }}>{prod.nome}</p>
          {prod.descricao && (
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 1.55, marginBottom: 14 }}>
              {prod.descricao}
            </p>
          )}
          <p style={{ color: "#f97316", fontWeight: 800, fontSize: 20, marginBottom: 24 }}>
            R$ {prod.preco.toFixed(2)}
          </p>

          {/* Qty + button */}
          {loja.aberto ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* Counter */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "8px 14px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <button
                  onClick={() => setQty(q => Math.max(qtdInCart > 0 ? 0 : 1, q - 1))}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: "none",
                    background: qty <= (qtdInCart > 0 ? 0 : 1) ? "rgba(255,255,255,0.06)" : "rgba(249,115,22,0.2)",
                    color: qty <= (qtdInCart > 0 ? 0 : 1) ? "rgba(255,255,255,0.25)" : "#f97316",
                    fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  −
                </button>
                <span style={{ color: "white", fontWeight: 800, fontSize: 18, minWidth: 24, textAlign: "center" }}>{qty}</span>
                <button
                  onClick={() => setQty(q => q + 1)}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: "none",
                    background: "rgba(249,115,22,0.2)", color: "#f97316",
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
                  background: qty === qtdInCart ? "rgba(249,115,22,0.3)" : "#f97316",
                  color: "white", fontWeight: 800, fontSize: 14, cursor: qty === qtdInCart ? "not-allowed" : "pointer",
                }}>
                {qty === 0 && qtdInCart > 0 ? "🗑 Remover do carrinho" : btnLabel}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "12px", borderRadius: 12, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)" }}>
              <p style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>⛔ Loja fechada no momento</p>
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

  const semCategoria   = produtos.filter(p => !p.categoria_id)
  const lojaItensCart  = items.filter(i => i.loja_id === id)
  const cartTotal      = lojaItensCart.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const cartCount      = lojaItensCart.reduce((s, i) => s + i.quantidade, 0)

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando cardápio...</p>
    </div>
  )

  if (!loja) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 40 }}>😕</p>
      <p style={{ color: "rgba(255,255,255,0.5)" }}>Loja não encontrada</p>
      <Link href="/" style={{ color: "#f97316" }}>← Ver todas as lojas</Link>
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingBottom: cartCount > 0 ? 90 : 0 }}>

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
            background: "#141414", borderRadius: 24, padding: "32px 28px", maxWidth: 360, width: "100%",
            border: "1px solid rgba(255,255,255,0.08)", textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
            <h2 style={{ color: "white", fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Faça login para pedir</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Para adicionar itens ao carrinho você precisa estar logado.
            </p>
            <Link href={`/cliente/entrar?next=/restaurante/${id}`} style={{
              display: "block", padding: "14px", borderRadius: 12, background: "#f97316",
              color: "white", fontWeight: 800, fontSize: 15, textDecoration: "none", marginBottom: 10,
            }}>
              Entrar / Criar conta →
            </Link>
            <button onClick={() => setLoginRequired(false)} style={{
              width: "100%", padding: "12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent", color: "rgba(255,255,255,0.35)", fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}>
              Continuar navegando
            </button>
          </div>
        </div>
      )}

      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#0d0d0d", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ color: "rgba(255,255,255,0.4)", fontSize: 20, textDecoration: "none", lineHeight: 1 }}>←</Link>
          <div style={{ flex: 1 }}>
            <p style={{ color: "white", fontWeight: 800, fontSize: 15 }}>{loja.nome}</p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
              {loja.tempo_min}–{loja.tempo_max} min ·{" "}
              {loja.taxa_entrega === 0 ? "🎉 Entrega grátis" : `Entrega R$ ${loja.taxa_entrega.toFixed(2)}`}
            </p>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
            background: loja.aberto ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
            color: loja.aberto ? "#22c55e" : "rgba(255,255,255,0.3)",
          }}>
            {loja.aberto ? "Aberto" : "Fechado"}
          </span>
        </div>

        {/* Category nav */}
        {categorias.length > 0 && (
          <div style={{ display: "flex", gap: 2, overflowX: "auto", padding: "0 20px 10px", maxWidth: 720, margin: "0 auto" }}>
            {categorias.map(cat => (
              <button key={cat.id} onClick={() => scrollToCategory(cat.id)} style={{
                padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.15s", border: "none",
                background: catAtiva === cat.id ? "#f97316" : "transparent",
                color: catAtiva === cat.id ? "white" : "rgba(255,255,255,0.4)",
              }}>
                {cat.nome}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px" }}>

        {/* Store banner */}
        <div style={{ borderRadius: 16, marginBottom: 24, overflow: "hidden", border: "1px solid rgba(249,115,22,0.15)" }}>
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
              <h1 style={{ color: "white", fontWeight: 900, fontSize: 22, marginBottom: 4 }}>{loja.nome}</h1>
              {loja.descricao && <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{loja.descricao}</p>}
            </div>
          )}
        </div>

        {/* Fechado warning */}
        {!loja.aberto && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <p style={{ color: "#f87171", fontWeight: 600, fontSize: 13 }}>⛔ Esta loja está fechada no momento</p>
          </div>
        )}

        {/* Products by category */}
        {categorias.map(cat => {
          const prods = produtos.filter(p => p.categoria_id === cat.id)
          if (prods.length === 0) return null
          return (
            <div key={cat.id} ref={el => { sectionRefs.current[cat.id] = el }} style={{ marginBottom: 32 }}>
              <h2 style={{ color: "white", fontWeight: 800, fontSize: 17, marginBottom: 12, paddingTop: 4 }}>{cat.nome}</h2>
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
            <h2 style={{ color: "white", fontWeight: 800, fontSize: 17, marginBottom: 12 }}>Outros</h2>
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
            <p style={{ color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>Nenhum produto disponível</p>
          </div>
        )}
      </div>

      {/* Cart bar */}
      {cartCount > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60, padding: "12px 20px",
          background: "rgba(10,10,10,0.85)", backdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <button onClick={() => router.push("/carrinho")} style={{
              width: "100%", padding: "14px 20px", borderRadius: 14, border: "none", cursor: "pointer",
              background: "#f97316", color: "white", fontWeight: 800, fontSize: 15,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ background: "rgba(255,255,255,0.2)", borderRadius: 8, padding: "2px 10px", fontSize: 13, fontWeight: 700 }}>
                {cartCount} {cartCount === 1 ? "item" : "itens"}
              </span>
              <span>Ver carrinho →</span>
              <span>R$ {cartTotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}
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
        borderRadius: 12, background: "#111", border: "1px solid rgba(255,255,255,0.06)",
        transition: "border-color 0.15s", cursor: loja.aberto ? "pointer" : "default",
      }}
      onMouseEnter={e => { if (loja.aberto) e.currentTarget.style.borderColor = "rgba(249,115,22,0.3)" }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)" }}>

      {/* Foto */}
      {prod.foto_url && (
        <div style={{ width: 76, height: 76, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
          <img src={prod.foto_url} alt={prod.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "white", fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{prod.nome}</p>
        {prod.descricao && (
          <p style={{
            color: "rgba(255,255,255,0.35)", fontSize: 12, lineHeight: 1.4, marginBottom: 6,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {prod.descricao}
          </p>
        )}
        <p style={{ color: "#f97316", fontWeight: 700, fontSize: 14 }}>R$ {prod.preco.toFixed(2)}</p>
      </div>

      {/* Qty controls (stop propagation to not open modal) */}
      {loja.aberto ? (
        qtd === 0 ? (
          <button
            onClick={e => { e.stopPropagation(); onOpen() }}
            style={{
              width: 36, height: 36, borderRadius: 10, border: "2px solid #f97316",
              background: "transparent", color: "#f97316", fontSize: 22, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
            +
          </button>
        ) : (
          <div
            onClick={e => e.stopPropagation()}
            style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button onClick={onRemove} style={{
              width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
              background: "transparent", color: "white", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>−</button>
            <span style={{ color: "white", fontWeight: 700, minWidth: 16, textAlign: "center" }}>{qtd}</span>
            <button onClick={onAdd} style={{
              width: 32, height: 32, borderRadius: 8, border: "none",
              background: "#f97316", color: "white", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>+</button>
          </div>
        )
      ) : (
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, flexShrink: 0 }}>Fechado</span>
      )}
    </div>
  )
}
