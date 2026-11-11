"use client"

// Motoboys (admin 2.0, 20/10/2026). Lista com quem está online, entregas da semana e situação do
// cadastro; o motoboy abre numa gaveta com documentos, contrato, acesso e ações.
// Mesmas ações de antes: aprovar (gera contrato), rejeitar/suspender com motivo (avisa no WhatsApp),
// ativar, reativar, reapresentar contrato, credenciais (/api/admin/criar-credenciais-motoboy),
// testar notificação (/api/admin/push-teste). Fotos dos documentos por link temporário (/api/admin/doc-url).
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { gravarAdmin as gravarBruto } from "@/lib/adminGravar"
import type { Motoboy, StatusMotoboy } from "@/types"

const ST: Record<string, [string, string]> = { pendente: ["Esperando aprovação", "amarelo"], aprovado: ["Contrato enviado", "azul"], contrato_assinado: ["Contrato assinado", "roxo"], ativo: ["Ativo", "verde"], suspenso: ["Suspenso", "vermelho"], offline: ["Offline", "cinza"] }
const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const ymdBrt = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d)
async function gravarAdmin(t: string, id: string, c: Record<string, unknown>) { const r = await gravarBruto(t, id, c); if (r?.error) throw new Error(r.error) }
const pixDe = (raw: unknown) => { if (!raw) return null; try { const o = JSON.parse(String(raw)); return [o.pix ?? o.chave ?? o.key, o.banco ?? o.bank].filter(Boolean).join(", ") } catch { return String(raw) } }

export default function MotoboysPage() {
  const [mbs, setMbs] = useState<Motoboy[]>([])
  const [semana, setSemana] = useState<Record<string, { n: number; v: number }>>({})
  const [carregou, setCarregou] = useState(false)
  const [filtro, setFiltro] = useState("todos")
  const [busca, setBusca] = useState("")
  const [aberto, setAberto] = useState<string | null>(null)

  async function load() {
    const corte = `${ymdBrt(new Date(Date.now() - 6 * 86400000))}T03:00:00Z`
    const [{ data }, { data: ent }] = await Promise.all([
      supabase.from("motoboys").select("*").order("criado_em", { ascending: false }),
      supabase.from("pedidos").select("motoboy_id, taxa_entrega").eq("status", "entregue").not("motoboy_id", "is", null).gte("criado_em", corte).limit(5000),
    ])
    const s: Record<string, { n: number; v: number }> = {}
    for (const p of (ent ?? []) as any[]) { const a = (s[p.motoboy_id] ??= { n: 0, v: 0 }); a.n++; a.v += Math.max(4, Number(p.taxa_entrega ?? 0)) }
    setMbs((data ?? []) as Motoboy[]); setSemana(s); setCarregou(true)
  }
  useEffect(() => { load() }, [])
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("id"); if (id) setAberto(id) }, [])

  const q = busca.trim().toLowerCase()
  const bate = (m: Motoboy, f: string) => f === "todos" || (f === "online" ? m.disponivel && m.status === "ativo" : m.status === f)
  const conta = (f: string) => mbs.filter(m => bate(m, f)).length
  const vis = useMemo(() => mbs.filter(m => bate(m, filtro) && (!q || [m.nome, m.telefone, m.placa, m.email].some(x => String(x ?? "").toLowerCase().includes(q))))
    .sort((a, b) => Number(b.disponivel && b.status === "ativo") - Number(a.disponivel && a.status === "ativo") || (semana[b.id]?.n ?? 0) - (semana[a.id]?.n ?? 0)), [mbs, filtro, q, semana])
  const sel = mbs.find(m => m.id === aberto) ?? null

  return (
    <>
      <div className="pd-topo">
        <div className="pd-resumo"><b className="num">{conta("online")}</b><span>online agora, {conta("ativo")} ativos{conta("pendente") ? `, ${conta("pendente")} esperando aprovação` : ""}</span></div>
        <input className="pd-busca" placeholder="Buscar nome, telefone ou placa" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>
      <div className="pd-filtros"><div className="chips-l">
        {([["todos", "Todos"], ["online", "Online agora"], ["pendente", "Esperando aprovação"], ["aprovado", "Contrato enviado"], ["contrato_assinado", "Assinaram"], ["ativo", "Ativos"], ["suspenso", "Suspensos"]] as const).map(([k, n]) =>
          <button key={k} className={`chip ${k === "pendente" && conta(k) ? "quente" : ""}`} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{n} <span className="pd-n">{conta(k)}</span></button>)}
      </div></div>

      {!carregou ? <p className="mut">Carregando…</p> : (
        <div className="mb-grade">
          {vis.map(m => { const st = ST[m.status] ?? [m.status, "cinza"], on = m.disponivel && m.status === "ativo", s = semana[m.id]; return (
            <button key={m.id} className="cartao mb-card" onClick={() => setAberto(m.id)}>
              <span className="lin" style={{ gap: 10 }}><span className={`mb-av ${on ? "on" : ""}`}>{m.nome?.[0]}</span>
                <span style={{ flex: 1, minWidth: 0 }}><b className="t16b mb-nome">{m.nome}</b><small className="lj-sub">{[m.veiculo, m.placa].filter(Boolean).join(", ") || "veículo não informado"}</small></span></span>
              <span className="lin" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}><span className={`selo ${st[1]}`}>{st[0]}</span>{on && <span className="selo verde">Online</span>}</span>
              <span className="mb-sem"><span><b className="num">{s?.n ?? 0}</b> entregas</span><span><b className="num">{brl(s?.v ?? 0)}</b> na semana</span></span>
            </button>) })}
          {!vis.length && <p className="vazio">Nenhum motoboy aqui.</p>}
        </div>
      )}

      <div className={`veu ${sel ? "on" : ""}`} onClick={() => setAberto(null)} style={sel ? undefined : { display: "none" }} />
      <aside className={`gaveta lj-gav ${sel ? "on" : ""}`} aria-hidden={!sel}>
        {sel && <GavetaMb m={sel} s={semana[sel.id]} onFechar={() => setAberto(null)} recarregar={load} />}
      </aside>
    </>
  )
}

