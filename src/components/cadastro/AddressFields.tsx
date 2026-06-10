"use client"

import { useState } from "react"
import { maskCEP } from "@/utils/masks"
import { fetchAddressByCEP } from "@/utils/api"
import { FormInput } from "./FormInput"

export interface AddressData {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}

interface Props {
  data: AddressData
  onChange: (data: AddressData) => void
  errors?: Partial<Record<keyof AddressData, string>>
  extra?: React.ReactNode
}

export function AddressFields({ data, onChange, errors = {}, extra }: Props) {
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState("")

  function set(field: keyof AddressData, value: string) {
    onChange({ ...data, [field]: value })
  }

  async function handleCEP(raw: string) {
    const masked = maskCEP(raw)
    set("cep", masked)
    setCepError("")
    if (masked.replace(/\D/g, "").length === 8) {
      setCepLoading(true)
      const result = await fetchAddressByCEP(masked)
      setCepLoading(false)
      if (result) {
        onChange({
          ...data,
          cep: masked,
          logradouro: result.logradouro,
          bairro: result.bairro,
          cidade: result.localidade,
          estado: result.uf,
        })
      } else {
        setCepError("CEP não encontrado")
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="addr-cep" className="label">
          CEP *
        </label>
        <div className="relative">
          <input
            id="addr-cep"
            className="input"
            placeholder="00000-000"
            value={data.cep}
            onChange={e => handleCEP(e.target.value)}
            maxLength={9}
            style={{ borderColor: cepError ? "#ef4444" : undefined }}
          />
          {cepLoading && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "#f97316", borderTopColor: "transparent" }}
            />
          )}
        </div>
        {cepError && (
          <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
            ❌ {cepError}
          </p>
        )}
      </div>

      <FormInput
        label="Logradouro"
        placeholder="Rua, Avenida..."
        value={data.logradouro}
        onChange={e => set("logradouro", e.target.value)}
        error={errors.logradouro}
        required
      />

      <div className="grid grid-cols-2 gap-3">
        <FormInput
          label="Número"
          placeholder="123"
          value={data.numero}
          onChange={e => set("numero", e.target.value)}
          error={errors.numero}
          required
        />
        <FormInput
          label="Complemento"
          placeholder="Apto, sala..."
          value={data.complemento}
          onChange={e => set("complemento", e.target.value)}
        />
      </div>

      <FormInput
        label="Bairro"
        placeholder="Seu bairro"
        value={data.bairro}
        onChange={e => set("bairro", e.target.value)}
        error={errors.bairro}
        required
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Cidade</label>
          <input
            className="input"
            value={data.cidade}
            readOnly
            style={{ opacity: 0.5, cursor: "not-allowed" }}
          />
        </div>
        <div>
          <label className="label">Estado</label>
          <input
            className="input"
            value={data.estado}
            readOnly
            style={{ opacity: 0.5, cursor: "not-allowed" }}
          />
        </div>
      </div>

      {extra}
    </div>
  )
}
