"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import type { Pedido, StatusPedido } from "@/types"

const PAGAMENTO_ICON: Record<string, string> = {
  pix: "💠 PIX", cartao: "💳 Cartão", dinheiro: "💵 Dinheiro", maquininha: "📱 Maquininha",
}

export default function MotoboyPage() {
  const { sessao } = useAuth()
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null

  const [disponivel, setDisponivel] = useState(false)
  const [togglingDisp, setTogglingDisp] = useState(false)
  const [dispLoading, setDispLoading] = useState(true)

  const [prontos, setProntos]         = useState<Pedido[]>([])
  const [emAndamento, setEmAndamento] = useState<Pedido[]>([])
  const [pedidosLoading, setPedidosLoading] = useState(true)
  const [atualizando, setAtualizando] = useState<string | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const [codigoInput, setCodigoInput] = useState("")
  const [erroConfirm, setErroConfirm] = useState("")

  const prevProntosRef = useRef<Set<string>>(new Set())
  const isFirstLoad    = useRef(true)
  const watchIdRef     = useRef<number | null>(null)
  const [compartilhando, setCompartilhando] = useState(false)

  // Carrega estado disponível
  useEffect(() => {
    if (!motoboy_id) return
    supabase.from("motoboys").select("disponivel").eq("id", motoboy_id).single()
      .then(({ data }) => { if (data) setDisponivel(data.disponivel); setDispLoading(false) })
  }, [motoboy_id])

  async function toggleDisponivel() {
    if (!motoboy_id) return
    setTogglingDisp(true)
    const novo = !disponivel
    await supabase.from("motoboys").update({ disponivel: novo }).eq("id", motoboy_id)
    setDisponivel(novo)
    setTogglingDisp(false)
  }

  async function loadPedidos() {
    if (!motoboy_id) return

    const [{ data: prontosData }, { data: andamentoData }] = await Promise.all([
      // Pedidos prontos sem motoboy atribuído
      supabase.from("pedidos")
        .select("*, itens:itens_pedido(*), loja:lojas(nome, endereco)")
        .eq("status", "pronto")
        .is("motoboy_id", null)
        .order("criado_em", { ascending: true }),
      // Pedidos coletados por mim
      supabase.from("pedidos")
        .select("*, itens:itens_pedido(*), loja:lojas(nome, endereco)")
        .eq("status", "coletado")
        .eq("motoboy_id", motoboy_id)
        .order("criado_em", { ascending: true }),
    ])

    const novosProntos = prontosData as Pedido[] ?? []
    const novosIds = new Set(novosProntos.map(p => p.id))

    if (!isFirstLoad.current) {
      const chegaram = [...novosIds].filter(id => !prevProntosRef.current.has(id))
      if (chegaram.length > 0) beep()
    }
    prevProntosRef.current = novosIds
    isFirstLoad.current = false

    setProntos(novosProntos)
    setEmAndamento((andamentoData as Pedido[]) ?? [])
    setPedidosLoading(false)
  }

  useEffect(() => {
    if (!motoboy_id) return
    loadPedidos()
    const iv = setInterval(loadPedidos, 15_000)
    return () => clearInterval(iv)
  }, [motoboy_id])

  async function enviarPush(pedido_id: string, status: string, codigo: string) {
    try {
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", pedido_id, status, codigo }),
      })
    } catch {}
  }

  async function aceitarEntrega(pedido: Pedido) {
    if (!motoboy_id) return
    setAtualizando(pedido.id)
    await supabase.from("pedidos").update({ status: "coletado", motoboy_id }).eq("id", pedido.id)
    enviarPush(pedido.id, "coletado", pedido.codigo)
    await loadPedidos()
    setAtualizando(null)
  }

  async function marcarEntregue(pedido: Pedido) {
    setAtualizando(pedido.id)
    await supabase.from("pedidos").update({ status: "entregue" }).eq("id", pedido.id)
    enviarPush(pedido.id, "entregue", pedido.codigo)
    await loadPedidos()
    setAtualizando(null)
    setConfirmandoId(null)
    setCodigoInput("")
    setErroConfirm("")
  }

  function iniciarConfirmacao(pedido: Pedido) {
    setConfirmandoId(pedido.id)
    setCodigoInput("")
    setErroConfirm("")
  }

  function confirmarCodigo(pedido: Pedido) {
    if (codigoInput.trim().toUpperCase() !== pedido.codigo.toUpperCase()) {
      setErroConfirm("Código incorreto. Peça ao cliente para mostrar o código na tela.")
      return
    }
    marcarEntregue(pedido)
  }

  // Rastreamento GPS — ativo apenas durante entrega em andamento
  const iniciarRastreamento = useCallback(() => {
    if (!motoboy_id || !navigator.geolocation) return
    if (watchIdRef.current !== null) return // já rodando
    setCompartilhando(true)
    watchIdRef.current = navigator.geolocation.watchPosition(
      async ({ coords }) => {
        await supabase
          .from("motoboys")
          .update({ lat: coords.latitude, lng: coords.longitude })
          .eq("id", motoboy_id)
      },
      () => setCompartilhando(false),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
  }, [motoboy_id])

  const pararRastreamento = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setCompartilhando(false)
    if (motoboy_id) {
      supabase.from("motoboys").update({ lat: null, lng: null }).eq("id", motoboy_id)
    }
  }, [motoboy_id])

  useEffect(() => {
    if (emAndamento.length > 0 && disponivel) {
      iniciarRastreamento()
    } else {
      pararRastreamento()
    }
    return () => { /* cleanup on unmount handled below */ }
  }, [emAndamento.length, disponivel, iniciarRastreamento, pararRastreamento])

  useEffect(() => () => pararRastreamento(), [pararRastreamento])

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>

      {/* Toggle disponível */}
      <div style={{
        borderRadius: 16, padding: "16px 20px", marginBottom: 24,
        border: disponivel ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)",
        background: disponivel ? "rgba(34,197,94,0.06)" : "#111",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ color: "white", fontWeight: 800, fontSize: 15 }}>
            {disponivel ? "🟢 Online" : "⚫ Offline"}
          </p>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 }}>
            {disponivel ? "Você está recebendo pedidos" : "Ative para receber entregas"}
          </p>
        </div>
        {dispLoading ? null : (
          <button onClick={toggleDisponivel} disabled={togglingDisp} style={{
            width: 52, height: 28, borderRadius: 14, border: "none",
            cursor: togglingDisp ? "not-allowed" : "pointer",
            background: disponivel ? "#22c55e" : "rgba(255,255,255,0.12)",
            position: "relative", transition: "background 0.25s",
            opacity: togglingDisp ? 0.5 : 1,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%", background: "white",
              position: "absolute", top: 4, transition: "left 0.25s",
              left: disponivel ? 28 : 4,
            }} />
          </button>
        )}
      </div>

      {!disponivel && (
        <div style={{ textAlign: "center", marginTop: 48 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🛵</p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Você está offline</p>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, marginTop: 4 }}>
            Ative o modo online para ver pedidos disponíveis
          </p>
        </div>
      )}

      {disponivel && (
        <>
          {/* Em andamento — minha entrega atual */}
          {emAndamento.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>
                Em andamento
              </p>
              {emAndamento.map(p => (
                <div key={p.id} style={{
                  background: "#111", borderRadius: 16, padding: "16px 18px", marginBottom: 10,
                  border: "1px solid rgba(59,130,246,0.3)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }}>
                        📦 Coletado
                      </span>
                      {compartilhando && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", display: "flex", alignItems: "center", gap: 4, width: "fit-content" }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                          GPS ativo — cliente está vendo você
                        </span>
                      )}
                      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 4 }}>#{p.codigo}</p>
                    </div>
                    <p style={{ color: "white", fontWeight: 800, fontSize: 18 }}>R$ {p.total.toFixed(2)}</p>
                  </div>

                  <div style={{ marginBottom: 12, fontSize: 13 }}>
                    <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                      🏪 {(p as any).loja?.nome ?? "—"}
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.5)" }}>
                      📍 {p.endereco_entrega}
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 4 }}>
                      {PAGAMENTO_ICON[p.forma_pagamento] ?? p.forma_pagamento}
                    </p>
                  </div>

                  {p.observacao && (
                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, fontStyle: "italic", marginBottom: 10 }}>
                      💬 {p.observacao}
                    </p>
                  )}

                  {confirmandoId === p.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600 }}>
                        📱 Peça o código ao cliente e digite abaixo:
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          value={codigoInput}
                          onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setErroConfirm("") }}
                          onKeyDown={e => e.key === "Enter" && confirmarCodigo(p)}
                          placeholder="0000"
                          maxLength={8}
                          autoFocus
                          style={{
                            flex: 1, padding: "11px 14px", borderRadius: 10, fontSize: 24,
                            fontWeight: 900, letterSpacing: 8, textAlign: "center",
                            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
                            color: "white", outline: "none",
                          }}
                        />
                        <button onClick={() => confirmarCodigo(p)} disabled={!codigoInput.trim() || !!atualizando}
                          style={{
                            padding: "11px 20px", borderRadius: 10, border: "none", fontSize: 20,
                            background: codigoInput.trim() ? "#22c55e" : "rgba(34,197,94,0.2)",
                            color: "white", fontWeight: 800, cursor: codigoInput.trim() ? "pointer" : "not-allowed",
                          }}>
                          {atualizando === p.id ? "..." : "✓"}
                        </button>
                        <button onClick={() => setConfirmandoId(null)}
                          style={{ padding: "11px 14px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 16 }}>
                          ✕
                        </button>
                      </div>
                      {erroConfirm && (
                        <p style={{ color: "#f87171", fontSize: 12, fontWeight: 600, padding: "8px 10px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.15)" }}>
                          {erroConfirm}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => iniciarConfirmacao(p)} disabled={!!atualizando}
                      style={{
                        width: "100%", padding: "12px", borderRadius: 12, border: "none",
                        background: atualizando === p.id ? "rgba(34,197,94,0.3)" : "#22c55e",
                        color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer",
                      }}>
                      {atualizando === p.id ? "..." : "✓ Entregue — confirmar com código"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Prontos para coleta */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                Prontos para coleta
              </p>
              {!pedidosLoading && (
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>
                  atualiza em 15s
                </span>
              )}
            </div>

            {pedidosLoading ? (
              <p style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 20 }}>Carregando...</p>
            ) : prontos.length === 0 ? (
              <div style={{ textAlign: "center", marginTop: 32 }}>
                <p style={{ fontSize: 36, marginBottom: 10 }}>⏳</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Nenhum pedido disponível</p>
                <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginTop: 4 }}>Novos pedidos aparecerão aqui</p>
              </div>
            ) : prontos.map(p => (
              <div key={p.id} style={{
                background: "#111", borderRadius: 16, padding: "16px 18px", marginBottom: 10,
                border: "1px solid rgba(249,115,22,0.35)",
                animation: "pulse 2s infinite",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }}>
                      🔔 PRONTO
                    </span>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 4 }}>
                      #{p.codigo} · {new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <p style={{ color: "white", fontWeight: 800, fontSize: 18 }}>R$ {p.total.toFixed(2)}</p>
                </div>

                <div style={{ marginBottom: 10, fontSize: 13 }}>
                  <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                    🏪 Coletar em: <strong style={{ color: "white" }}>{(p as any).loja?.nome ?? "—"}</strong>
                  </p>
                  {(p as any).loja?.endereco && (
                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginBottom: 6 }}>
                      {(p as any).loja.endereco}
                    </p>
                  )}
                  <p style={{ color: "rgba(255,255,255,0.5)" }}>
                    📍 Entregar em: <strong style={{ color: "white" }}>{p.endereco_entrega}</strong>
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 4 }}>
                    {PAGAMENTO_ICON[p.forma_pagamento] ?? p.forma_pagamento}
                  </p>
                </div>

                {p.itens && p.itens.length > 0 && (
                  <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, marginBottom: 10 }}>
                    {p.itens.map((i: any) => `${i.quantidade}x ${i.nome}`).join(", ")}
                  </p>
                )}

                <button onClick={() => aceitarEntrega(p)} disabled={!!atualizando}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 12, border: "none",
                    background: atualizando === p.id ? "rgba(249,115,22,0.4)" : "#f97316",
                    color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer",
                  }}>
                  {atualizando === p.id ? "..." : "🛵 Aceitar entrega"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const play = (freq: number, start: number, dur: number) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = freq
      g.gain.setValueAtTime(0.35, ctx.currentTime + start)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      o.start(ctx.currentTime + start)
      o.stop(ctx.currentTime + start + dur)
    }
    play(660, 0, 0.15); play(880, 0.18, 0.2)
  } catch {}
}
