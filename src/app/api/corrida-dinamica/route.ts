export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { dinamicaAtiva, lerCorridaDinamica } from "@/lib/corridaDinamica"

// Público e só leitura: o app do motoboy (e o do cliente) mostra o aviso enquanto a dinâmica vale.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

// Aviso de chuva/demanda alta na tela do pedido (31/10/2026): configuracoes.aviso_chuva =
// {"ate":"<ISO>"}. Some sozinho depois do horário.
async function avisoChuva(): Promise<boolean> {
  const { data } = await sb.from("configuracoes").select("valor").eq("chave", "aviso_chuva").maybeSingle()
  try {
    const v = typeof data?.valor === "string" ? JSON.parse(data.valor) : data?.valor
    return !!v?.ate && new Date(v.ate).getTime() > Date.now()
  } catch { return false }
}

export async function GET() {
  const [d, aviso] = await Promise.all([lerCorridaDinamica(sb).catch(() => null), avisoChuva().catch(() => false)])
  return NextResponse.json(dinamicaAtiva(d) ? { ativa: true, valor: d.valor, ate: d.ate, aviso_chuva: aviso } : { ativa: false, aviso_chuva: aviso })
}
