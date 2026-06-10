"use client"

import { maskConta } from "@/utils/masks"
import { FormInput } from "./FormInput"

const BANKS = [
  "Nubank",
  "Itaú",
  "Bradesco",
  "Santander",
  "Caixa Econômica Federal",
  "Banco do Brasil",
  "Inter",
  "C6 Bank",
  "PicPay",
  "Mercado Pago",
  "PagBank",
  "Sicoob",
  "Sicredi",
  "BTG Pactual",
  "Outros",
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
}

export function BankFields({ data, onChange, autoFillDoc, errors = {} }: Props) {
  function set<K extends keyof BankData>(field: K, value: BankData[K]) {
    onChange({ ...data, [field]: value })
  }

  function toggleMesmoCpf(checked: boolean) {
    onChange({ ...data, mesmoCpf: checked, cpfTitular: checked ? (autoFillDoc ?? "") : "" })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="banco-sel" className="label">
          Banco *
        </label>
        <select
          id="banco-sel"
          className="input"
          value={data.banco}
          onChange={e => set("banco", e.target.value)}
          style={{ borderColor: errors.banco ? "#ef4444" : undefined }}
        >
          <option value="">Selecione o banco</option>
          {BANKS.map(b => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        {errors.banco && (
          <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
            ❌ {errors.banco}
          </p>
        )}
      </div>

      <div>
        <label className="label">Tipo de conta *</label>
        <div className="flex gap-2">
          {["Corrente", "Poupança", "Pagamento"].map(tipo => (
            <button
              key={tipo}
              type="button"
              onClick={() => set("tipoConta", tipo)}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200"
              style={{
                background: data.tipoConta === tipo ? "rgba(249,115,22,0.12)" : "#1a1a1a",
                border: `1px solid ${data.tipoConta === tipo ? "#f97316" : "#2a2a2a"}`,
                color: data.tipoConta === tipo ? "#f97316" : "rgba(255,255,255,0.45)",
              }}
            >
              {tipo}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormInput
          label="Agência"
          placeholder="0000"
          value={data.agencia}
          onChange={e => set("agencia", e.target.value.replace(/\D/g, "").slice(0, 6))}
          error={errors.agencia}
          required
        />
        <div>
          <label htmlFor="conta-input" className="label">
            Conta + dígito *
          </label>
          <input
            id="conta-input"
            className="input"
            placeholder="00000-0"
            value={data.conta}
            onChange={e => set("conta", maskConta(e.target.value))}
            style={{ borderColor: errors.conta ? "#ef4444" : undefined }}
          />
          {errors.conta && (
            <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
              ❌ {errors.conta}
            </p>
          )}
        </div>
      </div>

      <label
        className="flex items-center gap-3 cursor-pointer py-1"
        onClick={() => toggleMesmoCpf(!data.mesmoCpf)}
      >
        <div
          className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-200"
          style={{
            background: data.mesmoCpf ? "#f97316" : "transparent",
            borderColor: data.mesmoCpf ? "#f97316" : "#2a2a2a",
          }}
          role="checkbox"
          aria-checked={data.mesmoCpf}
          tabIndex={0}
          onKeyDown={e => e.key === " " && toggleMesmoCpf(!data.mesmoCpf)}
        >
          {data.mesmoCpf && (
            <span className="text-white text-xs font-bold leading-none">✓</span>
          )}
        </div>
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
          Sou o titular desta conta
        </span>
      </label>

      <FormInput
        label="CPF ou CNPJ do titular"
        placeholder="000.000.000-00"
        value={data.cpfTitular}
        onChange={e => set("cpfTitular", e.target.value)}
        disabled={data.mesmoCpf}
        error={errors.cpfTitular}
        required
        style={{ opacity: data.mesmoCpf ? 0.5 : 1 }}
      />
    </div>
  )
}
