"use client"

// Financeiro da loja no layout novo (proposta aprovada, 20/10/2026).
// - Ciclo de sexta a quinta: o acumulado volta pra zero depois do repasse de sexta.
// - "Como chegamos nesse valor": cada linha abre os pedidos que formam o valor.
// - Vendas: últimos 7 dias, cada dia abre o que foi vendido; o total abre o gráfico por período.
// - Extrato desta semana e da passada pra imprimir ou baixar em planilha.
// Valores: só produtos, com comissão, taxas (Pix, cartão, maquininha) e cupons da loja descontados.
import { useEffect, useMemo, useState } from "react"
import { Ico } from "../_icones"

type Linha = { id: string; codigo: string; criado_em: string; dia: string; forma: string; forma_2: string | null; produtos: number; cupomLoja: number; comissao: number
  taxaOnline: number; taxaMaquininha: number; participacaoEntrega: number; recebidoPelaLoja: number; liquido: number; itens: { nome: string; quantidade: number; preco: number }[] }
type Resumo = { ciclo: { ini: string; fim: string; paga: string }; pedidos: number; produtos: number; vendasApp: number; vendasEntrega: number; recebidoPelaLoja: number
  comissao: number; taxaOnline: number; taxaMaquininha: number; cupomLoja: number; participacaoEntrega: number; liquido: number; porDia: { dia: string; produtos: number; pedidos: number }[]; linhas: Linha[] }
type Repasse = { ciclo: Resumo["ciclo"]; atual: boolean; adiantado: number; aReceber: number; podeAdiantar: boolean; anterior: Resumo["ciclo"] | null; resumo: Resumo; pagoCiclo: any; pagos: { id: string; comprovante: boolean; pelo_asaas: boolean; valor: number; ocorrido_em: string; motivo: string }[] }
// Borderô que o Chegô mandou conferir antes do repasse (20/10/2026)
type Bordero = { id: string; status: string; valor: number; qtd: number; periodo_ini: string; periodo_fim: string; enviado_em: string; respondido_em: string | null; resposta: string | null; pago_em: string | null
  detalhe: { paga?: string; produtos: number; cupom: number; comissao: number; taxas: number; entrega: number; balcao: number; avulsas: number; ajustesLista?: { valor: number; motivo: string; dia: string }[]; adiantado: number; frete?: number; linhas: { codigo: string; dia: string; hora?: string; forma: string; itens: string; frete?: number; produtos: number; liquido: number }[] } }

