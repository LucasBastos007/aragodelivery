"use client"

// Despacho (admin 2.0, 20/10/2026). Normalmente o motoboy pega sozinho; aqui o admin escolhe na
// mão quando um pedido pronto fica parado. Mesmas ações de antes: despachar
// (/api/chego-ctrl/despachar-pedido + aviso no celular do motoboy) e resolver SOS.
import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { supabase } from "@/lib/supabase"
import { gravarAdmin } from "@/lib/adminGravar"
import { km, situacaoMb, COR_MB } from "./_Mapa"

const Mapa = dynamic(() => import("./_Mapa"), { ssr: false, loading: () => <div className="mapa-op" /> })

type Aba = "fila" | "motoboys" | "sos"
const brl = (v: number) => `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const minDesde = (iso?: string | null) => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000)) : 0
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

export default function DespachoPainel() {
  const [pedidos, setPedidos] = useState<any[]>([])
  const [motoboys, setMotoboys] = useState<any[]>([])
  const [sos, setSos] = useState<any[]>([])
  const [ativas, setAtivas] = useState<any[]>([])
  const [carregou, setCarregou] = useState(false)
  const [aba, setAba] = useState<Aba>("fila")
  const [escolher, setEscolher] = useState<any | null>(null)
  const [resolvendo, setResolvendo] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: ped }, { data: moto }, { data: s }, { data: at }] = await Promise.all([
      supabase.from("pedidos").select("*, loja:lojas(nome, endereco, lat, lng, logo_url), itens:itens_pedido(*)")
        .eq("status", "pronto").is("motoboy_id", null)
        .not("endereco_entrega", "ilike", "%Retirada%") // retirada na loja nunca precisa de motoboy
        .order("criado_em", { ascending: true }),
      supabase.from("motoboys").select("id, nome, disponivel, status, lat, lng, veiculo, telefone").order("nome"),
      supabase.from("alertas_sos").select("*, motoboy:motoboys(nome, telefone)").eq("status", "pendente").order("criado_em", { ascending: false }),
      supabase.from("pedidos").select("id, codigo, motoboy_id, status, taxa_entrega").in("status", ["aguardando_aceite", "indo_para_loja", "na_loja", "coletado", "em_rota"]).not("motoboy_id", "is", null),
    ])
    setPedidos(ped ?? []); setMotoboys(moto ?? []); setSos(s ?? []); setAtivas(at ?? []); setCarregou(true)
  }, [])

  useEffect(() => { load(); const iv = setInterval(load, 15_000); return () => clearInterval(iv) }, [load])
  useEffect(() => {
    // Rajadas de mudanças viram uma recarga só, no máximo a cada 1,5 s (incidente 31/10/2026)
    let t: ReturnType<typeof setTimeout> | null = null
    const agendar = () => { if (!t) t = setTimeout(() => { t = null; load() }, 1500) }
    const ch = supabase.channel("despacho-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos", filter: "status=eq.pronto" }, agendar)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos", filter: "status=eq.pronto" }, agendar)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos", filter: "status=eq.aguardando_aceite" }, agendar)
      .on("postgres_changes", { event: "*", schema: "public", table: "motoboys" }, agendar)
      .on("postgres_changes", { event: "*", schema: "public", table: "alertas_sos" }, agendar)
      .subscribe()
    return () => { if (t) clearTimeout(t); supabase.removeChannel(ch) }
  }, [load])

  async function resolverSOS(id: string) {
    setResolvendo(id); await gravarAdmin("alertas_sos", id, { status: "resolvido" }); await load(); setResolvendo(null)
  }

  const online = motoboys.filter(m => m.disponivel && m.status === "ativo")
  const offline = motoboys.filter(m => !(m.disponivel && m.status === "ativo"))
  const livres = online.filter(m => situacaoMb(m, sos, ativas).k === "livre")
  const pinos = pedidos.map(p => ({ id: p.id, lat: p.loja?.lat, lng: p.loja?.lng, titulo: `#${p.codigo} pronto`, sub: p.loja?.nome, destaque: escolher?.id === p.id }))

  return (
    <>
      <div className="dsp-resumo">
        <span className={`dsp-n ${pedidos.length ? "quente" : ""}`}><b className="num">{pedidos.length}</b>{pedidos.length === 1 ? "pronto esperando motoboy" : "prontos esperando motoboy"}</span>
        <span className="dsp-n"><b className="num">{livres.length}</b>{livres.length === 1 ? "motoboy livre" : "motoboys livres"}</span>
        <span className="dsp-n"><b className="num">{online.length - livres.length}</b>em corrida</span>
        {sos.length > 0 && <button className="dsp-n sos" onClick={() => setAba("sos")}><b className="num">{sos.length}</b>SOS agora</button>}
      </div>

      <div className="dsp-grade">
        <div className="cartao dsp-mapa">{carregou && <Mapa motoboys={motoboys} sos={sos} ativas={ativas} lojas={pinos} altura={560} />}</div>
        <div className="cartao dsp-lado">
          <div className="abas-l" style={{ padding: "0 8px", marginBottom: 0 }}>
            {([["fila", "Fila", pedidos.length], ["motoboys", "Motoboys", online.length], ["sos", "SOS", sos.length]] as [Aba, string, number][]).map(([k, n, c]) => (
              <button key={k} aria-pressed={aba === k} onClick={() => setAba(k)}>{n} <span className={`dsp-cont ${k === "sos" && c ? "sos" : ""}`}>{c}</span></button>
            ))}
          </div>
          <div className="dsp-lista">
            {!carregou && <p className="vazio">Carregando…</p>}

            {carregou && aba === "fila" && (pedidos.length === 0
              ? <div className="dsp-vazio"><b>Nenhum pedido parado</b><span>Quando um pedido ficar pronto sem motoboy, ele aparece aqui pra você mandar alguém.</span></div>
              : pedidos.map(p => {
                  const m = minDesde(p.pronto_em ?? p.atualizado_em ?? p.criado_em)
                  return (
                    <div key={p.id} className={`dsp-ped ${m >= 8 ? "atrasado" : ""}`}>
                      <div className="lin" style={{ gap: 10 }}>
                        {p.loja?.logo_url ? <img src={p.loja.logo_url} alt="" className="dsp-logo" /> : <span className="dsp-logo">{(p.loja?.nome ?? "?")[0]}</span>}
                        <span style={{ flex: 1, minWidth: 0 }}><b className="t16b">#{p.codigo}</b><small className="dsp-sub">{p.loja?.nome ?? "Loja"}, feito às {hora(p.criado_em)}</small></span>
                        <span className={`selo ${m >= 8 ? "vermelho" : "amarelo"}`}>{m} min</span>
                      </div>
                      <p className="dsp-end">{p.endereco_entrega}</p>
                      {p.itens?.length > 0 && <p className="dsp-itens">{p.itens.map((i: any) => `${i.quantidade}× ${i.nome}`).join(", ")}</p>}
                      <div className="lin" style={{ marginTop: 10 }}>
                        <span className="t14 mut">Entrega <b className="num" style={{ color: "var(--grafite)" }}>{brl(p.taxa_entrega)}</b></span>
                        <button className="btn btn-p" style={{ marginLeft: "auto", minHeight: 42 }} onClick={() => setEscolher(p)}>Escolher motoboy</button>
                      </div>
                    </div>
                  )
                }))}

            {carregou && aba === "motoboys" && (
              <>
                <p className="dsp-grupo">Online agora ({online.length})</p>
                {online.length === 0 && <p className="t14 mut" style={{ padding: "4px 4px 10px" }}>Ninguém online.</p>}
                {online.map(mb => { const s = situacaoMb(mb, sos, ativas); return (
                  <div key={mb.id} className="dsp-mb"><span className="av-mb" style={{ background: COR_MB[s.k] }}>{mb.nome?.[0]}</span>
                    <span style={{ flex: 1, minWidth: 0 }}><b>{mb.nome}</b><small>{mb.veiculo || "sem veículo informado"}</small></span>
                    <span className={`selo ${s.k === "livre" ? "verde" : s.k === "sos" ? "vermelho" : s.k === "loja" ? "amarelo" : "azul"}`}>{s.t}</span></div>) })}
                <p className="dsp-grupo">Offline ({offline.length})</p>
                {offline.map(mb => (
                  <div key={mb.id} className="dsp-mb off"><span className="av-mb">{mb.nome?.[0]}</span>
                    <span style={{ flex: 1, minWidth: 0 }}><b>{mb.nome}</b><small>{mb.status !== "ativo" ? `cadastro ${mb.status}` : "fora do app"}</small></span>
                    <span className="selo cinza">Offline</span></div>))}
              </>
            )}

            {carregou && aba === "sos" && (sos.length === 0
              ? <div className="dsp-vazio"><b>Nenhum SOS</b><span>Se um motoboy apertar SOS no app, aparece aqui com a localização.</span></div>
              : sos.map(a => (
                  <div key={a.id} className="dsp-sos">
                    <b className="t16b">SOS de {a.motoboy?.nome ?? "motoboy"}</b>
                    <small>Às {new Date(a.criado_em).toLocaleTimeString("pt-BR")}, há {minDesde(a.criado_em)} min</small>
                    <div className="lin" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      {a.motoboy?.telefone && <a className="btn btn-s" style={{ minHeight: 42, flex: 1 }} href={`tel:${a.motoboy.telefone}`}>Ligar</a>}
                      {a.lat && a.lng && <a className="btn btn-s" style={{ minHeight: 42, flex: 1 }} href={`https://www.google.com/maps?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer">Ver no mapa</a>}
                      <button className="btn btn-p" style={{ minHeight: 42, flex: 1 }} disabled={resolvendo === a.id} onClick={() => resolverSOS(a.id)}>{resolvendo === a.id ? "Resolvendo…" : "Resolvido"}</button>
                    </div>
                  </div>)))}
          </div>
        </div>
      </div>

      {escolher && <Escolher pedido={escolher} motoboys={motoboys} sos={sos} ativas={ativas} onFechar={ok => { setEscolher(null); if (ok) load() }} />}
    </>
  )
}

function Escolher({ pedido, motoboys, sos, ativas, onFechar }: { pedido: any; motoboys: any[]; sos: any[]; ativas: any[]; onFechar: (ok: boolean) => void }) {
  const [enviando, setEnviando] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)
  const la = pedido.loja?.lat, lo = pedido.loja?.lng
  const cand = motoboys.filter(m => m.disponivel && m.status === "ativo" && m.lat && m.lng)
    .map(m => ({ ...m, dist: la && lo ? km(m.lat, m.lng, la, lo) : 999, sit: situacaoMb(m, sos, ativas) }))
    .sort((a, b) => (a.sit.k === "livre" ? 0 : 1) - (b.sit.k === "livre" ? 0 : 1) || a.dist - b.dist)

  async function mandar(mb: any) {
    setEnviando(mb.id); setMsg(null)
    try {
      const r = await fetch("/api/chego-ctrl/despachar-pedido", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedido_id: pedido.id, motoboy_id: mb.id }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg({ t: r.status === 409 ? "Outro admin já despachou esse pedido." : (j.error ?? "Não deu certo."), ok: false }); return }
      try {
        const n = (pedido.itens ?? []).length
        const corpo = [`📦 ${n} ${n === 1 ? "item" : "itens"} · ${brl(pedido.taxa_entrega)}`, pedido.loja?.nome ? `🏪 ${pedido.loja.nome}` : "", pedido.endereco_entrega ? `📍 ${pedido.endereco_entrega}` : "", mb.dist < 999 ? `🛵 ${mb.dist.toFixed(1)} km até a loja` : ""].filter(Boolean).join("\n")
        await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send-motoboy", motoboy_id: mb.id, title: `🛵 Nova corrida #${pedido.codigo}!`, body: corpo, url: "/motoboy" }) })
      } catch {}
      setMsg({ t: `Pedido mandado pro ${mb.nome}. Ele recebeu o aviso no celular.`, ok: true })
      setTimeout(() => onFechar(true), 1400)
    } finally { setEnviando(null) }
  }

  return (
    <div className="veu on" onClick={() => !enviando && onFechar(false)}>
      <div className="busca-caixa" onClick={e => e.stopPropagation()} style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div className="t20">Quem leva o #{pedido.codigo}?</div>
        <p className="t14 mut" style={{ margin: "4px 0 12px" }}>{pedido.loja?.nome}, entrega de {brl(pedido.taxa_entrega)}. Do mais perto da loja pro mais longe.</p>
        {msg && <div className={`aviso ${msg.ok ? "vd" : "vm"}`} style={{ marginBottom: 10 }}>{msg.t}</div>}
        <div style={{ overflow: "auto", flex: 1 }}>
          {cand.length === 0 ? <p className="vazio">Nenhum motoboy online com localização agora.</p> : cand.map(mb => (
            <div key={mb.id} className="dsp-mb">
              <span className="av-mb" style={{ background: COR_MB[mb.sit.k as keyof typeof COR_MB] }}>{mb.nome?.[0]}</span>
              <span style={{ flex: 1, minWidth: 0 }}><b>{mb.nome}</b><small>{mb.dist < 999 ? `${mb.dist.toFixed(1).replace(".", ",")} km da loja` : "distância desconhecida"}, {mb.sit.t.toLowerCase()}</small></span>
              <button className="btn btn-p" style={{ minHeight: 40 }} disabled={!!enviando || msg?.ok} onClick={() => mandar(mb)}>{enviando === mb.id ? "Mandando…" : "Mandar"}</button>
            </div>))}
        </div>
        <button className="btn btn-s" style={{ marginTop: 12 }} disabled={!!enviando} onClick={() => onFechar(false)}>Fechar</button>
      </div>
    </div>
  )
}
