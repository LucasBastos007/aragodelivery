"use client"

// "Agora no app" (31/10/2026): enquanto o app do cliente está aberto e visível, avisa a cada
// 1 min com o código anônimo do celular (o mesmo de /api/tracking/evento). Telas de loja,
// motoboy e admin não contam.
// Lembrete de sacola (01/11/2026): o mesmo aviso leva o resumo da sacola (loja, itens, total)
// e a inscrição de notificação, se o cliente já permitiu. Nunca pede permissão daqui.
import { useEffect } from "react"
import { usePathname } from "next/navigation"

const FORA = ["/chego-ctrl", "/loja", "/motoboy", "/entrar", "/cadastro-loja", "/cadastro-motoboy", "/contrato", "/login-loja", "/parceiros"]

function visitante() {
  try {
    let v = localStorage.getItem("arago_visitante")
    if (!v) { v = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; localStorage.setItem("arago_visitante", v) }
    return v
  } catch { return null }
}

function sacola() {
  try {
    const itens: any[] = JSON.parse(localStorage.getItem("arago_cart") ?? "[]")
    if (!Array.isArray(itens) || itens.length === 0 || !itens[0]?.loja_id) return null
    return {
      loja_id: String(itens[0].loja_id),
      itens: itens.reduce((s, i) => s + (Number(i.quantidade) || 0), 0),
      total: Math.round(itens.reduce((s, i) => s + (Number(i.preco) || 0) * (Number(i.quantidade) || 0), 0) * 100) / 100,
    }
  } catch { return null }
}

async function inscricao() {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return null
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    return sub ? sub.toJSON() : null
  } catch { return null }
}

export default function OnlinePing() {
  const path = usePathname() ?? "/"
  useEffect(() => {
    if (FORA.some(p => path === p || path.startsWith(p + "/"))) return
    const tela = path.startsWith("/pedido/") ? "pedido" : path.startsWith("/checkout") || path.startsWith("/carrinho") ? "checkout" : "lojas"
    const avisar = async () => {
      if (document.visibilityState !== "visible") return
      const v = visitante(); if (!v) return
      const s = sacola()
      const sub = s ? await inscricao() : null
      fetch("/api/online", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitante: v, tela, sacola: s, sub }), keepalive: true }).catch(() => {})
    }
    avisar()
    const iv = setInterval(avisar, 60_000)
    document.addEventListener("visibilitychange", avisar)
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", avisar) }
  }, [path])
  return null
}
