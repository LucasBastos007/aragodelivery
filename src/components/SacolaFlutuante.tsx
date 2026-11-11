"use client"

// Atalho da sacola fora da loja (31/10/2026). Antes a sacola só aparecia dentro da loja dos
// itens: o cliente ia ver outra loja ou voltava pro início e não achava mais o pedido.
import { useRouter } from "next/navigation"
import { useCart } from "@/lib/cart"
import { descontoPromo } from "@/lib/promoChego"
import { usePromoUsados } from "@/components/cliente/PrecoPromo"

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export function SacolaFlutuante({ acimaDoMenu = false }: { acimaDoMenu?: boolean }) {
  const router = useRouter()
  const { items, total: bruto, count } = useCart()
  const promoUsados = usePromoUsados()
  if (!count) return null
  // Já com a promoção Chegô 10%, igual à sacola
  const total = bruto - descontoPromo(items.map(i => ({ produto_id: i.produto_id ?? i.id, preco: i.preco, quantidade: i.quantidade })), promoUsados).total
  const loja = items[0]?.loja_nome ?? "Sacola"
  return (
    <>
      <div aria-hidden style={{ height: acimaDoMenu ? 76 : 90 }} />
      <button onClick={() => router.push("/carrinho")} aria-label={`Ver sacola de ${loja}, ${count} ${count === 1 ? "item" : "itens"}, ${brl(total)}`} style={{
        position: "fixed", left: 12, right: 12, zIndex: 99, margin: "0 auto", maxWidth: 536,
        bottom: acimaDoMenu ? "calc(env(safe-area-inset-bottom, 0px) + 74px)" : "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        height: 58, border: 0, borderRadius: 16, background: "#D7261E", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 18px",
        boxShadow: "0 10px 24px rgba(215,38,30,.35)", fontFamily: "var(--font-corpo), system-ui, sans-serif", cursor: "pointer",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ background: "rgba(255,255,255,.22)", borderRadius: 8, padding: "3px 9px", fontWeight: 800, fontSize: 15 }}>{count}</span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0, lineHeight: 1.15 }}>
            <b style={{ fontSize: 16 }}>Ver sacola</b>
            <small style={{ fontSize: 12, opacity: .9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{loja}</small>
          </span>
        </span>
        <b style={{ fontSize: 16, whiteSpace: "nowrap" }}>{brl(total)}</b>
      </button>
    </>
  )
}
