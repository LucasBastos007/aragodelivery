"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { Loja, CategoriaLoja } from "@/types"
import Link from "next/link"
import { useCart } from "@/lib/cart"
import { useClienteAuth } from "@/lib/auth-cliente"

const CAT_ICONS: Record<string, string> = {
  Restaurante: "🍽️", Mercadinho: "🛒", "Farmácia": "💊", Outros: "📦",
}
const CATEGORIAS: CategoriaLoja[] = ["Restaurante", "Mercadinho", "Farmácia", "Outros"]

export default function LojasPage() {
  const router = useRouter()
  const { count, total } = useCart()
  const { user, perfil } = useClienteAuth()
  const [lojas, setLojas] = useState<Loja[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState("Todas")
  const [busca, setBusca] = useState("")
  const [rastrear, setRastrear] = useState("")

  useEffect(() => {
    supabase.from("lojas").select("*").eq("status", "ativo").order("nome")
      .then(({ data }) => { setLojas((data as Loja[]) ?? []); setLoading(false) })
  }, [])

  const filtradas = lojas.filter(l => {
    const matchCat = filtro === "Todas" || l.categoria === filtro
    const matchBusca = l.nome.toLowerCase().includes(busca.toLowerCase())
    return matchCat && matchBusca
  })

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>
      {/* Navbar */}
      <nav style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" style={{ color: "#f97316", fontWeight: 900, fontSize: 18, textDecoration: "none", flexShrink: 0 }}>
            🛵 Arago
          </Link>

          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar restaurante..."
            style={{
              flex: 1, maxWidth: 300, padding: "9px 14px", borderRadius: 10, fontSize: 14, fontWeight: 500,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "white", outline: "none",
            }}
          />
          {/* Carrinho */}
          {count > 0 && (
            <Link href="/carrinho" style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
              background: "#f97316", color: "white", fontWeight: 800, fontSize: 13, textDecoration: "none", flexShrink: 0,
            }}>
              🛒 {count} · R$ {total.toFixed(2)}
            </Link>
          )}
          {/* Perfil / Login */}
          <Link href={user ? "/cliente/perfil" : "/cliente/entrar"} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: user ? "white" : "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 12,
            textDecoration: "none", flexShrink: 0,
          }}>
            {user ? (
              <>
                {user.user_metadata?.avatar_url
                  ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
                  : "👤"}
                {perfil?.nome?.split(" ")[0] ?? "Perfil"}
              </>
            ) : "Entrar"}
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>
        <h1 style={{ color: "white", fontWeight: 900, fontSize: 22, marginBottom: 16 }}>
          Lojas em Aragoiânia
        </h1>

        {/* Rastrear pedido */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20, background: "#111", borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>📍 Rastrear pedido:</span>
          <input
            value={rastrear}
            onChange={e => setRastrear(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && rastrear.trim() && router.push(`/pedido/${rastrear.trim()}`)}
            placeholder="Código (ex: 9234)"
            maxLength={8}
            style={{
              flex: 1, padding: "7px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "white", outline: "none", letterSpacing: 2,
            }}
          />
          <button
            onClick={() => rastrear.trim() && router.push(`/pedido/${rastrear.trim()}`)}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13,
              background: rastrear.trim() ? "#f97316" : "rgba(249,115,22,0.2)",
              color: rastrear.trim() ? "white" : "rgba(249,115,22,0.4)", cursor: rastrear.trim() ? "pointer" : "default",
            }}>
            Ir →
          </button>
        </div>

        {/* Category chips */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28, overflowX: "auto", paddingBottom: 4 }}>
          {["Todas", ...CATEGORIAS].map(c => (
            <button key={c} onClick={() => setFiltro(c)} style={{
              padding: "8px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600,
              whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.15s",
              background: filtro === c ? "#f97316" : "rgba(255,255,255,0.06)",
              color: filtro === c ? "white" : "rgba(255,255,255,0.45)",
              border: filtro === c ? "1px solid #f97316" : "1px solid rgba(255,255,255,0.08)",
            }}>
              {c === "Todas" ? "🏪 Todas" : `${CAT_ICONS[c]} ${c}`}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, height: 180, border: "1px solid rgba(255,255,255,0.06)", animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        ) : filtradas.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🔍</p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Nenhuma loja encontrada</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {filtradas.map(loja => (
              <Link key={loja.id} href={`/restaurante/${loja.id}`} style={{ textDecoration: "none" }}>
                <div style={{
                  background: "#111", borderRadius: 16, overflow: "hidden", cursor: "pointer",
                  border: "1px solid rgba(255,255,255,0.08)", transition: "transform 0.15s, border-color 0.15s",
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-3px)"
                    e.currentTarget.style.borderColor = "rgba(249,115,22,0.3)"
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateY(0)"
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"
                  }}>
                  {/* Banner */}
                  <div style={{
                    height: 90, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 42, background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    {CAT_ICONS[loja.categoria]}
                  </div>

                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                      <p style={{ color: "white", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{loja.nome}</p>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, marginLeft: 8, flexShrink: 0,
                        background: loja.aberto ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                        color: loja.aberto ? "#22c55e" : "rgba(255,255,255,0.3)",
                        border: loja.aberto ? "1px solid rgba(34,197,94,0.25)" : "1px solid transparent",
                      }}>
                        {loja.aberto ? "● Aberto" : "Fechado"}
                      </span>
                    </div>

                    {loja.descricao && (
                      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginBottom: 12, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {loja.descricao}
                      </p>
                    )}

                    <div style={{ display: "flex", gap: 10, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                      <span>🕐 {loja.tempo_min}–{loja.tempo_max} min</span>
                      <span>·</span>
                      <span style={{ color: loja.taxa_entrega === 0 ? "#22c55e" : "rgba(255,255,255,0.3)" }}>
                        {loja.taxa_entrega === 0 ? "🎉 Entrega grátis" : `Entrega R$ ${loja.taxa_entrega.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
