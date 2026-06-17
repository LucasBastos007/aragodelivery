"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useClienteAuth } from "@/lib/auth-cliente"
import { useCart } from "@/lib/cart"
import { supabase } from "@/lib/supabase"
import { MobileBottomNav } from "@/components/MobileBottomNav"

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

function fmtDataGrupo(iso: string) {
  const d = new Date(iso)
  const dia = DIAS[d.getDay()]
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
  return `${dia}, ${data}`
}

const STATUS_ANDAMENTO = ["pendente","aceito","preparando","pronto","aguardando_aceite","indo_para_loja","na_loja","em_rota","coletado"]

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pendente:         { label: "Aguardando loja",    color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  aceito:           { label: "Confirmado",          color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  preparando:       { label: "Preparando",          color: "#a855f7", bg: "rgba(168,85,247,0.1)" },
  pronto:           { label: "Pronto",              color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
  aguardando_aceite:{ label: "Aguardando motoboy",  color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  indo_para_loja:   { label: "Motoboy a caminho",   color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  na_loja:          { label: "Na loja",             color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  em_rota:          { label: "Em rota",             color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  coletado:         { label: "Saiu para entrega",   color: "#DC2626", bg: "rgba(220,38,38,0.1)"  },
  entregue:         { label: "Entregue",            color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
  cancelado:        { label: "Cancelado",           color: "#ef4444", bg: "rgba(239,68,68,0.1)"  },
}

type Aba = "andamento" | "finalizado" | "cancelado"

function EmptyState({ aba }: { aba: Aba }) {
  if (aba === "andamento") return (
    <div style={{ textAlign: "center", padding: "72px 24px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="38" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="2"/>
          {/* Relogio com seta de busca */}
          <circle cx="40" cy="38" r="18" stroke="#9CA3AF" strokeWidth="2.5" fill="white"/>
          <line x1="40" y1="28" x2="40" y2="38" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="40" y1="38" x2="48" y2="43" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="40" cy="38" r="2" fill="#DC2626"/>
          {/* Seta embaixo */}
          <path d="M 28 60 Q 40 66 52 60" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="3 2"/>
        </svg>
      </div>
      <p style={{ color: "#111827", fontWeight: 800, fontSize: 17, marginBottom: 6 }}>Nenhum pedido em andamento</p>
      <p style={{ color: "#9CA3AF", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
        Seus pedidos ativos aparecerão aqui em tempo real.
      </p>
      <Link href="/" style={{ display: "inline-block", padding: "13px 28px", borderRadius: 14, background: "#DC2626", color: "white", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
        Fazer pedido →
      </Link>
    </div>
  )

  if (aba === "finalizado") return (
    <div style={{ textAlign: "center", padding: "72px 24px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="38" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="2"/>
          {/* Sacola de compras */}
          <rect x="22" y="30" width="36" height="28" rx="5" fill="white" stroke="#e5e7eb" strokeWidth="1.5"/>
          <path d="M 30 30 Q 30 20 40 20 Q 50 20 50 30" stroke="#9CA3AF" strokeWidth="2" fill="none" strokeLinecap="round"/>
          {/* Check */}
          <circle cx="40" cy="44" r="9" fill="#22c55e"/>
          <path d="M 34 44 L 38 48 L 46 40" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <p style={{ color: "#111827", fontWeight: 800, fontSize: 17, marginBottom: 6 }}>Nenhum pedido finalizado</p>
      <p style={{ color: "#9CA3AF", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
        Seus pedidos entregues vão aparecer aqui.
      </p>
      <Link href="/" style={{ display: "inline-block", padding: "13px 28px", borderRadius: 14, background: "#DC2626", color: "white", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
        Ver lojas →
      </Link>
    </div>
  )

  return (
    <div style={{ textAlign: "center", padding: "72px 24px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="38" fill="#fef2f2" stroke="#fecaca" strokeWidth="2"/>
          {/* Documento rasgado */}
          <rect x="24" y="18" width="32" height="40" rx="4" fill="white" stroke="#e5e7eb" strokeWidth="1.5"/>
          <path d="M 24 52 L 56 52 L 50 62 L 40 56 L 30 62 Z" fill="#fef2f2" stroke="#fca5a5" strokeWidth="1"/>
          <line x1="30" y1="28" x2="50" y2="28" stroke="#e5e7eb" strokeWidth="2" strokeLinecap="round"/>
          <line x1="30" y1="34" x2="50" y2="34" stroke="#e5e7eb" strokeWidth="2" strokeLinecap="round"/>
          <line x1="30" y1="40" x2="42" y2="40" stroke="#e5e7eb" strokeWidth="2" strokeLinecap="round"/>
          {/* X */}
          <circle cx="50" cy="28" r="10" fill="#ef4444"/>
          <path d="M 46 24 L 54 32 M 54 24 L 46 32" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p style={{ color: "#111827", fontWeight: 800, fontSize: 17, marginBottom: 6 }}>Nenhum pedido cancelado</p>
      <p style={{ color: "#9CA3AF", fontSize: 14, lineHeight: 1.6 }}>
        Ótimo! Não há pedidos cancelados.
      </p>
    </div>
  )
}

export default function HistoricoPage() {
  const router = useRouter()
  const { add } = useCart()
  const { user, loading } = useClienteAuth()

  const [aba, setAba] = useState<Aba>("andamento")
  const [todos, setTodos] = useState<any[]>([])
  const [loadingPedidos, setLoadingPedidos] = useState(false)
  const [reordenadoId, setReordenadoId] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push("/cliente/entrar")
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    setLoadingPedidos(true)
    supabase
      .from("pedidos")
      .select("*, loja:lojas(id, nome, logo_url), itens:itens_pedido(*, produto:produtos(foto_url))")
      .eq("cliente_id", user.id)
      .in("status", [...STATUS_ANDAMENTO, "entregue", "cancelado"])
      .order("criado_em", { ascending: false })
      .limit(100)
      .then(({ data }) => { setTodos(data ?? []); setLoadingPedidos(false) })
  }, [user])

  const pedidosFiltrados = todos.filter(p => {
    if (aba === "andamento")  return STATUS_ANDAMENTO.includes(p.status)
    if (aba === "finalizado") return p.status === "entregue"
    return p.status === "cancelado"
  })

  const contagemAndamento = todos.filter(p => STATUS_ANDAMENTO.includes(p.status)).length

  async function handleReorder(pedido: any) {
    const loja  = pedido.loja
    const itens = pedido.itens ?? []
    if (!loja || itens.length === 0) return
    setReordenadoId(pedido.id)
    for (const item of itens) {
      for (let i = 0; i < item.quantidade; i++) {
        add({ id: item.produto_id ?? item.id, nome: item.nome, preco: item.preco, loja_id: loja.id, loja_nome: loja.nome })
      }
    }
    setTimeout(() => { setReordenadoId(null); router.push(`/restaurante/${loja.id}`) }, 700)
  }

  // Agrupa por data
  const grupos: { label: string; pedidos: any[] }[] = []
  const seen: Record<string, number> = {}
  for (const p of pedidosFiltrados) {
    const label = fmtDataGrupo(p.criado_em)
    if (seen[label] === undefined) {
      seen[label] = grupos.length
      grupos.push({ label, pedidos: [p] })
    } else {
      grupos[seen[label]].pedidos.push(p)
    }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#9CA3AF" }}>Carregando...</p>
    </div>
  )

  const ABAS: { key: Aba; label: string }[] = [
    { key: "andamento",  label: "Em andamento" },
    { key: "finalizado", label: "Finalizado"   },
    { key: "cancelado",  label: "Cancelado"    },
  ]

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>

      {/* Nav */}
      <nav style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", padding: "14px 20px 0", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 0 }}>←</button>
          <p style={{ color: "#111827", fontWeight: 800, fontSize: 17, flex: 1 }}>Meus pedidos</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0 }}>
          {ABAS.map(a => (
            <button
              key={a.key}
              onClick={() => setAba(a.key)}
              style={{
                flex: 1, padding: "10px 4px", background: "none", border: "none",
                borderBottom: aba === a.key ? "2.5px solid #DC2626" : "2.5px solid transparent",
                color: aba === a.key ? "#DC2626" : "#9CA3AF",
                fontWeight: aba === a.key ? 800 : 500, fontSize: 13,
                cursor: "pointer", transition: "all 0.15s", position: "relative",
              }}
            >
              {a.label}
              {a.key === "andamento" && contagemAndamento > 0 && (
                <span style={{
                  position: "absolute", top: 6, right: "calc(50% - 28px)",
                  background: "#DC2626", color: "white",
                  fontSize: 9, fontWeight: 800, borderRadius: 99,
                  padding: "1px 5px", lineHeight: 1.6,
                }}>
                  {contagemAndamento}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "4px 14px 90px", overflowX: "hidden" }}>

        {loadingPedidos ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>Carregando pedidos...</p>
          </div>

        ) : pedidosFiltrados.length === 0 ? (
          <EmptyState aba={aba} />

        ) : grupos.map(grupo => (
          <div key={grupo.label}>

            <p style={{ color: "#6B7280", fontSize: 13, fontWeight: 600, padding: "18px 0 10px" }}>
              {grupo.label}
            </p>

            {grupo.pedidos.map(p => {
              const loja  = p.loja as any
              const itens = (p.itens ?? []) as any[]
              const fotos = itens.map((it: any) => it.produto?.foto_url).filter(Boolean).slice(0, 2)
              const st    = STATUS_LABEL[p.status] ?? { label: p.status, color: "#9CA3AF", bg: "#F3F4F6" }

              return (
                <div key={p.id} style={{
                  background: "white", borderRadius: 18,
                  border: "1px solid #e5e7eb", marginBottom: 14,
                  overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                }}>

                  {/* Header */}
                  <div style={{ padding: "16px 16px 10px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "2px solid #e5e7eb" }}>
                      {loja?.logo_url
                        ? <img src={loja.logo_url} alt={loja.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#DC2626,#b91c1c)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 900, fontSize: 20 }}>
                            {(loja?.nome ?? "L").charAt(0).toUpperCase()}
                          </div>}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "#111827", fontWeight: 700, fontSize: 15, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {loja?.nome ?? "—"}
                      </p>
                      <span style={{
                        display: "inline-block", padding: "3px 10px", borderRadius: 99,
                        background: st.bg, color: st.color,
                        fontSize: 11, fontWeight: 700,
                      }}>
                        {st.label}
                      </span>
                    </div>

                    <p style={{ color: "#9CA3AF", fontSize: 12, flexShrink: 0, marginLeft: 4 }}>
                      #{p.codigo}
                    </p>
                  </div>

                  {/* Itens + fotos */}
                  <div style={{ padding: "0 16px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {itens.slice(0, 4).map((it: any, idx: number) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <span style={{ background: "#F3F4F6", color: "#374151", fontWeight: 700, fontSize: 12, padding: "2px 8px", borderRadius: 6, flexShrink: 0 }}>
                            {it.quantidade}
                          </span>
                          <p style={{ color: "#374151", fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.nome}</p>
                        </div>
                      ))}
                      {itens.length > 4 && <p style={{ color: "#9CA3AF", fontSize: 12 }}>+ {itens.length - 4} item(ns)</p>}
                    </div>
                    {fotos.length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {fotos.map((foto: string, idx: number) => (
                          <div key={idx} style={{ width: 46, height: 46, borderRadius: 12, overflow: "hidden", border: "2px solid white", boxShadow: "0 1px 6px rgba(0,0,0,0.12)" }}>
                            <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div style={{ padding: "0 16px 12px" }}>
                    <p style={{ color: "#9CA3AF", fontSize: 12 }}>
                      Total: <strong style={{ color: "#DC2626" }}>R$ {Number(p.total).toFixed(2)}</strong>
                      {" · "}{new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  {/* Ações */}
                  <div style={{ borderTop: "1px solid #F3F4F6", display: "flex" }}>
                    {aba === "andamento" ? (
                      <Link href={`/pedido/${p.codigo}`} style={{
                        flex: 1, padding: "13px 8px", background: "#DC2626",
                        color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer",
                        textDecoration: "none", textAlign: "center",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3" fill="white" stroke="none"/>
                        </svg>
                        Acompanhar pedido
                      </Link>
                    ) : (
                      <>
                        <button onClick={() => router.push(`/pedido/${p.codigo}`)} style={{ flex: 1, padding: "12px 8px", background: "none", border: "none", color: "#DC2626", fontWeight: 700, fontSize: 13, cursor: "pointer", borderRight: "1px solid #F3F4F6" }}>
                          Detalhes
                        </button>
                        <button
                          onClick={() => handleReorder(p)}
                          disabled={reordenadoId === p.id}
                          style={{ flex: 1, padding: "12px 8px", background: "none", border: "none", color: reordenadoId === p.id ? "#22c55e" : "#DC2626", fontWeight: 700, fontSize: 13, cursor: reordenadoId === p.id ? "default" : "pointer" }}>
                          {reordenadoId === p.id ? "Adicionado!" : "Pedir de novo"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <MobileBottomNav />
    </div>
  )
}
