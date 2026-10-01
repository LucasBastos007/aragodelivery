// Seed de carga SÓ pra teste de performance do Financeiro no DEV — cria uma loja de teste
// própria (nunca mexe na loja A/B usadas nos outros testes) com N pedidos "entregue"
// fictícios, em lotes, pra medir o tempo/volume real de buscarExtratoLoja + saldo_financeiro_loja
// antes e depois da RPC. Apagar com cleanup-carga-financeiro.mjs depois.
import { createClient } from "@supabase/supabase-js"
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const N = Number(process.argv[2] ?? 1000)

const { data: loja, error } = await sb.from("lojas").insert({
  nome: "Loja Teste Carga DEV", email: "teste-carga-dev@example.com",
  senha: "x", status: "ativo", aberto: true, categoria: "Restaurante",
  endereco: "Rua Carga, 1", telefone: "62999990002",
  taxa_entrega: 5, tempo_min: 20, tempo_max: 40, comissao: 10, pix_key: "carga-dev@example.com",
}).select("id").single()
if (error) { console.error(error); process.exit(1) }
console.log("LOJA_CARGA_ID=" + loja.id)

const LOTE = 500
for (let i = 0; i < N; i += LOTE) {
  const tamanho = Math.min(LOTE, N - i)
  const linhas = Array.from({ length: tamanho }, (_, j) => {
    const idx = i + j
    return {
      codigo: `CARGA${String(idx).padStart(6, "0")}`,
      loja_id: loja.id, status: "entregue", forma_pagamento: "pix",
      subtotal: 25 + (idx % 50), taxa_entrega: 5, total: 30 + (idx % 50),
      endereco_entrega: "Rua Cliente Carga, 1", nome_cliente: `Cliente Carga ${idx}`,
      criado_em: new Date(Date.now() - idx * 60000).toISOString(),
      entregue_em: new Date(Date.now() - idx * 60000).toISOString(),
    }
  })
  const { error: e2 } = await sb.from("pedidos").insert(linhas)
  if (e2) { console.error("erro no lote", i, e2); process.exit(1) }
  console.log(`inseridos ${i + tamanho}/${N}`)
}
console.log("done")
