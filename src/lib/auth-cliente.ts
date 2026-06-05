"use client"

import { useEffect, useState } from "react"
import { supabase } from "./supabase"
import type { User } from "@supabase/supabase-js"

export interface ClientePerfil {
  id: string
  nome: string
  telefone: string
}

export function useClienteAuth() {
  const [user, setPerfUser]  = useState<User | null>(null)
  const [perfil, setPerfil]  = useState<ClientePerfil | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setPerfUser(u)
      if (u) loadPerfil(u.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null
      setPerfUser(u)
      if (u) loadPerfil(u.id)
      else { setPerfil(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadPerfil(id: string) {
    const { data } = await supabase.from("clientes").select("*").eq("id", id).limit(1)
    setPerfil((data as ClientePerfil[])?.[0] ?? null)
    setLoading(false)
  }

  async function loginGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined"
          ? `${window.location.origin}/cliente/perfil`
          : undefined,
      },
    })
  }

  async function loginEmail(email: string, senha: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    return error?.message ?? null
  }

  async function cadastrar(
    email: string, senha: string, nome: string, telefone: string
  ): Promise<string | null> {
    const { data, error } = await supabase.auth.signUp({ email, password: senha })
    if (error) return error.message
    if (data.user) {
      await supabase.from("clientes").upsert({
        id: data.user.id, nome: nome.trim(), telefone: telefone.trim(),
      })
    }
    return null
  }

  async function salvarPerfil(nome: string, telefone: string) {
    if (!user) return
    await supabase.from("clientes").upsert({ id: user.id, nome: nome.trim(), telefone: telefone.trim() })
    setPerfil(p => p ? { ...p, nome, telefone } : { id: user.id, nome, telefone })
  }

  async function logout() {
    await supabase.auth.signOut()
    setPerfUser(null)
    setPerfil(null)
  }

  return { user, perfil, loading, loginGoogle, loginEmail, cadastrar, salvarPerfil, logout }
}
