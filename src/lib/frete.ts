import type { SupabaseClient } from "@supabase/supabase-js"
import { distanciaRotaKm } from "@/lib/rota"

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Margem de segurança só pro fallback de linha reta (>10km) — quando a Mapbox falha por
// completo (fora do ar, sem token, timeout) e sobra só haversine, que subestima por
// natureza. Quando a Mapbox responde, já usamos a rota mais longa entre as alternativas
// (ver distanciaRotaKm em lib/rota.ts) — isso já é uma correção mais precisa e específica
// pra cada endereço, então empilhar essa margem em cima dobraria a correção à toa.
const RAIO_MARGEM_KM = 10
const MARGEM_SEGURANCA_FALLBACK = 1.20

// Distância real de rota (Mapbox) sempre que disponível — cai pra linha reta se a API
// falhar, não tiver token configurado, ou responder fora do tempo. Nunca bloqueia o pedido.
export async function distanciaEntregaKm(latLoja: number | null, lngLoja: number | null, latCliente: number | null, lngCliente: number | null): Promise<number | null> {
  if (!latLoja || !lngLoja || !latCliente || !lngCliente) return null
  const distRota = await distanciaRotaKm({ lat: latLoja, lng: lngLoja }, { lat: latCliente, lng: lngCliente })
  if (distRota !== null) return distRota
  const dist = haversineKm(latLoja, lngLoja, latCliente, lngCliente)
  return dist > RAIO_MARGEM_KM ? dist * MARGEM_SEGURANCA_FALLBACK : dist
}

function taxaPorDistancia(dist: number | null, base = 6.00): number {
  if (dist === null) return base
  if (dist <= 6) return base
  return Math.round((base + (dist - 6) * 1.00) * 100) / 100
}

// Sem tabela fixa pro município, um endereço geocodificado errado (nome de rua comum
// casando com outra cidade distante, bias de busca ruim, GPS impreciso etc.) pode gerar
// uma distância absurda e cobrar uma taxa gigante do cliente sem ninguém perceber até o
// motoboy reclamar — foi exatamente o que aconteceu no pedido JZ89NC (2026-09-12): R$79,89
// de frete pra um endereço que devia ser R$4,00, por causa de uma coordenada de viés de
// geocodificação errada (ver LAT_DEFAULT em checkout/page.tsx). Acima desse raio sem tabela
// fixa cadastrada, rejeita em vez de cobrar.
export const RAIO_MAXIMO_KM = 30
const ADICIONAL_ZONA_RURAL = 5.00
const DIST_MINIMA_MUNICIPIO_KM = 8
export class EnderecoForaDoRaioError extends Error {
  constructor(public distanciaKm: number) {
    super(`Endereço fora da área de entrega (${distanciaKm.toFixed(0)}km da loja). Confira se o endereço está correto.`)
  }
}

// Ponto de entrega incoerente com o endereço: o cliente diz que está na cidade da loja, mas a
// coordenada caiu longe dela (geocoder mandou "Rua Um, Centro" pra Goiânia — AEPFMK,
// 2026-10-28, ~19km, R$18,48 em vez de R$4). Pelas entregas reais dos últimos 60 dias, nenhum
// endereço legítimo na própria cidade da loja passa de ~12km; acima de 15km é ponto errado.
export const LIMITE_MESMA_CIDADE_KM = 15
export class PontoEntregaSuspeitoError extends EnderecoForaDoRaioError {
  constructor(distanciaKm: number, mensagem: string) {
    super(distanciaKm)
    this.message = mensagem
  }
}

function normalizar(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
}

