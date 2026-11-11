"use client"

// Início do admin 2.0 (20/10/2026): o dia num olhar. Cartão do dia com os 7 dias em barras,
// dinheiro no Asaas ao lado, o que precisa de você, pra onde foi o dinheiro e as lojas do dia.
// Reembolsos ficam aqui (cartão que abre a gaveta com tudo), sem categoria própria no menu.
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Divisao, R, SaldoAsaas, somaL, type Divisao as Div, type Linha } from "./_dinheiro"
import ReembolsosPainel from "./_ReembolsosPainel"

type Dia = { pago: number; pedidos: number; app: number }
type Dados = { hoje: string; alertas: { g: string; t: string; d: string; ir: string }[]; divisao: Div; serie: Record<string, Dia>; hojeLinhas: Linha[]; pedidosHojeTodos: number; topLojas: { id: string; v: number; nome: string; logo: string | null }[] }
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
const SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
const curto = (v: number) => v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : Math.round(v).toLocaleString("pt-BR")

function Variacao({ hoje, ontem, dinheiro }: { hoje: number; ontem: number; dinheiro?: boolean }) {
  if (!ontem && !hoje) return <span className="ini-var">igual a ontem</span>
  const d = hoje - ontem
  return <span className={`ini-var ${d > 0 ? "sobe" : d < 0 ? "desce" : ""}`}>{d === 0 ? "igual a ontem" : `${d > 0 ? "+" : "−"}${dinheiro ? R(Math.abs(d)) : Math.abs(d)} que ontem`}</span>
}

function Semana({ dias, serie, hoje }: { dias: string[]; serie: Record<string, Dia>; hoje: string }) {
  const mx = Math.max(...dias.map(k => serie[k].pago), 1)
  return (
    <div className="ini-sem" role="img" aria-label="Vendas dos últimos 7 dias">
      {dias.map(k => {
        const v = serie[k].pago, dt = new Date(`${k}T12:00:00Z`)
        return (
          <div key={k} className={`ini-col ${k === hoje ? "hoje" : ""}`} title={`${SEM[dt.getUTCDay()]} ${k.slice(8)}/${k.slice(5, 7)}: ${R(v)}, ${serie[k].pedidos} pedidos`}>
            <small className="num">{v ? curto(v) : ""}</small>
            <span className="ini-barra"><i style={{ height: `${Math.max(v ? 6 : 2, v / mx * 100)}%` }} /></span>
            <b>{k === hoje ? "hoje" : SEM[dt.getUTCDay()]}</b>
          </div>
        )
      })}
    </div>
  )
}

// Número que sobe até o valor novo (quando entra pedido, o saldo "conta" até o total)
function Contador({ v }: { v: number }) {
  const [x, setX] = useState(0), de = useRef(0)
  useEffect(() => {
    const ini = de.current, t0 = performance.now(), dur = 900; let raf = 0
    const passo = (t: number) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); setX(ini + (v - ini) * e); if (k < 1) raf = requestAnimationFrame(passo); else de.current = v }
    raf = requestAnimationFrame(passo); return () => cancelAnimationFrame(raf)
  }, [v])
  return <>{R(x)}</>
}

