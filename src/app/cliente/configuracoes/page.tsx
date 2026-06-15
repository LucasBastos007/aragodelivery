"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useClienteAuth } from "@/lib/auth-cliente"

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
        background: on ? "#DC2626" : "#E5E7EB", position: "relative", transition: "background 0.2s",
        flexShrink: 0,
      }}>
      <span style={{
        position: "absolute", top: 3, width: 18, height: 18, borderRadius: "50%",
        background: "white", transition: "left 0.2s",
        left: on ? 23 : 3,
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      }} />
    </button>
  )
}

export default function ConfiguracoesPage() {
  const router = useRouter()
  const { user, loading, logout } = useClienteAuth()

  const [notifPedidos,   setNotifPedidos]   = useState(true)
  const [notifPromocoes, setNotifPromocoes] = useState(true)
  const [notifNovidades, setNotifNovidades] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push("/cliente/entrar")
  }, [user, loading, router])

  useEffect(() => {
    if (typeof window !== "undefined") {
      setNotifPedidos(localStorage.getItem("notif_pedidos") !== "false")
      setNotifPromocoes(localStorage.getItem("notif_promocoes") !== "false")
      setNotifNovidades(localStorage.getItem("notif_novidades") === "true")
    }
  }, [])

  function saveToggle(key: string, val: boolean) {
    if (typeof window !== "undefined") localStorage.setItem(key, String(val))
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#9CA3AF" }}>Carregando...</p>
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <nav style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>←</button>
        <p style={{ color: "#111827", fontWeight: 800, fontSize: 16, flex: 1 }}>Configurações</p>
      </nav>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Notificações */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f3f4f6" }}>
            <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>🔔 Notificações</p>
            <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>Escolha o que você quer receber</p>
          </div>
          {[
            { key: "notif_pedidos",   label: "Atualizações de pedido",  desc: "Status em tempo real dos seus pedidos", val: notifPedidos,   set: setNotifPedidos },
            { key: "notif_promocoes", label: "Promoções e cupons",       desc: "Ofertas especiais das lojas",           val: notifPromocoes, set: setNotifPromocoes },
            { key: "notif_novidades", label: "Novidades do app",         desc: "Novas funcionalidades e lojas",         val: notifNovidades, set: setNotifNovidades },
          ].map(item => (
            <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #f3f4f6" }}>
              <div>
                <p style={{ color: "#374151", fontWeight: 600, fontSize: 14 }}>{item.label}</p>
                <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 1 }}>{item.desc}</p>
              </div>
              <Toggle on={item.val} onChange={v => { item.set(v); saveToggle(item.key, v) }} />
            </div>
          ))}
        </div>

        {/* Sobre */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f3f4f6" }}>
            <p style={{ color: "#111827", fontWeight: 700, fontSize: 14 }}>ℹ️ Sobre o app</p>
          </div>
          {[
            { label: "Versão", value: "1.0.0" },
            { label: "Cidade", value: "Aragoiânia, GO" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ color: "#374151", fontSize: 14 }}>{item.label}</span>
              <span style={{ color: "#9CA3AF", fontSize: 13 }}>{item.value}</span>
            </div>
          ))}
          <a href="https://wa.me/5562984159340" target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "13px 18px", textDecoration: "none",
          }}>
            <span style={{ color: "#374151", fontSize: 14 }}>Suporte via WhatsApp</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>
        </div>

        {/* Zona de perigo */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #FEE2E2", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #FEE2E2" }}>
            <p style={{ color: "#DC2626", fontWeight: 700, fontSize: 14 }}>Zona de perigo</p>
          </div>
          <button
            onClick={async () => { await logout(); router.push("/") }}
            style={{ width: "100%", padding: "14px 18px", border: "none", background: "none", textAlign: "left", color: "#DC2626", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  )
}
