"use client"

// Tela "Início" do layout novo (proposta aprovada em 19/10/2026), só no celular.
// Só muda a aparência: as lojas vêm da mesma consulta da home antiga (page.tsx), o endereço
// usa o mesmo AddressBottomSheet e cada loja abre a mesma rota /restaurante/[id].
import { PrecoPromo } from "@/components/cliente/PrecoPromo"
import { useEffect, useMemo, useRef, useState } from "react"
import { ehSempreUltima, ultimaPorUltimo } from "@/lib/ordemLojas"
import { lerFavoritas, alternarFavorita } from "@/lib/favoritas"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { precoExibicao, brl } from "@/lib/precoExibicao"
import { maisPedidos } from "@/lib/maisPedidos"
import type { Loja } from "@/types"

type Prod = { id: string; loja_id: string; nome: string; descricao: string | null; preco: number; preco_antigo?: number | null; categoria_id?: string | null; ncm?: string | null; ordem?: number | null; foto_url: string | null; adicionais: unknown; dias_semana?: number[] | null }

const ABAS = [
  ["inicio", "Início"], ["restaurantes", "Restaurantes"], ["mercados", "Mercados"], ["bebidas", "Bebidas"],
] as const
type Aba = typeof ABAS[number][0]
const MERCADO = ["Mercado", "Mercadinho"]
const FILTRO_ABA: Record<Aba, ((l: Loja) => boolean) | null> = {
  inicio: null,
  restaurantes: l => ![...MERCADO, "Bebidas", "Farmácia"].includes(l.categoria),
  mercados: l => MERCADO.includes(l.categoria),
  bebidas: l => l.categoria === "Bebidas",
}
const TITULO_ABA: Record<Aba, string> = { inicio: "Lojas", restaurantes: "Restaurantes", mercados: "Mercados", bebidas: "Bebidas" }

// Período do dia pela hora de Brasília (a Vercel e o celular podem estar em outro fuso)
const PERIODOS = {
  cafe:   { cats: ["Doces e Bolos", "Lanchonete", "Mercadinho", "Outros"], nome: /padaria|p[aã]o|caf[eé]|biscoit|bolo|doce|caseir|pamonh/i, titulo: "Pro café da manhã", comida: /p[aã]o|caf[eé]|bolo|salgad|coxinha|queijo|misto|torrada|tapioca|croissant|biscoit|rosca|broa|pamonha|cuscuz|cookie|esfiha|empada|pastel/i, bebida: /caf[eé]|cappuccino|suco|leite|vitamina|achocolat|ch[aá]\b|iogurte/i },
  almoco: { cats: ["Restaurante", "Carnes", "Saudável"], nome: /marmit|restaur|jantinha|almo|comida|fazenda/i, titulo: "Pro almoço de hoje", comida: /marmita|prato|execut|almo[cç]o|arroz|feij|frango|carne|costela|fil[eé]|parmeg|strogon|peixe|bife|refei|tutu|macarron|lasanha|bisteca|lingui[cç]a|galinhada|escondidinho/i, bebida: /refri|coca|guaran|suco|[aá]gua|lata|350ml|600ml/i },
  tarde:  { cats: ["Doces e Bolos", "Lanchonete", "Outros"], nome: /a[cç]a[ií]|sorvet|doce|bolo|pastel|caseir|brownie|confeit|pipoca|pamonh/i, titulo: "Pro lanche da tarde", comida: /a[cç]a[ií]|sorvete|milk|shake|bolo|doce|brownie|pastel|coxinha|salgad|pipoca|cookie|torta|p[aã]o de mel|creme|brigadeiro|trufa|cupcake|crepe/i, bebida: /suco|refri|milk|ch[aá]\b|coco|coca|guaran|caf[eé]/i },
  jantar: { cats: ["Pizza", "Italiana", "Hambúrguer", "Lanches", "Japonês", "Restaurante"], nome: /pizza|burg|lanche|sushi|jantinha|petisc|gastrobar|espet/i, titulo: "Pro jantar", comida: /pizza|hamb[uú]rg|x-|lanche|burg|sushi|temaki|espet|jantinha|por[cç][aã]o|petisc|caldo|calabresa|batata|passarinho|mandioca|picanha|frango|combo|hot ?dog|cachorro/i, bebida: /refri|coca|cerveja|suco|guaran|2l|2 litros|lata|heineken|brahma|skol|chopp/i },
}
const RITMO = ["c", "c", "c", "b", "c", "c", "b", "b", "c", "c", "c", "b"]
function agoraBrt() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(new Date())
  const g = (t: string) => p.find(x => x.type === t)?.value ?? ""
  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { ymd: `${g("year")}-${g("month")}-${g("day")}`, hora: Number(g("hour")), dia: dias[g("weekday")] ?? 0 }
}
function periodoAgora(h: number): keyof typeof PERIODOS { return h >= 5 && h < 11 ? "cafe" : h >= 11 && h < 15 ? "almoco" : h >= 15 && h < 18 ? "tarde" : "jantar" }
function sorteador(txt: string) { let h = 2166136261; for (const c of txt) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return () => (h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0, h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0, ((h ^= h >>> 16) >>> 0) / 4294967296) }
function embaralha<T>(arr: T[], rnd: () => number) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const ehBebida = (n: string) => /coca|refri|guaran|suco|[aá]gua|cerveja|lata|gatorade|energ|2l|600ml|350ml|\bml\b|leite|ch[aá]\b|vitamina|caf[eé]|cappuccino|achocolat|heineken|brahma|skol|chopp|milk/i.test(n) && !/bolo|p[aã]o|torta/i.test(n)
const ehPetiscaria = (l: Loja) => /petiscaria t/i.test(l.nome)
// "Famosos no Chegô": nomes exatos das lojas, na ordem em que aparecem (Lucas, 05/11/2026)
const FAMOSOS_FIXOS = ["Petiscaria Tábua dos Sabores", "Winderson Lanches", "Armazém Gastrobar", "BISCOITO DURO CAFE", "Padaria Flor de Ipê", "TRILHAS DA AMAZONIA", "QUINTAL GASTROBAR E HAMBURGUERIA", "Cantinho da Danny", "Pizzaria Bom Demais"]
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
const tempo = (l: Loja) => `${l.tempo_min ?? 30}-${l.tempo_max ?? 50} min`
const nota = (v: number) => v.toFixed(1).replace(".", ",")

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

