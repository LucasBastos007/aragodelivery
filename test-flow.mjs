/**
 * Teste automatizado do fluxo completo de pedido — 20x
 * Usa Lucas Burguer (dinheiro) para não gerar cobranças reais.
 */

const SB_URL  = "https://vgnqyalxqhgtlfbitpwx.supabase.co"
const SB_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnbnF5YWx4cWhndGxmYml0cHd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMyMDE1MSwiZXhwIjoyMDk1ODk2MTUxfQ.XnJPEqgi2lmK-UY022odfYzVSii5HHFrGt4F4mbYDMA"
const SITE    = "https://chegodelivery.com"

const LOJA_ID   = "bf828351-1ed7-4401-aabd-c72be5033834"
const PRODUTOS  = [
  { produto_id: "237d1524-0c07-4d64-b787-5d6443f40beb", quantidade: 1 }, // X-TUDO R$39.90
  { produto_id: "35f56839-6f39-4688-ae17-45f7e56b6185", quantidade: 1 }, // X-Bacon R$32.90
]

const headers = {
  "Content-Type": "application/json",
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Prefer": "return=representation",
}

async function sb(path, method = "GET", body) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

async function api(path, body) {
  const res = await fetch(`${SITE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json() }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

const ENDERECOS = [
  "Rua das Flores, 123, Centro",
  "Av. Brasil, 456, Jardim América",
  "Rua São Paulo, 789, Vila Nova",
  "Rua das Palmeiras, 321, Setor Sul",
  "Av. Goiás, 654, Centro",
]
const NOMES = ["Ana Lima", "Carlos Melo", "Fernanda Costa", "João Silva", "Maria Souza"]

async function criarPedido(i) {
  const { status, data } = await api("/api/pedido/criar", {
    loja_id:          LOJA_ID,
    items:            PRODUTOS,
    forma_pagamento:  "dinheiro",
    tipo_entrega:     "entrega",
    endereco_entrega: ENDERECOS[i % ENDERECOS.length],
    observacao:       `Teste automático #${i + 1}`,
    nome_cliente:     NOMES[i % NOMES.length],
    telefone_cliente: `(62) 9${String(90000000 + i).padStart(8, "0")}`,
    email_cliente:    null,
  })
  if (status !== 200 || !data.pedido_id) throw new Error(`criar pedido falhou: ${JSON.stringify(data)}`)
  return data.pedido_id
}

async function avancarStatus(pedidoId, status) {
  const res = await sb(
    `pedidos?id=eq.${pedidoId}`,
    "PATCH",
    { status }
  )
  return res
}

async function testarFluxo(i) {
  const inicio = Date.now()
  const log = (msg) => console.log(`  [${i + 1}] ${msg}`)

  try {
    // 1. Criar pedido (cliente)
    const pedidoId = await criarPedido(i)
    log(`✓ Pedido criado: ${pedidoId.slice(0, 8)}...`)

    // 2. Verifica que chegou como "pendente"
    const [ped] = await sb(`pedidos?id=eq.${pedidoId}&select=status,codigo`)
    if (ped.status !== "pendente") throw new Error(`status esperado pendente, veio ${ped.status}`)
    log(`✓ Status pendente — código #${ped.codigo}`)

    // 3. Lojista aceita
    await avancarStatus(pedidoId, "aceito")
    log(`✓ Aceito`)
    await sleep(100)

    // 4. Lojista inicia preparo
    await avancarStatus(pedidoId, "preparando")
    log(`✓ Preparando`)
    await sleep(100)

    // 5. Lojista marca pronto
    await avancarStatus(pedidoId, "pronto")
    log(`✓ Pronto`)
    await sleep(100)

    // 6. Simula motoboy coletou e entregou
    await avancarStatus(pedidoId, "em_rota")
    log(`✓ Em rota`)
    await sleep(100)

    await avancarStatus(pedidoId, "entregue")
    log(`✓ Entregue`)

    const ms = Date.now() - inicio
    return { ok: true, pedidoId, codigo: ped.codigo, ms }
  } catch (err) {
    return { ok: false, erro: err.message }
  }
}

async function main() {
  console.log("=== Teste de fluxo completo — 20 pedidos ===\n")

  // Abre a loja para o teste
  console.log("► Abrindo Lucas Burguer para o teste...")
  await sb(`lojas?id=eq.${LOJA_ID}`, "PATCH", { aberto: true })

  const resultados = []
  for (let i = 0; i < 20; i++) {
    console.log(`\nPedido ${i + 1}/20`)
    const r = await testarFluxo(i)
    resultados.push(r)
    await sleep(300)
  }

  // Fecha a loja após o teste
  console.log("\n► Fechando Lucas Burguer...")
  await sb(`lojas?id=eq.${LOJA_ID}`, "PATCH", { aberto: false })

  // Relatório
  const ok      = resultados.filter(r => r.ok)
  const falhos  = resultados.filter(r => !r.ok)
  const avgMs   = ok.length ? Math.round(ok.reduce((s, r) => s + r.ms, 0) / ok.length) : 0

  console.log("\n" + "═".repeat(50))
  console.log(`✅ Sucesso: ${ok.length}/20`)
  console.log(`❌ Falhas:  ${falhos.length}/20`)
  if (ok.length) console.log(`⏱  Tempo médio por pedido: ${avgMs}ms`)

  if (falhos.length) {
    console.log("\nErros encontrados:")
    falhos.forEach((r, i) => console.log(`  ${i + 1}. ${r.erro}`))
  }

  // Limpa os pedidos de teste
  console.log("\n► Limpando pedidos de teste...")
  const ids = ok.map(r => `"${r.pedidoId}"`).join(",")
  if (ids) {
    await fetch(`${SB_URL}/rest/v1/pedidos?id=in.(${ids})`, {
      method: "DELETE", headers,
    })
    console.log(`   ${ok.length} pedido(s) removidos.`)
  }

  console.log("\n✓ Teste concluído.")
}

main().catch(console.error)
