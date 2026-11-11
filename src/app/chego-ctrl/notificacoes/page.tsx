"use client"

// Notificações (admin 2.0, 20/10/2026, pedido do Lucas): mandar aviso no celular de quem ligou as
// notificações: clientes, lojas ou motoboys. Teste primeiro no seu celular, depois envia de verdade.
// Envio e histórico em /api/admin/notificar.
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Pub = { celulares: number; pessoas: number }
type Hist = { id: string; publico: string; titulo: string; mensagem: string; link: string | null; alvo: number; enviados: number; falhas: number; criado_em: string }
type Dados = { publicos: Record<"clientes" | "motoboys" | "lojas" | "teste", Pub>; historico: Hist[]; vapid: boolean }

const GRUPOS = [["clientes", "Clientes", "quem usa o app pra pedir"], ["lojas", "Lojas", "painel dos lojistas"], ["motoboys", "Motoboys", "app dos motoboys"]] as const
const NOME_PUB: Record<string, string> = { clientes: "Clientes", lojas: "Lojas", motoboys: "Motoboys", teste: "Teste (seu celular)" }
const MODELOS = [
  { n: "Promoção do dia", t: "Promoção de hoje 🔥", m: "Tem oferta especial esperando por você no Chegô. Corre que é só hoje!" },
  { n: "Frete grátis", t: "Frete grátis hoje 🛵", m: "Peça agora e a entrega é por nossa conta. Aproveite!" },
  { n: "Loja nova", t: "Loja nova no Chegô", m: "Chegou loja nova no app. Vem conhecer o cardápio!" },
  { n: "Hora da fome", t: "Bateu a fome? 😋", m: "As lojas estão abertas e o motoboy chega rapidinho. Bora pedir?" },
]

