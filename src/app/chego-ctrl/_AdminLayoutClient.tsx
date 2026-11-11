"use client"

// Painel admin 2.0 (proposta aprovada, 20/10/2026). Menu em 7 áreas, busca rápida (⌘K) e barra de
// baixo no celular. Login e notificações do admin continuam iguais aos de antes.
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { Ico } from "./_icones"
import "./adm-novo.css"
import "./adm-app.css"
import "./adm-escuro.css"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw     = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

type Item = { href: string; ic: string; label: string; frase: string; cor: string; oculto?: boolean }
// Uma cor por categoria, da paleta do Chegô (o botão principal é sempre pimenta)
const COR = { inicio: "#22201C", op: "#D7261E", din: "#1E8A4C", rede: "#1F5FBF", app: "#C98F00", qual: "#6B3FC4", aj: "#22201C" }
const AREAS: [string, Item[]][] = [
  ["", [{ href: "/chego-ctrl", ic: "inicio", label: "Início", frase: "O dia num olhar.", cor: COR.inicio }]],
  ["Operação", [
    { href: "/chego-ctrl/ao-vivo", ic: "op", label: "Ao vivo", frase: "O que está acontecendo agora e o despacho: mapa, pedidos parados e SOS.", cor: COR.op },
    { href: "/chego-ctrl/pedidos", ic: "pedidos", label: "Pedidos", frase: "A esteira inteira, do pagamento até a porta do cliente.", cor: COR.op },
    { href: "/chego-ctrl/despacho", ic: "despacho", label: "Despacho", frase: "Pedido parado? Escolha o motoboy na mão.", cor: COR.op, oculto: true },
  ]],
  ["Dinheiro", [
    { href: "/chego-ctrl/carteira", ic: "carteira", label: "Carteira", frase: "Quanto tem na conta, quanto é seu e cada entrada e saída.", cor: COR.din },
    { href: "/chego-ctrl/faturamento", ic: "grafico", label: "Repasses", frase: "Quanto pagar a cada loja e motoboy: borderô pra conferir, Pix pelo Asaas e comprovante.", cor: COR.din },
    { href: "/chego-ctrl/repasses", ic: "saque", label: "Pagamentos", frase: "Repasse das lojas, saques dos motoboys, adiantamentos e despesas, com comprovante.", cor: COR.din },
    { href: "/chego-ctrl/visao-financeira", ic: "dinheiro", label: "Fechamento diário", frase: "O relatório de cada dia: vendas, repasses e receita do Chegô.", cor: COR.din },
    { href: "/chego-ctrl/relatorio", ic: "grafico", label: "Relatório de vendas", frase: "Vendas e repasse por loja e por motoboy, pra imprimir ou exportar.", cor: COR.din, oculto: true },
    { href: "/chego-ctrl/reembolsos", ic: "reemb", label: "Reembolsos", frase: "Só o admin decide: devolver tudo, parte ou negar.", cor: COR.din, oculto: true },
    { href: "/chego-ctrl/mensalidades", ic: "mens", label: "Mensalidades", frase: "Planos das lojas e quem está em dia.", cor: COR.din },
    { href: "/chego-ctrl/caixa", ic: "dinheiro", label: "Caixa dos motoboys", frase: "Dinheiro de clientes que ficou com os motoboys.", cor: COR.din, oculto: true },
    { href: "/chego-ctrl/movimentos", ic: "dinheiro", label: "Movimentos", frase: "Retiradas, adiantamentos, acertos e o dinheiro que está com os motoboys.", cor: COR.din, oculto: true },
    { href: "/chego-ctrl/saques", ic: "saque", label: "Saques", frase: "Saques dos motoboys e adiantamentos de terça.", cor: COR.din, oculto: true },
  ]],
  ["Rede", [
    { href: "/chego-ctrl/lojas", ic: "loja", label: "Lojas", frase: "Cadastro, plano, contrato, cardápio e pendências de cada loja.", cor: COR.rede },
    { href: "/chego-ctrl/motoboys", ic: "moto", label: "Motoboys", frase: "Quem está rodando, documentos e aprovação.", cor: COR.rede },
    { href: "/chego-ctrl/escala", ic: "agenda", label: "Escala", frase: "Os horários de cada motoboy na semana. Eles veem o mesmo calendário no app.", cor: COR.rede },
    { href: "/chego-ctrl/clientes", ic: "clientes", label: "Clientes", frase: "Quem pede, quanto gasta, quem voltou e quantos entram no app.", cor: COR.rede, oculto: true },
    { href: "/chego-ctrl/documentos/loja", ic: "loja", label: "Documentos da loja", frase: "Contrato e documentos enviados pela loja.", cor: COR.rede, oculto: true },
    { href: "/chego-ctrl/documentos/motoboy", ic: "moto", label: "Documentos do motoboy", frase: "CNH, documento da moto e contrato.", cor: COR.rede, oculto: true },
  ]],
  ["App do cliente", [
    { href: "/chego-ctrl/vitrine", ic: "vitrine", label: "Vitrine", frase: "O que o cliente vê primeiro: Famosos e Mais pedidos.", cor: COR.app },
    { href: "/chego-ctrl/cupons", ic: "cupom", label: "Cupons", frase: "Descontos ativos e quem banca cada um.", cor: COR.app },
    { href: "/chego-ctrl/acessos", ic: "saude", label: "Acessos", frase: "Quantas pessoas entram no app, quantas criam conta e quantas pedem.", cor: COR.app },
    { href: "/chego-ctrl/notificacoes", ic: "sino", label: "Notificações", frase: "Mandar aviso no celular dos clientes, lojas ou motoboys.", cor: COR.app },
  ]],
  ["Qualidade", [
    { href: "/chego-ctrl/avaliacoes", ic: "estrela", label: "Avaliações", frase: "Notas das lojas e dos motoboys. As baixas pedem atenção.", cor: COR.qual },
  ]],
  ["Ajustes", [
    { href: "/chego-ctrl/taxas", ic: "frete", label: "Taxas e frete", frase: "Frete e taxas definidos pelo Chegô. As lojas não editam.", cor: COR.aj },
    { href: "/chego-ctrl/configuracoes", ic: "config", label: "Configurações", frase: "Regras da operação.", cor: COR.aj },
    { href: "/chego-ctrl/equipe", ic: "escudo", label: "Equipe e segurança", frase: "Quem acessa o painel e a proteção dos dados.", cor: COR.aj },
    { href: "/chego-ctrl/ferramentas", ic: "config", label: "Ferramentas", frase: "O que hoje é feito na mão, aqui com um botão.", cor: COR.aj },
  ]],
]
const TODOS = AREAS.flatMap(a => a[1])
const NAV_CEL = ["/chego-ctrl", "/chego-ctrl/ao-vivo", "/chego-ctrl/carteira", "/chego-ctrl/repasses"]

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const path     = usePathname()
  const router   = useRouter()
  const { sessao, authLoading, logout } = useAuth()
  const logoutRef = useRef(logout); logoutRef.current = logout
  const [maisAberto, setMaisAberto] = useState(false)
  const [busca, setBusca] = useState(false)
  const [online, setOnline] = useState<{ lojas: number; mbs: number } | null>(null)

  useEffect(() => {
    if (!authLoading && (!sessao || sessao.role !== "admin")) router.push("/chego-ctrl-login")
  }, [sessao, authLoading, router])

  // o aparelho diz "admin", mas o servidor precisa do cookie: confere ao abrir e quando o app volta pra frente
  useEffect(() => {
    if (!sessao || sessao.role !== "admin") return
    const sair = logoutRef.current
    let parado = false
    const conferir = async () => {
      try {
        const r = await fetch("/api/auth/admin", { credentials: "include", cache: "no-store" })
        if (r.status === 401 && !parado) { parado = true; await sair(); router.push("/chego-ctrl-login?expirou=1") }
      } catch {}
    }
    conferir()
    const aoVoltar = () => { if (document.visibilityState === "visible") conferir() }
    document.addEventListener("visibilitychange", aoVoltar)
    return () => document.removeEventListener("visibilitychange", aoVoltar)
  }, [sessao, router])

  useEffect(() => {
    if (!sessao || sessao.role !== "admin") return
    async function registerAdminPush() {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
        const reg = await navigator.serviceWorker.register("/sw.js")
        await reg.update()
        const perm = await Notification.requestPermission()
        if (perm !== "granted") return
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) return
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) })
        await fetch("/api/sos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub }) })
      } catch {}
    }
    registerAdminPush()
  }, [sessao])

  // "Ao vivo" na barra de cima: lojas abertas e motoboys online
  useEffect(() => {
    if (!sessao || sessao.role !== "admin") return
    const ler = async () => {
      const [{ count: l }, { count: m }] = await Promise.all([
        supabase.from("lojas").select("id", { count: "exact", head: true }).eq("aberto", true).eq("status", "ativo"),
        supabase.from("motoboys").select("id", { count: "exact", head: true }).eq("disponivel", true),
      ])
      setOnline({ lojas: l ?? 0, mbs: m ?? 0 })
    }
    ler(); const iv = setInterval(ler, 60_000); return () => clearInterval(iv)
  }, [sessao])

  useEffect(() => { setMaisAberto(false); setBusca(false) }, [path])
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setBusca(true) } if (e.key === "Escape") setBusca(false) }
    window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f)
  }, [])

  if (authLoading || !sessao || sessao.role !== "admin") {
    return <div className="adm" style={{ display: "grid", placeItems: "center" }}><p className="mut">Verificando acesso…</p></div>
  }

  function handleLogout() { logout(); router.push("/chego-ctrl-login") }
  const ativo = (h: string) => h === "/chego-ctrl" ? path === "/chego-ctrl" : path.startsWith(h)
  const atual = TODOS.filter(i => ativo(i.href)).sort((a, b) => b.href.length - a.href.length)[0] ?? TODOS[0]
  const semCab = path === "/chego-ctrl"

  return (
    <div className="adm">
      <div className="app">
        <aside className="lateral">
          <div className="lat-marca"><img src="/logo-chego.png" alt="" /><span><b>Chegô</b><small>Central de operações</small></span></div>
          <nav className="lat-nav">
            {AREAS.map(([sec, its]) => (
              <div key={sec || "ini"}>
                {sec && <div className="lat-sec">{sec}</div>}
                {its.filter(i => !i.oculto).map(i => <Link key={i.href} href={i.href} aria-current={ativo(i.href) && i.href === atual.href}><Ico n={i.ic} />{i.label}</Link>)}
              </div>
            ))}
          </nav>
          <div className="lat-pe"><button className="lin" style={{ color: "rgba(255,255,255,.7)", fontWeight: 700 }} onClick={handleLogout}><Ico n="sair" /> Sair</button></div>
        </aside>
        <div className="principal">
          <header className="barra">
            <button className="busca-bt" onClick={() => setBusca(true)}><Ico n="lupa" /><span>Buscar pedido, loja ou motoboy</span><kbd>⌘K</kbd></button>
            <span className="ao-vivo"><i />Ao vivo</span>
            {online && <span className="t14 mut num">{online.lojas} lojas abertas, {online.mbs} motoboys online</span>}
          </header>
          <main className="conteudo" style={{ ["--acento" as any]: atual.cor }}>
            {!semCab && <div className="sec-cab" style={{ ["--acento" as any]: atual.cor }}><span className="sec-ic"><Ico n={atual.ic} /></span><span><b>{atual.label}</b><span>{atual.frase}</span></span></div>}
            {children}
          </main>
        </div>
      </div>

      <nav className="nav-cel">
        {NAV_CEL.map(h => { const i = TODOS.find(x => x.href === h)!; return <Link key={h} href={h} aria-current={ativo(h) && i.href === atual.href} className="nav-cel-bt"><Ico n={i.ic} />{h === "/chego-ctrl/carteira" ? "Dinheiro" : i.label}</Link> })}
        <button className="nav-cel-bt" aria-current={maisAberto} onClick={() => setMaisAberto(true)}><Ico n="config" />Mais</button>
      </nav>
      {maisAberto && (
        <div className="veu on" onClick={() => setMaisAberto(false)}>
          <div className="mais-folha" onClick={e => e.stopPropagation()}>
            {AREAS.map(([sec, its]) => { const r = its.filter(i => !i.oculto && !NAV_CEL.includes(i.href)); if (!r.length) return null
              return <div key={sec}><div className="lat-sec" style={{ color: "var(--suave)" }}>{sec}</div><nav className="mais-l">{r.map(i => <Link key={i.href} href={i.href} aria-current={i.href === atual.href}><Ico n={i.ic} />{i.label}</Link>)}</nav></div> })}
            <nav className="mais-l"><button onClick={handleLogout}><Ico n="sair" />Sair</button></nav>
          </div>
        </div>
      )}
      {busca && <BuscaRapida onFechar={() => setBusca(false)} />}
    </div>
  )
}

