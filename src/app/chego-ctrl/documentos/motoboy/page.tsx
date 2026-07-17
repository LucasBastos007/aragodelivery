"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import type { Motoboy } from "@/types"

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUS_COLOR: Record<string, string> = {
  pendente: "#f59e0b", aprovado: "#60a5fa", contrato_assinado: "#a78bfa",
  ativo: "#22c55e", suspenso: "#ef4444", offline: "#555",
}
const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente", aprovado: "Aprovado", contrato_assinado: "Contrato assinado",
  ativo: "Ativo", suspenso: "Suspenso", offline: "Offline",
}

type DocItem = { label: string; url: string; tipo: "imagem" | "assinatura" | "selfie" }

function DocCard({ doc, onAmplia }: { doc: DocItem; onAmplia: (url: string) => void }) {
  const [err, setErr] = useState(false)
  return (
    <div style={{
      background: "white", borderRadius: 14, overflow: "hidden",
      border: "1.5px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      display: "flex", flexDirection: "column",
    }}>
      <div
        onClick={() => !err && onAmplia(doc.url)}
        style={{ height: 160, cursor: err ? "default" : "zoom-in", overflow: "hidden", background: "#F8FAFC", position: "relative" }}
      >
        {err ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9l4-4 4 4 4-4 4 4"/><circle cx="8.5" cy="13.5" r="1.5"/></svg>
            <p style={{ fontSize: 11, color: "#94a3b8" }}>Sem preview</p>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={doc.url}
              alt={doc.label}
              onError={() => setErr(true)}
              style={{ width: "100%", height: "100%", objectFit: doc.tipo === "assinatura" ? "contain" : "cover" }}
            />
            <div style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 8, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1"/></svg>
            </div>
          </>
        )}
      </div>
      <div style={{ padding: "10px 12px", borderTop: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{doc.label}</p>
        {!err && (
          <a href={doc.url} download target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 700, color: "#f97316", textDecoration: "none" }}>⬇</a>
        )}
      </div>
    </div>
  )
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.93)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Documento" onClick={e => e.stopPropagation()} style={{ maxWidth: "92vw", maxHeight: "88vh", objectFit: "contain", borderRadius: 10 }} />
      <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, width: 38, height: 38, borderRadius: "50%", background: "white", border: "none", fontSize: 18, fontWeight: 900, cursor: "pointer" }}>✕</button>
    </div>
  )
}