// Valor mais usado pelas lojas da mesma cidade pra um município de destino (ver calcularTaxaEntregaCompleta)
async function taxaPadraoDaCidade(sb: SupabaseClient, cidadeLoja: string, cidadeEntrega: string): Promise<number | null> {
  const { data: lojas } = await sb.from("lojas").select("id, cidade").in("status", ["ativo", "aprovado"])
  const ids = (lojas ?? []).filter((l: { cidade: string | null }) => mesmaCidade(l.cidade ?? "", cidadeLoja)).map((l: { id: string }) => l.id)
  if (!ids.length) return null
  const { data: linhas } = await sb.from("tabela_frete").select("loja_id, municipio, taxa, tipo").in("loja_id", ids).eq("tipo", "municipio")
  const conta = new Map<number, number>()
  for (const l of linhas ?? []) {
    const e = normalizar(l.municipio), n = normalizar(cidadeEntrega)
    if (!e || !(n.includes(e) || e.includes(n))) continue
    const v = Number(l.taxa); conta.set(v, (conta.get(v) ?? 0) + 1)
  }
  if (!conta.size) return null
  return [...conta.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
}

function buscarTabelaFrete(tabela: { municipio: string; taxa: number }[], nome: string): number | null {
  if (!nome) return null
  const n = normalizar(nome)
  for (const entry of tabela) {
    const e = normalizar(entry.municipio)
    if (n.includes(e) || e.includes(n)) return entry.taxa
  }
  return null
}

// tabela_frete guarda linhas de dois tipos na mesma tabela: "municipio" (cidades vizinhas
// inteiras, comum a todas as lojas hoje) e "bairro" (setores dentro da própria cidade da
// loja, com taxa própria — ex: Guapó). Nunca misturar os dois na mesma busca fuzzy: vários
// nomes de bairro contêm o nome da cidade como substring (ex: "Ciplan guapo", "Cidade de
// guapó" dentro de "Guapó") — buscar cidade_entrega="Guapó" numa tabela com bairro e
// município juntos casaria com qualquer linha de bairro que contenha "guapo" no nome,
// cobrando o valor errado pra quase todo cliente da cidade. Ver AGENTS.md.
function filtrarPorTipo<T extends { tipo?: string }>(tabela: T[], tipo: "municipio" | "bairro"): T[] {
  return tabela.filter(e => (e.tipo ?? "municipio") === tipo)
}

// Nomes de bairro costumam ser genéricos e repetidos entre cidades diferentes (ex:
// "Centro", "Jardim Imperial", "Vila Boa" existem tanto em Guapó quanto em Aragoiânia,
// Abadia de Goiás, Trindade...). Incidente real, 2026-09-23: endereço em "Jardim Imperial
// — Aragoiânia" casou com o bairro de Guapó de mesmo nome e cobrou R$4 de uma entrega que
// devia ser ~R$26 por distância real. A tabela de bairro só pode valer quando o cliente
// está mesmo na cidade da loja — nunca aplicar preço de bairro de Guapó pra endereço fora
// de Guapó só porque o nome do setor bate.
export function mesmaCidade(a: string, b: string): boolean {
  const na = normalizar(a), nb = normalizar(b)
  return !!na && !!nb && (na.includes(nb) || nb.includes(na))
}

/** CEP (só dígitos ou com hífen) -> nome da cidade via ViaCEP. Cidades pequenas atendidas
 * têm CEP geral único (Guapó 75350-000, Aragoiânia 75330-000), então o CEP basta. Falha
 * silenciosa (null) — nunca bloqueia o pedido. */
async function cidadePorCep(cep: string | null | undefined): Promise<string | null> {
  const digitos = (cep ?? "").replace(/\D/g, "")
  if (digitos.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, { signal: AbortSignal.timeout(3000) })
    const json = await res.json()
    return typeof json?.localidade === "string" && json.localidade ? json.localidade : null
  } catch {
    return null
  }
}

/**
 * Calcula a taxa de entrega final — mesma fórmula usada tanto na prévia do checkout
 * (/api/frete/calcular) quanto na criação real do pedido (/api/pedido/criar), pra nunca
 * divergir entre o que o cliente vê antes de confirmar e o que é cobrado de fato.
 *
 * Prioridade: retirada (R$0) > frete fixo por CLIENTE (override manual, ver
 * clientes.frete_fixo) > tabela fixa por município > distância de rota real (com
 * fallback pra linha reta) > nunca negativa.
 */
