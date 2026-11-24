// Leitura pelo servidor (24/11/2026): mesma forma { data, error } do supabase-js,
// pra trocar `supabase.from(...)` sem mexer no resto da tela. Ver src/app/api/ler/route.ts.
export async function ler<T = any>(q: string, p: Record<string, any> = {}): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const r = await fetch("/api/ler", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, p }),
    })
    const j = await r.json().catch(() => null)
    if (!r.ok || !j) return { data: null, error: { message: j?.error?.message ?? j?.error ?? `Erro ${r.status}` } }
    return { data: j.data as T, error: j.error }
  } catch (e: any) {
    return { data: null, error: { message: e?.message ?? "Sem conexão" } }
  }
}
