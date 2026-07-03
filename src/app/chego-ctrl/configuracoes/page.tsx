"use client"

import { useEffect, useState } from "react"

export default function ConfiguracoesPage() {
  const [cfg, setCfg] = useState({ max_pedidos_motoboy: "2", raio_compatibilidade_km: "5" })
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/configuracoes")
      .then(r => r.json())
      .then(j => {
        if (j.configuracoes) setCfg(prev => ({ ...prev, ...j.configuracoes }))
        setLoading(false)
      })
  }, [])

  async function salvar() {
    setSalvando(true)
    const res = await fetch("/api/admin/configuracoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    })
    setSalvando(false)
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) {
      setToast("Erro ao salvar: " + (json.error ?? ""))
    } else {
      setToast("Configurações salvas!")
    }
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 600 }}>
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: toast.startsWith("Erro") ? "#fef2f2" : "#f0fdf4",
          border: `1px solid ${toast.startsWith("Erro") ? "#fecaca" : "#bbf7d0"}`,
          color: toast.startsWith("Erro") ? "#dc2626" : "#15803d",
          padding: "12px 20px", borderRadius: 12, fontWeight: 700, fontSize: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        }}>
          {toast}
        </div>
      )}

      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 8 }}>Configurações</h1>
      <p style={{ color: "#64748B", fontSize: 13, marginBottom: 32 }}>Ajustes gerais do sistema de entregas</p>

      {loading ? (
        <p style={{ color: "#94a3b8" }}>Carregando...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "white", borderRadius: 16, padding: "24px", border: "1.5px solid #E2E8F0" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", marginBottom: 20 }}>
              Entregas simultâneas
            </h2>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", display: "block", marginBottom: 8 }}>
                Máximo de pedidos simultâneos por motoboy
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                {["1", "2", "3"].map(v => (
                  <button key={v} onClick={() => setCfg(c => ({ ...c, max_pedidos_motoboy: v }))} style={{
                    width: 56, height: 56, borderRadius: 14, border: "2px solid",
                    borderColor: cfg.max_pedidos_motoboy === v ? "#f97316" : "#E2E8F0",
                    background: cfg.max_pedidos_motoboy === v ? "#fff7ed" : "white",
                    color: cfg.max_pedidos_motoboy === v ? "#f97316" : "#64748B",
                    fontSize: 20, fontWeight: 900, cursor: "pointer",
                    transition: "all 0.15s",
                  }}>{v}</button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
                Máximo recomendado: 2. Com 3, o motoboy pode se sobrecarregar.
              </p>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", display: "block", marginBottom: 8 }}>
                Raio de compatibilidade entre pedidos (km)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="range"
                  min={1} max={20} step={1}
                  value={cfg.raio_compatibilidade_km}
                  onChange={e => setCfg(c => ({ ...c, raio_compatibilidade_km: e.target.value }))}
                  style={{ flex: 1, accentColor: "#f97316" }}
                />
                <span style={{ fontWeight: 900, fontSize: 18, color: "#f97316", minWidth: 40 }}>
                  {cfg.raio_compatibilidade_km} km
                </span>
              </div>
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                Pedidos fora deste raio não são destacados como compatíveis para o motoboy.
              </p>
            </div>
          </div>

          <button
            onClick={salvar}
            disabled={salvando}
            style={{
              padding: "14px", borderRadius: 14, border: "none",
              background: salvando ? "#e2e8f0" : "#f97316", color: "white",
              fontSize: 15, fontWeight: 900, cursor: salvando ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {salvando ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      )}
    </div>
  )
}
