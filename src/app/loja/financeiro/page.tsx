"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

const inp: React.CSSProperties = {
  width: "100%", padding: "10px 13px", borderRadius: 10, fontSize: 14,
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  color: "white", outline: "none", boxSizing: "border-box",
}

export default function LojaFinanceiroPage() {
  const { sessao } = useAuth()
  const loja_id = sessao?.role === "lojista" ? sessao.loja_id : null

  const [loja,              setLoja]              = useState<any>(null)
  const [saldo,             setSaldo]             = useState(0)
  const [receitaBruta,      setReceitaBruta]      = useState(0)
  const [totalComissao,     setTotalComissao]     = useState(0)
  const [totalMensalidades, setTotalMensalidades] = useState(0)
  const [totalSaquesPagos,  setTotalSaquesPagos]  = useState(0)
  const [saques,            setSaques]            = useState<any[]>([])
  const [pedidos,           setPedidos]           = useState<any[]>([])
  const [mensalidades,      setMensalidades]      = useState<any[]>([])
  const [loading,           setLoading]           = useState(true)

  const [solicitando,   setSolicitando]   = useState(false)
  const [valorSaque,    setValorSaque]    = useState("")
  const [enviandoSaque, setEnviandoSaque] = useState(false)
  const [erroSaque,     setErroSaque]     = useState("")
  const [saqueSucesso,  setSaqueSucesso]  = useState(false)

  async function load() {
    if (!loja_id) return

    const { data: lojaData } = await supabase.from("lojas").select("*").eq("id", loja_id).single()
    setLoja(lojaData)
    const comissao_pct = lojaData?.comissao ?? 0

    const { data: ped } = await supabase
      .from("pedidos").select("id, codigo, subtotal, criado_em")
      .eq("loja_id", loja_id).eq("status", "entregue")
      .order("criado_em", { ascending: false })
    const pedidosList = ped ?? []
    setPedidos(pedidosList.slice(0, 30))

    const bruta       = pedidosList.reduce((s, p) => s + (p.subtotal ?? 0), 0)
    const comissaoTot = bruta * comissao_pct / 100
    setReceitaBruta(bruta)
    setTotalComissao(comissaoTot)

    const { data: mens } = await supabase
      .from("mensalidades").select("*").eq("loja_id", loja_id)
      .order("criado_em", { ascending: false })
    setMensalidades(mens ?? [])
    const mensTot = (mens ?? []).filter(m => m.status === "descontado").reduce((s, m) => s + m.valor, 0)
    setTotalMensalidades(mensTot)

    const { data: saq } = await supabase
      .from("saques").select("*").eq("loja_id", loja_id).eq("tipo", "lojista")
      .order("criado_em", { ascending: false })
    setSaques(saq ?? [])

    const pagosTot      = (saq ?? []).filter(s => s.status === "pago").reduce((s, x) => s + x.valor, 0)
    const solicitadoTot = (saq ?? []).filter(s => s.status === "solicitado").reduce((s, x) => s + x.valor, 0)
    setTotalSaquesPagos(pagosTot)

    const liquida = bruta - comissaoTot
    setSaldo(Math.max(0, liquida - mensTot - pagosTot - solicitadoTot))
    setLoading(false)
  }

  useEffect(() => { load() }, [loja_id])

  async function solicitarSaque() {
    const valor = parseFloat(valorSaque.replace(",", "."))
    if (!valor || valor <= 0) { setErroSaque("Informe um valor válido"); return }
    if (valor > saldo + 0.001) { setErroSaque("Valor maior que o saldo disponível"); return }
    if (!loja?.pix_chave) { setErroSaque("Cadastre sua chave PIX no perfil antes de solicitar"); return }
    setErroSaque(""); setEnviandoSaque(true)
    const { error } = await supabase.from("saques").insert({
      tipo: "lojista", loja_id, valor, pix_chave: loja.pix_chave, status: "solicitado",
    })
    setEnviandoSaque(false)
    if (error) { setErroSaque(error.message); return }
    setValorSaque(""); setSolicitando(false)
    setSaqueSucesso(true); setTimeout(() => setSaqueSucesso(false), 5000)
    load()
  }

  if (loading) return <div style={{ padding: 40 }}><p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando...</p></div>

  const liquida    = receitaBruta - totalComissao
  const pendentes  = saques.filter(s => s.status === "solicitado")

  return (
    <div style={{ padding: "32px 36px", maxWidth: 860 }}>
      <h1 style={{ color: "white", fontWeight: 900, fontSize: 22, marginBottom: 4 }}>💰 Financeiro</h1>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginBottom: 28 }}>
        Extrato e saques da sua loja
      </p>

      {/* Aviso sem PIX */}
      {!loja?.pix_chave && (
        <div style={{
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: 14, padding: "14px 18px", marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <p style={{ color: "#f59e0b", fontSize: 13, fontWeight: 600 }}>
            ⚠️ Você não tem chave PIX cadastrada — sem ela não é possível solicitar saques.
          </p>
          <Link href="/loja/perfil" style={{ color: "#f97316", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", textDecoration: "none" }}>
            Cadastrar →
          </Link>
        </div>
      )}

      {/* Sucesso saque */}
      {saqueSucesso && (
        <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
          <p style={{ color: "#22c55e", fontWeight: 700, fontSize: 13 }}>✅ Saque solicitado! O admin irá processar em até 2 dias úteis.</p>
        </div>
      )}

      {/* Cards de resumo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Saldo disponível", value: saldo, color: saldo > 0 ? "#22c55e" : "white", big: true },
          { label: "Receita líquida",  value: liquida, color: "#60a5fa" },
          { label: "Comissão paga",    value: totalComissao, color: "rgba(255,255,255,0.6)" },
          { label: "Total sacado",     value: totalSaquesPagos, color: "rgba(255,255,255,0.6)" },
        ].map(c => (
          <div key={c.label} style={{ background: "#111", borderRadius: 16, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>{c.label}</p>
            <p style={{ color: c.color, fontWeight: 900, fontSize: c.big ? 26 : 20 }}>R$ {c.value.toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Plano atual */}
      <div style={{ background: "#111", borderRadius: 14, padding: "14px 18px", marginBottom: 20, border: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 24 }}>
        <div>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>COMISSÃO POR PEDIDO</p>
          <p style={{ color: "#f97316", fontWeight: 900, fontSize: 18 }}>{loja?.comissao ?? 0}%</p>
        </div>
        <div>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>MENSALIDADE</p>
          <p style={{ color: "#f97316", fontWeight: 900, fontSize: 18 }}>R$ {Number(loja?.plano_mensalidade ?? 0).toFixed(2)}</p>
        </div>
        <div>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>PIX CADASTRADO</p>
          <p style={{ color: loja?.pix_chave ? "white" : "#f87171", fontWeight: 700, fontSize: 14 }}>
            {loja?.pix_chave ?? "Não cadastrado"}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Coluna esquerda */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Solicitar saque */}
          <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ color: "white", fontWeight: 700 }}>Solicitar saque</p>
              {!solicitando && (
                <button onClick={() => { setSolicitando(true); setErroSaque("") }}
                  disabled={saldo <= 0 || !loja?.pix_chave}
                  style={{
                    padding: "7px 16px", borderRadius: 10, border: "none", cursor: saldo <= 0 || !loja?.pix_chave ? "not-allowed" : "pointer",
                    background: saldo > 0 && loja?.pix_chave ? "#f97316" : "rgba(255,255,255,0.08)",
                    color: saldo > 0 && loja?.pix_chave ? "white" : "rgba(255,255,255,0.25)",
                    fontWeight: 700, fontSize: 13,
                  }}>
                  + Novo saque
                </button>
              )}
            </div>
            {solicitando ? (
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>
                    Valor (saldo: R$ {saldo.toFixed(2)})
                  </label>
                  <input style={inp} type="number" step="0.01" min="0.01" placeholder="0,00"
                    value={valorSaque} onChange={e => setValorSaque(e.target.value)} />
                </div>
                <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>PIX: <strong style={{ color: "white" }}>{loja?.pix_chave}</strong></p>
                  <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 3 }}>Prazo: até 2 dias úteis</p>
                </div>
                {erroSaque && <p style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>{erroSaque}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={solicitarSaque} disabled={enviandoSaque} style={{
                    flex: 1, padding: "11px", borderRadius: 10, border: "none",
                    background: enviandoSaque ? "rgba(249,115,22,0.4)" : "#f97316",
                    color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer",
                  }}>
                    {enviandoSaque ? "Enviando..." : "Confirmar saque"}
                  </button>
                  <button onClick={() => { setSolicitando(false); setErroSaque("") }} style={{
                    padding: "11px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
                    background: "transparent", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13,
                  }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "14px 18px" }}>
                {pendentes.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Nenhum saque pendente</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {pendentes.map(s => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>R$ {Number(s.valor).toFixed(2)}</p>
                          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                            {new Date(s.criado_em).toLocaleDateString("pt-BR")} · {s.pix_chave}
                          </p>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                          Aguardando
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Histórico de saques */}
          <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ color: "white", fontWeight: 700 }}>Histórico de saques</p>
            </div>
            <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
              {saques.filter(s => s.status !== "solicitado").length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Nenhum saque realizado ainda</p>
              ) : saques.filter(s => s.status !== "solicitado").map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div>
                    <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>R$ {Number(s.valor).toFixed(2)}</p>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                      {new Date(s.criado_em).toLocaleDateString("pt-BR")}
                      {s.pago_em && ` · Pago em ${new Date(s.pago_em).toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                    background: s.status === "pago" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                    color: s.status === "pago" ? "#22c55e" : "#f87171",
                  }}>
                    {s.status === "pago" ? "Pago" : "Cancelado"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Mensalidades */}
          {mensalidades.length > 0 && (
            <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ color: "white", fontWeight: 700 }}>Mensalidades</p>
              </div>
              <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                {mensalidades.map(m => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ color: "white", fontWeight: 600, fontSize: 13 }}>R$ {Number(m.valor).toFixed(2)}</p>
                      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Ref. {m.referencia}</p>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                      background: m.status === "descontado" ? "rgba(239,68,68,0.12)" : m.status === "dispensado" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                      color: m.status === "descontado" ? "#f87171" : m.status === "dispensado" ? "#22c55e" : "#f59e0b",
                    }}>
                      {m.status === "descontado" ? "Descontado" : m.status === "dispensado" ? "Dispensado" : "Pendente"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Coluna direita — Extrato de pedidos */}
        <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ color: "white", fontWeight: 700 }}>Extrato de pedidos</p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 }}>Últimos {pedidos.length} entregues</p>
          </div>
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {pedidos.length === 0 ? (
              <div style={{ padding: "24px 18px", textAlign: "center" }}>
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Nenhum pedido entregue ainda</p>
              </div>
            ) : pedidos.map(p => {
              const comissao_pct = loja?.comissao ?? 0
              const comissaoValor = p.subtotal * comissao_pct / 100
              const liquido = p.subtotal - comissaoValor
              return (
                <div key={p.id} style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 13 }}>#{p.codigo}</p>
                    <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
                      {new Date(p.criado_em).toLocaleDateString("pt-BR")} · Bruto R$ {Number(p.subtotal).toFixed(2)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: "#22c55e", fontWeight: 800, fontSize: 14 }}>+R$ {liquido.toFixed(2)}</p>
                    <p style={{ color: "#f87171", fontSize: 11 }}>−R$ {comissaoValor.toFixed(2)} comissão</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
