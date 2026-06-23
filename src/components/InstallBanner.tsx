"use client"

import { useEffect, useState } from "react"

type Props = { dark?: boolean }

export default function InstallBanner({ dark = false }: Props) {
  const [prompt, setPrompt]   = useState<any>(null)
  const [show,   setShow]     = useState(false)
  const [isIOS,  setIsIOS]    = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    // Já instalado como PWA → não mostra
    if (window.matchMedia("(display-mode: standalone)").matches) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(ios)

    if (ios) {
      setShow(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e)
      setShow(true)
    }
    window.addEventListener("beforeinstallprompt", handler as EventListener)
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener)
  }, [])

  if (!show) return null

  const bg      = dark ? "rgba(255,255,255,0.06)" : "rgba(249,115,22,0.07)"
  const border  = dark ? "rgba(255,255,255,0.1)"  : "rgba(249,115,22,0.2)"
  const text    = dark ? "rgba(255,255,255,0.7)"  : "#6B7280"
  const btnBg   = "#f97316"

  async function handleInstall() {
    if (isIOS) { setIosHint(true); return }
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === "accepted") setShow(false)
  }

  return (
    <div style={{ marginTop: 20, borderRadius: 14, padding: "14px 16px", background: bg, border: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img src="/logo-chego.png" alt="Chegô" width={36} height={36} style={{ borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ color: dark ? "white" : "#111827", fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>Adicionar à tela inicial</p>
          <p style={{ color: text, fontSize: 12, marginTop: 2 }}>Abra direto pelo ícone do app</p>
        </div>
        <button onClick={handleInstall} style={{
          padding: "8px 14px", borderRadius: 10, border: "none",
          background: btnBg, color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0,
        }}>
          Instalar
        </button>
      </div>

      {iosHint && (
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10 }}>
          <p style={{ color: text, fontSize: 12, lineHeight: 1.6 }}>
            No Safari: toque no botão{" "}
            <svg style={{ display: "inline", verticalAlign: "middle" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "rgba(255,255,255,0.7)" : "#6B7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            {" "}e escolha <strong>Adicionar à Tela de Início</strong>.
          </p>
        </div>
      )}
    </div>
  )
}