export default function NotificacoesPage() {
  const [d, setD] = useState<Dados | null>(null)
  const [publico, setPublico] = useState<"clientes" | "motoboys" | "lojas">("clientes")
  const [titulo, setTitulo] = useState(""), [mensagem, setMensagem] = useState("")
  const [destino, setDestino] = useState<"inicio" | "loja">("inicio"), [lojaId, setLojaId] = useState("")
  const [lojas, setLojas] = useState<{ id: string; nome: string }[]>([])
  const [conf, setConf] = useState(false), [env, setEnv] = useState(false)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)

  const carregar = () => fetch("/api/admin/notificar", { credentials: "include" }).then(r => r.json()).then(setD).catch(() => setMsg({ t: "Não foi possível carregar.", ok: false }))
  useEffect(() => { carregar(); supabase.from("lojas").select("id,nome").eq("status", "ativo").order("nome").then(({ data }) => setLojas((data as any[]) ?? [])) }, [])

  const link = destino === "loja" && lojaId ? `/restaurante/${lojaId}` : "/"
  const pronto = titulo.trim().length >= 3 && mensagem.trim().length >= 3 && (destino === "inicio" || lojaId)
  async function enviar(p: string) {
    setEnv(true); setMsg(null)
    const r = await fetch("/api/admin/notificar", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publico: p, titulo, mensagem, link }) })
    const j = await r.json().catch(() => ({})); setEnv(false); setConf(false)
    if (!r.ok) { setMsg({ t: j.error ?? "Não deu certo.", ok: false }); return }
    setMsg({ t: p === "teste" ? `Teste enviado pra ${j.enviados} ${j.enviados === 1 ? "celular seu" : "celulares seus"}. Confira se chegou.` : `Enviado pra ${j.enviados} de ${j.alvo} celulares.${j.falhas ? ` ${j.falhas} não receberam (celular desligou as notificações${j.removidos ? `; ${j.removidos} saíram da lista` : ""}).` : ""}`, ok: true })
    carregar()
  }

  if (!d) return <p className="mut">{msg?.t ?? "Carregando…"}</p>
  const alvo = d.publicos[publico]

  return (
    <>
      {!d.vapid && <div className="aviso vm" style={{ marginBottom: 12 }}>O servidor está sem a chave de notificações. Nada vai ser enviado.</div>}
      {msg && <div className={`aviso ${msg.ok ? "vd" : "vm"}`} role="status" style={{ marginBottom: 12 }}>{msg.t}</div>}
      <div className="nt-grid">
        <div className="cartao nt-form">
          <b className="t16b">Pra quem</b>
          <div className="nt-pub">{GRUPOS.map(([k, n, s]) => (
            <button key={k} className="cartao" aria-pressed={publico === k} onClick={() => setPublico(k)}>
              <b>{n}</b><span className="num">{d.publicos[k].pessoas.toLocaleString("pt-BR")}</span><small>{d.publicos[k].celulares.toLocaleString("pt-BR")} {d.publicos[k].celulares === 1 ? "celular" : "celulares"}, {s}</small>
            </button>))}</div>
          <p className="t12 mut">Só recebe quem ligou as notificações no celular.</p>

          <b className="t16b" style={{ marginTop: 16, display: "block" }}>Mensagem</b>
          <div className="nt-modelos">{MODELOS.map(x => <button key={x.n} className="chip" onClick={() => { setTitulo(x.t); setMensagem(x.m) }}>{x.n}</button>)}</div>
          <label className="campo"><span>Título <small className="mut">{titulo.length}/60</small></span><input value={titulo} maxLength={60} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Promoção de hoje" /></label>
          <label className="campo"><span>Texto <small className="mut">{mensagem.length}/180</small></span><textarea rows={3} value={mensagem} maxLength={180} onChange={e => setMensagem(e.target.value)} placeholder="Ex.: X-Especial com Coca lata por R$ 24,99 no Dudu Lanches" /></label>
          {publico === "clientes" && <>
            <b className="t16b" style={{ marginTop: 6, display: "block" }}>Ao tocar, abre</b>
            <div className="nt-dest">
              <button className="chip" aria-pressed={destino === "inicio"} onClick={() => setDestino("inicio")}>Início do app</button>
              <button className="chip" aria-pressed={destino === "loja"} onClick={() => setDestino("loja")}>Uma loja</button>
              {destino === "loja" && <select className="pd-sel" value={lojaId} onChange={e => setLojaId(e.target.value)}><option value="">Escolha a loja</option>{lojas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</select>}
            </div>
          </>}
          <div className="nt-ac">
            <button className="btn btn-s" disabled={!pronto || env} onClick={() => enviar("teste")}>{env ? "Enviando…" : `Testar no meu celular${d.publicos.teste.celulares ? "" : " (nenhum inscrito)"}`}</button>
            <button className="btn btn-p" disabled={!pronto || env || !alvo.celulares} onClick={() => setConf(true)}>Enviar pra {alvo.pessoas.toLocaleString("pt-BR")} {NOME_PUB[publico].toLowerCase()}</button>
          </div>
        </div>

        <div className="nt-prev">
          <b className="t14 mut">Assim aparece no celular</b>
          <div className="nt-cel"><div className="nt-tela"><span className="nt-hora">18:45</span>
            <div className="nt-not"><img src="/logo-chego.png" alt="" /><span><small>Chegô Delivery, agora</small><b>{titulo || "Título da notificação"}</b><em>{mensagem || "O texto aparece aqui, com até duas ou três linhas."}</em></span></div>
          </div></div>
        </div>
      </div>

      <div className="cartao" style={{ padding: 16, marginTop: 14 }}>
        <b className="t16b">Enviadas</b>
        {d.historico.length === 0 ? <p className="t14 mut" style={{ marginTop: 6 }}>Nenhuma notificação enviada ainda.</p> : (
          <div style={{ overflow: "auto" }}><table className="tabela" style={{ marginTop: 6 }}><thead><tr><th>Quando</th><th>Pra quem</th><th>Mensagem</th><th style={{ textAlign: "right" }}>Chegou</th></tr></thead>
            <tbody>{d.historico.map(h => <tr key={h.id}><td className="num">{new Date(h.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td>{NOME_PUB[h.publico] ?? h.publico}</td><td><b>{h.titulo}</b><br /><span className="t12 mut">{h.mensagem}</span></td><td className="num" style={{ textAlign: "right" }}>{h.enviados} de {h.alvo}</td></tr>)}</tbody></table></div>)}
      </div>

      {conf && (
        <div className="veu on" onClick={() => !env && setConf(false)}>
          <div className="busca-caixa" onClick={e => e.stopPropagation()}>
            <div className="t20">Enviar agora?</div>
            <p className="t14 mut" style={{ margin: "6px 0 12px" }}>Vai pra {alvo.celulares.toLocaleString("pt-BR")} celulares de {alvo.pessoas.toLocaleString("pt-BR")} {NOME_PUB[publico].toLowerCase()}. Depois de enviada, não dá pra desfazer.</p>
            <div className="nt-not" style={{ marginBottom: 12 }}><img src="/logo-chego.png" alt="" /><span><small>Chegô Delivery</small><b>{titulo}</b><em>{mensagem}</em></span></div>
            <div className="lin"><button className="btn btn-s" style={{ flex: 1 }} disabled={env} onClick={() => setConf(false)}>Voltar</button><button className="btn btn-p" style={{ flex: 2 }} disabled={env} onClick={() => enviar(publico)}>{env ? "Enviando…" : "Enviar"}</button></div>
          </div>
        </div>
      )}
    </>
  )
}
