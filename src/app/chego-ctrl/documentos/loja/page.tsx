"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import type { Loja } from "@/types"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pendente:          { label: "Pendente",          color: "#d97706", bg: "#FFFBEB" },
  aprovado:          { label: "Aprovado",           color: "#2563eb", bg: "#EFF6FF" },
  contrato_assinado: { label: "Contrato assinado",  color: "#7c3aed", bg: "#F5F3FF" },
  ativo:             { label: "Ativo",              color: "#059669", bg: "#ECFDF5" },
  suspenso:          { label: "Suspenso",           color: "#dc2626", bg: "#FEF2F2" },
}

type Doc = { label: string; url: string; tipo: "imagem" | "assinatura" }

function DocCard({ doc, onAmplia }: { doc: Doc; onAmplia: (url: string) => void }) {
  return (
    <div style={{
      background: "white", borderRadius: 14, overflow: "hidden",
      border: "1.5px solid #F1F5F9",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      display: "flex", flexDirection: "column",
    }}>
      <div
        onClick={() => onAmplia(doc.url)}
        style={{
          height: 160, cursor: "zoom-in", overflow: "hidden",
          background: "#F8FAFC", position: "relative",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={doc.url}
          alt={doc.label}
          style={{ width: "100%", height: "100%", objectFit: doc.tipo === "assinatura" ? "contain" : "cover" }}
        />
        <div style={{
          position: "absolute", top: 8, right: 8,
          width: 28, height: 28, borderRadius: 8,
          background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1"/>
          </svg>
        </div>
      </div>
      <div style={{ padding: "10px 12px", borderTop: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{doc.label}</p>
        <a
          href={doc.url}
          download
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 11, fontWeight: 700, color: "#f97316", textDecoration: "none" }}
        >
          ⬇
        </a>
      </div>
    </div>
  )
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.93)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Documento"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: "92vw", maxHeight: "88vh", objectFit: "contain", borderRadius: 10 }}
      />
      <button
        onClick={onClose}
        style={{ position: "absolute", top: 16, right: 16, width: 38, height: 38, borderRadius: "50%", background: "white", border: "none", fontSize: 18, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#0F172A" }}
      >✕</button>
    </div>
  )
}

export default function DocumentosLojaPage() {
  const params = useSearchParams()
  const router = useRouter()
  const id = params.get("id")

  const [loja, setLoja]       = useState<Loja | null>(null)
  const [loading, setLoading] = useState(true)
  const [amplia, setAmplia]   = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabaseAdmin.from("lojas").select("*").eq("id", id).single().then(({ data }) => {
      setLoja(data as Loja)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#94a3b8" }}>Carregando documentos…</p>
      </div>
    )
  }

  if (!loja) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#ef4444" }}>Loja não encontrada.</p>
      </div>
    )
  }

  const statusCfg = STATUS_CFG[loja.status] ?? { label: loja.status, color: "#64748b", bg: "#F1F5F9" }

  const docs: Doc[] = []
  if (loja.logo_url)              docs.push({ label: "Logo",               url: loja.logo_url,               tipo: "imagem" })
  if ((loja as any).contrato_assinatura) docs.push({ label: "Assinatura do contrato", url: (loja as any).contrato_assinatura, tipo: "assinatura" })

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "32px 36px" }}>
      {amplia && <Lightbox src={amplia} onClose={() => setAmplia(null)} />}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => router.push("/chego-ctrl/lojas")}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar para Lojas
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {loja.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={loja.logo_url} alt={loja.nome} style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover", border: "2px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#f97316" }}>
              {loja.nome.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.3px" }}>{loja.nome}</h1>
              <span style={{ padding: "3px 10px", borderRadius: 50, fontSize: 11, fontWeight: 700, background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.color}22` }}>
                {statusCfg.label}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 3 }}>{loja.categoria} · {loja.endereco}</p>
          </div>
        </div>
      </div>

      {/* Contrato — destaque */}
      {loja.contrato_assinado && (
        <div style={{ marginBottom: 28, background: "white", borderRadius: 16, border: "1.5px solid #D1FAE5", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", background: "#F0FDF4", borderBottom: "1px solid #D1FAE5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>✓ Contrato assinado</p>
              {(loja as any).contrato_assinado_em && (
                <p style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                  Em {new Date((loja as any).contrato_assinado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(loja as any).contrato_assinatura && (
                <button
                  onClick={() => setAmplia((loja as any).contrato_assinatura)}
                  style={{ padding: "8px 14px", borderRadius: 9, border: "1.5px solid #E2E8F0", background: "white", fontSize: 12, fontWeight: 700, color: "#374151", cursor: "pointer" }}
                >
                  Ver assinatura
                </button>
              )}
              <a
                href={`/api/chego-ctrl/contrato?tipo=loja&id=${loja.id}`}
                target="_blank" rel="noreferrer"
                style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: "#f97316", fontSize: 12, fontWeight: 700, color: "white", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}
              >
                ⬇ Baixar contrato (PDF)
              </a>
            </div>
          </div>
          {(loja as any).contrato_assinatura && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={(loja as any).contrato_assinatura}
              alt="Assinatura"
              onClick={() => setAmplia((loja as any).contrato_assinatura)}
              style={{ width: "100%", maxHeight: 140, objectFit: "contain", display: "block", background: "white", cursor: "zoom-in" }}
            />
          )}
        </div>
      )}

      {/* Documentos */}
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
            { label: "Responsável",  value: loja.nome_responsavel },
            { label: "E-mail",       value: loja.email },
            { label: "CNPJ",         value: loja.cnpj },
            { label: "CPF",          value: (loja as any).cpf_responsavel },
            { label: "Telefone",     value: loja.telefone },
            { label: "PIX",          value: loja.pix_key },
            { label: "Cadastro",     value: new Date(loja.criado_em).toLocaleDateString("pt-BR") },
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
