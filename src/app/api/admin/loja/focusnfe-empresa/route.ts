export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/session"
import { registrarEmpresa, type FocusEmpresa } from "@/lib/focusnfe"

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// POST /api/admin/loja/focusnfe-empresa
// Lê cert do Storage + senhas do Vault e registra loja no Focus NFe
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { loja_id } = await req.json()
  if (!loja_id) return NextResponse.json({ error: "loja_id obrigatório" }, { status: 400 })

  const client = sb()

  // 1. Busca dados da loja
  const { data: loja, error: lojaErr } = await client
    .from("lojas")
    .select(`
      cnpj, nome, email, telefone,
      inscricao_estadual, regime_tributario,
      logradouro, numero, complemento, bairro, cidade, estado, cep,
      cert_a1_path, cert_a1_senha_vault_id,
      csc_id, csc_token_vault_id
    `)
    .eq("id", loja_id)
    .single()

  if (lojaErr || !loja) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 })
  if (!loja.cnpj)        return NextResponse.json({ error: "CNPJ não cadastrado na loja" }, { status: 400 })
  if (!loja.cert_a1_path) return NextResponse.json({ error: "Certificado A1 não configurado" }, { status: 400 })
  if (!loja.cert_a1_senha_vault_id) return NextResponse.json({ error: "Senha do certificado não configurada" }, { status: 400 })

  // 2. Baixa o .pfx do Storage
  const { data: fileData, error: dlErr } = await client.storage
    .from("certificados")
    .download(loja.cert_a1_path)

  if (dlErr || !fileData) return NextResponse.json({ error: "Erro ao baixar certificado: " + dlErr?.message }, { status: 500 })

  const certB64 = Buffer.from(await fileData.arrayBuffer()).toString("base64")

  // 3. Lê senha do Vault
  const { data: senha, error: senhaErr } = await client.rpc("read_vault_secret", {
    p_id: loja.cert_a1_senha_vault_id,
  })
  if (senhaErr || !senha) return NextResponse.json({ error: "Erro ao ler senha do Vault" }, { status: 500 })

  // 4. Lê CSC token do Vault (opcional)
  let cscToken: string | null = null
  if (loja.csc_token_vault_id) {
    const { data: tok } = await client.rpc("read_vault_secret", { p_id: loja.csc_token_vault_id })
    cscToken = tok ?? null
  }

  // 5. Monta regime tributário
  const regimeMap: Record<string, "1" | "2" | "3"> = {
    mei: "1", simples: "1", lucro_presumido: "3", lucro_real: "3",
  }
  const regime: "1" | "2" | "3" = regimeMap[loja.regime_tributario ?? "simples"] ?? "1"

  // 6. Monta payload Focus NFe
  const empresa: FocusEmpresa = {
    cnpj:              loja.cnpj.replace(/\D/g, ""),
    nome_empresarial:  loja.nome,
    inscricao_estadual: loja.inscricao_estadual ?? "ISENTO",
    regime_tributario:  regime,
    logradouro:        loja.logradouro ?? "Rua não informada",
    numero:            loja.numero ?? "S/N",
    complemento:       loja.complemento ?? undefined,
    bairro:            loja.bairro ?? "Centro",
    municipio:         loja.cidade ?? "Aragoiânia",
    uf:                loja.estado ?? "GO",
    cep:               (loja.cep ?? "").replace(/\D/g, ""),
    telefone:          loja.telefone?.replace(/\D/g, "") ?? undefined,
    email:             loja.email ?? undefined,
    certificado_pfx:   certB64,
    certificado_senha: senha as string,
    ...(loja.csc_id && cscToken ? {
      id_csc_nfce_producao:   loja.csc_id,
      csc_nfce_producao:      cscToken,
      id_csc_nfce_homologacao: loja.csc_id,
      csc_nfce_homologacao:    cscToken,
    } : {}),
  }

  // 7. Registra na Focus NFe
  try {
    await registrarEmpresa(empresa)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "Focus NFe: " + msg }, { status: 422 })
  }

  // 8. Marca loja como cadastrada no Focus NFe
  await client.from("lojas").update({ focusnfe_cadastrado: true }).eq("id", loja_id)

  return NextResponse.json({ ok: true })
}
