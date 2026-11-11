"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { liberarSom, onSomLiberado, somLiberado, tocaSomPedido } from "@/lib/somPedido"
import { Ico } from "./_icones"
import "./loja-novo.css"
import "./loja-app.css"

// Menu do painel no layout novo (proposta aprovada, 20/10/2026). Reembolsos saíram (quem decide
// é o admin) e o Suporte virou o botão do mascote no canto da tela.
type ItemMenu = { href: string; ic: string; label: string; frase: string; cor: string }
const MENU: ItemMenu[] = [
  { href: "/loja", ic: "pedidos", label: "Pedidos", frase: "Aceite, prepare e acompanhe até a porta do cliente.", cor: "#D7261E" },
  { href: "/loja/entrega-avulsa", ic: "mais", label: "Lançar pedido", frase: "Pedido do WhatsApp ou telefone, ou só chamar motoboy.", cor: "#6B3FC4" },
  { href: "/loja/cardapio", ic: "cardapio", label: "Cardápio", frase: "O que o cliente vê no app: produtos, fotos, preços e opções.", cor: "#E8730C" },
  { href: "/loja/dashboard", ic: "grafico", label: "Desempenho", frase: "Como a loja está vendendo e onde dá pra melhorar.", cor: "#1F5FBF" },
  { href: "/loja/financeiro", ic: "dinheiro", label: "Financeiro", frase: "Seu dinheiro: repasse toda sexta, na sua chave Pix.", cor: "#1E8A4C" },
  { href: "/loja/avaliacoes", ic: "estrela", label: "Avaliações", frase: "O que os clientes acharam. Responder aumenta a confiança.", cor: "#E8A400" },
  { href: "/loja/cupons", ic: "cupom", label: "Cupons", frase: "Descontos que a loja banca pra atrair pedido.", cor: "#C2185B" },
  { href: "/loja/historico", ic: "hist", label: "Histórico", frase: "Todos os pedidos que já passaram pela loja.", cor: "#5D5A53" },
  { href: "/loja/perfil", ic: "loja", label: "Loja e horários", frase: "Quando abre, como recebe pedido e os dados da loja.", cor: "#22201C" },
]
// Telas que existem mas não estão no menu principal da proposta: ficam no fim do menu
const EXTRAS: ItemMenu[] = [
  { href: "/loja/fiscal", ic: "pedidos", label: "Nota fiscal", frase: "Dados fiscais e emissão de NFC-e.", cor: "#5D5A53" },
]
const NAV_CEL = ["/loja", "/loja/cardapio", "/loja/dashboard", "/loja/financeiro"]

const WHATSAPP_SUPORTE = "https://wa.me/5562993910717"

