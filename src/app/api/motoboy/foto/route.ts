export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireMotoboy, unauthorized } from "@/lib/session"
import { validateFileType } from "@/lib/magic-bytes"
import type { AllowedFileType } from "@/lib/magic-bytes"

const ALLOWED_MIME = new Set<AllowedFileType>(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"])

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Upload da foto de perfil via admin client — mesma causa do bug em /api/motoboy/perfil
// (upload direto do navegador com a chave anon caía em RLS do bucket "entregas" e
// falhava, ou nem chegava a atualizar motoboys.foto). Bug real reportado: "não salva a
// foto".
export async function POST(req: NextRequest) {
  const sess = requireMotoboy(req)
  if (!sess) return unauthorized()

  const form = await req.formData()
  const file = form.get("file") as File | null
  if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Arquivo muito grande (máx. 10MB)" }, { status: 400 })

  try {
    await validateFileType(file, ALLOWED_MIME)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Formato não permitido. Use JPG, PNG ou WebP." }, { status: 400 })
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const path = `motoboys/${sess.motoboy_id}.${ext}`
  const bytes = await file.arrayBuffer()
  const sb = adminClient()

  const { error: uploadError } = await sb.storage.from("entregas").upload(path, Buffer.from(bytes), { upsert: true, contentType: file.type })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = sb.storage.from("entregas").getPublicUrl(path)
  const { error: updateError } = await sb.from("motoboys").update({ foto: publicUrl }).eq("id", sess.motoboy_id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ url: publicUrl })
}
