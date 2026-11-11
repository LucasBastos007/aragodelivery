"use client"

// Faixa da tela inicial pra quem criou conta e ainda não pediu (31/10/2026): mostra o cupom
// de primeiro pedido (cupons.so_primeiro_pedido). Some depois do primeiro pedido.
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export function FaixaPrimeiroPedido({ telefone }: { telefone?: string | null }) {
  const [c, setC] = useState<{ codigo: string; minimo: number } | null>(null)
  const [copiado, setCopiado] = useState(false)
  useEffect(() => {
    const t = (telefone ?? "").replace(/\D/g, "")
    if (t.length < 10) { setC(null); return }
    supabase.auth.getSession().then(({ data }) => {
      const tk = data.session?.access_token; if (!tk) return null
      return fetch("/api/cupom/primeiro-pedido", { headers: { Authorization: `Bearer ${tk}` } }).then(r => r.ok ? r.json() : null)
    })
      .then(j => setC(j?.elegivel ? { codigo: j.codigo, minimo: j.minimo } : null)).catch(() => {})
  }, [telefone])
  if (!c) return null
  const copiar = () => { navigator.clipboard?.writeText(c.codigo).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) }).catch(() => {}) }
  return (
    <div role="note" style={{ margin: "10px 16px 0", padding: "12px 14px", borderRadius: 16, background: "#FFF4D6", border: "1px solid #F2D58A", display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">🎁</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.4, color: "#5C4300" }}>
        <b style={{ display: "block", fontSize: 15 }}>Seu primeiro pedido tem frete grátis!</b>
        Use <b>{c.codigo}</b>{c.minimo > 0 ? ` em pedidos a partir de R$ ${c.minimo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}. Um por casa, fora da zona rural.
      </span>
      <button onClick={copiar} style={{ flexShrink: 0, border: 0, borderRadius: 999, padding: "9px 14px", background: "#5C4300", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{copiado ? "Copiado!" : "Copiar"}</button>
    </div>
  )
}
