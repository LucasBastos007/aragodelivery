export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"
import { validarChavePix, tipoChaveSugerido } from "@/lib/repasseLoja"

// Trocar a chave Pix pelo admin, na janela de pagar (21/10/2026, pedido do Lucas).
// Confere a chave antes de salvar. No motoboy, o campo pix_key guarda JSON {pix, banco, agencia, conta}:
// só o "pix" muda; texto antigo que não era chave (ex.: "Itaú Ag... Cc...") vira o "banco".
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const mascara = (k: string) => k.includes("@") ? k.replace(/^(.{2}).*(@.*)$/, "$1***$2") : k.length > 6 ? k.slice(0, 3) + "*".repeat(Math.max(3, k.length - 6)) + k.slice(-3) : "***"

function juntar(antigo: string | null, nova: string) {
  const s = String(antigo ?? "").trim()
  if (s.startsWith("{")) { try { const j = JSON.parse(s); return JSON.stringify({ ...j, pix: nova }) } catch {} }
  return s ? JSON.stringify({ pix: nova, banco: s }) : nova
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const { quem, id, chave, tipo_chave } = await req.json().catch(() => ({}))
  if (!["loja", "motoboy", "saque"].includes(quem) || !id) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  const v = validarChavePix(chave, tipo_chave)
  if (!v.ok) return NextResponse.json({ error: v.motivo }, { status: 422 })
  if (quem === "saque") {
    const { data: sq } = await sb.from("saques").select("id,status,motoboy_id,loja_id").eq("id", id).single()
    if (!sq || (sq as any).status !== "solicitado") return NextResponse.json({ error: "Esse saque não está mais esperando pagamento." }, { status: 409 })
    await sb.from("saques").update({ pix_chave: v.chave }).eq("id", id)
    // Salva também no cadastro de quem pediu, pra próxima vez
    if ((sq as any).motoboy_id) { const { data: m } = await sb.from("motoboys").select("pix_key").eq("id", (sq as any).motoboy_id).single(); await sb.from("motoboys").update({ pix_key: juntar((m as any)?.pix_key ?? null, v.chave) }).eq("id", (sq as any).motoboy_id) }
    if ((sq as any).loja_id) await sb.from("lojas").update({ pix_key: v.chave }).eq("id", (sq as any).loja_id)
  } else if (quem === "motoboy") {
    const { data: m, error } = await sb.from("motoboys").select("pix_key").eq("id", id).single()
    if (error || !m) return NextResponse.json({ error: "Motoboy não encontrado." }, { status: 404 })
    const { error: e2 } = await sb.from("motoboys").update({ pix_key: juntar((m as any).pix_key, v.chave) }).eq("id", id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  } else {
    const { data: l, error } = await sb.from("lojas").select("pix_key").eq("id", id).single()
    if (error || !l) return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 })
    const atual = String((l as any).pix_key ?? "")
    const { error: e2 } = await sb.from("lojas").update({ pix_key: atual.startsWith("{") ? juntar(atual, v.chave) : v.chave }).eq("id", id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, chave: mascara(v.chave), chaveTipo: { tipo: tipo_chave, certeza: true }, tipoSugerido: tipoChaveSugerido(v.chave) })
}
