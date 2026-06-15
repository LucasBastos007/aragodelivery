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
const STATUS_COLOR: Record<string, string> = {
  pendente:          "#f59e0b",
  aprovado:          "#60a5fa",
  contrato_assinado: "#a78bfa",
  ativo:             "#22c55e",
  suspenso:          "#ef4444",
  offline:           "#555",
}

// ─── Modal de rejeição ────────────────────────────────────────────────────────
function ModalRejeicao({
  motoboy, onConfirmar, onCancelar, salvando,
}: {
  motoboy: Motoboy
  onConfirmar: (motivo: string) => void
  onCancelar: () => void
  salvando: boolean
}) {
  const [motivo, setMotivo] = useState("")

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#1C1C1E", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 440,
        boxShadow: "0 8px 48px rgba(0,0,0,0.8)",
      }}>
        <p style={{ color: "white", fontWeight: 900, fontSize: 16, marginBottom: 4 }}>Rejeitar cadastro</p>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginBottom: 20 }}>
          Informe o motivo para {motoboy.nome}
        </p>

        <textarea
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Ex: Documentação incompleta, CNH vencida, área fora de cobertura..."
          rows={4}
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12, resize: "vertical",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
            color: "white", fontSize: 13, fontFamily: "inherit", outline: "none",
            boxSizing: "border-box",
          }}
        />

        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button
            onClick={() => onConfirmar(motivo)}
            disabled={salvando || !motivo.trim()}
            style={{
              flex: 1, padding: "12px", borderRadius: 12, border: "none",
              background: motivo.trim() ? "#ef4444" : "rgba(239,68,68,0.2)",
              color: motivo.trim() ? "white" : "rgba(255,255,255,0.3)",
              fontWeight: 900, fontSize: 14, cursor: motivo.trim() ? "pointer" : "not-allowed",
            }}>
            {salvando ? "Salvando..." : "Confirmar rejeição"}
          </button>
          <button
            onClick={onCancelar}
            style={{
              padding: "12px 18px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
              color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Linha de dado ────────────────────────────────────────────────────────────
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
      <span style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{label}</span>
      <span style={{ color: "white", fontWeight: 600, textAlign: "right", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={value}>{value}</span>
    </div>
  )
}

// ─── Ícone motoboy ────────────────────────────────────────────────────────────
function IconMotoboy({ color = "rgba(249,115,22,0.7)", size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-3"/>
      <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
    </svg>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function MotoboyPage() {
  const [motoboys,    setMotoboys]    = useState<Motoboy[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filtroStatus, setFiltroStatus] = useState("todos")
  const [selecionado, setSelecionado] = useState<Motoboy | null>(null)
  const [salvando,    setSalvando]    = useState(false)
  const [copiado,     setCopiado]     = useState(false)
  const [modalRejeicao, setModalRejeicao] = useState(false)
  const [aprovadoWhats, setAprovadoWhats] = useState<Motoboy | null>(null)

  async function load() {
    const { data } = await supabase
      .from("motoboys")
      .select("*")
      .order("criado_em", { ascending: false })
    setMotoboys((data ?? []) as Motoboy[])
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

  function whatsAprovacao(m: Motoboy) {
    const tel  = m.telefone?.replace(/\D/g, "") ?? ""
    const link = `${typeof window !== "undefined" ? window.location.origin : ""}/contrato/motoboy/${m.contrato_token}`
    const msg  = encodeURIComponent(
      `Olá ${m.nome}! Seu cadastro como motoboy na Arago Delivery foi *aprovado*.\n\nAssine o contrato pelo link abaixo para ativar sua conta:\n${link}\n\nBem-vindo à equipe!`
    )
    return `https://wa.me/55${tel}?text=${msg}`
  }

  async function aprovar(m: Motoboy) {
    const token = crypto.randomUUID()
    await atualizarStatus(m.id, "aprovado", { contrato_token: token, motivo_rejeicao: null })
    const updated = { ...m, status: "aprovado" as StatusMotoboy, contrato_token: token }
    setAprovadoWhats(updated)
  }

  async function rejeitar(motivo: string) {
    if (!selecionado) return
    await atualizarStatus(selecionado.id, "suspenso", { motivo_rejeicao: motivo })
    setModalRejeicao(false)
    // Sugere WhatsApp de notificação
    if (selecionado.telefone) {
      const tel = selecionado.telefone.replace(/\D/g, "")
      const msg = encodeURIComponent(`Olá ${selecionado.nome}, infelizmente seu cadastro como motoboy na Arago Delivery não foi aprovado.\n\nMotivo: ${motivo}\n\nPara mais informações, entre em contato.`)
      window.open(`https://wa.me/55${tel}?text=${msg}`, "_blank")
    }
  }

  function linkContrato(m: Motoboy) {
    return `${window.location.origin}/contrato/motoboy/${m.contrato_token}`
  }

  async function copiarLink(m: Motoboy) {
    await navigator.clipboard.writeText(linkContrato(m))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const filtrados  = motoboys.filter(m => filtroStatus === "todos" || m.status === filtroStatus)
  const pendentes  = motoboys.filter(m => m.status === "pendente")
  const onlines    = motoboys.filter(m => m.disponivel && m.status === "ativo")

  return (
    <div style={{ padding: "28px 32px" }}>

      {/* Modal de rejeição */}
      {modalRejeicao && selecionado && (
        <ModalRejeicao
          motoboy={selecionado}
          onConfirmar={rejeitar}
          onCancelar={() => setModalRejeicao(false)}
          salvando={salvando}
        />
      )}

      {/* Toast de aprovação com WhatsApp */}
      {aprovadoWhats && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 100,
          background: "#1C1C1E", border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 16, padding: "16px 20px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          maxWidth: 320,
        }}>
          <p style={{ color: "#22c55e", fontWeight: 900, fontSize: 14, marginBottom: 4 }}>Aprovado!</p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 12 }}>
            Contrato gerado para {aprovadoWhats.nome}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href={whatsAprovacao(aprovadoWhats)}
              target="_blank" rel="noreferrer"
              onClick={() => setAprovadoWhats(null)}
              style={{
                flex: 1, padding: "8px", borderRadius: 10,
                background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.3)",
                color: "#25D366", fontWeight: 700, fontSize: 12,
                textDecoration: "none", textAlign: "center" as const,
              }}>
              Enviar WhatsApp
            </a>
            <button onClick={() => setAprovadoWhats(null)} style={{
              padding: "8px 12px", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
              color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer",
            }}>
              Depois
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "white", fontWeight: 900, fontSize: 22 }}>Motoboys</h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 4 }}>
            {motoboys.length} cadastrados · {onlines.length} online agora
          </p>
        </div>
        <button onClick={load} style={{
          padding: "8px 16px", borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>
          Atualizar
        </button>
      </div>

      {/* Banner de pendentes */}
      {pendentes.length > 0 && (
        <div
          onClick={() => setFiltroStatus("pendente")}
          style={{
            background: "rgba(245,158,11,0.08)", border: "1.5px solid rgba(245,158,11,0.3)",
            borderRadius: 14, padding: "14px 18px", marginBottom: 20, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 12,
          }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: "#f59e0b", fontWeight: 900, fontSize: 14 }}>
              {pendentes.length} cadastro{pendentes.length > 1 ? "s" : ""} aguardando aprovação
            </p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 }}>
              Clique para filtrar e revisar os cadastros pendentes
            </p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(245,158,11,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      )}

      {/* Filtro */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { key: "todos", label: "Todos" },
          { key: "pendente", label: `Pendentes${pendentes.length > 0 ? ` (${pendentes.length})` : ""}` },
          { key: "aprovado", label: "Aprovados" },
          { key: "contrato_assinado", label: "Contrato assinado" },
          { key: "ativo", label: "Ativos" },
          { key: "suspenso", label: "Suspensos" },
        ].map(f => (
          <button key={f.key} onClick={() => setFiltroStatus(f.key)} style={{
            padding: "7px 14px", borderRadius: 999, border: "none",
            background: filtroStatus === f.key
              ? (f.key === "pendente" ? "#f59e0b" : "#f97316")
              : "rgba(255,255,255,0.06)",
            color: filtroStatus === f.key ? "white" : "rgba(255,255,255,0.4)",
            fontWeight: 700, fontSize: 12, cursor: "pointer",
          }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {/* Lista */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {loading ? (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Carregando...</p>
          ) : filtrados.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Nenhum motoboy encontrado.</p>
          ) : (
            filtrados.map(m => {
              const cor = STATUS_COLOR[m.status] ?? "#555"
              return (
                <div
                  key={m.id}
                  onClick={() => setSelecionado(m)}
                  style={{
                    background: selecionado?.id === m.id ? "rgba(249,115,22,0.06)" : "#111",
                    border: `1px solid ${selecionado?.id === m.id ? "rgba(249,115,22,0.4)" : m.status === "pendente" ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: 14, padding: "14px 16px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 14, transition: "all 0.15s",
                  }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                    background: `${cor}18`, border: `1.5px solid ${cor}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <IconMotoboy color={cor} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>{m.nome}</p>
                      <span style={{
                        padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800,
                        background: `${cor}18`, color: cor, border: `1px solid ${cor}35`,
                      }}>
                        {STATUS_LABEL[m.status] ?? m.status}
                      </span>
                      {m.disponivel && m.status === "ativo" && (
                        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800, background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>
                          Online
                        </span>
                      )}
                    </div>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 3 }}>
                      {m.veiculo} · {m.placa} · {m.telefone}
                    </p>
                    {m.status === "pendente" && (
                      <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 3 }}>
                        Cadastro em {new Date(m.criado_em).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    {m.motivo_rejeicao && (
                      <p style={{ color: "#ef4444", fontSize: 11, marginTop: 3, fontStyle: "italic" }}>
                        Motivo: {m.motivo_rejeicao}
                      </p>
                    )}
                  </div>
                  {m.status === "pendente" && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Painel de detalhe */}
        {selecionado && (
          <div style={{
            width: 340, flexShrink: 0, alignSelf: "flex-start", position: "sticky", top: 20,
            background: "#111", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "22px 20px",
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: `${STATUS_COLOR[selecionado.status] ?? "#555"}18`,
                  border: `1.5px solid ${STATUS_COLOR[selecionado.status] ?? "#555"}40`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <IconMotoboy color={STATUS_COLOR[selecionado.status]} size={18} />
                </div>
                <div>
                  <p style={{ color: "white", fontWeight: 900, fontSize: 15 }}>{selecionado.nome}</p>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                    background: `${STATUS_COLOR[selecionado.status] ?? "#555"}18`,
                    color: STATUS_COLOR[selecionado.status] ?? "#555",
                    border: `1px solid ${STATUS_COLOR[selecionado.status] ?? "#555"}35`,
                  }}>
                    {STATUS_LABEL[selecionado.status] ?? selecionado.status}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelecionado(null)} style={{
                background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 8,
                color: "rgba(255,255,255,0.4)", width: 28, height: 28, cursor: "pointer", fontSize: 14,
              }}>✕</button>
            </div>

            {/* Dados */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0", borderTop: "1px solid #1e1e1e", borderBottom: "1px solid #1e1e1e" }}>
              <Row label="Telefone" value={selecionado.telefone} />
              <Row label="Email"    value={selecionado.email} />
              <Row label="CPF"      value={selecionado.cpf} />
              <Row label="Veículo"  value={selecionado.veiculo} />
              <Row label="Placa"    value={selecionado.placa} />
              {selecionado.cnh     && <Row label="CNH" value={selecionado.cnh} />}
              {selecionado.pix_key && <Row label="PIX" value={selecionado.pix_key} />}
              <Row label="Cadastro" value={new Date(selecionado.criado_em).toLocaleDateString("pt-BR")} />
              {selecionado.contrato_assinado_em && (
                <Row label="Assinado em" value={new Date(selecionado.contrato_assinado_em).toLocaleDateString("pt-BR")} />
              )}
            </div>

            {/* Motivo de rejeição */}
            {selecionado.motivo_rejeicao && (
              <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 12px" }}>
                <p style={{ color: "rgba(239,68,68,0.7)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>Motivo da rejeição</p>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{selecionado.motivo_rejeicao}</p>
              </div>
            )}

            {/* Link do contrato */}
            {selecionado.status === "aprovado" && selecionado.contrato_token && (
              <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "12px 14px" }}>
                <p style={{ color: "#818cf8", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>Link do contrato</p>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginBottom: 10, wordBreak: "break-all" }}>
                  /contrato/motoboy/{selecionado.contrato_token.slice(0, 16)}...
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => copiarLink(selecionado)} style={{
                    flex: 1, padding: "8px", borderRadius: 8,
                    border: "1px solid rgba(99,102,241,0.3)", background: "none",
                    color: "#818cf8", fontWeight: 700, fontSize: 11, cursor: "pointer",
                  }}>
                    {copiado ? "Copiado!" : "Copiar link"}
                  </button>
                  <a
                    href={whatsAprovacao(selecionado)}
                    target="_blank" rel="noreferrer"
                    style={{
                      flex: 1, padding: "8px", borderRadius: 8,
                      border: "1px solid rgba(37,211,102,0.3)", background: "none",
                      color: "#25D366", fontWeight: 700, fontSize: 11,
                      textDecoration: "none", textAlign: "center" as const,
                    }}>
                    WhatsApp
                  </a>
                </div>
              </div>
            )}

            {/* Ações */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selecionado.status === "pendente" && (
                <>
                  <button
                    onClick={() => aprovar(selecionado)}
                    disabled={salvando}
                    style={{
                      width: "100%", padding: "13px", borderRadius: 12, border: "none",
                      background: "#f97316", color: "white", fontWeight: 900, fontSize: 14,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {salvando ? "Aprovando..." : "Aprovar e gerar contrato"}
                  </button>
                  <button
                    onClick={() => setModalRejeicao(true)}
                    disabled={salvando}
                    style={{
                      width: "100%", padding: "12px", borderRadius: 12,
                      border: "1px solid rgba(239,68,68,0.3)", background: "transparent",
                      color: "#ef4444", fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}>
                    Rejeitar com motivo
                  </button>
                </>
              )}

              {selecionado.status === "aprovado" && (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center" }}>
                  Aguardando assinatura do contrato pelo motoboy
                </p>
              )}

              {selecionado.status === "contrato_assinado" && (
                <button
                  onClick={() => atualizarStatus(selecionado.id, "ativo")}
                  disabled={salvando}
                  style={{
                    width: "100%", padding: "13px", borderRadius: 12, border: "none",
                    background: "#22c55e", color: "white", fontWeight: 900, fontSize: 14,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {salvando ? "Ativando..." : "Ativar motoboy"}
                </button>
              )}

              {selecionado.status === "ativo" && (
                <button
                  onClick={() => setModalRejeicao(true)}
                  disabled={salvando}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 12,
                    border: "1px solid rgba(239,68,68,0.3)", background: "transparent",
                    color: "#ef4444", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}>
                  Suspender com motivo
                </button>
              )}

              {selecionado.status === "suspenso" && (
                <>
                  <button
                    onClick={() => atualizarStatus(selecionado.id, "ativo", { motivo_rejeicao: null })}
                    disabled={salvando}
                    style={{
                      width: "100%", padding: "13px", borderRadius: 12, border: "none",
                      background: "#f97316", color: "white", fontWeight: 900, fontSize: 14,
                      cursor: "pointer",
                    }}>
                    {salvando ? "Reativando..." : "Reativar"}
                  </button>
                  <button
                    onClick={() => aprovar(selecionado)}
                    disabled={salvando}
                    style={{
                      width: "100%", padding: "12px", borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
                      color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>
                    Reapresentar contrato
                  </button>
                </>
              )}

              {/* Contato rápido */}
              {selecionado.telefone && (
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <a href={`tel:${selecionado.telefone}`} style={{
                    flex: 1, padding: "9px", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.08)", background: "transparent",
                    color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700,
                    textDecoration: "none", textAlign: "center" as const,
                  }}>
                    Ligar
                  </a>
                  <a
                    href={`https://wa.me/55${selecionado.telefone.replace(/\D/g, "")}`}
                    target="_blank" rel="noreferrer"
                    style={{
                      flex: 1, padding: "9px", borderRadius: 10,
                      border: "1px solid rgba(37,211,102,0.2)", background: "transparent",
                      color: "#25D366", fontSize: 11, fontWeight: 700,
                      textDecoration: "none", textAlign: "center" as const,
                    }}>
                    WhatsApp
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
