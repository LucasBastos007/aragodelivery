import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSession } from "@/lib/session"
import { validateFileType } from "@/lib/magic-bytes"
import type { AllowedFileType } from "@/lib/magic-bytes"

const ALLOWED_MIME = new Set<AllowedFileType>(["image/jpeg", "image/png", "image/webp", "image/gif"])

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const sess = getSession(req)
  if (!sess || sess.role !== "admin") return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const form = await req.formData()
  const file = form.get("file") as File | null
  const lojaId = form.get("loja_id") as string | null
  const produtoId = form.get("produto_id") as string | null

  if (!file || !lojaId || !produtoId) return NextResponse.json({ error: "file, loja_id e produto_id são obrigatórios" }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Arquivo muito grande (máx. 5MB)" }, { status: 400 })

  try {
    await validateFileType(file, ALLOWED_MIME)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Tipo de arquivo não permitido" }, { status: 400 })
  }

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "")
  const safePath = `${lojaId}/${produtoId}.${ext}`

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const sb = adminClient()
  const { data, error } = await sb.storage
    .from("produtos")
    .upload(safePath, buffer, { upsert: true, contentType: file.type })

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Falha no upload" }, { status: 500 })

  const { data: { publicUrl } } = sb.storage.from("produtos").getPublicUrl(data.path)
  return NextResponse.json({ url: publicUrl })
}
