// Robô de pedidos pelo WhatsApp (pedido do Lucas, 24/10/2026). Começa só com a Petiscaria.
//
// Princípio: a IA só entende o que o cliente quer e conversa. Tudo o que é regra (loja aberta,
// item disponível, adicionais obrigatórios, preço, frete, criação do pedido, Pix) é feito aqui
// pelas mesmas funções/rotas do app. O pedido só é criado depois do cliente confirmar o resumo.
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { chaveBot, enviarTexto, zapi } from "@/lib/whatsSuporte"
import { categoriaAtivaAgora, produtoDisponivelAgora } from "@/lib/sugestaoBebidas"
import { precoAdicionais } from "@/lib/precoAdicionais"
import { calcularTaxaEntregaCompleta, EnderecoForaDoRaioError, distanciaEntregaKm } from "@/lib/frete"
import { freteGratisAtivo, freteGratisElegivel } from "@/lib/freteGratisCampanha"
import { acrescimoDinamico } from "@/lib/corridaDinamica"

const SITE = () => process.env.ROBO_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://chegodelivery.com"
const MODELO = () => process.env.ROBO_MODELO ?? "google/gemini-2.5-flash"
const MODELO_AUDIO = () => process.env.ROBO_MODELO_AUDIO ?? "google/gemini-2.5-flash"
const sbAdmin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const r2 = (v: number) => Math.round(v * 100) / 100

export type Config = { ativo: boolean; lojas: string[]; so_numeros: string[]; atendente?: string | null; abrir_no_whats: string[] }
// Loja fechada no app mas aberta só pro robô (teste do fluxo): ids em robo_pedidos.abrir_no_whats
const abertaRobo = (l: { id: string; aberto: boolean }, cfg: Config) => !!l.aberto || cfg.abrir_no_whats.includes(l.id)
export async function lerConfig(sb: SupabaseClient): Promise<Config> {
  const { data } = await sb.from("configuracoes").select("chave, valor").in("chave", ["robo_pedidos", "whats_atendente"])
  const m = new Map((data ?? []).map((x: any) => [x.chave, x.valor]))
  let c: any = {}
  try { c = JSON.parse(m.get("robo_pedidos") ?? "{}") } catch { /* vazio */ }
  return { ativo: !!c.ativo, lojas: c.lojas ?? [], so_numeros: (c.so_numeros ?? []).map((n: string) => n.replace(/\D/g, "").slice(-8)), atendente: m.get("whats_atendente") ?? null, abrir_no_whats: c.abrir_no_whats ?? [] }
}

type Item = { produto_id: string; nome: string; quantidade: number; preco_unit: number; adicionais: { id: string; nome: string; preco: number; grupo: string }[]; observacao?: string }
type Conversa = {
  telefone: string; cliente_id: string | null; nome: string | null; loja_id: string | null; sacola: Item[]
  numeracao: Record<string, string>; pendente: { turno?: number; resumo_turno?: number; resumo_total?: number; cancelar?: string; cancelar_turno?: number }; endereco: any; localizacao: any; historico: { r: "u" | "a"; t: string }[]; pausado_ate: string | null; ultimo_pedido_id: string | null
}

// ---------- Z-API: envio de mídia ----------
async function enviarImagem(tel: string, url: string, legenda?: string) {
  return zapi("send-image", "POST", { phone: tel, image: url, caption: legenda ?? "" })
}

// ---------- IA (Vercel AI Gateway; no servidor da Vercel autentica sozinho por OIDC) ----------
function chaveIA() { return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || "" }
async function chamarIA(body: object, tentativa = 0): Promise<any> {
  const r = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${chaveIA()}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  // Limite por minuto ou instabilidade: espera um pouco e tenta de novo (2x)
  if ((r.status === 429 || r.status >= 500) && tentativa < 2) {
    await new Promise(ok => setTimeout(ok, (tentativa + 1) * 7000))
    return chamarIA(body, tentativa + 1)
  }
  if (!r.ok) throw new Error(`IA HTTP ${r.status}: ${JSON.stringify(j).slice(0, 200)}`)
  return j
}
export async function transcreverAudio(url: string, mime?: string): Promise<string> {
  const a = await fetch(url); if (!a.ok) throw new Error("áudio indisponível")
  const buf = Buffer.from(await a.arrayBuffer())
  const tipo = (mime || a.headers.get("content-type") || "audio/ogg").split(";")[0]
  const j = await chamarIA({ model: MODELO_AUDIO(), messages: [{ role: "user", content: [
    { type: "text", text: "Transcreva exatamente este áudio em português do Brasil. Responda só com a transcrição, sem comentários." },
    { type: "file", file: { data: buf.toString("base64"), media_type: tipo, filename: "audio" } },
  ] }] })
  return String(j.choices?.[0]?.message?.content ?? "").trim()
}

// ---------- Dados da loja ----------
export async function cardapio(sb: SupabaseClient, lojaId: string) {
  const [{ data: cats }, { data: prods }] = await Promise.all([
    sb.from("categorias_produto").select("id, nome, ordem, cardapio_do_dia, horario_inicio, horario_fim, dias_semana, vitrine").eq("loja_id", lojaId).order("ordem"),
    sb.from("produtos").select("id, nome, descricao, preco, foto_url, disponivel, categoria_id, adicionais, dias_semana, ncm, ordem").eq("loja_id", lojaId).eq("disponivel", true),
  ])
  const C = new Map((cats ?? []).map((c: any) => [c.id, c]))
  const lista = (prods ?? []).filter((p: any) => produtoDisponivelAgora(p as any)).map((p: any) => {
    const c: any = C.get(p.categoria_id)
    const ativa = c ? categoriaAtivaAgora(c) : true
    return { ...p, categoria: c?.nome ?? "Outros", cat_ordem: c?.ordem ?? 999, ativa, horario: c?.cardapio_do_dia && !ativa ? `${c.horario_inicio ?? ""}–${c.horario_fim ?? ""}` : null }
  })
  lista.sort((a: any, b: any) => a.cat_ordem - b.cat_ordem || (a.ordem ?? 999) - (b.ordem ?? 999) || Number(a.preco) - Number(b.preco))
  return lista as any[]
}
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

async function maisPedidos(sb: SupabaseClient, lojaId: string, itens: Awaited<ReturnType<typeof cardapio>>) {
  const { data: top } = await sb.rpc("robo_mais_pedidos", { p_loja: lojaId, p_limite: 4 }).then(r => r, () => ({ data: null }))
  const topIds: string[] = (top ?? []).map((x: any) => x.produto_id)
  return (topIds.length ? topIds.map(id => itens.find(p => p.id === id)) : itens.filter(p => p.foto_url && p.ativa).slice(0, 4)).filter((p): p is NonNullable<typeof p> => !!p).slice(0, 4)
}

