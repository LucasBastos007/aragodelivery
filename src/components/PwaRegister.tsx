"use client"

import { useEffect } from "react"

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    // Captura antes de registrar: se já havia um controller, é um UPDATE (não primeira instalação)
    const hadController = !!navigator.serviceWorker.controller

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Só recarrega se for uma ATUALIZAÇÃO (já havia SW ativo antes)
        reg.addEventListener("updatefound", () => {
          if (!hadController) return // Primeira instalação: não recarrega
          const newSW = reg.installing
          if (!newSW) return
          newSW.addEventListener("statechange", () => {
            if (newSW.state === "activated") {
              window.location.reload()
            }
          })
        })
      })
      .catch((err) => console.error("SW registration failed:", err))

    // Recarrega quando o SW muda — mas apenas se já havia um controller antes
    // (evita reload na primeira instalação, que causava scroll ao topo)
    let reloading = false
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return // Primeira instalação: não recarrega
      if (reloading) return
      reloading = true
      window.location.reload()
    })
  }, [])

  return null
}
