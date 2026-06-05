"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useClienteAuth } from "@/lib/auth-cliente"
import { useCart } from "@/lib/cart"
import { supabase } from "@/lib/supabase"

const inp: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  color: "white", outline: "none", boxSizing: "border-box",
}

const STATUS_LABEL: Record<string, { emoji: string; color: string }> = {
  pendente:   { emoji: "⏳", color: "#f59e0b" },
  aceito:     { emoji: "✅", color: "#22c55e" },
  preparando: { emoji: "👨‍🍳", color: "#60a5fa" },
  pronto:     { emoji: "📦", color: "#a78bfa" },
  coletado:   { emoji: "🛵", color: "#f97316" },
  entregue:   { emoji: "🎉", color: "#22c55e" },
  cancelado:  { emoji: "❌", color: "#f87171" },
}

export default function ClientePerfilPage() {
  const router  = useRouter()
  const { add } = useCart()
  const { user, perfil, loading, salvarPerfil, logout } = useClienteAuth()

  const [nome,     setNome]     = useState("")
  const [telefone, setTelefone] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [salvo,    setSalvo]    = useState(false)
  const [pedidos,  setPedidos]  = useState<any[]>([])
  const [loadingPedidos, setLoadingPedidos] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [reordenadoId, setReordenadoId] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push("/cliente/entrar")
  }, [user, loading, router])

  useEffect(() => {
    if (perfil) {
      setNome(perfil.nome ?? "")
      setTelefone(perfil.telefone ?? "")
    } else if (user) {
      setNome(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "")
    }
  }, [perfil, user])

  useEffect(() => {
    if (!user) return
    setLoadingPedidos(true)
    supabase
      .from("pedidos")
      .select("*, loja:lojas(id, nome), itens:itens_pedido(*)")
      .eq("cliente_id", user.id)
      .order("criado_em", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPedidos(data)
          setLoadingPedidos(false)
          return
        }
        // Fallback: busca pelo último 4 dígitos do telefone
        const tel = perfil?.telefone ?? ""
        const digits = tel.replace(/\D/g, "")
        const codigo = digits.length >= 4 ? digits.slice(-4) : null
        if (!codigo) { setLoadingPedidos(false); return }
        supabase
          .from("pedidos")
          .select("*, loja:lojas(id, nome), itens:itens_pedido(*)")
          .ilike("codigo", `%${codigo}%`)
          .order("criado_em", { ascending: false })
          .limit(20)
          .then(({ data: d2 }) => { setPedidos(d2 ?? []); setLoadingPedidos(false) })
      })
  }, [user, perfil])

  async function handleSalvar() {
    setSalvando(true)
    await salvarPerfil(nome, telefone)
    setSalvando(false)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  async function handleLogout() {
    await logout()
    router.push("/")
  }

  async function handleReorder(pedido: any) {
    const loja = pedido.loja
    const itens = pedido.itens ?? []
    if (!loja || itens.length === 0) return
    setReordenadoId(pedido.id)
    for (const item of itens) {
      for (let i = 0; i < item.quantidade; i++) {
        add({ id: item.produto_id ?? item.id, nome: item.nome, preco: item.preco, loja_id: loja.id, loja_nome: loja.nome })
      }
    }
    setTimeout(() => {
      setReordenadoId(null)
      router.push(`/restaurante/${loja.id}`)
    }, 600)
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando...</p>
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>
      {/* Nav */}
      <nav style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/" style={{ color: "rgba(255,255,255,0.35)", fontSize: 20, textDecoration: "none" }}>←</Link>
        <p style={{ color: "#f97316", fontWeight: 900, fontSize: 16, flex: 1 }}>🛵 Meu perfil</p>
        <button onClick={handleLogout} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
          Sair
        </button>
      </nav>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "28px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Avatar + email */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.08))",
            border: "2px solid rgba(249,115,22,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 26 }}>👤</span>
            )}
          </div>
          <div>
            <p style={{ color: "white", fontWeight: 800, fontSize: 17 }}>{nome || "Meu perfil"}</p>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>{user?.email}</p>
          </div>
        </div>

        {/* Dados pessoais */}
        <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", padding: "18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>👤 Dados pessoais</p>
          <div>
            <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Nome</label>
            <input style={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" />
          </div>
          <div>
            <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              WhatsApp
              <span style={{ color: "rgba(249,115,22,0.5)", marginLeft: 6, fontWeight: 400 }}>(código de rastreamento)</span>
            </label>
            <input style={inp} value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(64) 9 9999-1234" inputMode="tel" />
          </div>
          <button onClick={handleSalvar} disabled={salvando} style={{
            padding: "12px", borderRadius: 12, border: "none",
            background: salvo ? "#22c55e" : salvando ? "rgba(249,115,22,0.4)" : "#f97316",
            color: "white", fontWeight: 800, fontSize: 14, cursor: salvando ? "not-allowed" : "pointer",
          }}>
            {salvo ? "✓ Salvo!" : salvando ? "Salvando..." : "Salvar dados"}
          </button>
        </div>

        {/* Pedidos */}
        <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>📦 Meus pedidos</p>
            {pedidos.length > 0 && (
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            {loadingPedidos ? (
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "4px 0" }}>Carregando...</p>
            ) : pedidos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>📭</p>
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Nenhum pedido ainda</p>
              </div>
            ) : pedidos.map(p => {
              const st = STATUS_LABEL[p.status] ?? { emoji: "●", color: "#f97316" }
              const isOpen = expandido === p.id
              const itens  = (p.itens ?? []) as any[]
              const loja   = (p.loja as any)

              return (
                <div key={p.id} style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  {/* Header do pedido */}
                  <div
                    onClick={() => setExpandido(isOpen ? null : p.id)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", cursor: "pointer" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <p style={{ color: "white", fontSize: 14, fontWeight: 800 }}>#{p.codigo}</p>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}30` }}>
                          {st.emoji} {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </span>
                      </div>
                      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                        {loja?.nome ?? "—"} · {new Date(p.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: "#f97316", fontWeight: 800, fontSize: 15 }}>R$ {p.total.toFixed(2)}</p>
                      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 2 }}>{isOpen ? "▲" : "▼"}</p>
                    </div>
                  </div>

                  {/* Expandido */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 14px", background: "rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", gap: 10 }}>
                      {/* Itens */}
                      {itens.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {itens.map((i: any, idx: number) => (
                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                              <span style={{ color: "rgba(255,255,255,0.6)" }}>{i.quantidade}× {i.nome}</span>
                              <span style={{ color: "rgba(255,255,255,0.35)" }}>R$ {(i.preco * i.quantidade).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Endereço */}
                      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>📍 {p.endereco_entrega}</p>

                      {/* Ações */}
                      <div style={{ display: "flex", gap: 8 }}>
                        {p.status !== "entregue" && p.status !== "cancelado" && (
                          <Link href={`/pedido/${p.codigo}`} style={{
                            flex: 1, padding: "9px", borderRadius: 10, background: "rgba(249,115,22,0.1)",
                            border: "1px solid rgba(249,115,22,0.25)", color: "#f97316",
                            fontWeight: 700, fontSize: 13, textDecoration: "none", textAlign: "center",
                          }}>
                            📍 Rastrear
                          </Link>
                        )}
                        {p.status === "entregue" && loja && itens.length > 0 && (
                          <button
                            onClick={() => handleReorder(p)}
                            disabled={reordenadoId === p.id}
                            style={{
                              flex: 1, padding: "9px", borderRadius: 10,
                              background: reordenadoId === p.id ? "rgba(34,197,94,0.2)" : "rgba(34,197,94,0.1)",
                              border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e",
                              fontWeight: 700, fontSize: 13, cursor: "pointer",
                            }}>
                            {reordenadoId === p.id ? "✓ Adicionado!" : "🔄 Pedir de novo"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <Link href="/" style={{
          display: "block", textAlign: "center", padding: "13px", borderRadius: 12,
          background: "#f97316", color: "white", fontWeight: 800, fontSize: 14, textDecoration: "none",
        }}>
          🍽️ Fazer um pedido
        </Link>
      </div>
    </div>
  )
}
