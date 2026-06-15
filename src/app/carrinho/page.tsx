"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useCart } from "@/lib/cart"
import type { Loja } from "@/types"

export default function CarrinhoPage() {
  const router = useRouter()
  const { items, add, remove, setQty, clear, total, count } = useCart()
  const [loja, setLoja] = useState<Loja | null>(null)

  const loja_id = items[0]?.loja_id ?? null

  useEffect(() => {
    if (!loja_id) return
    supabase.from("lojas").select("*").eq("id", loja_id).single()
      .then(({ data }) => setLoja(data as Loja))
  }, [loja_id])

  const taxa       = loja?.taxa_entrega ?? 0
  const totalFinal = total + taxa

  if (items.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 52 }}>🛒</p>
        <p style={{ color: "#111827", fontWeight: 800, fontSize: 18 }}>Seu carrinho está vazio</p>
        <p style={{ color: "#9CA3AF", fontSize: 14 }}>Adicione itens de uma loja para continuar</p>
        <Link href="/" style={{
          marginTop: 8, padding: "12px 24px", borderRadius: 12, background: "#DC2626",
          color: "white", fontWeight: 700, textDecoration: "none", fontSize: 14,
        }}>
          Ver lojas →
        </Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Nav */}
      <nav style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 20, cursor: "pointer" }}>←</button>
          <p style={{ color: "#111827", fontWeight: 800, fontSize: 16, flex: 1 }}>Meu carrinho</p>
          <span style={{ color: "#9CA3AF", fontSize: 13 }}>{count} {count === 1 ? "item" : "itens"}</span>
        </div>
      </nav>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Loja */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 2 }}>Pedido em</p>
            <p style={{ color: "#111827", fontWeight: 800, fontSize: 16 }}>{items[0]?.loja_nome}</p>
          </div>
          {loja_id && (
            <Link href={`/restaurante/${loja_id}`} style={{ color: "#DC2626", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              + Adicionar mais
            </Link>
          )}
        </div>

        {/* Itens */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          {items.map((item, i) => (
            <div key={item.id} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
              borderBottom: i < items.length - 1 ? "1px solid #F3F4F6" : "none",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "#111827", fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{item.nome}</p>
                <p style={{ color: "#DC2626", fontWeight: 700, fontSize: 13 }}>R$ {item.preco.toFixed(2)} / un.</p>
              </div>

              {/* Qty controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <button
                  onClick={() => remove(item.id)}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: "1px solid #E5E7EB",
                    background: item.quantidade === 1 ? "rgba(239,68,68,0.08)" : "transparent",
                    color: item.quantidade === 1 ? "#EF4444" : "#374151",
                    fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  −
                </button>
                <span style={{ color: "#111827", fontWeight: 800, fontSize: 16, minWidth: 20, textAlign: "center" }}>
                  {item.quantidade}
                </span>
                <button
                  onClick={() => add({ id: item.id, nome: item.nome, preco: item.preco, loja_id: item.loja_id, loja_nome: item.loja_nome })}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: "none",
                    background: "#DC2626", color: "white", fontSize: 18, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  +
                </button>
              </div>

              {/* Subtotal */}
              <p style={{ color: "#6B7280", fontWeight: 700, fontSize: 14, flexShrink: 0, minWidth: 64, textAlign: "right" }}>
                R$ {(item.preco * item.quantidade).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        {/* Limpar carrinho */}
        <button
          onClick={() => { if (confirm("Esvaziar carrinho?")) clear() }}
          style={{ background: "none", border: "none", color: "#D1D5DB", fontSize: 13, cursor: "pointer", textAlign: "left", padding: 0 }}>
          Esvaziar carrinho
        </button>

        {/* Resumo de valores */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ color: "#111827", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Resumo</p>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#6B7280" }}>
            <span>Subtotal</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#6B7280" }}>
            <span>Entrega</span>
            <span style={{ color: taxa === 0 ? "#16a34a" : undefined }}>
              {loja ? (taxa === 0 ? "🎉 Grátis" : `R$ ${taxa.toFixed(2)}`) : "—"}
            </span>
          </div>

          <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 800, color: "#111827" }}>
            <span>Total</span>
            <span>R$ {totalFinal.toFixed(2)}</span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => router.push("/checkout")}
          style={{
            width: "100%", padding: "16px", borderRadius: 14, border: "none",
            background: "#DC2626", color: "white", fontWeight: 800, fontSize: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
          <span style={{ background: "rgba(255,255,255,0.2)", borderRadius: 8, padding: "3px 10px", fontSize: 13 }}>
            {count} {count === 1 ? "item" : "itens"}
          </span>
          <span>Finalizar pedido →</span>
          <span>R$ {totalFinal.toFixed(2)}</span>
        </button>

        <Link href="/" style={{
          display: "block", textAlign: "center", padding: "12px",
          color: "#9CA3AF", fontSize: 14, fontWeight: 600, textDecoration: "none",
        }}>
          ← Continuar escolhendo
        </Link>
      </div>
    </div>
  )
}
