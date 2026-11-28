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

  // Grava o cadastro em 2 passos (27/11/2026): o banco recusa upsert em clientes depois da trava de
  // segurança (falta UPDATE na coluna id), então atualiza e, se a linha não existir, cria.
  // Devolve a mensagem de erro (ou null) para a tela avisar o cliente em vez de "salvar" sem gravar.
  async function gravarCliente(payload: any): Promise<string | null> {
    const { id, ...campos } = payload
    const up = await supabase.from("clientes").update(campos).eq("id", id).select("id")
    if (up.error) { console.error("[CADASTRO] update", up.error); return "Não foi possível salvar seus dados. Tente de novo." }
    if (up.data && up.data.length > 0) return null
    const ins = await supabase.from("clientes").insert(payload)
    if (!ins.error) return null
    if (ins.error.code === "23505") {
      const again = await supabase.from("clientes").update(campos).eq("id", id)
      if (!again.error) return null
    }
    console.error("[CADASTRO] insert", ins.error)
    return "Não foi possível salvar seus dados. Tente de novo."
  }

  async function salvarPerfil(
    nome: string,
    telefone: string,
    endereco?: {
      rua?: string; numero?: string; bairro?: string
      complemento?: string; cep?: string; cidade?: string
    },
    cpf?: string
  ): Promise<string | null> {
    if (!user) return "Entre na sua conta para salvar."
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
    const erro = await gravarCliente(payload)
    if (erro) return erro
    setPerfil(p => p
      ? { ...p, nome, telefone, ...payload }
      : { id: user.id, nome, telefone, ...payload }
    )
    return null
  }

  async function completarPerfil(dados: {
    nome: string
    telefone: string
    cpf: string
    endereco?: { rua?: string; numero?: string; bairro?: string; complemento?: string; cep?: string; cidade?: string }
  }): Promise<string | null> {
    if (!user) return "Entre na sua conta para salvar."
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
    // Salva também nos metadados do usuário Supabase Auth (cópia de segurança)
    await supabase.auth.updateUser({ data: { cpf: cpfDigits, nome: payload.nome, telefone: payload.telefone } }).catch(() => {})
    const erro = await gravarCliente(payload)
    if (erro) return erro
    setPerfil(p => p ? { ...p, ...payload } : { nome: "", telefone: "", ...payload })
    return null
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
