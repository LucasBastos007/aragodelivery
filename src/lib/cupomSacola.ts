import { supabase } from "@/lib/supabase"
// Cupom aplicado na Sacola (layout da proposta, 20/10/2026). A Sacola valida e guarda só o
// código; o Finalizar valida de novo com o endereço escolhido (cupom por área/raio depende
// dele) antes de dar o desconto. A regra continua toda em /api/cupom/validar.
export type CupomValido = { id: string; codigo: string; tipo: "percentual" | "fixo" | "frete_gratis" | "frete_percentual"; valor: number }

const CHAVE = "arago_cupom"

export function lerCupomSacola(lojaId: string | null): string | null {
  try {
    const c = JSON.parse(sessionStorage.getItem(CHAVE) ?? "null")
    return c && c.loja_id === lojaId && c.codigo ? String(c.codigo) : null
  } catch { return null }
}
export function gravarCupomSacola(lojaId: string, codigo: string) {
  try { sessionStorage.setItem(CHAVE, JSON.stringify({ loja_id: lojaId, codigo })) } catch {}
}
export function limparCupomSacola() {
  try { sessionStorage.removeItem(CHAVE) } catch {}
}

export function descricaoCupom(c: CupomValido, brl: (v: number) => string): string {
  return c.tipo === "percentual" ? `${c.valor}% de desconto`
    : c.tipo === "frete_gratis" ? "entrega grátis"
    : c.tipo === "frete_percentual" ? `${c.valor}% de desconto na entrega`
    : `${brl(c.valor)} de desconto`
}

/** Chama a validação do servidor. Endereço opcional (na Sacola usa o último endereço salvo). */
export async function validarCupom(p: { codigo: string; lojaId: string; subtotal: number; lat?: number | null; lng?: number | null; cidade?: string | null; telefone?: string | null }):
  Promise<{ ok: true; cupom: CupomValido } | { ok: false; erro: string }> {
  const params = new URLSearchParams({
    codigo: p.codigo.trim().toUpperCase(), subtotal: String(p.subtotal), loja_id: p.lojaId,
    ...(p.lat && p.lng ? { lat: String(p.lat), lng: String(p.lng) } : {}),
    ...(p.cidade ? { cidade: p.cidade } : {}),
    ...(p.telefone ? { telefone: p.telefone } : {}),
  })
  try {
    // Token do login vai junto: o cupom de primeiro pedido confere a conta logada
    const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }) as any)
    const tk = data?.session?.access_token
    const res = await fetch(`/api/cupom/validar?${params}`, tk ? { headers: { Authorization: `Bearer ${tk}` } } : undefined)
    const json = await res.json()
    return res.ok ? { ok: true, cupom: json } : { ok: false, erro: json.error ?? "Cupom inválido." }
  } catch { return { ok: false, erro: "Não deu pra conferir o cupom agora. Tente de novo." } }
}
