"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Motoboy, StatusMotoboy } from "@/types"

const STATUS_LABEL: Record<string, string> = {
  pendente:          "Pendente",
  aprovado:          "Aprovado",
  contrato_assinado: "Contrato assinado",
  ativo:             "Ativo",
  suspenso:          "Suspenso",
  offline:           "Offline",
}
const STATUS_BADGE: Record<string, string> = {
  pendente:          "badge-yellow",
  aprovado:          "badge-blue",
  contrato_assinado: "badge-purple",
  ativo:             "badge-green",
  suspenso:          "badge-red",
  offline:           "badge-gray",
}

export default function MotoboyPage() {
  const [motoboys, setMotoboys]   = useState<Motoboy[]>([])
  const [loading, setLoading]     = useState(true)
  const [status, setStatus]       = useState("todos")
  const [selecionado, setSelecionado] = useState<Motoboy | null>(null)
  const [salvando, setSalvando]   = useState(false)
  const [copiado, setCopiado]     = useState(false)

  async function load() {
    const { data } = await supabase.from("motoboys").select("*").order("criado_em", { ascending: false })
    setMotoboys(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function atualizarStatus(id: string, novoStatus: StatusMotoboy, extra?: Record<string, unknown>) {
    setSalvando(true)
    await supabase.from("motoboys").update({ status: novoStatus, ...extra }).eq("id", id)
    await load()
    setSelecionado(prev => prev ? { ...prev, status: novoStatus, ...extra } as Motoboy : null)
    setSalvando(false)
  }

  async function aprovar(m: Motoboy) {
    const token = crypto.randomUUID()
    await atualizarStatus(m.id, "aprovado", { contrato_token: token })
  }

  function linkContrato(m: Motoboy) {
    return `${window.location.origin}/contrato/motoboy/${m.contrato_token}`
  }

  async function copiarLink(m: Motoboy) {
    await navigator.clipboard.writeText(linkContrato(m))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const filtrados = motoboys.filter(m => status === "todos" || m.status === status)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Motoboys</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{motoboys.length} cadastrados</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <select className="input" style={{ width: "auto" }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="pendente">Pendentes</option>
          <option value="aprovado">Aprovados</option>
          <option value="contrato_assinado">Contrato assinado</option>
          <option value="ativo">Ativos</option>
          <option value="offline">Offline</option>
          <option value="suspenso">Suspensos</option>
        </select>
      </div>

      <div className="flex gap-5">
        <div className="flex-1 flex flex-col gap-3">
          {loading ? (
            <p className="text-white/30 text-sm">Carregando...</p>
          ) : filtrados.length === 0 ? (
            <p className="text-white/30 text-sm">Nenhum motoboy encontrado.</p>
          ) : (
            filtrados.map(m => (
              <div key={m.id}
                onClick={() => setSelecionado(m)}
                className="card p-4 cursor-pointer flex items-center gap-4"
                style={{ border: selecionado?.id === m.id ? "1px solid rgba(249,115,22,0.4)" : undefined }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: "rgba(249,115,22,0.1)" }}>
                  🏍️
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white">{m.nome}</p>
                    <span className={`badge ${STATUS_BADGE[m.status] ?? "badge-gray"}`}>{STATUS_LABEL[m.status] ?? m.status}</span>
                    {m.disponivel && m.status === "ativo" && <span className="badge badge-green">Online</span>}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {m.veiculo} · {m.placa} · {m.telefone}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {selecionado && (
          <div className="card p-6 flex flex-col gap-4" style={{ width: 320, flexShrink: 0, alignSelf: "flex-start", position: "sticky", top: 20 }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-white text-lg truncate pr-2">{selecionado.nome}</p>
              <button onClick={() => setSelecionado(null)} className="text-white/30 hover:text-white/60 text-lg">✕</button>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <Row label="Status"   value={STATUS_LABEL[selecionado.status] ?? selecionado.status} />
              <Row label="Telefone" value={selecionado.telefone} />
              <Row label="Email"    value={selecionado.email} />
              <Row label="CPF"      value={selecionado.cpf} />
              <Row label="Veículo"  value={selecionado.veiculo} />
              <Row label="Placa"    value={selecionado.placa} />
              {selecionado.cnh && <Row label="CNH" value={selecionado.cnh} />}
              {selecionado.pix_key && <Row label="PIX" value={selecionado.pix_key} />}
              <Row label="Cadastro" value={new Date(selecionado.criado_em).toLocaleDateString("pt-BR")} />
              {selecionado.contrato_assinado_em && (
                <Row label="Assinado em" value={new Date(selecionado.contrato_assinado_em).toLocaleDateString("pt-BR")} />
              )}
            </div>

            {/* Link do contrato (status aprovado) */}
            {selecionado.status === "aprovado" && selecionado.contrato_token && (
              <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "12px" }}>
                <p className="text-xs font-bold mb-2" style={{ color: "#818cf8" }}>🔗 Link do contrato</p>
                <p className="text-xs break-all mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                  /contrato/motoboy/{selecionado.contrato_token.slice(0, 12)}...
                </p>
                <button onClick={() => copiarLink(selecionado)}
                  style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.3)", background: "none", color: "#818cf8", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  {copiado ? "✓ Copiado!" : "Copiar link"}
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid #1e1e1e" }}>
              {selecionado.status === "pendente" && (
                <>
                  <button onClick={() => aprovar(selecionado)} disabled={salvando}
                    className="btn-primary w-full justify-center">
                    ✓ Aprovar e gerar contrato
                  </button>
                  <button onClick={() => atualizarStatus(selecionado.id, "suspenso")} disabled={salvando}
                    className="btn-ghost w-full justify-center"
                    style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}>
                    Recusar
                  </button>
                </>
              )}
              {selecionado.status === "aprovado" && (
                <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Aguardando assinatura do contrato
                </p>
              )}
              {selecionado.status === "contrato_assinado" && (
                <button onClick={() => atualizarStatus(selecionado.id, "ativo")} disabled={salvando}
                  className="btn-primary w-full justify-center">
                  ✓ Ativar motoboy
                </button>
              )}
              {selecionado.status === "ativo" && (
                <button onClick={() => atualizarStatus(selecionado.id, "suspenso")} disabled={salvando}
                  className="btn-ghost w-full justify-center"
                  style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}>
                  Suspender
                </button>
              )}
              {selecionado.status === "suspenso" && (
                <button onClick={() => atualizarStatus(selecionado.id, "ativo")} disabled={salvando}
                  className="btn-primary w-full justify-center">
                  Reativar
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
      <span style={{ color: "rgba(255,255,255,0.3)" }}>{label}</span>
      <span className="font-semibold text-white text-right truncate max-w-[170px]" title={value}>{value}</span>
    </div>
  )
}
