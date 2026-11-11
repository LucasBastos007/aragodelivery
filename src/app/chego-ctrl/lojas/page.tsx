"use client"

// Lojas (admin 2.0, 20/10/2026). Lista com situação, plano, taxa e pendências de cada loja, e a loja
// aberta numa gaveta com abas: Resumo, Cadastro, Contrato e acesso, Fiscal e Asaas.
// Mesmas ações e APIs de antes (status via gravarAdmin, /api/admin/ativar-loja, /api/chego-ctrl/plano,
// /api/chego-ctrl/presencial, /api/chego-ctrl/enviar-contrato, /api/admin/criar-credenciais,
// /api/admin/loja/criar-subconta, /cert, /focusnfe-empresa, /fiscal-toggle, /api/chego-ctrl/excluir-loja).
// Excluir fica em "Mais opções" pra não apagar loja por engano.
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { gravarAdmin as gravarBruto } from "@/lib/adminGravar"
import type { Loja, StatusLoja, PlanoLoja } from "@/types"

const ST: Record<string, [string, string]> = { pendente: ["Esperando aprovação", "amarelo"], aprovado: ["Contrato enviado", "azul"], contrato_assinado: ["Contrato assinado", "roxo"], ativo: ["Ativa", "verde"], suspenso: ["Suspensa", "vermelho"] }
const PLANO: Record<string, string> = { select: "Select, R$ 149/mês", prime: "Prime, R$ 497/mês", black: "Black, R$ 997/mês", gold: "Gold, comissão por pedido" }
const brl = (v: number | null | undefined) => v == null ? "–" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const mascara = (v: string) => { const d = v.replace(/\D/g, "").replace(/^0+/, "").slice(0, 7); return d ? (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "" }
const paraNum = (v: string) => Number(v.replace(/\./g, "").replace(",", "."))
const pendencias = (l: any) => [!l.plano && "sem plano", !l.contrato_assinado && l.status !== "pendente" && "contrato não assinado", !(l.pix_key || l.pix_chave) && "sem Pix", !l.logo_url && "sem logo", l.lat == null && "sem ponto no mapa"].filter(Boolean) as string[]

// gravarAdmin devolve { error } em vez de lançar: aqui vira erro de verdade, pra tela não dizer "salvo" à toa
async function gravarAdmin(tabela: string, id: string, campos: Record<string, unknown>) { const r = await gravarBruto(tabela, id, campos); if (r?.error) throw new Error(r.error) }

async function api(url: string, body: object, metodo = "POST") {
  const r = await fetch(url, { method: metodo, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  return { ok: r.ok, j: await r.json().catch(() => ({})) as any }
}

export default function LojasPage() {
  const [lojas, setLojas] = useState<Loja[]>([])
  const [carregou, setCarregou] = useState(false)
  const [status, setStatus] = useState("todas")
  const [cat, setCat] = useState("Todas")
  const [busca, setBusca] = useState("")
  const [aberta, setAberta] = useState<string | null>(null)
  // Abrir/fechar direto da lista (21/10/2026, pedido do Lucas: o botão só existia dentro da gaveta)
  const [mudando, setMudando] = useState<string | null>(null), [aviso, setAviso] = useState<{ t: string; ok: boolean } | null>(null)
  async function abrirFechar(l: Loja) {
    if (l.aberto && !confirm(`Fechar ${l.nome} agora? Ela some do app e para de receber pedidos.`)) return
    setMudando(l.id); setAviso(null)
    try { await gravarAdmin("lojas", l.id, { aberto: !l.aberto }); setLojas(ls => ls.map(x => x.id === l.id ? { ...x, aberto: !l.aberto } as Loja : x)); setAviso({ t: `${l.nome} ${l.aberto ? "fechada" : "aberta"} no app.`, ok: true }) }
    catch (e: any) { setAviso({ t: `Não deu certo: ${e?.message ?? e}`, ok: false }) }
    setMudando(null)
  }

  async function load() {
    const { data } = await supabase.from("lojas").select("*").order("criado_em", { ascending: false })
    setLojas(data ?? []); setCarregou(true)
  }
  useEffect(() => { load() }, [])
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("id"); if (id) setAberta(id) }, [])

  const cats = useMemo(() => ["Todas", ...[...new Set(lojas.map(l => l.categoria).filter(Boolean))].sort()], [lojas])
  const q = busca.trim().toLowerCase()
  const conta = (s: string) => lojas.filter(l => s === "todas" || (s === "abertas" ? l.aberto && l.status === "ativo" : s === "pendencias" ? pendencias(l).length > 0 && l.status === "ativo" : l.status === s)).length
  const vis = lojas.filter(l => (status === "todas" || (status === "abertas" ? l.aberto && l.status === "ativo" : status === "pendencias" ? pendencias(l).length > 0 && l.status === "ativo" : l.status === status))
    && (cat === "Todas" || l.categoria === cat) && (!q || [l.nome, l.email, l.telefone, (l as any).cnpj].some(x => String(x ?? "").toLowerCase().includes(q))))
  const sel = lojas.find(l => l.id === aberta) ?? null
  const taxas = lojas.filter(l => l.status === "ativo").map(l => Number(l.taxa_entrega ?? 0)).sort((a, b) => a - b)
  const taxaComum = taxas[Math.floor(taxas.length / 2)] ?? 0

  return (
    <>
      <div className="pd-topo">
        <div className="pd-resumo"><b className="num">{conta("ativo")}</b><span>lojas ativas, {conta("abertas")} abertas agora{conta("pendente") ? `, ${conta("pendente")} esperando aprovação` : ""}</span></div>
        <input className="pd-busca" placeholder="Buscar loja, e-mail, telefone ou CNPJ" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>
      <div className="pd-filtros">
        <div className="chips-l">
          {([["todas", "Todas"], ["abertas", "Abertas agora"], ["pendente", "Esperando aprovação"], ["pendencias", "Com pendência"], ["aprovado", "Contrato enviado"], ["suspenso", "Suspensas"]] as const).map(([k, n]) => (
            <button key={k} className={`chip ${k === "pendente" && conta(k) ? "quente" : ""}`} aria-pressed={status === k} onClick={() => setStatus(k)}>{n} <span className="pd-n">{conta(k)}</span></button>))}
        </div>
        <select className="pd-sel" style={{ marginLeft: "auto" }} value={cat} onChange={e => setCat(e.target.value)}>{cats.map(c => <option key={c}>{c}</option>)}</select>
      </div>

      {aviso && <div className={`aviso ${aviso.ok ? "vd" : "vm"}`} role="status" style={{ marginBottom: 10 }}>{aviso.t}</div>}
      {!carregou ? <p className="mut">Carregando…</p> : (
        <div className="cartao" style={{ padding: 6, overflow: "auto" }}>
          <table className="tabela lj-tab">
            <thead><tr><th>Loja</th><th>Situação</th><th className="esconde-cel">Plano</th><th className="esconde-cel">Taxa base</th><th className="esconde-cel">Pendências</th><th /></tr></thead>
            <tbody>{vis.map(l => { const st = ST[l.status] ?? [l.status, "cinza"], pend = pendencias(l), fora = l.status === "ativo" && Math.abs(Number(l.taxa_entrega ?? 0) - taxaComum) >= 3; return (
              <tr key={l.id} onClick={() => setAberta(l.id)} style={{ cursor: "pointer" }}>
                <td><span className="lin" style={{ gap: 10 }}>{l.logo_url ? <img src={l.logo_url} alt="" className="lj-logo" /> : <span className="lj-logo">{l.nome[0]}</span>}<span style={{ minWidth: 0 }}><b>{l.nome}</b><small className="lj-sub">{l.categoria ?? "sem categoria"}{l.status === "ativo" ? (l.aberto ? ", aberta agora" : ", fechada") : ""}</small></span></span></td>
                <td><span className="lin" style={{ gap: 6, flexWrap: "wrap" }}><span className={`selo ${st[1]}`}>{st[0]}</span>
                  {l.status === "ativo" && <button className={`btn ${l.aberto ? "btn-s" : "btn-v"} lj-abre`} disabled={mudando === l.id} title={l.aberto ? "Fechar a loja no app agora" : "Abrir a loja no app agora"}
                    onClick={e => { e.stopPropagation(); abrirFechar(l) }}>{mudando === l.id ? "…" : l.aberto ? "Aberta · Fechar" : "Fechada · Abrir"}</button>}</span></td>
                <td className="esconde-cel">{l.plano ? <b>{(PLANO[l.plano] ?? l.plano).split(",")[0]}</b> : <span className="mut">sem plano</span>}</td>
                <td className="esconde-cel num" style={{ color: fora ? "var(--pimenta-esc)" : undefined, fontWeight: fora ? 800 : undefined }} title={fora ? `Fora do padrão (a maioria cobra ${brl(taxaComum)})` : undefined}>{brl(l.taxa_entrega)}</td>
                <td className="esconde-cel">{pend.length ? <span className="selo amarelo" title={pend.join(", ")}>{pend.length === 1 ? pend[0] : `${pend.length} pendências`}</span> : <span className="selo verde">ok</span>}</td>
                <td style={{ textAlign: "right" }}><Link className="btn btn-l" href={`/chego-ctrl/lojas/${l.id}/cardapio`} onClick={e => e.stopPropagation()}>Cardápio</Link></td>
              </tr>) })}
              {!vis.length && <tr><td colSpan={6} className="vazio">Nenhuma loja aqui.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div className={`veu ${sel ? "on" : ""}`} onClick={() => setAberta(null)} style={sel ? undefined : { display: "none" }} />
      <aside className={`gaveta lj-gav ${sel ? "on" : ""}`} aria-hidden={!sel}>
        {sel && <GavetaLoja l={sel} taxaComum={taxaComum} onFechar={() => setAberta(null)} recarregar={load} onExcluida={() => { setLojas(ls => ls.filter(x => x.id !== sel.id)); setAberta(null) }} />}
      </aside>
    </>
  )
}

function GavetaLoja({ l, taxaComum, onFechar, recarregar, onExcluida }: { l: Loja; taxaComum: number; onFechar: () => void; recarregar: () => Promise<void>; onExcluida: () => void }) {
  const x = l as any
  const [aba, setAba] = useState<"resumo" | "cadastro" | "contrato" | "fiscal">("resumo")
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)
  const [plano, setPlano] = useState<string>(l.plano ?? "")
  const [taxa, setTaxa] = useState(mascara(String(Math.round(Number(l.taxa_entrega ?? 0) * 100))))
  const [link, setLink] = useState("")
  const [cred, setCred] = useState<{ senhaTemporaria: string; emailEnviado: boolean; avisoEmail?: string } | null>(null)
  const [cert, setCert] = useState({ fileB64: "", fileName: "", password: "", expires: "", cscId: x.csc_id ?? "", cscToken: "" })
  const [certAberto, setCertAberto] = useState(false)
  const [mais, setMais] = useState(false)
  const [confExcluir, setConfExcluir] = useState(false)
  useEffect(() => { setAba("resumo"); setMsg(null); setPlano(l.plano ?? ""); setTaxa(mascara(String(Math.round(Number(l.taxa_entrega ?? 0) * 100)))); setLink(""); setCred(null); setMais(false); setConfExcluir(false); setCertAberto(false) }, [l.id])

  const st = ST[l.status] ?? [l.status, "cinza"], pend = pendencias(l)
  async function fazer(chave: string, fn: () => Promise<string | void>, okMsg?: string) {
    setOcupado(chave); setMsg(null)
    try { const r = await fn(); await recarregar(); if (okMsg || r) setMsg({ t: (r as string) || okMsg!, ok: true }) }
    catch (e: any) { setMsg({ t: e?.message ?? "Não deu certo.", ok: false }) }
    finally { setOcupado(null) }
  }
  const status = (s: StatusLoja, extra?: Record<string, unknown>) => gravarAdmin("lojas", l.id, { status: s, ...extra })
  const exigePlano = () => { if (!l.plano) throw new Error("Defina o plano antes: ele vai escrito no contrato.") }
  const falha = (r: { ok: boolean; j: any }) => { if (!r.ok) throw new Error(r.j.error ?? "Não deu certo.") ; return r.j }

  const acoes = {
    aprovar: () => fazer("aprovar", async () => { exigePlano(); await status("aprovado", { contrato_token: crypto.randomUUID() }) }, "Aprovada. Agora envie o contrato pra loja assinar."),
    recusar: () => { if (confirm(`Recusar o cadastro de ${l.nome}?`)) fazer("recusar", () => status("suspenso"), "Cadastro recusado.") },
    ativar: () => fazer("ativar", async () => { falha(await api("/api/admin/ativar-loja", { loja_id: l.id })) }, "Loja ativa: já aparece no app."),
    suspender: () => { if (confirm(`Suspender ${l.nome}? Ela some do app.`)) fazer("suspender", () => status("suspenso"), "Loja suspensa.") },
    reativar: () => fazer("reativar", () => status("ativo"), "Loja reativada."),
    abrir: () => fazer("abrir", () => gravarAdmin("lojas", l.id, { aberto: !l.aberto }), l.aberto ? "Loja fechada no app." : "Loja aberta no app."),
    plano: () => fazer("plano", async () => { falha(await api("/api/chego-ctrl/plano", { loja_id: l.id, plano: plano || null })) }, "Plano salvo."),
    taxa: () => fazer("taxa", async () => { const v = paraNum(taxa); if (!(v >= 0)) throw new Error("Valor inválido."); await gravarAdmin("lojas", l.id, { taxa_entrega: v }) }, "Taxa de entrega salva."),
    presencial: () => fazer("presencial", async () => { falha(await api("/api/chego-ctrl/presencial", { tipo: "loja", id: l.id })) }, "Marcado como assinado presencialmente."),
    email: () => fazer("email", async () => { falha(await api("/api/chego-ctrl/enviar-contrato", { loja_id: l.id })) }, `Contrato enviado pra ${l.email}.`),
    link: () => fazer("link", async () => {
      exigePlano(); const t = crypto.randomUUID()
      await gravarAdmin("lojas", l.id, { contrato_token: t, contrato_assinado: false, contrato_assinatura: null, contrato_assinado_em: null })
      const u = `${window.location.origin}/contrato/loja/${t}`; setLink(u); try { await navigator.clipboard.writeText(u) } catch {}
      return "Link novo gerado e copiado. O link antigo deixa de valer."
    }),
    cred: () => fazer("cred", async () => { const j = falha(await api("/api/admin/criar-credenciais", { loja_id: l.id })); setCred({ senhaTemporaria: j.senhaTemporaria, emailEnviado: j.emailEnviado, avisoEmail: j.avisoEmail }) }),
    subconta: () => { if (confirm(`Criar subconta Asaas pra ${l.nome}? Não dá pra desfazer.`)) fazer("subconta", async () => { const j = falha(await api("/api/admin/loja/criar-subconta", { loja_id: l.id })); return j.jaExistia ? `A subconta já existia (${j.walletId}).` : `Subconta criada (${j.walletId}).` }) },
    cert: () => fazer("cert", async () => {
      if (!cert.fileB64 && !cert.password && !cert.cscId && !cert.cscToken) throw new Error("Preencha pelo menos um campo.")
      falha(await api("/api/admin/loja/cert", { loja_id: l.id, cert_b64: cert.fileB64 || undefined, cert_password: cert.password || undefined, cert_expires: cert.expires || undefined, csc_id: cert.cscId || undefined, csc_token: cert.cscToken || undefined }))
      setCertAberto(false); setCert({ fileB64: "", fileName: "", password: "", expires: "", cscId: cert.cscId, cscToken: "" })
    }, "Certificado salvo."),
    focus: () => { if (confirm(`Registrar ${l.nome} no Focus NFe? O certificado é enviado.`)) fazer("focus", async () => { falha(await api("/api/admin/loja/focusnfe-empresa", { loja_id: l.id })) }, "Loja registrada no Focus NFe.") },
    fiscal: () => { const novo = !l.fiscal_ativo; if (!novo || confirm(`Ativar NFC-e pra ${l.nome}? A nota sai sozinha a cada entrega.`)) fazer("fiscal", async () => { falha(await api("/api/admin/loja/fiscal-toggle", { loja_id: l.id, fiscal_ativo: novo })) }, novo ? "Emissão de NFC-e ativada." : "Emissão de NFC-e desativada.") },
    excluir: () => fazer("excluir", async () => { const r = await api("/api/chego-ctrl/excluir-loja", { loja_id: l.id }, "DELETE"); falha(r); onExcluida() }),
  }

  const linha = (n: string, v: unknown) => v ? <div className="lj-dado" key={n}><span>{n}</span><b>{String(v)}</b></div> : null
  return (
    <>
      <div className="gav-cab lj-cab">
        {l.logo_url ? <img src={l.logo_url} alt="" className="lj-logo g" /> : <span className="lj-logo g">{l.nome[0]}</span>}
        <span style={{ flex: 1, minWidth: 0 }}><b className="t20">{l.nome}</b><br /><span className={`selo ${st[1]}`}>{st[0]}</span> {l.status === "ativo" && <span className={`selo ${l.aberto ? "verde" : "cinza"}`}>{l.aberto ? "Aberta" : "Fechada"}</span>}</span>
        <button className="btn btn-s" style={{ minHeight: 40, padding: "0 12px" }} onClick={onFechar}>Fechar</button>
      </div>
      <div className="abas-l" style={{ padding: "0 14px", marginBottom: 0, overflowX: "auto" }}>
        {([["resumo", "Resumo"], ["cadastro", "Cadastro"], ["contrato", "Contrato e acesso"], ["fiscal", "Fiscal e Asaas"]] as const).map(([k, n]) => <button key={k} aria-pressed={aba === k} onClick={() => { setAba(k); setMsg(null) }} style={{ whiteSpace: "nowrap" }}>{n}</button>)}
      </div>
      <div className="gav-corpo">
        {msg && <div className={`aviso ${msg.ok ? "vd" : "vm"}`} role="status" style={{ marginBottom: 12 }}>{msg.t}</div>}

        {aba === "resumo" && <>
          {l.status === "pendente" && <div className="gav-sec lj-proximo"><small>Próximo passo</small><b>Aprovar o cadastro</b><span className="t14 mut">Defina o plano, aprove e envie o contrato pra loja assinar.</span>
            <div className="lin" style={{ gap: 8, marginTop: 8 }}><button className="btn btn-p" style={{ flex: 2, minHeight: 44 }} disabled={!!ocupado} onClick={acoes.aprovar}>{ocupado === "aprovar" ? "Aprovando…" : "Aprovar e gerar contrato"}</button><button className="btn btn-s" style={{ flex: 1, minHeight: 44 }} disabled={!!ocupado} onClick={acoes.recusar}>Recusar</button></div></div>}
          {l.status === "aprovado" && <div className="gav-sec lj-proximo"><small>Próximo passo</small><b>Esperando a loja assinar</b><span className="t14 mut">Mande o contrato na aba Contrato e acesso. Se assinou no papel, marque aqui.</span>
            <button className="btn btn-s" style={{ marginTop: 8, minHeight: 44 }} disabled={!!ocupado} onClick={acoes.presencial}>{ocupado === "presencial" ? "Salvando…" : "Assinou no papel, marcar como assinado"}</button></div>}
          {["aprovado", "contrato_assinado", "pendente"].includes(l.status) && <button className="btn btn-v cheio" style={{ marginBottom: 10 }} disabled={!!ocupado} onClick={acoes.ativar}>{ocupado === "ativar" ? "Ativando…" : "Ativar loja (aparece no app)"}</button>}

          {l.status === "ativo" && <div className="gav-sec lj-toggle"><span style={{ flex: 1 }}><b>{l.aberto ? "Aberta, recebendo pedidos" : "Fechada, sem receber pedidos"}</b><small className="t12 mut" style={{ display: "block" }}>Normalmente a loja abre e fecha sozinha pelo horário.</small></span>
            <button className={`btn ${l.aberto ? "btn-s" : "btn-v"}`} style={{ minHeight: 40 }} disabled={!!ocupado} onClick={acoes.abrir}>{ocupado === "abrir" ? "…" : l.aberto ? "Fechar agora" : "Abrir agora"}</button></div>}

          {pend.length > 0 && <div className="aviso am" style={{ margin: "10px 0" }}>Falta: {pend.join(", ")}.</div>}

          <div className="gav-sec"><small>Plano</small>
            <div className="lin" style={{ gap: 8 }}><select className="pd-sel" style={{ flex: 1, height: 44, borderRadius: 12 }} value={plano} onChange={e => setPlano(e.target.value)}><option value="">Sem plano</option>{Object.entries(PLANO).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
              <button className="btn btn-g" style={{ minHeight: 44 }} disabled={!!ocupado || plano === (l.plano ?? "")} onClick={acoes.plano}>{ocupado === "plano" ? "…" : "Salvar"}</button></div>
            {x.plano_ativo_desde && <span className="t12 mut">Ativo desde {new Date(x.plano_ativo_desde).toLocaleDateString("pt-BR")}. Comissão por pedido: {x.comissao ?? 10}%.</span>}
          </div>
          <div className="gav-sec"><small>Taxa de entrega base (só o Chegô muda)</small>
            <div className="lin" style={{ gap: 8 }}><input className="pd-busca" style={{ flex: 1, width: "auto" }} inputMode="numeric" placeholder="R$ 0,00" value={taxa} onChange={e => setTaxa(mascara(e.target.value))} />
              <button className="btn btn-g" style={{ minHeight: 44 }} disabled={!!ocupado || paraNum(taxa) === Number(l.taxa_entrega ?? 0)} onClick={acoes.taxa}>{ocupado === "taxa" ? "…" : "Salvar"}</button></div>
            {Math.abs(Number(l.taxa_entrega ?? 0) - taxaComum) >= 3 && <span className="t12" style={{ color: "var(--pimenta-esc)" }}>Fora do padrão: a maioria das lojas cobra {brl(taxaComum)}.</span>}
          </div>
          <div className="lin" style={{ gap: 8, flexWrap: "wrap", margin: "6px 0 12px" }}>
            <Link className="btn btn-s" style={{ flex: 1, minHeight: 44 }} href={`/chego-ctrl/lojas/${l.id}/cardapio`}>Cardápio</Link>
            <Link className="btn btn-s" style={{ flex: 1, minHeight: 44 }} href={`/chego-ctrl/documentos/loja?id=${l.id}`}>Documentos</Link>
            <Link className="btn btn-s" style={{ flex: 1, minHeight: 44 }} href={`/chego-ctrl/pedidos`}>Pedidos</Link>
          </div>
          {l.status === "ativo" && <button className="btn btn-s cheio" style={{ color: "var(--pimenta-esc)" }} disabled={!!ocupado} onClick={acoes.suspender}>Suspender loja</button>}
          {l.status === "suspenso" && <button className="btn btn-v cheio" disabled={!!ocupado} onClick={acoes.reativar}>{ocupado === "reativar" ? "Reativando…" : "Reativar loja"}</button>}
        </>}

        {aba === "cadastro" && <div className="gav-sec" style={{ gap: 0 }}>
          {[["Responsável", x.nome_responsavel], ["CPF", x.cpf_responsavel], ["CNPJ", x.cnpj], ["E-mail", l.email], ["Telefone", l.telefone], ["Endereço", [x.logradouro ?? l.endereco, x.numero, x.complemento].filter(Boolean).join(", ")], ["Bairro", x.bairro], ["Cidade", x.cidade ? `${x.cidade}/${x.estado ?? ""}` : null], ["CEP", x.cep],
            ["Chave Pix", x.pix_key ?? x.pix_chave], ["Banco", x.banco], ["Agência", x.banco_agencia], ["Conta", x.banco_conta ? `${x.banco_conta} (${x.banco_tipo_conta ?? "–"})` : null], ["Categoria", l.categoria], ["Tempo de entrega", l.tempo_min ? `${l.tempo_min} a ${l.tempo_max} min` : null], ["Descrição", l.descricao], ["Cadastro", new Date(l.criado_em).toLocaleDateString("pt-BR")]].map(([n, v]) => linha(n as string, v))}
        </div>}

        {aba === "contrato" && <>
          <div className="gav-sec"><small>Contrato</small>
            {l.contrato_assinado ? <><b style={{ color: "var(--folha)" }}>Assinado{l.modalidade_assinatura === "gov_br" ? " pelo Gov.br" : l.modalidade_assinatura === "presencial" ? " no papel" : ""}{l.contrato_assinado_em ? ` em ${new Date(l.contrato_assinado_em).toLocaleDateString("pt-BR")}` : ""}</b>
              {l.contrato_assinatura && <img src={l.contrato_assinatura} alt="Assinatura" className="lj-ass" />}</> : <b>{l.status === "pendente" ? "Ainda não gerado (aprove a loja primeiro)" : "Esperando assinatura"}</b>}
            <div className="gav-acoes">
              <a className="btn btn-s" href={`/api/chego-ctrl/contrato?tipo=loja&id=${l.id}&modo=preview`} target="_blank" rel="noreferrer">Ver contrato (PDF)</a>
              {x.contrato_pdf_url && <a className="btn btn-s" href={x.contrato_pdf_url} target="_blank" rel="noreferrer">PDF assinado no Gov.br</a>}
              <button className="btn btn-s" disabled={!!ocupado || !l.email} onClick={acoes.email}>{ocupado === "email" ? "Enviando…" : l.email ? `Mandar por e-mail (${l.email})` : "Sem e-mail cadastrado"}</button>
              <button className="btn btn-s" disabled={!!ocupado} onClick={acoes.link}>{ocupado === "link" ? "Gerando…" : "Gerar link novo e copiar"}</button>
              {!l.contrato_assinado && l.status !== "pendente" && <button className="btn btn-s" disabled={!!ocupado} onClick={acoes.presencial}>Assinou no papel</button>}
            </div>
            {link && <div className="aviso vd" style={{ marginTop: 8, wordBreak: "break-all" }}>{link}</div>}
          </div>
          <div className="gav-sec"><small>Acesso do lojista ao painel</small>
            <span className="t14 mut">Cria uma senha temporária e manda pro e-mail da loja.</span>
            <button className="btn btn-s" style={{ marginTop: 6 }} disabled={!!ocupado || !l.email} onClick={acoes.cred}>{ocupado === "cred" ? "Gerando…" : "Criar acesso e mandar por e-mail"}</button>
            {cred && <div className={`aviso ${cred.emailEnviado ? "vd" : "am"}`} style={{ marginTop: 8 }}>{cred.emailEnviado ? "Acesso enviado por e-mail." : "O e-mail não saiu. Passe a senha pra loja:"}
              <div className="lj-senha"><span>{l.email}</span><b>{cred.senhaTemporaria}</b><button className="btn btn-l" onClick={() => navigator.clipboard.writeText(cred.senhaTemporaria).catch(() => {})}>Copiar</button></div>
              {cred.avisoEmail && <small>{cred.avisoEmail}</small>}</div>}
          </div>
        </>}

        {aba === "fiscal" && <>
          <div className="gav-sec"><small>Repasse pelo Asaas</small>
            {l.asaas_wallet_id ? <><b style={{ color: "var(--folha)" }}>Subconta criada, split automático</b><span className="t12 mut">Carteira {l.asaas_wallet_id}</span></>
              : <><b>Sem subconta: repasse pela tela de Pagamentos</b><button className="btn btn-s" style={{ marginTop: 6 }} disabled={!!ocupado || l.status !== "ativo"} onClick={acoes.subconta}>{ocupado === "subconta" ? "Criando…" : l.status === "ativo" ? "Criar subconta Asaas" : "Ative a loja primeiro"}</button></>}
          </div>
          <div className="gav-sec"><small>Certificado digital A1</small>
            <span className={`t14 ${x.cert_a1_path ? "" : "mut"}`}>{x.cert_a1_path ? `Certificado carregado${x.cert_a1_expires_at ? `, vence ${new Date(x.cert_a1_expires_at).toLocaleDateString("pt-BR")}` : ""}` : "Sem certificado"}</span>
            <span className={`t14 ${x.cert_a1_senha_vault_id ? "" : "mut"}`}>{x.cert_a1_senha_vault_id ? "Senha guardada com segurança" : "Sem senha guardada"}</span>
            <span className={`t14 ${x.csc_id ? "" : "mut"}`}>{x.csc_id ? `CSC ${x.csc_id}` : "Sem CSC"}</span>
            {!certAberto ? <button className="btn btn-s" style={{ marginTop: 6 }} onClick={() => setCertAberto(true)}>{x.cert_a1_path ? "Atualizar certificado" : "Configurar certificado"}</button> : <div style={{ marginTop: 8 }}>
              <label className="campo"><span>Arquivo .pfx ou .p12</span><input type="file" accept=".pfx,.p12" style={{ paddingTop: 12 }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setCert(c => ({ ...c, fileB64: String(ev.target?.result ?? "").split(",")[1] ?? "", fileName: f.name })); r.readAsDataURL(f) }} /></label>
              <label className="campo"><span>Senha do certificado</span><input type="password" value={cert.password} onChange={e => setCert(c => ({ ...c, password: e.target.value }))} placeholder={x.cert_a1_senha_vault_id ? "Deixe em branco pra manter" : "Senha do arquivo"} /></label>
              <label className="campo"><span>Validade</span><input type="date" value={cert.expires} onChange={e => setCert(c => ({ ...c, expires: e.target.value }))} /></label>
              <label className="campo"><span>CSC ID</span><input value={cert.cscId} onChange={e => setCert(c => ({ ...c, cscId: e.target.value }))} placeholder="Ex.: 000001" /></label>
              <label className="campo"><span>CSC Token</span><input type="password" value={cert.cscToken} onChange={e => setCert(c => ({ ...c, cscToken: e.target.value }))} placeholder={x.csc_token_vault_id ? "Deixe em branco pra manter" : "Token da SEFAZ"} /></label>
              <div className="lin" style={{ gap: 8 }}><button className="btn btn-s" style={{ flex: 1 }} onClick={() => setCertAberto(false)}>Voltar</button><button className="btn btn-g" style={{ flex: 2 }} disabled={!!ocupado} onClick={acoes.cert}>{ocupado === "cert" ? "Salvando…" : "Salvar certificado"}</button></div>
            </div>}
          </div>
          <div className="gav-sec"><small>Nota fiscal (NFC-e)</small>
            {!x.cert_a1_path ? <span className="t14 mut">Configure o certificado primeiro.</span>
              : !x.focusnfe_cadastrado ? <button className="btn btn-s" disabled={!!ocupado} onClick={acoes.focus}>{ocupado === "focus" ? "Registrando…" : "Registrar no Focus NFe"}</button>
              : <div className="lin"><span style={{ flex: 1 }}><b>{l.fiscal_ativo ? "Emissão ligada" : "Emissão desligada"}</b><small className="t12 mut" style={{ display: "block" }}>{l.fiscal_ativo ? "A nota sai sozinha a cada entrega." : "Nenhuma nota é emitida."}</small></span>
                  <button className={`btn ${l.fiscal_ativo ? "btn-s" : "btn-v"}`} style={{ minHeight: 40 }} disabled={!!ocupado} onClick={acoes.fiscal}>{l.fiscal_ativo ? "Desligar" : "Ligar"}</button></div>}
          </div>
        </>}

        <button className="btn btn-l" style={{ padding: 0, marginTop: 6 }} onClick={() => setMais(!mais)}>{mais ? "Esconder mais opções" : "Mais opções"}</button>
        {mais && <div className="gav-sec">
          <span className="t14 mut">Excluir apaga a loja, os produtos e os pedidos dela, inclusive do financeiro. Prefira suspender.</span>
          {!confExcluir ? <button className="btn btn-s" style={{ marginTop: 8, color: "var(--pimenta-esc)" }} onClick={() => setConfExcluir(true)}>Excluir loja</button>
            : <div className="aviso vm" style={{ marginTop: 8 }}>Excluir {l.nome} de vez? Não dá pra desfazer.<div className="lin" style={{ gap: 8, marginTop: 8 }}><button className="btn btn-p" style={{ flex: 1, minHeight: 40 }} disabled={!!ocupado} onClick={acoes.excluir}>{ocupado === "excluir" ? "Excluindo…" : "Excluir"}</button><button className="btn btn-s" style={{ flex: 1, minHeight: 40 }} onClick={() => setConfExcluir(false)}>Voltar</button></div></div>}
        </div>}
      </div>
    </>
  )
}