export async function calcularTaxaEntregaCompleta(
  sb: SupabaseClient,
  params: {
    loja_id: string
    loja_lat: number | null
    loja_lng: number | null
    loja_taxa_base?: number | null
    tipo_entrega: "entrega" | "retirada"
    lat_entrega: number | null
    lng_entrega: number | null
    cidade_entrega?: string | null
    bairro_entrega?: string | null
    cliente_id?: string | null
    zona_rural?: boolean | null
    /** Checkout do app: zona rural sem ponto no mapa é recusada (só a base sairia barata demais) */
    exigir_ponto_rural?: boolean
  },
  /** Preenchido com a distância usada e de onde veio o valor, pra gravar no pedido e auditar depois */
  detalhe?: { distancia_km?: number | null; fonte?: string }
): Promise<number> {
  if (params.tipo_entrega === "retirada") return 0

  // Ponto de entrega em cima da loja (até 30 m) = o cliente não marcou onde mora: sem GPS o pino do
  // checkout começa na loja (15 pedidos em out/2026, ex. H9E3AA rural saiu R$ 9). Vale como sem ponto.
  if (params.loja_lat && params.loja_lng && params.lat_entrega && params.lng_entrega
    && haversineKm(params.loja_lat, params.loja_lng, params.lat_entrega, params.lng_entrega) < 0.03) {
    params = { ...params, lat_entrega: null, lng_entrega: null }
  }

  // Frete fixo por cliente — override manual acima de qualquer cálculo por distância ou
  // tabela de município/bairro (pedido do usuário, 2026-09-25: casos pontuais em que o
  // frete calculado não reflete o combinado com a cliente, ex: Vitória Santos R$10,
  // Livia Jesus R$18). Só se aplica quando explicitamente cadastrado — null/ausente cai
  // no cálculo normal de sempre, comportamento 100% preservado pros demais clientes.
  let cidadeEntrega = params.cidade_entrega?.trim() ?? ""
  if (params.cliente_id) {
    const { data: clienteRow } = await sb.from("clientes").select("frete_fixo, endereco_cidade, endereco_cep").eq("id", params.cliente_id).maybeSingle()
    if (clienteRow?.frete_fixo != null) { if (detalhe) detalhe.fonte = "cliente"; return Math.max(0, Number(clienteRow.frete_fixo)) }
    // Cidade vazia = endereço do cadastro sem cidade e sem geocodificação (sem lat/lng) —
    // nesse caso nenhuma tabela casava e caía na taxa base da loja. Incidente real,
    // 2026-10-02: pedido CFXBSR (Pamonharia Cidade Nova, Guapó → Aragoiânia, CEP
    // 75330-000) cobrou R$4 em vez dos R$26 da tabela de Aragoiânia. Recupera a cidade
    // do cadastro do cliente (campo cidade, senão pelo CEP via ViaCEP).
    if (!cidadeEntrega && params.lat_entrega == null) {
      cidadeEntrega = clienteRow?.endereco_cidade?.trim() || await cidadePorCep(clienteRow?.endereco_cep) || ""
    }
  }

  const [{ data: tabelaFrete }, { data: lojaRow }] = await Promise.all([
    sb.from("tabela_frete").select("municipio, taxa, tipo").eq("loja_id", params.loja_id),
    sb.from("lojas").select("cidade, cidades_atendidas").eq("id", params.loja_id).single(),
  ])

  // Bairro primeiro (mais específico), depois município (cidade vizinha inteira) — cada um
  // buscado só dentro do seu próprio tipo, nunca misturados (ver filtrarPorTipo). A tabela
  // de bairro representa UMA cidade só por vez — nunca a cidade principal da loja E uma
  // cidade extra ao mesmo tempo, senão um nome de bairro genérico (ex: "Centro") existente
  // nas duas colide (incidente real, 2026-09-23: loja de Aragoiânia com cidades_atendidas
  // incluindo Guapó — bairro "Centro" de Aragoiânia batia sem querer no "Centro" de Guapó
  // copiado de outra loja, quando deveria cair na taxa fixa de Aragoiânia).
  // Loja com cidade(s) extra(s) além da própria (`cidades_atendidas` diferente de `cidade`):
  // a tabela de bairro é tratada como pertencente só à(s) cidade(s) extra(s) — é pra isso
  // que ela existe (estender pra outra cidade usando a tabela de bairro de lá), a cidade
  // principal continua servida pelo mecanismo de sempre (distância real ou município).
  // Loja de cidade única (sem extra distinta): comportamento antigo, bairro = própria cidade.
  const cidadesAtendidas: string[] = lojaRow?.cidades_atendidas ?? []
  const cidadesExtras = cidadesAtendidas.filter((c: string) => !!c && !mesmaCidade(c, lojaRow?.cidade ?? ""))
  const cidadesBairroElegiveis: string[] = cidadesExtras.length > 0 ? cidadesExtras : [lojaRow?.cidade].filter((c): c is string => !!c)
  const clienteNaCidadeDaLoja = cidadesBairroElegiveis.some(c => mesmaCidade(cidadeEntrega, c))
  const taxaBairro = clienteNaCidadeDaLoja ? buscarTabelaFrete(filtrarPorTipo(tabelaFrete ?? [], "bairro"), params.bairro_entrega ?? "") : null
  // Distância de rota medida uma vez só (serve pro km, pra zona rural e pra regra do município abaixo)
  const distRota = await distanciaEntregaKm(params.loja_lat, params.loja_lng, params.lat_entrega, params.lng_entrega)
  // Valor fixo de município vizinho só a partir de 8 km da loja (Lucas, 03/11/2026): chácara do
  // município de Guapó a 4 km de Aragoiânia paga por km, não os R$ 30 da cidade de Guapó.
  const municipioVale = distRota === null || distRota >= DIST_MINIMA_MUNICIPIO_KM
  let taxaFixa = taxaBairro ?? (municipioVale ? buscarTabelaFrete(filtrarPorTipo(tabelaFrete ?? [], "municipio"), cidadeEntrega) : null)
  if (detalhe) detalhe.fonte = taxaFixa === null ? "km" : taxaBairro !== null ? "bairro" : "municipio"
  // Tabela padrão da cidade (03/11/2026): a tabela de município era copiada à mão loja por loja, e loja
  // sem a linha caía no cálculo por km. Ex.: Aragoiânia → Guapó saiu de R$ 9 a R$ 37,25 no mesmo mês
  // (GJBKRV, Bom Demais, R$ 16,73; CDY7VK, Sushi Biscuit, R$ 30). Sem linha própria, vale o valor mais
  // usado pelas outras lojas da mesma cidade pra aquele município. Linha própria da loja sempre ganha.
  if (taxaFixa === null && municipioVale && cidadeEntrega && lojaRow?.cidade && !mesmaCidade(cidadeEntrega, lojaRow.cidade)) {
    taxaFixa = await taxaPadraoDaCidade(sb, lojaRow.cidade, cidadeEntrega)
    if (taxaFixa !== null && detalhe) detalhe.fonte = "municipio_padrao"
  }

  if (taxaFixa === null && params.loja_lat && params.loja_lng && params.lat_entrega && params.lng_entrega) {
    const distKm = haversineKm(params.loja_lat, params.loja_lng, params.lat_entrega, params.lng_entrega)
    if (distKm > RAIO_MAXIMO_KM) throw new EnderecoForaDoRaioError(distKm)
    if (!params.zona_rural && distKm > LIMITE_MESMA_CIDADE_KM && mesmaCidade(cidadeEntrega, lojaRow?.cidade ?? ""))
      throw new PontoEntregaSuspeitoError(distKm, `O ponto de entrega ficou a ${distKm.toFixed(0)}km da loja, fora de ${lojaRow?.cidade}. Confira o endereço e marque no mapa onde entregar.`)
  }
  // Zona rural (MYC5TX, 2026-10-28): sem coordenada, a taxa saía só base + R$5 (R$9 em vez de R$23,90)
  if (params.zona_rural && params.exigir_ponto_rural && taxaFixa === null && (!params.lat_entrega || !params.lng_entrega))
    throw new PontoEntregaSuspeitoError(0, "Para entrega em zona rural, marque no mapa o local exato da entrega.")

  if (detalhe) detalhe.distancia_km = distRota !== null ? Math.round(distRota * 100) / 100 : null
  let taxa = taxaFixa !== null
    ? taxaFixa
    : taxaPorDistancia(distRota, params.loja_taxa_base ?? 6.00)

  // Nunca negativa — loja com taxa_entrega cadastrada errada (< 0) não pode reduzir o total.
  // Zona rural / estrada de chão (pergunta obrigatória no checkout, pedido do usuário em
  // 2026-10-06): soma em cima da taxa normal — inclusive da taxa fixa de tabela — R$5,00 +
  // R$1,00 por km acima de 5km (distância loja→cliente). Sem coordenada pra medir, só os R$5.
  if (params.zona_rural) {
    const dist = distRota
    taxa += ADICIONAL_ZONA_RURAL + (dist !== null && dist > 5 ? (dist - 5) * 1.00 : 0)
    taxa = Math.round(taxa * 100) / 100
  }

  return Math.max(0, taxa)
}

