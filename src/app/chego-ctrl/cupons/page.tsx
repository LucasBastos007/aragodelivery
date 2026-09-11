"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Tipo = "percentual" | "fixo" | "frete_gratis"

interface Cupom {
  id: string; codigo: string; tipo: Tipo; valor: number
  loja_id: string | null; pedido_minimo: number; validade: string | null
  ativo: boolean; usos: number; criado_em: string
  lojas_ids: string[] | null; raio_km: number | null
  loja?: { nome: string }
}

interface LojaResumo { id: string; nome: string }

// Aragoiânia-GO — mesmo centro usado no checkout, pra enviesar a busca de endereço
const GEOCODE_BIAS_LAT = -17.6547
const GEOCODE_BIAS_LNG = -49.4378

const inp: React.CSSProperties = {
  width: "100%", padding: "10px 13px", borderRadius: 10, fontSize: 14,
  background: "#F9FAFB", border: "1px solid #E2E8F0",
  color: "#0F172A", outline: "none", boxSizing: "border-box",
}

export default function AdminCuponsPage() {
  const [cupons,  setCupons]  = useState<Cupom[]>([])
  const [loading, setLoading] = useState(true)
  const [criando, setCriando] = useState(false)

  const [codigo,   setCodigo]   = useState("")
  const [tipo,     setTipo]     = useState<Tipo>("percentual")
  const [valor,    setValor]    = useState("")
  const [minimo,   setMinimo]   = useState("")
  const [validade, setValidade] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [erro,     setErro]     = useState("")

  // Restrição por loja(s) — vazio = vale pra todas
  const [lojasDisponiveis, setLojasDisponiveis] = useState<LojaResumo[]>([])
  const [lojasSelecionadas, setLojasSelecionadas] = useState<string[]>([])

  // Restrição por raio de entrega — endereço central + km de alcance
  const [enderecoRaio,   setEnderecoRaio]   = useState("")
  const [buscandoRaio,   setBuscandoRaio]   = useState(false)
  const [centroResolvido, setCentroResolvido] = useState<{ lat: number; lng: number; display: string } | null>(null)
  const [raioKm,         setRaioKm]         = useState("")
  const [erroRaio,       setErroRaio]       = useState("")

  useEffect(() => { carregar(); carregarLojas() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from("cupons").select("*, loja:lojas(nome)").is("loja_id", null).order("criado_em", { ascending: false })
    setCupons((data as Cupom[]) ?? [])
    setLoading(false)
  }

  async function carregarLojas() {
    const { data } = await supabase.from("lojas").select("id, nome").eq("status", "ativo").order("nome")
    setLojasDisponiveis((data as LojaResumo[]) ?? [])
  }

  function toggleLoja(id: string) {
    setLojasSelecionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function buscarCentroRaio() {
    if (!enderecoRaio.trim()) return
    setBuscandoRaio(true); setErroRaio(""); setCentroResolvido(null)
    const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(enderecoRaio.trim())}&lat=${GEOCODE_BIAS_LAT}&lon=${GEOCODE_BIAS_LNG}`)
      .then(r => r.json()).catch(() => [])
    const primeiro = res?.[0]
    if (!primeiro) { setErroRaio("Endereço não encontrado"); setBuscandoRaio(false); return }
    setCentroResolvido({ lat: parseFloat(primeiro.lat), lng: parseFloat(primeiro.lon), display: primeiro.display_name })
    setBuscandoRaio(false)
  }

  async function handleCriar() {
    if (!codigo.trim()) { setErro("Informe o código"); return }
    // Frete grátis não tem "valor" de desconto — zera o frete inteiro, não um número fixo
    if (tipo !== "frete_gratis" && (!valor || isNaN(Number(valor)) || Number(valor) <= 0)) { setErro("Valor inválido"); return }
    if (raioKm && !centroResolvido) { setErro("Busque o endereço central do raio antes de salvar"); return }
    setErro(""); setSalvando(true)
    const res = await fetch("/api/admin/cupons", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo, tipo, valor: tipo === "frete_gratis" ? 0 : Number(valor),
        pedido_minimo: Number(minimo) || 0, validade: validade || null,
        lojas_ids: lojasSelecionadas.length > 0 ? lojasSelecionadas : null,
        centro_lat: centroResolvido && raioKm ? centroResolvido.lat : null,
        centro_lng: centroResolvido && raioKm ? centroResolvido.lng : null,
        raio_km:    centroResolvido && raioKm ? Number(raioKm) : null,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setErro(json.error?.includes("unique") ? "Código já existe." : json.error); setSalvando(false); return }
    setCodigo(""); setValor(""); setMinimo(""); setValidade(""); setTipo("percentual")
    setLojasSelecionadas([]); setEnderecoRaio(""); setCentroResolvido(null); setRaioKm(""); setErroRaio("")
    setCriando(false); setSalvando(false); carregar()
  }

  async function toggleAtivo(c: Cupom) {
    await fetch("/api/admin/cupons", {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, ativo: !c.ativo }),
    })
    setCupons(prev => prev.map(x => x.id === c.id ? { ...x, ativo: !x.ativo } : x))
  }

  async function excluir(id: string) {
    if (!confirm("Excluir?")) return
    await fetch("/api/admin/cupons", {
      method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setCupons(prev => prev.filter(x => x.id !== id))
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 820 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#0F172A", fontWeight: 900, fontSize: 22 }}>🎟️ Cupons globais</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 3 }}>Válidos em qualquer loja da plataforma</p>
        </div>
        <button onClick={() => { setCriando(c => !c); setErro("") }}
          style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: "#f97316", color: "#0F172A", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {criando ? "Cancelar" : "+ Novo cupom"}
        </button>
      </div>

      {criando && (
        <div style={{ background: "white", borderRadius: 16, border: "1px solid rgba(249,115,22,0.2)", padding: "20px 22px", marginBottom: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ color: "#0F172A", fontWeight: 700, fontSize: 14 }}>Novo cupom global</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", color: "#64748B", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>Código *</label>
              <input style={inp} value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="BEMVINDO20" />
            </div>
            <div>
              <label style={{ display: "block", color: "#64748B", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>Tipo</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["percentual", "fixo", "frete_gratis"] as Tipo[]).map(t => (
                  <button key={t} onClick={() => setTipo(t)} style={{
                    flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
                    background: tipo === t ? "rgba(249,115,22,0.15)" : "#F9FAFB",
                    color: tipo === t ? "#f97316" : "#64748B",
                    outline: tipo === t ? "1px solid rgba(249,115,22,0.4)" : "none",
                  }}>
                    {t === "percentual" ? "%" : t === "fixo" ? "R$" : "🛵 Frete grátis"}
                  </button>
                ))}
              </div>
            </div>
            {tipo !== "frete_gratis" && (
              <div>
                <label style={{ display: "block", color: "#64748B", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>
                  {tipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"} *
                </label>
                <input style={inp} type="number" min="0" value={valor} onChange={e => setValor(e.target.value)} placeholder={tipo === "percentual" ? "20" : "10.00"} />
              </div>
            )}
            <div>
              <label style={{ display: "block", color: "#64748B", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>Pedido mínimo (R$)</label>
              <input style={inp} type="number" min="0" value={minimo} onChange={e => setMinimo(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label style={{ display: "block", color: "#64748B", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>Válido até</label>
              <input style={inp} type="date" value={validade} onChange={e => setValidade(e.target.value)} />
            </div>
          </div>

          {/* Restrição por loja(s) — vazio = vale pra todas */}
          <div>
            <label style={{ display: "block", color: "#64748B", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>
              Lojas onde vale {lojasSelecionadas.length > 0 && `(${lojasSelecionadas.length} selecionada${lojasSelecionadas.length > 1 ? "s" : ""})`}
            </label>
            <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>Nenhuma marcada = vale em todas as lojas</p>
            <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: 10, padding: 8, display: "flex", flexDirection: "column", gap: 2, background: "#F9FAFB" }}>
              {lojasDisponiveis.map(l => (
                <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", borderRadius: 7, cursor: "pointer", fontSize: 13, color: "#374151" }}>
                  <input type="checkbox" checked={lojasSelecionadas.includes(l.id)} onChange={() => toggleLoja(l.id)} />
                  {l.nome}
                </label>
              ))}
            </div>
          </div>

          {/* Restrição por raio de entrega */}
          <div>
            <label style={{ display: "block", color: "#64748B", fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>
              Raio de alcance (opcional)
            </label>
            <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>Só vale se o endereço de entrega do cliente estiver dentro do raio</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={inp} value={enderecoRaio} onChange={e => { setEnderecoRaio(e.target.value); setCentroResolvido(null) }} placeholder="Endereço central (ex: Praça Central, Aragoiânia)" />
              <button onClick={buscarCentroRaio} disabled={buscandoRaio} style={{
                padding: "0 16px", borderRadius: 10, border: "1px solid #E2E8F0", background: "white",
                color: "#374151", fontWeight: 700, fontSize: 12, cursor: buscandoRaio ? "not-allowed" : "pointer", whiteSpace: "nowrap",
              }}>
                {buscandoRaio ? "..." : "Buscar"}
              </button>
              <input style={{ ...inp, width: 110, flexShrink: 0 }} type="number" min="0" step="0.5" value={raioKm} onChange={e => setRaioKm(e.target.value)} placeholder="Raio (km)" />
            </div>
            {erroRaio && <p style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{erroRaio}</p>}
            {centroResolvido && <p style={{ color: "#22c55e", fontSize: 12, marginTop: 6 }}>✓ Centro: {centroResolvido.display}</p>}
          </div>

          {erro && <p style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>{erro}</p>}
          <button onClick={handleCriar} disabled={salvando} style={{
            padding: "12px 24px", borderRadius: 12, border: "none",
            background: salvando ? "rgba(249,115,22,0.4)" : "#f97316",
            color: "#0F172A", fontWeight: 800, fontSize: 14, cursor: salvando ? "not-allowed" : "pointer", alignSelf: "flex-start",
          }}>
            {salvando ? "Criando..." : "✓ Criar cupom global"}
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: "#94a3b8" }}>Carregando...</p>
      ) : cupons.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 48 }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>🎟️</p>
          <p style={{ color: "#64748B", fontWeight: 600 }}>Nenhum cupom global criado</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cupons.map(c => (
            <div key={c.id} style={{
              background: "white", borderRadius: 14, padding: "16px 18px",
              border: `1px solid ${c.ativo ? "#F1F5F9" : "#F1F5F9"}`,
              opacity: c.ativo ? 1 : 0.5,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <p style={{ color: "#f97316", fontWeight: 900, fontSize: 16, fontFamily: "monospace", letterSpacing: 1 }}>{c.codigo}</p>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}>
                    {c.lojas_ids?.length ? `${c.lojas_ids.length} loja${c.lojas_ids.length > 1 ? "s" : ""}` : "Global"}
                  </span>
                  {c.raio_km != null && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(139,92,246,0.12)", color: "#8b5cf6" }}>
                      📍 {c.raio_km}km
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                    background: c.ativo ? "rgba(34,197,94,0.12)" : "#F9FAFB",
                    color: c.ativo ? "#22c55e" : "#94a3b8",
                  }}>
                    {c.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#64748B", flexWrap: "wrap" }}>
                  <span>{c.tipo === "percentual" ? `${c.valor}% off` : c.tipo === "frete_gratis" ? "🛵 Frete grátis" : `R$ ${Number(c.valor).toFixed(2)} off`}</span>
                  {c.pedido_minimo > 0 && <span>· Mín. R$ {Number(c.pedido_minimo).toFixed(2)}</span>}
                  {c.validade && <span>· Até {new Date(c.validade + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
                  <span>· {c.usos} usos</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => toggleAtivo(c)} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #E2E8F0", background: "transparent", color: "#64748B", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {c.ativo ? "Desativar" : "Ativar"}
                </button>
                <button onClick={() => excluir(c.id)} style={{ padding: "7px 12px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", color: "#f87171", fontSize: 12, cursor: "pointer" }}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
