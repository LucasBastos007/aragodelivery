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

function imprimirPedido(pedido: Pedido) {
  const now  = new Date(pedido.criado_em)
  const data = now.toLocaleDateString("pt-BR")
  const hora = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

  const PGTO: Record<string, string> = {
    pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro",
    maquininha: "Maquininha", apple_pay: "Apple Pay", google_pay: "Google Pay",
  }

  const itensHtml = (pedido.itens ?? []).map((i: any) => `
    <tr>
      <td>${i.quantidade}x ${i.nome}</td>
      <td class="r">R$ ${(i.preco * i.quantidade).toFixed(2).replace(".", ",")}</td>
    </tr>
    ${i.observacao ? `<tr><td colspan="2" class="obs">  obs: ${i.observacao}</td></tr>` : ""}
  `).join("")

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Pedido #${pedido.codigo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      width: 76mm;
      padding: 3mm 4mm;
      color: #000;
    }
    h1 { font-size: 15px; text-align: center; letter-spacing: 1px; margin-bottom: 2px; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .r { text-align: right; white-space: nowrap; }
    .dash { border-top: 1px dashed #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1.5px 0; vertical-align: top; }
    .obs { color: #555; font-size: 10px; }
    .total-row td { font-size: 13px; font-weight: bold; padding-top: 4px; }
    .section { font-weight: bold; margin: 4px 0 2px; font-size: 11px; text-transform: uppercase; }
    @media print {
      body { margin: 0; }
      @page { margin: 2mm; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <h1>CHEGÔ</h1>
  <p class="center" style="font-size:10px;margin-bottom:4px;">DELIVERY</p>
  <div class="dash"></div>
  <p class="bold" style="font-size:14px;">PEDIDO #${pedido.codigo}</p>
  <p>${data} às ${hora}</p>
  <div class="dash"></div>
  <p class="section">Itens</p>
  <table>${itensHtml}</table>
  <div class="dash"></div>
  <table>
    <tr><td>Subtotal</td><td class="r">R$ ${(pedido.subtotal ?? 0).toFixed(2).replace(".", ",")}</td></tr>
    <tr><td>Taxa de entrega</td><td class="r">R$ ${(pedido.taxa_entrega ?? 0).toFixed(2).replace(".", ",")}</td></tr>
    <tr class="total-row"><td>TOTAL</td><td class="r">R$ ${pedido.total.toFixed(2).replace(".", ",")}</td></tr>
  </table>
  <div class="dash"></div>
  <p><span class="bold">PAGAMENTO:</span> ${PGTO[pedido.forma_pagamento] ?? pedido.forma_pagamento}</p>
  ${pedido.nome_cliente ? `<div class="dash"></div><p class="section">Cliente</p><p>${pedido.nome_cliente}</p>${pedido.telefone_cliente ? `<p>Tel: ${pedido.telefone_cliente}</p>` : ""}` : ""}
  ${pedido.endereco_entrega ? `<div class="dash"></div><p class="section">Endereço de entrega</p><p>${pedido.endereco_entrega}</p>` : ""}
  ${pedido.observacao ? `<div class="dash"></div><p class="section">Observação</p><p>${pedido.observacao}</p>` : ""}
  <div class="dash"></div>
  <p class="center bold" style="font-size:13px;">*** CHEGÔ DELIVERY ***</p>
</body>
</html>`

  const win = window.open("", "_blank", "width=420,height=600,menubar=no,toolbar=no")
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }
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
  aceito:     "Iniciar preparo e chamar motoboy",
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
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from("pedidos")
      .select("*, itens:itens_pedido(*)")
      .eq("loja_id", loja_id)
      .not("status", "in", '("coletado","entregue","cancelado")')
      .gte("criado_em", hoje.toISOString())
      .order("criado_em", { ascending: false })
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
        await fetch("/api/loja/atualizar", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loja_id, aberto: deveria }),
        })
      }
    }

    sincronizarHorario()
    // Verificar a cada 5 minutos
    const horarioInterval = setInterval(sincronizarHorario, 5 * 60 * 1000)
    return () => clearInterval(horarioInterval)
  }, [loja_id])

  useEffect(() => {
    if (!loja_id) return
    load()
    const interval = setInterval(load, 15_000)
    // Realtime: detecta novos pedidos e mudanças de status instantaneamente
    const ch = supabase.channel(`loja-pedidos-${loja_id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "pedidos",
        filter: `loja_id=eq.${loja_id}`,
      }, () => load())
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "pedidos",
        filter: `loja_id=eq.${loja_id}`,
      }, () => load())
      .subscribe()
    return () => { clearInterval(interval); supabase.removeChannel(ch) }
  }, [loja_id])

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
    if (!proximo || !loja_id) return
    setAtualizando(id)
    await fetch("/api/loja/status-pedido", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: id, status: proximo, loja_id }),
    })
    enviarPush(id, proximo)

    // Ao iniciar preparo, aciona motoboy imediatamente
    if (statusAtual === "aceito") {
      await fetch("/api/escalada", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: id }),
      }).catch(() => {})
    }

    await load()
    setAtualizando(null)
  }

  async function cancelar(id: string) {
    if (!confirm("Cancelar este pedido?") || !loja_id) return
    setAtualizando(id)
    await fetch("/api/loja/status-pedido", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: id, status: "cancelado", loja_id }),
    })
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

  // Pendentes primeiro, depois os em andamento (ambos já vêm do DB ordenados por criado_em DESC)
  const STATUS_PRIORITY: Record<string, number> = {
    pendente: 0, aceito: 1, preparando: 2, pronto: 3,
    aguardando_aceite: 4, indo_para_loja: 5, na_loja: 6, em_rota: 7, coletado: 8,
  }
  const pendentes   = pedidos.filter(p => p.status === "pendente")
  const emAndamento = pedidos
    .filter(p => p.status !== "pendente")
    .sort((a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9))

  useEffect(() => {
    if (pendentes.length === 0) return
    const id = setInterval(() => beep(), 30_000)
    return () => clearInterval(id)
  }, [pendentes.length])

  const PAGAMENTO_ICON: Record<string, string> = {
    pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha",
  }

  function BotaoImprimir({ pedido }: { pedido: Pedido }) {
    return (
      <button
        onClick={() => imprimirPedido(pedido)}
        title="Imprimir comanda"
        style={{
          padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb",
          background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
          color: "#6B7280", fontSize: 12, fontWeight: 600,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Imprimir
      </button>
    )
  }

  return (
    <div style={{ minHeight: "100vh", padding: "20px 16px", maxWidth: 600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#111827", margin: 0 }}>Pedidos de hoje</h1>
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
          <p style={{ fontWeight: 700, color: "#111827" }}>Nenhum pedido hoje</p>
          <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>Novos pedidos aparecerão aqui automaticamente</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Novos pedidos - destaque */}
          {pendentes.map(p => (
            <div key={p.id} className="card" style={{ padding: "18px 16px", border: "1px solid rgba(249,115,22,0.5)", background: "rgba(249,115,22,0.05)", animation: "pulse 2s infinite" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <span className="badge badge-orange" style={{ fontSize: 11 }}>NOVO PEDIDO</span>
                  <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                    #{p.codigo} · {new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <p style={{ fontSize: 20, fontWeight: 900, color: "#111827", flexShrink: 0 }}>R$ {p.total.toFixed(2)}</p>
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

              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14, fontSize: 12, color: "#9CA3AF", flexWrap: "wrap" }}>
                <span style={{ flexShrink: 0 }}>{PAGAMENTO_ICON[p.forma_pagamento] ?? p.forma_pagamento}</span>
                <span style={{ flexShrink: 0 }}>·</span>
                <span style={{ wordBreak: "break-word" }}>📍 {p.endereco_entrega}</span>
              </div>

              {p.nome_cliente && (
                <p className="text-xs mb-3" style={{ color: "#6B7280" }}>
                  Cliente: {p.nome_cliente}{p.telefone_cliente ? ` · ${p.telefone_cliente}` : ""}
                </p>
              )}

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
                <BotaoImprimir pedido={p} />
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

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PROXIMO_STATUS[p.status] && (
                  <button onClick={() => avancarStatus(p.id, p.status)} disabled={!!atualizando}
                    className="btn-ghost" style={{ flex: 1, justifyContent: "center", fontSize: 12 }}>
                    {atualizando === p.id ? "..." : PROXIMO_LABEL[p.status]}
                  </button>
                )}

                {(p.status === "pronto" || p.status === "preparando") && !p.motoboy_id && (
                  <button onClick={() => chamarMotoboy(p.id)} disabled={!!atualizando}
                    className="btn-primary" style={{ flex: 1, justifyContent: "center", fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}>
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
                  <div style={{ flex: 1, padding: "8px 12px", borderRadius: 10, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#eab308", animation: "pulse 1.5s infinite" }} />
                    <p style={{ color: "#eab308", fontSize: 12, fontWeight: 700 }}>Aguardando motoboy aceitar...</p>
                  </div>
                )}

                <BotaoImprimir pedido={p} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}