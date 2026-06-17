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

export default function HistoricoPage() {
  const router = useRouter()
  const { add } = useCart()
  const { user, loading } = useClienteAuth()

  const [pedidos,        setPedidos]        = useState<any[]>([])
  const [loadingPedidos, setLoadingPedidos] = useState(false)
  const [reordenadoId,   setReordenadoId]   = useState<string | null>(null)

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
      .eq("status", "entregue")
      .order("criado_em", { ascending: false })
      .limit(50)
      .then(({ data }) => { setPedidos(data ?? []); setLoadingPedidos(false) })
  }, [user])

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
  for (const p of pedidos) {
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

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>

      {/* Nav */}
      <nav style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>←</button>
        <p style={{ color: "#111827", fontWeight: 800, fontSize: 17, flex: 1 }}>Histórico</p>
        {pedidos.length > 0 && (
          <span style={{ color: "#9CA3AF", fontSize: 13 }}>{pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""}</span>
        )}
      </nav>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "4px 14px 90px", overflowX: "hidden" }}>

        {loadingPedidos ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>Carregando pedidos...</p>
          </div>

        ) : pedidos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "72px 24px" }}>
            <p style={{ fontSize: 48, marginBottom: 14 }}>📭</p>
            <p style={{ color: "#111827", fontWeight: 800, fontSize: 17, marginBottom: 6 }}>Nenhum pedido concluído</p>
            <p style={{ color: "#9CA3AF", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Seus pedidos finalizados vão aparecer aqui após a entrega.
            </p>
            <Link href="/" style={{ display: "inline-block", padding: "13px 28px", borderRadius: 14, background: "#DC2626", color: "white", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
              Ver lojas →
            </Link>
          </div>

        ) : grupos.map(grupo => (
          <div key={grupo.label}>

            {/* Cabeçalho de data */}
            <p style={{ color: "#6B7280", fontSize: 13, fontWeight: 600, padding: "18px 0 10px" }}>
              {grupo.label}
            </p>

            {grupo.pedidos.map(p => {
              const loja  = p.loja as any
              const itens = (p.itens ?? []) as any[]
              const fotos = itens
                .map((it: any) => it.produto?.foto_url)
                .filter(Boolean)
                .slice(0, 2)

              return (
                <div key={p.id} style={{
                  background: "white", borderRadius: 18,
                  border: "1px solid #e5e7eb", marginBottom: 14,
                  overflow: "hidden",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                }}>

                  {/* Header: avatar + nome + status */}
                  <div style={{ padding: "16px 16px 10px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: "50%", overflow: "hidden",
                      flexShrink: 0, border: "2px solid #e5e7eb",
                    }}>
                      {loja?.logo_url
                        ? <img src={loja.logo_url} alt={loja.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{
                            width: "100%", height: "100%",
                            background: "linear-gradient(135deg,#DC2626,#b91c1c)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "white", fontWeight: 900, fontSize: 20,
                          }}>
                            {(loja?.nome ?? "L").charAt(0).toUpperCase()}
                          </div>}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "#111827", fontWeight: 700, fontSize: 15, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {loja?.nome ?? "—"}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <p style={{ color: "#6B7280", fontSize: 13 }}>Pedido concluído</p>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                      </div>
                    </div>
                  </div>

                  {/* Economia */}
                  {p.desconto > 0 && (
                    <div style={{ padding: "0 16px 10px", display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 15 }}>💜</span>
                      <p style={{ color: "#374151", fontSize: 13 }}>
                        Economia de <strong>R$ {Number(p.desconto).toFixed(2)}</strong> com este pedido
                      </p>
                    </div>
                  )}

                  {/* Itens + fotos */}
                  <div style={{ padding: "0 16px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {itens.slice(0, 4).map((it: any, idx: number) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <span style={{
                            background: "#F3F4F6", color: "#374151", fontWeight: 700,
                            fontSize: 12, padding: "2px 8px", borderRadius: 6, flexShrink: 0,
                          }}>
                            {it.quantidade}
                          </span>
                          <p style={{ color: "#374151", fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {it.nome}
                          </p>
                        </div>
                      ))}
                      {itens.length > 4 && (
                        <p style={{ color: "#9CA3AF", fontSize: 12 }}>+ {itens.length - 4} item(ns)</p>
                      )}
                    </div>

                    {/* Fotos dos produtos */}
                    {fotos.length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {fotos.map((foto: string, idx: number) => (
                          <div key={idx} style={{
                            width: 46, height: 46, borderRadius: 12, overflow: "hidden",
                            border: "2px solid white", boxShadow: "0 1px 6px rgba(0,0,0,0.12)",
                          }}>
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
                    <button
                      onClick={() => router.push(`/pedido/${p.codigo}`)}
                      style={{
                        flex: 1, padding: "12px 8px", background: "none", border: "none",
                        color: "#DC2626", fontWeight: 700, fontSize: 13, cursor: "pointer",
                        borderRight: "1px solid #F3F4F6",
                      }}>
                      Ajuda
                    </button>
                    <button
                      onClick={() => handleReorder(p)}
                      disabled={reordenadoId === p.id}
                      style={{
                        flex: 1, padding: "12px 8px", background: "none", border: "none",
                        color: reordenadoId === p.id ? "#22c55e" : "#DC2626",
                        fontWeight: 700, fontSize: 13, cursor: reordenadoId === p.id ? "default" : "pointer",
                      }}>
                      {reordenadoId === p.id ? "Adicionado!" : "Pedir de novo"}
                    </button>
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
