export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { processarAvisoPagamento, type AvisoPagamento } from "@/lib/avisoPagamento"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// GET — responde 200 para o teste de ativação do Asaas
export async function GET() {
  return NextResponse.json({ received: true })
}

export async function POST(req: NextRequest) {
  // Valida token de autenticação do Asaas (header asaas-access-token)
  // SEMPRE exige o token — se não estiver configurado, rejeita com erro de servidor
  const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN
  if (!WEBHOOK_TOKEN) {
    console.error("[WEBHOOK] ASAAS_WEBHOOK_TOKEN não configurado! Configure a variável de ambiente.")
    return NextResponse.json({ error: "Webhook não configurado no servidor." }, { status: 500 })
  }
  const token = req.headers.get("asaas-access-token") ?? req.headers.get("authorization")
  if (token !== WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as AvisoPagamento | null
  return processarAvisoPagamento(adminSb(), body, "asaas")
}
