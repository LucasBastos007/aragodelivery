"use client"

import { useEffect, useState } from "react"

type RegimeTributario = "mei" | "simples" | "lucro_presumido" | "lucro_real"

interface FiscalData {
  inscricao_estadual:  string
  inscricao_municipal: string
  regime_tributario:   RegimeTributario | ""
  cnae:                string
  nfce_serie:          number
  cnpj:                string
  fiscal_ativo:        boolean
}

const REGIMES: { v: RegimeTributario; l: string }[] = [
  { v: "mei",             l: "MEI – Microempreendedor Individual" },
  { v: "simples",         l: "Simples Nacional" },
  { v: "lucro_presumido", l: "Lucro Presumido" },
  { v: "lucro_real",      l: "Lucro Real" },
]

const VAZIO: FiscalData = {
  inscricao_estadual:  "",
  inscricao_municipal: "",
  regime_tributario:   "",
  cnae:                "",
  nfce_serie:          1,
  cnpj:                "",
  fiscal_ativo:        false,
}

export default function FiscalPage() {
  const [dados,       setDados]       = useState<FiscalData>(VAZIO)
  const [salvando,    setSalvando]    = useState(false)
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [ok,          setOk]          = useState(false)
  const [erro,        setErro]        = useState("")

  useEffect(() => {
    fetch("/api/loja/fiscal").then(r => r.json()).then(d => {
      if (d.error) return
      setDados({
        inscricao_estadual:  d.inscricao_estadual  ?? "",
        inscricao_municipal: d.inscricao_municipal ?? "",
        regime_tributario:   d.regime_tributario   ?? "",
        cnae:                d.cnae                ?? "",
        nfce_serie:          d.nfce_serie          ?? 1,
        cnpj:                d.cnpj                ?? "",
        fiscal_ativo:        d.fiscal_ativo        ?? false,
      })
    })
  }, [])

  async function buscarCnpj() {
    const cnpj = dados.cnpj.replace(/\D/g, "")
    if (cnpj.length !== 14) { setErro("CNPJ deve ter 14 dígitos"); return }
    setBuscandoCnpj(true)
    setErro("")
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
      if (!r.ok) { setErro("CNPJ não encontrado na Receita Federal"); return }
      const d = await r.json()
      setDados(prev => ({
        ...prev,
        cnae: d.cnae_fiscal ? String(d.cnae_fiscal).padStart(7, "0") : prev.cnae,
      }))
      setOk(true)
      setTimeout(() => setOk(false), 3000)
    } catch {
      setErro("Erro ao consultar BrasilAPI")
    } finally {
      setBuscandoCnpj(false)
    }
  }

  function set(k: keyof FiscalData, v: string | number | boolean) {
    setDados(prev => ({ ...prev, [k]: v }))
    setOk(false)
    setErro("")
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro("")
    try {
      const r = await fetch("/api/loja/fiscal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inscricao_estadual:  dados.inscricao_estadual  || null,
          inscricao_municipal: dados.inscricao_municipal || null,
          regime_tributario:   dados.regime_tributario   || null,
          cnae:                dados.cnae                || null,
          nfce_serie:          Number(dados.nfce_serie)  || 1,
        }),
      })
      const j = await r.json()
      if (!r.ok) { setErro(j.error ?? "Erro ao salvar"); return }
      setOk(true)
      setTimeout(() => setOk(false), 3000)
    } finally {
      setSalvando(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1.5px solid #E2E8F0", fontSize: 16, outline: "none",
    background: "#fff", color: "#111827", boxSizing: "border-box",
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block",
  }
  const fieldStyle: React.CSSProperties = { marginBottom: 16 }

  return (
    <div style={{ maxWidth: 540, margin: "0 auto", padding: "24px 16px 40px" }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: "#111827" }}>Dados Fiscais</h1>
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
          Informações necessárias para emissão de notas fiscais.
        </p>
      </div>

      {/* Status fiscal_ativo */}
      <div style={{
        padding: "12px 16px", borderRadius: 12, marginBottom: 24,
        background: dados.fiscal_ativo ? "#ECFDF5" : "#FFF7ED",
        border: `1.5px solid ${dados.fiscal_ativo ? "#A7F3D0" : "#FED7AA"}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>{dados.fiscal_ativo ? "✓" : "⏳"}</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: dados.fiscal_ativo ? "#059669" : "#d97706" }}>
            {dados.fiscal_ativo ? "Emissão fiscal ativa" : "Emissão fiscal pendente"}
          </p>
          <p style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
            {dados.fiscal_ativo
              ? "Esta loja está configurada para emitir NFC-e."
              : "Preencha os dados abaixo. A ativação é feita pelo administrador Chegô."}
          </p>
        </div>
      </div>

      {/* Consulta CNPJ */}
      {dados.cnpj && (
        <div style={{ marginBottom: 20, padding: 14, borderRadius: 12, background: "#F8FAFC", border: "1.5px solid #E2E8F0" }}>
          <p style={labelStyle}>CNPJ da loja</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#374151", fontFamily: "monospace" }}>
              {dados.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}
            </p>
            <button
              type="button"
              onClick={buscarCnpj}
              disabled={buscandoCnpj}
              style={{
                padding: "5px 12px", borderRadius: 8, border: "1.5px solid #CBD5E1",
                background: "#fff", color: "#374151", fontSize: 12, fontWeight: 700,
                cursor: buscandoCnpj ? "not-allowed" : "pointer",
                opacity: buscandoCnpj ? 0.6 : 1,
              }}
            >
              {buscandoCnpj ? "Consultando…" : "Consultar Receita Federal"}
            </button>
          </div>
          <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
            Busca CNAE automaticamente via BrasilAPI
          </p>
        </div>
      )}

      <form onSubmit={salvar}>

        <div style={fieldStyle}>
          <label style={labelStyle}>Inscrição Estadual (IE)</label>
          <input
            style={inputStyle}
            value={dados.inscricao_estadual}
            onChange={e => set("inscricao_estadual", e.target.value)}
            placeholder="Isento ou número da IE"
          />
          <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
            Digite "ISENTO" se não tiver IE. Obrigatório para NFC-e.
          </p>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Inscrição Municipal (IM)</label>
          <input
            style={inputStyle}
            value={dados.inscricao_municipal}
            onChange={e => set("inscricao_municipal", e.target.value)}
            placeholder="Número da IM (opcional)"
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Regime Tributário</label>
          <select
            style={{ ...inputStyle, appearance: "none" }}
            value={dados.regime_tributario}
            onChange={e => set("regime_tributario", e.target.value)}
          >
            <option value="">Selecione…</option>
            {REGIMES.map(r => (
              <option key={r.v} value={r.v}>{r.l}</option>
            ))}
          </select>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>CNAE Principal</label>
          <input
            style={inputStyle}
            value={dados.cnae}
            onChange={e => set("cnae", e.target.value)}
            placeholder="Ex: 5611201"
          />
          <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
            Código da atividade econômica principal (7 dígitos, sem pontuação)
          </p>
        </div>

        <div style={{ ...fieldStyle, maxWidth: 120 }}>
          <label style={labelStyle}>Série da NFC-e</label>
          <input
            style={inputStyle}
            type="number"
            min={1}
            max={999}
            value={dados.nfce_serie}
            onChange={e => set("nfce_serie", Number(e.target.value))}
          />
        </div>

        {erro && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {erro}
          </div>
        )}

        {ok && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#059669", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            Dados salvos com sucesso!
          </div>
        )}

        <button
          type="submit"
          disabled={salvando}
          style={{
            width: "100%", padding: "13px", borderRadius: 12,
            background: salvando ? "#e5e7eb" : "#f97316",
            color: salvando ? "#9CA3AF" : "#fff",
            border: "none", fontWeight: 800, fontSize: 15,
            cursor: salvando ? "not-allowed" : "pointer",
            minHeight: 44,
          }}
        >
          {salvando ? "Salvando…" : "Salvar dados fiscais"}
        </button>

      </form>

      <div style={{ marginTop: 32, padding: 16, borderRadius: 12, background: "#F8FAFC", border: "1.5px solid #E2E8F0" }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: "#374151", marginBottom: 8 }}>
          O que vem a seguir
        </p>
        <ul style={{ paddingLeft: 16, margin: 0 }}>
          {[
            "Upload do certificado digital A1 (FASE 3)",
            "Configuração do CSC para contingência (FASE 3)",
            "Ativação da emissão de NFC-e pelo administrador (FASE 4)",
          ].map((t, i) => (
            <li key={i} style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>{t}</li>
          ))}
        </ul>
      </div>

    </div>
  )
}