const IcPino = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" /></svg>
const IcSino = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
const IcBusca = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7.5" /><path d="m20.5 20.5-4.2-4.2" /></svg>

export default function InicioNovo({ lojas, loading, logado, endereco, onEndereco, pedidoAtivo, userCoords, avisos }: {
  avisos?: React.ReactNode;
  lojas: Loja[]
  loading: boolean
  logado: boolean
  endereco: string
  onEndereco: () => void
  pedidoAtivo: { codigo: string; id: string } | null
  userCoords: { lat: number; lng: number } | null
}) {
  const [aba, setAba] = useState<Aba>("inicio")
  const [filtros, setFiltros] = useState<Set<string>>(new Set())
  const [favs, setFavs] = useState<string[]>([])
  useEffect(() => { setFavs(lerFavoritas()) }, [])
  const [prods, setProds] = useState<Prod[]>([])
  const [slide, setSlide] = useState(0)
  const toqueX = useRef(0)
  const agora = useMemo(agoraBrt, [])
  const per = PERIODOS[periodoAgora(agora.hora)]

  // Produtos com foto das lojas abertas: só leitura, pra vitrine "Pra matar a fome agora"
  const abertasIds = useMemo(() => lojas.filter(l => l.aberto).map(l => l.id).sort().join(","), [lojas])
  const petiscaria = useMemo(() => lojas.find(ehPetiscaria) ?? null, [lojas])
  // Plano Black logo abaixo da Petiscaria nos destaques (pedido do Lucas, 03/11/2026: Winderson Lanches),
  // na ordem do ordem_home definido no admin
  const blacks = useMemo(() => lojas.filter(l => l.plano === "black" && !ehPetiscaria(l))
    .sort((a, b) => ((a as { ordem_home?: number | null }).ordem_home ?? 99) - ((b as { ordem_home?: number | null }).ordem_home ?? 99)), [lojas])
  useEffect(() => {
    const ids = abertasIds ? abertasIds.split(",") : []
    if (petiscaria && !ids.includes(petiscaria.id)) ids.push(petiscaria.id)
    if (!ids.length) { setProds([]); return }
    // Só os "Mais pedidos" de cada loja (pedido do Lucas, 20/10/2026): mesma regra da página da loja (lib/maisPedidos)
    // O banco devolve no máximo 1000 linhas por vez: busca em páginas pra não cortar o cardápio de ninguém
    const todosProdutos = async () => {
      const out: Prod[] = []
      for (let i = 0; i < 20000; i += 1000) {
        const { data } = await supabase.from("produtos").select("id, loja_id, categoria_id, nome, descricao, preco, preco_antigo, ncm, ordem, foto_url, adicionais, dias_semana")
          .in("loja_id", ids).eq("disponivel", true).order("preco").order("nome").order("id").range(i, i + 999)
        out.push(...((data as Prod[]) ?? [])); if ((data ?? []).length < 1000) break
      }
      return out
    }
    Promise.all([todosProdutos(), supabase.from("categorias_produto").select("id, loja_id, nome").in("loja_id", ids)]).then(([todos, { data: cats }]) => {
      const porL = new Map<string, Prod[]>()
      for (const p of todos) { if (!porL.has(p.loja_id)) porL.set(p.loja_id, []); porL.get(p.loja_id)!.push(p) }
      const catL = (id: string) => ((cats as { id: string; loja_id: string; nome: string }[]) ?? []).filter(c => c.loja_id === id)
      const mais = [...porL.entries()].flatMap(([id, ps]) => maisPedidos(ps, catL(id), lojas.find(l => l.id === id)?.categoria))
      setProds(mais.filter(p => p.foto_url && precoExibicao(p).valor > 0 && (!p.dias_semana?.length || p.dias_semana.includes(agora.dia))))
    })
  }, [abertasIds, petiscaria, agora.dia]) // eslint-disable-line react-hooks/exhaustive-deps

  const porLoja = useMemo(() => {
    const m = new Map<string, Prod[]>()
    for (const p of prods) { if (!m.has(p.loja_id)) m.set(p.loja_id, []); m.get(p.loja_id)!.push(p) }
    return m
  }, [prods])

  // Vitrine do período: Petiscaria primeiro (pedido do Lucas), depois uma loja diferente por item,
  // intercalando comida e bebida. Sorteio fixo por dia + período (não muda a cada abertura).
  const pratos = useMemo(() => {
    const rnd = sorteador(agora.ymd + periodoAgora(agora.hora))
    const pref = (l: Loja) => (per.cats.includes(l.categoria) ? 2 : 0) + (per.nome.test(l.nome) ? 3 : 0)
    const abertas = embaralha(lojas.filter(l => l.aberto && !ehPetiscaria(l) && !blacks.includes(l)), rnd).sort((a, b) => pref(b) - pref(a)).sort((a, b) => Number(ehSempreUltima(a)) - Number(ehSempreUltima(b)))
    const usados = new Set<string>(), qtd: Record<string, number> = {}
    const itens: { l: Loja; p: Prod; beb: boolean }[] = []
    for (const pet of [petiscaria, ...blacks]) {
      if (!pet || !pet.aberto) continue
      const ps = (porLoja.get(pet.id) ?? []).filter(p => !ehBebida(p.nome))
      const ok = ps.filter(p => per.comida.test(p.nome + " " + (p.descricao ?? "")))
      const lista = ok.length ? ok : ps
      const p = lista.length ? lista[Math.floor(rnd() * lista.length)] : null
      if (p) { usados.add(p.id); qtd[pet.id] = 1; itens.push({ l: pet, p, beb: false }) }
    }
    // Promoção "de/por" de loja aberta vem logo depois da Petiscaria (pedido do Lucas, 20/10/2026)
    for (const l of abertas) for (const p of porLoja.get(l.id) ?? []) {
      if (itens.length >= 3 + blacks.length || usados.has(p.id) || !(Number(p.preco_antigo) > Number(p.preco))) continue
      usados.add(p.id); qtd[l.id] = (qtd[l.id] ?? 0) + 1; itens.push({ l, p, beb: false })
    }
    // Prato do dia também ganha lugar na frente (pedido do Lucas, 21/10/2026): produto marcado pra UM dia só
    // da semana (marmita de quarta, promoção de sexta), hoje, e que combina com o período (marmita no almoço,
    // pizza no jantar). Produto marcado pra vários dias é só o horário da loja, não prato do dia.
    for (const l of abertas) for (const p of porLoja.get(l.id) ?? []) {
      if (itens.length >= 4 + blacks.length || usados.has(p.id) || (qtd[l.id] ?? 0) >= 1) continue
      if (p.dias_semana?.length !== 1 || p.dias_semana[0] !== agora.dia || !per.comida.test(p.nome + " " + (p.descricao ?? ""))) continue
      if (per !== PERIODOS.jantar && /pizza|burg|sushi|temaki/i.test(p.nome)) continue
      usados.add(p.id); qtd[l.id] = (qtd[l.id] ?? 0) + 1; itens.push({ l, p, beb: false })
    }
    const pega = (f: (p: Prod) => boolean, max: number) => {
      for (const l of abertas) {
        if ((qtd[l.id] ?? 0) >= max) continue
        const op = (porLoja.get(l.id) ?? []).filter(p => !usados.has(p.id) && f(p))
        const p = op.length ? op[Math.floor(rnd() * op.length)] : null
        if (p) { usados.add(p.id); qtd[l.id] = (qtd[l.id] ?? 0) + 1; return { l, p, beb: ehBebida(p.nome) } }
      }
      return null
    }
    for (const r of RITMO.slice(itens.length)) {
      const tenta = (m: number) => r === "c"
        ? (pega(p => !ehBebida(p.nome) && per.comida.test(p.nome), m) || pega(p => !ehBebida(p.nome) && per.comida.test(p.nome + " " + (p.descricao ?? "")), m) || pega(p => !ehBebida(p.nome), m))
        : (pega(p => ehBebida(p.nome) && per.bebida.test(p.nome), m) || pega(p => ehBebida(p.nome), m))
      const x = tenta(1) || tenta(2)
      if (x) itens.push(x)
    }
    return itens
  }, [lojas, porLoja, petiscaria, blacks, per, agora])

  // Famosos: lista fixa escolhida pelo Lucas, nesta ordem (05/11/2026). Se alguma loja sair do
  // app ou ficar sem logo, completa com as que mais venderam na semana passada (/api/lojas/mais-vendidas).
  const [ranking, setRanking] = useState<string[]>([])
  useEffect(() => {
    fetch("/api/lojas/mais-vendidas").then(r => r.ok ? r.json() : { ids: [] }).then(j => setRanking(Array.isArray(j.ids) ? j.ids : [])).catch(() => {})
  }, [])
  const famosos = useMemo(() => {
    const comLogo = lojas.filter(l => l.logo_url)
    const porNome = new Map(comLogo.map(l => [semAcento(l.nome), l]))
    const fixos = FAMOSOS_FIXOS.map(n => porNome.get(semAcento(n))).filter((l): l is Loja => !!l)
    const porId = new Map(comLogo.map(l => [l.id, l]))
    const top = ranking.map(id => porId.get(id)).filter((l): l is Loja => !!l && !fixos.includes(l))
    return [...fixos, ...top].slice(0, FAMOSOS_FIXOS.length)
  }, [lojas, ranking])

  // Carrossel: só o que existe de verdade no app (nada de promoção que não foi decidida)
  const fotoLanche = useMemo(() => {
    for (const l of lojas.filter(x => ["Lanches", "Hambúrguer", "Lanchonete"].includes(x.categoria))) {
      const p = (porLoja.get(l.id) ?? []).find(p => /^x-|burger|burguer/i.test(p.nome))
      if (p?.foto_url) return p.foto_url
    }
    return null
  }, [lojas, porLoja])
  const fotoPet = petiscaria ? (porLoja.get(petiscaria.id) ?? []).find(p => !ehBebida(p.nome))?.foto_url ?? null : null
  // Carrossel com as artes do Chegô (enviadas pelo Lucas em 20/10/2026). "Explorar lojas" e
  // "Pedir agora" descem pra lista de lojas; "Fazer meu pedido" abre a Petiscaria.
  type Slide = { foto: string; alt: string; href?: string; externo?: boolean }
  const slides: Slide[] = [
    { foto: "/banners/home-1.jpg", alt: "Aragoiânia tem um jeitinho que só a gente entende. E agora tem um delivery feito para chamar de nosso. Explorar lojas" },
    { foto: "/banners/home-2.jpg", alt: "Aragoiânia tem história, tem sabor e tem gente que faz acontecer. O Chegô nasceu para valorizar tudo isso. Explorar lojas" },
    { foto: "/banners/home-3.jpg", alt: "Petiscaria Tábua dos Sabores: tem sabor que conquista e que vira tradição. Fazer meu pedido", href: petiscaria ? `/restaurante/${petiscaria.id}` : undefined },
    { foto: "/banners/home-4.jpg", alt: "Quem compra daqui faz nossa cidade crescer. Cada pedido fortalece um negócio e movimenta a economia de Aragoiânia. Explorar lojas" },
    { foto: "/banners/home-5.jpg", alt: "Da nossa cidade, pra sua casa! Gente daqui, entregando o melhor da nossa terra. Pedir agora" },
    // Anunciantes parceiros (artes enviadas pelo Lucas em 11/11/2026): o toque abre o WhatsApp deles
    { foto: "/banners/parceiro-optimus.jpg", alt: "Optimus Network, internet fibra: qual é o seu nível de conexão? 700 mega, 800 mega ou 1 giga. Assine já pelo WhatsApp (62) 98402-2964", href: "https://wa.me/5562984022964", externo: true },
    { foto: "/banners/parceiro-megasoft.jpg", alt: "MegaSoft Sistemas: software completo para mercados, pit dogs, restaurantes, bares e distribuidoras. Solicite uma demonstração pelo WhatsApp (62) 99659-1034", href: "https://wa.me/5562996591034", externo: true },
  ]

  useEffect(() => {
    const t = setInterval(() => setSlide(i => (i + 1) % slides.length), 4000)
    return () => clearInterval(t)
  }, [slides.length])

  const listaRef = useRef<HTMLDivElement>(null)
  const irParaLojas = () => setTimeout(() => listaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
  const toggleFiltro = (k: string) => setFiltros(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  let lista = lojas.filter(l => !FILTRO_ABA[aba] || FILTRO_ABA[aba]!(l))
  if (filtros.has("abertas")) lista = lista.filter(l => l.aberto)
  if (filtros.has("gratis")) lista = lista.filter(l => !(Number(l.taxa_entrega ?? 0) > 0))
  if (filtros.has("rapido")) lista = lista.filter(l => (l.tempo_max ?? 60) <= 40)
  if (filtros.has("nota")) lista = lista.filter(l => (l.nota_media ?? 0) >= 4.7)
  lista = ultimaPorUltimo([...lista.filter(l => l.aberto), ...lista.filter(l => !l.aberto)])
  const qtdAbertas = lojas.filter(l => l.aberto).length

  const distancia = (l: Loja) => {
    const lat = (l as any).lat as number | null, lng = (l as any).lng as number | null
    if (!userCoords || !lat || !lng) return ""
    const km = haversineKm(userCoords, { lat, lng })
    return km < 1 ? `, ${Math.round(km * 1000)} m` : `, ${km.toFixed(1).replace(".", ",")} km`
  }

  return (
    <div className="cn" style={{ paddingBottom: 96 }}>
      <div className="if-cab">
        <div className="if-linha">
          <img className="if-logo" src="/logo-chego-transparente.png" alt="Chegô" />
          <button className="if-end" onClick={onEndereco} aria-label="Trocar endereço"><IcPino /><span>{endereco}</span> ▾</button>
          {logado
            ? <Link className="if-sino" href="/cliente/notificacoes" aria-label="Notificações"><IcSino /></Link>
            : <Link className="if-entrar" href="/cliente/entrar">Entrar</Link>}
        </div>
        <div className="if-abas" role="tablist">
          {ABAS.map(([k, n]) => <button key={k} role="tab" aria-selected={aba === k} onClick={() => { setAba(k); if (k !== "inicio") irParaLojas() }}>{n}</button>)}
        </div>
      </div>

      <Link className="if-busca" href="/busca"><IcBusca /> Buscar item ou loja</Link>

      {/* Cupom de primeiro pedido e "Ativar notificações" ficam logo abaixo da busca (01/11/2026) */}
      {avisos && <div className="if-avisos">{avisos}</div>}

      {pedidoAtivo && (
        <Link className="andamento" href={`/pedido/${pedidoAtivo.codigo}`}>
          <span className="mot">🛵</span>
          <span style={{ flex: 1 }}><b>Pedido #{pedidoAtivo.codigo} em andamento</b><small>Toque pra acompanhar</small></span>
          <span>›</span>
        </Link>
      )}

      {aba === "inicio" && (
        <>
          <div className="if-banner imagens"
            onTouchStart={e => { toqueX.current = e.touches[0].clientX }}
            onTouchEnd={e => {
              const dx = e.changedTouches[0].clientX - toqueX.current
              if (dx < -40) setSlide(i => (i + 1) % slides.length)
              else if (dx > 40) setSlide(i => (i - 1 + slides.length) % slides.length)
            }}>
            {slides.map((s, i) => {
              const corpo = <img className="sl-img" src={s.foto} alt={s.alt} loading={i === 0 ? "eager" : "lazy"} />
              return s.href && s.externo
                ? <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className={`sl ${i === slide ? "on" : ""}`} aria-hidden={i !== slide} tabIndex={i === slide ? 0 : -1}>{corpo}</a>
                : s.href
                ? <Link key={i} href={s.href} className={`sl ${i === slide ? "on" : ""}`} aria-hidden={i !== slide} tabIndex={i === slide ? 0 : -1}>{corpo}</Link>
                : <button key={i} className={`sl ${i === slide ? "on" : ""}`} aria-hidden={i !== slide} tabIndex={i === slide ? 0 : -1} onClick={irParaLojas}>{corpo}</button>
            })}
            <div className="pts">{slides.map((_, i) => <i key={i} className={i === slide ? "on" : ""} />)}</div>
          </div>

          {famosos.length > 0 && (
            <>
              <div className="if-tit"><b>Famosos no Chegô</b></div>
              <div className="if-famosos">
                {famosos.map(l => (
                  <Link key={l.id} href={`/restaurante/${l.id}`}>
                    <img src={l.logo_url} alt="" loading="lazy" />
                    {l.nome.length > 18 ? l.nome.slice(0, 17) + "…" : l.nome}
                  </Link>
                ))}
              </div>
            </>
          )}

          {pratos.length > 0 && (
            <>
              <div className="if-tit"><span><b>Pra matar a fome agora</b><small className="periodo">{per.titulo}</small></span></div>
              <div className="if-pratos">
                {pratos.map(({ l, p, beb }) => {
                  const { valor, aPartir } = precoExibicao(p)
                  return (
                    <Link key={p.id} className="if-prato" href={`/restaurante/${l.id}?produto=${p.id}`}>
                      <span className="if-im"><img src={p.foto_url!} alt="" loading="lazy" />{beb && <span className="tag-beb">Bebida</span>}</span>
                      <b>{p.nome}</b>
                      <PrecoPromo produtoId={p.id} valor={valor} aPartir={aPartir} normal={<span className="v">{aPartir && <small>a partir de </small>}{brl(valor)}</span>} />
                      <small className="lj">{l.nome}</small>
                    </Link>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      <div ref={listaRef} style={{ scrollMarginTop: 110 }}>
        <div className="if-tit"><b>{TITULO_ABA[aba]}</b><span className="mut" style={{ fontSize: 13 }}>{qtdAbertas} {qtdAbertas === 1 ? "aberta" : "abertas"} agora</span></div>
        <div className="filtros">
          {([["abertas", "Abertas agora"], ["rapido", "Até 40 min"], ["nota", "Nota 4,7+"]] as const).map(([k, n]) => (
            <button key={k} className="chip" aria-pressed={filtros.has(k)} onClick={() => toggleFiltro(k)}>{n}</button>
          ))}
        </div>
        {loading ? (
          <div className="vazio">Carregando lojas…</div>
        ) : lista.length === 0 ? (
          <div className="vazio">Nenhuma loja com esses filtros.</div>
        ) : lista.map((l, i) => (
          <div key={l.id}>
            {i > 0 && <div className="divisor" />}
            <Link className={`loja-l ${l.aberto ? "" : "fechada"}`} href={`/restaurante/${l.id}`}>
              {l.logo_url ? <img className="logo" src={l.logo_url} alt="" loading="lazy" /> : <span className="logo" />}
              {/* Linha da loja igual à proposta: dados corridos com "·" e o coração de favorito */}
              <span className="info">
                <b>{l.nome}</b>
                <span className="meta">
                  {l.nota_media ? <><span className="estrela">★</span> {nota(Number(l.nota_media))} · </> : ""}{l.categoria} · {l.cidade || "Aragoiânia"}{" "}
                  {/* Sem o valor do frete na lista (pedido do Lucas, 20/10/2026): ele aparece na loja e na sacola */}
                  {l.aberto ? tempo(l) : "Fechada agora"}
                </span>
              </span>
              <span role="button" tabIndex={0} className="fav" aria-label={favs.includes(l.id) ? "Tirar dos favoritos" : "Salvar nos favoritos"} aria-pressed={favs.includes(l.id)}
                onClick={e => { e.preventDefault(); e.stopPropagation(); alternarFavorita(l.id); setFavs(lerFavoritas()) }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill={favs.includes(l.id) ? "var(--pimenta)" : "none"} stroke={favs.includes(l.id) ? "var(--pimenta)" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7.5-4.8-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.2 12 20 12 20z" /></svg>
              </span>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
