"use client"

import { useEffect, useState } from "react"
import { supabase } from "./supabase"
import type { User } from "@supabase/supabase-js"

export interface ClientePerfil {
  id: string
  nome: string
  telefone: string
  cpf?: string
  email?: string
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
          ? `${window.location.origin}/`
          : undefined,
      },
    })
  }

  async function loginApple() {
    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: typeof window !== "undefined"
          ? `${window.location.origin}/`
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
    const res = await fetch("/api/auth/cadastro-cliente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), senha, nome, telefone }),
    })
    const json = await res.json()
    if (!res.ok) return json.error ?? "Erro ao criar conta."
    // Registra evento de cadastro
    fetch("/api/tracking/evento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "cadastro" }),
    }).catch(() => {})
    // Após criar via admin, faz login normal
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha })
    return error?.message ?? null
  }

  async function salvarPerfil(
    nome: string,
    telefone: string,
    endereco?: {
      rua?: string; numero?: string; bairro?: string
      complemento?: string; cep?: string; cidade?: string
    },
    cpf?: string
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
    if (cpf) {
      const digits = cpf.replace(/\D/g, "")
      if (digits.length === 11) {
        payload.cpf = digits
        supabase.auth.updateUser({ data: { cpf: digits } }).catch(() => {})
      }
    }
    await supabase.from("clientes").upsert(payload)
    setPerfil(p => p
      ? { ...p, nome, telefone, ...payload }
      : { id: user.id, nome, telefone, ...payload }
    )
  }

  async function completarPerfil(dados: {
    nome: string
    telefone: string
    cpf: string
    endereco?: { rua?: string; numero?: string; bairro?: string; complemento?: string; cep?: string; cidade?: string }
  }) {
    if (!user) return
    const cpfDigits = dados.cpf.replace(/\D/g, "")
    const payload: any = {
      id: user.id,
      nome: dados.nome.trim(),
      telefone: dados.telefone.trim(),
      cpf: cpfDigits,
    }
    if (dados.endereco) {
      const e = dados.endereco
      if (e.rua        !== undefined) payload.endereco_rua         = e.rua
      if (e.numero     !== undefined) payload.endereco_numero      = e.numero
      if (e.bairro     !== undefined) payload.endereco_bairro      = e.bairro
      if (e.complemento !== undefined) payload.endereco_complemento = e.complemento
      if (e.cep        !== undefined) payload.endereco_cep         = e.cep
      if (e.cidade     !== undefined) payload.endereco_cidade      = e.cidade
    }
    // Salva no banco (pode falhar se coluna cpf não existir — ignoramos silenciosamente)
    await supabase.from("clientes").upsert(payload)
    // Salva também nos metadados do usuário Supabase Auth — sempre funciona
    await supabase.auth.updateUser({ data: { cpf: cpfDigits, nome: payload.nome, telefone: payload.telefone } })
    setPerfil(p => p ? { ...p, ...payload } : { nome: "", telefone: "", ...payload })
  }

  async function logout() {
    await supabase.auth.signOut()
    // Limpa dados do cliente do localStorage — evita vazamento entre sessões
    const KEYS = [
      "arago_cart", "arago_pedido_ativo", "arago_cartao",
      "arago_last_address", "arago_endereco_salvo", "arago_enderecos",
    ]
    KEYS.forEach((k) => localStorage.removeItem(k))
    setPerfUser(null)
    setPerfil(null)
  }

  return { user, perfil, loading, loginGoogle, loginApple, loginEmail, cadastrar, salvarPerfil, completarPerfil, logout }
}
