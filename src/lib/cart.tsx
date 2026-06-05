"use client"

import { createContext, useContext, useEffect, useState } from "react"

export type CartItem = {
  id: string
  nome: string
  preco: number
  quantidade: number
  loja_id: string
  loja_nome: string
}

type CartCtx = {
  items: CartItem[]
  add: (item: Omit<CartItem, "quantidade">) => void
  remove: (id: string) => void
  setQty: (id: string, qty: number) => void
  clear: () => void
  total: number
  count: number
}

const Ctx = createContext<CartCtx | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem("arago_cart")
      if (saved) setItems(JSON.parse(saved))
    } catch {}
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem("arago_cart", JSON.stringify(items))
  }, [items, ready])

  function add(item: Omit<CartItem, "quantidade">) {
    setItems(prev => {
      const exists = prev.find(i => i.id === item.id)
      if (exists) return prev.map(i => i.id === item.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      if (prev.length > 0 && prev[0].loja_id !== item.loja_id) {
        if (!confirm(`Seu carrinho tem itens de "${prev[0].loja_nome}". Limpar e começar pedido em "${item.loja_nome}"?`)) return prev
        return [{ ...item, quantidade: 1 }]
      }
      return [...prev, { ...item, quantidade: 1 }]
    })
  }

  function remove(id: string) {
    setItems(prev => {
      const item = prev.find(i => i.id === id)
      if (!item) return prev
      if (item.quantidade > 1) return prev.map(i => i.id === id ? { ...i, quantidade: i.quantidade - 1 } : i)
      return prev.filter(i => i.id !== id)
    })
  }

  function setQty(id: string, qty: number) {
    setItems(prev => {
      if (qty <= 0) return prev.filter(i => i.id !== id)
      return prev.map(i => i.id === id ? { ...i, quantidade: qty } : i)
    })
  }

  function clear() { setItems([]) }

  const total = items.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const count = items.reduce((s, i) => s + i.quantidade, 0)

  return <Ctx.Provider value={{ items, add, remove, setQty, clear, total, count }}>{children}</Ctx.Provider>
}

export function useCart() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useCart fora do CartProvider")
  return ctx
}
