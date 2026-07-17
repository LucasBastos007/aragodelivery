"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface Contagem {
  hoje: number
  semana: number
  mes: number
  total: number
}

interface DiaCount { dia: string; n: number }

function inicioDia() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString()
}
function inicioSemana() {
  const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d.toISOString()
}
function inicioMes() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString()
}

function Card({ titulo, icon, cor, dados }: { titulo: string; icon: React.ReactNode; cor: string; dados: Contagem }) {
  return (
    <div style={{ background: "white", borderRadius: 16, padding: "20px 22px", border: "1px solid #e2e8f0", flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cor}15`, border: `1px solid ${cor}30`, display: "flex", alignItems: "center", justifyContent: "center", color: cor }}>
          {icon}
        </div>
        <p style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>{titulo}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px" }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: cor }}>{dados.hoje}</p>
          <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginTop: 2 }}>Hoje</p>
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px" }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: "#334155" }}>{dados.semana}</p>
          <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginTop: 2 }}>7 dias</p>
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px" }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: "#334155" }}>{dados.mes}</p>
          <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginTop: 2 }}>Este mês</p>
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px" }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: "#334155" }}>{dados.total}</p>
          <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginTop: 2 }}>Total</p>
        </div>
      </div>
    </div>
  )
}

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

export default function AcessosPage() {
  const [acessos,   setAcessos]   = useState<Contagem>({ hoje: 0, semana: 0, mes: 0, total: 0 })
  const [cadastros, setCadastros] = useState<Contagem>({ hoje: 0, semana: 0, mes: 0, total: 0 })
  const [pedidos,   setPedidos]   = useState<Contagem>({ hoje: 0, semana: 0, mes: 0, total: 0 })
  const [diasAcessos,   setDiasAcessos]   = useState<DiaCount[]>([])
  const [diasCadastros, setDiasCadastros] = useState<DiaCount[]>([])
  const [diasPedidos,   setDiasPedidos]   = useState<DiaCount[]>([])
  const [loading, setLoading] = useState(true)
  const [semTabela, setSemTabela] = useState(false)

  async function load() {
    const hoje   = inicioDia()
    const semana = inicioSemana()
    const mes    = inicioMes()

    // Acessos (tabela acessos_app)
    const [
      { count: aHoje,   error: err1 },
      { count: aSemana, error: err2 },
      { count: aMes },
      { count: aTotal },
    ] = await Promise.all([
      supabase.from("acessos_app").select("*", { count: "exact", head: true }).eq("tipo", "acesso").gte("criado_em", hoje),
      supabase.from("acessos_app").select("*", { count: "exact", head: true }).eq("tipo", "acesso").gte("criado_em", semana),
      supabase.from("acessos_app").select("*", { count: "exact", head: true }).eq("tipo", "acesso").gte("criado_em", mes),
      supabase.from("acessos_app").select("*", { count: "exact", head: true }).eq("tipo", "acesso"),
    ])

    if (err1 || err2) { setSemTabela(true) }

    setAcessos({ hoje: aHoje ?? 0, semana: aSemana ?? 0, mes: aMes ?? 0, total: aTotal ?? 0 })

    // Cadastros (tabela clientes)
    const [
      { count: cHoje },
      { count: cSemana },
      { count: cMes },
      { count: cTotal },
    ] = await Promise.all([
      supabase.from("clientes").select("*", { count: "exact", head: true }).gte("criado_em", hoje),
      supabase.from("clientes").select("*", { count: "exact", head: true }).gte("criado_em", semana),
      supabase.from("clientes").select("*", { count: "exact", head: true }).gte("criado_em", mes),
      supabase.from("clientes").select("*", { count: "exact", head: true }),
    ])
    setCadastros({ hoje: cHoje ?? 0, semana: cSemana ?? 0, mes: cMes ?? 0, total: cTotal ?? 0 })

    // Pedidos (tabela pedidos)
    const [
      { count: pHoje },
      { count: pSemana },
      { count: pMes },
      { count: pTotal },
    ] = await Promise.all([
      supabase.from("pedidos").select("*", { count: "exact", head: true }).neq("status", "cancelado").gte("criado_em", hoje),
      supabase.from("pedidos").select("*", { count: "exact", head: true }).neq("status", "cancelado").gte("criado_em", semana),
      supabase.from("pedidos").select("*", { count: "exact", head: true }).neq("status", "cancelado").gte("criado_em", mes),
      supabase.from("pedidos").select("*", { count: "exact", head: true }).neq("status", "cancelado"),
    ])
    setPedidos({ hoje: pHoje ?? 0, semana: pSemana ?? 0, mes: pMes ?? 0, total: pTotal ?? 0 })

    // Gráfico últimos 7 dias
    const dias7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0)
      return d.toISOString().slice(0, 10)
    })

    // Pedidos por dia
    const { data: pedDias } = await supabase
      .from("pedidos")
      .select("criado_em")
      .neq("status", "cancelado")
      .gte("criado_em", semana)

    const pedMap: Record<string, number> = {}
    for (const p of pedDias ?? []) {
      const dia = (p as any).criado_em.slice(0, 10)
      pedMap[dia] = (pedMap[dia] ?? 0) + 1
    }
    setDiasPedidos(dias7.map(dia => ({ dia, n: pedMap[dia] ?? 0 })))

    // Cadastros por dia
    const { data: cadDias } = await supabase
      .from("clientes")
      .select("criado_em")
      .gte("criado_em", semana)

    const cadMap: Record<string, number> = {}
    for (const c of cadDias ?? []) {
      const dia = (c as any).criado_em.slice(0, 10)
      cadMap[dia] = (cadMap[dia] ?? 0) + 1
    }
    setDiasCadastros(dias7.map(dia => ({ dia, n: cadMap[dia] ?? 0 })))

    // Acessos por dia (se tabela existir)
    if (!err1) {
      const { data: accDias } = await supabase
        .from("acessos_app")
        .select("criado_em")
        .eq("tipo", "acesso")
        .gte("criado_em", semana)

      const accMap: Record<string, number> = {}
      for (const a of accDias ?? []) {
        const dia = (a as any).criado_em.slice(0, 10)
        accMap[dia] = (accMap[dia] ?? 0) + 1
      }
      setDiasAcessos(dias7.map(dia => ({ dia, n: accMap[dia] ?? 0 })))
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
    const iv = setInterval(load, 30_000)
    return () => clearInterval(iv)
  }, [])

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

  return (
    <div className="p-4 sm:p-8" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: "#0F172A", fontSize: 22, fontWeight: 900 }}>Acessos</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 2 }}>Monitoramento de uso do app em tempo real</p>
      </div>

      {semTabela && (
        <div style={{
          background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 20,
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>Tabela de acessos não encontrada</p>
            <p style={{ fontSize: 12, color: "#78350f", marginTop: 4 }}>
              Execute o SQL abaixo no <strong>Supabase SQL Editor</strong> para ativar o contador de acessos:
            </p>
            <code style={{
              display: "block", marginTop: 8, background: "#1e293b", color: "#7dd3fc",
              fontSize: 11, padding: "8px 12px", borderRadius: 8, fontFamily: "monospace",
            }}>
              {`CREATE TABLE acessos_app (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON acessos_app (tipo, criado_em);`}
            </code>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "#94a3b8", fontSize: 13 }}>Carregando...</p>
      ) : (
        <>
          {/* Cards */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
            <Card titulo="Acessos ao app"    icon={iconAcesso}   cor="#f97316" dados={acessos}   />
            <Card titulo="Contas criadas"    icon={iconCadastro} cor="#8b5cf6" dados={cadastros} />
            <Card titulo="Pedidos realizados" icon={iconPedido}  cor="#10b981" dados={pedidos}   />
          </div>

          {/* Gráfico 7 dias */}
          <div style={{ background: "white", borderRadius: 16, padding: "20px 22px", border: "1px solid #e2e8f0" }}>
            <p style={{ fontWeight: 800, fontSize: 14, color: "#0F172A", marginBottom: 18 }}>Últimos 7 dias</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {!semTabela && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "#f97316", fontWeight: 700 }}>Acessos</span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{acessos.semana} total</span>
                  </div>
                  <MiniChart dias={diasAcessos} cor="#f97316" />
                </div>
              )}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#8b5cf6", fontWeight: 700 }}>Cadastros</span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{cadastros.semana} total</span>
                </div>
                <MiniChart dias={diasCadastros} cor="#8b5cf6" />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>Pedidos</span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{pedidos.semana} total</span>
                </div>
                <MiniChart dias={diasPedidos} cor="#10b981" />
              </div>
            </div>

            {/* Legenda dias */}
            <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
              {diasPedidos.map(d => (
                <div key={d.dia} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "#94a3b8" }}>
                  {new Date(d.dia + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3)}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
