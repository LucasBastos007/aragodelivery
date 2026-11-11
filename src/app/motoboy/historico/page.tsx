"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { ganhoMotoboy, ganhoMotoboyPedido } from "@/lib/comissao"
import { partesPagamento, rotuloPagamento, temForma, valorDaForma, ehDividido } from "@/lib/pagamentoDividido"

type Periodo = "hoje" | "semana" | "mes" | "total"

const PGTO: Record<string, string> = {
  pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha", pix_loja: "Pix (já pago)", avulsa: "Entrega avulsa",
}
const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "hoje",   label: "Hoje" },
  { key: "semana", label: "7 dias" },
  { key: "mes",    label: "Este mês" },
  { key: "total",  label: "Total" },
]
const PAGE_SIZE = 20

function dateInicio(periodo: Periodo): Date {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  if (periodo === "hoje")   return hoje
  if (periodo === "semana") { const d = new Date(hoje); d.setDate(d.getDate() - 6); return d }
  if (periodo === "mes")    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  return new Date(2020, 0, 1)
}

// Calcula sempre pela fórmula canônica — a coluna ganho_motoboy no banco tem histórico
// de valores gravados por caminhos divergentes (ex: 100% da taxa) e não é confiável.
function ganhoReal(p: any): number {
  return ganhoMotoboyPedido(p)
}

const hojeYmd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
function rotuloDia(iso: string) {
  const d = new Date(iso), hoje = new Date(), ontem = new Date(Date.now() - 86400000)
  if (hojeYmd(d) === hojeYmd(hoje)) return "Hoje"
  if (hojeYmd(d) === hojeYmd(ontem)) return "Ontem"
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })
}
function porDia<T extends { criado_em: string }>(ps: T[]): [string, T[]][] {
  const m = new Map<string, T[]>()
  for (const p of ps) { const k = rotuloDia(p.criado_em); m.set(k, [...(m.get(k) ?? []), p]) }
  return [...m.entries()]
}
const horaDe = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).replace(":", "h")
// "Rua X, 12 — Compl — Bairro, Cidade" → "Bairro"
function bairroDe(end?: string | null) {
  if (!end) return ""
  const partes = end.split(" — ")
  const ult = partes[partes.length - 1] ?? ""
  return partes.length > 1 ? ult.split(",")[0].trim() : ""
}
function seloPg(p: any): [string, string] {
  if (p.forma_pagamento === "avulsa") return ["off", "Avulsa"]
  const f = p.forma_pagamento_2 && ["dinheiro", "maquininha"].includes(p.forma_pagamento_2) ? p.forma_pagamento_2 : p.forma_pagamento
  if (f === "dinheiro") return ["din", "Dinheiro"]
  if (f === "maquininha") return ["maq", "Maquininha"]
  if (f === "cartao") return ["pix", "Cartão já pago"]
  return ["pix", "Pix já pago"]
}

export default function MotoboyHistoricoPage() {
  const { sessao } = useAuth()
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null

  const [periodo,  setPeriodo]  = useState<Periodo>("total")
  const [pedidos,  setPedidos]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [page,     setPage]     = useState(0)
  const [hasMore,  setHasMore]  = useState(false)
  const [total,    setTotal]    = useState(0)
  const [totalGanhos, setTotalGanhos] = useState(0)
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)

  useEffect(() => { if (motoboy_id) { setPedidos([]); setPage(0); carregar(0) } }, [motoboy_id, periodo])

  // Pedido explícito do usuário, 2026-09-17: (1) contabilizar também as entregas avulsas
