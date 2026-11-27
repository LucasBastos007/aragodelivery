// Etapa 2 da segurança (27/11/2026): nome, telefone, endereço, e-mail, CPF e troco do cliente não
// saem mais pela chave pública do banco (nem o telefone do motoboy). A tela busca as linhas como
// antes (sem essas colunas) e completa por aqui, pelo servidor, com a sessão de quem está logado
// (cookie de loja/motoboy/admin ou token do cliente). Funciona com o banco aberto ou fechado:
// se o servidor não devolver, mantém o que já veio.
import { supabase } from "@/lib/supabase"

export const PII_PEDIDO = ["nome_cliente", "telefone_cliente", "endereco_entrega", "email_cliente", "cpf_cliente", "troco_para"] as const

async function buscar(ids: string[]): Promise<Map<string, any>> {
  const m = new Map<string, any>()
  if (!ids.length) return m
  try {
    const { data } = await supabase.auth.getSession()
    const tk = data.session?.access_token
    const r = await fetch("/api/ler", {
      method: "POST", credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json", ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
      body: JSON.stringify({ q: "pedidos_pii", p: { ids } }),
    })
    const j = await r.json().catch(() => null)
    for (const x of (j?.data ?? []) as any[]) m.set(x.id, x)
  } catch { /* sem conexão: segue com o que veio */ }
  return m
}

function juntar<T extends Record<string, any>>(row: T, x: any): T {
  if (!x) return row
  const { id: _i, motoboy_telefone, ...pii } = x
  const out: any = { ...row }
  for (const [k, v] of Object.entries(pii)) if (v !== undefined) out[k] = v
  if (motoboy_telefone !== undefined && out.motoboy && typeof out.motoboy === "object") out.motoboy = { ...out.motoboy, telefone: motoboy_telefone }
  return out
}

/** Completa uma lista de pedidos com os dados do cliente (pelo servidor). */
export async function comPii<T extends Record<string, any>>(rows: T[] | null | undefined): Promise<T[]> {
  const lista = (rows ?? []) as T[]
  const ids = lista.map(r => r?.id).filter(Boolean) as string[]
  if (!ids.length) return lista
  const m = await buscar(ids)
  return lista.map(r => juntar(r, m.get(r.id)))
}

/** Mesmo que comPii, pra um pedido só. */
export async function comPiiUm<T extends Record<string, any>>(row: T | null | undefined): Promise<T | null> {
  if (!row?.id) return (row ?? null) as T | null
  const [x] = await comPii([row])
  return x
}

export const ehRetirada = (p: { endereco_entrega?: string | null } | null | undefined) => /retirada/i.test(p?.endereco_entrega ?? "")
