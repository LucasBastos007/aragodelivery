"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import type { Pedido, StatusPedido } from "@/types"

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const play = (freq: number, start: number, dur: number) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = "sine"
      o.frequency.value = freq
      g.gain.setValueAtTime(0.4, ctx.currentTime + start)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      o.start(ctx.currentTime + start)
      o.stop(ctx.currentTime + start + dur)
    }
    play(880, 0, 0.15)
    play(1100, 0.18, 0.15)
    play(880, 0.36, 0.2)
  } catch {}
}

type DiaSemana = "dom" | "seg" | "ter" | "qua" | "qui" | "sex" | "sab"
type DiaConfig = { aberto: boolean; inicio: string; fim: string }
type Horarios = { tipo: "sempre_aberto" | "por_horario"; dias: Record<DiaSemana, DiaConfig> }

function deveEstarAberto(horarios: Horarios | null): boolean | null {
  if (!horarios) return null
  if (horarios.tipo === "sempre_aberto") return true
  const diasSemana: DiaSemana[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"]
  const agora = new Date()
  const diaAtual = diasSemana[agora.getDay()]
  const config = horarios.dias?.[diaAtual]
  if (!config || !config.aberto) return false
  const [hIni, mIni] = config.inicio.split(":").map(Number)
  const [hFim, mFim] = config.fim.split(":").map(Number)
  const minutos = agora.getHours() * 60 + agora.getMinutes()
  return minutos >= hIni * 60 + mIni && minutos < hFim * 60 + mFim
}

const STATUS_LABEL: Record<StatusPedido, string> = {
  pendente:          "Novo pedido",
  aceito:            "Aceito",
  preparando:        "Preparando",
  pronto:            "Pronto para entrega",
  aguardando_aceite: "Aguardando motoboy",
  indo_para_loja:    "Motoboy a caminho",
  na_loja:           "Motoboy na loja",
  em_rota:           "Em rota de entrega",
  coletado:          "Coletado",
  entregue:          "Entregue",
  cancelado:         "Cancelado",
}
const PROXIMO_STATUS: Partial<Record<StatusPedido, StatusPedido>> = {
  pendente:   "aceito",
  aceito:     "preparando",
  preparando: "pronto",
}
const PROXIMO_LABEL: Partial<Record<StatusPedido, string>> = {
  pendente:   "✓ Aceitar pedido",
  aceito:     "Iniciar preparo",
  preparando: "Marcar como pronto",
}

export default function LojaDashboard() {
  const { sessao } = useAuth()
  const loja_id = sessao?.role === "lojista" ? sessao.loja_id : null

  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [atualizando, setAtualizando] = useState<string | null>(null)
  const prevPendentesRef = useRef<Set<string>>(new Set())
  const isFirstLoad = useRef(true)
  const horariosRef = useRef<Horarios | null>(null)

  async function load() {
    if (!loja_id) return
    const { data } = await supabase
      .from("pedidos")
      .select("*, itens:itens_pedido(*)")
      .eq("loja_id", loja_id)
      .not("status", "in", '("coletado","entregue","cancelado")')
      .order("criado_em", { ascending: true })
    const resultado = (data as Pedido[]) ?? []
    const novosPendentes = new Set(resultado.filter(p => p.status === "pendente").map(p => p.id))

    if (!isFirstLoad.current) {
      const chegaram = [...novosPendentes].filter(id => !prevPendentesRef.current.has(id))
      if (chegaram.length > 0) beep()
    }

    prevPendentesRef.current = novosPendentes
    isFirstLoad.current = false
    setPedidos(resultado)
    setLoading(false)
  }

  // Carregar horários e sincronizar aberto/fechado automaticamente
  useEffect(() => {
    if (!loja_id) return

    async function sincronizarHorario() {
      const { data } = await supabase.from("lojas").select("horarios, status").eq("id", loja_id!).single()
      if (!data || data.status !== "ativo") return
      const horarios: Horarios | null = data.horarios as any
      horariosRef.current = horarios
      if (!horarios || horarios.tipo === "sempre_aberto") return
      const deveria = deveEstarAberto(horarios)
      if (deveria !== null) {
        await supabase.from("lojas").update({ aberto: deveria }).eq("id", loja_id!)
      }
    }

    sincronizarHorario()
    // Verificar a cada 5 minutos
    const horarioInterval = setInterval(sincronizarHorario, 5 * 60 * 1000)
    return () => clearInterval(horarioInterval)
  }, [loja_id])

  useEffect(() => {
    load()
    const interval = setInterval(load, 15_000)
    return () => clearInterval(interval)
  }, [])

  async function enviarPush(id: string, status: StatusPedido) {
    try {
      const { data } = await supabase.from("pedidos").select("codigo").eq("id", id).single()
      if (data) {
        await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send", pedido_id: id, status, codigo: data.codigo }),
        })
      }
    } catch {}
  }

  async function avancarStatus(id: string, statusAtual: StatusPedido) {
    const proximo = PROXIMO_STATUS[statusAtual]
    if (!proximo) return
    setAtualizando(id)
    await supabase.from("pedidos").update({ status: proximo }).eq("id", id)
    enviarPush(id, proximo)
    await load()
    setAtualizando(null)
  }

  async function cancelar(id: string) {
    if (!confirm("Cancelar este pedido?")) return
    setAtualizando(id)
    await supabase.from("pedidos").update({ status: "cancelado" }).eq("id", id)
    enviarPush(id, "cancelado")
    await load()
    setAtualizando(null)
  }

  async function chamarMotoboy(id: string) {
    setAtualizando(id)
    await fetch("/api/escalada", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: id }),
    })
    await load()
    setAtualizando(null)
  }

  const pendentes   = pedidos.filter(p => p.status === "pendente")
  const emAndamento = pedidos.filter(p => p.status !== "pendente")

  // Som contínuo a cada 30s enquanto há pedidos pendentes não atendidos
  useEffect(() => {
    if (pendentes.length === 0) return
    const id = setInterval(() => beep(), 30_000)
    return () => clearInterval(id)
  }, [pendentes.length])

  const PAGAMENTO_ICON: Record<string, string> = {
    pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha",
  }

  return (
    <div style={{ minHeight: "100vh", padding: "20px 16px", maxWidth: 600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#111827", margin: 0 }}>Pedidos</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Atualiza a cada 15 segundos</p>
        </div>
        <button onClick={() => { setLoading(true); load() }} className="btn-ghost" style={{ fontSize: 12, padding: "8px 14px" }}>
          ↻ Atualizar
        </button>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", marginTop: 48, color: "#9CA3AF" }}>Carregando pedidos...</p>
      ) : pedidos.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 64 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px" }}><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
          <p style={{ fontWeight: 700, color: "#111827" }}>Nenhum pedido no momento</p>
          <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>Novos pedidos aparecerão aqui automaticamente</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Novos pedidos - destaque */}
          {pendentes.map(p => (
            <div key={p.id} className="card" style={{ padding: "18px 16px", border: "1px solid rgba(249,115,22,0.5)", background: "rgba(249,115,22,0.05)", animation: "pulse 2s infinite" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <span className="badge badge-orange" style={{ fontSize: 11 }}>NOVO PEDIDO</span>
                  <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                    #{p.codigo} · {new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <p style={{ fontSize: 22, fontWeight: 900, color: "#111827" }}>R$ {p.total.toFixed(2)}</p>
              </div>

              {p.itens && p.itens.length > 0 && (
                <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                  {p.itens.map((item: any) => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <span style={{ color: "#374151" }}>{item.quantidade}x {item.nome}</span>
                      <span style={{ color: "#9CA3AF" }}>R$ {(item.preco * item.quantidade).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 12, color: "#9CA3AF" }}>
                <span>{PAGAMENTO_ICON[p.forma_pagamento] ?? p.forma_pagamento}</span>
                <span>·</span>
                <span>📍 {p.endereco_entrega}</span>
              </div>

              {p.observacao && (
                <p style={{ fontSize: 12, fontStyle: "italic", marginBottom: 14, padding: "8px 12px", borderRadius: 10, background: "#F3F4F6", color: "#6B7280" }}>
                  💬 {p.observacao}
                </p>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => avancarStatus(p.id, p.status)} disabled={!!atualizando}
                  className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                  {atualizando === p.id ? "..." : PROXIMO_LABEL[p.status]}
                </button>
                <button onClick={() => cancelar(p.id)} disabled={!!atualizando}
                  className="btn-ghost" style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)", padding: "11px 16px" }}>
                  ✕
                </button>
              </div>
            </div>
          ))}

          {/* Em andamento */}
          {emAndamento.map(p => (
            <div key={p.id} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="badge badge-blue">{STATUS_LABEL[p.status]}</span>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>#{p.codigo}</span>
                </div>
                <p style={{ fontWeight: 700, color: "#111827" }}>R$ {p.total.toFixed(2)}</p>
              </div>

              {p.itens && (
                <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>
                  {p.itens.map((i: any) => `${i.quantidade}x ${i.nome}`).join(", ")}
                </p>
              )}

              {PROXIMO_STATUS[p.status] && (
                <button onClick={() => avancarStatus(p.id, p.status)} disabled={!!atualizando}
                  className="btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: 13 }}>
                  {atualizando === p.id ? "..." : PROXIMO_LABEL[p.status]}
                </button>
              )}

              {p.status === "pronto" && !p.motoboy_id && (
                <button onClick={() => chamarMotoboy(p.id)} disabled={!!atualizando}
                  className="btn-primary" style={{ marginTop: 8, width: "100%", justifyContent: "center", fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}>
                  {atualizando === p.id ? "Chamando..." : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/>
                        <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
                      </svg>
                      Chamar motoboy
                    </>
                  )}
                </button>
              )}

              {p.status === "aguardando_aceite" && (
                <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#eab308", animation: "pulse 1.5s infinite" }} />
                  <p style={{ color: "#eab308", fontSize: 12, fontWeight: 700 }}>Aguardando motoboy aceitar...</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}