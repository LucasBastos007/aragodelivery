"use client"

import { useEffect, useState } from "react"
import { supabase } from "./supabase"
import type { User } from "@supabase/supabase-js"

export interface ClientePerfil {
  id: string
  nome: string
  telefone: string
  endereco_rua?: string
  endereco_numero?: string
  endereco_bairro?: string
  endereco_complemento?: string
  endereco_cep?: string
  endereco_cidade?: string
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
          ? `${window.location.origin}/cliente/meu-perfil`
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

  async function salvarPerfil(
    nome: string,
    telefone: string,
    endereco?: {
      rua?: string; numero?: string; bairro?: string
      complemento?: string; cep?: string; cidade?: string
    }
  ) {
    if (!user) return
    const payload: any = { id: user.id, nome: nome.trim(), telefone: telefone.trim() }
    if (endereco) {
      if (endereco.rua       !== undefined) payload.endereco_rua        = endereco.rua
      if (endereco.numero    !== undefined) payload.endereco_numero     = endereco.numero
      if (endereco.bairro    !== undefined) payload.endereco_bairro     = endereco.bairro
      if (endereco.complemento !== undefined) payload.endereco_complemento = endereco.complemento
      if (endereco.cep       !== undefined) payload.endereco_cep        = endereco.cep
      if (endereco.cidade    !== undefined) payload.endereco_cidade     = endereco.cidade
    }
    await supabase.from("clientes").upsert(payload)
    setPerfil(p => p
      ? { ...p, nome, telefone, ...payload }
      : { id: user.id, nome, telefone, ...payload }
    )
  }

  async function logout() {
    await supabase.auth.signOut()
    setPerfUser(null)
    setPerfil(null)
  }

  return { user, perfil, loading, loginGoogle, loginEmail, cadastrar, salvarPerfil, logout }
}
