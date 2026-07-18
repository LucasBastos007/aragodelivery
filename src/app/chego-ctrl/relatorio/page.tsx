"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { Pedido, Loja, Motoboy } from "@/types"

// Taxa Chegô por entrega
const TAXA_CHEGO_POR_ENTREGA = 1.00
// Taxa Asaas por PIX enviado (estimativa — atualizar quando integrar)
const TAXA_ASAAS_PIX = 1.99

const PLANO_LABEL: Record<string, string> = {
  select: "Select", prime: "Prime", black: "Black", gold: "Gold",
}

type LojaStat = {
  loja: Loja
  pedidos: Pedido[]
  total_vendas: number
  taxa_chego: number
  taxa_asaas: number
  valor_a_repassar: number
}

type MotoboyStats = {
  motoboy: Motoboy
  entregas: number
  total_ganho: number
}

function fmtR(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR")
}

export default function RelatorioPage() {
  const [pedidos,  setPedidos]   = useState<Pedido[]>([])
  const [lojas,    setLojas]     = useState<Loja[]>([])
  const [motoboys, setMotoboys]  = useState<Motoboy[]>([])
  const [loading,  setLoading]   = useState(true)
  const [periodo,  setPeriodo]   = useState<"semana" | "quinzena" | "mes" | "custom">("semana")
  const [dataIni,  setDataIni]   = useState("")
  const [dataFim,  setDataFim]   = useState("")
  const [expandida, setExpandida] = useState<string | null>(null)

  // calcula range baseado no período
  function calcRange(p: typeof periodo) {
    const hoje = new Date()
    hoje.setHours(23, 59, 59, 999)
    const ini = new Date()
    if (p === "semana")    ini.setDate(hoje.getDate() - 7)
    if (p === "quinzena")  ini.setDate(hoje.getDate() - 15)
    if (p === "mes")       ini.setDate(hoje.getDate() - 30)
    ini.setHours(0, 0, 0, 0)
    return { ini: ini.toISOString(), fim: hoje.toISOString() }
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { ini, fim } = periodo === "custom"
      ? { ini: dataIni ? new Date(dataIni).toISOString() : new Date(0).toISOString(), fim: dataFim ? new Date(dataFim + "T23:59:59").toISOString() : new Date().toISOString() }
      : calcRange(periodo)

    const [{ data: peds }, { data: ls }, { data: mbs }] = await Promise.all([
      supabase.from("pedidos")
        .select("*, loja:lojas(id,nome,plano,categoria,logo_url,comissao)")
        .eq("status", "entregue")
        .gte("criado_em", ini)
        .lte("criado_em", fim)
        .order("criado_em", { ascending: false }),
      supabase.from("lojas").select("*").eq("status", "ativo"),
      supabase.from("motoboys").select("id,nome,telefone,pix_key").eq("status", "ativo"),
    ])
    setPedidos((peds as Pedido[]) ?? [])
    setLojas((ls as Loja[]) ?? [])
    setMotoboys((mbs as Motoboy[]) ?? [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, dataIni, dataFim])

  useEffect(() => { load() }, [load])

  // agrupa por loja
  const stats: LojaStat[] = lojas
    .map(loja => {
      const peds = pedidos.filter(p => p.loja_id === loja.id)
      const total_vendas = peds.reduce((s, p) => s + Number(p.total ?? 0), 0)
      const taxa_chego   = peds.length * TAXA_CHEGO_POR_ENTREGA
      const comissao_pct = loja.plano === "gold" ? (Number((loja as any).comissao ?? 10) / 100) : 0
      const comissao_val = total_vendas * comissao_pct
      const taxa_asaas   = peds.length > 0 ? TAXA_ASAAS_PIX : 0
      const valor_a_repassar = total_vendas - taxa_chego - comissao_val - taxa_asaas
      return { loja, pedidos: peds, total_vendas, taxa_chego, taxa_asaas, valor_a_repassar }
    })
    .filter(s => s.pedidos.length > 0)
    .sort((a, b) => b.total_vendas - a.total_vendas)

  const totais = {
    pedidos:  pedidos.length,
    vendas:   stats.reduce((s, x) => s + x.total_vendas, 0),
    chego:    stats.reduce((s, x) => s + x.taxa_chego, 0),
    asaas:    stats.reduce((s, x) => s + x.taxa_asaas, 0),
    repasse:  stats.reduce((s, x) => s + x.valor_a_repassar, 0),
  }

  // Agrupamento por motoboy
  const motoboyStats: MotoboyStats[] = motoboys
    .map(mb => {
      const entregas = pedidos.filter(p => p.motoboy_id === mb.id)
      return {
        motoboy: mb,
        entregas: entregas.length,
        total_ganho: entregas.reduce((s, p) => s + Number(p.taxa_entrega ?? 0), 0),
      }
    })
    .filter(s => s.entregas > 0)
    .sort((a, b) => b.total_ganho - a.total_ganho)

  const totalMotoboys = {
    entregas: motoboyStats.reduce((s, x) => s + x.entregas, 0),
    ganho:    motoboyStats.reduce((s, x) => s + x.total_ganho, 0),
  }

  const { ini: rIni, fim: rFim } = periodo === "custom"
    ? { ini: dataIni || "—", fim: dataFim || "—" }
    : { ini: new Date(calcRange(periodo).ini).toLocaleDateString("pt-BR"), fim: new Date().toLocaleDateString("pt-BR") }

  return (
    <div style={{ padding: "24px 16px", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Financeiro
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.5px" }}>Relatório de Repasses</h1>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 3 }}>
            {rIni} até {rFim} · repasses toda <strong style={{ color: "#0F172A" }}>terça-feira</strong> e <strong style={{ color: "#0F172A" }}>quinta-feira</strong>
          </p>
        </div>
        <button
          onClick={() => window.print()}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "10px 18px", borderRadius: 11, border: "1.5px solid #E2E8F0",
            background: "white", color: "#374151", fontWeight: 700, fontSize: 13,
            cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Imprimir / Exportar
        </button>
      </div>

      {/* Filtros de período */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        {(["semana", "quinzena", "mes", "custom"] as const).map(p => (
          <button key={p} onClick={() => setPeriodo(p)} style={{
            padding: "7px 14px", borderRadius: 9, border: "1.5px solid",
            borderColor: periodo === p ? "#22c55e" : "#E2E8F0",
            background: periodo === p ? "#f0fdf4" : "white",
            color: periodo === p ? "#15803d" : "#64748b",
            fontWeight: periodo === p ? 800 : 600, fontSize: 12, cursor: "pointer",
          }}>
            {p === "semana" ? "Últimos 7 dias" : p === "quinzena" ? "Últimos 15 dias" : p === "mes" ? "Últimos 30 dias" : "Personalizado"}
          </button>
        ))}
        {periodo === "custom" && (
          <>
            <input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)}
              style={{ padding: "7px 10px", borderRadius: 9, border: "1.5px solid #E2E8F0", fontSize: 12, fontWeight: 600, cursor: "pointer" }} />
            <span style={{ color: "#94a3b8", fontSize: 12 }}>até</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              style={{ padding: "7px 10px", borderRadius: 9, border: "1.5px solid #E2E8F0", fontSize: 12, fontWeight: 600, cursor: "pointer" }} />
          </>
        )}
      </div>

      {/* Cards de totais */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total de pedidos",      value: String(totais.pedidos), color: "#3b82f6", sub: "pedidos entregues" },
          { label: "Volume total de vendas", value: fmtR(totais.vendas),   color: "#8b5cf6", sub: "soma dos pedidos" },
          { label: "Taxa Chegô (R$1/pedido)", value: fmtR(totais.chego),   color: "#f97316", sub: "receita da plataforma" },
          { label: "Taxa Asaas (estimada)",  value: fmtR(totais.asaas),   color: "#f59e0b", sub: "custo por PIX enviado" },
          { label: "Total a repassar",       value: fmtR(totais.repasse), color: "#22c55e", sub: "para todas as lojas" },
        ].map(c => (
          <div key={c.label} style={{ background: "white", borderRadius: 14, padding: "16px", border: "1.5px solid #F1F5F9", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>{c.label}</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: c.color, letterSpacing: "-0.5px" }}>{c.value}</p>
            <p style={{ fontSize: 10, color: "#cbd5e1", marginTop: 4 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabela principal */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
          <div style={{ width: 36, height: 36, border: "3px solid #22c55e", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ fontSize: 13, fontWeight: 600 }}>Carregando dados…</p>
        </div>
      ) : stats.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>📊</p>
          <p style={{ fontSize: 14, fontWeight: 700 }}>Nenhum pedido entregue no período</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" as any }}>
        <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #F1F5F9", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", minWidth: 720 }}>
          {/* Header da tabela */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 80px", gap: 0, padding: "10px 20px", background: "#F8FAFC", borderBottom: "1.5px solid #F1F5F9" }}>
            {["Loja", "Pedidos", "Volume vendas", "Taxa Chegô", "Taxa Asaas", "A repassar", ""].map((h, i) => (
              <p key={i} style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8, textAlign: i > 0 ? "right" : "left" }}>{h}</p>
            ))}
          </div>

          {stats.map((s, idx) => (
            <div key={s.loja.id}>
              {/* Linha da loja */}
              <div
                onClick={() => setExpandida(expandida === s.loja.id ? null : s.loja.id)}
                style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 80px",
                  gap: 0, padding: "14px 20px", cursor: "pointer",
                  borderBottom: expandida === s.loja.id ? "none" : "1px solid #F8FAFC",
                  background: expandida === s.loja.id ? "#FAFFFE" : "white",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (expandida !== s.loja.id) (e.currentTarget as HTMLElement).style.background = "#FAFAFA" }}
                onMouseLeave={e => { if (expandida !== s.loja.id) (e.currentTarget as HTMLElement).style.background = "white" }}
              >
                {/* Loja */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: idx === 0 ? "#f59e0b" : idx === 1 ? "#94a3b8" : idx === 2 ? "#cd7c32" : "#e2e8f0",
                  }} title={`#${idx + 1}`} />
                  {s.loja.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.loja.logo_url} alt={s.loja.nome} style={{ width: 28, height: 28, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#64748b", flexShrink: 0 }}>
                      {s.loja.nome.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{s.loja.nome}</p>
                    <p style={{ fontSize: 10, color: "#94a3b8" }}>
                      {s.loja.plano ? PLANO_LABEL[s.loja.plano] : "Sem plano"}
                      {s.loja.plano === "gold" && ` · ${(s.loja as any).comissao ?? 10}% comissão`}
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", textAlign: "right", alignSelf: "center" }}>{s.pedidos.length}</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: "#8b5cf6", textAlign: "right", alignSelf: "center" }}>{fmtR(s.total_vendas)}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#f97316", textAlign: "right", alignSelf: "center" }}>{fmtR(s.taxa_chego)}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", textAlign: "right", alignSelf: "center" }}>{fmtR(s.taxa_asaas)}</p>
                <p style={{ fontSize: 14, fontWeight: 900, color: "#22c55e", textAlign: "right", alignSelf: "center" }}>{fmtR(s.valor_a_repassar)}</p>
                <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "right", alignSelf: "center" }}>
                  {expandida === s.loja.id ? "▲" : "▼"} detalhes
                </p>
              </div>

              {/* Detalhe expandido — pedidos da loja */}
              {expandida === s.loja.id && (
                <div style={{ background: "#FAFFFE", borderTop: "1px solid #DCFCE7", borderBottom: "1px solid #F1F5F9", padding: "0 20px 14px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0, padding: "8px 0 4px", marginBottom: 4 }}>
                    {["Cód. Pedido", "Data", "Forma pag.", "Total"].map((h, i) => (
                      <p key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, textAlign: i === 3 ? "right" : "left" }}>{h}</p>
                    ))}
                  </div>
                  <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
                    {s.pedidos.map(p => (
                      <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0, padding: "7px 0", borderBottom: "1px solid #F1F5F9" }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", fontFamily: "monospace" }}>#{p.codigo}</p>
                        <p style={{ fontSize: 12, color: "#64748b" }}>{fmtData(p.criado_em)}</p>
                        <p style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.3 }}>{p.forma_pagamento}</p>
                        <p style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", textAlign: "right" }}>{fmtR(Number(p.total))}</p>
                      </div>
                    ))}
                  </div>
                  {/* Subtotais da loja */}
                  <div style={{ marginTop: 10, padding: "10px 0 0", borderTop: "1.5px solid #DCFCE7", display: "flex", gap: 20, flexWrap: "wrap" }}>
                    {[
                      { label: "Volume total",  value: fmtR(s.total_vendas), color: "#8b5cf6" },
                      { label: "Taxa Chegô",    value: `−${fmtR(s.taxa_chego)}`, color: "#f97316" },
                      { label: "Taxa Asaas",    value: `−${fmtR(s.taxa_asaas)}`, color: "#f59e0b" },
                      { label: "Repasse líquido", value: fmtR(s.valor_a_repassar), color: "#22c55e" },
                    ].map(r => (
                      <div key={r.label}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{r.label}</p>
                        <p style={{ fontSize: 14, fontWeight: 900, color: r.color }}>{r.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Linha de total */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 80px", gap: 0, padding: "16px 20px", background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
            <p style={{ fontSize: 12, fontWeight: 900, color: "#0F172A" }}>TOTAL GERAL ({stats.length} lojas)</p>
            <p style={{ fontSize: 13, fontWeight: 900, color: "#374151", textAlign: "right" }}>{totais.pedidos}</p>
            <p style={{ fontSize: 13, fontWeight: 900, color: "#8b5cf6", textAlign: "right" }}>{fmtR(totais.vendas)}</p>
            <p style={{ fontSize: 13, fontWeight: 900, color: "#f97316", textAlign: "right" }}>{fmtR(totais.chego)}</p>
            <p style={{ fontSize: 13, fontWeight: 900, color: "#f59e0b", textAlign: "right" }}>{fmtR(totais.asaas)}</p>
            <p style={{ fontSize: 15, fontWeight: 900, color: "#22c55e", textAlign: "right" }}>{fmtR(totais.repasse)}</p>
            <div />
          </div>
        </div>
        </div>
      )}

      {/* Tabela de repasse motoboys */}
      {!loading && motoboyStats.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(139,92,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/>
                <path d="M6 17L9 10l5 0 4 7"/><path d="M9 10l2-3 5 0 2 3"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 900, color: "#0F172A" }}>Repasse Motoboys</p>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>Taxa de entrega a repassar por entregador</p>
            </div>
          </div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" as any }}>
          <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #F1F5F9", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", minWidth: 520 }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.5fr", padding: "10px 20px", background: "#F8FAFC", borderBottom: "1.5px solid #F1F5F9" }}>
              {["Motoboy", "Entregas", "Total a repassar", "Chave PIX"].map((h, i) => (
                <p key={h} style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8, textAlign: i > 0 ? "right" : "left" }}>{h}</p>
              ))}
            </div>
            {motoboyStats.map(s => (
              <div key={s.motoboy.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.5fr", padding: "14px 20px", borderBottom: "1px solid #F8FAFC", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(139,92,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#8b5cf6", flexShrink: 0 }}>
                    {s.motoboy.nome.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{s.motoboy.nome}</p>
                    <p style={{ fontSize: 10, color: "#94a3b8" }}>{s.motoboy.telefone ?? "—"}</p>
                  </div>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", textAlign: "right" }}>{s.entregas}</p>
                <p style={{ fontSize: 14, fontWeight: 900, color: "#8b5cf6", textAlign: "right" }}>{fmtR(s.total_ganho)}</p>
                <p style={{ fontSize: 11, color: "#64748b", textAlign: "right", fontFamily: "monospace", wordBreak: "break-all" }}>
                  {(s.motoboy as any).pix_key ?? "—"}
                </p>
              </div>
            ))}
            {/* Total */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.5fr", padding: "14px 20px", background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
              <p style={{ fontSize: 12, fontWeight: 900, color: "#0F172A" }}>TOTAL ({motoboyStats.length} motoboys)</p>
              <p style={{ fontSize: 13, fontWeight: 900, color: "#374151", textAlign: "right" }}>{totalMotoboys.entregas}</p>
              <p style={{ fontSize: 15, fontWeight: 900, color: "#8b5cf6", textAlign: "right" }}>{fmtR(totalMotoboys.ganho)}</p>
              <div />
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Nota de rodapé */}
      <div style={{ marginTop: 20, padding: "14px 18px", background: "white", borderRadius: 12, border: "1.5px solid #F1F5F9", fontSize: 11, color: "#94a3b8", lineHeight: 1.7 }}>
        <strong style={{ color: "#374151" }}>Notas do relatório:</strong><br />
        · Apenas pedidos com status <strong>Entregue</strong> são contabilizados.<br />
        · Taxa Chegô: R$ {TAXA_CHEGO_POR_ENTREGA.toFixed(2)} por entrega realizada.<br />
        · Taxa Asaas (estimada): R$ {TAXA_ASAAS_PIX.toFixed(2)} por PIX enviado (1 transferência por loja por período de repasse).<br />
        · Plano Gold: desconta também a comissão percentual sobre o volume de vendas.<br />
        · Repasses realizados toda <strong style={{ color: "#374151" }}>terça-feira</strong> e <strong style={{ color: "#374151" }}>quinta-feira</strong> via PIX.
      </div>
    </div>
  )
}
