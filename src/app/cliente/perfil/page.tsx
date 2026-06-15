"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useClienteAuth } from "@/lib/auth-cliente"
import { useCart } from "@/lib/cart"
import { supabase } from "@/lib/supabase"

const inp: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
  background: "#F9FAFB", border: "1px solid #E5E7EB",
  color: "#111827", outline: "none", boxSizing: "border-box",
}

const STATUS_LABEL: Record<string, { emoji: string; color: string }> = {
  pendente:   { emoji: "⏳", color: "#f59e0b" },
  aceito:     { emoji: "✅", color: "#22c55e" },
  preparando: { emoji: "👨‍🍳", color: "#60a5fa" },
  pronto:     { emoji: "📦", color: "#a78bfa" },
  coletado:   { emoji: "🛵", color: "#DC2626" },
  entregue:   { emoji: "🎉", color: "#22c55e" },
  cancelado:  { emoji: "❌", color: "#f87171" },
}

export default function ClientePerfilPage() {
  const router  = useRouter()
  const { add } = useCart()
  const { user, perfil, loading, salvarPerfil, logout } = useClienteAuth()

  const [nome,          setNome]         = useState("")
  const [telefone,      setTelefone]     = useState("")
  const [endRua,        setEndRua]       = useState("")
  const [endNumero,     setEndNumero]    = useState("")
  const [endCompl,      setEndCompl]     = useState("")
  const [endBairro,     setEndBairro]    = useState("")
  const [endCep,        setEndCep]       = useState("")
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
      setEndRua(perfil.endereco_rua ?? "")
      setEndNumero(perfil.endereco_numero ?? "")
      setEndCompl(perfil.endereco_complemento ?? "")
      setEndBairro(perfil.endereco_bairro ?? "")
      setEndCep(perfil.endereco_cep ?? "")
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
    await salvarPerfil(nome, telefone, {
      rua: endRua, numero: endNumero, complemento: endCompl,
      bairro: endBairro, cep: endCep,
    })
    if (endRua && endNumero) {
      const addr = [endRua, endNumero, endBairro].filter(Boolean).join(", ")
      if (typeof window !== "undefined") localStorage.setItem("arago_last_address", addr)
    }
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
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#9CA3AF" }}>Carregando...</p>
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Nav */}
      <nav style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/" style={{ color: "#9CA3AF", fontSize: 20, textDecoration: "none" }}>←</Link>
        <p style={{ color: "#DC2626", fontWeight: 900, fontSize: 16, flex: 1 }}>Meu perfil</p>
        <button onClick={handleLogout} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
          Sair
        </button>
      </nav>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "28px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Avatar + email */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            background: "linear-gradient(135deg, rgba(220,38,38,0.1), rgba(220,38,38,0.05))",
            border: "2px solid rgba(220,38,38,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            )}
          </div>
          <div>
            <p style={{ color: "#111827", fontWeight: 800, fontSize: 17 }}>{nome || "Meu perfil"}</p>
            <p style={{ color: "#9CA3AF", fontSize: 13 }}>{user?.email}</p>
          </div>
        </div>

        {/* Dados pessoais */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>Dados pessoais</p>
          <div>
            <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Nome</label>
            <input style={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" />
          </div>
          <div>
            <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              WhatsApp
              <span style={{ color: "#9CA3AF", marginLeft: 6, fontWeight: 400 }}>(código de rastreamento)</span>
            </label>
            <input style={inp} value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(64) 9 9999-1234" inputMode="tel" />
          </div>
          <button onClick={handleSalvar} disabled={salvando} style={{
            padding: "12px", borderRadius: 12, border: "none",
            background: salvo ? "#22c55e" : salvando ? "rgba(220,38,38,0.4)" : "#DC2626",
            color: "white", fontWeight: 800, fontSize: 14, cursor: salvando ? "not-allowed" : "pointer",
          }}>
            {salvo ? "✓ Salvo!" : salvando ? "Salvando..." : "Salvar dados"}
          </button>
        </div>

        {/* Endereço de entrega */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>📍 Endereço de entrega</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>CEP</label>
              <input style={inp} value={endCep} onChange={e => setEndCep(e.target.value)} placeholder="74000-000" inputMode="numeric" />
            </div>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Rua / Avenida</label>
              <input style={inp} value={endRua} onChange={e => setEndRua(e.target.value)} placeholder="Rua das Flores" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Número</label>
              <input style={inp} value={endNumero} onChange={e => setEndNumero(e.target.value)} placeholder="42" inputMode="numeric" />
            </div>
            <div>
              <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Complemento</label>
              <input style={inp} value={endCompl} onChange={e => setEndCompl(e.target.value)} placeholder="Apto 3, casa dos fundos..." />
            </div>
          </div>
          <div>
            <label style={{ display: "block", color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Bairro</label>
            <input style={inp} value={endBairro} onChange={e => setEndBairro(e.target.value)} placeholder="Centro" />
          </div>
          <button onClick={handleSalvar} disabled={salvando} style={{
            padding: "12px", borderRadius: 12, border: "none",
            background: salvo ? "#22c55e" : salvando ? "rgba(220,38,38,0.4)" : "#DC2626",
            color: "white", fontWeight: 800, fontSize: 14, cursor: salvando ? "not-allowed" : "pointer",
          }}>
            {salvo ? "✓ Endereço salvo!" : salvando ? "Salvando..." : "Salvar endereço"}
          </button>
        </div>

        {/* Pedidos */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>📦 Meus pedidos</p>
            {pedidos.length > 0 && (
              <span style={{ color: "#9CA3AF", fontSize: 12 }}>{pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            {loadingPedidos ? (
              <p style={{ color: "#9CA3AF", fontSize: 13, padding: "4px 0" }}>Carregando...</p>
            ) : pedidos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>📭</p>
                <p style={{ color: "#9CA3AF", fontSize: 13 }}>Nenhum pedido ainda</p>
              </div>
            ) : pedidos.map(p => {
              const st = STATUS_LABEL[p.status] ?? { emoji: "●", color: "#DC2626" }
              const isOpen = expandido === p.id
              const itens  = (p.itens ?? []) as any[]
              const loja   = (p.loja as any)

              return (
                <div key={p.id} style={{ borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                  <div
                    onClick={() => setExpandido(isOpen ? null : p.id)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", cursor: "pointer" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <p style={{ color: "#111827", fontSize: 14, fontWeight: 800 }}>#{p.codigo}</p>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}30` }}>
                          {st.emoji} {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </span>
                      </div>
                      <p style={{ color: "#6B7280", fontSize: 12 }}>
                        {loja?.nome ?? "—"} · {new Date(p.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: "#DC2626", fontWeight: 800, fontSize: 15 }}>R$ {p.total.toFixed(2)}</p>
                      <p style={{ color: "#D1D5DB", fontSize: 11, marginTop: 2 }}>{isOpen ? "▲" : "▼"}</p>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ borderTop: "1px solid #e5e7eb", padding: "12px 14px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: 10 }}>
                      {itens.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {itens.map((i: any, idx: number) => (
                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                              <span style={{ color: "#374151" }}>{i.quantidade}× {i.nome}</span>
                              <span style={{ color: "#9CA3AF" }}>R$ {(i.preco * i.quantidade).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <p style={{ color: "#9CA3AF", fontSize: 12 }}>📍 {p.endereco_entrega}</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        {p.status !== "entregue" && p.status !== "cancelado" && (
                          <Link href={`/pedido/${p.codigo}`} style={{
                            flex: 1, padding: "9px", borderRadius: 10,
                            background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)",
                            color: "#DC2626", fontWeight: 700, fontSize: 13, textDecoration: "none", textAlign: "center",
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
          background: "#DC2626", color: "white", fontWeight: 800, fontSize: 14, textDecoration: "none",
        }}>
          🍽️ Fazer um pedido
        </Link>
      </div>
    </div>
  )
}
