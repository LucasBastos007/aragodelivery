export interface ViaCEPResult {
  logradouro: string
  bairro: string
  localidade: string
  uf: string
}

export async function fetchAddressByCEP(cep: string): Promise<ViaCEPResult | null> {
  const clean = cep.replace(/\D/g, "")
  if (clean.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
    const data = await res.json()
    if (data.erro) return null
    return data as ViaCEPResult
  } catch {
    return null
  }
}

export interface CNPJResult {
  razao_social: string
  nome_fantasia: string
  situacao_cadastral: string
}

export async function fetchCNPJData(cnpj: string): Promise<CNPJResult | null> {
  const clean = cnpj.replace(/\D/g, "")
  if (clean.length !== 14) return null
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`)
    if (!res.ok) return null
    return (await res.json()) as CNPJResult
  } catch {
    return null
  }
}
