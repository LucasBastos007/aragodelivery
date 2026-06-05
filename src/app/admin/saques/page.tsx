"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Filtro = "todos" | "solicitado" | "pago" | "cancelado"
type Tipo   = "todos" | "lojista" | "motoboy"

export default function AdminSaquesPage() {
  const [saques,   setSaques]   = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filtro,   setFiltro]   = useState<Filtro>("solicitado")
  const [tipo,     setTipo]     = useState<Tipo>("todos")
  const [processando, setProcessando] = useState<string | null>(null)

  // Painel de mensalidades
  const [lojas,      setLojas]      = useState<any[]>([])
  const [abaAtiva,   setAbaAtiva]   = useState<"saques" | "mensalidades" | "planos">("saques")
  const [mensalidades, setMensalidades] = useState<any[]>([])
  const [gerandoMens, setGerandoMens] = useState<string | null>(null)

  // Planos
  const [editandoPlano, setEditandoPlano] = useState<string | null>(null)
  const [planoMens,     setPlanoMens]     = useState("")
  const [planoComissao, setPlanoComissao] = useState("")
  const [salvandoPlano, setSalvandoPlano] = useState(false)

  async function load() {
    const [{ data: saq }, { data: loj }, { data: mens }] = await Promise.all([
      supabase.from("saques").select("*, loja:lojas(nome), motoboy:motoboys(nome)").order("criado_em", { ascending: false }),
      supabase.from("lojas").select("id, nome, comissao, plano_mensalidade, pix_chave").eq("status", "ativo").order("nome"),
      supabase.from("mensalidades").select("*, loja:lojas(nome)").order("criado_em", { ascending: false }),
    ])
    setSaques(saq ?? [])
    setLojas(loj ?? [])
    setMensalidades(mens ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function marcarPago(id: string) {
    setProcessando(id)
    await supabase.from("saques").update({ status: "pago", pago_em: new Date().toISOString() }).eq("id", id)
    await load()
    setProcessando(null)
  }

  async function cancelarSaque(id: string) {
    if (!confirm("Cancelar este saque?")) return
    setProcessando(id)
    await supabase.from("saques").update({ status: "cancelado" }).eq("id", id)
    await load()
    setProcessando(null)
  }

  async function gerarMensalidade(loja: any) {
    const ref = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
    const jaExiste = mensalidades.some(m => m.loja_id === loja.id && m.referencia === ref)
    if (jaExiste) { alert(`Mensalidade ${ref} já gerada para ${loja.nome}`); return }
    setGerandoMens(loja.id)
    await supabase.from("mensalidades").insert({ loja_id: loja.id, valor: loja.plano_mensalidade ?? 0, referencia: ref, status: "pendente" })
    await load()
    setGerandoMens(null)
  }

  async function atualizarStatusMensalidade(id: string, status: string) {
    setProcessando(id)
    await supabase.from("mensalidades").update({ status }).eq("id", id)
    await load()
    setProcessando(null)
  }

  async function salvarPlano(loja_id: string) {
    setSalvandoPlano(true)
    await supabase.from("lojas").update({
      comissao:          parseFloat(planoComissao) || 0,
      plano_mensalidade: parseFloat(planoMens) || 0,
    }).eq("id", loja_id)
    setSalvandoPlano(false)
    setEditandoPlano(null)
    load()
  }

  const saquesFiltrados = saques.filter(s => {
    const okFiltro = filtro === "todos" || s.status === filtro
    const okTipo   = tipo   === "todos" || s.tipo   === tipo
    return okFiltro && okTipo
  })

  const totalPendente  = saques.filter(s => s.status === "solicitado").reduce((a, s) => a + s.valor, 0)
  const totalPagoHoje  = saques.filter(s => s.status === "pago").reduce((a, s) => a + s.valor, 0)

  const ref = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`

  return (
    <div style={{ padding: "32px 36px", maxWidth: 980 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: "white", fontWeight: 900, fontSize: 22 }}>💸 Financeiro — Admin</h1>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 3 }}>Saques, mensalidades e planos</p>
      </div>

      {/* Cards resumo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <div style={{ background: "#111", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(245,158,11,0.2)" }}>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>AGUARDANDO PAGAMENTO</p>
          <p style={{ color: "#f59e0b", fontWeight: 900, fontSize: 26 }}>R$ {totalPendente.toFixed(2)}</p>
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, marginTop: 4 }}>
            {saques.filter(s => s.status === "solicitado").length} solicitações
          </p>
        </div>
        <div style={{ background: "#111", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(34,197,94,0.15)" }}>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>TOTAL JÁ PAGO</p>
          <p style={{ color: "#22c55e", fontWeight: 900, fontSize: 26 }}>R$ {totalPagoHoje.toFixed(2)}</p>
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, marginTop: 4 }}>
            {saques.filter(s => s.status === "pago").length} pagamentos
          </p>
        </div>
        <div style={{ background: "#111", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>MENSALIDADES PENDENTES</p>
          <p style={{ color: "#f97316", fontWeight: 900, fontSize: 26 }}>
            {mensalidades.filter(m => m.status === "pendente").length}
          </p>
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, marginTop: 4 }}>aguardando desconto</p>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {([["saques", "💸 Saques"], ["mensalidades", "📅 Mensalidades"], ["planos", "⚙️ Planos das lojas"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setAbaAtiva(key)} style={{
            padding: "8px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
            background: abaAtiva === key ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.05)",
            color: abaAtiva === key ? "#f97316" : "rgba(255,255,255,0.4)",
            outline: abaAtiva === key ? "1px solid rgba(249,115,22,0.35)" : "none",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ABA: SAQUES */}
      {abaAtiva === "saques" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {(["todos", "solicitado", "pago", "cancelado"] as Filtro[]).map(f => (
              <button key={f} onClick={() => setFiltro(f)} style={{
                padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12,
                background: filtro === f ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.05)",
                color: filtro === f ? "#f97316" : "rgba(255,255,255,0.4)",
                outline: filtro === f ? "1px solid rgba(249,115,22,0.3)" : "none",
              }}>
                {f === "todos" ? "Todos" : f === "solicitado" ? "Pendentes" : f === "pago" ? "Pagos" : "Cancelados"}
              </button>
            ))}
            <div style={{ width: 1, background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />
            {(["todos", "lojista", "motoboy"] as Tipo[]).map(t => (
              <button key={t} onClick={() => setTipo(t)} style={{
                padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12,
                background: tipo === t ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.05)",
                color: tipo === t ? "#60a5fa" : "rgba(255,255,255,0.4)",
                outline: tipo === t ? "1px solid rgba(96,165,250,0.3)" : "none",
              }}>
                {t === "todos" ? "Todos" : t === "lojista" ? "Lojistas" : "Motoboys"}
              </button>
            ))}
          </div>

          {loading ? (
            <p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando...</p>
          ) : saquesFiltrados.length === 0 ? (
            <div style={{ textAlign: "center", marginTop: 48 }}>
              <p style={{ fontSize: 36, marginBottom: 12 }}>✅</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Nenhum saque encontrado</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {saquesFiltrados.map(s => (
                <div key={s.id} style={{
                  background: "#111", borderRadius: 14, padding: "16px 18px",
                  border: s.status === "solicitado" ? "1px solid rgba(245,158,11,0.25)" : "1px solid rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                        background: s.tipo === "lojista" ? "rgba(249,115,22,0.12)" : "rgba(96,165,250,0.12)",
                        color: s.tipo === "lojista" ? "#f97316" : "#60a5fa",
                      }}>
                        {s.tipo === "lojista" ? "🏪 Lojista" : "🛵 Motoboy"}
                      </span>
                      <p style={{ color: "white", fontWeight: 800, fontSize: 16 }}>
                        R$ {Number(s.valor).toFixed(2)}
                      </p>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                        background: s.status === "pago" ? "rgba(34,197,94,0.12)" : s.status === "solicitado" ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)",
                        color: s.status === "pago" ? "#22c55e" : s.status === "solicitado" ? "#f59e0b" : "#f87171",
                      }}>
                        {s.status === "pago" ? "Pago" : s.status === "solicitado" ? "Aguardando" : "Cancelado"}
                      </span>
                    </div>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600 }}>
                      {s.loja?.nome ?? s.motoboy?.nome ?? "—"}
                    </p>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 3, flexWrap: "wrap" }}>
                      <span>PIX: <strong style={{ color: "rgba(255,255,255,0.6)" }}>{s.pix_chave}</strong></span>
                      <span>· Solicitado {new Date(s.criado_em).toLocaleDateString("pt-BR")}</span>
                      {s.pago_em && <span>· Pago {new Date(s.pago_em).toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </div>
                  {s.status === "solicitado" && (
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => marcarPago(s.id)} disabled={processando === s.id}
                        style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#22c55e", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                        {processando === s.id ? "..." : "✓ Marcar pago"}
                      </button>
                      <button onClick={() => cancelarSaque(s.id)} disabled={processando === s.id}
                        style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)", color: "#f87171", fontSize: 12, cursor: "pointer" }}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ABA: MENSALIDADES */}
      {abaAtiva === "mensalidades" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
              Referência atual: <strong style={{ color: "white" }}>{ref}</strong>
            </p>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            {/* Gerar mensalidades */}
            <div style={{ width: 260, flexShrink: 0 }}>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, marginBottom: 12, textTransform: "uppercase" }}>
                Gerar mensalidade ({ref})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {lojas.map(l => {
                  const jaGerou = mensalidades.some(m => m.loja_id === l.id && m.referencia === ref)
                  return (
                    <div key={l.id} style={{ background: "#111", borderRadius: 10, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ color: "white", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nome}</p>
                        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>R$ {Number(l.plano_mensalidade ?? 0).toFixed(2)}</p>
                      </div>
                      {jaGerou ? (
                        <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, whiteSpace: "nowrap" }}>✓ Gerada</span>
                      ) : (
                        <button onClick={() => gerarMensalidade(l)} disabled={gerandoMens === l.id}
                          style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "#f97316", color: "white", fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
                          {gerandoMens === l.id ? "..." : "Gerar"}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Lista de mensalidades */}
            <div style={{ flex: 1 }}>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, marginBottom: 12, textTransform: "uppercase" }}>
                Todas as mensalidades
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {mensalidades.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Nenhuma mensalidade gerada ainda</p>
                ) : mensalidades.map(m => (
                  <div key={m.id} style={{
                    background: "#111", borderRadius: 12, padding: "14px 16px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>{m.loja?.nome ?? "—"}</p>
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>· {m.referencia}</span>
                      </div>
                      <p style={{ color: "#f97316", fontWeight: 800, fontSize: 15 }}>R$ {Number(m.valor).toFixed(2)}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                        background: m.status === "descontado" ? "rgba(239,68,68,0.12)" : m.status === "dispensado" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                        color: m.status === "descontado" ? "#f87171" : m.status === "dispensado" ? "#22c55e" : "#f59e0b",
                      }}>
                        {m.status === "descontado" ? "Descontado" : m.status === "dispensado" ? "Dispensado" : "Pendente"}
                      </span>
                      {m.status === "pendente" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => atualizarStatusMensalidade(m.id, "descontado")} disabled={processando === m.id}
                            style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "#ef4444", color: "white", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                            Descontar
                          </button>
                          <button onClick={() => atualizarStatusMensalidade(m.id, "dispensado")} disabled={processando === m.id}
                            style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>
                            Dispensar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ABA: PLANOS */}
      {abaAtiva === "planos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lojas.map(l => (
            <div key={l.id} style={{ background: "#111", borderRadius: 14, padding: "16px 18px", border: "1px solid rgba(255,255,255,0.07)" }}>
              {editandoPlano === l.id ? (
                <div>
                  <p style={{ color: "white", fontWeight: 700, marginBottom: 14 }}>{l.nome}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>
                        Mensalidade (R$)
                      </label>
                      <input
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 9, fontSize: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white", outline: "none", boxSizing: "border-box" as const }}
                        type="number" step="0.01" min="0"
                        value={planoMens} onChange={e => setPlanoMens(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>
                        Comissão por pedido (%)
                      </label>
                      <input
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 9, fontSize: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white", outline: "none", boxSizing: "border-box" as const }}
                        type="number" step="0.1" min="0" max="100"
                        value={planoComissao} onChange={e => setPlanoComissao(e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => salvarPlano(l.id)} disabled={salvandoPlano}
                      style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: "#f97316", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      {salvandoPlano ? "Salvando..." : "✓ Salvar"}
                    </button>
                    <button onClick={() => setEditandoPlano(null)}
                      style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer" }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ color: "white", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{l.nome}</p>
                    <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>
                        Mensalidade: <strong style={{ color: "#f97316" }}>R$ {Number(l.plano_mensalidade ?? 0).toFixed(2)}</strong>
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>
                        Comissão: <strong style={{ color: "#f97316" }}>{l.comissao ?? 0}%</strong>
                      </span>
                      {l.pix_chave && (
                        <span style={{ color: "rgba(255,255,255,0.4)" }}>
                          PIX: <strong style={{ color: "white" }}>{l.pix_chave}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => { setEditandoPlano(l.id); setPlanoMens(String(l.plano_mensalidade ?? 0)); setPlanoComissao(String(l.comissao ?? 0)) }}
                    style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Editar plano
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
