"use client"

import { useState } from "react"

interface Props {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  id?: string
  required?: boolean
}

function getStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: "", color: "" }
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  if (score <= 1) return { score: 1, label: "Fraca", color: "#ef4444" }
  if (score === 2) return { score: 2, label: "Regular", color: "#f59e0b" }
  if (score === 3) return { score: 3, label: "Boa", color: "#3b82f6" }
  return { score: 4, label: "Forte", color: "#22c55e" }
}

export function PasswordField({ label, value, onChange, error, id, required }: Props) {
  const [show, setShow] = useState(false)
  const str = getStrength(value)
  const inputId = id || "password"

  return (
    <div>
      <label htmlFor={inputId} className="label">
        {label}
        {required && " *"}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={show ? "text" : "password"}
          className="input"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ borderColor: error ? "#ef4444" : undefined, paddingRight: 44 }}
          aria-invalid={!!error}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: "rgba(255,255,255,0.3)", fontSize: 16 }}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          tabIndex={-1}
        >
          {show ? "🙈" : "👁️"}
        </button>
      </div>
      {value && str.label && (
        <div className="mt-2">
          <div className="flex gap-1 mb-1">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="flex-1 h-1 rounded-full"
                style={{
                  background: i <= str.score ? str.color : "rgba(255,255,255,0.1)",
                  transition: "background 0.3s",
                }}
              />
            ))}
          </div>
          <p className="text-xs font-medium" style={{ color: str.color }}>
            Senha {str.label.toLowerCase()}
          </p>
        </div>
      )}
      {error && (
        <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
          ❌ {error}
        </p>
      )}
    </div>
  )
}