// Coordenada do endereço de sempre do cliente, tirada das entregas anteriores dele no mesmo
// bairro e cidade. Incidentes reais, 2026-10-28: AEPFMK (Padaria Flor de Ipê) saiu com a
// "Rua Um, Centro, Aragoiânia" geocodificada em Goiânia (~20km) e cobrou R$18,48 em vez de
// R$4; MYC5TX (Açaíteria Mendonça, zona rural no Campo Dourado) saiu sem coordenada e
// cobrou R$9 em vez dos ~R$23 de sempre. Nos dois casos o cliente já tinha recebido ali
// com a coordenada certa. Regra: sem coordenada, usa a do histórico; com coordenada a mais
// de 3km da do histórico pro mesmo bairro, confia no histórico (o geocoder errou).
const DESVIO_MAXIMO_KM = 3
const PINO_NA_LOJA_KM = 0.05
export async function coordsPeloHistorico(
  sb: SupabaseClient,
  p: { cliente_id?: string | null; bairro?: string | null; cidade?: string | null; lat: number | null; lng: number | null; loja_lat?: number | null; loja_lng?: number | null }
): Promise<{ lat: number | null; lng: number | null; corrigido: boolean }> {
  // Pino em cima da loja nunca é o endereço do cliente (YJEXNK, 08/11/2026: o pino errado
  // de um pedido antigo virou "histórico" e todo pedido seguinte saiu na porta da Petiscaria).
  const naLoja = (lat: number, lng: number, lLat?: number | null, lLng?: number | null) =>
    !!lLat && !!lLng && haversineKm(lat, lng, Number(lLat), Number(lLng)) < PINO_NA_LOJA_KM
  const entrada = p.lat != null && p.lng != null && naLoja(p.lat, p.lng, p.loja_lat, p.loja_lng)
  const atual = entrada ? { lat: null, lng: null, corrigido: true } : { lat: p.lat ?? null, lng: p.lng ?? null, corrigido: false }
  const bairro = normalizar(p.bairro ?? ""), cidade = normalizar(p.cidade ?? "")
  if (!p.cliente_id || !bairro || !cidade) return atual
  const { data } = await sb.from("pedidos").select("endereco_entrega, lat_entrega, lng_entrega, loja:lojas(lat, lng)")
    .eq("cliente_id", p.cliente_id).eq("status", "entregue").not("lat_entrega", "is", null)
    .order("criado_em", { ascending: false }).limit(30)
  const anterior = (data ?? []).find((r: any) => {
    if (naLoja(Number(r.lat_entrega), Number(r.lng_entrega), r.loja?.lat, r.loja?.lng)) return false
    if (naLoja(Number(r.lat_entrega), Number(r.lng_entrega), p.loja_lat, p.loja_lng)) return false
    const ultimo = String(r.endereco_entrega ?? "").split(" — ").pop() ?? ""
    const partes = ultimo.split(",").map(s => normalizar(s))
    if (partes.length < 2) return false
    return partes[0] === bairro && mesmaCidade(partes[partes.length - 1], cidade)
  })
  if (!anterior) return atual
  const hLat = Number(anterior.lat_entrega), hLng = Number(anterior.lng_entrega)
  if (!Number.isFinite(hLat) || !Number.isFinite(hLng)) return atual
  if (atual.lat == null || atual.lng == null || haversineKm(atual.lat, atual.lng, hLat, hLng) > DESVIO_MAXIMO_KM)
    return { lat: hLat, lng: hLng, corrigido: true }
  return atual
}