export default function DocumentosMotoboyPage() {
  const params = useSearchParams()
  const router = useRouter()
  const id = params.get("id")

  const [motoboy, setMotoboy]     = useState<Motoboy | null>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [loading, setLoading]     = useState(true)
  const [amplia, setAmplia]       = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabaseClient.from("motoboys").select("*").eq("id", id).single().then(async ({ data }) => {
      if (!data) { setLoading(false); return }
      setMotoboy(data as Motoboy)

      // Busca signed URLs para docs no storage
      const m = data as Motoboy
      const rawDocs: { key: string; value: string }[] = [
        { key: "cnhFrente",      value: m.documentos?.cnhFrente      ?? "" },
        { key: "cnhVerso",       value: m.documentos?.cnhVerso       ?? "" },
        { key: "crlv",           value: m.documentos?.crlv           ?? "" },
        { key: "selfie",         value: m.documentos?.selfie         ?? "" },
        { key: "selfieContrato", value: m.selfie_contrato            ?? "" },
      ].filter(e => e.value)

      if (rawDocs.length > 0) {
        const results = await Promise.all(
          rawDocs.map(async ({ key, value }) => {
            const res = await fetch("/api/admin/doc-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ value }),
            })
            if (!res.ok) return { key, url: value }
            const { signedUrl } = await res.json()
            return { key, url: signedUrl as string }
          })
        )
        const map: Record<string, string> = {}
        results.forEach(({ key, url }) => { map[key] = url })
        setSignedUrls(map)
      }

      setLoading(false)
    })
  }, [id])

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#94a3b8" }}>Carregando documentos…</p>
    </div>
  )

  if (!motoboy) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#ef4444" }}>Motoboy não encontrado.</p>
    </div>
  )

  const cor = STATUS_COLOR[motoboy.status] ?? "#64748b"

  const docs: DocItem[] = [
    signedUrls.cnhFrente      ? { label: "Doc. Frente",       url: signedUrls.cnhFrente,      tipo: "imagem"    } : null,
    signedUrls.cnhVerso       ? { label: "Doc. Verso",        url: signedUrls.cnhVerso,       tipo: "imagem"    } : null,
    signedUrls.crlv           ? { label: "CRLV",              url: signedUrls.crlv,           tipo: "imagem"    } : null,
    signedUrls.selfie         ? { label: "Selfie",            url: signedUrls.selfie,         tipo: "selfie"    } : null,
    signedUrls.selfieContrato ? { label: "Selfie c/ doc.",    url: signedUrls.selfieContrato, tipo: "selfie"    } : null,
    motoboy.contrato_assinatura ? { label: "Assinatura",      url: motoboy.contrato_assinatura!, tipo: "assinatura" } : null,
  ].filter(Boolean) as DocItem[]

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 16px" }}>
      {amplia && <Lightbox src={amplia} onClose={() => setAmplia(null)} />}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => router.push("/chego-ctrl/motoboys")}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar para Motoboys
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${cor}20`, border: `2px solid ${cor}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: cor }}>
            {(motoboy.nome.trim().split(" ").filter(Boolean).map((p: string, i: number, a: string[]) => i === 0 || i === a.length - 1 ? p[0] : "").filter(Boolean).join("")).toUpperCase().slice(0, 2)}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.3px" }}>{motoboy.nome}</h1>
              <span style={{ padding: "3px 10px", borderRadius: 50, fontSize: 11, fontWeight: 700, background: `${cor}18`, color: cor, border: `1px solid ${cor}33` }}>
                {STATUS_LABEL[motoboy.status] ?? motoboy.status}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 3 }}>{motoboy.veiculo} · {motoboy.placa} · {motoboy.telefone}</p>
          </div>
        </div>
      </div>

      {/* Contrato — destaque */}
      {motoboy.contrato_assinado && (
        <div style={{ marginBottom: 28, background: "white", borderRadius: 16, border: "1.5px solid #D1FAE5", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", background: "#F0FDF4", borderBottom: "1px solid #D1FAE5", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>✓ Contrato assinado</p>
              {motoboy.contrato_assinado_em && (
                <p style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                  Em {new Date(motoboy.contrato_assinado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {motoboy.contrato_assinatura && (
                <button
                  onClick={() => setAmplia(motoboy.contrato_assinatura!)}
                  style={{ padding: "8px 14px", borderRadius: 9, border: "1.5px solid #E2E8F0", background: "white", fontSize: 12, fontWeight: 700, color: "#374151", cursor: "pointer" }}
                >
                  Ver assinatura
                </button>
              )}
              <a
                href={`/api/chego-ctrl/contrato?tipo=motoboy&id=${motoboy.id}`}
                target="_blank" rel="noreferrer"
                style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: "#f97316", fontSize: 12, fontWeight: 700, color: "white", textDecoration: "none" }}
              >
                ⬇ Baixar contrato (PDF)
              </a>
            </div>
          </div>
          {motoboy.contrato_assinatura && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={motoboy.contrato_assinatura}
              alt="Assinatura"
              onClick={() => setAmplia(motoboy.contrato_assinatura!)}
              style={{ width: "100%", maxHeight: 140, objectFit: "contain", display: "block", background: "white", cursor: "zoom-in" }}
            />
          )}
        </div>
      )}

      {/* Grid de documentos */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
          Documentos ({docs.length})
        </p>
        {docs.length === 0 ? (
          <div style={{ background: "white", borderRadius: 14, border: "1.5px solid #F1F5F9", padding: "40px 24px", textAlign: "center" }}>
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Nenhum documento enviado ainda.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
            {docs.map(doc => <DocCard key={doc.label} doc={doc} onAmplia={setAmplia} />)}
          </div>
        )}
      </div>

      {/* Dados cadastrais */}
      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "20px 24px" }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
          Dados cadastrais
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
          {[
            { label: "CPF",       value: motoboy.cpf },
            { label: "CNH",       value: motoboy.cnh },
            { label: "E-mail",    value: motoboy.email },
            { label: "Telefone",  value: motoboy.telefone },
            { label: "Veículo",   value: motoboy.veiculo },
            { label: "Placa",     value: motoboy.placa },
            { label: "PIX",       value: motoboy.pix_key },
            { label: "Cadastro",  value: new Date(motoboy.criado_em).toLocaleDateString("pt-BR") },
          ].filter(r => r.value).map(row => (
            <div key={row.label} style={{ padding: "8px 0", borderBottom: "1px solid #F8FAFC" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{row.label}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{row.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
