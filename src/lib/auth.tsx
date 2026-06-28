"use client"

import { createContext, useContext, useEffect, useState } from "react"

export type Sessao =
  | { role: "admin" }
  | { role: "lojista";  loja_id: string;    loja_nome: string }
  | { role: "motoboy";  motoboy_id: string; motoboy_nome: string }

type AuthCtx = {
  sessao: Sessao | null
  authLoading: boolean
  login: (s: Sessao) => void
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    try {
      const saved = localStorage.getItem("arago_sessao")
      if (saved) setSessao(JSON.parse(saved))
    } catch {}
    setAuthLoading(false)
  }, [])

  function login(s: Sessao) {
    setSessao(s)
    localStorage.setItem("arago_sessao", JSON.stringify(s))
  }

  async function logout() {
    setSessao(null)
    const KEYS = [
      "arago_sessao",
      "arago_cart", "arago_pedido_ativo", "arago_cartao",
      "arago_last_address", "arago_endereco_salvo", "arago_enderecos",
    ]
    KEYS.forEach((k) => localStorage.removeItem(k))
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
  }

  return <Ctx.Provider value={{ sessao, authLoading, login, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useAuth fora do AuthProvider")
  return ctx
}
