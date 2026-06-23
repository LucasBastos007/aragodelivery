import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSession } from "@/lib/session"

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"])

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  if (!getSession(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const form = await req.formData()
  const file = form.get("file") as File | null
  const path = form.get("path") as string | null

  if (!file || !path) return NextResponse.json({ error: "file e path são obrigatórios" }, { status: 400 })
  if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: "Tipo de arquivo não permitido" }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Arquivo muito grande (máx. 5MB)" }, { status: 400 })

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "")
  // Remove acentos, caracteres especiais e espaços do path inteiro
  const cleanPath = path
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9/_.\-]/g, "_")
    .replace(/_+/g, "_")
  const safePath = cleanPath.replace(/\.[^./]+$/, `.${ext}`)

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const sb = adminClient()
  const { data, error } = await sb.storage
    .from("entregas")
    .upload(safePath, buffer, { upsert: true, contentType: file.type })

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Falha no upload" }, { status: 500 })

  const { data: { publicUrl } } = sb.storage.from("entregas").getPublicUrl(data.path)
  return NextResponse.json({ url: publicUrl })
}
