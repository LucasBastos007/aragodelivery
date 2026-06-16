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

    // Notifica motoboy disponível quando o pedido fica pronto
    if (statusAtual === "preparando") {
      fetch("/api/escalada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: id }),
      }).catch(() => {})
    }

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

  // Pendentes primeiro, depois os em andamento (ambos já vêm do DB ordenados por criado_em DESC)
  const pendentes   = pedidos.filter(p => p.status === "pendente")
  const emAndamento = pedidos.filter(p => p.status !== "pendente")

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
    <div className="min-h-screen p-6" style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black" style={{ color: "#111827" }}>Pedidos de hoje</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>Atualiza a cada 15 segundos</p>
        </div>
        <button onClick={() => { setLoading(true); load() }} className="btn-ghost" style={{ fontSize: 12, padding: "8px 14px" }}>
          ↻ Atualizar
        </button>
      </div>

      {loading ? (
        <p className="text-center mt-12" style={{ color: "#9CA3AF" }}>Carregando pedidos...</p>
      ) : pedidos.length === 0 ? (
        <div className="text-center mt-16">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px" }}><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
          <p className="font-bold" style={{ color: "#111827" }}>Nenhum pedido hoje</p>
          <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>Novos pedidos aparecerão aqui automaticamente</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Novos pedidos — destaque */}
          {pendentes.map(p => (
            <div key={p.id} className="card p-5"
              style={{ border: "1px solid rgba(249,115,22,0.5)", background: "rgba(249,115,22,0.05)", animation: "pulse 2s infinite" }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="badge badge-orange" style={{ fontSize: 11 }}>NOVO PEDIDO</span>
                  <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
                    #{p.codigo} · {new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <p className="text-2xl font-black" style={{ color: "#111827" }}>R$ {p.total.toFixed(2)}</p>
              </div>

              {p.itens && p.itens.length > 0 && (
                <div className="mb-3 flex flex-col gap-1">
                  {p.itens.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span style={{ color: "#374151" }}>{item.quantidade}x {item.nome}</span>
                      <span style={{ color: "#9CA3AF" }}>R$ {(item.preco * item.quantidade).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: "#9CA3AF" }}>
                <span>{PAGAMENTO_ICON[p.forma_pagamento] ?? p.forma_pagamento}</span>
                <span>·</span>
                <span>📍 {p.endereco_entrega}</span>
              </div>

              {p.nome_cliente && (
                <p className="text-xs mb-3" style={{ color: "#6B7280" }}>
                  Cliente: {p.nome_cliente}{p.telefone_cliente ? ` · ${p.telefone_cliente}` : ""}
                </p>
              )}

              {p.observacao && (
                <p className="text-xs italic mb-3 px-3 py-2 rounded-lg"
                  style={{ background: "#F3F4F6", color: "#6B7280" }}>
                  💬 {p.observacao}
                </p>
              )}

              <div className="flex gap-2">
                <button onClick={() => avancarStatus(p.id, p.status)} disabled={!!atualizando}
                  className="btn-primary flex-1 justify-center">
                  {atualizando === p.id ? "..." : PROXIMO_LABEL[p.status]}
                </button>
                <BotaoImprimir pedido={p} />
                <button onClick={() => cancelar(p.id)} disabled={!!atualizando}
                  className="btn-ghost justify-center"
                  style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)", padding: "11px 16px" }}>
                  ✕
                </button>
              </div>
            </div>
          ))}

          {/* Em andamento */}
          {emAndamento.map(p => (
            <div key={p.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="badge badge-blue">{STATUS_LABEL[p.status]}</span>
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>#{p.codigo}</span>
                </div>
                <p className="font-bold" style={{ color: "#111827" }}>R$ {p.total.toFixed(2)}</p>
              </div>

              {p.itens && (
                <p className="text-xs mb-3" style={{ color: "#9CA3AF" }}>
                  {p.itens.map((i: any) => `${i.quantidade}x ${i.nome}`).join(", ")}
                </p>
              )}

              <div className="flex gap-2 flex-wrap">
                {PROXIMO_STATUS[p.status] && (
                  <button onClick={() => avancarStatus(p.id, p.status)} disabled={!!atualizando}
                    className="btn-ghost flex-1 justify-center" style={{ fontSize: 12 }}>
                    {atualizando === p.id ? "..." : PROXIMO_LABEL[p.status]}
                  </button>
                )}

                {p.status === "pronto" && !p.motoboy_id && (
                  <button
                    onClick={() => chamarMotoboy(p.id)}
                    disabled={!!atualizando}
                    className="btn-primary flex-1 justify-center"
                    style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}
                  >
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
