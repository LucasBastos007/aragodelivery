// Focus NFe API — NFC-e para lojistas do Chegô
// Docs: https://developer.focusnfe.com.br/
// Auth: Basic auth — username=API_TOKEN, password="" (vazio)

const BASE  = process.env.FOCUSNFE_BASE_URL ?? "https://homologacao.focusnfe.com.br"
const TOKEN = process.env.FOCUSNFE_API_TOKEN!

function authHeader() {
  return "Basic " + Buffer.from(`${TOKEN}:`).toString("base64")
}

async function call<T>(path: string, method = "GET", body?: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })

  const data = await res.json().catch(() => ({})) as Record<string, unknown>

  if (!res.ok) {
    const erros = data.erros as { mensagem?: string }[] | undefined
    const msg = erros?.[0]?.mensagem ?? data.mensagem ?? `Focus NFe HTTP ${res.status}`
    throw new Error(String(msg))
  }
  return data as T
}

// ── Empresa (emitente) ────────────────────────────────────────────────────────

export interface FocusEmpresa {
  cnpj: string
  nome_empresarial: string
  nome_fantasia?: string
  inscricao_estadual?: string
  regime_tributario: "1" | "2" | "3"  // 1=Simples, 2=Simples excesso, 3=Normal
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  municipio: string
  uf: string
  cep: string
  telefone?: string
  email?: string
  certificado_pfx: string   // base64
  certificado_senha: string
  csc_nfce_producao?: string
  id_csc_nfce_producao?: string
  csc_nfce_homologacao?: string
  id_csc_nfce_homologacao?: string
}

export async function registrarEmpresa(dados: FocusEmpresa) {
  const cnpj = dados.cnpj.replace(/\D/g, "")
  return call<{ cnpj: string }>(`/v2/empresas/${cnpj}`, "PUT", dados)
}

// ── NFC-e ─────────────────────────────────────────────────────────────────────

export interface FocusNfceItem {
  numero_item: number
  codigo_produto: string
  descricao: string
  cfop: string
  unidade_comercial: string
  quantidade_comercial: number
  valor_unitario_comercial: number
  valor_bruto: number
  codigo_ncm: string
  icms_origem: number
  icms_csosn?: string   // Simples Nacional (CSOSN)
  icms_cst?: string     // Regime Normal (CST)
}

export interface FocusNfce {
  cnpj_emitente: string
  ref: string
  natureza_operacao: string
  data_emissao: string   // ISO 8601 com offset: "2024-01-01T12:00:00-03:00"
  tipo_documento: 1
  finalidade_emissao: 1
  consumidor_final: 1
  presenca_comprador: 4  // 4 = entrega a domicílio
  modalidade_frete: 9    // 9 = sem frete
  local_destino: 1
  items: FocusNfceItem[]
  forma_pagamento: { forma_pagamento: string; valor_pagamento: number }[]
  cpf_destinatario?: string
  nome_destinatario?: string
}

export interface FocusNfceResult {
  status: string
  numero?: string
  serie?: string
  chave_nfe?: string
  danfe_nfce_url?: string
  xml_url?: string
  erros?: { mensagem: string }[]
}

export async function emitirNfce(dados: FocusNfce, sincrono = true): Promise<FocusNfceResult> {
  const qs = sincrono ? "?sincrono=1" : ""
  return call<FocusNfceResult>(`/v2/nfce${qs}`, "POST", dados)
}

export async function consultarNfce(ref: string): Promise<FocusNfceResult> {
  return call<FocusNfceResult>(`/v2/nfce/${ref}?completa=1`)
}
