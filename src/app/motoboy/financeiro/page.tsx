"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

const MOTOBOY_PCT = 0.80

const inp: React.CSSProperties = {
  width: "100%", padding: "10px 13px", borderRadius: 10, fontSize: 14,
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  color: "white", outline: "none", boxSizing: "border-box",
}

export default function MotoboyFinanceiroPage() {
  const { sessao } = useAuth()
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null

  const [motoboy,         setMotoboy]         = useState<any>(null)
  const [saldo,           setSaldo]           = useState(0)
  const [totalGanhos,     setTotalGanhos]     = useState(0)
  const [totalSaquesPagos, setTotalSaquesPagos] = useState(0)
  const [saques,          setSaques]          = useState<any[]>([])
  const [entregas,        setEntregas]        = useState<any[]>([])
  const [loading,         setLoading]         = useState(true)

  const [editandoPix,   setEditandoPix]   = useState(false)
  const [pixInput,      setPixInput]      = useState("")
  const [salvandoPix,   setSalvandoPix]   = useState(false)

  const [solicitando,   setSolicitando]   = useState(false)
  const [valorSaque,    setValorSaque]    = useState("")
  const [enviandoSaque, setEnviandoSaque] = useState(false)
  const [erroSaque,     setErroSaque]     = useState("")
  const [saqueSucesso,  setSaqueSucesso]  = useState(false)

  async function load() {
    if (!motoboy_id) return

    const { data: mb } = await supabase.from("motoboys").select("*").eq("id", motoboy_id).single()
    setMotoboy(mb)
    setPixInput(mb?.pix_chave ?? "")

    const { data: ped } = await supabase
      .from("pedidos").select("id, codigo, taxa_entrega, criado_em, loja:lojas(nome)")
      .eq("motoboy_id", motoboy_id).eq("status", "entregue")
      .order("criado_em", { ascending: false })
    const pedList = ped ?? []
    setEntregas(pedList.slice(0, 30))

    const ganhos = pedList.reduce((s, p) => s + (p.taxa_entrega ?? 0) * MOTOBOY_PCT, 0)
    setTotalGanhos(ganhos)

    const { data: saq } = await supabase
      .from("saques").select("*").eq("motoboy_id", motoboy_id).eq("tipo", "motoboy")
      .order("criado_em", { ascending: false })
    setSaques(saq ?? [])

    const pagos      = (saq ?? []).filter(s => s.status === "pago").reduce((s, x) => s + x.valor, 0)
    const solicitado = (saq ?? []).filter(s => s.status === "solicitado").reduce((s, x) => s + x.valor, 0)
    setTotalSaquesPagos(pagos)
    setSaldo(Math.max(0, ganhos - pagos - solicitado))
    setLoading(false)
  }

  useEffect(() => { load() }, [motoboy_id])

  async function salvarPix() {
    if (!motoboy_id || !pixInput.trim()) return
    setSalvandoPix(true)
    await supabase.from("motoboys").update({ pix_chave: pixInput.trim() }).eq("id", motoboy_id)
    setSalvandoPix(false)
    setEditandoPix(false)
    load()
  }

  async function solicitarSaque() {
    const valor = parseFloat(valorSaque.replace(",", "."))
    if (!valor || valor <= 0) { setErroSaque("Informe um valor válido"); return }
    if (valor > saldo + 0.001) { setErroSaque("Valor maior que o saldo disponível"); return }
    if (!motoboy?.pix_chave) { setErroSaque("Cadastre sua chave PIX antes de solicitar"); return }
    setErroSaque(""); setEnviandoSaque(true)
    const { error } = await supabase.from("saques").insert({
      tipo: "motoboy", motoboy_id, valor, pix_chave: motoboy.pix_chave, status: "solicitado",
    })
    setEnviandoSaque(false)
    if (error) { setErroSaque(error.message); return }
    setValorSaque(""); setSolicitando(false)
    setSaqueSucesso(true); setTimeout(() => setSaqueSucesso(false), 5000)
    load()
  }

  if (loading) return <div style={{ padding: 32 }}><p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando...</p></div>

  const pendentes = saques.filter(s => s.status === "solicitado")

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ color: "white", fontWeight: 900, fontSize: 20, marginBottom: 4 }}>Meus ganhos</h1>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginBottom: 24 }}>
        80% da taxa de entrega de cada pedido entregue
      </p>

      {saqueSucesso && (
        <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
          <p style={{ color: "#22c55e", fontWeight: 700, fontSize: 13 }}>✅ Saque solicitado! Prazo: até 2 dias úteis.</p>
        </div>
      )}

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Saldo disponível", value: saldo, color: saldo > 0 ? "#22c55e" : "white" },
          { label: "Total ganho",      value: totalGanhos, color: "#60a5fa" },
          { label: "Total sacado",     value: totalSaquesPagos, color: "rgba(255,255,255,0.5)" },
        ].map(c => (
          <div key={c.label} style={{ background: "#111", borderRadius: 14, padding: "16px", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>{c.label}</p>
            <p style={{ color: c.color, fontWeight: 900, fontSize: 20 }}>R$ {c.value.toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Chave PIX */}
      <div style={{ background: "#111", borderRadius: 14, padding: "16px 18px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editandoPix ? 12 : 0 }}>
          <div>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>SUA CHAVE PIX</p>
            {!editandoPix && (
              <p style={{ color: motoboy?.pix_chave ? "white" : "#f87171", fontWeight: 700, fontSize: 14 }}>
                {motoboy?.pix_chave ?? "Não cadastrada"}
              </p>
            )}
          </div>
          <button onClick={() => setEditandoPix(e => !e)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {editandoPix ? "Cancelar" : "Editar"}
          </button>
        </div>
        {editandoPix && (
          <div style={{ display: "flex", gap: 8 }}>
            <input style={inp} value={pixInput} onChange={e => setPixInput(e.target.value)}
              placeholder="CPF, CNPJ, email, telefone ou chave aleatória" />
            <button onClick={salvarPix} disabled={salvandoPix} style={{
              padding: "10px 18px", borderRadius: 10, border: "none",
              background: "#f97316", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
            }}>
              {salvandoPix ? "..." : "Salvar"}
            </button>
          </div>
        )}
      </div>

      {/* Solicitar saque */}
      <div style={{ background: "#111", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ color: "white", fontWeight: 700 }}>Solicitar saque</p>
          {!solicitando && (
            <button onClick={() => { setSolicitando(true); setErroSaque("") }}
              disabled={saldo <= 0 || !motoboy?.pix_chave}
              style={{
                padding: "7px 16px", borderRadius: 10, border: "none",
                background: saldo > 0 && motoboy?.pix_chave ? "#f97316" : "rgba(255,255,255,0.08)",
                color: saldo > 0 && motoboy?.pix_chave ? "white" : "rgba(255,255,255,0.25)",
                fontWeight: 700, fontSize: 13, cursor: saldo > 0 && motoboy?.pix_chave ? "pointer" : "not-allowed",
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
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>PIX: <strong style={{ color: "white" }}>{motoboy?.pix_chave}</strong></p>
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
          <div style={{ padding: "12px 18px" }}>
            {pendentes.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Nenhum saque pendente</p>
            ) : pendentes.map(s => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ color: "white", fontWeight: 700 }}>R$ {Number(s.valor).toFixed(2)}</p>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{new Date(s.criado_em).toLocaleDateString("pt-BR")}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>Aguardando</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico de saques */}
      {saques.filter(s => s.status !== "solicitado").length > 0 && (
        <div style={{ background: "#111", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 16, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ color: "white", fontWeight: 700 }}>Histórico de saques</p>
          </div>
          <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {saques.filter(s => s.status !== "solicitado").map(s => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ color: "white", fontWeight: 700 }}>R$ {Number(s.valor).toFixed(2)}</p>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                    {new Date(s.criado_em).toLocaleDateString("pt-BR")}
                    {s.pago_em && ` · pago em ${new Date(s.pago_em).toLocaleDateString("pt-BR")}`}
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
      )}

      {/* Extrato de entregas */}
      <div style={{ background: "#111", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ color: "white", fontWeight: 700 }}>Extrato de entregas</p>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 }}>Últimas {entregas.length} entregues</p>
        </div>
        {entregas.length === 0 ? (
          <div style={{ padding: "24px 18px", textAlign: "center" }}>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Nenhuma entrega realizada ainda</p>
          </div>
        ) : (
          <div>
            {entregas.map(p => {
              const ganho = (p.taxa_entrega ?? 0) * MOTOBOY_PCT
              return (
                <div key={p.id} style={{ padding: "11px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600, fontSize: 13 }}>#{p.codigo}</p>
                    <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
                      {(p as any).loja?.nome} · {new Date(p.criado_em).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: "#22c55e", fontWeight: 800, fontSize: 14 }}>+R$ {ganho.toFixed(2)}</p>
                    <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>taxa R$ {Number(p.taxa_entrega ?? 0).toFixed(2)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
