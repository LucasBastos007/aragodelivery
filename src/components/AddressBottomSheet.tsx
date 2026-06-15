"use client"

import { useEffect, useRef, useState } from "react"

export interface Endereco {
  id: string
  rotulo?: string   // "Casa", "Trabalho" etc.
  rua: string
  numero: string
  complemento?: string
  bairro?: string
  cidade?: string
  texto: string     // linha resumida p/ exibir no header
}

function gerarId() {
  return Math.random().toString(36).slice(2, 10)
}

function formatarTexto(e: Partial<Endereco>): string {
  return [
    [e.rua, e.numero].filter(Boolean).join(", "),
    e.complemento,
    e.bairro,
  ].filter(Boolean).join(" — ")
}

interface Props {
  currentAddress: string
  onSelect: (texto: string) => void
  onClose: () => void
}

export default function AddressBottomSheet({ currentAddress, onSelect, onClose }: Props) {
  const [enderecos, setEnderecos]     = useState<Endereco[]>([])
  const [busca, setBusca]             = useState("")
  const [menu, setMenu]               = useState<string | null>(null)  // id com ⋮ aberto
  const [actionAddr, setActionAddr]   = useState<Endereco | null>(null) // action sheet
  const [gpsLoading, setGpsLoading]   = useState(false)
  const [form, setForm]               = useState<Partial<Endereco> | null>(null) // null = fechado
  const [formErro, setFormErro]       = useState("")
  const buscarRef = useRef<HTMLInputElement>(null)

  // Carrega endereços salvos
  useEffect(() => {
    try {
      const raw = localStorage.getItem("arago_enderecos")
      if (raw) setEnderecos(JSON.parse(raw))
    } catch {}
    setTimeout(() => buscarRef.current?.focus(), 200)
  }, [])

  function salvar(list: Endereco[]) {
    setEnderecos(list)
    localStorage.setItem("arago_enderecos", JSON.stringify(list))
  }

  function selecionarEndereco(addr: Endereco) {
    localStorage.setItem("arago_last_address", addr.texto)
    onSelect(addr.texto)
    onClose()
  }

  function excluir(id: string) {
    salvar(enderecos.filter(e => e.id !== id))
    setActionAddr(null)
  }

  async function usarGPS() {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&accept-language=pt-BR`,
            { headers: { "User-Agent": "AragoDelivery/1.0" } }
          )
          const d = await res.json()
          const a = d.address ?? {}
          const rua    = a.road || a.pedestrian || a.path || "Minha localização"
          const bairro = a.suburb || a.neighbourhood || a.city_district || ""
          const cidade = a.city || a.town || a.village || "Aragoiânia"
          const texto  = [rua, bairro, cidade].filter(Boolean).join(", ")
          localStorage.setItem("arago_last_address", texto)
          onSelect(texto)
        } catch {
          onSelect("Minha localização")
        }
        setGpsLoading(false)
        onClose()
      },
      () => setGpsLoading(false),
      { timeout: 8000 }
    )
  }

  function abrirAdicionar() {
    setActionAddr(null)
    setForm({ id: gerarId(), cidade: "Aragoiânia" })
    setFormErro("")
  }

  function abrirEditar(addr: Endereco) {
    setActionAddr(null)
    setForm({ ...addr })
    setFormErro("")
  }

  function salvarForm() {
    if (!form) return
    if (!form.rua?.trim()) { setFormErro("Informe a rua"); return }
    if (!form.numero?.trim()) { setFormErro("Informe o número"); return }
    const texto = formatarTexto(form)
    const novoEndereco: Endereco = {
      id:          form.id ?? gerarId(),
      rotulo:      form.rotulo?.trim() || undefined,
      rua:         form.rua.trim(),
      numero:      form.numero.trim(),
      complemento: form.complemento?.trim() || undefined,
      bairro:      form.bairro?.trim() || undefined,
      cidade:      form.cidade?.trim() || "Aragoiânia",
      texto,
    }
    const idx = enderecos.findIndex(e => e.id === novoEndereco.id)
    const lista = idx >= 0
      ? enderecos.map((e, i) => i === idx ? novoEndereco : e)
      : [...enderecos, novoEndereco]
    salvar(lista)
    setForm(null)
  }

  const filtrados = enderecos.filter(e =>
    !busca || e.texto.toLowerCase().includes(busca.toLowerCase()) ||
    (e.rotulo?.toLowerCase().includes(busca.toLowerCase()))
  )

  // ── Form ──────────────────────────────────────────────────────
  if (form !== null) {
    const isEdit = enderecos.some(e => e.id === form.id)
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.5)" }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "white", borderRadius: "20px 20px 0 0", maxHeight: "90vh", overflowY: "auto" }}>
          <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #f0f0f0" }}>
            <button onClick={() => setForm(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <p style={{ fontWeight: 800, fontSize: 15, color: "#111827", flex: 1 }}>
              {isEdit ? "Editar endereço" : "Novo endereço"}
            </p>
          </div>

          <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { key: "rotulo",      label: "Apelido (opcional)",    placeholder: "Casa, Trabalho, Namoro…" },
              { key: "rua",         label: "Rua *",                  placeholder: "Rua das Flores" },
              { key: "numero",      label: "Número *",               placeholder: "42" },
              { key: "complemento", label: "Complemento",            placeholder: "Apto 3, casa dos fundos" },
              { key: "bairro",      label: "Bairro",                 placeholder: "Centro" },
              { key: "cidade",      label: "Cidade",                 placeholder: "Aragoiânia" },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>{f.label}</label>
                <input
                  value={(form as any)[f.key] ?? ""}
                  onChange={e => setForm(prev => ({ ...prev!, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{
                    width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
                    background: "#F9FAFB", border: "1px solid #E5E7EB",
                    color: "#111827", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            ))}

            {formErro && (
              <p style={{ color: "#DC2626", fontSize: 13, fontWeight: 600, background: "rgba(220,38,38,0.06)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(220,38,38,0.15)" }}>
                {formErro}
              </p>
            )}

            <button onClick={salvarForm} style={{
              width: "100%", padding: "14px", borderRadius: 12, border: "none",
              background: "#DC2626", color: "white", fontWeight: 800, fontSize: 15,
              cursor: "pointer", marginTop: 4,
            }}>
              Salvar endereço
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Lista principal ───────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>

      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "20px 20px 0 0",
        maxHeight: "92vh", display: "flex", flexDirection: "column",
        animation: "slideUp 0.25s ease",
      }}>
        {/* Handle + Header */}
        <div style={{ padding: "12px 20px 10px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#E5E7EB", margin: "0 auto 14px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <p style={{ fontWeight: 800, fontSize: 14, color: "#111827", letterSpacing: 0.5, textTransform: "uppercase", flex: 1, textAlign: "center" }}>
              Endereço de entrega
            </p>
            <div style={{ width: 30 }} />
          </div>
        </div>

        {/* Busca */}
        <div style={{ padding: "6px 16px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F3F4F6", borderRadius: 12, padding: "10px 14px" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={buscarRef}
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar endereço e número"
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 14, color: "#374151" }}
            />
            {busca && (
              <button onClick={() => setBusca("")} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", padding: 0, fontSize: 16 }}>✕</button>
            )}
          </div>
        </div>

        {/* Scroll content */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {/* GPS */}
          <button onClick={usarGPS} disabled={gpsLoading} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 14,
            padding: "14px 20px", background: "none", border: "none", cursor: "pointer",
            borderBottom: "1px solid #f3f4f6",
          }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(220,38,38,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {gpsLoading
                ? <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid #DC2626", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>}
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>Usar minha localização</p>
              <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 1 }}>Detectar endereço automaticamente</p>
            </div>
          </button>

          {/* Lista de endereços */}
          {filtrados.map(addr => {
            const ativo = addr.texto === currentAddress
            return (
              <div key={addr.id} style={{
                display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 20px",
                borderBottom: "1px solid #f3f4f6", position: "relative",
                background: ativo ? "rgba(220,38,38,0.03)" : "white",
                border: ativo ? "1px solid rgba(220,38,38,0.15)" : undefined,
                borderRadius: ativo ? 12 : undefined,
                margin: ativo ? "4px 12px" : "0",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: ativo ? "rgba(220,38,38,0.1)" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ativo ? "#DC2626" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>

                <button onClick={() => selecionarEndereco(addr)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                  {addr.rotulo && <p style={{ color: "#111827", fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{addr.rotulo}</p>}
                  <p style={{ color: "#374151", fontWeight: addr.rotulo ? 500 : 700, fontSize: 14, lineHeight: 1.3 }}>
                    {[addr.rua, addr.numero].filter(Boolean).join(", ")}
                  </p>
                  {addr.bairro && <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>{addr.bairro}</p>}
                  {addr.cidade && <p style={{ color: "#9CA3AF", fontSize: 12 }}>{addr.cidade}</p>}
                  {addr.complemento && <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>{addr.complemento}</p>}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {ativo && (
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setActionAddr(actionAddr?.id === addr.id ? null : addr) }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#9CA3AF" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}

          {enderecos.length === 0 && (
            <div style={{ padding: "32px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 36, marginBottom: 8 }}>📍</p>
              <p style={{ color: "#374151", fontWeight: 700, fontSize: 14 }}>Nenhum endereço salvo</p>
              <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>Adicione um endereço para facilitar seus pedidos</p>
            </div>
          )}

          {/* Adicionar */}
          <button onClick={abrirAdicionar} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "16px 20px", background: "none", border: "none", cursor: "pointer",
            borderTop: "1px solid #f3f4f6",
          }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(220,38,38,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <p style={{ color: "#DC2626", fontWeight: 700, fontSize: 14 }}>Adicionar novo endereço</p>
          </button>

          <div style={{ height: 32 }} />
        </div>
      </div>

      {/* Action sheet para Excluir / Editar */}
      {actionAddr && (
        <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
          onClick={() => setActionAddr(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: "20px 20px 0 0", padding: "20px 20px 36px" }}>
            <p style={{ fontWeight: 800, fontSize: 15, color: "#111827", textAlign: "center", marginBottom: 20 }}>
              {actionAddr.rotulo || [actionAddr.rua, actionAddr.numero].filter(Boolean).join(", ")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <button onClick={() => excluir(actionAddr.id)} style={{
                padding: "14px", borderRadius: 14, border: "1px solid #e5e7eb",
                background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                color: "#374151", fontWeight: 700, fontSize: 14,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
                Excluir
              </button>
              <button onClick={() => abrirEditar(actionAddr)} style={{
                padding: "14px", borderRadius: 14, border: "1px solid rgba(220,38,38,0.3)",
                background: "rgba(220,38,38,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                color: "#DC2626", fontWeight: 700, fontSize: 14,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Editar
              </button>
            </div>
            <button onClick={() => setActionAddr(null)} style={{
              width: "100%", padding: "14px", border: "none", background: "none",
              color: "#DC2626", fontWeight: 700, fontSize: 15, cursor: "pointer",
            }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
