import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// POST /api/contrato-loja/govbr
// Body: FormData { token, file (PDF assinado pelo Gov.br) }
export async function POST(req: NextRequest) {
  try {
    const form  = await req.formData()
    const token = form.get("token") as string | null
    const file  = form.get("file")  as File  | null

    if (!token || !file) {
      return NextResponse.json({ error: "token e file obrigatórios" }, { status: 400 })
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo muito grande (máx. 20 MB)" }, { status: 400 })
    }

    const ext = file.type === "application/pdf" ? "pdf" : "bin"
    if (ext !== "pdf") {
      return NextResponse.json({ error: "Apenas arquivos PDF são aceitos" }, { status: 400 })
    }

    const db = admin()

    const { data: loja, error: lerr } = await db
      .from("lojas")
      .select("id, nome, contrato_assinado")
      .eq("contrato_token", token)
      .single()

    if (lerr || !loja) {
      return NextResponse.json({ error: "Token inválido" }, { status: 404 })
    }
    if (loja.contrato_assinado) {
      return NextResponse.json({ error: "Contrato já assinado anteriormente" }, { status: 409 })
    }

    const path = `lojas/${loja.id}/contrato-govbr.pdf`
    const bytes = await file.arrayBuffer()

    const { error: upErr } = await db.storage
      .from("contratos")
      .upload(path, Buffer.from(bytes), { upsert: true, contentType: "application/pdf" })

    if (upErr) {
      return NextResponse.json({ error: "Erro ao salvar o PDF: " + upErr.message }, { status: 500 })
    }

    const { data: signed } = await db.storage
      .from("contratos")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5) // 5 anos

    const pdfUrl = signed?.signedUrl ?? path

    const now = new Date().toISOString()

    const { error: updErr } = await db.from("lojas").update({
      contrato_assinado:       true,
      contrato_assinado_em:    now,
      modalidade_assinatura:   "gov_br",
      contrato_pdf_url:        pdfUrl,
      status:                  "contrato_assinado",
    }).eq("id", loja.id)

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
