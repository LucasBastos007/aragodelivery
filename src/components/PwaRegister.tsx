"use client"

import { useEffect } from "react"

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Quando novo SW instala, força reload ao ativar
        reg.addEventListener("updatefound", () => {
          const newSW = reg.installing
          if (!newSW) return
          newSW.addEventListener("statechange", () => {
            if (newSW.state === "activated" && navigator.serviceWorker.controller) {
              window.location.reload()
            }
          })
        })
      })
      .catch((err) => console.error("SW registration failed:", err))

    // Recarrega quando o SW muda (ex: outra aba instalou update)
    let reloading = false
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    })
  }, [])

  return null
}
