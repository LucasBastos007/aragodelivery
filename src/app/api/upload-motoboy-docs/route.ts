import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { checkRateLimit } from "@/lib/rate-limit"

const ALLOWED_KEYS = new Set(["cnhFrente", "cnhVerso", "crlv", "selfie", "selfieContrato"])
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"])

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req)
  if (limited) return limited

  const form = await req.formData()
  const file = form.get("file") as File | null
  const key  = form.get("key")  as string | null
  const slug = form.get("slug") as string | null

  if (!file || !key || !slug) {
    return NextResponse.json({ error: "file, key e slug obrigatórios" }, { status: 400 })
  }
  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 })
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Formato não permitido. Use JPG, PNG ou WebP." }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Arquivo muito grande (máx. 10MB)" }, { status: 400 })
  }

  const safeSlug = slug.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 120)
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const path = `${safeSlug}/${key}.${ext}`

  const bytes = await file.arrayBuffer()
  const { error } = await adminClient().storage
    .from("motoboys-docs")
    .upload(path, Buffer.from(bytes), { upsert: true, contentType: file.type })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ path })
}
