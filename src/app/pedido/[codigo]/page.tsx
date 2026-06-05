"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import type { Pedido, StatusPedido } from "@/types"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

const ETAPAS: { status: StatusPedido; label: string; icon: string }[] = [
  { status: "pendente",   label: "Pedido recebido",     icon: "📋" },
  { status: "aceito",     label: "Confirmado pela loja", icon: "✅" },
  { status: "preparando", label: "Preparando",           icon: "👨‍🍳" },
  { status: "pronto",     label: "Pronto para entrega",  icon: "📦" },
  { status: "coletado",   label: "Saiu para entrega",    icon: "🛵" },
  { status: "entregue",   label: "Entregue!",            icon: "🎉" },
]

const STATUS_INDEX: Partial<Record<StatusPedido, number>> = {
  pendente: 0, aceito: 1, preparando: 2, pronto: 3, coletado: 4, entregue: 5,
}

const PAGAMENTO_LABEL: Record<string, string> = {
  pix: "💠 PIX", cartao: "💳 Cartão", dinheiro: "💵 Dinheiro", maquininha: "📱 Maquininha",
}

function StarRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{label}</p>
      <div style={{ display: "flex", gap: 8 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 32, padding: 0, transition: "transform 0.1s", transform: hover === n ? "scale(1.2)" : "scale(1)" }}>
            {n <= (hover || value) ? "⭐" : "☆"}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AcompanhamentoPedido() {
  const { codigo } = useParams<{ codigo: string }>()
  const [pedido,   setPedido]   = useState<Pedido | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Avaliação
  const [modalAvaliacao, setModalAvaliacao] = useState(false)
  const [jaAvaliou,      setJaAvaliou]      = useState(false)
  const [notaLoja,       setNotaLoja]       = useState(0)
  const [notaMotoboy,    setNotaMotoboy]    = useState(0)
  const [comentario,     setComentario]     = useState("")
  const [enviandoAval,   setEnviandoAval]   = useState(false)
  const [avaliacaoOk,    setAvaliacaoOk]    = useState(false)

  // Push subscribe (uma vez)
  const pushDoneRef = useState(false)

  async function load() {
    const { data: rows, error } = await supabase
      .from("pedidos")
      .select("*, itens:itens_pedido(*), loja:lojas(nome, telefone), motoboy:motoboys(*)")
      .eq("codigo", codigo.toUpperCase())
      .order("criado_em", { ascending: false })
      .limit(1)

    if (error) {
      const { data: rows2 } = await supabase
        .from("pedidos")
        .select("*, itens:itens_pedido(*), loja:lojas(nome, telefone)")
        .eq("codigo", codigo.toUpperCase())
        .order("criado_em", { ascending: false })
        .limit(1)
      const d2 = rows2?.[0] ?? null
      if (!d2) { setNotFound(true); setLoading(false); return }
      setPedido(d2 as Pedido); setLoading(false); return
    }

    const data = rows?.[0] ?? null
    if (!data) { setNotFound(true); setLoading(false); return }
    setPedido(data as Pedido)
    setLoading(false)
  }

  useEffect(() => {
    load()

    // Realtime: atualiza instantaneamente quando o status muda
    const channel = supabase
      .channel(`pedido-tracking-${codigo}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos" },
        (payload) => {
          if ((payload.new as any).codigo?.toUpperCase() === codigo.toUpperCase()) {
            load()
          }
        }
      )
      .subscribe()

    // Polling de fallback a cada 5s
    const iv = setInterval(load, 5_000)
    return () => {
      clearInterval(iv)
      supabase.removeChannel(channel)
    }
  }, [codigo])

  // Mostrar modal de avaliação quando entregue
  useEffect(() => {
    if (pedido?.status === "entregue" && !jaAvaliou && !avaliacaoOk) {
      supabase.from("avaliacoes").select("id").eq("pedido_id", pedido.id).limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) { setJaAvaliou(true); return }
          setTimeout(() => setModalAvaliacao(true), 800)
        })
    }
  }, [pedido?.status])

  // Subscrever push quando pedido é carregado (só uma vez)
  useEffect(() => {
    if (!pedido || pushDoneRef[0]) return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    async function subscribePush() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js")
        const existing = await reg.pushManager.getSubscription()
        const sub = existing ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey!),
        })
        await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "subscribe", pedido_id: pedido!.id, subscription: sub }),
        })
        pushDoneRef[0] = true
      } catch {}
    }

    if (Notification.permission === "granted") {
      subscribePush()
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(p => { if (p === "granted") subscribePush() })
    }
  }, [pedido?.id])

  async function enviarAvaliacao() {
    if (!pedido || notaLoja === 0) return
    setEnviandoAval(true)
    const motoboy = (pedido as any).motoboy
    await supabase.from("avaliacoes").upsert({
      pedido_id:    pedido.id,
      loja_id:      pedido.loja_id,
      motoboy_id:   motoboy?.id ?? null,
      nota_loja:    notaLoja,
      nota_motoboy: notaMotoboy || null,
      comentario:   comentario.trim(),
    })
    // Recalcular média da loja
    const { data: avals } = await supabase.from("avaliacoes").select("nota_loja").eq("loja_id", pedido.loja_id)
    if (avals && avals.length > 0) {
      const media = avals.reduce((s, a) => s + a.nota_loja, 0) / avals.length
      await supabase.from("lojas").update({ nota_media: Math.round(media * 10) / 10, total_avaliacoes: avals.length }).eq("id", pedido.loja_id)
    }
    setEnviandoAval(false)
    setModalAvaliacao(false)
    setAvaliacaoOk(true)
    setJaAvaliou(true)
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(255,255,255,0.3)" }}>Buscando pedido...</p>
    </div>
  )

  if (notFound || !pedido) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 20 }}>
      <p style={{ fontSize: 40 }}>🔍</p>
      <p style={{ color: "white", fontWeight: 700 }}>Pedido não encontrado</p>
      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Código: #{codigo.toUpperCase()}</p>
      <Link href="/lojas" style={{ color: "#f97316", fontWeight: 700, marginTop: 8 }}>← Ver lojas</Link>
    </div>
  )

  const etapaAtual = STATUS_INDEX[pedido.status] ?? 0
  const cancelado  = pedido.status === "cancelado"
  const entregue   = pedido.status === "entregue"
  const loja       = (pedido as any).loja
  const motoboy    = (pedido as any).motoboy

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>

      {/* Modal de Avaliação */}
      {modalAvaliacao && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }} onClick={() => setModalAvaliacao(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#141414", borderRadius: "24px 24px 0 0",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "28px 24px 40px", width: "100%", maxWidth: 520,
            animation: "slideUp 0.3s ease",
          }}>
            {avaliacaoOk ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <p style={{ fontSize: 56, marginBottom: 12 }}>🎉</p>
                <p style={{ color: "white", fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Obrigado!</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Sua avaliação foi enviada com sucesso.</p>
                <button onClick={() => setModalAvaliacao(false)} style={{
                  marginTop: 20, padding: "12px 28px", borderRadius: 12, border: "none",
                  background: "#f97316", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}>Fechar</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                  <div>
                    <p style={{ color: "white", fontWeight: 900, fontSize: 18 }}>Avalie seu pedido</p>
                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 3 }}>Sua opinião ajuda muito!</p>
                  </div>
                  <button onClick={() => setModalAvaliacao(false)} style={{
                    background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8,
                    color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer", padding: "4px 10px",
                  }}>✕</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <StarRow label="⭐ Como foi a loja?" value={notaLoja} onChange={setNotaLoja} />
                  {motoboy && (
                    <StarRow label="🛵 Como foi o motoboy?" value={notaMotoboy} onChange={setNotaMotoboy} />
                  )}
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>💬 Comentário (opcional)</p>
                    <textarea
                      value={comentario}
                      onChange={e => setComentario(e.target.value)}
                      placeholder="Conte o que achou..."
                      rows={3}
                      style={{
                        width: "100%", padding: "10px 13px", borderRadius: 10, fontSize: 14,
                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "white", outline: "none", resize: "none", boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <button onClick={enviarAvaliacao} disabled={enviandoAval || notaLoja === 0} style={{
                  marginTop: 24, width: "100%", padding: "14px", borderRadius: 14, border: "none",
                  background: notaLoja === 0 || enviandoAval ? "rgba(249,115,22,0.35)" : "#f97316",
                  color: "white", fontWeight: 800, fontSize: 15, cursor: notaLoja === 0 || enviandoAval ? "not-allowed" : "pointer",
                }}>
                  {enviandoAval ? "Enviando..." : "✓ Enviar avaliação"}
                </button>
                {notaLoja === 0 && (
                  <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, textAlign: "center", marginTop: 8 }}>
                    Selecione ao menos a nota da loja
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Botão flutuante de avaliar (quando entregue e não avaliou) */}
      {entregue && !jaAvaliou && !avaliacaoOk && !modalAvaliacao && (
        <button onClick={() => setModalAvaliacao(true)} style={{
          position: "fixed", bottom: 24, right: 20, zIndex: 50,
          background: "#f97316", border: "none", borderRadius: 16,
          padding: "12px 20px", color: "white", fontWeight: 800, fontSize: 14,
          cursor: "pointer", boxShadow: "0 4px 20px rgba(249,115,22,0.4)",
        }}>
          ⭐ Avaliar pedido
        </button>
      )}

      {/* Navbar */}
      <nav style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/lojas" style={{ color: "rgba(255,255,255,0.35)", fontSize: 20, textDecoration: "none" }}>←</Link>
        <p style={{ color: "#f97316", fontWeight: 900, fontSize: 16 }}>🛵 Arago Delivery</p>
      </nav>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px" }}>

        {/* Código + status atual */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginBottom: 6 }}>Pedido</p>
          <p style={{ color: "#f97316", fontWeight: 900, fontSize: 36, letterSpacing: 4 }}>#{pedido.codigo}</p>
          {loja && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 4 }}>{loja.nome}</p>}
        </div>

        {cancelado ? (
          <div style={{
            borderRadius: 16, padding: "20px 24px", marginBottom: 24, textAlign: "center",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
          }}>
            <p style={{ fontSize: 36, marginBottom: 8 }}>❌</p>
            <p style={{ color: "#f87171", fontWeight: 800, fontSize: 18 }}>Pedido cancelado</p>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 6 }}>
              Entre em contato com a loja para mais informações.
            </p>
            {loja?.telefone && (
              <a href={`https://wa.me/55${loja.telefone.replace(/\D/g, "")}`}
                target="_blank" rel="noreferrer"
                style={{ display: "inline-block", marginTop: 14, color: "#22c55e", fontWeight: 700, fontSize: 13 }}>
                💬 Falar com a loja via WhatsApp
              </a>
            )}
          </div>
        ) : (
          <>
            {/* Barra de progresso */}
            <div style={{
              background: "#111", borderRadius: 20, padding: "24px 20px", marginBottom: 20,
              border: entregue ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)",
            }}>
              {/* Ícone e texto do status atual */}
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <p style={{ fontSize: 44, marginBottom: 8 }}>
                  {entregue ? "🎉" : ETAPAS[etapaAtual]?.icon}
                </p>
                <p style={{ color: "white", fontWeight: 800, fontSize: 18 }}>
                  {ETAPAS[etapaAtual]?.label}
                </p>
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 4 }}>
                  Atualiza em tempo real
                </p>
              </div>

              {/* Etapas */}
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {ETAPAS.map((etapa, i) => {
                  const feita   = i < etapaAtual
                  const atual   = i === etapaAtual
                  const futura  = i > etapaAtual
                  return (
                    <div key={etapa.status} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      {/* Linha + círculo */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 20 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                          background: feita ? "#22c55e" : atual ? "#f97316" : "rgba(255,255,255,0.1)",
                          border: atual ? "2px solid rgba(249,115,22,0.5)" : "none",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10,
                        }}>
                          {feita ? "✓" : ""}
                        </div>
                        {i < ETAPAS.length - 1 && (
                          <div style={{
                            width: 2, height: 28, marginTop: 2,
                            background: feita ? "#22c55e" : "rgba(255,255,255,0.08)",
                          }} />
                        )}
                      </div>
                      {/* Label */}
                      <p style={{
                        fontSize: 13, fontWeight: atual ? 700 : 500,
                        color: feita ? "#22c55e" : atual ? "white" : "rgba(255,255,255,0.25)",
                        paddingTop: 1, paddingBottom: i < ETAPAS.length - 1 ? 28 : 0,
                      }}>
                        {etapa.icon} {etapa.label}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Código para mostrar ao motoboy */}
            {pedido.status === "coletado" && (
              <div style={{
                background: "rgba(249,115,22,0.07)", border: "2px solid rgba(249,115,22,0.4)",
                borderRadius: 20, padding: "24px 20px", marginBottom: 16, textAlign: "center",
              }}>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 10 }}>
                  🏍️ Mostre este código para o entregador:
                </p>
                <p style={{ color: "#f97316", fontWeight: 900, fontSize: 64, letterSpacing: 12, lineHeight: 1, marginBottom: 8 }}>
                  {pedido.codigo}
                </p>
                <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
                  O motoboy vai digitar este código ao chegar para confirmar a entrega
                </p>
              </div>
            )}

            {/* Motoboy + mapa ao vivo */}
            {motoboy && pedido.status === "coletado" && (
              <div style={{
                background: "#111", borderRadius: 16, marginBottom: 16,
                border: "1px solid rgba(249,115,22,0.25)", overflow: "hidden",
              }}>
                <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#f97316" }} />
                    <div className="ping-slow" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#f97316" }} />
                  </div>
                  <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>🏍️ {motoboy.nome} está a caminho</p>
                </div>

                {motoboy.lat && motoboy.lng ? (
                  <>
                    <iframe
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${motoboy.lng - 0.006},${motoboy.lat - 0.006},${motoboy.lng + 0.006},${motoboy.lat + 0.006}&layer=mapnik&marker=${motoboy.lat},${motoboy.lng}`}
                      style={{ width: "100%", height: 220, border: "none", display: "block" }}
                      loading="lazy"
                      title="Localização do motoboy"
                    />
                    <div style={{ padding: "10px 18px", background: "rgba(249,115,22,0.04)" }}>
                      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                        📡 Localização em tempo real — atualiza a cada 10s
                      </p>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: "14px 18px", paddingTop: 0 }}>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
                      Aguardando localização GPS do motoboy...
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Resumo do pedido */}
        <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>Resumo</p>
          </div>
          <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {pedido.itens?.map((item: any) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "rgba(255,255,255,0.7)" }}>{item.quantidade}× {item.nome}</span>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>R$ {(item.preco * item.quantidade).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              <span>Subtotal</span><span>R$ {pedido.subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              <span>Entrega</span>
              <span style={{ color: pedido.taxa_entrega === 0 ? "#22c55e" : undefined }}>
                {pedido.taxa_entrega === 0 ? "Grátis" : `R$ ${pedido.taxa_entrega.toFixed(2)}`}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: "white", fontSize: 15, marginTop: 4 }}>
              <span>Total</span><span>R$ {pedido.total.toFixed(2)}</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 }}>
              {PAGAMENTO_LABEL[pedido.forma_pagamento] ?? pedido.forma_pagamento}
            </p>
          </div>
        </div>

        {/* Endereço */}
        <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", padding: "14px 18px", marginBottom: 20 }}>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginBottom: 4 }}>Endereço de entrega</p>
          <p style={{ color: "white", fontSize: 14 }}>📍 {pedido.endereco_entrega}</p>
        </div>

        <Link href="/lojas" style={{
          display: "block", textAlign: "center", padding: "13px",
          borderRadius: 12, background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.4)", fontWeight: 700, fontSize: 14,
          textDecoration: "none", border: "1px solid rgba(255,255,255,0.08)",
        }}>
          Fazer outro pedido
        </Link>
      </div>
    </div>
  )
}
