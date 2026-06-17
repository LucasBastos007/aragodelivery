"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

export default function MotoboyPerfilPage() {
  const { sessao } = useAuth()
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null

  const [loading,   setLoading]   = useState(true)
  const [salvando,  setSalvando]  = useState(false)
  const [sucesso,   setSucesso]   = useState(false)
  const [foto,      setFoto]      = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    nome:      "",
    email:     "",
    telefone:  "",
    cpf:       "",
    pix_chave: "",
  })

  useEffect(() => {
    if (!motoboy_id) return
    supabase.from("motoboys").select("nome, email, telefone, cpf, pix_chave, foto").eq("id", motoboy_id).single()
      .then(({ data }) => {
        if (data) {
          setForm({
            nome:      data.nome      ?? "",
            email:     data.email     ?? "",
            telefone:  data.telefone  ?? "",
            cpf:       data.cpf       ?? "",
            pix_chave: data.pix_chave ?? "",
          })
          setFoto(data.foto ?? null)
        }
        setLoading(false)
      })
  }, [motoboy_id])

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !motoboy_id) return
    setUploading(true)
    const ext  = file.name.split(".").pop() || "jpg"
    const path = `motoboys/${motoboy_id}.${ext}`
    const { data, error } = await supabase.storage.from("entregas").upload(path, file, { upsert: true, contentType: file.type })
    if (!error && data) {
      const { data: { publicUrl } } = supabase.storage.from("entregas").getPublicUrl(data.path)
      await supabase.from("motoboys").update({ foto: publicUrl }).eq("id", motoboy_id)
      setFoto(publicUrl)
    }
    setUploading(false)
  }

  async function salvar() {
    if (!motoboy_id) return
    setSalvando(true)
    await supabase.from("motoboys").update({
      nome:      form.nome.trim(),
      telefone:  form.telefone.trim(),
      pix_chave: form.pix_chave.trim(),
    }).eq("id", motoboy_id)
    setSalvando(false)
    setSucesso(true)
    setTimeout(() => setSucesso(false), 2500)
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 12, fontSize: 14,
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    color: "white", outline: "none", boxSizing: "border-box",
  }

  if (loading) return (
    <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
      <p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 20px 100px" }}>
      <p style={{ color: "white", fontWeight: 900, fontSize: 20, marginBottom: 4 }}>Meu perfil</p>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginBottom: 28 }}>Seus dados e configurações</p>

      {/* Foto */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            width: 96, height: 96, borderRadius: "50%", cursor: "pointer",
            background: "rgba(249,115,22,0.12)", border: "2px dashed rgba(249,115,22,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", position: "relative",
          }}
        >
          {foto ? (
            <img src={foto} alt="Foto" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(249,115,22,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" capture="user" onChange={handleFoto} style={{ display: "none" }} />
        <button onClick={() => inputRef.current?.click()} style={{
          marginTop: 10, background: "none", border: "none", color: "#f97316",
          fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>
          {uploading ? "Enviando..." : "Trocar foto"}
        </button>
      </div>

      {/* Campos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          { key: "nome",      label: "Nome completo",  placeholder: "Seu nome" },
          { key: "email",     label: "E-mail",         placeholder: "email@exemplo.com", disabled: true },
          { key: "telefone",  label: "Telefone",       placeholder: "(62) 9 0000-0000" },
          { key: "cpf",       label: "CPF",            placeholder: "000.000.000-00",   disabled: true },
          { key: "pix_chave", label: "Chave PIX",      placeholder: "CPF, e-mail ou telefone" },
        ].map(({ key, label, placeholder, disabled }) => (
          <div key={key}>
            <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              {label}
            </label>
            <input
              value={(form as any)[key]}
              onChange={e => !disabled && setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              disabled={disabled}
              style={{ ...inp, opacity: disabled ? 0.45 : 1, cursor: disabled ? "not-allowed" : "text" }}
            />
          </div>
        ))}
      </div>

      <button onClick={salvar} disabled={salvando} style={{
        width: "100%", marginTop: 28, padding: "16px",
        borderRadius: 14, border: "none",
        background: salvando ? "rgba(249,115,22,0.4)" : "#f97316",
        color: "white", fontWeight: 900, fontSize: 15, cursor: salvando ? "not-allowed" : "pointer",
      }}>
        {salvando ? "Salvando..." : "Salvar alterações"}
      </button>

      {sucesso && (
        <div style={{
          position: "fixed", bottom: 90, left: 16, right: 16,
          background: "#22c55e", color: "white", fontWeight: 700, fontSize: 13,
          padding: "12px 20px", borderRadius: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          textAlign: "center",
        }}>
          Perfil atualizado com sucesso
        </div>
      )}
    </div>
  )
}
