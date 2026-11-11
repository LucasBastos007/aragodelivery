export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Número do WhatsApp de ajuda (gravado pela rotina de configuração do Z-API).
export async function GET() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data } = await sb.from("configuracoes").select("valor").eq("chave", "whats_suporte").maybeSingle()
  return NextResponse.json({ numero: (data?.valor ?? "").replace(/\D/g, "") || null }, { headers: { "Cache-Control": "public, max-age=300" } })
}
