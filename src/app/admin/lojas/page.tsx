"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Loja, StatusLoja } from "@/types"

const STATUS_LABEL: Record<string, string> = {
  pendente:          "Pendente",
  aprovado:          "Aprovado",
  contrato_assinado: "Contrato assinado",
  ativo:             "Ativo",
  suspenso:          "Suspenso",
}
const STATUS_BADGE: Record<string, string> = {
  pendente:          "badge-yellow",
  aprovado:          "badge-blue",
  contrato_assinado: "badge-purple",
  ativo:             "badge-green",
  suspenso:          "badge-red",
}
const CATEGORIAS = ["Todos", "Restaurante", "Mercadinho", "Farmácia", "Outros"]

function gerarToken() {
  return crypto.randomUUID()
}

export default function LojasPage() {
  const [lojas, setLojas]       = useState<Loja[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState<string>("Todos")
  const [status, setStatus]     = useState<string>("todos")
  const [selecionada, setSelecionada] = useState<Loja | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [copiado, setCopiado]   = useState(false)

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

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Lojas</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{lojas.length} cadastradas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 sm:mb-6 flex-wrap">
        <select className="input" style={{ width: "auto", fontSize: 13 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="pendente">Pendentes</option>
          <option value="aprovado">Aprovados</option>
          <option value="contrato_assinado">Contrato assinado</option>
          <option value="ativo">Ativos</option>
          <option value="suspenso">Suspensos</option>
        </select>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIAS.map(c => (
            <button key={c} onClick={() => setFiltro(c)}
              className="btn-ghost"
              style={{
                fontSize: 11, padding: "6px 10px",
                background: filtro === c ? "rgba(249,115,22,0.12)" : undefined,
                color:      filtro === c ? "#f97316" : undefined,
                border:     filtro === c ? "1px solid rgba(249,115,22,0.3)" : undefined,
              }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, flexDirection: selecionada ? "column" : "row" }}>
        {/* Lista */}
        <div className="flex-1 flex flex-col gap-3" style={{ minWidth: 0 }}>
          {loading ? (
            <p className="text-white/30 text-sm">Carregando...</p>
          ) : filtradas.length === 0 ? (
            <p className="text-white/30 text-sm">Nenhuma loja encontrada.</p>
          ) : (
            filtradas.map(l => (
              <div key={l.id}
                onClick={() => setSelecionada(l)}
                className="card p-4 cursor-pointer transition-all flex items-center gap-3"
                style={{ border: selecionada?.id === l.id ? "1px solid rgba(249,115,22,0.4)" : undefined }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(249,115,22,0.1)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-white truncate">{l.nome}</p>
                    <span className={`badge ${STATUS_BADGE[l.status] ?? "badge-gray"}`}>{STATUS_LABEL[l.status] ?? l.status}</span>
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {l.categoria} · {l.endereco}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold" style={{ color: "#f97316" }}>R$ {l.taxa_entrega?.toFixed(2)}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>taxa</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Painel lateral */}
        {selecionada && (
          <div className="card p-5 flex flex-col gap-4" style={{ width: "100%", maxWidth: 400, flexShrink: 0, alignSelf: "flex-start", boxSizing: "border-box" }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-white text-lg truncate pr-2">{selecionada.nome}</p>
              <button onClick={() => setSelecionada(null)} className="text-white/30 hover:text-white/60 text-lg flex-shrink-0">✕</button>
            </div>

            <div className="flex flex-col gap-2 text-sm">
              <Row label="Status" value={STATUS_LABEL[selecionada.status] ?? selecionada.status} />
              <Row label="Categoria"    value={selecionada.categoria} />
              <Row label="Telefone"     value={selecionada.telefone} />
              <Row label="Endereço"     value={selecionada.endereco} />
              <Row label="Taxa entrega" value={`R$ ${selecionada.taxa_entrega?.toFixed(2)}`} />
              <Row label="Tempo"        value={`${selecionada.tempo_min}–${selecionada.tempo_max} min`} />
              <Row label="Comissão"     value={`${selecionada.comissao}%`} />
              {selecionada.nome_responsavel && <Row label="Responsável" value={selecionada.nome_responsavel} />}
              {selecionada.email && <Row label="Email" value={selecionada.email} />}
              {selecionada.cnpj && <Row label="CNPJ" value={selecionada.cnpj} />}
              {selecionada.cpf_responsavel && <Row label="CPF" value={selecionada.cpf_responsavel} />}
              {selecionada.pix_key && <Row label="PIX" value={selecionada.pix_key} />}
              <Row label="Cadastro" value={new Date(selecionada.criado_em).toLocaleDateString("pt-BR")} />
              {selecionada.contrato_assinado_em && (
                <Row label="Assinado em" value={new Date(selecionada.contrato_assinado_em).toLocaleDateString("pt-BR")} />
              )}
            </div>

            {selecionada.descricao && (
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
                {selecionada.descricao}
              </p>
            )}

            {/* Link do contrato (status aprovado) */}
            {selecionada.status === "aprovado" && selecionada.contrato_token && (
              <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "12px" }}>
                <p className="text-xs font-bold mb-2" style={{ color: "#818cf8" }}>🔗 Link do contrato</p>
                <p className="text-xs break-all mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                  /contrato/loja/{selecionada.contrato_token.slice(0, 12)}...
                </p>
                <button onClick={() => copiarLink(selecionada)}
                  style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.3)", background: "none", color: "#818cf8", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  {copiado ? "✓ Copiado!" : "Copiar link"}
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid #1e1e1e" }}>
              {selecionada.status === "pendente" && (
                <>
                  <button onClick={() => aprovar(selecionada)} disabled={salvando}
                    className="btn-primary w-full justify-center">
                    ✓ Aprovar e gerar contrato
                  </button>
                  <button onClick={() => atualizarStatus(selecionada.id, "suspenso")} disabled={salvando}
                    className="btn-ghost w-full justify-center"
                    style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}>
                    Recusar cadastro
                  </button>
                </>
              )}
              {selecionada.status === "aprovado" && (
                <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Aguardando assinatura do contrato
                </p>
              )}
              {selecionada.status === "contrato_assinado" && (
                <button onClick={() => atualizarStatus(selecionada.id, "ativo")} disabled={salvando}
                  className="btn-primary w-full justify-center">
                  ✓ Ativar loja
                </button>
              )}
              {selecionada.status === "ativo" && (
                <button onClick={() => atualizarStatus(selecionada.id, "suspenso")} disabled={salvando}
                  className="btn-ghost w-full justify-center"
                  style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}>
                  Suspender loja
                </button>
              )}
              {selecionada.status === "suspenso" && (
                <button onClick={() => atualizarStatus(selecionada.id, "ativo")} disabled={salvando}
                  className="btn-primary w-full justify-center">
                  Reativar loja
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{label}</span>
      <span className="font-semibold text-white text-right truncate" style={{ maxWidth: "60%", minWidth: 0 }} title={value}>{value}</span>
    </div>
  )
}
