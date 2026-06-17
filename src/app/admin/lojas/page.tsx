"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Loja, StatusLoja } from "@/types"

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pendente:          { label: "Pendente",          color: "#d97706", bg: "#FFFBEB", dot: "#f59e0b" },
  aprovado:          { label: "Aprovado",           color: "#2563eb", bg: "#EFF6FF", dot: "#3b82f6" },
  contrato_assinado: { label: "Contrato assinado",  color: "#7c3aed", bg: "#F5F3FF", dot: "#8b5cf6" },
  ativo:             { label: "Ativo",              color: "#059669", bg: "#ECFDF5", dot: "#10b981" },
  suspenso:          { label: "Suspenso",           color: "#dc2626", bg: "#FEF2F2", dot: "#ef4444" },
}

const CATEGORIAS = ["Todos", "Restaurante", "Mercadinho", "Farmácia", "Outros"]

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: "#64748b", bg: "#F1F5F9", dot: "#94a3b8" }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 50,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 700,
      border: `1px solid ${cfg.color}22`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

function LogoAvatar({ loja, size = 48 }: { loja: Loja; size?: number }) {
  const [err, setErr] = useState(false)
  const initials = (loja.nome || "?").slice(0, 2).toUpperCase()
  const colors = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#f59e0b"]
  const color = colors[(loja.nome?.charCodeAt(0) ?? 0) % colors.length]

  if (loja.logo_url && !err) {
    return (
      <img src={loja.logo_url} alt={loja.nome}
        onError={() => setErr(true)}
        style={{
          width: size, height: size, borderRadius: size * 0.25,
          objectFit: "cover", flexShrink: 0,
          border: "2px solid #F1F5F9",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.25, flexShrink: 0,
      background: `linear-gradient(135deg, ${color}22, ${color}44)`,
      border: `2px solid ${color}33`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 900, color,
      boxShadow: `0 2px 8px ${color}20`,
    }}>
      {initials}
    </div>
  )
}

function gerarToken() { return crypto.randomUUID() }

export default function LojasPage() {
  const [lojas, setLojas]           = useState<Loja[]>([])
  const [loading, setLoading]       = useState(true)
  const [filtro, setFiltro]         = useState("Todos")
  const [status, setStatus]         = useState("todos")
  const [selecionada, setSelecionada] = useState<Loja | null>(null)
  const [salvando, setSalvando]     = useState(false)
  const [copiado, setCopiado]       = useState(false)

  async function load() {
    const { data } = await supabase.from("lojas").select("*").order("criado_em", { ascending: false })
    setLojas(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function atualizarStatus(id: string, novoStatus: StatusLoja, extra?: Record<string, unknown>) {
    setSalvando(true)
    await supabase.from("lojas").update({ status: novoStatus, ...extra }).eq("id", id)
    await load()
    setSelecionada(prev => prev ? { ...prev, status: novoStatus, ...extra } as Loja : null)
    setSalvando(false)
  }

  async function aprovar(loja: Loja) {
    const token = gerarToken()
    await atualizarStatus(loja.id, "aprovado", { contrato_token: token })
  }

  function linkContrato(loja: Loja) {
    return `${window.location.origin}/contrato/loja/${loja.contrato_token}`
  }

  async function copiarLink(loja: Loja) {
    await navigator.clipboard.writeText(linkContrato(loja))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const filtradas = lojas.filter(l => {
    const catOk    = filtro === "Todos" || l.categoria === filtro
    const statusOk = status === "todos" || l.status === status
    return catOk && statusOk
  })

  const pendentes = lojas.filter(l => l.status === "pendente").length

  return (
    <div style={{ padding: "32px 36px", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Gestão
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.5px" }}>Lojas</h1>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 3 }}>
            {lojas.length} cadastradas
            {pendentes > 0 && <span style={{ marginLeft: 8, color: "#d97706", fontWeight: 700 }}>· {pendentes} pendente{pendentes > 1 ? "s" : ""}</span>}
          </p>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{
            padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
            border: "1.5px solid #E2E8F0", background: "white", color: "#374151",
            cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}>
            <option value="todos">Todos os status</option>
            <option value="pendente">Pendentes</option>
            <option value="aprovado">Aprovados</option>
            <option value="contrato_assinado">Contrato assinado</option>
            <option value="ativo">Ativos</option>
            <option value="suspenso">Suspensos</option>
          </select>

          <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 10, padding: 4, border: "1.5px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            {CATEGORIAS.map(c => (
              <button key={c} onClick={() => setFiltro(c)} style={{
                padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: "none", cursor: "pointer", transition: "all 0.15s",
                background: filtro === c ? "linear-gradient(135deg, #f97316, #ea580c)" : "transparent",
                color: filtro === c ? "white" : "#64748B",
                boxShadow: filtro === c ? "0 2px 8px rgba(249,115,22,0.3)" : "none",
              }}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Layout lista + painel */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

        {/* Lista */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          {loading ? (
            [1,2,3].map(i => (
              <div key={i} style={{ height: 80, borderRadius: 14, background: "white", border: "1.5px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))
          ) : filtradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", background: "white", borderRadius: 16, border: "1.5px solid #F1F5F9" }}>
              <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>Nenhuma loja encontrada</p>
            </div>
          ) : filtradas.map(l => {
            const active = selecionada?.id === l.id
            const cfg = STATUS_CFG[l.status] ?? STATUS_CFG.pendente
            return (
              <div key={l.id} onClick={() => setSelecionada(active ? null : l)} style={{
                background: "white",
                borderRadius: 14,
                border: active ? `1.5px solid #f97316` : "1.5px solid #F1F5F9",
                boxShadow: active
                  ? "0 4px 20px rgba(249,115,22,0.15)"
                  : "0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)",
                padding: "14px 18px",
                display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer",
                transition: "all 0.18s",
              }}
                onMouseEnter={e => {
                  if (active) return
                  const el = e.currentTarget as HTMLDivElement
                  el.style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)"
                  el.style.transform = "translateY(-1px)"
                }}
                onMouseLeave={e => {
                  if (active) return
                  const el = e.currentTarget as HTMLDivElement
                  el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)"
                  el.style.transform = ""
                }}
              >
                <LogoAvatar loja={l} size={52} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>{l.nome}</p>
                    <StatusBadge status={l.status} />
                  </div>
                  <p style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.categoria} · {l.endereco}
                  </p>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#f97316" }}>R$ {l.taxa_entrega?.toFixed(2)}</p>
                  <p style={{ fontSize: 10, color: "#CBD5E1", marginTop: 2, fontWeight: 600 }}>taxa entrega</p>
                </div>

                <div style={{ color: active ? "#f97316" : "#CBD5E1", transition: "all 0.15s" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
            )
          })}
        </div>

        {/* Painel lateral */}
        {selecionada && (
          <div style={{
            width: 380, flexShrink: 0, alignSelf: "flex-start",
            background: "white", borderRadius: 18,
            border: "1.5px solid #F1F5F9",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            overflow: "hidden",
            position: "sticky", top: 24,
          }}>
            {/* Banner / Logo hero */}
            <div style={{
              height: 100, position: "relative",
              background: `linear-gradient(135deg, #FFF7ED, #FEF3C7)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(249,115,22,0.08), rgba(220,38,38,0.06))" }} />
              <div style={{ position: "absolute", top: 12, right: 12 }}>
                <button onClick={() => setSelecionada(null)} style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "white", border: "1.5px solid #E2E8F0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  color: "#94a3b8", fontSize: 14, fontWeight: 700,
                }}>✕</button>
              </div>
            </div>

            {/* Logo sobreposta */}
            <div style={{ padding: "0 20px", marginTop: -28, marginBottom: 4, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div style={{ borderRadius: 14, border: "3px solid white", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
                <LogoAvatar loja={selecionada} size={56} />
              </div>
              <StatusBadge status={selecionada.status} />
            </div>

            {/* Nome */}
            <div style={{ padding: "8px 20px 16px" }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.3px" }}>{selecionada.nome}</p>
              {selecionada.descricao && (
                <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, lineHeight: 1.5 }}>{selecionada.descricao}</p>
              )}
            </div>

            {/* Infos */}
            <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 1 }}>
              {[
                { label: "Categoria",    value: selecionada.categoria },
                { label: "Telefone",     value: selecionada.telefone },
                { label: "Endereço",     value: selecionada.endereco },
                { label: "Taxa entrega", value: `R$ ${selecionada.taxa_entrega?.toFixed(2)}` },
                { label: "Tempo",        value: `${selecionada.tempo_min}–${selecionada.tempo_max} min` },
                { label: "Comissão",     value: `${(selecionada as any).comissao ?? 10}%` },
                selecionada.nome_responsavel ? { label: "Responsável", value: selecionada.nome_responsavel } : null,
                selecionada.email         ? { label: "E-mail",       value: selecionada.email }         : null,
                selecionada.cnpj          ? { label: "CNPJ",         value: selecionada.cnpj }          : null,
                selecionada.cpf_responsavel ? { label: "CPF",         value: selecionada.cpf_responsavel } : null,
                selecionada.pix_key       ? { label: "PIX",          value: selecionada.pix_key }       : null,
                { label: "Cadastro", value: new Date(selecionada.criado_em).toLocaleDateString("pt-BR") },
                selecionada.contrato_assinado_em
                  ? { label: "Assinado em", value: new Date(selecionada.contrato_assinado_em).toLocaleDateString("pt-BR") }
                  : null,
              ].filter(Boolean).map((row: any, i, arr) => (
                <div key={row.label} style={{
                  display: "flex", justifyContent: "space-between", gap: 8,
                  padding: "8px 0",
                  borderBottom: i < arr.length - 1 ? "1px solid #F8FAFC" : "none",
                }}>
                  <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, flexShrink: 0 }}>{row.label}</span>
                  <span style={{
                    fontSize: 12, color: "#1E293B", fontWeight: 700,
                    textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }} title={row.value}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Link contrato */}
            {selecionada.status === "aprovado" && selecionada.contrato_token && (
              <div style={{ margin: "0 20px 16px", padding: 12, borderRadius: 10, background: "#EEF2FF", border: "1px solid #C7D2FE" }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: "#4338ca", marginBottom: 6 }}>🔗 Link do contrato gerado</p>
                <p style={{ fontSize: 11, color: "#818cf8", marginBottom: 8, wordBreak: "break-all" }}>
                  /contrato/loja/{selecionada.contrato_token.slice(0, 16)}…
                </p>
                <button onClick={() => copiarLink(selecionada)} style={{
                  width: "100%", padding: "8px", borderRadius: 8,
                  border: "1.5px solid #818cf8", background: copiado ? "#6366f1" : "white",
                  color: copiado ? "white" : "#6366f1", fontWeight: 700, fontSize: 12, cursor: "pointer",
                  transition: "all 0.2s",
                }}>
                  {copiado ? "✓ Copiado!" : "Copiar link"}
                </button>
              </div>
            )}

            {/* Ações */}
            <div style={{ padding: "16px 20px", borderTop: "1.5px solid #F1F5F9", display: "flex", flexDirection: "column", gap: 8 }}>
              {selecionada.status === "pendente" && (<>
                <button onClick={() => aprovar(selecionada)} disabled={salvando} style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "none",
                  background: salvando ? "#e5e7eb" : "linear-gradient(135deg, #f97316, #dc2626)",
                  color: "white", fontWeight: 800, fontSize: 13, cursor: salvando ? "not-allowed" : "pointer",
                  boxShadow: salvando ? "none" : "0 4px 16px rgba(249,115,22,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  {salvando ? "Salvando…" : "✓ Aprovar e gerar contrato"}
                </button>
                <button onClick={() => atualizarStatus(selecionada.id, "suspenso")} disabled={salvando} style={{
                  width: "100%", padding: "11px", borderRadius: 10,
                  border: "1.5px solid #FECACA", background: "#FEF2F2",
                  color: "#dc2626", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}>
                  Recusar cadastro
                </button>
              </>)}
              {selecionada.status === "aprovado" && (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>⏳ Aguardando assinatura do contrato</p>
                </div>
              )}
              {selecionada.status === "contrato_assinado" && (
                <button onClick={() => atualizarStatus(selecionada.id, "ativo")} disabled={salvando} style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "white", fontWeight: 800, fontSize: 13, cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
                }}>
                  ✓ Ativar loja
                </button>
              )}
              {selecionada.status === "ativo" && (
                <button onClick={() => atualizarStatus(selecionada.id, "suspenso")} disabled={salvando} style={{
                  width: "100%", padding: "11px", borderRadius: 10,
                  border: "1.5px solid #FECACA", background: "#FEF2F2",
                  color: "#dc2626", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}>
                  Suspender loja
                </button>
              )}
              {selecionada.status === "suspenso" && (
                <button onClick={() => atualizarStatus(selecionada.id, "ativo")} disabled={salvando} style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "white", fontWeight: 800, fontSize: 13, cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
                }}>
                  Reativar loja
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  )
}
