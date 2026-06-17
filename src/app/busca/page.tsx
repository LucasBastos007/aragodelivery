"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { MobileBottomNav } from "@/components/MobileBottomNav"
import type { Loja, CategoriaLoja } from "@/types"

const CATEGORIAS: { cat: CategoriaLoja; label: string; sub: string; overlay: string; color: string; photo: string }[] = [
  {
    cat: "Restaurante", label: "Restaurantes", sub: "Hambúrguer, pizza, marmita…",
    overlay: "linear-gradient(145deg, rgba(180,50,0,0.78) 0%, rgba(100,20,0,0.52) 100%)",
    color: "#FF6B00",
    photo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&h=300&q=82",
  },
  {
    cat: "Mercadinho", label: "Mercados", sub: "Hortifruti, bebidas, higiene…",
    overlay: "linear-gradient(145deg, rgba(5,80,35,0.78) 0%, rgba(0,50,20,0.52) 100%)",
    color: "#16a34a",
    photo: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&h=300&q=82",
  },
  {
    cat: "Farmácia", label: "Farmácias", sub: "Remédios, perfumaria, cuidados…",
    overlay: "linear-gradient(145deg, rgba(15,50,170,0.78) 0%, rgba(5,30,130,0.52) 100%)",
    color: "#2563eb",
    photo: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&h=300&q=82",
  },
  {
    cat: "Outros", label: "Outros", sub: "Massas, lanches e mais…",
    overlay: "linear-gradient(145deg, rgba(70,15,150,0.78) 0%, rgba(50,5,120,0.52) 100%)",
    color: "#7c3aed",
    photo: "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=600&h=300&q=82",
  },
]

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  Restaurante: { bg: "rgba(255,107,0,0.1)", text: "#E55A00" },
  Mercadinho:  { bg: "rgba(22,163,74,0.1)",  text: "#16a34a" },
  "Farmácia":  { bg: "rgba(37,99,235,0.1)",  text: "#2563eb" },
  Outros:      { bg: "rgba(124,58,237,0.1)", text: "#7c3aed" },
}

export default function BuscaPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busca,   setBusca]   = useState("")
  const [filtro,  setFiltro]  = useState<string | null>(null)
  const [lojas,   setLojas]   = useState<Loja[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!busca && !filtro) { setLojas([]); return }
    setLoading(true)
    let q = supabase.from("lojas").select("*").eq("status", "ativo")
    if (filtro) q = q.eq("categoria", filtro)
    if (busca)  q = q.ilike("nome", `%${busca}%`)
    q.order("aberto", { ascending: false }).order("nome")
      .then(({ data }) => { setLojas((data as Loja[]) ?? []); setLoading(false) })
  }, [busca, filtro])

  const mostraResultados = !!(busca || filtro)

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", paddingBottom: 80, overflowX: "hidden" }}>

      {/* Header fixo */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "white", borderBottom: "1px solid #f0f0f0",
        padding: "14px 16px 12px",
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
      }}>
        <p style={{ color: "#111827", fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Busca</p>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#F3F4F6", borderRadius: 12, padding: "10px 14px",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Restaurante, mercado, farmácia..."
            style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15, color: "#374151" }}
          />
          {busca && (
            <button onClick={() => setBusca("")} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>
              ✕
            </button>
          )}
        </div>

        {/* Chips de categoria */}
        {(busca || filtro) && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto", paddingBottom: 2 }}>
            <button
              onClick={() => setFiltro(null)}
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: !filtro ? "#DC2626" : "#F3F4F6",
                color: !filtro ? "white" : "#6B7280",
                border: "none", cursor: "pointer", flexShrink: 0,
              }}>
              Todas
            </button>
            {CATEGORIAS.map(c => (
              <button key={c.cat}
                onClick={() => setFiltro(f => f === c.cat ? null : c.cat)}
                style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: filtro === c.cat ? c.color : "#F3F4F6",
                  color: filtro === c.cat ? "white" : "#6B7280",
                  border: "none", cursor: "pointer", flexShrink: 0,
                }}>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      {!mostraResultados ? (
        /* Grade de categorias */
        <div style={{ padding: "20px 16px" }}>
          <p style={{ color: "#374151", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
            O que você procura?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {CATEGORIAS.map(c => (
              <button
                key={c.cat}
                onClick={() => setFiltro(c.cat)}
                style={{
                  position: "relative", height: 130, borderRadius: 18, overflow: "hidden",
                  border: "none", cursor: "pointer", padding: 0,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
                }}>
                {/* Foto real */}
                <img
                  src={c.photo}
                  alt={c.label}
                  style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%", objectFit: "cover",
                    display: "block",
                  }}
                />
                {/* Overlay colorido para legibilidade */}
                <div style={{ position: "absolute", inset: 0, background: c.overlay }} />
                {/* Texto */}
                <div style={{ position: "relative", zIndex: 1, padding: "14px 14px", textAlign: "left", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <p style={{ color: "white", fontWeight: 900, fontSize: 15, lineHeight: 1.15, marginBottom: 3, textShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>{c.label}</p>
                  <p style={{ color: "rgba(255,255,255,0.88)", fontSize: 10, lineHeight: 1.3, fontWeight: 500, textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>{c.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : loading ? (
        <div style={{ padding: "48px 16px", textAlign: "center" }}>
          <p style={{ color: "#9CA3AF", fontSize: 14 }}>Buscando...</p>
        </div>
      ) : lojas.length === 0 ? (
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🔍</p>
          <p style={{ color: "#374151", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Nenhuma loja encontrada</p>
          <p style={{ color: "#9CA3AF", fontSize: 13 }}>Tente outro nome ou categoria</p>
        </div>
      ) : (
        <div style={{ padding: "8px 0" }}>
          <p style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 600, padding: "8px 16px 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {lojas.length} resultado{lojas.length !== 1 ? "s" : ""}
          </p>
          {lojas.map(loja => {
            const sc = STATUS_COLOR[loja.categoria] ?? STATUS_COLOR["Outros"]
            return (
              <Link key={loja.id} href={`/restaurante/${loja.id}`} style={{ textDecoration: "none" }}>
                <div style={{
                  background: "white", display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", borderBottom: "1px solid #f3f4f6",
                  opacity: loja.aberto ? 1 : 0.55,
                }}>
                  <div style={{ width: 68, height: 68, borderRadius: 14, overflow: "hidden", flexShrink: 0, background: sc.bg }}>
                    {loja.logo_url
                      ? <img src={loja.logo_url} alt={loja.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                          {{ Restaurante: "🍔", Mercadinho: "🛒", "Farmácia": "💊", Outros: "📦" }[loja.categoria] ?? "📦"}
                        </div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <p style={{ color: "#1a1a1a", fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{loja.nome}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: loja.aberto ? "rgba(34,197,94,0.12)" : "rgba(0,0,0,0.06)", color: loja.aberto ? "#16a34a" : "#9ca3af", flexShrink: 0 }}>
                        {loja.aberto ? "Aberto" : "Fechado"}
                      </span>
                    </div>
                    {loja.descricao && (
                      <p style={{ color: "#6B7280", fontSize: 12, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{loja.descricao}</p>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9CA3AF" }}>
                      <span>{loja.tempo_min}–{loja.tempo_max} min</span>
                      <span>·</span>
                      <span style={{ color: loja.taxa_entrega === 0 ? "#16a34a" : "#9CA3AF", fontWeight: loja.taxa_entrega === 0 ? 700 : 400 }}>
                        {loja.taxa_entrega === 0 ? "Grátis" : `R$ ${loja.taxa_entrega.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <MobileBottomNav />
    </div>
  )
}
