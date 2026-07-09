import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"
import { Resend } from "resend"

const BASE = "https://chegodelivery.com"
const SECRET = process.env.RESET_SECRET ?? "chego-reset-secret-2024"

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function gerarToken(id: string, tipo: string): string {
  const exp = Date.now() + 60 * 60 * 1000 // 1 hora
  const payload = Buffer.from(JSON.stringify({ id, tipo, exp })).toString("base64url")
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url")
  return `${payload}.${sig}`
}

export async function POST(req: NextRequest) {
  const { email, nome, tipo } = await req.json()

  if (!email || !nome || !tipo) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  const sb = adminSb()
  const emailNorm = email.trim().toLowerCase()
  const nomeNorm  = nome.trim().toLowerCase()

  let id: string | null = null
  let emailDestino = emailNorm

  if (tipo === "lojista") {
    const { data } = await sb
      .from("lojas")
      .select("id, email, nome_responsavel, email")
      .ilike("email", emailNorm)
      .limit(1)
      .maybeSingle()

    if (data && data.nome_responsavel?.toLowerCase().includes(nomeNorm)) {
      id = data.id
      emailDestino = data.email
    }
  } else if (tipo === "motoboy") {
    const { data } = await sb
      .from("motoboys")
      .select("id, email, nome")
      .ilike("email", emailNorm)
      .limit(1)
      .maybeSingle()

    if (data && data.nome?.toLowerCase().includes(nomeNorm)) {
      id = data.id
      emailDestino = data.email
    }
  }

  // Responde igual mesmo que não encontre — evita enumeração de usuários
  if (!id) {
    return NextResponse.json({ ok: true })
  }

  const token = gerarToken(id, tipo)
  const link  = `${BASE}/redefinir-senha?token=${token}`

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  if (resend) {
    await resend.emails.send({
      from: "Chegô Delivery <noreply@chegodelivery.com>",
      to:   emailDestino,
      subject: "Redefinição de senha — Chegô Delivery",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px 24px;">
          <h2 style="color:#f97316;">Chegô Delivery</h2>
          <p>Recebemos uma solicitação para redefinir sua senha.</p>
          <p>Clique no botão abaixo para criar uma nova senha. O link expira em <strong>1 hora</strong>.</p>
          <a href="${link}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:#f97316;color:white;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">
            Redefinir senha
          </a>
          <p style="color:#9CA3AF;font-size:12px;">Se você não solicitou isso, ignore este email.</p>
        </div>
      `,
    })
  }

  return NextResponse.json({ ok: true })
}
