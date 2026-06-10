"use client"

import { useRef, useState } from "react"

interface Props {
  label: string
  value: File | null
  onChange: (file: File | null) => void
  required?: boolean
  id?: string
}

export function FileUpload({ label, value, onChange, required, id }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputId = id || `upload-${label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert("Arquivo muito grande. Máximo permitido: 5 MB.")
      e.target.value = ""
      return
    }

    setLoading(true)
    onChange(file)

    if (file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = () => {
        setPreview(reader.result as string)
        setLoading(false)
      }
      reader.readAsDataURL(file)
    } else {
      setTimeout(() => setLoading(false), 600)
      setPreview(null)
    }
  }

  function remove(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  const hasFile = !!value

  return (
    <div>
      <label htmlFor={inputId} className="label">
        {label}
        {required && " *"}
      </label>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload: ${label}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => e.key === "Enter" && inputRef.current?.click()}
        className="relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200"
        style={{
          background: hasFile ? "transparent" : "#1a1a1a",
          borderColor: hasFile ? "#f97316" : "#2a2a2a",
          minHeight: preview ? "auto" : 96,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
          onChange={handleChange}
          aria-label={label}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-5">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "#f97316", borderTopColor: "transparent" }}
            />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              Carregando...
            </span>
          </div>
        ) : preview ? (
          <div className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className="w-full rounded-xl object-cover"
              style={{ maxHeight: 180 }}
            />
            <button
              type="button"
              onClick={remove}
              className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: "#ef4444", color: "#fff" }}
              aria-label="Remover arquivo"
            >
              ×
            </button>
          </div>
        ) : hasFile ? (
          <div className="flex flex-col items-center gap-2 py-5">
            <span className="text-3xl">📄</span>
            <span className="text-xs font-semibold text-white">{value!.name}</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              {(value!.size / 1024 / 1024).toFixed(2)} MB
            </span>
            <button
              type="button"
              onClick={remove}
              className="text-xs mt-1 px-3 py-1 rounded-lg"
              style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
            >
              Remover
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 px-4 text-center">
            <span className="text-2xl">📎</span>
            <span className="text-xs font-semibold text-white">Clique para anexar</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              JPG, PNG ou PDF · máx. 5 MB
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
