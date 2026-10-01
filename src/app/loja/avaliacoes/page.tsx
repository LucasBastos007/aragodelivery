"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

interface Avaliacao {
  id: string; pedido_id: string; nota_loja: number | null; comentario: string | null
  resposta_loja: string | null; respondido_em: string | null; criado_em: string
  pedidoCodigo?: string; clienteNome?: string
}

function Estrelas({ nota }: { nota: number | null }) {
  if (nota == null) return null
  return (
    <div style={{ display: "flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i <= nota ? "#f59e0b" : "#E5E7EB"} stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  )
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function LojaAvaliacoesPage() {
  const { sessao } = useAuth()
  const loja_id = sessao?.role === "lojista" ? sessao.loja_id : null

  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<"todas" | "sem_resposta">("todas")
  const [respondendoId, setRespondendoId] = useState<string | null>(null)
  const [textoResposta, setTextoResposta] = useState("")
  const [enviando, setEnviando] = useState(false)

  useEffect(() => { if (loja_id) carregar() }, [loja_id])

  async function carregar() {
    setLoading(true)
    const { data: avals } = await supabase
      .from("avaliacoes")
      .select("id, pedido_id, nota_loja, comentario, resposta_loja, respondido_em, criado_em")
      .eq("loja_id", loja_id)
      .not("nota_loja", "is", null)
      .order("criado_em", { ascending: false })
      .limit(200)

    const lista = (avals ?? []) as Avaliacao[]
    const pedidoIds = [...new Set(lista.map(a => a.pedido_id))]
    if (pedidoIds.length > 0) {
      const { data: pedidos } = await supabase.from("pedidos").select("id, codigo, cliente_id").in("id", pedidoIds)
      const clienteIds = [...new Set((pedidos ?? []).map((p: any) => p.cliente_id).filter(Boolean))]
      const { data: clientes } = clienteIds.length > 0
        ? await supabase.from("clientes").select("id, nome").in("id", clienteIds)
        : { data: [] as any[] }
      const pedidoPorId = new Map((pedidos ?? []).map((p: any) => [p.id, p]))
      const nomePorClienteId = new Map((clientes ?? []).map((c: any) => [c.id, c.nome]))
      for (const a of lista) {
        const p = pedidoPorId.get(a.pedido_id)
        a.pedidoCodigo = p?.codigo
        a.clienteNome = p?.cliente_id ? (nomePorClienteId.get(p.cliente_id)?.split(" ")[0] ?? "Cliente") : "Cliente"
      }
    }
    setAvaliacoes(lista)
    setLoading(false)
  }

  async function enviarResposta(id: string) {
    if (!textoResposta.trim()) return
    setEnviando(true)
    const res = await fetch("/api/loja/avaliacoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, resposta: textoResposta.trim() }),
    })
    setEnviando(false)
    if (res.ok) {
      setAvaliacoes(prev => prev.map(a => a.id === id ? { ...a, resposta_loja: textoResposta.trim(), respondido_em: new Date().toISOString() } : a))
      setRespondendoId(null)
      setTextoResposta("")
    }
  }

  const listaFiltrada = filtro === "sem_resposta" ? avaliacoes.filter(a => !a.resposta_loja) : avaliacoes
  const mediaGeral = avaliacoes.length > 0 ? avaliacoes.reduce((s, a) => s + (a.nota_loja ?? 0), 0) / avaliacoes.length : null

  return (
    <div style={{ padding: "32px 36px", maxWidth: 780 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ color: "#111827", fontWeight: 900, fontSize: 22 }}>⭐ Avaliações</h1>
          <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 3 }}>
            {mediaGeral != null ? `Nota média ${mediaGeral.toFixed(1)} · ${avaliacoes.length} avaliaç${avaliacoes.length === 1 ? "ão" : "ões"}` : "Comentários e notas dos seus clientes"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, background: "#F3F4F6", borderRadius: 10, padding: 3 }}>
          {([["todas", "Todas"], ["sem_resposta", "Sem resposta"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setFiltro(v)} style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: "none",
              background: filtro === v ? "#fff" : "transparent", color: filtro === v ? "#111827" : "#6B7280",
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#9CA3AF" }}>Carregando...</p>
      ) : listaFiltrada.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 48 }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>⭐</p>
          <p style={{ color: "#6B7280", fontWeight: 600 }}>
            {filtro === "sem_resposta" ? "Nenhuma avaliação pendente de resposta" : "Nenhuma avaliação ainda"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {listaFiltrada.map(a => (
            <div key={a.id} style={{ background: "#ffffff", borderRadius: 14, padding: "16px 18px", border: "1px solid #E5E7EB" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <Estrelas nota={a.nota_loja} />
                    <span style={{ color: "#111827", fontWeight: 700, fontSize: 13 }}>{a.clienteNome ?? "Cliente"}</span>
                  </div>
                  <p style={{ color: "#9CA3AF", fontSize: 11.5 }}>
                    {a.pedidoCodigo ? `Pedido #${a.pedidoCodigo} · ` : ""}{fmtData(a.criado_em)}
                  </p>
                </div>
              </div>
              {a.comentario && <p style={{ color: "#374151", fontSize: 13.5, lineHeight: 1.5, marginBottom: 10 }}>{a.comentario}</p>}

              {a.resposta_loja ? (
                <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 12px", borderLeft: "3px solid #f97316" }}>
                  <p style={{ color: "#f97316", fontWeight: 700, fontSize: 11.5, marginBottom: 3 }}>Sua resposta</p>
                  <p style={{ color: "#374151", fontSize: 13 }}>{a.resposta_loja}</p>
                </div>
              ) : respondendoId === a.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <textarea
                    value={textoResposta}
                    onChange={e => setTextoResposta(e.target.value)}
                    placeholder="Escreva uma resposta pro cliente..."
                    rows={2}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: "#F9FAFB", border: "1px solid #E5E7EB", fontSize: 13.5, color: "#111827", outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => enviarResposta(a.id)} disabled={enviando || !textoResposta.trim()} style={{
                      padding: "8px 16px", borderRadius: 8, border: "none",
                      background: enviando || !textoResposta.trim() ? "rgba(249,115,22,0.4)" : "#f97316",
                      color: "white", fontWeight: 700, fontSize: 12.5, cursor: enviando ? "not-allowed" : "pointer",
                    }}>
                      {enviando ? "Enviando..." : "Enviar resposta"}
                    </button>
                    <button onClick={() => { setRespondendoId(null); setTextoResposta("") }} style={{
                      padding: "8px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", color: "#6B7280", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
                    }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setRespondendoId(a.id); setTextoResposta("") }} style={{
                  padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(249,115,22,0.3)", background: "rgba(249,115,22,0.06)",
                  color: "#f97316", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
                }}>
                  Responder
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
