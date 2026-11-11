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

/** Id aleatório deste celular/navegador (11/11/2026): o frete grátis do primeiro pedido vale uma
 *  vez por aparelho, mesmo criando outra conta nele. Não identifica a pessoa, só o aparelho. */
export function idDispositivo(): string | null {
  try {
    let id = localStorage.getItem("chego_dispositivo")
    if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID()
        : Array.from({ length: 32 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("")
      localStorage.setItem("chego_dispositivo", id)
    }
    return id
  } catch { return null }
}

/** Chama a validação do servidor. Endereço opcional (na Sacola usa o último endereço salvo). */
export async function validarCupom(p: { codigo: string; lojaId: string; subtotal: number; lat?: number | null; lng?: number | null; cidade?: string | null; telefone?: string | null; rural?: boolean; retirada?: boolean }):
  Promise<{ ok: true; cupom: CupomValido } | { ok: false; erro: string }> {
  const params = new URLSearchParams({
    codigo: p.codigo.trim().toUpperCase(), subtotal: String(p.subtotal), loja_id: p.lojaId,
    ...(p.lat && p.lng ? { lat: String(p.lat), lng: String(p.lng) } : {}),
    ...(p.cidade ? { cidade: p.cidade } : {}),
    ...(p.telefone ? { telefone: p.telefone } : {}),
    ...(p.rural ? { rural: "1" } : {}),
    ...(p.retirada ? { retirada: "1" } : {}),
  })
  const disp = idDispositivo()
  if (disp) params.set("dispositivo", disp)
  try {
    // Token do login vai junto: o cupom de primeiro pedido confere a conta logada
    const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }) as any)
    const tk = data?.session?.access_token
    const res = await fetch(`/api/cupom/validar?${params}`, tk ? { headers: { Authorization: `Bearer ${tk}` } } : undefined)
    const json = await res.json()
    return res.ok ? { ok: true, cupom: json } : { ok: false, erro: json.error ?? "Cupom inválido." }
  } catch { return { ok: false, erro: "Não deu pra conferir o cupom agora. Tente de novo." } }
}
