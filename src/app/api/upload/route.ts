import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSession, requireLoja } from "@/lib/session"
import { validateFileType } from "@/lib/magic-bytes"
import type { AllowedFileType } from "@/lib/magic-bytes"

const ALLOWED_MIME = new Set<AllowedFileType>(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"])

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  // Somente loja autenticada pode fazer upload de imagens de produtos
  const sess = getSession(req)
  if (!sess) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  // Motoboys não podem fazer upload no bucket de lojas
  if (sess.role === "motoboy") return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const form = await req.formData()
  const file = form.get("file") as File | null
  const path = form.get("path") as string | null

  if (!file || !path) return NextResponse.json({ error: "file e path são obrigatórios" }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Arquivo muito grande (máx. 5MB)" }, { status: 400 })

  // Valida magic bytes — não confia apenas no file.type do cliente
  try {
    await validateFileType(file, ALLOWED_MIME)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Tipo de arquivo não permitido" }, { status: 400 })
  }

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