// junto dos pedidos normais, e (2) o filtro "Total" ficava vazio às vezes com o filtro de
// data feito direto no Postgrest (.gte/.lte) — agora busca tudo (pedidos + avulsas) sem
// filtro de data na query e filtra por período aqui em JS, igual o Dashboard já fazia
// (mesma comparação, resultado sempre consistente entre as duas telas). Paginação também
// virou client-side (slice do array já mesclado) já que agora são duas fontes.
async function carregar(novaPagina: number) {
  setLoading(true)
  const inicio = dateInicio(periodo)
  const fim    = new Date(); fim.setHours(23, 59, 59, 999)

  const [{ data: pedidosData }, { data: avulsasData }] = await Promise.all([
    supabase.from("pedidos")
      // "foto_entrega" saiu da consulta: a coluna não existe em pedidos e derrubava a
      // consulta inteira, deixando o histórico sempre vazio (achado em 20/10/2026).
      .select("id, codigo, taxa_entrega, taxa_dinamica, criado_em, forma_pagamento, forma_pagamento_2, valor_pagamento_1, valor_pagamento_2, total, endereco_entrega, loja:lojas(nome)")
      .eq("motoboy_id", motoboy_id).eq("status", "entregue")
      .order("criado_em", { ascending: false }),
    supabase.from("entregas_avulsas")
      .select("id, codigo, taxa_entrega, criado_em, endereco, loja_nome")
      .eq("motoboy_id", motoboy_id).eq("status", "entregue")
      .order("criado_em", { ascending: false }),
  ])

  const avulsasNormalizadas = ((avulsasData ?? []) as any[]).map(a => ({
    ...a, loja: { nome: a.loja_nome }, endereco_entrega: a.endereco, forma_pagamento: "avulsa", foto_entrega: null,
  }))
  const todosMesclados = [...((pedidosData ?? []) as any[]), ...avulsasNormalizadas]
    .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
    .filter(p => { const d = new Date(p.criado_em); return d >= inicio && d <= fim })

  const ateAqui = (novaPagina + 1) * PAGE_SIZE
  setPedidos(todosMesclados.slice(0, ateAqui))
  setTotal(todosMesclados.length)
  setHasMore(todosMesclados.length > ateAqui)
  setPage(novaPagina)
  setTotalGanhos(todosMesclados.reduce((s, p) => s + ganhoReal(p), 0))
  setLoading(false)
}

  const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", ", às")

  return (
    <div className="mb-pagina">
      {fotoAmpliada && (
        <div onClick={() => setFotoAmpliada(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <img src={fotoAmpliada} alt="Comprovante da entrega" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 16, objectFit: "contain" }} />
        </div>
      )}

      <h1 className="t28">Histórico</h1>

      <div className="mb-chips">
        {PERIODOS.map(p => <button key={p.key} className="mb-chip" aria-pressed={periodo === p.key} onClick={() => setPeriodo(p.key)}>{p.label}</button>)}
      </div>

      {loading && pedidos.length === 0 ? (
        <p className="mut" style={{ marginTop: 20 }}>Carregando…</p>
      ) : pedidos.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 50 }}>
          <div style={{ fontSize: 40 }}>🛵</div>
          <b className="t16" style={{ display: "block", marginTop: 8 }}>Nenhuma entrega nesse período</b>
          <p className="mut" style={{ fontSize: 13.5, marginTop: 4 }}>Quando você entregar, aparece aqui.</p>
        </div>
      ) : (
        // Igual à proposta: corridas agrupadas por dia, com o total do dia e a forma de pagamento em selo
        <>{porDia(pedidos).map(([dia, ps]) => (
          <div key={dia}>
            <div className="mb-dia-tit">{dia}, {brl(ps.reduce((s, p) => s + ganhoReal(p), 0))}</div>
            <div className="mb-cartao" style={{ padding: "2px 16px" }}>
              {ps.map((p, i) => {
                const sl = seloPg(p)
                return (
                  <div key={p.id + i} className="mb-linha-h">
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b className="t16" style={{ display: "block", fontWeight: 700 }}>{p.loja?.nome ?? "Loja"}</b>
                      <small className="mut" style={{ fontSize: 14 }}>{bairroDe(p.endereco_entrega)}{bairroDe(p.endereco_entrega) ? ", " : ""}{horaDe(p.criado_em)}</small>
                    </span>
                    <span className="v">
                      {brl(ganhoReal(p))}
                      <small><span className={`mb-selo ${sl[0]}`}>{sl[1]}</span></small>
                      {p.foto_entrega && <img src={p.foto_entrega} alt="Comprovante" onClick={() => setFotoAmpliada(p.foto_entrega)} style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", cursor: "pointer", border: "1px solid var(--linha)", marginTop: 4 }} />}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}</>
      )}

      {hasMore && pedidos.length > 0 && (
        <button className="mb-btn claro peq" style={{ marginTop: 12 }} onClick={() => carregar(page + 1)} disabled={loading}>{loading ? "Carregando…" : "Ver mais"}</button>
      )}
    </div>
  )
}
