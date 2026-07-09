export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/session"

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// GET /api/admin/loja/cert?loja_id=xxx
// Retorna status do certificado (sem expor secrets)
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const loja_id = req.nextUrl.searchParams.get("loja_id")
  if (!loja_id) return NextResponse.json({ error: "loja_id obrigatório" }, { status: 400 })

  const { data, error } = await sb()
    .from("lojas")
    .select("cert_a1_path, cert_a1_expires_at, cert_a1_senha_vault_id, csc_id, csc_token_vault_id")
    .eq("id", loja_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    cert_a1_path:      data.cert_a1_path,
    cert_a1_expires_at: data.cert_a1_expires_at,
    tem_senha:         !!data.cert_a1_senha_vault_id,
    csc_id:            data.csc_id,
    tem_csc_token:     !!data.csc_token_vault_id,
  })
}

// POST /api/admin/loja/cert
// Body: { loja_id, cert_b64?, cert_password?, cert_expires?, csc_id?, csc_token? }
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { loja_id, cert_b64, cert_password, cert_expires, csc_id, csc_token } = await req.json()
  if (!loja_id) return NextResponse.json({ error: "loja_id obrigatório" }, { status: 400 })

  const client = sb()
  const update: Record<string, unknown> = {}

  // Busca dados atuais da loja para saber se já tem vault IDs
  const { data: loja } = await client
    .from("lojas")
    .select("cert_a1_senha_vault_id, csc_token_vault_id")
    .eq("id", loja_id)
    .single()

  // 1. Upload do certificado .pfx
  if (cert_b64) {
    const buf = Buffer.from(cert_b64, "base64")
    const path = `${loja_id}.pfx`
    const { error: uploadErr } = await client.storage
      .from("certificados")
      .upload(path, buf, { contentType: "application/x-pkcs12", upsert: true })
    if (uploadErr) return NextResponse.json({ error: "Erro no upload do cert: " + uploadErr.message }, { status: 500 })
    update.cert_a1_path = path
  }

  if (cert_expires) update.cert_a1_expires_at = cert_expires

  // 2. Senha do certificado → Vault
  if (cert_password) {
    if (loja?.cert_a1_senha_vault_id) {
      await client.rpc("update_vault_secret", {
        p_id:     loja.cert_a1_senha_vault_id,
        p_secret: cert_password,
      })
    } else {
      const { data: vaultId } = await client.rpc("create_vault_secret", {
        p_secret:      cert_password,
        p_name:        `cert_senha_${loja_id}`,
        p_description: "Senha certificado A1",
      })
      update.cert_a1_senha_vault_id = vaultId
    }
  }

  // 3. CSC ID (texto simples)
  if (csc_id !== undefined) update.csc_id = csc_id || null

  // 4. CSC token → Vault
  if (csc_token) {
    if (loja?.csc_token_vault_id) {
      await client.rpc("update_vault_secret", {
        p_id:     loja.csc_token_vault_id,
        p_secret: csc_token,
      })
    } else {
      const { data: vaultId } = await client.rpc("create_vault_secret", {
        p_secret:      csc_token,
        p_name:        `csc_token_${loja_id}`,
        p_description: "CSC token NFC-e",
      })
      update.csc_token_vault_id = vaultId
    }
  }

  if (Object.keys(update).length > 0) {
    const { error } = await client.from("lojas").update(update).eq("id", loja_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