function GavetaMb({ m, s, onFechar, recarregar }: { m: Motoboy; s?: { n: number; v: number }; onFechar: () => void; recarregar: () => Promise<void> }) {
  const x = m as any
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ t: string; ok: boolean; wa?: string } | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [foto, setFoto] = useState<string | null>(null)
  const [motivo, setMotivo] = useState<{ acao: "rejeitar" | "suspender"; t: string } | null>(null)
  const [cred, setCred] = useState<{ email: string; senha: string } | null>(null)
  const docs = [["cnhFrente", "Documento, frente", x.documentos?.cnhFrente], ["cnhVerso", "Documento, verso", x.documentos?.cnhVerso], ["crlv", "Documento da moto (CRLV)", x.documentos?.crlv], ["selfie", "Selfie do cadastro", x.documentos?.selfie], ["selfieContrato", "Selfie do contrato", x.selfie_contrato]].filter(d => d[2]) as [string, string, string][]

  useEffect(() => {
    setMsg(null); setMotivo(null); setCred(null); setUrls({})
    Promise.all(docs.map(async ([k, , v]) => {
      const r = await fetch("/api/admin/doc-url", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: v }) }).catch(() => null)
      return [k, r?.ok ? (await r.json()).signedUrl : v] as const
    })).then(xs => setUrls(Object.fromEntries(xs)))
  }, [m.id])

  const tel = (m.telefone ?? "").replace(/\D/g, "")
  const linkContrato = (t?: string | null) => `${window.location.origin}/contrato/motoboy/${t ?? m.contrato_token}`
  async function fazer(k: string, fn: () => Promise<{ t: string; wa?: string } | void>) {
    setOcupado(k); setMsg(null)
    try { const r = await fn(); await recarregar(); if (r) setMsg({ ...r, ok: true }) } catch (e: any) { setMsg({ t: e?.message ?? "Não deu certo.", ok: false }) } finally { setOcupado(null) }
  }
  const status = (s2: StatusMotoboy, extra?: Record<string, unknown>) => gravarAdmin("motoboys", m.id, { status: s2, ...extra })
  const acoes = {
    aprovar: () => fazer("aprovar", async () => {
      const t = crypto.randomUUID(); await status("aprovado", { contrato_token: t, motivo_rejeicao: null })
      return { t: "Aprovado. Mande o contrato pra ele assinar.", wa: tel ? `https://wa.me/55${tel}?text=${encodeURIComponent(`Olá ${m.nome}! Seu cadastro de motoboy no Chegô foi *aprovado*.\n\nAssine o contrato pelo link pra ativar sua conta:\n${linkContrato(t)}\n\nBem-vindo à equipe!`)}` : undefined }
    }),
    motivo: () => motivo && fazer("motivo", async () => {
      await status("suspenso", { motivo_rejeicao: motivo.t.trim() }); const m2 = motivo; setMotivo(null)
      return { t: m2.acao === "rejeitar" ? "Cadastro rejeitado." : "Motoboy suspenso.", wa: tel ? `https://wa.me/55${tel}?text=${encodeURIComponent(m2.acao === "rejeitar" ? `Olá ${m.nome}, seu cadastro de motoboy no Chegô não foi aprovado.\n\nMotivo: ${m2.t}\n\nQualquer dúvida, fale com a gente.` : `Olá ${m.nome}, sua conta de motoboy no Chegô foi suspensa.\n\nMotivo: ${m2.t}`)}` : undefined }
    }),
    ativar: () => fazer("ativar", async () => { await status("ativo", { motivo_rejeicao: null }); return { t: "Motoboy ativo: já pode receber corridas." } }),
    reapresentar: () => fazer("reap", async () => { const t = crypto.randomUUID(); await status("aprovado", { contrato_token: t, motivo_rejeicao: null }); return { t: "Contrato novo gerado.", wa: tel ? `https://wa.me/55${tel}?text=${encodeURIComponent(`Olá ${m.nome}! Segue o contrato do Chegô pra assinar:\n${linkContrato(t)}`)}` : undefined } }),
    cred: () => fazer("cred", async () => {
      const r = await fetch("/api/admin/criar-credenciais-motoboy", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motoboy_id: m.id }) })
      const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(j.error ?? "Não deu certo."); setCred({ email: j.email, senha: j.senhaTemporaria })
    }),
    push: () => fazer("push", async () => {
      const r = await fetch("/api/admin/push-teste", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motoboy_id: m.id }) })
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? "Não deu certo.")
      return { t: j.enviados ? `Notificação enviada pra ${j.enviados} celular${j.enviados > 1 ? "es" : ""}.` : "Ele não tem celular cadastrado pra notificação." }
    }),
    copiar: async () => { try { await navigator.clipboard.writeText(linkContrato()); setMsg({ t: "Link do contrato copiado.", ok: true }) } catch { setMsg({ t: linkContrato(), ok: true }) } },
  }
  const st = ST[m.status] ?? [m.status, "cinza"], on = m.disponivel && m.status === "ativo"
  const dado = (n: string, v: unknown) => v ? <div className="lj-dado" key={n}><span>{n}</span><b>{String(v)}</b></div> : null

  return (
    <>
      <div className="gav-cab lj-cab">
        <span className={`mb-av g ${on ? "on" : ""}`}>{m.nome?.[0]}</span>
        <span style={{ flex: 1, minWidth: 0 }}><b className="t20">{m.nome}</b><br /><span className={`selo ${st[1]}`}>{st[0]}</span> {on && <span className="selo verde">Online</span>}</span>
        <button className="btn btn-s" style={{ minHeight: 40, padding: "0 12px" }} onClick={onFechar}>Fechar</button>
      </div>
      <div className="gav-corpo">
        {msg && <div className={`aviso ${msg.ok ? "vd" : "vm"}`} role="status" style={{ marginBottom: 12 }}>{msg.t}{msg.wa && <a className="btn btn-v" style={{ minHeight: 38, marginTop: 8, display: "flex" }} href={msg.wa} target="_blank" rel="noreferrer">Avisar no WhatsApp</a>}</div>}
        {x.motivo_rejeicao && m.status === "suspenso" && <div className="aviso vm" style={{ marginBottom: 12 }}>Motivo: {x.motivo_rejeicao}</div>}

        <div className="mb-sem g"><span><b className="num">{s?.n ?? 0}</b> entregas nos últimos 7 dias</span><span><b className="num">{brl(s?.v ?? 0)}</b> de ganho</span></div>

        {m.status === "pendente" && <div className="gav-sec lj-proximo"><small>Próximo passo</small><b>Conferir os documentos e aprovar</b>
          <div className="lin" style={{ gap: 8, marginTop: 8 }}><button className="btn btn-p" style={{ flex: 2, minHeight: 44 }} disabled={!!ocupado} onClick={acoes.aprovar}>{ocupado === "aprovar" ? "Aprovando…" : "Aprovar e gerar contrato"}</button><button className="btn btn-s" style={{ flex: 1, minHeight: 44 }} onClick={() => setMotivo({ acao: "rejeitar", t: "" })}>Rejeitar</button></div></div>}
        {(m.status === "aprovado" || m.status === "contrato_assinado") && <div className="gav-sec lj-proximo"><small>Próximo passo</small><b>{m.status === "aprovado" ? "Esperando ele assinar o contrato" : "Contrato assinado, falta ativar"}</b>
          <div className="gav-acoes"><button className="btn btn-v" disabled={!!ocupado} onClick={acoes.ativar}>{ocupado === "ativar" ? "Ativando…" : m.status === "aprovado" ? "Assinou no papel, ativar" : "Ativar motoboy"}</button>
            {m.status === "aprovado" && <button className="btn btn-s" onClick={acoes.copiar}>Copiar link do contrato</button>}</div></div>}
        {motivo && <div className="gav-sec"><small>{motivo.acao === "rejeitar" ? "Por que rejeitar?" : "Por que suspender?"} Ele vê esse motivo.</small>
          <textarea className="mb-mot" rows={3} value={motivo.t} onChange={e => setMotivo({ ...motivo, t: e.target.value })} placeholder="Ex.: documento ilegível, CNH vencida" />
          <div className="lin" style={{ gap: 8 }}><button className="btn btn-p" style={{ flex: 2, minHeight: 42 }} disabled={!motivo.t.trim() || !!ocupado} onClick={acoes.motivo}>{motivo.acao === "rejeitar" ? "Rejeitar cadastro" : "Suspender"}</button><button className="btn btn-s" style={{ flex: 1, minHeight: 42 }} onClick={() => setMotivo(null)}>Voltar</button></div></div>}

        <div className="gav-sec"><small>Documentos</small>
          {docs.length === 0 ? <span className="t14 mut">Nenhum documento enviado.</span> : <div className="mb-docs">{docs.map(([k, n]) => (
            <button key={k} className="mb-doc" onClick={() => urls[k] && setFoto(urls[k])}>{urls[k] ? <img src={urls[k]} alt={n} /> : <span className="mut t12">carregando…</span>}<small>{n}</small></button>))}</div>}
          <Link className="btn btn-l" style={{ padding: 0, alignSelf: "flex-start" }} href={`/chego-ctrl/documentos/motoboy?id=${m.id}`}>Ver documentação completa</Link>
        </div>

        <div className="gav-sec" style={{ gap: 0 }}><small style={{ marginBottom: 4 }}>Cadastro</small>
          {[["Telefone", m.telefone], ["E-mail", m.email], ["CPF", x.cpf], ["CNH", x.cnh], ["Veículo", m.veiculo], ["Placa", m.placa], ["Pix", pixDe(x.pix_key ?? x.pix_chave)], ["Cadastro", new Date(m.criado_em).toLocaleDateString("pt-BR")]].map(([n, v]) => dado(n as string, v))}
        </div>

        <div className="gav-sec"><small>Contrato</small>
          {x.contrato_assinado ? <b style={{ color: "var(--folha)" }}>Assinado{x.contrato_assinado_em ? ` em ${new Date(x.contrato_assinado_em).toLocaleDateString("pt-BR")}` : ""}</b> : <b>{m.status === "pendente" ? "Ainda não gerado" : "Não assinado"}</b>}
          {x.contrato_assinatura && <img src={x.contrato_assinatura} alt="Assinatura" className="lj-ass" />}
          <div className="gav-acoes">
            <a className="btn btn-s" href={`/api/chego-ctrl/contrato?tipo=motoboy&id=${m.id}`} target="_blank" rel="noreferrer">Ver contrato (PDF)</a>
            {m.contrato_token && !x.contrato_assinado && <button className="btn btn-s" onClick={acoes.copiar}>Copiar link do contrato</button>}
          </div>
        </div>

        <div className="gav-sec"><small>Acesso e celular</small>
          <div className="gav-acoes">
            <button className="btn btn-s" disabled={!!ocupado} onClick={acoes.cred}>{ocupado === "cred" ? "Gerando…" : "Gerar senha de primeiro acesso"}</button>
            {m.status === "ativo" && <button className="btn btn-s" disabled={!!ocupado} onClick={acoes.push}>{ocupado === "push" ? "Enviando…" : "Testar notificação no celular dele"}</button>}
            {tel && <a className="btn btn-s" href={`https://wa.me/55${tel}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}
          </div>
          {cred && <div className="aviso am" style={{ marginTop: 8 }}>Passe pro motoboy no primeiro acesso:<div className="lj-senha"><span>{cred.email}</span><b>{cred.senha}</b><button className="btn btn-l" onClick={() => navigator.clipboard.writeText(cred.senha).catch(() => {})}>Copiar</button></div></div>}
        </div>

        {m.status === "ativo" && <button className="btn btn-s cheio" style={{ color: "var(--pimenta-esc)" }} onClick={() => setMotivo({ acao: "suspender", t: "" })}>Suspender motoboy</button>}
        {m.status === "suspenso" && <div className="gav-acoes"><button className="btn btn-v" disabled={!!ocupado} onClick={acoes.ativar}>{ocupado === "ativar" ? "Reativando…" : "Reativar"}</button><button className="btn btn-s" disabled={!!ocupado} onClick={acoes.reapresentar}>Mandar contrato de novo</button></div>}
      </div>
      {foto && <div className="veu on mb-luz" onClick={() => setFoto(null)}><img src={foto} alt="Documento" onClick={e => e.stopPropagation()} /><button className="btn btn-s" onClick={() => setFoto(null)}>Fechar</button></div>}
    </>
  )
}
