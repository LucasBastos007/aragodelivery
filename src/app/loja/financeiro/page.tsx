"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

const inp: React.CSSProperties = {
  width: "100%", padding: "10px 13px", borderRadius: 10, fontSize: 14,
  background: "#F9FAFB", border: "1px solid #E5E7EB",
  color: "#111827", outline: "none", boxSizing: "border-box",
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
    if (!loja?.pix_key) { setErroSaque("Cadastre sua chave PIX no perfil antes de solicitar"); return }
    setErroSaque(""); setEnviandoSaque(true)
    const res = await fetch("/api/loja/saque", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor }),
    })
    const data = await res.json()
    setEnviandoSaque(false)
    if (!res.ok) { setErroSaque(data.error ?? "Erro ao solicitar saque"); return }
    setValorSaque(""); setSolicitando(false)
    setSaqueSucesso(true); setTimeout(() => setSaqueSucesso(false), 5000)
    load()
  }

  if (loading) return <div style={{ padding: 40 }}><p style={{ color: "#9CA3AF" }}>Carregando...</p></div>

  const liquida    = receitaBruta - totalComissao
  const pendentes  = saques.filter(s => s.status === "solicitado")

  return (
    <div style={{ padding: "24px 16px", maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ color: "#111827", fontWeight: 900, fontSize: 20, marginBottom: 4 }}>Financeiro</h1>
      <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 24 }}>
        Extrato e saques da sua loja
      </p>

      {/* Aviso sem PIX */}
      {!loja?.pix_key && (
        <div style={{
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: 14, padding: "14px 16px", marginBottom: 20,
          display: "flex", alignItems: "flex-start", flexWrap: "wrap", justifyContent: "space-between", gap: 10,
        }}>
          <p style={{ color: "#f59e0b", fontSize: 13, fontWeight: 600, flex: 1, minWidth: 200 }}>
            Atenção: você não tem chave PIX cadastrada — sem ela não é possível solicitar saques.
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Saldo disponível", value: saldo, color: saldo > 0 ? "#22c55e" : "#111827", big: true },
          { label: "Receita líquida",  value: liquida, color: "#60a5fa" },
          { label: "Comissão paga",    value: totalComissao, color: "#6B7280" },
          { label: "Total sacado",     value: totalSaquesPagos, color: "#6B7280" },
        ].map(c => (
          <div key={c.label} style={{ background: "#ffffff", borderRadius: 16, padding: "14px 16px", border: "1px solid #e5e7eb" }}>
            <p style={{ color: "#6B7280", fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>{c.label}</p>
            <p style={{ color: c.color, fontWeight: 900, fontSize: c.big ? 20 : 16, wordBreak: "break-all" }}>R$ {c.value.toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Plano atual */}
      <div style={{ background: "#ffffff", borderRadius: 14, padding: "14px 16px", marginBottom: 20, border: "1px solid #e5e7eb", display: "flex", flexWrap: "wrap", gap: 20 }}>
        <div>
          <p style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>COMISSÃO POR PEDIDO</p>
          <p style={{ color: "#f97316", fontWeight: 900, fontSize: 18 }}>{loja?.comissao ?? 0}%</p>
        </div>
        <div>
          <p style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>MENSALIDADE</p>
          <p style={{ color: "#f97316", fontWeight: 900, fontSize: 18 }}>R$ {Number(loja?.plano_mensalidade ?? 0).toFixed(2)}</p>
        </div>
        <div>
          <p style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>CHAVE PIX</p>
          <p style={{ color: loja?.pix_key ? "#111827" : "#f87171", fontWeight: 700, fontSize: 14 }}>
            {loja?.pix_key ?? "Não cadastrado"}
          </p>
        </div>
        {loja?.banco && (
          <div>
            <p style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>DADOS BANCÁRIOS</p>
            <p style={{ color: "#111827", fontWeight: 700, fontSize: 13 }}>{loja.banco}</p>
            <p style={{ color: "#6B7280", fontSize: 12 }}>
              {loja.banco_tipo_conta ?? "Corrente"} · Ag: {loja.banco_agencia} · Cc: {loja.banco_conta}
            </p>
          </div>
        )}
      </div>

      {/* Repasse */}
      <div style={{
        background: loja?.asaas_wallet_id ? "#ECFDF5" : "#FFF7ED",
        border: `1.5px solid ${loja?.asaas_wallet_id ? "#A7F3D0" : "#FED7AA"}`,
        borderRadius: 14, padding: "14px 16px", marginBottom: 20,
        display: "flex", alignItems: "flex-start", gap: 12,
      }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{loja?.asaas_wallet_id ? "⚡" : "🏦"}</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: loja?.asaas_wallet_id ? "#059669" : "#d97706", marginBottom: 2 }}>
            {loja?.asaas_wallet_id ? "Repasse automático (split)" : "Repasse manual (saque)"}
          </p>
          <p style={{ fontSize: 12, color: "#6B7280" }}>
            {loja?.asaas_wallet_id
              ? `Você recebe ${100 - (loja?.comissao ?? 0)}% de cada pedido diretamente na sua conta Asaas, sem precisar solicitar saque.`
              : "Seus ganhos acumulam aqui e você solicita saque manualmente. Em breve será migrado para repasse automático."}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
        {/* Coluna esquerda */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Solicitar saque */}
          <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ color: "#111827", fontWeight: 700 }}>Solicitar saque</p>
              {!solicitando && (
                <button onClick={() => { setSolicitando(true); setErroSaque("") }}
                  disabled={saldo <= 0 || !loja?.pix_key}
                  style={{
                    padding: "7px 16px", borderRadius: 10, border: "none", cursor: saldo <= 0 || !loja?.pix_key ? "not-allowed" : "pointer",
                    background: saldo > 0 && loja?.pix_key ? "#f97316" : "#F3F4F6",
                    color: saldo > 0 && loja?.pix_key ? "white" : "#9CA3AF",
                    fontWeight: 700, fontSize: 13,
                  }}>
                  + Novo saque
                </button>
              )}
            </div>
            {solicitando ? (
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", color: "#6B7280", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>
                    Valor (saldo: R$ {saldo.toFixed(2)})
                  </label>
                  <input style={inp} type="number" step="0.01" min="0.01" placeholder="0,00"
                    value={valorSaque} onChange={e => setValorSaque(e.target.value)} />
                </div>
                <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ color: "#6B7280", fontSize: 12 }}>PIX: <strong style={{ color: "#111827" }}>{loja?.pix_key}</strong></p>
                  <p style={{ color: "#9CA3AF", fontSize: 11, marginTop: 3 }}>Prazo: até 2 dias úteis</p>
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
                    padding: "11px 16px", borderRadius: 10, border: "1px solid #E5E7EB",
                    background: "transparent", color: "#6B7280", cursor: "pointer", fontSize: 13,
                  }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "14px 18px" }}>
                {pendentes.length === 0 ? (
                  <p style={{ color: "#9CA3AF", fontSize: 13 }}>Nenhum saque pendente</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {pendentes.map(s => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>R$ {Number(s.valor).toFixed(2)}</p>
                          <p style={{ color: "#9CA3AF", fontSize: 12 }}>
                            {new Date(s.criado_em).toLocaleDateString("pt-BR")} · {s.pix_key}
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
          <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb" }}>
              <p style={{ color: "#111827", fontWeight: 700 }}>Histórico de saques</p>
            </div>
            <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
              {saques.filter(s => s.status !== "solicitado").length === 0 ? (
                <p style={{ color: "#9CA3AF", fontSize: 13 }}>Nenhum saque realizado ainda</p>
              ) : saques.filter(s => s.status !== "solicitado").map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>
                  <div>
                    <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>R$ {Number(s.valor).toFixed(2)}</p>
                    <p style={{ color: "#9CA3AF", fontSize: 12 }}>
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
            <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb" }}>
                <p style={{ color: "#111827", fontWeight: 700 }}>Mensalidades</p>
              </div>
              <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                {mensalidades.map(m => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ color: "#111827", fontWeight: 600, fontSize: 13 }}>R$ {Number(m.valor).toFixed(2)}</p>
                      <p style={{ color: "#9CA3AF", fontSize: 12 }}>Ref. {m.referencia}</p>
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
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb" }}>
            <p style={{ color: "#111827", fontWeight: 700 }}>Extrato de pedidos</p>
            <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>Últimos {pedidos.length} entregues</p>
          </div>
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {pedidos.length === 0 ? (
              <div style={{ padding: "24px 18px", textAlign: "center" }}>
                <p style={{ color: "#9CA3AF", fontSize: 13 }}>Nenhum pedido entregue ainda</p>
              </div>
            ) : pedidos.map(p => {
              const comissao_pct = loja?.comissao ?? 0
              const comissaoValor = p.subtotal * comissao_pct / 100
              const liquido = p.subtotal - comissaoValor
              return (
                <div key={p.id} style={{ padding: "12px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ color: "#374151", fontWeight: 700, fontSize: 13 }}>#{p.codigo}</p>
                    <p style={{ color: "#9CA3AF", fontSize: 11 }}>
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