// Busca rápida (⌘K): pedido pelo código, loja ou motoboy pelo nome
function BuscaRapida({ onFechar }: { onFechar: () => void }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [res, setRes] = useState<{ tipo: string; nome: string; ir: string }[]>([])
  useEffect(() => {
    const t = q.trim(); if (t.length < 2) { setRes([]); return }
    const id = setTimeout(async () => {
      const [ps, ls, ms] = await Promise.all([
        supabase.from("pedidos").select("id, codigo, status, loja:lojas(nome)").ilike("codigo", `%${t}%`).order("criado_em", { ascending: false }).limit(5),
        supabase.from("lojas").select("id, nome").ilike("nome", `%${t}%`).limit(5),
        supabase.from("motoboys").select("id, nome").ilike("nome", `%${t}%`).limit(5),
      ])
      setRes([
        ...(ps.data ?? []).map((p: any) => ({ tipo: "Pedido", nome: `#${p.codigo}, ${p.loja?.nome ?? ""}`, ir: `/chego-ctrl/pedidos?codigo=${p.codigo}` })),
        ...(ls.data ?? []).map((l: any) => ({ tipo: "Loja", nome: l.nome, ir: `/chego-ctrl/lojas?id=${l.id}` })),
        ...(ms.data ?? []).map((m: any) => ({ tipo: "Motoboy", nome: m.nome, ir: `/chego-ctrl/motoboys?id=${m.id}` })),
      ])
    }, 250)
    return () => clearTimeout(id)
  }, [q])
  return (
    <div className="veu on" onClick={onFechar}>
      <div className="busca-caixa" onClick={e => e.stopPropagation()}>
        <input className="busca-g" autoFocus placeholder="Buscar pedido, loja ou motoboy" value={q} onChange={e => setQ(e.target.value)} />
        <div className="busca-r">
          {res.map((r, i) => <button key={i} onClick={() => { router.push(r.ir); onFechar() }}><span className={`selo ${r.tipo === "Pedido" ? "cinza" : r.tipo === "Loja" ? "amarelo" : "azul"}`}>{r.tipo}</span>{r.nome}</button>)}
          {q.trim().length >= 2 && !res.length && <p className="t14 mut" style={{ padding: 10 }}>Nada encontrado.</p>}
        </div>
      </div>
    </div>
  )
}
