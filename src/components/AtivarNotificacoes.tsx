"use client"

// Cartão "Ativar notificações" da tela inicial (31/10/2026, pedido do Lucas).
// - Ainda não decidiu: convida a ativar (o pedido de permissão só sai com o toque, regra do
//   iPhone/Safari). "Agora não" esconde por 3 dias.
// - Bloqueou: o navegador não deixa perguntar de novo; mostra como liberar nos ajustes (1x por semana).
// - iPhone fora do app instalado: notificação não existe ali; ensina a adicionar à Tela de Início.
// - Já permitiu: grava a inscrição em silêncio (uma vez por sessão).
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Modo = "pedir" | "bloqueado" | "instalar" | null
const CHAVE = "arago_notif_adiado_ate"

function b64(s: string) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
const ehIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const instalado = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true
const adiado = () => { try { return Date.now() < Number(localStorage.getItem(CHAVE) ?? 0) } catch { return false } }
const adiar = (dias: number) => { try { localStorage.setItem(CHAVE, String(Date.now() + dias * 86400_000)) } catch {} }

async function inscrever(): Promise<boolean> {
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapid) return false
  const reg = await navigator.serviceWorker.register("/sw.js")
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(vapid) })
  const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }) as any)
  const tk = data?.session?.access_token
  const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json", ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }, body: JSON.stringify({ action: "subscribe-cliente", subscription: sub }) })
  return r.ok
}

export function AtivarNotificacoes() {
  const [modo, setModo] = useState<Modo>(null)
  const [ocupado, setOcupado] = useState(false)
  const [feito, setFeito] = useState(false)

  useEffect(() => {
    const suporta = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window
    if (!suporta) { if (ehIphone() && !instalado() && !adiado()) setTimeout(() => setModo("instalar"), 3000); return }
    const p = Notification.permission
    if (p === "granted") {
      try { if (sessionStorage.getItem("arago_notif_ok")) return; sessionStorage.setItem("arago_notif_ok", "1") } catch {}
      inscrever().catch(() => {})
      return
    }
    if (adiado()) return
    const t = setTimeout(() => setModo(p === "denied" ? "bloqueado" : "pedir"), 3000)
    return () => clearTimeout(t)
  }, [])

  async function ativar() {
    setOcupado(true)
    try {
      const p = await Notification.requestPermission()
      if (p === "granted") { await inscrever(); setFeito(true); setTimeout(() => setModo(null), 2500) }
      else if (p === "denied") setModo("bloqueado")
      else { adiar(3); setModo(null) }
    } catch { setModo(null) }
    setOcupado(false)
  }
  const fechar = (dias: number) => { adiar(dias); setModo(null) }

  if (!modo) return null
  const iphone = ehIphone()
  return (
    <div role="dialog" aria-label="Notificações" style={{ margin: "10px 16px 0", padding: 14, borderRadius: 16, background: "var(--card, #fff)", border: "1px solid rgba(0,0,0,.08)", boxShadow: "0 6px 20px rgba(0,0,0,.06)", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">{feito ? "✅" : "🔔"}</span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.45 }}>
        {feito ? <b style={{ fontSize: 15 }}>Pronto! Você vai receber os avisos do seu pedido.</b>
        : modo === "pedir" ? <>
            <b style={{ display: "block", fontSize: 15 }}>Ative as notificações</b>
            Saiba na hora quando a loja aceitar e quando o motoboy sair com o seu pedido.
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={ativar} disabled={ocupado} style={btn(true)}>{ocupado ? "Ativando…" : "Ativar notificações"}</button>
              <button onClick={() => fechar(3)} style={btn(false)}>Agora não</button>
            </div>
          </>
        : modo === "bloqueado" ? <>
            <b style={{ display: "block", fontSize: 15 }}>As notificações estão bloqueadas</b>
            {iphone
              ? "Para receber os avisos do pedido, abra Ajustes do iPhone, toque em Notificações, escolha Chegô e ative Permitir Notificações."
              : "Para receber os avisos do pedido, toque no cadeado ao lado do endereço do site, vá em Permissões e libere Notificações."}
            <div style={{ marginTop: 10 }}><button onClick={() => fechar(7)} style={btn(false)}>Entendi</button></div>
          </>
        : <>
            <b style={{ display: "block", fontSize: 15 }}>Receba os avisos do seu pedido</b>
            No iPhone, as notificações funcionam com o Chegô na Tela de Início: toque em Compartilhar (o quadrado com a seta) e depois em Adicionar à Tela de Início.
            <div style={{ marginTop: 10 }}><button onClick={() => fechar(7)} style={btn(false)}>Entendi</button></div>
          </>}
      </div>
      {!feito && <button onClick={() => fechar(modo === "pedir" ? 3 : 7)} aria-label="Fechar" style={{ border: 0, background: "none", fontSize: 18, lineHeight: 1, color: "#8a8378", cursor: "pointer", padding: 4 }}>×</button>}
    </div>
  )
}

const btn = (primario: boolean): React.CSSProperties => ({ border: primario ? 0 : "1px solid rgba(0,0,0,.15)", borderRadius: 999, padding: "9px 14px", background: primario ? "#D7261E" : "transparent", color: primario ? "#fff" : "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer" })
