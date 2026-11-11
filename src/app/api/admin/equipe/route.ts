export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"

// Equipe e segurança (admin 2.0, 20/10/2026). Só leitura: quem entra no painel, quem recebe o
// fechamento e quantas senhas ainda estão sem embaralhar. Nunca devolve senha nem chave.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const mascarar = (e: string) => { const [u, d] = e.split("@"); return d ? `${u.slice(0, 3)}${"•".repeat(Math.max(2, u.length - 3))}@${d}` : "•••" }
const hash = (s: unknown) => /^\$2[aby]\$/.test(String(s ?? ""))

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()
  const [{ data: mbs }, { data: lojas }] = await Promise.all([sb.from("motoboys").select("nome,senha"), sb.from("lojas").select("nome,senha")])
  const dest = (process.env.FECHAMENTO_DESTINATARIOS ?? "lucasbastos1965@gmail.com,amanbpaula@gmail.com").split(",").map(s => s.trim()).filter(Boolean)
  return NextResponse.json({
    admin: process.env.ADMIN_EMAIL ? mascarar(process.env.ADMIN_EMAIL) : null,
    fechamento: dest.map(mascarar),
    senhasTexto: { motoboys: (mbs ?? []).filter((m: any) => m.senha && !hash(m.senha)).map((m: any) => m.nome), lojas: (lojas ?? []).filter((l: any) => l.senha && !hash(l.senha)).length },
    totais: { motoboys: (mbs ?? []).length, lojas: (lojas ?? []).length },
  })
}