export default function LojaLayoutClient({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const { sessao, authLoading, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [lojaStatus, setLojaStatus] = useState<string | null>(null)
  const [pedidosPendentes, setPedidosPendentes] = useState(0)
  const [loja, setLoja] = useState<{ nome: string; logo_url: string | null; aberto: boolean; tempo_min: number; tempo_max: number } | null>(null)
  const [mudandoLoja, setMudandoLoja] = useState(false)

  // Barra de cima: aberta/fechada e tempo de preparo (o tempo que o cliente vê no app)
  useEffect(() => {
    if (sessao?.role !== "lojista") return
    const id = sessao.loja_id
    const ler = () => supabase.from("lojas").select("nome, logo_url, aberto, tempo_min, tempo_max").eq("id", id).single()
      .then(({ data }) => { if (data) setLoja({ ...(data as any), tempo_min: Number((data as any).tempo_min) || 30, tempo_max: Number((data as any).tempo_max) || 50 }) })
    ler()
    const iv = setInterval(ler, 30_000)
    return () => clearInterval(iv)
  }, [sessao])
  async function salvarLoja(campos: Record<string, unknown>) {
    setMudandoLoja(true)
    const r = await fetch("/api/loja/atualizar", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(campos) }).catch(() => null)
    if (r?.ok) setLoja(l => l ? { ...l, ...(campos as any) } : l)
    setMudandoLoja(false)
  }
  const mudarTempo = (d: number) => { if (!loja) return; const min = Math.max(10, loja.tempo_min + d), max = Math.max(min + 5, loja.tempo_max + d); salvarLoja({ tempo_min: min, tempo_max: max }) }

  // Badge de "Pedidos" na bottom nav mobile (spec do redesign do Dashboard, seção 17) —
  // só conta novos pedidos (status pendente), que é o que realmente exige atenção
  // imediata da loja. Leve o bastante pra rodar em paralelo ao polling da própria tela
  // de Pedidos (que já existe e não foi alterado).
  useEffect(() => {
    if (sessao?.role !== "lojista") return
    const loja_id = sessao.loja_id
    async function contarPendentes() {
      const { count } = await supabase.from("pedidos").select("id", { count: "exact", head: true })
        .eq("loja_id", loja_id).eq("status", "pendente")
      setPedidosPendentes(count ?? 0)
    }
    contarPendentes()
    let rtTimer: ReturnType<typeof setTimeout> | null = null
    const iv = setInterval(contarPendentes, 10_000)
    // Realtime: atualiza a contagem na hora em qualquer tela de /loja (não só em Pedidos)
    const ch = supabase.channel(`loja-alarme-${loja_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `loja_id=eq.${loja_id}` },
        () => { // junta rajadas de mudanças numa recontagem só (incidente 31/10/2026)
          if (rtTimer) clearTimeout(rtTimer)
          rtTimer = setTimeout(() => { rtTimer = null; contarPendentes() }, 1000)
        })
      .subscribe()
    // Volta pra aba depois de um tempo: o navegador pode ter pausado timers/conexão
    const onVis = () => { if (document.visibilityState === "visible") contarPendentes() }
    document.addEventListener("visibilitychange", onVis)
    // Push do SW (app em segundo plano) → reconta na hora
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === "push-received" && String(ev.data?.tag ?? "").startsWith("pedido-loja-")) {
        contarPendentes(); tocaSomPedido()
      }
    }
    navigator.serviceWorker?.addEventListener("message", onMsg)
    return () => {
      clearInterval(iv); supabase.removeChannel(ch)
      document.removeEventListener("visibilitychange", onVis)
      navigator.serviceWorker?.removeEventListener("message", onMsg)
    }
  }, [sessao])

  // Alarme: enquanto houver pedido novo aguardando aceite, toca a cada 7s em
  // QUALQUER tela do painel. Antes só tocava com a tela "Pedidos" aberta —
  // loja parada no Dashboard/Cardápio não ouvia nada.
  useEffect(() => {
    if (pedidosPendentes === 0) return
    tocaSomPedido()
    const id = setInterval(() => tocaSomPedido(), 7_000)
    return () => clearInterval(id)
  }, [pedidosPendentes])

  // Liberação do áudio: o navegador bloqueia som até um clique/tecla. Antes só
  // tentava no 1º clique e desistia; página reaberta/recarregada sem clique
  // ficava muda sem nenhum aviso. Agora tenta ao abrir, em todo clique/tecla
  // até conseguir, e mostra o aviso enquanto estiver bloqueado.
  const [somOk, setSomOk] = useState(true)
  useEffect(() => {
    if (sessao?.role !== "lojista") return
    setSomOk(somLiberado())
    const off = onSomLiberado(setSomOk)
    liberarSom().then(ok => setSomOk(ok))
    const tentar = () => { liberarSom() }
    window.addEventListener("pointerdown", tentar)
    window.addEventListener("keydown", tentar)
    return () => {
      off()
      window.removeEventListener("pointerdown", tentar)
      window.removeEventListener("keydown", tentar)
    }
  }, [sessao?.role])

  useEffect(() => {
    if (!authLoading && (!sessao || sessao.role !== "lojista")) {
      if (path !== "/loja/entrar") router.push("/loja/entrar")
    }
  }, [sessao, authLoading, router, path])

  // Verifica status da loja e validade do cookie de sessão
  useEffect(() => {
    if (sessao?.role !== "lojista" || !(sessao as any).loja_id) return
    fetch(`/api/loja/status-loja`, { credentials: "include" })
      .then(r => {
        if (r.status === 401 || r.status === 403) {
          logout()
          router.push("/loja/entrar")
          return null
        }
        return r.json()
      })
      .then(d => { if (d?.status) setLojaStatus(d.status) })
      .catch(() => {})
  }, [sessao])

  // Registra push subscription para receber alertas de novos pedidos
  useEffect(() => {
    if (sessao?.role !== "lojista" || typeof window === "undefined") return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    const lojaId = sessao.loja_id

    function urlB64(b64: string) {
      const pad = "=".repeat((4 - (b64.length % 4)) % 4)
      const raw = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/")
      return Uint8Array.from([...window.atob(raw)].map(c => c.charCodeAt(0)))
    }

    async function registerPush() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js")
        await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()
        const sub = existing ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64(vapidKey!),
        })
        await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "subscribe-loja", loja_id: lojaId, subscription: sub.toJSON() }),
        })
      } catch {}
    }

    if (Notification.permission === "granted") {
      registerPush()
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then(p => { if (p === "granted") registerPush() })
    }
  }, [sessao?.role, (sessao as any)?.loja_id])

  // Tela de login SEMPRE sem a casca do painel (barra de abrir/fechar e menu de baixo), mesmo
  // com sessão antiga guardada no celular (print do Lucas, 21/10/2026: login aparecia dentro do painel)
  if (path === "/loja/entrar") return <>{children}</>

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9CA3AF" }}>Verificando acesso...</p>
      </div>
    )
  }

  if (!sessao || sessao.role !== "lojista") {
    if (path === "/loja/entrar") return <>{children}</>
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9CA3AF" }}>Verificando acesso...</p>
      </div>
    )
  }

  // Tela de bloqueio por inadimplência
  if (lojaStatus === "suspenso") {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "white", borderRadius: 20, padding: "40px 32px", textAlign: "center", maxWidth: 400, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1.5px solid #FECACA" }}>
          <p style={{ fontSize: 44, marginBottom: 12 }}>🔒</p>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#111827", marginBottom: 8 }}>Acesso suspenso</h2>
          <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, marginBottom: 20 }}>
            Sua mensalidade está em atraso. Regularize o pagamento para retomar o acesso ao sistema.
          </p>
          <div style={{ padding: "14px 16px", background: "#FEF2F2", borderRadius: 12, marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>Como regularizar:</p>
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
              Entre em contato com a equipe Chegô para realizar o pagamento e reativar seu acesso.
            </p>
          </div>
          <a href="https://wa.me/5562993910717" target="_blank" rel="noreferrer" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "13px 20px", borderRadius: 12, background: "#25D366", color: "white",
            fontSize: 14, fontWeight: 800, textDecoration: "none",
            boxShadow: "0 4px 12px rgba(37,211,102,0.3)",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            Falar com a equipe Chegô
          </a>
          <button onClick={() => { logout(); router.push("/loja/entrar") }} style={{
            marginTop: 12, padding: "10px", width: "100%", borderRadius: 10,
            border: "1px solid #E5E7EB", background: "white", color: "#9CA3AF",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            Sair da conta
          </button>
        </div>
      </div>
    )
  }

  function handleLogout() {
    logout()
    router.push("/loja/entrar")
  }

  const isActive = (href: string) => href === "/loja" ? path === "/loja" : path.startsWith(href)
  const atual = [...MENU, ...EXTRAS].find(m => isActive(m.href)) ?? MENU[0]
  const ehPedidos = path === "/loja"
  const itemMenu = (m: ItemMenu, fechar?: boolean) => (
    <Link key={m.href} href={m.href} aria-current={isActive(m.href)} onClick={() => fechar && setMenuOpen(false)}>
      <Ico n={m.ic} />{m.label}{m.href === "/loja" && pedidosPendentes > 0 && <span className="badge num">{pedidosPendentes}</span>}
    </Link>
  )

  return (
    <div className="lj">
      <div className="app">
        <aside className="lateral">
          <div className="lat-marca"><img src="/logo-chego.png" alt="" /><span><b>Chegô</b><small>Gestor da loja</small></span></div>
          <div className="lat-loja">{loja?.logo_url ? <img src={loja.logo_url} alt="" /> : <span style={{ width: 36, height: 36, borderRadius: 10, background: "#fff", flexShrink: 0 }} />}
            <span><b>{loja?.nome ?? sessao.loja_nome}</b><small>{loja ? (loja.aberto ? "Aberta, recebendo pedidos" : "Fechada") : ""}</small></span></div>
          <nav className="lat-nav">{MENU.map(m => itemMenu(m))}<div className="lat-sep" />{EXTRAS.map(m => itemMenu(m))}</nav>
          <div className="lat-pe"><button className="lin" style={{ color: "rgba(255,255,255,.7)", fontWeight: 700 }} onClick={handleLogout}><Ico n="sair" /> Sair</button></div>
        </aside>
        <div className="principal">
          {!somOk && (
            <button className="som-aviso" onClick={() => { liberarSom().then(ok => { if (ok) tocaSomPedido() }) }}>
              <Ico n="som" /> Toque aqui pra ligar o som dos pedidos
            </button>
          )}
          <header className="barra">
            <span className="tit">{ehPedidos ? "Pedidos" : ""}</span>
            {loja && (
              <button className={`loja-st ${loja.aberto ? "aberta" : "fechada"}`} disabled={mudandoLoja} onClick={() => salvarLoja({ aberto: !loja.aberto })}>
                {loja.aberto ? "Aberta, recebendo pedidos" : "Fechada"}<span className="sw" role="switch" aria-checked={loja.aberto} />
              </button>
            )}
            {loja && (
              <span className="preparo" title="Tempo de entrega que o cliente vê no app">
                <button onClick={() => mudarTempo(-5)} disabled={mudandoLoja} aria-label="Diminuir tempo">−</button>
                <b className="num">{loja.tempo_min}-{loja.tempo_max} min</b>
                <button onClick={() => mudarTempo(5)} disabled={mudandoLoja} aria-label="Aumentar tempo">+</button>
              </span>
            )}
            <button className={`ic-bt ${somOk ? "" : "off"}`} aria-label="Testar o som de pedido novo" title="Testar o som" onClick={() => { liberarSom().then(() => tocaSomPedido()) }}><Ico n="som" /></button>
            <Link className="ic-bt" href="/loja?impressora=1" aria-label="Impressora" title="Impressora"><Ico n="impressora" /></Link>
          </header>
          <main className="conteudo" style={{ ["--acento" as any]: atual.cor }}>
            {!ehPedidos && (
              <div className="sec-cab" style={{ ["--acento" as any]: atual.cor }}>
                <span className="sec-ic"><Ico n={atual.ic} /></span><span><b>{atual.label}</b><span>{atual.frase}</span></span>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>

      <nav className="nav-cel">
        {NAV_CEL.map(h => { const m = MENU.find(x => x.href === h)!; return (
          <Link key={h} href={h} aria-current={isActive(h)} className="nav-cel-bt"><Ico n={m.ic} />{h === "/loja/financeiro" ? "Dinheiro" : m.label}
            {h === "/loja" && pedidosPendentes > 0 && <span className="badge num">{pedidosPendentes}</span>}</Link>
        ) })}
        <button className="nav-cel-bt" aria-current={menuOpen || (!NAV_CEL.some(h => isActive(h)))} onClick={() => setMenuOpen(true)}><Ico n="loja" />Mais</button>
      </nav>

      {menuOpen && (
        <div className="veu on" onClick={() => setMenuOpen(false)}>
          <div className="mais-folha" onClick={e => e.stopPropagation()}>
            <div className="t20" style={{ marginBottom: 8 }}>Mais</div>
            <nav className="mais-l">{MENU.filter(m => !NAV_CEL.includes(m.href)).map(m => itemMenu(m, true))}{EXTRAS.map(m => itemMenu(m, true))}
              <button onClick={handleLogout}><Ico n="sair" />Sair</button></nav>
          </div>
        </div>
      )}

      {/* Suporte: o mascote no canto da tela abre o WhatsApp do suporte das lojas */}
      <a className="fab-sup" href={WHATSAPP_SUPORTE} target="_blank" rel="noreferrer" aria-label="Falar com o suporte do Chegô">
        <img src="/mascote/rosto.png" alt="" /><span className="fab-tx">Suporte</span>
      </a>
    </div>
  )
}
