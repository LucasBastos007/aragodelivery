"use client"

import { useEffect, useRef, useState } from "react"

type Papel = "lojista" | "motoboy" | "cliente"

const MANIFESTO: Record<Papel, string> = {
  lojista: "/manifest-loja.json",
  motoboy: "/manifest-motoboy.json",
  cliente: "/manifest.json",
}

interface Props {
  papel: Papel
  dark?: boolean
}

export default function InstalarApp({ papel, dark = false }: Props) {
  const promptRef = useRef<any>(null)
  const [show, setShow]       = useState(false)
  const [isIOS, setIsIOS]     = useState(false)
  const [iosHint, setIosHint] = useState(false)

  // Troca o manifesto no <head> conforme o papel
  useEffect(() => {
    const href = MANIFESTO[papel]
    let el = document.querySelector<HTMLLinkElement>("link[rel='manifest']")
    if (!el) {
      el = document.createElement("link")
      el.rel = "manifest"
      document.head.appendChild(el)
    }
    el.href = href
  }, [papel])

  // Detecta plataforma e captura o evento de instalação (Android/Chrome)
  useEffect(() => {
    // Já está rodando como PWA instalado → não exibe nada
    if (window.matchMedia("(display-mode: standalone)").matches) return

    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window as any).MSStream
    setIsIOS(ios)

    if (ios) {
      // No iOS só exibe se for Safari (sem prompt nativo)
      setShow(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      promptRef.current = e
      setShow(true)
    }
    window.addEventListener("beforeinstallprompt", handler as EventListener)

    const onInstalled = () => setShow(false)
    window.addEventListener("appinstalled", onInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler as EventListener)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  if (!show) return null

  async function handleInstall() {
    if (isIOS) {
      setIosHint(true)
      return
    }
    const p = promptRef.current
    if (!p) return
    p.prompt()
    const { outcome } = await p.userChoice
    if (outcome === "accepted") setShow(false)
  }

  const bg     = dark ? "rgba(255,255,255,0.06)" : "rgba(249,115,22,0.07)"
  const border = dark ? "rgba(255,255,255,0.10)" : "rgba(249,115,22,0.2)"
  const text   = dark ? "rgba(255,255,255,0.55)" : "#6B7280"

  return (
    <div
      style={{
        marginTop: 20,
        borderRadius: 14,
        padding: "14px 16px",
        background: bg,
        border: `1px solid ${border}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* ícone de app */}
        <img
          src="/logo-chego.png"
          alt="Chegô"
          width={36}
          height={36}
          style={{ borderRadius: 9, objectFit: "cover", flexShrink: 0 }}
        />

        <div style={{ flex: 1 }}>
          <p style={{ color: dark ? "white" : "#111827", fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>
            Adicionar à tela inicial
          </p>
          <p style={{ color: text, fontSize: 12, marginTop: 2 }}>
            Abra direto pelo ícone do app
          </p>
        </div>

        <button
          onClick={handleInstall}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "none",
            background: "#f97316",
            color: "white",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Instalar
        </button>
      </div>

      {iosHint && (
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10 }}>
          <p style={{ color: text, fontSize: 12, lineHeight: 1.7 }}>
            No Safari: toque no botão{" "}
            {/* ícone de compartilhar do iOS */}
            <svg
              style={{ display: "inline", verticalAlign: "middle" }}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={dark ? "rgba(255,255,255,0.55)" : "#6B7280"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>{" "}
            e escolha <strong>Adicionar à Tela de Início</strong>.
          </p>
        </div>
      )}
    </div>
  )
}