// ---------- Ferramentas que a IA pode usar ----------
const FERRAMENTAS = [
  { type: "function", function: { name: "lojas_abertas", description: "Lista as lojas que atendem pelo WhatsApp e se estão abertas agora.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "escolher_loja", description: "Escolhe a loja do pedido. Não envia nada ao cliente: devolve as categorias do cardápio e os mais pedidos, pra você perguntar o que ele está com vontade.", parameters: { type: "object", properties: { loja_id: { type: "string" } }, required: ["loja_id"] } } },
  { type: "function", function: { name: "info_loja", description: "Dados da loja escolhida (ou da loja_id informada): endereço para retirada, tempo médio de entrega, pedido mínimo, se aceita retirada/entrega, nota e descrição (ex.: dia de promoção).", parameters: { type: "object", properties: { loja_id: { type: "string" } } } } },
  { type: "function", function: { name: "mostrar_cardapio", description: "Envia ao cliente fotos e preços. Com categoria: só os itens daquela categoria (ex.: pastéis). Com mais_pedidos=true: fotos dos mais pedidos da loja. Sem nada: a imagem do cardápio completo numerado (só se o cliente pedir o cardápio todo ou não souber o que quer).", parameters: { type: "object", properties: { categoria: { type: "string" }, mais_pedidos: { type: "boolean" } } } } },
  { type: "function", function: { name: "buscar_produtos", description: "Procura no cardápio da loja escolhida por nome ou pelo número do cardápio. Devolve preço, se está disponível agora e os grupos de adicionais (obrigatórios e opcionais).", parameters: { type: "object", properties: { termo: { type: "string", description: "nome, parte do nome ou número do item no cardápio" } }, required: ["termo"] } } },
  { type: "function", function: { name: "adicionar_item", description: "Coloca um item na sacola. Se faltar adicional obrigatório, devolve o que falta para você perguntar ao cliente.", parameters: { type: "object", properties: { produto_id: { type: "string" }, quantidade: { type: "integer", minimum: 1 }, adicionais: { type: "array", items: { type: "object", properties: { grupo_id: { type: "string" }, item_id: { type: "string" } }, required: ["grupo_id", "item_id"] } }, observacao: { type: "string" } }, required: ["produto_id", "quantidade"] } } },
  { type: "function", function: { name: "alterar_sacola", description: "Remove um item (quantidade 0) ou muda a quantidade, pelo número do item na sacola (1, 2, 3...).", parameters: { type: "object", properties: { posicao: { type: "integer", minimum: 1 }, quantidade: { type: "integer", minimum: 0 } }, required: ["posicao", "quantidade"] } } },
  { type: "function", function: { name: "ver_sacola", description: "Mostra os itens da sacola e o subtotal.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "definir_entrega", description: "Define entrega ou retirada. Para entrega, usa a localização que o cliente mandou pelo WhatsApp (se mandou) ou o endereço digitado. Calcula a taxa de entrega.", parameters: { type: "object", properties: { tipo: { type: "string", enum: ["entrega", "retirada"] }, rua: { type: "string" }, numero: { type: "string" }, bairro: { type: "string" }, complemento: { type: "string" }, referencia: { type: "string" }, usar_endereco_salvo: { type: "boolean" } }, required: ["tipo"] } } },
  { type: "function", function: { name: "resumo", description: "Monta o resumo final com itens, entrega e total calculado pelo sistema. Mostre exatamente este resumo ao cliente e peça a confirmação.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "finalizar_pedido", description: "Cria o pedido. Só use depois que o cliente viu o resumo e confirmou com clareza (ex.: 'confirmo', 'pode mandar').", parameters: { type: "object", properties: { cliente_confirmou: { type: "boolean" }, pagamento: { type: "string", enum: ["pix", "dinheiro", "cartao_credito", "cartao_debito"] }, troco_para: { type: "number", description: "só para dinheiro; valor da nota se precisar de troco" } }, required: ["cliente_confirmou", "pagamento"] } } },
  { type: "function", function: { name: "meus_pedidos", description: "Lista os pedidos recentes deste número (últimos 3 dias) com código, loja, status, total, forma de pagamento e previsão de entrega. Use quando o cliente perguntar do pedido, da demora, da previsão, quiser cancelar, reclamar ou pedir estorno.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "cancelar_pedido", description: "Cancela um pedido do cliente. Só é possível antes de a loja aceitar (esperando pagamento ou esperando a loja). Se já tiver sido pago por Pix, o estorno sai sozinho. Confirme com o cliente antes.", parameters: { type: "object", properties: { codigo: { type: "string" }, cliente_confirmou: { type: "boolean" }, motivo: { type: "string" } }, required: ["codigo", "cliente_confirmou"] } } },
  { type: "function", function: { name: "pedir_estorno", description: "Registra um pedido de reembolso para o financeiro analisar (item faltando, errado, pedido não chegou, cobrança indevida). Só para pedidos pagos por Pix ou cartão online. Dinheiro e maquininha: chame o atendente.", parameters: { type: "object", properties: { codigo: { type: "string" }, motivo: { type: "string", enum: ["item_faltando", "item_errado", "pedido_nao_chegou", "qualidade", "cobranca_indevida", "outro"] }, descricao: { type: "string" }, valor: { type: "number", description: "valor que o cliente quer de volta, se for parcial" } }, required: ["codigo", "motivo", "descricao"] } } },
  { type: "function", function: { name: "avaliar_pedido", description: "Registra a nota de 1 a 5 de um pedido entregue (e comentário, se houver).", parameters: { type: "object", properties: { codigo: { type: "string" }, nota: { type: "integer", minimum: 1, maximum: 5 }, comentario: { type: "string" } }, required: ["codigo", "nota"] } } },
  { type: "function", function: { name: "salvar_nome", description: "Guarda o nome do cliente (primeira vez).", parameters: { type: "object", properties: { nome: { type: "string" } }, required: ["nome"] } } },
  { type: "function", function: { name: "chamar_atendente", description: "Passa a conversa para um atendente humano (cliente pediu, reclamação, algo que você não consegue resolver).", parameters: { type: "object", properties: { motivo: { type: "string" } }, required: ["motivo"] } } },
]

function sacolaTexto(c: Conversa) {
  if (!c.sacola.length) return { texto: "Sacola vazia.", subtotal: 0 }
  let sub = 0
  const linhas = c.sacola.map((i, k) => {
    const v = r2(i.preco_unit * i.quantidade)
    sub += v
    const ad = i.adicionais.length ? ` (${i.adicionais.map(a => a.nome).join(", ")})` : ""
    return `${k + 1}. ${i.quantidade}x ${i.nome}${ad}: ${brl(v)}`
  })
  return { texto: linhas.join("\n") + `\nSubtotal: ${brl(sub)}`, subtotal: r2(sub) }
}

async function executar(sb: SupabaseClient, cfg: Config, c: Conversa, nome: string, args: any, saida: { midia: { url: string; legenda?: string }[] }): Promise<any> {
  switch (nome) {
    case "lojas_abertas": {
      const { data } = await sb.from("lojas").select("id, nome, aberto, status, horarios").in("id", cfg.lojas)
      return (data ?? []).filter((l: any) => l.status === "ativo").map((l: any) => ({ loja_id: l.id, nome: l.nome, aberta_agora: abertaRobo(l, cfg) }))
    }
    case "escolher_loja": {
      if (!cfg.lojas.includes(args.loja_id)) return { erro: "Essa loja ainda não atende pelo WhatsApp." }
      const { data: l } = await sb.from("lojas").select("id, nome, aberto, logo_url").eq("id", args.loja_id).maybeSingle()
      if (!l) return { erro: "Loja não encontrada." }
      if (!abertaRobo(l, cfg)) return { erro: `A ${l.nome} está fechada agora. Ofereça avisar quando abrir ou outra loja.` }
      if (c.loja_id !== l.id) { c.sacola = []; c.loja_id = l.id }
      const itens = await cardapio(sb, l.id)
      c.numeracao = Object.fromEntries(itens.map((p, i) => [String(i + 1), p.id]))
      const cats = new Map<string, { itens: number; agora: number }>()
      for (const p of itens) { const x = cats.get(p.categoria) ?? { itens: 0, agora: 0 }; x.itens++; if (p.ativa) x.agora++; cats.set(p.categoria, x) }
      const destaques = await maisPedidos(sb, l.id, itens)
      return { ok: true, loja: l.nome, categorias: [...cats].map(([nome, x]) => ({ nome, itens: x.itens, disponivel_agora: x.agora > 0 })), mais_pedidos: destaques.map(p => p.nome) }
    }
    case "info_loja": {
      const id = args.loja_id || c.loja_id
      if (!id || !cfg.lojas.includes(id)) return { erro: "Escolha a loja primeiro." }
      const { data: l } = await sb.from("lojas").select("nome, descricao, logradouro, numero, bairro, cidade, tempo_min, tempo_max, valor_minimo, aceita_retirada, aceita_entrega, nota_media, total_avaliacoes").eq("id", id).maybeSingle()
      if (!l) return { erro: "Loja não encontrada." }
      return { nome: l.nome, descricao: l.descricao, endereco_para_retirada: [l.logradouro && `${l.logradouro}${l.numero ? `, ${l.numero}` : ""}`, l.bairro, l.cidade].filter(Boolean).join(", "), tempo_entrega: l.tempo_min && l.tempo_max ? `${l.tempo_min} a ${l.tempo_max} minutos` : null, pedido_minimo: Number(l.valor_minimo) || 0, aceita_retirada: !!l.aceita_retirada, aceita_entrega: l.aceita_entrega !== false, nota: l.nota_media ? `${l.nota_media} (${l.total_avaliacoes} avaliações)` : null }
    }
    case "mostrar_cardapio": {
      if (!c.loja_id) return { erro: "Escolha a loja primeiro." }
      const itens = await cardapio(sb, c.loja_id)
      const numero = (id: string) => Object.entries(c.numeracao).find(([, v]) => v === id)?.[0]
      const legenda = (p: any) => `${numero(p.id) ? `${numero(p.id)}. ` : ""}*${p.nome}*\n${brl(Number(p.preco))}${p.descricao ? `\n${String(p.descricao).slice(0, 140)}` : ""}`
      if (args.mais_pedidos) {
        const destaques = await maisPedidos(sb, c.loja_id, itens)
        for (const p of destaques.filter(p => p.foto_url)) saida.midia.push({ url: p.foto_url, legenda: legenda(p) })
        return { enviado: "fotos dos mais pedidos", itens: destaques.map(p => ({ numero: numero(p.id), nome: p.nome, preco: Number(p.preco) })) }
      }
      if (args.categoria) {
        const q = norm(String(args.categoria))
        const daCat = itens.filter(p => norm(p.categoria).includes(q) || q.includes(norm(p.categoria)) || norm(p.nome).includes(q))
        if (!daCat.length) return { erro: "Não achei essa categoria.", categorias: [...new Set(itens.map(p => p.categoria))] }
        for (const p of daCat.filter(p => p.foto_url && p.ativa).slice(0, 6)) saida.midia.push({ url: p.foto_url, legenda: legenda(p) })
        return { enviado: "fotos dos itens dessa categoria (até 6)", itens: daCat.map(p => ({ numero: numero(p.id), nome: p.nome, preco: Number(p.preco), disponivel_agora: p.ativa, tem_foto: !!p.foto_url })) }
      }
      const { data: l } = await sb.from("lojas").select("nome").eq("id", c.loja_id).maybeSingle()
      const paginas = Math.ceil(itens.length / 14)
      for (let pg = 1; pg <= paginas; pg++) saida.midia.push({ url: `${SITE()}/api/whats/cardapio/${c.loja_id}?p=${pg}&v=${Date.now() % 100000}`, legenda: pg === 1 ? `Cardápio da ${l?.nome ?? "loja"}${paginas > 1 ? ` (${pg}/${paginas})` : ""}. Responda com o número do item ou o nome.` : `(${pg}/${paginas})` })
      return { enviado: "cardápio completo numerado" }
    }
    case "buscar_produtos": {
      if (!c.loja_id) return { erro: "Escolha a loja primeiro." }
      const itens = await cardapio(sb, c.loja_id)
      const t = String(args.termo ?? "").trim()
      const porNumero = c.numeracao[t.replace(/\D/g, "")] && /^\D*\d+\D*$/.test(t) ? itens.filter(p => p.id === c.numeracao[t.replace(/\D/g, "")]) : []
      const palavras = norm(t).split(/\s+/).filter(w => w.length > 1)
      const achados = porNumero.length ? porNumero : itens.filter(p => palavras.every(w => norm(`${p.nome} ${p.descricao ?? ""} ${p.categoria}`).includes(w))).slice(0, 8)
      return achados.map(p => ({
        produto_id: p.id, numero: Object.entries(c.numeracao).find(([, v]) => v === p.id)?.[0], nome: p.nome, preco: Number(p.preco), categoria: p.categoria,
        disponivel_agora: p.ativa, ...(p.ativa ? {} : { horario: p.horario }),
        grupos: (p.adicionais ?? []).filter((g: any) => Array.isArray(g.itens)).map((g: any) => ({ grupo_id: g.id, nome: g.nome, obrigatorio: !!g.obrigatorio || Number(g.minimo) > 0, minimo: Number(g.minimo) || (g.obrigatorio ? 1 : 0), maximo: Number(g.maximo) || null, opcoes: g.itens.map((x: any) => ({ item_id: x.id, nome: x.nome, preco: Number(x.preco) || 0 })) })),
      }))
    }
    case "adicionar_item": {
      if (!c.loja_id) return { erro: "Escolha a loja primeiro." }
      const { data: p } = await sb.from("produtos").select("id, nome, preco, adicionais, disponivel, loja_id, categoria_id").eq("id", args.produto_id).maybeSingle()
      if (!p || p.loja_id !== c.loja_id || !p.disponivel) return { erro: "Produto não encontrado ou indisponível." }
      const itens = await cardapio(sb, c.loja_id)
      const info = itens.find(x => x.id === p.id)
      if (!info) return { erro: "Produto indisponível agora." }
      if (!info.ativa) return { erro: `Esse item só sai no horário ${info.horario}.` }
      const grupos = ((p.adicionais ?? []) as any[]).filter(g => Array.isArray(g.itens))
      const escolhidos: Item["adicionais"] = []
      for (const a of (args.adicionais ?? []) as any[]) {
        const g = grupos.find(x => x.id === a.grupo_id); const it = g?.itens.find((x: any) => x.id === a.item_id)
        if (!g || !it) return { erro: `Adicional inválido: ${a.grupo_id}/${a.item_id}. Use buscar_produtos para ver as opções.` }
        escolhidos.push({ id: it.id, nome: it.nome, preco: Number(it.preco) || 0, grupo: g.id })
      }
      const faltando = []
      for (const g of grupos) {
        const n = escolhidos.filter(e => e.grupo === g.id).length
        const min = Math.max(g.obrigatorio ? 1 : 0, Number(g.minimo) || 0), max = Number(g.maximo) || Infinity
        if (n < min) faltando.push({ grupo_id: g.id, nome: g.nome, escolher_no_minimo: min, opcoes: g.itens.map((x: any) => x.nome) })
        if (n > max) return { erro: `No grupo "${g.nome}" dá para escolher no máximo ${max}.` }
      }
      if (faltando.length) return { falta_escolher: faltando }
      const unit = r2(Number(p.preco) + precoAdicionais(p.adicionais, escolhidos))
      c.sacola.push({ produto_id: p.id, nome: p.nome, quantidade: Math.max(1, Math.min(50, Number(args.quantidade) || 1)), preco_unit: unit, adicionais: escolhidos, observacao: args.observacao || "" })
      return { ok: true, sacola: sacolaTexto(c).texto }
    }
    case "alterar_sacola": {
      const i = Number(args.posicao) - 1
      if (!c.sacola[i]) return { erro: "Item não está na sacola." }
      if (Number(args.quantidade) <= 0) c.sacola.splice(i, 1); else c.sacola[i].quantidade = Math.min(50, Number(args.quantidade))
      return { ok: true, sacola: sacolaTexto(c).texto }
    }
    case "ver_sacola": return { sacola: sacolaTexto(c).texto }
    case "definir_entrega": {
      if (!c.loja_id) return { erro: "Escolha a loja primeiro." }
      const { data: l } = await sb.from("lojas").select("id, lat, lng, cidade, taxa_entrega, aceita_retirada, nome").eq("id", c.loja_id).maybeSingle()
      if (args.tipo === "retirada") {
        if (!l?.aceita_retirada) return { erro: "Essa loja não aceita retirada." }
        c.endereco = { tipo: "retirada" }; return { ok: true, tipo: "retirada", taxa: 0 }
      }
      let lat: number | null = null, lng: number | null = null, rua = args.rua, bairro = args.bairro, numero = args.numero, cidade = l?.cidade ?? ""
      if (args.usar_endereco_salvo && c.endereco?.lat) ({ lat, lng, rua, bairro, numero, cidade } = { ...c.endereco, rua: rua || c.endereco.rua, numero: numero || c.endereco.numero })
      else if (c.localizacao?.lat && !rua) {
        lat = c.localizacao.lat; lng = c.localizacao.lng
        const rev = await fetch(`${SITE()}/api/geocode/reverse?lat=${lat}&lon=${lng}`).then(r => r.json()).catch(() => ({}))
        rua = rev?.address?.road ?? ""; bairro = bairro || rev?.address?.suburb || rev?.address?.neighbourhood || ""; cidade = rev?.address?.city || rev?.address?.town || cidade
      } else if (rua && c.localizacao?.lat) {
        lat = c.localizacao.lat; lng = c.localizacao.lng
      } else if (rua) {
        const q = [rua, numero, bairro, cidade].filter(Boolean).join(", ")
        const res = await fetch(`${SITE()}/api/geocode/search?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => [])
        const a = Array.isArray(res) ? res[0] : null
        if (a) { lat = Number(a.lat); lng = Number(a.lon ?? a.lng) }
        if (!lat && c.localizacao?.lat) { lat = c.localizacao.lat; lng = c.localizacao.lng }
      }
      if (lat && rua && !numero) return { localizacao_ok: true, rua_encontrada: rua, bairro_encontrado: bairro || null, falta: "Peça só o número da casa (ou S/N), o bairro se não veio e um ponto de referência. Depois chame definir_entrega de novo com rua, numero, bairro e referencia." }
      if (!rua || !numero) return { erro: "Falta a rua e o número (ou S/N). Peça também bairro e um ponto de referência. Se preferir, o cliente pode mandar a localização pelo WhatsApp." }
      if (!lat || !lng) return { erro: "Não achei esse endereço no mapa. Peça para o cliente mandar a localização pelo WhatsApp (clipe > Localização)." }
      try {
        const det: { distancia_km?: number | null } = {}
        const taxaCheia = await calcularTaxaEntregaCompleta(sb, { loja_id: c.loja_id, loja_lat: l?.lat ?? null, loja_lng: l?.lng ?? null, loja_taxa_base: l?.taxa_entrega ?? null, tipo_entrega: "entrega", lat_entrega: lat, lng_entrega: lng, cidade_entrega: cidade, bairro_entrega: bairro, cliente_id: c.cliente_id }, det)
        // Frete grátis do aniversário de Aragoiânia (lib/freteGratisCampanha): mesma regra do /api/pedido/criar
        const gratis = taxaCheia > 0 && freteGratisAtivo() && freteGratisElegivel({ distanciaKm: det.distancia_km ?? await distanciaEntregaKm(l?.lat ?? null, l?.lng ?? null, lat, lng), lojaLat: l?.lat, lojaLng: l?.lng, latEntrega: lat, lngEntrega: lng })
        const taxa = gratis ? 0 : taxaCheia
        c.endereco = { tipo: "entrega", rua, numero, bairro, complemento: args.complemento || "", referencia: args.referencia || c.endereco?.referencia || "", cidade, lat, lng, taxa }
        return { ok: true, endereco: `${rua}, ${numero}${bairro ? `, ${bairro}` : ""}${args.complemento ? `, ${args.complemento}` : ""}`, taxa_entrega: taxa, ...(gratis ? { frete_gratis: "Frete grátis: aniversário de Aragoiânia, pago pelo Chegô" } : {}), falta_referencia: !c.endereco.referencia }
      } catch (e) {
        if (e instanceof EnderecoForaDoRaioError) return { erro: "Esse endereço fica fora da área de entrega da loja. Ofereça retirada no balcão." }
        throw e
      }
    }
    case "resumo": {
      if (!c.sacola.length) return { erro: "Sacola vazia." }
      if (!c.endereco) return { erro: "Falta definir entrega ou retirada." }
      const s = sacolaTexto(c), taxa = c.endereco.tipo === "retirada" ? 0 : Number(c.endereco.taxa ?? 0)
      const { data: lm } = await sb.from("lojas").select("valor_minimo").eq("id", c.loja_id).maybeSingle()
      const minimo = Number(lm?.valor_minimo) || 0
      if (s.subtotal < minimo) return { erro: `O pedido mínimo da loja é ${brl(minimo)} em produtos (sem a entrega). Faltam ${brl(minimo - s.subtotal)}. Sugira completar com algo.` }
      // Corrida dinâmica (chuva): mesma regra do /api/pedido/criar, linha própria no resumo
      const din = await acrescimoDinamico(sb, c.endereco.tipo)
      c.pendente = { ...c.pendente, resumo_turno: c.pendente.turno ?? 0, resumo_total: r2(s.subtotal + taxa + din) }
      return { resumo: `${s.texto}\n${c.endereco.tipo === "retirada" ? "Retirada no balcão" : `Entrega: ${brl(taxa)}${din > 0 ? `\nCorrida dinâmica (chuva): + ${brl(din)}` : ""}\nEndereço: ${c.endereco.rua}, ${c.endereco.numero}${c.endereco.bairro ? `, ${c.endereco.bairro}` : ""}${c.endereco.referencia ? ` (ref.: ${c.endereco.referencia})` : ""}`}\n*Total: ${brl(s.subtotal + taxa + din)}*`, total: r2(s.subtotal + taxa + din), corrida_dinamica: din > 0 ? `Está chovendo: cada entrega tem + ${brl(din)} que vai todo pro entregador.` : undefined, formas: ["Pix", "Dinheiro", "Cartão de crédito na entrega", "Cartão de débito na entrega"] }
    }
    case "finalizar_pedido": {
      if (!args.cliente_confirmou) return { erro: "Mostre o resumo e espere o cliente confirmar." }
      if (!c.sacola.length || !c.endereco || !c.loja_id) return { erro: "Falta sacola, entrega ou loja." }
      // Trava: o cliente precisa ter visto o resumo numa mensagem ANTERIOR e o total não pode ter mudado
      const totalAgora = r2(sacolaTexto(c).subtotal + (c.endereco.tipo === "retirada" ? 0 : Number(c.endereco.taxa ?? 0)) + await acrescimoDinamico(sb, c.endereco.tipo))
      if (c.pendente.resumo_turno == null || c.pendente.resumo_turno >= (c.pendente.turno ?? 0) || c.pendente.resumo_total !== totalAgora) return { erro: "Chame resumo, mostre ao cliente e espere ele confirmar na próxima mensagem." }
      if (!c.nome) return { erro: "Pergunte o nome do cliente antes." }
      const { data: aberta } = await sb.from("whats_pedidos").select("pedido_id, pedidos!inner(status)").eq("telefone", c.telefone).eq("pedidos.status", "aguardando_pagamento")
      if ((aberta ?? []).length) return { erro: "Já existe um pedido esperando pagamento neste número. Peça para pagar ou cancelar antes." }
      if (!c.cliente_id) {
        const ins = await sb.from("clientes").insert({ nome: c.nome, telefone: c.telefone.slice(-11) }).select("id").single()
        c.cliente_id = ins.data?.id ?? null
      }
      const pag = args.pagamento as string
      const forma = pag === "pix" ? "pix" : pag === "dinheiro" ? "dinheiro" : "maquininha"
      const e = c.endereco
      const enderecoTxt = e.tipo === "retirada" ? "Retirada na loja" : [`${e.rua}, ${e.numero}`, e.bairro, e.complemento, e.referencia ? `Ref: ${e.referencia}` : ""].filter(Boolean).join(" — ")
      const obs = ["Pedido pelo WhatsApp (robô)", forma === "maquininha" ? `💳 Maquininha: ${pag === "cartao_debito" ? "Débito" : "Crédito"}` : "", ...c.sacola.filter(i => i.observacao).map(i => `${i.nome}: ${i.observacao}`)].filter(Boolean).join(" | ")
      const res = await fetch(`${SITE()}/api/pedido/criar`, { method: "POST", headers: { "Content-Type": "application/json", "x-robo-chave": chaveBot() }, body: JSON.stringify({
        loja_id: c.loja_id, cliente_id: c.cliente_id,
        items: c.sacola.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade, observacao: i.observacao ?? "", adicionais: i.adicionais.map(a => ({ id: a.id, nome: a.nome, preco: a.preco })) })),
        forma_pagamento: forma, tipo_entrega: e.tipo, endereco_entrega: enderecoTxt, lat_entrega: e.lat ?? null, lng_entrega: e.lng ?? null, cidade_entrega: e.cidade ?? "", bairro_entrega: e.bairro ?? "",
        observacao: obs, troco_para: pag === "dinheiro" && args.troco_para ? Number(args.troco_para) : null, nome_cliente: c.nome, telefone_cliente: c.telefone.slice(-11),
      }) }).then(r => r.json()).catch(() => ({ error: "Falha ao criar o pedido." }))
      if (res.error || !res.pedido_id) return { erro: res.error ?? "Não foi possível criar o pedido." }
      await sb.from("whats_pedidos").insert({ pedido_id: res.pedido_id, telefone: c.telefone, ultimo_status: forma === "pix" ? "aguardando_pagamento" : "pendente" })
      c.ultimo_pedido_id = res.pedido_id
      // Salva o endereço no cadastro para a próxima vez
      if (e.tipo === "entrega" && c.cliente_id) await sb.from("clientes").update({ endereco_rua: e.rua, endereco_numero: e.numero, endereco_bairro: e.bairro, endereco_complemento: e.complemento, endereco_cidade: e.cidade, endereco_lat: e.lat, endereco_lng: e.lng }).eq("id", c.cliente_id)
      c.sacola = []
      if (forma === "pix") {
        const pix = await fetch(`${SITE()}/api/pagamento/pix`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedido_id: res.pedido_id, nome: c.nome, telefone: c.telefone.slice(-11), loja_id: c.loja_id }) }).then(r => r.json()).catch(() => ({}))
        if (!pix.copia_cola) return { ok: true, codigo: res.codigo, total: res.total, erro_pix: "Não consegui gerar o Pix. Chame o atendente." }
        return { ok: true, codigo: res.codigo, total: res.total, pix_copia_cola_enviar_em_mensagem_separada: pix.copia_cola }
      }
      return { ok: true, codigo: res.codigo, total: res.total, pagamento: pag }
    }
    case "meus_pedidos": {
      const ps = await pedidosDoNumero(sb, c.telefone)
      const agoraMs = Date.now()
      const hora = (d: string | Date | null) => d ? new Date(d).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : null
      const minDesde = (d: string | null) => d ? Math.round((agoraMs - new Date(d).getTime()) / 60000) : null
      return ps.map((p: any) => {
        const retirada = /retirada/i.test(p.endereco_entrega ?? "")
        const tMin = Number(p.loja?.tempo_min) || 30, tMax = Number(p.loja?.tempo_max) || 45
        // Previsão: a gravada no pedido; senão, a partir de quando a loja aceitou (ou fez o pedido) + tempo médio da loja
        const base = p.aceito_em ?? p.criado_em
        const prevIni = p.previsao_entrega_em ? null : new Date(new Date(base).getTime() + tMin * 60000)
        const prevFim = p.previsao_entrega_em ? new Date(p.previsao_entrega_em) : new Date(new Date(base).getTime() + tMax * 60000)
        const ativo = !["entregue", "cancelado", "recusado"].includes(p.status)
        const atraso = ativo && p.status !== "aguardando_pagamento" ? Math.round((agoraMs - prevFim.getTime()) / 60000) : 0
        return {
          codigo: p.codigo, loja: p.loja?.nome, etapa: STATUS_NOME[p.status] ?? p.status, o_que_esta_acontecendo: ETAPA_EXPLICA[p.status] ?? null,
          total: Number(p.total), pagamento: p.forma_pagamento, retirada,
          feito_as: hora(p.criado_em), feito_ha_minutos: minDesde(p.criado_em),
          linha_do_tempo: { loja_aceitou: hora(p.aceito_em), ficou_pronto: hora(p.pronto_em), saiu_para_entrega: hora(p.coletado_em), entregue: hora(p.entregue_em), cancelado: hora(p.cancelado_em) },
          ...(ativo && p.status !== "aguardando_pagamento" ? { previsao: retirada ? `pronto entre ${hora(prevIni ?? prevFim)} e ${hora(prevFim)}` : prevIni ? `entre ${hora(prevIni)} e ${hora(prevFim)}` : `até ${hora(prevFim)}`, tempo_medio_da_loja: `${tMin} a ${tMax} minutos depois que a loja aceita` } : {}),
          atrasado_minutos: atraso > 0 ? atraso : 0,
          entregador: p.motoboy?.nome?.split(" ")[0] ?? null,
          pode_cancelar: ["aguardando_pagamento", "pendente"].includes(p.status),
        }
      })
    }
    case "cancelar_pedido": {
      const p = (await pedidosDoNumero(sb, c.telefone)).find((x: any) => x.codigo === String(args.codigo ?? "").toUpperCase().replace("#", ""))
      if (!p) return { erro: "Não achei esse pedido neste número." }
      // Trava: precisa perguntar "quer mesmo cancelar?" numa mensagem e o cliente confirmar na seguinte
      if (!args.cliente_confirmou || c.pendente.cancelar !== p.codigo || (c.pendente.cancelar_turno ?? 0) >= (c.pendente.turno ?? 0)) {
        c.pendente = { ...c.pendente, cancelar: p.codigo, cancelar_turno: c.pendente.turno ?? 0 }
        return { pergunte_ao_cliente: `Quer mesmo cancelar o pedido #${p.codigo}? Responda sim para cancelar.`, pode_cancelar: ["aguardando_pagamento", "pendente"].includes(p.status) }
      }
      if (!["aguardando_pagamento", "pendente"].includes(p.status)) return { erro: `Não dá para cancelar sozinho: o pedido já está "${STATUS_NOME[p.status] ?? p.status}". Chame o atendente.` }
      const r = await fetch(`${SITE()}/api/pedido/cancelar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedido_id: p.id, cliente_push_token: p.cliente_push_token }) }).then(r => r.json()).catch(() => ({ error: "falha" }))
      if (r.error) return { erro: r.error }
      if (args.motivo) await sb.from("pedidos").update({ observacao: `${p.observacao ?? ""} | Cancelado pelo cliente no WhatsApp: ${String(args.motivo).slice(0, 200)}` }).eq("id", p.id)
      return { ok: true, estorno: p.status === "pendente" && ["pix", "cartao"].includes(p.forma_pagamento) ? "o valor volta pela mesma forma de pagamento (Pix em até 1 dia útil, cartão na próxima fatura)" : null }
    }
    case "pedir_estorno": {
      const p = (await pedidosDoNumero(sb, c.telefone)).find((x: any) => x.codigo === String(args.codigo ?? "").toUpperCase().replace("#", ""))
      if (!p) return { erro: "Não achei esse pedido neste número." }
      if (!["pix", "cartao"].includes(p.forma_pagamento)) return { erro: "Esse pedido não foi pago online. Chame o atendente para resolver." }
      const r = await fetch(`${SITE()}/api/reembolso/solicitar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedido_id: p.id, cliente_push_token: p.cliente_push_token, motivo: args.motivo, descricao: `[WhatsApp] ${args.descricao}`, valor_solicitado: args.valor ?? null }) }).then(r => r.json()).catch(() => ({ error: "falha" }))
      if (r.error) return { erro: r.error }
      if (cfg.atendente) await enviarTexto(cfg.atendente, `Pedido de reembolso pelo WhatsApp
Pedido #${p.codigo} (${p.loja?.nome})
Cliente: ${c.nome ?? ""} (${c.telefone})
Motivo: ${args.motivo}: ${args.descricao}${args.valor ? `
Valor pedido: ${brl(args.valor)}` : ""}
Analise no painel do admin, em Reembolsos.`).catch(() => {})
      return { ok: true, prazo: "o financeiro analisa e responde em até 1 dia útil" }
    }
    case "avaliar_pedido": {
      const p = (await pedidosDoNumero(sb, c.telefone)).find((x: any) => x.codigo === String(args.codigo ?? "").toUpperCase().replace("#", ""))
      if (!p || p.status !== "entregue") return { erro: "Só dá para avaliar pedido entregue deste número." }
      const r = await fetch(`${SITE()}/api/pedido/avaliar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedido_id: p.id, cliente_push_token: p.cliente_push_token, nota_loja: args.nota, nota_motoboy: args.nota, comentario: args.comentario ?? "" }) }).then(r => r.json()).catch(() => ({ error: "falha" }))
      return r.error ? { erro: r.error } : { ok: true }
    }
    case "salvar_nome": {
      c.nome = String(args.nome ?? "").trim().slice(0, 60) || null
      if (c.cliente_id && c.nome) await sb.from("clientes").update({ nome: c.nome }).eq("id", c.cliente_id)
      return { ok: true }
    }
    case "chamar_atendente": {
      c.pausado_ate = new Date(Date.now() + 2 * 3600_000).toISOString()
      if (cfg.atendente) {
        const link = `https://wa.me/${c.telefone}`
        await enviarTexto(cfg.atendente, `Atendimento no WhatsApp da Chegô\nCliente: ${c.nome ?? "sem nome"} (${c.telefone})\nMotivo: ${args.motivo}\nSacola: ${c.sacola.length ? sacolaTexto(c).texto.replace(/\n/g, "; ") : "vazia"}\nAbra a conversa no WhatsApp da Chegô para responder. ${link}`).catch(() => {})
      }
      return { ok: true, aviso: "Atendente chamado. O robô fica pausado nesta conversa por 2 horas." }
    }
  }
  return { erro: "Ferramenta desconhecida." }
}

const STATUS_NOME: Record<string, string> = { aguardando_pagamento: "esperando pagamento", pendente: "esperando a loja aceitar", aceito: "aceito pela loja", preparando: "em preparo", pronto: "pronto, chamando entregador", aguardando_aceite: "pronto, chamando entregador", indo_para_loja: "entregador indo buscar", na_loja: "entregador na loja", coletado: "saiu para entrega", em_rota: "saiu para entrega", entregue: "entregue", cancelado: "cancelado", recusado: "recusado pela loja" }

// O que cada etapa significa, pro robô explicar ao cliente sem inventar
const ETAPA_EXPLICA: Record<string, string> = {
  aguardando_pagamento: "O Pix ainda não caiu. O pedido só vai para a loja depois do pagamento. Se o cliente já pagou, pode levar 1 ou 2 minutos; se deu problema, ele pode pedir um código novo.",
  pendente: "O pedido chegou na loja e está esperando ela aceitar. Normalmente aceita em poucos minutos. Se passar de uns 15 minutos sem aceitar, é cancelado sozinho e o Pix volta.",
  aceito: "A loja aceitou e vai começar a preparar.",
  preparando: "A loja está preparando o pedido.",
  pronto: "O pedido ficou pronto e a Chegô está chamando um entregador.",
  aguardando_aceite: "O pedido ficou pronto e a Chegô está chamando um entregador.",
  aguardando_motoboy: "O pedido ficou pronto e a Chegô está chamando um entregador.",
  indo_para_loja: "Um entregador aceitou e está indo buscar na loja.",
  na_loja: "O entregador está na loja pegando o pedido.",
  coletado: "O entregador já pegou o pedido e está a caminho do cliente.",
  em_rota: "O entregador já pegou o pedido e está a caminho do cliente.",
  entregue: "O pedido foi entregue.",
  cancelado: "O pedido foi cancelado. Se foi pago por Pix, o dinheiro volta pelo mesmo Pix.",
  recusado: "A loja recusou o pedido (por exemplo, faltou algum item). Se foi pago por Pix, o dinheiro volta pelo mesmo Pix.",
}

async function pedidosDoNumero(sb: SupabaseClient, tel: string) {
  const fim = tel.slice(-8), desde = new Date(Date.now() - 3 * 86400_000).toISOString()
  const [{ data: a }, { data: viaRobo }] = await Promise.all([
    sb.from("pedidos").select("id, codigo, status, total, forma_pagamento, criado_em, previsao_entrega_em, aceito_em, pronto_em, coletado_em, entregue_em, cancelado_em, endereco_entrega, observacao, cliente_push_token, telefone_cliente, loja:lojas(nome, tempo_min, tempo_max), motoboy:motoboys(nome)").ilike("telefone_cliente", `%${fim.slice(0, 4)}%${fim.slice(4)}`).gte("criado_em", desde).order("criado_em", { ascending: false }).limit(5),
    sb.from("whats_pedidos").select("pedido_id").eq("telefone", tel),
  ])
  const ids = new Set((a ?? []).map((p: any) => p.id))
  const extra = (viaRobo ?? []).map((x: any) => x.pedido_id).filter((id: string) => !ids.has(id))
  const { data: b } = extra.length ? await sb.from("pedidos").select("id, codigo, status, total, forma_pagamento, criado_em, previsao_entrega_em, aceito_em, pronto_em, coletado_em, entregue_em, cancelado_em, endereco_entrega, observacao, cliente_push_token, telefone_cliente, loja:lojas(nome, tempo_min, tempo_max), motoboy:motoboys(nome)").in("id", extra).gte("criado_em", desde) : { data: [] }
  return [...(a ?? []), ...(b ?? [])].filter((p: any) => (p.telefone_cliente ?? "").replace(/\D/g, "").slice(-8) === fim || extra.includes(p.id)) as any[]
}

function sistema(c: Conversa, lojasTxt: string) {
  const hoje = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", hour: "2-digit", minute: "2-digit" }).format(new Date())
  return `Você é o atendente virtual da Chegô Delivery no WhatsApp (Aragoiânia, GO). Agora: ${hoje}.
Fale como um atendente simpático e direto, em português simples, mensagens curtas (no máximo 5 linhas), sem jargão. Use *negrito* do WhatsApp só para valores e nomes de produtos. Nada de listas enormes.
Seu trabalho: ajudar o cliente a fazer um pedido do começo ao fim e cuidar dele depois (andamento, cancelamento, problemas).

O que você sabe sobre a Chegô (use para responder dúvidas; não despeje tudo de uma vez):
- A Chegô é o app de delivery de Aragoiânia. As lojas são parceiras e a entrega é feita pelos entregadores da Chegô. Também dá pra pedir pelo site chegodelivery.com, que pode ser instalado na tela do celular.
- Pelo WhatsApp, por enquanto, só as lojas listadas abaixo. Outras lojas: pelo app.
- Taxa de entrega: calculada pelo endereço (bairro ou distância). Cidades vizinhas têm taxa própria. O valor sempre aparece no resumo antes de fechar. Endereço muito longe fica fora da área.
- Retirada: o cliente busca na loja e não paga entrega. O endereço vem de info_loja.
- Pedido mínimo e tempo médio de entrega: use info_loja; nunca chute.
- Pagamento: Pix (o pedido só vai pra loja depois que o Pix cai; se der problema no Pix, dá pra pedir um código novo aqui mesmo), dinheiro (pergunte se precisa de troco e para quanto) ou cartão de crédito/débito na maquininha que o entregador leva. Na retirada, dinheiro ou cartão são pagos no balcão. Nunca peça número de cartão, senha ou dados bancários.
- Cupom de desconto e pagamento dividido em duas formas: só pelo app. Pedido agendado para outro horário: não fazemos; o pedido sai assim que a loja aceita.
- Caminho do pedido: aguardando pagamento (Pix) → aguardando a loja aceitar → preparando → pronto → saiu para entrega → entregue. O cliente recebe aviso aqui no WhatsApp a cada passo.
- Se a loja não aceitar em cerca de 15 minutos, o pedido é cancelado sozinho e o Pix volta.
- Cancelar: só enquanto a loja ainda não aceitou. Depois disso, quem resolve é o atendente.
- Reembolso: só de pedido pago online (Pix, ou cartão pelo app). A equipe analisa e o dinheiro volta pelo mesmo meio. Não prometa prazo nem valor.
- Sobre o entregador: pode dizer o nome que a ferramenta trouxer; nunca passe telefone de entregador ou de loja.
- Assuntos fora da Chegô: diga com gentileza que só ajuda com pedidos da Chegô.

Regras obrigatórias:
- Nunca invente preço, item, taxa ou horário. Use sempre as ferramentas. Valores só os que as ferramentas devolverem.
- Lojas que atendem pelo WhatsApp: ${lojasTxt}. Se só houver uma, já ofereça ela. Loja fechada: avise e não monte pedido. Esse aberta/fechada é o de AGORA e vale mais que qualquer coisa dita antes na conversa. Nunca invente horário de funcionamento.
- Depois de escolher a loja, NÃO mande o cardápio todo de cara. Pergunte o que a pessoa está com vontade, citando as categorias que a ferramenta devolveu (no máximo 6, separadas por vírgula) e sugerindo os mais pedidos.
- Quando ela disser o que quer (ex.: "pastel", "algo pra beber", "um petisco pra 2"), use mostrar_cardapio com a categoria e ajude a escolher. Se pedir recomendação, use mostrar_cardapio com mais_pedidos. Só mande o cardápio completo se ela pedir ("manda o cardápio todo") ou não souber o que quer depois de você perguntar.
- Fotos já vão com nome, número e preço; não repita item por item. Itens sem foto, cite em uma linha.
- Nunca diga "vou te enviar" sem chamar a ferramenta no mesmo turno: chame mostrar_cardapio primeiro e depois responda. Não diga que a loja está aberta sem o cliente perguntar; só avise quando estiver fechada.
- Para cada item, use buscar_produtos e depois adicionar_item. Se faltar adicional obrigatório, pergunte de forma curta mostrando as opções numeradas.
- Depois de adicionar, pergunte se quer mais alguma coisa.
- Entrega: peça primeiro a localização atual pelo WhatsApp, explicando como: no iPhone toque no "+" e em Localização; no Android toque no clipe e em Localização; depois "Enviar sua localização atual". Quem preferir pode digitar rua, número, bairro e um ponto de referência. Ofereça retirada se a loja aceitar.
- Antes de finalizar: chame resumo, mostre o resumo EXATAMENTE como veio, pergunte a forma de pagamento (Pix, dinheiro ou cartão na entrega, crédito ou débito) e se for dinheiro pergunte se precisa de troco. Só chame finalizar_pedido depois de um "sim/confirmo" claro.
- Se finalizar devolver pix_copia_cola, diga que o código Pix vem logo abaixo para copiar e colar no app do banco, e que o pedido vai para a loja assim que o pagamento cair. Não escreva o código você mesmo.
- Se uma ferramenta devolver pergunte_ao_cliente, faça exatamente essa pergunta e espere a resposta.
- Pedido em dinheiro ou cartão: diga o código do pedido e que a loja já recebeu.
Depois do pedido (sempre comece chamando meus_pedidos):
- Perguntas comuns depois do pedido e como responder (sempre com os dados de meus_pedidos):
  • "Cadê meu pedido?", "em que pé está?": diga a etapa em palavras simples usando o_que_esta_acontecendo, e a previsão.
  • "Quanto tempo falta?", "que horas chega?": responda com a previsão (faixa de horário). Se já saiu para entrega, diga que está a caminho com o entregador e que deve chegar em poucos minutos. Retirada: diga quando fica pronto.
  • "Já pagaram/caiu meu Pix?": se a etapa é esperando pagamento, o Pix ainda não caiu; ofereça código novo se deu problema. Se já passou dessa etapa, o pagamento foi confirmado.
  • "A loja recebeu?", "aceitaram?": use a linha_do_tempo (loja_aceitou).
  • "Quem vai entregar?": diga o nome do entregador se tiver; se ainda não tiver, explique que a Chegô chama um entregador quando o pedido fica pronto.
  • "Tá demorando": compare com a previsão. Dentro do prazo: tranquilize mostrando em que etapa está e a previsão. Atrasado (atrasado_minutos > 0): peça desculpas uma vez. Se passar de 15 minutos de atraso, ou se o cliente insistir, use chamar_atendente com o motivo "pedido atrasado".
  • "Chegou errado/faltando/frio": siga a regra de estorno abaixo.
- Se houver mais de um pedido recente, pergunte de qual está falando (ou use o mais recente que ainda não foi entregue).
- Nunca invente etapa, horário ou nome; se a ferramenta não trouxe, diga que vai verificar e use chamar_atendente.
- "Quero cancelar": se pode_cancelar, confirme ("Quer mesmo cancelar o pedido #X?") e depois use cancelar_pedido; se foi pago, explique como o dinheiro volta. Se a loja já aceitou, explique que a loja já está preparando e use chamar_atendente.
- Estorno, item faltando, item errado, pedido não chegou, qualidade ruim: peça os detalhes (o que faltou ou veio errado) e use pedir_estorno quando foi pago por Pix ou cartão online; se foi dinheiro ou maquininha, use chamar_atendente. Não prometa valor nem prazo além do que a ferramenta disser.
- Se o cliente responder só com um número de 1 a 5 logo depois de um pedido entregue, use avaliar_pedido e agradeça.
- Pedido recusado pela loja: explique e, se foi pago online, diga que o dinheiro volta sozinho.
- Cliente irritado: seja breve, peça desculpas uma vez e resolva ou chame o atendente.
- Se o cliente pedir atendente, reclamar de algo que você não resolve, ou você não conseguir entender duas vezes, use chamar_atendente.
- Se não souber o nome do cliente, pergunte uma vez e use salvar_nome.
Estado atual: nome=${c.nome ?? "desconhecido"}; loja_escolhida=${c.loja_id ?? "nenhuma"}; itens_na_sacola=${c.sacola.length}; entrega=${c.endereco ? (c.endereco.tipo === "retirada" ? "retirada" : `${c.endereco.rua}, ${c.endereco.numero}`) : "não definida"}; localizacao_recebida=${c.localizacao?.lat ? "sim" : "não"}.`
}

/** Processa uma mensagem do cliente e envia as respostas. */
export async function atenderMensagem(tel: string, entrada: { texto?: string; audio?: { url: string; mime?: string }; localizacao?: { lat: number; lng: number } }) {
  const sb = sbAdmin(), cfg = await lerConfig(sb)
  let { data: row } = await sb.from("whats_conversas").select("*").eq("telefone", tel).maybeSingle()
  if (!row) {
    // Cliente já cadastrado no app pelo mesmo número?
    const fim = tel.slice(-8)
    const { data: cli } = await sb.from("clientes").select("id, nome, telefone, endereco_rua, endereco_numero, endereco_bairro, endereco_complemento, endereco_cidade, endereco_lat, endereco_lng").ilike("telefone", `%${fim.slice(0, 4)}%${fim.slice(4)}`).limit(1)
    const cl: any = cli?.[0]
    row = { telefone: tel, cliente_id: cl?.id ?? null, nome: cl?.nome ?? null, loja_id: null, sacola: [], numeracao: {}, pendente: {}, historico: [], pausado_ate: null, ultimo_pedido_id: null, localizacao: null,
      endereco: cl?.endereco_lat ? { tipo: "entrega", rua: cl.endereco_rua, numero: cl.endereco_numero, bairro: cl.endereco_bairro, complemento: cl.endereco_complemento, cidade: cl.endereco_cidade, lat: cl.endereco_lat, lng: cl.endereco_lng, salvo: true } : null }
    await sb.from("whats_conversas").insert(row)
  }
  const c = row as Conversa
  if (c.pausado_ate && new Date(c.pausado_ate) > new Date()) return { pausado: true }
  // Trava simples: uma mensagem por vez por cliente
  const agora = new Date(), ate = new Date(Date.now() + 45_000).toISOString()
  const { data: trava } = await sb.from("whats_conversas").update({ processando_ate: ate }).eq("telefone", tel).or(`processando_ate.is.null,processando_ate.lt.${agora.toISOString()}`).select("telefone")
  if (!trava?.length) { await new Promise(r => setTimeout(r, 4000)); return atenderMensagem(tel, entrada) }

  try {
    c.pendente = { ...(c.pendente ?? {}), turno: ((c.pendente?.turno) ?? 0) + 1 }
    let texto = entrada.texto ?? ""
    if (entrada.audio) {
      texto = await transcreverAudio(entrada.audio.url, entrada.audio.mime).catch(() => "")
      if (!texto) { await enviarTexto(tel, "Não consegui ouvir o áudio. Pode mandar de novo ou escrever?"); return { ok: true } }
      texto = `[áudio] ${texto}`
    }
    if (entrada.localizacao) { c.localizacao = entrada.localizacao; texto = `[cliente enviou a localização pelo WhatsApp] ${texto}`.trim() }
    const { data: lojas } = await sb.from("lojas").select("id, nome, aberto").in("id", cfg.lojas)
    const lojasTxt = (lojas ?? []).map((l: any) => `${l.nome} (id ${l.id}, ${abertaRobo(l, cfg) ? "aberta" : "fechada"})`).join("; ") || "nenhuma"
    const msgs: any[] = [{ role: "system", content: sistema(c, lojasTxt) }, ...c.historico.slice(-16).map(h => ({ role: h.r === "u" ? "user" : "assistant", content: h.t })), { role: "user", content: texto || "(mensagem vazia)" }]
    const saida = { midia: [] as { url: string; legenda?: string }[] }
    let resposta = "", pixParaEnviar: string | null = null
    let falhaIA = false
    const pedidoAntes = c.ultimo_pedido_id
    for (let volta = 0; volta < 8; volta++) {
      const j = await chamarIA({ model: MODELO(), messages: msgs, tools: FERRAMENTAS, temperature: 0.3 }).catch(e => { console.error("[ROBO] falha IA", e); falhaIA = true; return null })
      if (!j) break
      const m = j.choices?.[0]?.message
      if (!m) break
      msgs.push({ role: "assistant", content: m.content ?? "", ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}) })
      if (!m.tool_calls?.length) { resposta = String(m.content ?? "").trim(); break }
      for (const tc of m.tool_calls) {
        let args: any = {}; try { args = JSON.parse(tc.function?.arguments || "{}") } catch { /* vazio */ }
        let out: any
        try { out = await executar(sb, cfg, c, tc.function?.name, args, saida) } catch (e) { console.error("[ROBO] ferramenta", tc.function?.name, e); out = { erro: "Falha interna. Tente de novo ou chame o atendente." } }
        if (out?.pix_copia_cola_enviar_em_mensagem_separada) { pixParaEnviar = out.pix_copia_cola_enviar_em_mensagem_separada; out = { ...out, pix_copia_cola_enviar_em_mensagem_separada: "(o sistema envia sozinho)" } }
        msgs.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out) })
      }
    }
    for (const md of saida.midia) await enviarImagem(tel, md.url, md.legenda).catch(e => console.error("[ROBO] imagem", e))
    if (!resposta && falhaIA) resposta = pixParaEnviar ? "Seu pedido foi feito. O código Pix vem logo abaixo." : c.ultimo_pedido_id !== pedidoAntes ? "Seu pedido foi feito e já foi para a loja. Qualquer coisa é só chamar aqui." : "Tive uma instabilidade aqui. Pode mandar sua última mensagem de novo, por favor?"
    if (resposta) await enviarTexto(tel, resposta)
    if (pixParaEnviar) await enviarTexto(tel, pixParaEnviar)
    c.historico = [...c.historico, { r: "u" as const, t: texto }, ...(resposta ? [{ r: "a" as const, t: resposta }] : [])].slice(-20)
    return { ok: true, resposta }
  } finally {
    await sb.from("whats_conversas").update({ cliente_id: c.cliente_id, nome: c.nome, loja_id: c.loja_id, sacola: c.sacola, numeracao: c.numeracao, pendente: c.pendente, endereco: c.endereco, localizacao: c.localizacao, historico: c.historico, pausado_ate: c.pausado_ate, ultimo_pedido_id: c.ultimo_pedido_id, processando_ate: null, atualizado_em: new Date().toISOString() }).eq("telefone", tel)
  }
}

/** Cliente fala com humano: pausa o robô nessa conversa (atendente digitou no WhatsApp da Chegô). */
export async function pausarConversa(tel: string, horas = 2) {
  const sb = sbAdmin()
  await sb.from("whats_conversas").upsert({ telefone: tel, pausado_ate: new Date(Date.now() + horas * 3600_000).toISOString() }, { onConflict: "telefone" })
}

export const STATUS_MSG: Record<string, (cod: string, extra?: string) => string> = {
  pendente: cod => `Pedido #${cod} recebido pela loja. Já já eles confirmam.`,
  aceito: cod => `A loja aceitou o pedido #${cod} e já está preparando. 👨‍🍳`,
  preparando: cod => `A loja aceitou o pedido #${cod} e já está preparando. 👨‍🍳`,
  pronto: cod => `Pedido #${cod} pronto! Estamos chamando o entregador.`,
  em_rota: (cod, mb) => `Pedido #${cod} saiu para entrega${mb ? ` com ${mb}` : ""}. 🛵`,
  coletado: (cod, mb) => `Pedido #${cod} saiu para entrega${mb ? ` com ${mb}` : ""}. 🛵`,
  entregue: cod => `Pedido #${cod} entregue. Bom apetite! 😋\nDe 1 a 5, que nota você dá para o pedido? Responda só com o número.`,
  cancelado: cod => `O pedido #${cod} foi cancelado. Se tiver alguma dúvida, é só responder "atendente".`,
}
