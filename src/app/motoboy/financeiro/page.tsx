"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

function ganhoLiquido(taxa: number): number {
  if (taxa <= 0) return 0
  const fee = taxa > 30 ? 3 : taxa > 20 ? 2 : 1
  return Math.max(0, taxa - fee)
}

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
  const [bancoInput,    setBancoInput]    = useState("")
  const [agenciaInput,  setAgenciaInput]  = useState("")
  const [contaInput,    setContaInput]    = useState("")
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
    // pix_key pode ser JSON { pix, banco } ou string legada
    try {
      const parsed = mb?.pix_key ? JSON.parse(mb.pix_key) : {}
      setPixInput(parsed.pix ?? "")
      setBancoInput(parsed.banco ?? "")
      setAgenciaInput(parsed.agencia ?? "")
      setContaInput(parsed.conta ?? "")
    } catch {
      setPixInput(mb?.pix_key ?? "")
      setBancoInput("")
      setAgenciaInput("")
      setContaInput("")
    }

    const { data: ped } = await supabase
      .from("pedidos").select("id, codigo, taxa_entrega, criado_em, loja:lojas(nome)")
      .eq("motoboy_id", motoboy_id).eq("status", "entregue")
      .order("criado_em", { ascending: false })
    const pedList = ped ?? []
    setEntregas(pedList.slice(0, 30))

    const ganhos = pedList.reduce((s, p) => s + ganhoLiquido(p.taxa_entrega ?? 0), 0)
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
    const payload = JSON.stringify({ pix: pixInput.trim(), banco: bancoInput.trim(), agencia: agenciaInput.trim(), conta: contaInput.trim() })
    await supabase.from("motoboys").update({ pix_key: payload }).eq("id", motoboy_id)
    setSalvandoPix(false)
    setEditandoPix(false)
    load()
  }

  async function solicitarSaque() {
    const valor = parseFloat(valorSaque.replace(",", "."))
    if (!valor || valor <= 0) { setErroSaque("Informe um valor válido"); return }
    if (valor > saldo + 0.001) { setErroSaque("Valor maior que o saldo disponível"); return }
    if (!temPix) { setErroSaque("Cadastre sua chave PIX antes de solicitar"); return }
    setErroSaque(""); setEnviandoSaque(true)
    const res = await fetch("/api/motoboy/saque", {
      method: "POST",
      credentials: "include",
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

  if (loading) return <div style={{ padding: 32 }}><p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando...</p></div>

  const pendentes = saques.filter(s => s.status === "solicitado")

  // Parse pix_key (pode ser JSON { pix, banco, agencia, conta } ou string legada)
  let pixChaveDisplay = ""
  let bancoDisplay = ""
  let agenciaDisplay = ""
  let contaDisplay = ""
  try {
    const pk = motoboy?.pix_key ? JSON.parse(motoboy.pix_key) : {}
    pixChaveDisplay = pk.pix   ?? ""
    bancoDisplay    = pk.banco ?? ""
    agenciaDisplay  = pk.agencia ?? ""
    contaDisplay    = pk.conta ?? ""
  } catch {
    pixChaveDisplay = motoboy?.pix_key ?? ""
  }
  const temPix = !!pixChaveDisplay

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ color: "white", fontWeight: 900, fontSize: 20, marginBottom: 4 }}>Meus ganhos</h1>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginBottom: 24 }}>
        80% da taxa de entrega de cada pedido entregue
      </p>

      {saqueSucesso && (
        <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
          <p style={{ color: "#22c55e", fontWeight: 700, fontSize: 13 }}>✅ Saque solicitado! Pagamentos realizados às terças e sextas-feiras.</p>
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

      {/* Dados bancários + Chave PIX */}
      <div style={{ background: "#111", borderRadius: 14, padding: "16px 18px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: editandoPix ? 14 : 0 }}>
          <div style={{ flex: 1 }}>
            {!editandoPix && (
              <>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>DADOS BANCÁRIOS</p>
                {bancoDisplay || agenciaDisplay || contaDisplay ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 12 }}>
                    <p style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{bancoDisplay || "—"}</p>
                    {agenciaDisplay && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Ag: {agenciaDisplay}</p>}
                    {contaDisplay   && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Cc: {contaDisplay}</p>}
                  </div>
                ) : (
                  <p style={{ color: "#f87171", fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Não cadastrado</p>
                )}
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>CHAVE PIX</p>
                <p style={{ color: pixInput ? "white" : "#f87171", fontWeight: 700, fontSize: 14 }}>
                  {pixInput || "Não cadastrada"}
                </p>
              </>
            )}
          </div>
          <button onClick={() => setEditandoPix(e => !e)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            {editandoPix ? "Cancelar" : "Editar"}
          </button>
        </div>
        {editandoPix && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, marginBottom: 5 }}>BANCO</p>
              <select style={{ ...inp, appearance: "none" }} value={bancoInput} onChange={e => setBancoInput(e.target.value)}>
                <option value="">Selecione o banco...</option>
                {["Nubank","Inter","Itaú","Bradesco","Banco do Brasil","Caixa Econômica Federal","Santander","C6 Bank","PicPay","Mercado Pago","PagBank","Sicoob","Sicredi","BTG Pactual","XP Investimentos","Neon","Next","Original","Safra","BRB","Banrisul","Banco do Nordeste","Banco da Amazônia","Votorantim","Daycoval","Rendimento","Outro"].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 8 }}>
              <div>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, marginBottom: 5 }}>AGÊNCIA</p>
                <input style={inp} value={agenciaInput} onChange={e => setAgenciaInput(e.target.value)}
                  placeholder="Ex: 0001" inputMode="numeric" />
              </div>
              <div>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, marginBottom: 5 }}>CONTA BANCÁRIA</p>
                <input style={inp} value={contaInput} onChange={e => setContaInput(e.target.value)}
                  placeholder="Ex: 12345-6" inputMode="numeric" />
              </div>
            </div>
            <div>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, marginBottom: 5 }}>CHAVE PIX</p>
              <input style={inp} value={pixInput} onChange={e => setPixInput(e.target.value)}
                placeholder="CPF, CNPJ, email, telefone ou chave aleatória" />
            </div>
            <button onClick={salvarPix} disabled={salvandoPix || !pixInput.trim()} style={{
              padding: "10px 18px", borderRadius: 10, border: "none", alignSelf: "flex-end",
              background: pixInput.trim() ? "#f97316" : "rgba(255,255,255,0.1)",
              color: pixInput.trim() ? "white" : "rgba(255,255,255,0.3)",
              fontWeight: 700, fontSize: 13, cursor: pixInput.trim() ? "pointer" : "not-allowed",
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
              disabled={saldo <= 0 || !temPix}
              style={{
                padding: "7px 16px", borderRadius: 10, border: "none",
                background: saldo > 0 && temPix ? "#f97316" : "rgba(255,255,255,0.08)",
                color: saldo > 0 && temPix ? "white" : "rgba(255,255,255,0.25)",
                fontWeight: 700, fontSize: 13, cursor: saldo > 0 && temPix ? "pointer" : "not-allowed",
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
              {bancoDisplay && (
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 2 }}>
                  Banco: <strong style={{ color: "white" }}>{bancoDisplay}</strong>
                  {agenciaDisplay && <> · Ag: <strong style={{ color: "white" }}>{agenciaDisplay}</strong></>}
                  {contaDisplay   && <> · Cc: <strong style={{ color: "white" }}>{contaDisplay}</strong></>}
                </p>
              )}
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                Chave PIX: <strong style={{ color: "white" }}>{pixChaveDisplay}</strong>
              </p>
              <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 3 }}>Pagamentos às terças e sextas-feiras</p>
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
              const ganho = ganhoLiquido(p.taxa_entrega ?? 0)
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
                    <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>taxa: R$ {Number(p.taxa_entrega ?? 0).toFixed(2)} − taxa Chegô</p>
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
