"use client"

import { maskConta } from "@/utils/masks"
import { FormInput } from "./FormInput"

const BANKS = [
  "Nubank", "Itaú", "Bradesco", "Santander", "Caixa Econômica Federal",
  "Banco do Brasil", "Inter", "C6 Bank", "PicPay", "Mercado Pago",
  "PagBank", "Sicoob", "Sicredi", "BTG Pactual", "Outros",
]

export interface BankData {
  banco: string
  tipoConta: string
  agencia: string
  conta: string
  cpfTitular: string
  mesmoCpf: boolean
}

interface Props {
  data: BankData
  onChange: (data: BankData) => void
  autoFillDoc?: string
  errors?: Partial<Record<keyof BankData, string>>
  light?: boolean
}

export function BankFields({ data, onChange, autoFillDoc, errors = {}, light }: Props) {
  function set<K extends keyof BankData>(field: K, value: BankData[K]) {
    onChange({ ...data, [field]: value })
  }

  function toggleMesmoCpf(checked: boolean) {
    onChange({ ...data, mesmoCpf: checked, cpfTitular: checked ? (autoFillDoc ?? "") : "" })
  }

  if (light) {
    const inp: React.CSSProperties = {
      width: "100%", padding: "16px 18px", fontSize: 16, borderRadius: 14,
      background: "white", border: "1.5px solid #E2E8F0",
      color: "#0F172A", outline: "none", boxSizing: "border-box",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      transition: "border-color 0.15s",
      WebkitAppearance: "none",
    }
    const labelStyle: React.CSSProperties = {
      fontSize: 12, fontWeight: 700, color: "#475569",
      textTransform: "uppercase", letterSpacing: "0.7px",
      display: "block", marginBottom: 8,
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Banco */}
        <div>
          <label htmlFor="banco-sel-l" style={labelStyle}>Banco *</label>
          <div style={{ position: "relative" }}>
            <select
              id="banco-sel-l"
              style={{ ...inp, cursor: "pointer", paddingRight: 40 }}
              value={data.banco}
              onChange={e => set("banco", e.target.value)}
            >
              <option value="">Selecione o banco</option>
              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#94A3B8", fontSize: 13 }}>▼</span>
          </div>
          {errors.banco && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 6 }}>{errors.banco}</p>}
        </div>

        {/* Tipo de conta */}
        <div>
          <p style={labelStyle}>Tipo de conta *</p>
          <div style={{ display: "flex", gap: 8 }}>
            {["Corrente", "Poupança", "Pagamento"].map(tipo => {
              const sel = data.tipoConta === tipo
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => set("tipoConta", tipo)}
                  style={{
                    flex: 1, padding: "12px 8px", borderRadius: 12,
                    fontSize: 13, fontWeight: 700,
                    border: `1.5px solid ${sel ? "#DC2626" : "#E2E8F0"}`,
                    background: sel ? "#FFF1F2" : "white",
                    color: sel ? "#DC2626" : "#475569",
                    cursor: "pointer", transition: "all 0.15s",
                    boxShadow: sel ? "0 2px 8px rgba(220,38,38,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  {tipo}
                </button>
              )
            })}
          </div>
        </div>

        {/* Agência e conta */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label htmlFor="agencia-l" style={labelStyle}>Agência *</label>
            <input
              id="agencia-l"
              style={inp}
              placeholder="0000"
              value={data.agencia}
              onChange={e => set("agencia", e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <div>
            <label htmlFor="conta-l" style={labelStyle}>Conta + dígito *</label>
            <input
              id="conta-l"
              style={inp}
              placeholder="00000-0"
              value={data.conta}
              onChange={e => set("conta", maskConta(e.target.value))}
            />
          </div>
        </div>

        {/* Checkbox titular */}
        <button
          type="button"
          onClick={() => toggleMesmoCpf(!data.mesmoCpf)}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left",
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0,
            border: `2px solid ${data.mesmoCpf ? "#DC2626" : "#CBD5E1"}`,
            background: data.mesmoCpf ? "#DC2626" : "white",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}>
            {data.mesmoCpf && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2,6 5,9 10,3"/>
              </svg>
            )}
          </div>
          <span style={{ fontSize: 15, color: "#374151", fontWeight: 500 }}>Sou o titular desta conta</span>
        </button>

        {/* CPF titular */}
        <div>
          <label htmlFor="cpf-titular-l" style={{ ...labelStyle, opacity: data.mesmoCpf ? 0.5 : 1 }}>CPF ou CNPJ do titular *</label>
          <input
            id="cpf-titular-l"
            style={{ ...inp, opacity: data.mesmoCpf ? 0.5 : 1 }}
            placeholder="000.000.000-00"
            value={data.cpfTitular}
            disabled={data.mesmoCpf}
            onChange={e => set("cpfTitular", e.target.value)}
          />
          {errors.cpfTitular && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 6 }}>{errors.cpfTitular}</p>}
        </div>
      </div>
    )
  }

  // ── Dark theme (original) ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="banco-sel" className="label">Banco *</label>
        <select id="banco-sel" className="input" value={data.banco} onChange={e => set("banco", e.target.value)} style={{ borderColor: errors.banco ? "#ef4444" : undefined }}>
          <option value="">Selecione o banco</option>
          {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {errors.banco && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.banco}</p>}
      </div>

      <div>
        <label className="label">Tipo de conta *</label>
        <div className="flex gap-2">
          {["Corrente", "Poupança", "Pagamento"].map(tipo => (
            <button key={tipo} type="button" onClick={() => set("tipoConta", tipo)}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200"
              style={{
                background: data.tipoConta === tipo ? "rgba(249,115,22,0.12)" : "#1a1a1a",
                border: `1px solid ${data.tipoConta === tipo ? "#f97316" : "#2a2a2a"}`,
                color: data.tipoConta === tipo ? "#f97316" : "rgba(255,255,255,0.45)",
              }}
            >{tipo}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormInput label="Agência" placeholder="0000" value={data.agencia} onChange={e => set("agencia", e.target.value.replace(/\D/g, "").slice(0, 6))} error={errors.agencia} required />
        <div>
          <label htmlFor="conta-input" className="label">Conta + dígito *</label>
          <input id="conta-input" className="input" placeholder="00000-0" value={data.conta} onChange={e => set("conta", maskConta(e.target.value))} style={{ borderColor: errors.conta ? "#ef4444" : undefined }} />
          {errors.conta && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.conta}</p>}
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer py-1" onClick={() => toggleMesmoCpf(!data.mesmoCpf)}>
        <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-200"
          style={{ background: data.mesmoCpf ? "#f97316" : "transparent", borderColor: data.mesmoCpf ? "#f97316" : "#2a2a2a" }}
          role="checkbox" aria-checked={data.mesmoCpf} tabIndex={0} onKeyDown={e => e.key === " " && toggleMesmoCpf(!data.mesmoCpf)}>
          {data.mesmoCpf && <span className="text-white text-xs font-bold leading-none">✓</span>}
        </div>
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Sou o titular desta conta</span>
      </label>

      <FormInput label="CPF ou CNPJ do titular" placeholder="000.000.000-00" value={data.cpfTitular} onChange={e => set("cpfTitular", e.target.value)} disabled={data.mesmoCpf} error={errors.cpfTitular} required style={{ opacity: data.mesmoCpf ? 0.5 : 1 }} />
    </div>
  )
}