export default function InicioAdmin() {
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState("")
  useEffect(() => {
    const ler = () => fetch("/api/admin/inicio", { credentials: "include" }).then(r => r.ok ? r.json() : Promise.reject()).then(setD).catch(() => setErro("Não foi possível carregar o Início."))
    ler(); const iv = setInterval(ler, 20_000); return () => clearInterval(iv)
  }, [])
  // Reembolsos: resumo no cartão; a gaveta abre a lista completa pra decidir
  const [reemb, setReemb] = useState<{ status: string; valor_solicitado: number | null; valor_aprovado: number | null; solicitado_em: string; pedido?: { total: number } }[] | null>(null)
  const [verReemb, setVerReemb] = useState(false), [codReemb, setCodReemb] = useState("")
  const lerReemb = () => fetch("/api/reembolso/listar", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(j => j && setReemb(j.reembolsos ?? [])).catch(() => {})
  useEffect(() => { lerReemb(); const iv = setInterval(lerReemb, 60_000); { const q = new URLSearchParams(window.location.search); if (q.get("reembolsos")) { setVerReemb(true); setCodReemb(q.get("codigo") ?? "") } }; return () => clearInterval(iv) }, [])
  if (!d) return <p className="mut">{erro || "Carregando…"}</p>
  const rPend = (reemb ?? []).filter(r => r.status === "solicitado")
  const rPendV = rPend.reduce((t, r) => t + Number(r.valor_solicitado ?? r.pedido?.total ?? 0), 0)
  const r30 = (reemb ?? []).filter(r => ["concluido", "aprovado", "processando"].includes(r.status) && Date.now() - new Date(r.solicitado_em).getTime() < 30 * 864e5)
  const dias = Object.keys(d.serie).sort().slice(-7)
  const h = d.hojeLinhas, ontem = d.serie[dias[dias.length - 2]] ?? { pago: 0, pedidos: 0, app: 0 }
  const pago = somaL(h, l => l.pago), app = somaL(h, l => l.app)
  const semana = dias.reduce((s, k) => s + d.serie[k].pago, 0)
  const hora = new Date().getHours(), saud = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"
  const dt = new Date(`${d.hoje}T12:00:00Z`)
  const graves = d.alertas.filter(a => a.g === "grave").length
  const topMax = Math.max(...d.topLojas.map(l => l.v), 1)

  return (
    <>
      <div className="ini-cab">
        <div><h1 className="t28">{saud}</h1><p className="t14 mut">{DIAS[dt.getUTCDay()]}, {d.hoje.slice(8)}/{d.hoje.slice(5, 7)}. {d.pedidosHojeTodos ? `${d.pedidosHojeTodos} pedidos hoje, ${h.length} já entregues.` : "Nenhum pedido ainda hoje."}</p></div>
        <nav className="ini-atalhos" aria-label="Atalhos">
          <Link className="btn btn-s" href="/chego-ctrl/ao-vivo">Ver ao vivo</Link>
          <Link className="btn btn-s" href="/chego-ctrl/repasses">Pagamentos</Link>
          <Link className="btn btn-s" href="/chego-ctrl/carteira">Carteira</Link>
        </nav>
      </div>

      {d.alertas.length > 0
        ? <div className={`cartao ini-alertas ${graves ? "grave" : ""}`} id="precisa">
            <div className="lin"><b className="t16b">{d.alertas.length === 1 ? "1 coisa precisa de você" : `${d.alertas.length} coisas precisam de você`}</b></div>
            <ul className="fila">{d.alertas.slice(0, 6).map((a, i) => <li key={i} className={a.g}><span className="pt" /><span style={{ flex: 1, minWidth: 0 }}><b>{a.t}</b><small>{a.d}</small></span><Link className="btn btn-l" href={a.ir}>Resolver</Link></li>)}</ul>
          </div>
        : <div className="ini-ok" role="status"><span className="pt" />Tudo andando: nenhum pedido parado, nenhum SOS.</div>}

      <button className={`cartao ini-reemb ${rPend.length ? "tem" : ""}`} onClick={() => setVerReemb(true)}>
        <span className="ic" aria-hidden>↺</span>
        <span className="tx"><b>Reembolsos</b><small>{reemb == null ? "Carregando…" : rPend.length ? `${rPend.length} ${rPend.length === 1 ? "esperando você decidir" : "esperando você decidir"}, ${R(rPendV)} pedidos de volta` : `Nenhum esperando você. ${r30.length ? `${r30.length} devolvidos nos últimos 30 dias, ${R(r30.reduce((t, r) => t + Number(r.valor_aprovado ?? 0), 0))}.` : "Nenhum devolvido nos últimos 30 dias."}`}</small></span>
        {rPend.length > 0 && <span className="selo amarelo">{rPend.length}</span>}
        <span className="ver">Ver reembolsos</span>
      </button>

      <section className="cartao ini-saldo">
        <div className="ini-saldo-cab"><span><b className="t20">Saldo do dia</b><small className="t14 mut">Começa em R$ 0,00 e sobe a cada pedido entregue. Atualiza sozinho.</small></span><span className="ini-vivo"><i />ao vivo</span></div>
        <div className="ini-saldo-l">
          {([["app", "Chegô (lucro)", "var(--c-app)", app], ["loja", "Lojistas (repasse)", "var(--c-loja)", somaL(h, l => l.loja)], ["mb", "Motoboys", "var(--c-mb)", somaL(h, l => l.mb)], ["custo", "Taxas (Asaas e maquininha)", "var(--c-res)", somaL(h, l => l.custo)]] as [string, string, string, number][]).map(([k, n, cor, v]) => (
            <Link key={k} href="/chego-ctrl/carteira?per=hoje" className="ini-saldo-it" style={{ ["--c" as any]: cor }}>
              <span><i />{n}</span><b className="num"><Contador v={v} /></b>
              <span className="ini-saldo-barra"><i style={{ width: `${pago ? Math.max(0, v) / pago * 100 : 0}%` }} /></span>
              <small>{pago ? `${Math.round(Math.max(0, v) / pago * 100)}% do vendido` : "nenhuma venda ainda"}</small>
            </Link>))}
        </div>
      </section>

      <div className="ini-topo">
        <section className="ini-dia">
          <div className="ini-dia-cab">
            <span>Vendido hoje</span>
            <b className="num">{R(pago)}</b>
            <Variacao hoje={pago} ontem={ontem.pago} dinheiro />
          </div>
          <div className="ini-trio">
            <div><b className="num">{h.length}</b><span>entregues</span></div>
            <div><b className="num">{h.length ? R(pago / h.length) : "–"}</b><span>ticket médio</span></div>
            <div><b className="num">{R(app)}</b><span>lucro do app</span></div>
          </div>
          <div className="ini-sem-cab"><span>Últimos 7 dias, em reais</span><b className="num">{R(semana)}</b></div>
          <Semana dias={dias} serie={d.serie} hoje={d.hoje} />
        </section>
        <Link className="cartao ini-asaas" href="/chego-ctrl/carteira">
          <div className="lin"><span className="t20">Dinheiro do Chegô</span><span className="t14 mut" style={{ marginLeft: "auto" }}>Abrir carteira</span></div>
          <SaldoAsaas d={d.divisao} curto />
        </Link>
      </div>

      <div className="dupla">
        <div className="cartao" style={{ padding: 18 }}>
          <div className="lin"><span className="t20">Pra onde foi o dinheiro de hoje</span><Link className="btn btn-l" style={{ marginLeft: "auto" }} href="/chego-ctrl/carteira?per=hoje">Detalhar</Link></div>
          {h.length ? <Divisao linhas={h} /> : <p className="ini-vazio">Quando o primeiro pedido for entregue, aparece aqui quanto foi pra loja, pro motoboy, pras taxas e pro app.</p>}
        </div>
        <div className="cartao" style={{ padding: 18 }}>
          <div className="t20" style={{ marginBottom: 10 }}>Lojas que mais venderam hoje</div>
          {d.topLojas.length
            ? <ol className="ini-rank">{d.topLojas.map((l, i) => (
                <li key={l.id}><span className="pos">{i + 1}</span>
                  {l.logo ? <img src={l.logo} alt="" /> : <span className="av">{l.nome[0]}</span>}
                  <span className="nm"><span>{l.nome}</span><i style={{ width: `${l.v / topMax * 100}%` }} /></span>
                  <b className="num">{R(l.v)}</b></li>))}</ol>
            : <p className="ini-vazio">Nenhuma entrega hoje ainda.</p>}
        </div>
      </div>
      <div className={`veu ${verReemb ? "on" : ""}`} onClick={() => setVerReemb(false)} />
      <aside className={`gaveta gav-larga ${verReemb ? "on" : ""}`} aria-hidden={!verReemb}>
        <div className="gav-cab"><span style={{ flex: 1 }}><b className="t20">Reembolsos</b><br /><span className="t14 mut">Só você decide: devolver tudo, parte ou negar.</span></span><button className="btn btn-l" onClick={() => setVerReemb(false)}>Fechar</button></div>
        <div className="gav-corpo">{verReemb && <ReembolsosPainel onMudou={lerReemb} codigoInicial={codReemb || undefined} />}</div>
      </aside>
    </>
  )
}
