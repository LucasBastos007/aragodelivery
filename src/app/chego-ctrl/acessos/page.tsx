"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Periodo = "hoje" | "7d" | "15d" | "30d"

const PERIODO_LABELS: Record<Periodo, string> = {
  hoje: "Hoje", "7d": "7 dias", "15d": "15 dias", "30d": "30 dias",
}

function inicioHoje() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString()
}
function inicioPeriodo(p: Periodo) {
  const d = new Date()
  if (p === "hoje")  { d.setHours(0, 0, 0, 0); return d.toISOString() }
  if (p === "7d")  { d.setDate(d.getDate() - 6);  d.setHours(0, 0, 0, 0); return d.toISOString() }
  if (p === "15d") { d.setDate(d.getDate() - 14); d.setHours(0, 0, 0, 0); return d.toISOString() }
  if (p === "30d") { d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); return d.toISOString() }
  return d.toISOString()
}

interface DiaCount { dia: string; n: number }
interface Cadastro  { nome: string; criado_em: string }

function MiniChart({ dias, cor }: { dias: DiaCount[]; cor: string }) {
  if (dias.length === 0) return null
  const max = Math.max(...dias.map(d => d.n), 1)
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 36 }}>
      {dias.map(d => (
        <div key={d.dia} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{
            width: "100%", borderRadius: 3,
            background: d.n > 0 ? cor : "#e2e8f0",
            height: `${Math.max(4, Math.round((d.n / max) * 36))}px`,
            transition: "height 0.3s",
          }} title={`${d.dia}: ${d.n}`} />
        </div>
      ))}
    </div>
  )
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}
function fmtDia(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

export default function AcessosPage() {
  const [periodo, setPeriodo] = useState<Periodo>("hoje")

  const [cntAcessos,   setCntAcessos]   = useState(0)
  const [cntCadastros, setCntCadastros] = useState(0)
  const [cntPedidos,   setCntPedidos]   = useState(0)
  const [cntHoje,      setCntHoje]      = useState({ acessos: 0, cadastros: 0, pedidos: 0 })

  const [diasAcessos,   setDiasAcessos]   = useState<DiaCount[]>([])
  const [diasCadastros, setDiasCadastros] = useState<DiaCount[]>([])
  const [diasPedidos,   setDiasPedidos]   = useState<DiaCount[]>([])

  const [cadastrosList, setCadastrosList] = useState<Cadastro[]>([])

  const [loading,   setLoading]   = useState(true)
  const [semTabela, setSemTabela] = useState(false)

  async function load(p: Periodo) {
    setLoading(true)
    const inicio = inicioPeriodo(p)
    const hoje   = inicioHoje()

    const nDias = p === "hoje" ? 1 : p === "7d" ? 7 : p === "15d" ? 15 : 30
    const dias = Array.from({ length: nDias }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (nDias - 1 - i)); d.setHours(0, 0, 0, 0)
      return d.toISOString().slice(0, 10)
    })

    // Contagens do período
    const [
      { count: aTotal, error: err1 },
      { count: cTotal },
      { count: pTotal },
      { count: aHoje },
      { count: cHoje },
      { count: pHoje },
    ] = await Promise.all([
      supabase.from("acessos_app").select("*", { count: "exact", head: true }).eq("tipo", "acesso").gte("criado_em", inicio),
      supabase.from("clientes").select("*", { count: "exact", head: true }).gte("criado_em", inicio),
      supabase.from("pedidos").select("*", { count: "exact", head: true }).eq("status", "entregue").gte("criado_em", inicio),
      supabase.from("acessos_app").select("*", { count: "exact", head: true }).eq("tipo", "acesso").gte("criado_em", hoje),
      supabase.from("clientes").select("*", { count: "exact", head: true }).gte("criado_em", hoje),
      supabase.from("pedidos").select("*", { count: "exact", head: true }).eq("status", "entregue").gte("criado_em", hoje),
    ])

    if (err1) setSemTabela(true)

    setCntAcessos(aTotal ?? 0)
    setCntCadastros(cTotal ?? 0)
    setCntPedidos(pTotal ?? 0)
    setCntHoje({ acessos: aHoje ?? 0, cadastros: cHoje ?? 0, pedidos: pHoje ?? 0 })

    // Gráfico por dia
    const [{ data: accDias }, { data: cadDias }, { data: pedDias }] = await Promise.all([
      err1 ? { data: [] } : supabase.from("acessos_app").select("criado_em").eq("tipo", "acesso").gte("criado_em", inicio),
      supabase.from("clientes").select("criado_em").gte("criado_em", inicio),
      supabase.from("pedidos").select("criado_em").eq("status", "entregue").gte("criado_em", inicio),
    ])

    const toMap = (rows: any[]) => {
      const m: Record<string, number> = {}
      for (const r of rows ?? []) { const d = r.criado_em.slice(0, 10); m[d] = (m[d] ?? 0) + 1 }
      return m
    }
    const accMap = toMap(accDias ?? [])
    const cadMap = toMap(cadDias ?? [])
    const pedMap = toMap(pedDias ?? [])

    setDiasAcessos(dias.map(d => ({ dia: d, n: accMap[d] ?? 0 })))
    setDiasCadastros(dias.map(d => ({ dia: d, n: cadMap[d] ?? 0 })))
    setDiasPedidos(dias.map(d => ({ dia: d, n: pedMap[d] ?? 0 })))

    // Lista de quem criou conta no período
    const { data: cads } = await supabase
      .from("clientes")
      .select("nome, criado_em")
      .gte("criado_em", inicio)
      .order("criado_em", { ascending: false })
      .limit(50)
    setCadastrosList((cads ?? []).map((c: any) => ({ nome: c.nome ?? "Sem nome", criado_em: c.criado_em })))

    setLoading(false)
  }

  useEffect(() => { load(periodo) }, [periodo])

  const iconAcesso = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
  const iconCadastro = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <line x1="19" y1="8" x2="19" y2="14"/>
      <line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  )
  const iconPedido = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  )

  const periodos: Periodo[] = ["hoje", "7d", "15d", "30d"]

  const cards = [
    { titulo: "Acessos ao app",    icon: iconAcesso,   cor: "#f97316", total: cntAcessos,   hoje: cntHoje.acessos,   dias: diasAcessos,   oculto: semTabela },
    { titulo: "Contas criadas",    icon: iconCadastro, cor: "#8b5cf6", total: cntCadastros, hoje: cntHoje.cadastros, dias: diasCadastros, oculto: false },
    { titulo: "Pedidos entregues", icon: iconPedido,   cor: "#10b981", total: cntPedidos,   hoje: cntHoje.pedidos,   dias: diasPedidos,   oculto: false },
  ]

  return (
    <div className="p-4 sm:p-8" style={{ maxWidth: 960 }}>
      <style>{`
        @media print {
          .admin-sidebar, .admin-topbar, .admin-bottomnav { display: none !important; }
          .admin-main { margin: 0 !important; height: auto !important; overflow: visible !important; }
          .print-hide { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          @page { margin: 20mm; size: A4; }
        }
      `}</style>

      <div className="print-hide" style={{ marginBottom: 20 }}>
        <h1 style={{ color: "#0F172A", fontSize: 22, fontWeight: 900 }}>Acessos</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 2 }}>Monitoramento de uso do app</p>
      </div>

      {/* Seletor de período + botão exportar */}
      <div className="print-hide" style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        {periodos.map(p => (
          <button key={p} onClick={() => setPeriodo(p)}
            style={{
              fontSize: 11, padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer",
              background: periodo === p ? "#6366f1" : "#f1f5f9",
              color:      periodo === p ? "white" : "#64748b",
              fontWeight: periodo === p ? 700 : 400,
              transition: "all 0.15s",
            }}>
            {PERIODO_LABELS[p]}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => window.print()}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, padding: "6px 16px", borderRadius: 20, border: "1px solid #e2e8f0",
            cursor: "pointer", background: "white", color: "#475569", fontWeight: 600,
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
          </svg>
          Exportar PDF
        </button>
      </div>

      {/* Cabeçalho visível apenas no PDF */}
      <div className="print-only" style={{ display: "none", marginBottom: 20, paddingBottom: 14, borderBottom: "2px solid #e2e8f0" }}>
        <p style={{ fontWeight: 900, fontSize: 20, color: "#0F172A" }}>Chegô — Relatório de Acessos</p>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          Período: {PERIODO_LABELS[periodo]} · Gerado em {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {loading ? (
        <p style={{ color: "#94a3b8", fontSize: 13 }}>Carregando...</p>
      ) : (
        <>
          {/* Cards */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
            {cards.filter(c => !c.oculto).map(c => (
              <div key={c.titulo} style={{ background: "white", borderRadius: 16, padding: "18px 20px", border: "1px solid #e2e8f0", flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: `${c.cor}15`, border: `1px solid ${c.cor}30`, display: "flex", alignItems: "center", justifyContent: "center", color: c.cor }}>
                    {c.icon}
                  </div>
                  <p style={{ fontWeight: 800, fontSize: 13, color: "#0F172A" }}>{c.titulo}</p>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <p style={{ fontSize: 32, fontWeight: 900, color: c.cor, lineHeight: 1 }}>{c.total}</p>
                  <p style={{ fontSize: 12, color: "#94a3b8" }}>{PERIODO_LABELS[periodo]}</p>
                </div>
                {periodo !== "hoje" && (
                  <p style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                    Hoje: <strong style={{ color: "#0F172A" }}>{c.hoje}</strong>
                  </p>
                )}

                {c.dias.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <MiniChart dias={c.dias} cor={c.cor} />
                    <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                      {c.dias.filter((_, i) => i === 0 || i === Math.floor(c.dias.length / 2) || i === c.dias.length - 1).map(d => (
                        <div key={d.dia} style={{ flex: 1, fontSize: 9, color: "#94a3b8", textAlign: d.dia === c.dias[0].dia ? "left" : d.dia === c.dias[c.dias.length - 1].dia ? "right" : "center" }}>
                          {fmtDia(d.dia + "T12:00:00")}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Lista de cadastros */}
          {cadastrosList.length > 0 && (
            <div style={{ background: "white", borderRadius: 16, padding: "20px 22px", border: "1px solid #e2e8f0" }}>
              <p style={{ fontWeight: 800, fontSize: 14, color: "#0F172A", marginBottom: 14 }}>
                Contas criadas — {PERIODO_LABELS[periodo]}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {cadastrosList.map((c, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 0",
                    borderBottom: i < cadastrosList.length - 1 ? "1px solid #f1f5f9" : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 800, color: "#8b5cf6", flexShrink: 0,
                      }}>
                        {c.nome.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{c.nome}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>
                      {fmtDia(c.criado_em)} {fmt(c.criado_em)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cadastrosList.length === 0 && (
            <div style={{ background: "white", borderRadius: 16, padding: "20px 22px", border: "1px solid #e2e8f0", textAlign: "center" }}>
              <p style={{ color: "#94a3b8", fontSize: 13 }}>Nenhum cadastro no período selecionado.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
