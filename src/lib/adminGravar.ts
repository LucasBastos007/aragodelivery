// Gravações das telas do admin pelo servidor (/api/admin/gravar), com a sessão de admin.
// Antes iam direto do navegador pro banco com a chave pública (20/10/2026).
async function chamar(corpo: Record<string, unknown>): Promise<{ error: string | null }> {
  const r = await fetch("/api/admin/gravar", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).catch(() => null)
  if (!r) return { error: "Sem conexão" }
  if (!r.ok) { const j = await r.json().catch(() => ({})); return { error: j.error ?? "Erro ao salvar" } }
  return { error: null }
}
export const gravarAdmin = (tabela: string, id: string, campos: Record<string, unknown>) => chamar({ tabela, acao: "atualizar", id, campos })
export const inserirAdmin = (tabela: string, campos: Record<string, unknown>) => chamar({ tabela, acao: "inserir", campos })
