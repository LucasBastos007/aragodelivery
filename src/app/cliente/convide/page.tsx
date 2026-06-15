"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useClienteAuth } from "@/lib/auth-cliente"

export default function ConvidePage() {
  const router = useRouter()
  const { user, loading } = useClienteAuth()
  const [copiado, setCopiado] = useState(false)
  const [convitesConcluidos, setConvitesConcluidos] = useState(0)

  useEffect(() => {
    if (!loading && !user) router.push("/cliente/entrar")
  }, [user, loading, router])

  const codigoConvite = user ? user.id.substring(0, 8).toUpperCase() : "—"
  const linkConvite = typeof window !== "undefined"
    ? `${window.location.origin}/?ref=${codigoConvite}`
    : `https://aragodelivery.vercel.app/?ref=${codigoConvite}`

  function copiarLink() {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(linkConvite).then(() => {
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
      })
    }
  }

  async function compartilhar() {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({
        title: "Chegô Delivery",
        text: `Use meu código ${codigoConvite} e ganhe desconto no primeiro pedido no Chegô!`,
        url: linkConvite,
      })
    } else {
      copiarLink()
    }
  }

  const progresso = Math.min(convitesConcluidos, 5)
  const cuponsGanhos = Math.floor(convitesConcluidos / 5)

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#9CA3AF" }}>Carregando...</p>
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <nav style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>←</button>
        <p style={{ color: "#111827", fontWeight: 800, fontSize: 16, flex: 1 }}>Convide e ganhe</p>
      </nav>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "28px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Banner */}
        <div style={{
          background: "linear-gradient(135deg, #B91C1C 0%, #DC2626 60%, #EF4444 100%)",
          borderRadius: 20, padding: "28px 24px", textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
          <p style={{ fontSize: 44, marginBottom: 10 }}>🎁</p>
          <p style={{ color: "white", fontWeight: 900, fontSize: 22, marginBottom: 6 }}>Convide e ganhe cupons!</p>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 1.5 }}>
            A cada <strong>5 amigos</strong> que fizerem o primeiro pedido usando seu código, você ganha <strong>1 cupom de desconto</strong>.
          </p>
        </div>

        {/* Código */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "20px" }}>
          <p style={{ color: "#6B7280", fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Seu código de convite</p>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{
              flex: 1, padding: "14px 16px", borderRadius: 12,
              background: "rgba(220,38,38,0.05)", border: "2px dashed rgba(220,38,38,0.3)",
              textAlign: "center",
            }}>
              <p style={{ color: "#DC2626", fontWeight: 900, fontSize: 28, letterSpacing: 6, fontFamily: "monospace" }}>
                {codigoConvite}
              </p>
            </div>
            <button onClick={copiarLink} style={{
              padding: "14px 16px", borderRadius: 12, border: "1px solid #e5e7eb",
              background: copiado ? "rgba(34,197,94,0.1)" : "#F9FAFB",
              color: copiado ? "#22c55e" : "#374151", fontWeight: 700, fontSize: 13, cursor: "pointer",
              flexShrink: 0,
            }}>
              {copiado ? "✓" : "Copiar"}
            </button>
          </div>
        </div>

        {/* Progresso */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>Progresso</p>
            <span style={{ color: "#DC2626", fontWeight: 800, fontSize: 14 }}>{progresso}/5 convites</span>
          </div>
          {/* Barra */}
          <div style={{ background: "#F3F4F6", borderRadius: 999, height: 10, marginBottom: 8, overflow: "hidden" }}>
            <div style={{ background: "#DC2626", height: "100%", borderRadius: 999, width: `${(progresso / 5) * 100}%`, transition: "width 0.5s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ color: "#9CA3AF", fontSize: 12 }}>
              {5 - progresso > 0 ? `Faltam ${5 - progresso} convites para o próximo cupom` : "🎉 Parabéns! Você ganhou um cupom!"}
            </p>
            {cuponsGanhos > 0 && (
              <span style={{ background: "rgba(220,38,38,0.1)", color: "#DC2626", fontWeight: 700, fontSize: 12, padding: "3px 10px", borderRadius: 20 }}>
                {cuponsGanhos} cupom{cuponsGanhos !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Como funciona */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "20px" }}>
          <p style={{ color: "#111827", fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Como funciona</p>
          {[
            { n: "1", text: "Compartilhe seu código com amigos" },
            { n: "2", text: "Eles fazem o primeiro pedido usando seu código" },
            { n: "3", text: "A cada 5 amigos que pedirem, você ganha 1 cupom de desconto" },
            { n: "4", text: "Use o cupom na próxima compra no Chegô!" },
          ].map(item => (
            <div key={item.n} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#DC2626", color: "white", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {item.n}
              </span>
              <p style={{ color: "#374151", fontSize: 14, lineHeight: 1.4, paddingTop: 2 }}>{item.text}</p>
            </div>
          ))}
        </div>

        <button onClick={compartilhar} style={{
          padding: "14px", borderRadius: 12, border: "none",
          background: "#DC2626", color: "white", fontWeight: 800, fontSize: 15, cursor: "pointer",
        }}>
          🔗 Compartilhar meu código
        </button>
      </div>
    </div>
  )
}
