"use client"

import { InputHTMLAttributes } from "react"

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  valid?: boolean
  hint?: string
}

export function FormInput({ label, error, valid, hint, id, required, ...props }: Props) {
  const inputId =
    id || `fi-${label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`

  return (
    <div>
      <label htmlFor={inputId} className="label">
        {label}
        {required && " *"}
      </label>
      <div className="relative">
        <input
          id={inputId}
          className="input"
          style={{
            borderColor: error ? "#ef4444" : valid ? "#22c55e" : undefined,
            paddingRight: error || valid ? 38 : undefined,
            ...props.style,
          }}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined
          }
          {...props}
        />
        {valid && !error && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm select-none"
            aria-hidden
          >
            ✅
          </span>
        )}
        {error && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm select-none"
            aria-hidden
          >
            ❌
          </span>
        )}
      </div>
      {error && (
        <p id={`${inputId}-err`} role="alert" className="text-xs mt-1" style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
          {hint}
        </p>
      )}
    </div>
  )
}
