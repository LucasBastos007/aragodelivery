import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin, unauthorized } from "@/lib/session"

// Extrai o path do storage a partir de uma URL pública ou assinada do Supabase
function extractPath(value: string): string {
  const marker = "/object/public/motoboys-docs/"
  const markerSign = "/object/sign/motoboys-docs/"
  const i = value.indexOf(marker) >= 0
    ? value.indexOf(marker) + marker.length
    : value.indexOf(markerSign) >= 0
    ? value.indexOf(markerSign) + markerSign.length
    : -1
  if (i >= 0) return decodeURIComponent(value.slice(i).split("?")[0])
  return value // já é um path direto
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized()

  const { value } = await req.json()
  if (!value) return NextResponse.json({ error: "value obrigatório" }, { status: 400 })

  const path = extractPath(value)

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data, error } = await sb.storage
    .from("motoboys-docs")
    .createSignedUrl(path, 600) // 10 minutos

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Erro ao gerar URL" }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: data.signedUrl })
}
