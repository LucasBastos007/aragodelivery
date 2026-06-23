"use client"

import { useRef, useState } from "react"

interface Props {
  label: string
  value: File | null
  onChange: (file: File | null) => void
  required?: boolean
  id?: string
  light?: boolean
}

export function FileUpload({ label, value, onChange, required, id, light }: Props) {
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
      reader.onload = () => { setPreview(reader.result as string); setLoading(false) }
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

  if (light) {
    const accent = "#DC2626"
    return (
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 10 }}>
          {label}{required && " *"}
        </p>
        <div
          role="button"
          tabIndex={0}
          aria-label={`Upload: ${label}`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={e => e.key === "Enter" && inputRef.current?.click()}
          style={{
            cursor: "pointer",
            borderRadius: 16,
            border: `2px dashed ${hasFile ? accent : "#CBD5E1"}`,
            background: hasFile ? "#FFF1F2" : "#F8FAFC",
            minHeight: preview ? "auto" : 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            transition: "all 0.18s",
          }}
        >
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            style={{ display: "none" }}
            onChange={handleChange}
            aria-label={label}
          />

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "24px 16px" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", border: `2.5px solid ${accent}`, borderTopColor: "transparent", animation: "chego-spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 13, color: "#94A3B8" }}>Carregando...</span>
            </div>
          ) : preview ? (
            <div style={{ position: "relative", width: "100%" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 14 }} />
              <button
                type="button"
                onClick={remove}
                aria-label="Remover arquivo"
                style={{
                  position: "absolute", top: 8, right: 8,
                  width: 28, height: 28, borderRadius: "50%",
                  background: "#ef4444", border: "none",
                  color: "white", fontSize: 16, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(239,68,68,0.4)",
                }}
              >×</button>
            </div>
          ) : hasFile ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px 16px" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", textAlign: "center", wordBreak: "break-all", padding: "0 8px" }}>{value!.name}</span>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>{(value!.size / 1024 / 1024).toFixed(2)} MB</span>
              <button
                type="button"
                onClick={remove}
                style={{
                  marginTop: 4, padding: "6px 14px", borderRadius: 8,
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "#ef4444", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >Remover</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 16px", textAlign: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "white", border: "1.5px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>Toque para anexar</span>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>JPG, PNG ou PDF · máx. 5 MB</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Dark theme (original, for other uses) ──────────────────────────────────
  return (
    <div>
      <label htmlFor={inputId} className="label">
        {label}{required && " *"}
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
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
        }}
      >
        <input ref={inputRef} id={inputId} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleChange} aria-label={label} />
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-5">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#f97316", borderTopColor: "transparent" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Carregando...</span>
          </div>
        ) : preview ? (
          <div className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Preview" className="w-full rounded-xl object-cover" style={{ maxHeight: 180 }} />
            <button type="button" onClick={remove} className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "#ef4444", color: "#fff" }} aria-label="Remover arquivo">×</button>
          </div>
        ) : hasFile ? (
          <div className="flex flex-col items-center gap-2 py-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span className="text-xs font-semibold text-white">{value!.name}</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{(value!.size / 1024 / 1024).toFixed(2)} MB</span>
            <button type="button" onClick={remove} className="text-xs mt-1 px-3 py-1 rounded-lg" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>Remover</button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 px-4 text-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span className="text-xs font-semibold text-white">Clique para anexar</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>JPG, PNG ou PDF · máx. 5 MB</span>
          </div>
        )}
      </div>
    </div>
  )
}