const R = (v: number) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`
const DIA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
const diaSem = (ymd: string) => DIA[new Date(`${ymd}T12:00:00Z`).getUTCDay()]
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).replace(":", "h")
const somaDias = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const FORMA: Record<string, string> = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro", maquininha: "Maquininha", pix_loja: "Pix na loja" }
const forma = (l: Linha) => (FORMA[l.forma] ?? l.forma) + (l.forma_2 ? ` + ${FORMA[l.forma_2] ?? l.forma_2}` : "")
const ehApp = (l: Linha) => !l.forma_2 && (l.forma === "pix" || l.forma === "cartao")
const mascaraBRL = (v: string) => { const d = v.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9); return d ? (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "" }

function csvLinhas(linhas: Linha[]) {
  const l = [["Data", "Hora", "Pedido", "Pagamento", "Itens", "Produtos", "Cupom da loja", "Comissão", "Taxa de pagamento", "Recebido no balcão", "Você recebe"]].concat(linhas.map(x => [
    dm(x.dia) + "/" + x.dia.slice(0, 4), hora(x.criado_em), "#" + x.codigo, forma(x), x.itens.map(i => `${i.quantidade}x ${i.nome}`).join(" + "),
    ...[x.produtos, x.cupomLoja, x.comissao, x.taxaOnline + x.taxaMaquininha, x.recebidoPelaLoja, x.liquido].map(v => v.toFixed(2).replace(".", ","))]))
  return "﻿" + l.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n")
}
function baixar(nome: string, linhas: Linha[]) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csvLinhas(linhas)], { type: "text/csv;charset=utf-8" })); a.download = nome; a.click()
}
function imprimir(titulo: string, sub: string, linhas: Linha[]) {
  const w = window.open("", "_blank"); if (!w) { alert("Libere as janelas do navegador pra imprimir."); return }
  const esc = (t: string) => t.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!))
  const tot = (f: (l: Linha) => number) => R(linhas.reduce((t, l) => t + f(l), 0))
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(titulo)}</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#222}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 12px;color:#555}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:6px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}.r{text-align:right}tfoot td{font-weight:700;border-top:2px solid #222}</style>
    <h1>${esc(titulo)}</h1><p>${esc(sub)}</p><table><thead><tr><th>Data</th><th>Pedido</th><th>Itens</th><th>Pagamento</th><th class="r">Produtos</th><th class="r">Descontos</th><th class="r">Você recebe</th></tr></thead><tbody>
    ${linhas.map(l => `<tr><td>${dm(l.dia)} ${hora(l.criado_em)}</td><td>#${esc(l.codigo)}</td><td>${l.itens.map(i => `${i.quantidade}× ${esc(i.nome)}`).join("<br>")}</td><td>${esc(forma(l))}</td><td class="r">${R(l.produtos)}</td><td class="r">${R(l.produtos - l.liquido)}</td><td class="r">${R(l.liquido)}</td></tr>`).join("")}
    </tbody><tfoot><tr><td colspan="4">${linhas.length} pedidos</td><td class="r">${tot(l => l.produtos)}</td><td class="r">${tot(l => l.produtos - l.liquido)}</td><td class="r">${tot(l => l.liquido)}</td></tr></tfoot></table>`)
  w.document.close(); setTimeout(() => w.print(), 300)
}

export default function LojaFinanceiroPage() {
  const [aba, setAba] = useState<"resumo" | "vendas" | "repasses" | "extrato">("resumo")
  const [rep, setRep] = useState<Repasse | null>(null)
  const [erro, setErro] = useState("")
  const [abre, setAbre] = useState<string | null>(null)
  const [adiantar, setAdiantar] = useState(false)

  async function carregar(ciclo?: string) {
    setErro("")
    const r = await fetch(`/api/loja/repasse${ciclo ? `?ciclo=${ciclo}` : ""}`, { credentials: "include" })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setErro(j.error ?? "Não foi possível carregar o financeiro."); return null }
    return j as Repasse
  }
  useEffect(() => { carregar().then(setRep) }, [])
  const [borderos, setBorderos] = useState<Bordero[]>([])
  const carregarB = () => fetch("/api/loja/bordero", { credentials: "include" }).then(r => r.json()).then(j => setBorderos(j.borderos ?? [])).catch(() => {})
  useEffect(() => { carregarB() }, [])
  const pendente = borderos.find(b => b.status === "enviado")

  return (
    <div>
      <div className="abas-fin">
        {([["resumo", "Resumo"], ["vendas", "Vendas"], ["repasses", "Repasses"], ["extrato", "Extrato"]] as const).map(([k, n]) => (
          <button key={k} aria-pressed={aba === k} onClick={() => setAba(k)}>{n}{k === "repasses" && pendente ? <i className="ponto-novo" aria-label="tem borderô pra conferir" /> : null}</button>
        ))}
      </div>
      {erro && <div className="aviso vm" style={{ marginBottom: 12 }}>{erro}</div>}
      {pendente && aba !== "repasses" && <div className="aviso am" style={{ marginBottom: 12 }}><b>Confira o seu repasse.</b> O Chegô mandou a lista dos pedidos de {dm(pendente.periodo_ini)} a {dm(pendente.periodo_fim)}: você recebe {R(Number(pendente.valor))}. <button className="btn btn-l" style={{ padding: 0, minHeight: 0 }} onClick={() => setAba("repasses")}>Conferir agora</button></div>}
      {!rep ? (!erro && <p className="mut">Carregando…</p>) : aba === "resumo" ? <AbaResumo rep={rep} abre={abre} setAbre={setAbre} onAdiantar={() => setAdiantar(true)} />
        : aba === "vendas" ? <AbaVendas />
        : aba === "repasses" ? <AbaRepasses rep={rep} borderos={borderos} onResposta={carregarB} />
        : <AbaExtrato rep={rep} carregar={carregar} />}
      {adiantar && rep && <FolhaAdiantar disponivel={rep.aReceber} onFechar={(ok) => { setAdiantar(false); if (ok) carregar().then(setRep) }} />}
    </div>
  )
}

function AbaResumo({ rep, abre, setAbre, onAdiantar }: { rep: Repasse; abre: string | null; setAbre: (v: string | null) => void; onAdiantar: () => void }) {
  const r = rep.resumo, c = rep.ciclo, L = r.linhas
  const grupos = {
    app: L.filter(ehApp), entrega: L.filter(l => !ehApp(l) && l.recebidoPelaLoja < l.produtos - 0.005),
    comissao: L.filter(l => l.comissao > 0), online: L.filter(l => l.taxaOnline > 0), maq: L.filter(l => l.taxaMaquininha > 0),
    cupom: L.filter(l => l.cupomLoja > 0), part: L.filter(l => l.participacaoEntrega > 0), balcao: L.filter(l => l.recebidoPelaLoja > 0),
  }
  const linha = (n: string, d: string, v: string, cls = "") => <li className={cls}><span><b>{n}</b>{d && <small>{d}</small>}</span><span className="num">{v}</span></li>
  const linhaAbre = (id: string, n: string, d: string, v: string, ps: Linha[], col: "valor" | "comissao" | "taxa" | "maq" | "cupom" | "part" | "balcao", cls = "") => (
    <li className={`${cls} abre ${abre === id ? "on" : ""}`}>
      <button onClick={() => setAbre(abre === id ? null : id)} aria-expanded={abre === id}>
        <span><b>{n} <span className="qtd">{ps.length} {ps.length === 1 ? "pedido" : "pedidos"}</span></b>{d && <small>{d}</small>}</span>
        <span className="num">{v}</span><span className="seta">{abre === id ? "▴" : "▾"}</span>
      </button>
      {abre === id && (
        <div className="abre-lista">
          {!ps.length ? <p className="t14 mut" style={{ padding: "8px 12px" }}>Nenhum pedido nesta linha ainda.</p> : (
            <table className="tabela mini"><thead><tr><th>Pedido</th><th>Pagamento</th><th style={{ textAlign: "right" }}>Produtos</th><th style={{ textAlign: "right" }}>{col === "valor" ? "Valor" : "Desconto"}</th></tr></thead>
              <tbody>{ps.map(p => { const v = col === "valor" ? p.produtos : col === "comissao" ? p.comissao : col === "taxa" ? p.taxaOnline : col === "maq" ? p.taxaMaquininha : col === "cupom" ? p.cupomLoja : col === "part" ? p.participacaoEntrega : p.recebidoPelaLoja
                return <tr key={p.id}><td><b>#{p.codigo}</b> <span className="t12 mut">{dm(p.dia)} {hora(p.criado_em)}</span></td><td>{forma(p)}</td><td className="num" style={{ textAlign: "right" }}>{R(p.produtos)}</td><td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{col === "valor" ? R(v) : "− " + R(v)}</td></tr> })}</tbody></table>
          )}
        </div>
      )}
    </li>
  )
  return (
    <>
      {rep.pagoCiclo && <div className="aviso vd" style={{ marginBottom: 12 }}><b>Repasse de {R(rep.pagoCiclo.valor)} pago</b> em {new Date(rep.pagoCiclo.ocorrido_em).toLocaleDateString("pt-BR")}.</div>}
      <div className="fin-heroi">
        <div>
          <span className="periodo-fin">Período: sexta {dm(c.ini)} a quinta {dm(c.fim)}</span>
          <small style={{ display: "block", marginTop: 10 }}>{rep.atual ? `Acumulado até agora, cai na sexta ${dm(c.paga)}` : `Repasse da sexta ${dm(c.paga)}`}</small>
          <b className="num">{R(rep.aReceber)}</b>
          <span className="selo verde">{rep.atual ? "Cresce a cada venda" : rep.pagoCiclo ? "Pago" : "A receber"}</span>
          <p>Toda sexta você recebe as vendas de sexta a quinta. Depois que o repasse cai, o saldo volta pra zero e começa a contar até a próxima quinta. Cai sozinho na chave Pix, você não precisa pedir.</p>
          <div className="ciclo">{r.porDia.map(x => <span key={x.dia} className={`${x.pedidos ? "feito" : ""}`}><b>{diaSem(x.dia)}</b>{x.pedidos ? R(x.produtos).replace("R$ ", "") : "–"}</span>)}</div>
        </div>
        <div className="fin-adi">{rep.podeAdiantar
          ? <><button className="btn btn-s" onClick={onAdiantar}>Adiantar hoje</button><small>Taxa de R$ 5,00</small></>
          : <small>{rep.adiantado ? `Você adiantou ${R(rep.adiantado)} nesta semana.` : `Precisa antes? Na terça, ${dm(somaDias(c.ini, 4))}, dá pra adiantar pagando R$ 5,00.`}</small>}</div>
      </div>
      <div className="dupla">
        <div className="cartao" style={{ padding: 18 }}>
          <div className="t20">Como chegamos nesse valor</div>
          <ul className="cascata">
            {linhaAbre("app", "Vendas pagas pelo app", "Pix e cartão, só os produtos", "+ " + R(r.vendasApp), grupos.app, "valor")}
            {linhaAbre("entrega", "Vendas pagas na entrega", "Dinheiro, maquininha e pagamento em 2 formas, só os produtos", "+ " + R(r.vendasEntrega), grupos.entrega, "valor")}
            {linhaAbre("comissao", "Comissão do Chegô", "Sobre os produtos, pelo seu plano", "− " + R(r.comissao), grupos.comissao, "comissao", "menos")}
            {linhaAbre("online", "Taxa de pagamento online", "Pix R$ 1,00 e cartão 1,99% + R$ 0,49 por pedido", "− " + R(r.taxaOnline), grupos.online, "taxa", "menos")}
            {linhaAbre("maq", "Taxa da maquininha", "Crédito e débito na entrega, 3,08%", "− " + R(r.taxaMaquininha), grupos.maq, "maq", "menos")}
            {linhaAbre("cupom", "Cupons da loja", "Desconto que a loja dá no pedido", "− " + R(r.cupomLoja), grupos.cupom, "cupom", "menos")}
            {r.participacaoEntrega > 0 && linhaAbre("part", "Participação na entrega", "Combinado da loja por entrega", "− " + R(r.participacaoEntrega), grupos.part, "part", "menos")}
            {((r as any).ajustesLista ?? []).map((x: any) => linha(x.valor < 0 ? "Desconto do Chegô" : "Crédito do Chegô", x.motivo, (x.valor < 0 ? "− " : "+ ") + R(Math.abs(x.valor)), x.valor < 0 ? "menos" : ""))}
            {rep.adiantado > 0 && linha("Adiantamento de terça", "Já pago, com taxa de R$ 5,00", "− " + R(rep.adiantado), "menos")}
            {linha(rep.atual ? "Até agora você recebe" : "Você recebe", "", R(rep.aReceber), "total")}
          </ul>
          <div className="lin" style={{ marginTop: 14, flexWrap: "wrap", gap: 8 }}>
            <button className="btn btn-s" onClick={() => imprimir(`Extrato de ${dm(c.ini)} a ${dm(c.fim)}`, `Repasse na sexta ${dm(c.paga)}. Só produtos, sem a taxa de entrega.`, L)}><Ico n="impressora" /> Imprimir extrato</button>
            <button className="btn btn-s" onClick={() => baixar(`extrato-${c.ini}-a-${c.fim}.csv`, L)}>Baixar planilha</button>
          </div>
        </div>
        <div className="cartao" style={{ padding: 18 }}>
          <div className="t20">Já está com você</div>
          <p className="t14 mut" style={{ margin: "6px 0 10px" }}>Pedidos que você recebeu direto no balcão ou no Pix da loja. Não passam pelo Chegô e saem do repasse.</p>
          <b className="num t28">{R(r.recebidoPelaLoja)}</b>
          {grupos.balcao.length > 0 && <ul className="cascata" style={{ marginTop: 8 }}>{linhaAbre("balcao", "Pedidos", "", R(r.recebidoPelaLoja), grupos.balcao, "balcao")}</ul>}
        </div>
      </div>
    </>
  )
}

// Vendas: 7 dias em barras (cada dia abre o que foi vendido) e o total abre o gráfico por período
function AbaVendas() {
  const [d, setD] = useState<{ de: string; ate: string; hoje: string; resumo: Resumo } | null>(null)
  const [dia, setDia] = useState<string | null>(null)
  const [perf, setPerf] = useState(false)
  useEffect(() => { fetch("/api/loja/vendas", { credentials: "include" }).then(r => r.json()).then(setD).catch(() => {}) }, [])
  if (!d) return <p className="mut">Carregando…</p>
  const r = d.resumo, mx = Math.max(...r.porDia.map(x => x.produtos), 1)
  const formas = [["Pix pelo app", (l: Linha) => !l.forma_2 && l.forma === "pix", "var(--folha)"], ["Cartão pelo app", (l: Linha) => !l.forma_2 && l.forma === "cartao", "var(--azul)"],
    ["Dinheiro na entrega", (l: Linha) => !l.forma_2 && l.forma === "dinheiro" && !l.recebidoPelaLoja, "#E8A400"], ["Maquininha na entrega", (l: Linha) => !l.forma_2 && l.forma === "maquininha" && !l.recebidoPelaLoja, "var(--roxo)"],
    ["Recebido pela loja", (l: Linha) => l.recebidoPelaLoja > 0, "#9A968E"], ["Em 2 formas", (l: Linha) => !!l.forma_2 && !l.recebidoPelaLoja, "#0E7C86"]] as const
  const linhasDia = dia ? r.linhas.filter(l => l.dia === dia) : []
  const qtd: Record<string, number> = {}; linhasDia.forEach(l => l.itens.forEach(i => { qtd[i.nome] = (qtd[i.nome] ?? 0) + i.quantidade }))
  return (
    <>
      {perf && <PerfVendas hoje={d.hoje} onFechar={() => setPerf(false)} />}
      <div className="kpis">
        <button className="cartao kpi kpi-bt" onClick={() => { setPerf(p => !p); window.scrollTo(0, 0) }} aria-expanded={perf}><b className="num">{R(r.produtos)}</b><small>vendido nos últimos 7 dias, só produtos</small><span className="kpi-mais">{perf ? "Fechar o gráfico ▴" : "Ver por período ▾"}</span></button>
        <div className="cartao kpi"><b className="num">{r.pedidos}</b><small>pedidos</small></div>
        <div className="cartao kpi"><b className="num">{R(r.produtos / Math.max(1, r.pedidos))}</b><small>ticket médio</small></div>
      </div>
      <div className="dupla">
        <div className="cartao graf-dia" style={{ padding: 18 }}>
          <div className="lin"><span className="t20">Vendas por dia</span><span className="t14 mut" style={{ marginLeft: "auto" }}>só os produtos</span></div>
          <div className="barras-h todos" role="img" aria-label="Vendas por dia">
            {r.porDia.map(x => (
              <button key={x.dia} className={`b ${dia === x.dia ? "sel" : ""} ${x.produtos === mx && x.produtos > 0 ? "pico" : ""}`} onClick={() => setDia(dia === x.dia ? null : x.dia)} aria-pressed={dia === x.dia} aria-label={`Ver vendas de ${dm(x.dia)}`}>
                <em className="num">R$ {Math.round(x.produtos).toLocaleString("pt-BR")}</em><i style={{ height: `${x.produtos / mx * 100}%` }} />
                <small className="dia">{x.dia === d.hoje ? "hoje" : diaSem(x.dia)}<b className="num">{Number(x.dia.slice(8))}</b></small>
              </button>
            ))}
          </div>
          <p className="t14 mut" style={{ marginTop: 6 }}>Toque num dia pra ver o que foi vendido.</p>
          {dia && (
            <div className="dia-vendas">
              <div className="lin" style={{ flexWrap: "wrap" }}><span className="t16b">Vendas de {diaSem(dia)}, {dm(dia)}</span><span className="t14 mut">{linhasDia.length} pedidos, {R(linhasDia.reduce((t, l) => t + l.produtos, 0))} em produtos</span>
                <span className="lin" style={{ marginLeft: "auto" }}>
                  <button className="btn btn-s" style={{ minHeight: 40 }} onClick={() => imprimir(`Vendas de ${dm(dia)}`, "Só produtos, sem a taxa de entrega.", linhasDia)}><Ico n="impressora" /> Imprimir</button>
                  <button className="btn btn-s" style={{ minHeight: 40 }} onClick={() => baixar(`vendas-${dia}.csv`, linhasDia)}>Baixar planilha</button>
                </span></div>
              {!linhasDia.length ? <p className="t14 mut" style={{ marginTop: 10 }}>Nenhum pedido entregue nesse dia.</p> : (
                <div className="dia-grade">
                  <div><div className="t14" style={{ fontWeight: 800, margin: "10px 0 6px" }}>Pedidos</div>
                    <div className="dia-peds">{linhasDia.map(l => (
                      <div key={l.id} className="dia-ped"><div className="lin"><b>#{l.codigo}</b><span className="t12 mut">{hora(l.criado_em)}, {forma(l)}</span><b className="num" style={{ marginLeft: "auto" }}>{R(l.produtos)}</b></div>
                        <div className="t14">{l.itens.map((i, k) => <div key={k}>{i.quantidade}× {i.nome}</div>)}</div>
                        {l.cupomLoja > 0 && <div className="t12" style={{ color: "var(--pimenta-esc)" }}>Cupom da loja: − {R(l.cupomLoja)}</div>}</div>
                    ))}</div></div>
                  <div><div className="t14" style={{ fontWeight: 800, margin: "10px 0 6px" }}>Produtos vendidos</div>
                    <ul className="dia-prods">{Object.entries(qtd).sort((a, b) => b[1] - a[1]).map(([n, q]) => <li key={n}><span>{n}</span><b className="num">{q}</b></li>)}</ul></div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="cartao" style={{ padding: 18 }}>
          <div className="t20" style={{ marginBottom: 10 }}>Como pagaram</div>
          {formas.map(([n, f, cor]) => { const p = r.linhas.length ? Math.round(r.linhas.filter(f).length / r.linhas.length * 100) : 0; if (!p) return null
            return <div key={n} className="forma"><span className="lin t14"><b style={{ color: "var(--grafite)" }}>{n}</b><span className="num mut" style={{ marginLeft: "auto" }}>{p}%</span></span><span className="forma-b"><i style={{ width: `${p}%`, background: cor }} /></span></div> })}
          {!r.linhas.length && <p className="t14 mut">Nenhuma venda nos últimos 7 dias.</p>}
        </div>
      </div>
    </>
  )
}

// Quanto vendeu por período, no estilo de app de investimentos (1D, 1S, 1M, 3M, 6M, ano)
const PERIODOS = [["1D", "1D"], ["1S", "1S"], ["1M", "1M"], ["3M", "3M"], ["6M", "6M"], ["ANO", ""]] as const
function PerfVendas({ hoje, onFechar }: { hoje: string; onFechar: () => void }) {
  const [per, setPer] = useState<string>("1M")
  const [d, setD] = useState<{ de: string; ate: string; resumo: Resumo } | null>(null)
  const [cel, setCel] = useState(false)
  useEffect(() => { setCel(window.innerWidth < 700) }, [])
  const de = per === "1D" ? hoje : per === "1S" ? somaDias(hoje, -6) : per === "1M" ? somaDias(hoje, -29) : per === "3M" ? somaDias(hoje, -89) : per === "6M" ? somaDias(hoje, -181) : `${hoje.slice(0, 4)}-01-01`
  useEffect(() => { setD(null); fetch(`/api/loja/vendas?de=${de}&ate=${hoje}`, { credentials: "include" }).then(r => r.json()).then(setD).catch(() => {}) }, [de, hoje])
  const pts = useMemo(() => {
    if (!d) return []
    let ac = 0
    if (per === "1D") return [{ rot: "00h", v: 0 }, ...d.resumo.linhas.slice().sort((a, b) => a.criado_em.localeCompare(b.criado_em)).map(l => ({ rot: hora(l.criado_em), v: (ac += l.produtos) }))]
    return d.resumo.porDia.map(x => ({ rot: dm(x.dia), v: (ac += x.produtos) }))
  }, [d, per])
  const W = cel ? 380 : 820, H = cel ? 250 : 300, dir = cel ? 52 : 74, base = 30, topo = 14
  const n = pts.length, mx = Math.max(1, ...pts.map(p => p.v)) * 1.06
  const X = (i: number) => 8 + i * (W - dir - 16) / Math.max(1, n - 1), Y = (v: number) => topo + (H - topo - base) * (1 - v / mx)
  const kfmt = (v: number) => v >= 1000 ? (v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "k" : Math.round(v).toLocaleString("pt-BR")
  const nx = Math.min(cel ? 3 : 5, n), xs = Array.from({ length: nx }, (_, k) => Math.round(k * (n - 1) / Math.max(1, nx - 1)))
  const r = d?.resumo, linha = (t: string, v: string, cls = "") => <li className={cls}><span>{t}</span><i /><b className="num">{v}</b></li>
  const taxas = r ? r.taxaOnline + r.taxaMaquininha : 0, app = r ? r.linhas.filter(ehApp).length : 0
  const melhor = r && r.porDia.length > 1 ? r.porDia.reduce((a, x) => x.produtos > a.produtos ? x : a) : null
  return (
    <div className="cartao perf-v">
      <div className="lin"><span className="t20">Quanto você vendeu</span><button className="btn btn-l" style={{ marginLeft: "auto" }} onClick={onFechar}>Fechar</button></div>
      <div className="per-chips">{PERIODOS.map(([k, t]) => <button key={k} aria-pressed={per === k} onClick={() => setPer(k)}>{t || hoje.slice(0, 4)}</button>)}</div>
      {!d || !r ? <p className="mut" style={{ padding: "30px 0" }}>Carregando…</p> : (
        <>
          <div className="perf-tot"><b className="num">{R(r.produtos)}</b><span className="t14 mut">{per === "1D" ? "hoje até agora" : `de ${dm(d.de)} a ${dm(d.ate)}`}, só os produtos</span></div>
          {n > 1 && (
            <div className="perf-graf"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Vendido acumulado no período">
              <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1E8A4C" stopOpacity=".32" /><stop offset="1" stopColor="#1E8A4C" stopOpacity="0" /></linearGradient></defs>
              {[0, .2, .4, .6, .8, 1].map(k => { const t = mx / 1.06 * k; return <g key={k}><line x1="8" x2={W - dir} y1={Y(t)} y2={Y(t)} className="g" /><text x={W - dir + 8} y={Y(t) + 4} className="ey">{kfmt(t)}</text></g> })}
              <path d={pts.map((p, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.v).toFixed(1)).join(" ") + ` L ${X(n - 1)} ${Y(0)} L ${X(0)} ${Y(0)} Z`} fill="url(#gv)" />
              <path d={pts.map((p, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.v).toFixed(1)).join(" ")} className="lv" />
              <circle cx={X(n - 1)} cy={Y(pts[n - 1].v)} r="5" className="pf" />
              {xs.map(i => <text key={i} x={X(i)} y={H - 10} className="ex" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{pts[i].rot}</text>)}
            </svg></div>
          )}
          <div className="resumo-t">Resumo</div>
          <ul className="pontilhado">
            {linha("Vendido, só produtos", R(r.produtos))}{linha("Você recebe", R(r.liquido), "verde")}{linha("Comissão do Chegô", "− " + R(r.comissao), "verm")}
            {linha("Taxas de pagamento", "− " + R(taxas), "verm")}{linha("Cupons da loja", "− " + R(r.cupomLoja), "verm")}
            {linha("Número de pedidos", String(r.pedidos))}{linha("Ticket médio", R(r.produtos / Math.max(1, r.pedidos)))}{linha("Pagos pelo app", (r.pedidos ? Math.round(app / r.pedidos * 100) : 0) + "%")}
            {melhor && linha("Melhor dia", `${dm(melhor.dia)}, ${R(melhor.produtos)}`)}{r.porDia.length > 1 && linha("Média por dia", R(r.produtos / r.porDia.length))}
          </ul>
        </>
      )}
    </div>
  )
}

function AbaRepasses({ rep, borderos, onResposta }: { rep: Repasse; borderos: Bordero[]; onResposta: () => void }) {
  const [ver, setVer] = useState<string | null>(null)
  const [errado, setErrado] = useState<string | null>(null), [texto, setTexto] = useState(""), [env, setEnv] = useState(false), [aviso, setAviso] = useState("")
  async function responder(b: Bordero, acao: "conferido" | "contestado") {
    setEnv(true); setAviso("")
    const r = await fetch("/api/loja/bordero", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.id, acao, resposta: acao === "contestado" ? texto : "" }) })
    const j = await r.json().catch(() => ({})); setEnv(false)
    if (!r.ok) { setAviso(j.error ?? "Não foi possível enviar."); return }
    setErrado(null); setTexto(""); onResposta()
  }
  const SIT: Record<string, [string, string]> = { enviado: ["Pra você conferir", "amarelo"], conferido: ["Você conferiu", "azul"], contestado: ["Você apontou erro", "vermelho"], pago: ["Pago", "verde"] }
  return (
    <>
      {borderos.length > 0 && <div className="cartao" style={{ padding: "6px 16px", marginBottom: 12 }}>
        <b className="t16b" style={{ display: "block", padding: "10px 0 4px" }}>Borderôs do Chegô</b>
        <p className="t14 mut" style={{ marginBottom: 6 }}>A lista dos pedidos que formam cada repasse. Só produtos: o frete é do motoboy e não entra.</p>
        {borderos.map(b => { const d = b.detalhe, s = SIT[b.status] ?? [b.status, "cinza"]; return (
          <div key={b.id} className="bd-it">
            <div className="bd-cab"><span><b>Vendas de {dm(b.periodo_ini)} a {dm(b.periodo_fim)}</b><small>{b.qtd} pedidos{d.paga ? `, repasse na sexta ${dm(d.paga)}` : ""}</small></span><span className={`selo ${s[1]}`}>{s[0]}</span><b className="num">{R(Number(b.valor))}</b></div>
            <div className="bd-conta">
              <span>Produtos <b>{R(d.produtos)}</b></span>{d.cupom > 0 && <span>Cupom <b>− {R(d.cupom)}</b></span>}<span>Comissão <b>− {R(d.comissao)}</b></span><span>Taxas de pagamento <b>− {R(d.taxas)}</b></span>
              {d.entrega > 0 && <span>Participação na entrega <b>− {R(d.entrega)}</b></span>}{d.balcao > 0 && <span>Recebido na loja <b>− {R(d.balcao)}</b></span>}{d.avulsas > 0 && <span>Entregas avulsas <b>− {R(d.avulsas)}</b></span>}{(d.ajustesLista ?? []).map((x: any, i: number) => <span key={i}>{x.motivo} <b>{x.valor < 0 ? "− " : "+ "}{R(Math.abs(x.valor))}</b></span>)}{d.adiantado > 0 && <span>Adiantamento de terça <b>− {R(d.adiantado)}</b></span>}
            </div>
            {b.status === "contestado" && b.resposta && <p className="t14" style={{ margin: "6px 0" }}>Você escreveu: “{b.resposta}”. O Chegô vai conferir e te responder.</p>}
            <div className="bd-ac">
              <button className="btn btn-s" onClick={() => setVer(ver === b.id ? null : b.id)}>{ver === b.id ? "Esconder pedidos" : "Ver os pedidos"}</button>
              {(b.status === "enviado" || b.status === "contestado") && <><button className="btn btn-v" disabled={env} onClick={() => responder(b, "conferido")}>Está certo</button><button className="btn btn-l" disabled={env} onClick={() => setErrado(errado === b.id ? null : b.id)}>Tem algo errado</button></>}
            </div>
            {errado === b.id && <div style={{ marginTop: 8 }}><label className="campo"><span>O que está errado? (pedido e valor)</span><textarea rows={3} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ex.: o pedido #ABC123 foi cancelado" /></label>
              {aviso && <div className="aviso vm">{aviso}</div>}<button className="btn btn-p" disabled={env || texto.trim().length < 3} onClick={() => responder(b, "contestado")}>{env ? "Enviando…" : "Enviar pro Chegô"}</button></div>}
            {ver === b.id && <div className="bd-dias">{[...new Set(d.linhas.map(l => l.dia))].sort().map(dd => { const ls = d.linhas.filter(l => l.dia === dd); return <div key={dd}>
              <div className="bd-dia"><b>{diaSem(dd)}, {dm(dd)}</b><span>{ls.length} {ls.length === 1 ? "pedido" : "pedidos"}, você recebe <b className="num">{R(ls.reduce((t, l) => t + l.liquido, 0))}</b></span></div>
              {ls.map(l => <div key={l.codigo} className="bd-ped"><span><b>#{l.codigo}</b><small>{l.hora ? `${l.hora}, ` : ""}{l.forma}</small><small className="it">{l.itens}</small></span><span className="num"><b>{R(l.liquido)}</b><small>produtos {R(l.produtos)}</small></span></div>)}
            </div> })}</div>}
          </div>) })}
      </div>}
      <div className="cartao" style={{ padding: 6, overflow: "auto" }}>
        <table className="tabela"><thead><tr><th>Data</th><th>Vendas de</th><th>Situação</th><th style={{ textAlign: "right" }}>Valor</th><th /></tr></thead><tbody>
          {rep.atual && <tr><td className="num">{dm(rep.ciclo.paga)}</td><td>{dm(rep.ciclo.ini)} a {dm(rep.ciclo.fim)}</td><td><span className="selo amarelo">Acumulando</span></td><td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{R(rep.aReceber)}</td><td /></tr>}
          {rep.pagos.map((p, i) => <tr key={i}><td className="num">{new Date(p.ocorrido_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}</td><td>{p.motivo.replace(/^Repasse de /, "")}</td><td><span className="selo verde">Pago</span></td><td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{R(p.valor)}</td>
            <td>{p.comprovante ? <a className="btn btn-l" href={`/api/loja/comprovante?id=${p.id}`} target="_blank" rel="noreferrer">Comprovante</a> : <span className="t12 mut">comprovante em breve</span>}</td></tr>)}
          {!rep.atual && !rep.pagos.length && <tr><td colSpan={5} className="vazio">Nenhum repasse ainda.</td></tr>}
        </tbody></table>
      </div>
      <p className="t14 mut" style={{ marginTop: 10 }}>O repasse cai na chave Pix da loja e o comprovante fica aqui. Pra trocar a chave, vá em Loja e horários.</p>
    </>
  )
}

function AbaExtrato({ rep, carregar }: { rep: Repasse; carregar: (c?: string) => Promise<Repasse | null> }) {
  // Qualquer semana (sexta a quinta) desde 16/10, a mais recente primeiro (20/10/2026, pedido do Lucas)
  const semanas = useMemo(() => {
    const out: { ini: string; fim: string }[] = []
    const mais = (d: string, n: number) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
    for (let ini = rep.ciclo.ini; mais(ini, 6) >= "2026-10-16" && out.length < 104; ini = mais(ini, -7)) out.push({ ini, fim: mais(ini, 6) })
    return out
  }, [rep.ciclo.ini])
  const [sel, setSel] = useState(rep.ciclo.ini)
  const [cache, setCache] = useState<Record<string, Repasse>>({ [rep.ciclo.ini]: rep })
  useEffect(() => { if (!cache[sel]) carregar(sel).then(r => { if (r) setCache(cc => ({ ...cc, [sel]: r })) }) }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps
  const x = cache[sel] ?? null, L = x?.resumo.linhas ?? [], c = x?.ciclo
  const tot = (f: (l: Linha) => number) => R(L.reduce((t, l) => t + f(l), 0))
  return (
    <>
      <div className="lin" style={{ flexWrap: "wrap", marginBottom: 12, gap: 8 }}>
        <label className="lin" style={{ gap: 8 }}><span className="t14 mut">Semana</span>
          <select className="ex-sem" value={sel} onChange={e => setSel(e.target.value)}>
            {semanas.map((w, i) => <option key={w.ini} value={w.ini}>{i === 0 ? "Esta semana, " : i === 1 ? "Semana passada, " : ""}{dm(w.ini < "2026-10-16" ? "2026-10-16" : w.ini)} a {dm(w.fim)}</option>)}
          </select></label>
        {x && <span className={`selo ${x.pagoCiclo ? "verde" : x.atual ? "amarelo" : "azul"}`}>{x.pagoCiclo ? `Repasse pago em ${new Date(x.pagoCiclo.ocorrido_em).toLocaleDateString("pt-BR")}` : x.atual ? "Acumulando" : `A receber na sexta ${dm(x.ciclo.paga)}`}</span>}
        {c && <span className="lin" style={{ marginLeft: "auto", gap: 8 }}>
          <button className="btn btn-s" onClick={() => imprimir(`Extrato de ${dm(c.ini)} a ${dm(c.fim)}`, `Repasse na sexta ${dm(c.paga)}. Só produtos, sem a taxa de entrega.`, L)}><Ico n="impressora" /> Imprimir extrato</button>
          <button className="btn btn-s" onClick={() => baixar(`extrato-${c.ini}-a-${c.fim}.csv`, L)}>Baixar planilha</button></span>}
      </div>
      {!x ? <p className="mut">Carregando…</p> : (
        <div className="cartao" style={{ padding: 6, overflow: "auto" }}>
          <table className="tabela"><thead><tr><th>Pedido</th><th className="esconde">Pagamento</th><th>Produtos</th><th className="esconde">Cupom</th><th className="esconde">Comissão e taxas</th><th style={{ textAlign: "right" }}>Você recebe</th></tr></thead>
            <tbody>{L.map(l => <tr key={l.id}><td><b>#{l.codigo}</b><br /><span className="t12 mut">{dm(l.dia)} {hora(l.criado_em)}</span></td><td className="esconde">{forma(l)}</td><td className="num">{R(l.produtos)}</td><td className="num esconde">{l.cupomLoja ? "− " + R(l.cupomLoja) : "–"}</td><td className="num esconde">{l.comissao + l.taxaOnline + l.taxaMaquininha ? "− " + R(l.comissao + l.taxaOnline + l.taxaMaquininha) : "–"}</td><td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{R(l.liquido)}</td></tr>)}
              {!L.length && <tr><td colSpan={6} className="vazio">Nenhum pedido entregue nesta semana ainda.</td></tr>}</tbody>
            {L.length > 0 && <tfoot><tr><td><b>{L.length} pedidos</b></td><td className="esconde" /><td className="num"><b>{tot(l => l.produtos)}</b></td><td className="num esconde"><b>− {tot(l => l.cupomLoja)}</b></td><td className="num esconde"><b>− {tot(l => l.comissao + l.taxaOnline + l.taxaMaquininha)}</b></td><td className="num" style={{ textAlign: "right" }}><b>{tot(l => l.liquido)}</b></td></tr></tfoot>}
          </table>
        </div>
      )}
    </>
  )
}

function FolhaAdiantar({ disponivel, onFechar }: { disponivel: number; onFechar: (ok: boolean) => void }) {
  const [v, setV] = useState(""), [erro, setErro] = useState(""), [env, setEnv] = useState(false)
  const num = Number(v.replace(/\./g, "").replace(",", ".")) || 0
  async function pedir() {
    if (!(num > 5)) { setErro("O valor precisa ser maior que a taxa de R$ 5,00."); return }
    if (num > disponivel + 0.001) { setErro("Esse valor é maior que o disponível."); return }
    setEnv(true); setErro("")
    const r = await fetch("/api/loja/saque", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valor: num }) })
    const j = await r.json().catch(() => ({})); setEnv(false)
    if (!r.ok) { setErro(j.error ?? "Não foi possível pedir o adiantamento."); return }
    onFechar(true)
  }
  return (
    <div className="veu on" onClick={() => !env && onFechar(false)}>
      <div className="mais-folha" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="t20">Adiantar o repasse</div>
        <p className="t14 mut" style={{ margin: "6px 0 14px" }}>Disponível agora: {R(disponivel)}. A taxa de R$ 5,00 sai do valor adiantado, e o que você adiantar sai do repasse de sexta.</p>
        <label className="campo"><span>Quanto quer adiantar</span><input inputMode="numeric" placeholder="R$ 0,00" value={v} onChange={e => setV(mascaraBRL(e.target.value))} /></label>
        {num > 5 && <p className="t14" style={{ margin: "-6px 0 12px", fontWeight: 700, color: "var(--folha)" }}>Você recebe {R(num - 5)}</p>}
        {erro && <div className="aviso vm" style={{ marginBottom: 10 }}>{erro}</div>}
        <button className="btn btn-v cheio" disabled={env} onClick={pedir}>{env ? "Pedindo…" : "Pedir adiantamento"}</button>
      </div>
    </div>
  )
}
