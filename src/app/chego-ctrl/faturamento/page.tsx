"use client"

// Repasses, a mesa de pagamento (admin 2.0, 20/10/2026, pedido do Lucas):
// pra cada loja (ciclo de sexta a quinta) e cada motoboy (saldo desde 16/10):
//   Conferir → Borderô enviado → Loja conferiu → Pago (com comprovante).
// O borderô é a relação de pedidos que forma o valor (só produtos, nunca frete), com trava de 100%
// pedido a pedido. Vai pra loja conferir no painel dela, por WhatsApp ou PDF. O pagamento sai por
// Pix pelo Asaas (comprovante anexado sozinho) ou "já paguei por fora" (anexa o comprovante aqui).
// O servidor recalcula tudo antes de pagar e recusa se o valor mudou.
import { useEffect, useMemo, useRef, useState } from "react"
import { R, dm } from "../_dinheiro"
import { gravarAdmin } from "@/lib/adminGravar"
import { chavePixParece } from "@/lib/repasseLoja"

type Chave = { tipo: string; certeza: boolean } | null
type Reg = { id: string; status: string; valor: number; qtd: number; enviado_em: string; respondido_em: string | null; resposta: string | null; movimento_id: string | null; pago_em: string | null }
type LinhaLoja = { loja_id: string; nome: string; logo_url: string | null; pedidos: number; produtos: number; liquido: number; saldo?: number; adiantado?: number; chave: string | null; chaveTipo: Chave; chaveOk?: boolean
  pago: { id: string; valor: number; ocorrido_em: string; origem: string; comprovante_path: string | null } | null }
type Rep = { ciclo: { ini: string; fim: string; paga: string }; encerrado: boolean; saldoAsaas: number | null; lojas: LinhaLoja[] }
type SaldoMb = { id: string; nome: string; entregas: number; ganho: number; pago: number; pendente: number; reservado: number; livre: number; telefone: string | null; chave: string | null; chaveTipo: Chave }
type Saque = { id: string; tipo: string; motoboy_id: string | null; valor: number; taxa_saque: number | null; status: string; pix_chave: string | null; chaveTipo: Chave; criado_em: string; motoboy: { nome: string } | null }
type BLoja = { tipo: "loja"; id: string; nome: string; periodo_ini: string; periodo_fim: string; paga: string; alertas: number; frete: number
  linhas: { codigo: string; dia: string; hora?: string; forma: string; itens: string; frete: number; alerta: string | null; produtos: number; cupom: number; comissao: number; taxas: number; entrega: number; balcao: number; liquido: number }[]
  produtos: number; cupom: number; comissao: number; taxas: number; entrega: number; balcao: number; avulsas: number; qtdAvulsas: number; ajustes?: number; ajustesLista?: { valor: number; motivo: string; dia: string }[]; adiantado: number; valor: number; saldo: number }
type BMb = { tipo: "motoboy"; id: string; nome: string; periodo_ini: string; periodo_fim: string; linhas: { codigo: string; dia: string; loja: string; ganho: number; avulsa: boolean }[]
  ganho: number; bonus: number; descontos: number; pago: number; compensado: number; reservado: number; valor: number }
type Aberto = { b: BLoja | BMb; registro: Reg | null; telefone: string | null }

const TIPOS: [string, string][] = [["CPF", "CPF"], ["PHONE", "Celular"], ["CNPJ", "CNPJ"], ["EMAIL", "E-mail"], ["EVP", "Chave aleatória"]]
const soma = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const hojeBrt = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
const sextaDe = (ymd: string) => { const w = new Date(`${ymd}T12:00:00Z`).getUTCDay(); return soma(ymd, -((w - 5 + 7) % 7)) }
// Borderô por dia (21/10/2026, pedido do Lucas): fechamento de cada dia + pedidos agrupados por dia
const DSEM = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
const nomeDia = (d: string) => `${DSEM[new Date(`${d}T12:00:00Z`).getUTCDay()]}, ${dm(d)}`
function porDia<T extends { dia: string }>(ls: T[]): [string, T[]][] {
  const m = new Map<string, T[]>()
  for (const l of [...ls].sort((a, b) => a.dia.localeCompare(b.dia))) { if (!m.has(l.dia)) m.set(l.dia, []); m.get(l.dia)!.push(l) }
  return [...m.entries()]
}
const mascaraBrl = (v: string) => { const d = v.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9); return d ? (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "" }
const paraNumBrl = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0
const wa = (tel: string | null | undefined, msg: string) => { const t = (tel ?? "").replace(/\D/g, ""); return t ? `https://wa.me/55${t}?text=${encodeURIComponent(msg)}` : null }
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!))
async function post(url: string, body: object) {
  const r = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? "Não deu certo"); return j
}

// Etapa de cada um: 0 acumulando, 1 conferir, 2 com a loja, 3 conferido/contestado, 4 pago
type Etapa = { n: number; txt: string; cor: string }
function etapaLoja(l: LinhaLoja, reg: Reg | undefined, encerrado: boolean, aguardandoToken = false): Etapa {
  if (l.pago && aguardandoToken) return { n: 3, txt: "Aguardando token no Asaas", cor: "amarelo" }
  if (l.pago) return { n: 4, txt: l.pago.comprovante_path ? "Pago, com comprovante" : "Pago, falta comprovante", cor: l.pago.comprovante_path ? "verde" : "amarelo" }
  if ((l.saldo ?? 0) < -0.004) return { n: 0, txt: `Loja deve ${R(-(l.saldo ?? 0))} ao Chegô`, cor: "vermelho" }
  if (!encerrado) return { n: 0, txt: "Semana ainda correndo", cor: "cinza" }
  if (!reg) return { n: 1, txt: "Falta mandar o borderô", cor: "cinza" }
  if (Math.abs(Number(reg.valor) - l.liquido) > 0.009) return { n: 1, txt: "Valor mudou, mande de novo", cor: "vermelho" }
  if (reg.status === "conferido") return { n: 3, txt: "Loja conferiu, pode pagar", cor: "azul" }
  if (reg.status === "contestado") return { n: 3, txt: "Loja apontou erro", cor: "vermelho" }
  return { n: 2, txt: "Esperando a loja conferir", cor: "amarelo" }
}
const ETAPAS = ["Conferir", "Borderô", "Loja conferiu", "Pago"]
function Passos({ e }: { e: Etapa }) {
  return <span className="rp-passos" aria-label={e.txt}>{ETAPAS.map((n, i) => <i key={n} className={i + 1 < e.n || e.n === 4 ? "feito" : i + 1 === e.n ? `agora ${e.cor}` : ""} title={n} />)}<span className={`selo ${e.cor}`}>{e.txt}</span></span>
}

export default function RepassesPage() {
  const hoje = hojeBrt(), s0 = sextaDe(hoje)
  // Ciclo que vai ser pago: na sexta, o que fechou ontem; nos outros dias, o que está correndo
  const base = hoje === s0 ? soma(s0, -7) : s0
  const CICLOS = [0, 1, 2, 3].map(k => { const ini = soma(base, -7 * k); return { ini, fim: soma(ini, 6), paga: soma(ini, 7) } }).filter(c => c.fim >= "2026-10-16")
  const [ci, setCi] = useState(CICLOS[0].ini)
  const [aba, setAba] = useState<"lojas" | "motoboys">("lojas")
  const [filtro, setFiltro] = useState("todos")
  const [rep, setRep] = useState<Rep | null>(null)
  const [regs, setRegs] = useState<{ lojas: Record<string, Reg>; motoboys: Record<string, Reg> }>({ lojas: {}, motoboys: {} })
  const [mbs, setMbs] = useState<SaldoMb[]>([])
  const [saques, setSaques] = useState<Saque[]>([])
  const [erro, setErro] = useState("")
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)
  const [aberto, setAberto] = useState<Aberto | null>(null)
  const [carregandoB, setCarregandoB] = useState<string | null>(null)
  const [pagar, setPagar] = useState<{ tipo: "loja" | "motoboy" | "saque"; id: string; nome: string; valor: number; chave: string | null; chaveTipo: Chave; chaveOk: boolean; modo: "asaas" | "manual"; tipoChave: string; aviso: string | null; ciente: boolean; arquivo: File | null; max: number; valorTxt: string } | null>(null)
  // Trocar a chave Pix na própria janela de pagar (21/10/2026)
  const [novaChave, setNovaChave] = useState<{ aberto: boolean; chave: string; tipo: string; salvando: boolean; erro: string }>({ aberto: false, chave: "", tipo: "", salvando: false, erro: "" })
  const [enviando, setEnviando] = useState(false)
  const [tick, setTick] = useState(0)
  const arqLinha = useRef<HTMLInputElement>(null), [anexoId, setAnexoId] = useState<string | null>(null)
  // Pix do painel que o Asaas segura até você autorizar com o token (21/10/2026)
  const [pix, setPix] = useState<{ itens: { k: string; id: string; valor: number; loja_id: string | null; motoboy_id: string | null; destinatario_nome?: string; situacao: string }[]; aguardando: number; valorAguardando: number; desfeitos: number } | null>(null)
  useEffect(() => { fetch("/api/admin/transferencias-status", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(j => { setPix(prev => j ? { ...j, desfeitos: Math.max(j.desfeitos, prev?.desfeitos ?? 0) } : prev); if (j?.desfeitos) setTick(t => t + 1) }).catch(() => {}) }, [tick === 0]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setRep(null); setErro("")
    Promise.all([
      fetch(`/api/admin/repasses?ciclo=${ci}`, { credentials: "include" }).then(r => r.ok ? r.json() : Promise.reject("Não foi possível calcular os repasses.")),
      fetch(`/api/admin/bordero?lista=1&ciclo=${ci}`, { credentials: "include" }).then(r => r.json()).catch(() => ({ lojas: {}, motoboys: {} })),
      fetch(`/api/admin/repasses-painel?de=2026-10-16&ate=${hoje}`, { credentials: "include" }).then(r => r.json()).catch(() => ({ saldoMotoboys: [] })),
      fetch(`/api/admin/pagamentos`, { credentials: "include" }).then(r => r.json()).catch(() => ({ saques: [] })),
    ]).then(([a, b, c, d]) => {
      setRep(a); setRegs({ lojas: b.lojas ?? {}, motoboys: b.motoboys ?? {} })
      setMbs((c.saldoMotoboys ?? []).filter((m: SaldoMb) => m.pendente > 0.004 || m.entregas > 0)); setSaques((d.saques ?? []).filter((s: Saque) => s.tipo === "motoboy" && s.status === "solicitado"))
      if (b.error) setErro(b.error)
    }).catch(e => setErro(String(e)))
  }, [ci, tick, hoje])
  const recarregar = () => setTick(t => t + 1)

  const agIds = useMemo(() => new Set((pix?.itens ?? []).filter(x => x.situacao === "aguardando_token").map(x => x.id)), [pix])
  const lojas = useMemo(() => (rep?.lojas ?? []).map(l => ({ l, e: etapaLoja(l, regs.lojas[l.loja_id], !!rep?.encerrado, !!l.pago && agIds.has(l.pago.id)) })), [rep, regs, agIds])
  const contagem = useMemo(() => {
    const c: Record<string, number> = { todos: lojas.length, mandar: 0, loja: 0, erro: 0, pagar: 0, pagos: 0 }
    for (const { e } of lojas) { if (e.n === 1) c.mandar++; if (e.n === 2) c.loja++; if (e.cor === "vermelho") c.erro++; if (e.n === 3 && e.cor === "azul") c.pagar++; if (e.n === 4) c.pagos++ }
    return c
  }, [lojas])
  const lojasFilt = lojas.filter(({ e }) => filtro === "todos" || (filtro === "mandar" && e.n === 1) || (filtro === "loja" && e.n === 2) || (filtro === "erro" && e.cor === "vermelho") || (filtro === "pagar" && e.n === 3 && e.cor === "azul") || (filtro === "pagos" && e.n === 4))

  if (!rep) return <p className="mut">{erro || "Calculando os repasses…"}</p>
  const c = rep.ciclo
  const faltaLojas = lojas.filter(x => !x.l.pago).reduce((t, x) => t + x.l.liquido, 0)
  const pagoLojas = lojas.filter(x => x.l.pago).reduce((t, x) => t + (x.l.pago?.valor ?? 0), 0)
  const faltaMb = mbs.reduce((t, m) => t + m.livre, 0) + saques.reduce((t, s) => t + Number(s.valor) - Number(s.taxa_saque ?? 0), 0)
  const total = faltaLojas + faltaMb

  async function abrirBordero(tipo: "loja" | "motoboy", id: string) {
    setCarregandoB(id); setMsg(null)
    try {
      const r = await fetch(`/api/admin/bordero?tipo=${tipo}&id=${id}${tipo === "loja" ? `&ciclo=${c.ini}` : ""}`, { credentials: "include" }); const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? "Não foi possível montar o borderô.")
      setAberto({ b: j.bordero, registro: j.registro, telefone: j.telefone })
    } catch (e: any) { setMsg({ t: e.message, ok: false }) }
    setCarregandoB(null)
  }
  async function enviarBordero() {
    if (!aberto) return
    try { const j = await post("/api/admin/bordero", { acao: "enviar", tipo: aberto.b.tipo, id: aberto.b.id, ciclo_ini: c.ini }); setAberto({ ...aberto, registro: j.registro }); setMsg({ t: aberto.b.tipo === "loja" ? `Borderô enviado. ${aberto.b.nome} já vê no painel dela, em Financeiro > Repasses.` : "Borderô registrado. Mande pelo WhatsApp pro motoboy conferir.", ok: true }); recarregar() }
    catch (e: any) { setMsg({ t: e.message, ok: false }) }
  }
  async function cancelarEnvio() {
    if (!aberto?.registro) return
    try { await post("/api/admin/bordero", { acao: "cancelar", bordero_id: aberto.registro.id }); setAberto({ ...aberto, registro: null }); recarregar() } catch (e: any) { setMsg({ t: e.message, ok: false }) }
  }
  function textoWa(a: Aberto) {
    const b = a.b
    const aj = b.tipo === "loja" ? b.ajustes ?? 0 : 0, ajLs = b.tipo === "loja" ? b.ajustesLista ?? [] : []
    if (b.tipo === "loja") return `Olá, ${b.nome}! Aqui é o Chegô. Segue o borderô do repasse de ${dm(b.periodo_ini)} a ${dm(b.periodo_fim)}:\n\n${b.linhas.length} pedidos\nProdutos: ${R(b.produtos)} (frete não entra)\nDescontos (comissão, taxas, cupom e o que já recebeu na loja): ${R(b.produtos + aj - b.saldo - b.adiantado - b.avulsas)}\n${ajLs.map(x => `${x.valor < 0 ? "Desconto" : "Crédito"}: ${x.valor < 0 ? "− " : "+ "}${R(Math.abs(x.valor))} (${x.motivo})\n`).join("")}${b.adiantado ? `Adiantamento de terça: ${R(b.adiantado)}\n` : ""}${b.saldo < -0.004 ? `*Você recebeu direto mais do que tinha a receber e deve ao Chegô: ${R(-b.saldo)}* (comissão, taxas e frete dos pedidos pagos na loja).` : `*Você recebe: ${R(b.valor)}* na sexta ${dm(b.paga)}.`}\n\nA lista de cada pedido está no seu painel, em Financeiro > Repasses. Confira e toque em "Está certo" ou "Tem algo errado".`
    return `Olá, ${b.nome}! Aqui é o Chegô. Suas entregas desde ${dm(b.periodo_ini)}:\n\n${b.linhas.length} entregas, ganho ${R(b.ganho)}\n${b.bonus ? `Bônus: ${R(b.bonus)}\n` : ""}${b.descontos ? `Descontos: ${R(b.descontos)}\n` : ""}Já recebeu: ${R(b.pago + b.compensado)}\n*A receber: ${R(b.valor)}*\n\n${b.linhas.map(l => `${dm(l.dia)} #${l.codigo} ${l.loja}: ${R(l.ganho)}`).join("\n")}\n\nConfere e me responde por aqui se está certo.`
  }
  function imprimir(a: Aberto) {
    const w = window.open("", "_blank"); if (!w) { setMsg({ t: "Libere as janelas do navegador pra gerar o PDF.", ok: false }); return }
    const b = a.b, logo = `${location.origin}/logo-chego-transparente.png`, agora = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    const css = `@page{size:A4;margin:14mm 12mm}*{box-sizing:border-box}body{font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1d1b18;margin:0;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .cab{display:flex;align-items:center;gap:16px;padding-bottom:14px;border-bottom:3px solid #E63A2E}.cab img{height:46px}.cab h1{font-size:20px;margin:0;letter-spacing:-.01em}.cab p{margin:2px 0 0;color:#6b665e;font-size:12px}.cab .doc{margin-left:auto;text-align:right;font-size:11px;color:#6b665e}.cab .doc b{display:block;font-size:13px;color:#1d1b18}
      .res{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:8px;margin:16px 0}.res div{background:#F4F2EE;border-radius:10px;padding:10px 12px}.res span{display:block;font-size:10.5px;color:#6b665e;font-weight:600}.res b{font-size:17px;white-space:nowrap}.res .f{background:#1d1b18;color:#fff}.res .f span{color:#cfcac2}
      .duas{display:grid;grid-template-columns:1fr 1.1fr;gap:16px;align-items:start;margin-bottom:16px}
      .conta{border:1px solid #e3dfd8;border-radius:10px;padding:10px 14px}.conta h2,.obs h2{font-size:12px;margin:0 0 6px;text-transform:none}.conta .l{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}.conta .l b{white-space:nowrap}.conta .t{border-top:2px solid #1d1b18;margin-top:6px;padding-top:7px;font-size:15px;font-weight:800}
      .obs{font-size:11px;color:#4b4741;line-height:1.5}.obs .ok{color:#1E8A4C;font-weight:700}.obs .al{color:#B42318;font-weight:700}
      table{width:100%;border-collapse:collapse}thead th{background:#1d1b18;color:#fff;font-size:10.5px;font-weight:700;padding:7px 6px;text-align:left}thead th:first-child{border-radius:6px 0 0 6px}thead th:last-child{border-radius:0 6px 6px 0}
      td{padding:4px 6px;border-bottom:1px solid #ece8e1;vertical-align:top;font-size:10.5px;line-height:1.3}tbody tr:nth-child(even) td{background:#FAF9F6}.r{text-align:right;white-space:nowrap}.cod{font-weight:700;white-space:nowrap}.it{color:#6b665e;font-size:10.5px}.m{color:#9b958c}
      tr.alerta td{background:#FDECEA!important}.al{color:#B42318;font-weight:700;font-size:10px}tfoot td{font-weight:800;border-top:2px solid #1d1b18;border-bottom:0;font-size:11.5px;background:#fff}
      tr{page-break-inside:avoid}thead{display:table-header-group}tr.dia td{background:#1d1b18!important;color:#fff;font-weight:700;font-size:11.5px;padding:6px 8px}tr.sub td{font-weight:800;background:#F4F2EE!important;border-bottom:2px solid #d9d4cb}h3{font-size:13px;margin:16px 0 6px}
      .ass{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:22px;page-break-inside:avoid;font-size:11px;color:#6b665e}.ass div{border-top:1px solid #1d1b18;padding-top:5px}
      .pe{margin-top:16px;font-size:10px;color:#9b958c;text-align:center}`
    const L = (n: string, v: string) => `<div class="l"><span>${n}</span><b>${v}</b></div>`
    let corpo = ""
    if (b.tipo === "loja") {
      const desc = b.produtos - b.linhas.reduce((t, l) => t + l.liquido, 0), dias = porDia(b.linhas), aj = b.ajustes ?? 0, ajLs = b.ajustesLista ?? []
      corpo = `<div class="cab"><img src="${logo}" alt="Chegô"><div><h1>Borderô de repasse</h1><p>${esc(b.nome)}</p></div><div class="doc"><b>Vendas de ${dm(b.periodo_ini)} a ${dm(b.periodo_fim)}</b>Repasse na sexta ${dm(b.paga)}<br>Gerado em ${agora}</div></div>
        <div class="res"><div><span>Pedidos entregues</span><b>${b.linhas.length}</b></div><div><span>Produtos vendidos</span><b>${R(b.produtos)}</b></div><div><span>Descontos</span><b>− ${R(b.produtos + aj - b.saldo)}</b></div>${aj ? `<div><span>Ajustes do Chegô</span><b>${aj < 0 ? "− " : "+ "}${R(Math.abs(aj))}</b></div>` : ""}<div class="f"><span>${b.saldo < -0.004 ? "Você deve ao Chegô" : "Você recebe"}</span><b>${R(Math.abs(b.saldo))}</b></div></div>
        <div class="duas"><div class="conta"><h2>Conta do repasse</h2>${L("Produtos (sem frete)", R(b.produtos))}${b.cupom ? L("Cupom da loja", "− " + R(b.cupom)) : ""}${L("Comissão do Chegô", "− " + R(b.comissao))}${L("Taxas de pagamento", "− " + R(b.taxas))}${b.entrega ? L("Participação na entrega", "− " + R(b.entrega)) : ""}${b.balcao ? L("Recebido direto na loja", "− " + R(b.balcao)) : ""}${b.avulsas ? L(`Entregas avulsas (${b.qtdAvulsas})`, "− " + R(b.avulsas)) : ""}${ajLs.map(x => L(esc(x.motivo), (x.valor < 0 ? "− " : "+ ") + R(Math.abs(x.valor)))).join("")}${b.adiantado ? L("Adiantamento de terça", "− " + R(b.adiantado)) : ""}<div class="l t"><span>${b.saldo < -0.004 ? "A loja deve ao Chegô" : "A receber"}</span><b>${R(Math.abs(b.saldo))}</b></div></div>
        <div class="obs"><h2>Como conferir</h2>Cada linha é um pedido entregue. A loja recebe só os produtos: a comissão, a taxa da forma de pagamento e o cupom da loja saem de cada pedido. O frete (${R(b.frete)} no período) é do motoboy e <b>não entra</b>.<br><br>${b.alertas ? `<span class="al">${b.alertas} ${b.alertas === 1 ? "pedido está marcado" : "pedidos estão marcados"} em vermelho pra conferir.</span>` : `<span class="ok">Todos os ${b.linhas.length} pedidos conferidos: produtos = itens + adicionais, e o total pago pelo cliente fecha.</span>`}<br><br>Achou algo errado? Responda no painel da loja, em Financeiro &gt; Repasses.</div></div>
        <h3>Fechamento por dia</h3>
        <table><thead><tr><th>Dia</th><th class="r">Pedidos</th><th class="r">Produtos</th><th class="r">Descontos</th><th class="r">Recebe</th><th class="r">Frete*</th></tr></thead><tbody>
        ${dias.map(([d, ls]) => { const pr = ls.reduce((t, l) => t + l.produtos, 0), lq = ls.reduce((t, l) => t + l.liquido, 0); return `<tr><td><b>${nomeDia(d)}</b></td><td class="r">${ls.length}</td><td class="r">${R(pr)}</td><td class="r">− ${R(pr - lq)}</td><td class="r"><b>${R(lq)}</b></td><td class="r m">${R(ls.reduce((t, l) => t + l.frete, 0))}</td></tr>` }).join("")}</tbody>
        <tfoot><tr><td>Semana</td><td class="r">${b.linhas.length}</td><td class="r">${R(b.produtos)}</td><td class="r">− ${R(desc)}</td><td class="r">${R(b.produtos - desc)}</td><td class="r m">${R(b.frete)}</td></tr></tfoot></table>
        <h3>Pedidos de cada dia</h3>
        <table><thead><tr><th>Hora</th><th>Pedido</th><th>Itens</th><th>Pagamento</th><th class="r">Produtos</th><th class="r">Descontos</th><th class="r">Recebe</th><th class="r">Frete*</th></tr></thead><tbody>
        ${dias.map(([d, ls]) => `<tr class="dia"><td colspan="8">${nomeDia(d)}, ${ls.length} ${ls.length === 1 ? "pedido" : "pedidos"}</td></tr>` + ls.map(l => `<tr class="${l.alerta ? "alerta" : ""}"><td>${l.hora ?? ""}</td><td class="cod">#${esc(l.codigo)}${l.alerta ? `<br><span class="al">${esc(l.alerta)}</span>` : ""}</td><td class="it">${esc(l.itens)}</td><td>${esc(l.forma)}</td><td class="r">${R(l.produtos)}</td><td class="r">${l.produtos - l.liquido > 0.004 ? "− " + R(l.produtos - l.liquido) : "–"}</td><td class="r"><b>${R(l.liquido)}</b></td><td class="r m">${R(l.frete)}</td></tr>`).join("")
          + `<tr class="sub"><td colspan="4">Fechamento de ${nomeDia(d)}</td><td class="r">${R(ls.reduce((t, l) => t + l.produtos, 0))}</td><td class="r">− ${R(ls.reduce((t, l) => t + l.produtos - l.liquido, 0))}</td><td class="r">${R(ls.reduce((t, l) => t + l.liquido, 0))}</td><td class="r m">${R(ls.reduce((t, l) => t + l.frete, 0))}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="4">${b.linhas.length} pedidos</td><td class="r">${R(b.produtos)}</td><td class="r">− ${R(desc)}</td><td class="r">${R(b.produtos - desc)}</td><td class="r m">${R(b.frete)}</td></tr></tfoot></table>
        <p class="it" style="margin-top:6px">* Frete só pra referência: é do motoboy e não entra na conta da loja.${b.adiantado || b.avulsas || aj ? " Adiantamento, entregas avulsas e ajustes do Chegô entram na conta do repasse acima, fora da lista de pedidos." : ""}</p>
        <div class="ass"><div>Conferido pela loja (nome e data)</div><div>Chegô Delivery</div></div>`
    } else {
      corpo = `<div class="cab"><img src="${logo}" alt="Chegô"><div><h1>Borderô de entregas</h1><p>${esc(b.nome)}</p></div><div class="doc"><b>Entregas de ${dm(b.periodo_ini)} a ${dm(b.periodo_fim)}</b>Gerado em ${agora}</div></div>
        <div class="res"><div><span>Entregas</span><b>${b.linhas.length}</b></div><div><span>Ganho nas entregas</span><b>${R(b.ganho)}</b></div><div><span>Já recebeu</span><b>${R(b.pago + b.compensado)}</b></div><div class="f"><span>A receber</span><b>${R(b.valor)}</b></div></div>
        <div class="duas"><div class="conta"><h2>Conta</h2>${L("Ganho nas entregas", R(b.ganho))}${b.bonus ? L("Bônus", "+ " + R(b.bonus)) : ""}${b.descontos ? L("Descontos", "− " + R(b.descontos)) : ""}${L("Já recebeu", "− " + R(b.pago + b.compensado))}${b.reservado ? L("Saque já pedido", "− " + R(b.reservado)) : ""}<div class="l t"><span>A receber</span><b>${R(b.valor)}</b></div></div>
        <div class="obs"><h2>Como conferir</h2>Cada linha é uma entrega feita. O ganho é a taxa de entrega, com mínimo de R$ 4,00 por corrida.</div></div>
        <h3>Fechamento por dia</h3>
        <table><thead><tr><th>Dia</th><th class="r">Entregas</th><th class="r">Ganho</th></tr></thead><tbody>${porDia(b.linhas).map(([d, ls]) => `<tr><td><b>${nomeDia(d)}</b></td><td class="r">${ls.length}</td><td class="r"><b>${R(ls.reduce((t, l) => t + l.ganho, 0))}</b></td></tr>`).join("")}</tbody>
        <tfoot><tr><td>Período</td><td class="r">${b.linhas.length}</td><td class="r">${R(b.ganho)}</td></tr></tfoot></table>
        <h3>Corridas de cada dia</h3>
        <table><thead><tr><th>Entrega</th><th>Loja</th><th class="r">Ganho</th></tr></thead><tbody>${porDia(b.linhas).map(([d, ls]) => `<tr class="dia"><td colspan="3">${nomeDia(d)}, ${ls.length} ${ls.length === 1 ? "corrida" : "corridas"}</td></tr>` + ls.map(l => `<tr><td class="cod">#${esc(l.codigo)}${l.avulsa ? ' <span class="it">avulsa</span>' : ""}</td><td>${esc(l.loja)}</td><td class="r"><b>${R(l.ganho)}</b></td></tr>`).join("") + `<tr class="sub"><td colspan="2">Fechamento de ${nomeDia(d)}</td><td class="r">${R(ls.reduce((t, l) => t + l.ganho, 0))}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="2">${b.linhas.length} corridas no período</td><td class="r">${R(b.ganho)}</td></tr></tfoot></table>
        <div class="ass"><div>Conferido pelo motoboy (nome e data)</div><div>Chegô Delivery</div></div>`
    }
    w.document.write(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Borderô ${esc(b.nome)} ${dm(b.periodo_ini)} a ${dm(b.periodo_fim)}</title><style>${css}</style><body>${corpo}<p class="pe">Chegô Delivery, Aragoiânia e região</p><script>const i=document.querySelector(".cab img");const go=()=>setTimeout(()=>print(),200);i&&!i.complete?(i.onload=go,i.onerror=go):go()<\/script></body></html>`)
    w.document.close()
  }
  function abrirPagar(tipo: "loja" | "motoboy" | "saque", o: { id: string; nome: string; valor: number; chave: string | null; chaveTipo: Chave; chaveOk?: boolean; aviso?: string | null }) {
    // Loja: o servidor manda a chave mascarada e diz se ela parece Pix. Motoboy e saque: confere aqui.
    const ok = o.chaveOk ?? chavePixParece(o.chave)
    setMsg(null); setNovaChave({ aberto: !ok, chave: "", tipo: "", salvando: false, erro: "" })
    setPagar({ tipo, ...o, chaveOk: ok, modo: ok ? "asaas" : "manual", tipoChave: ok ? (o.chaveTipo?.tipo ?? "") : "", aviso: o.aviso ?? null, ciente: !o.aviso, arquivo: null, max: o.valor, valorTxt: o.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })
  }
  async function salvarChave() {
    if (!pagar) return
    setNovaChave(n => ({ ...n, salvando: true, erro: "" }))
    try {
      const j = await post("/api/admin/chave-pix", { quem: pagar.tipo, id: pagar.id, chave: novaChave.chave, tipo_chave: novaChave.tipo })
      setPagar({ ...pagar, chave: j.chave, chaveTipo: j.chaveTipo, chaveOk: true, tipoChave: novaChave.tipo, modo: "asaas" })
      setNovaChave({ aberto: false, chave: "", tipo: "", salvando: false, erro: "" }); recarregar()
    } catch (e: any) { setNovaChave(n => ({ ...n, salvando: false, erro: e.message })) }
  }
  async function confirmarPagamento() {
    if (!pagar) return
    setEnviando(true); setMsg(null)
    try {
      const j = pagar.tipo === "loja" ? await post("/api/admin/repasses", { loja_id: pagar.id, ciclo_ini: c.ini, modo: pagar.modo, tipo_chave: pagar.tipoChave, valor_confirmado: pagar.valor })
        : pagar.tipo === "motoboy" ? await post("/api/admin/pagar-motoboy", { motoboy_id: pagar.id, valor: pagar.valor, modo: pagar.modo, tipo_chave: pagar.tipoChave })
        : await post("/api/admin/saque-pagar", { saque_id: pagar.id, modo: pagar.modo, tipo_chave: pagar.tipoChave })
      // Pago por fora: anexa o comprovante escolhido no mesmo passo
      let anexou = false
      if (pagar.modo === "manual" && pagar.arquivo && (j.movimento || pagar.tipo === "saque")) {
        const fd = new FormData(); fd.append("tipo", pagar.tipo === "saque" ? "saque" : "movimento"); fd.append("id", pagar.tipo === "saque" ? pagar.id : j.movimento); fd.append("arquivo", pagar.arquivo)
        anexou = (await fetch("/api/admin/comprovante", { method: "POST", credentials: "include", body: fd })).ok
      }
      setMsg({ t: pagar.modo === "asaas" ? (j.aguardando ? `Pix de ${R(j.valor)} pra ${pagar.nome} criado no Asaas. Falta você autorizar com o token no app do Asaas (até 15h do próximo dia útil): só depois o dinheiro sai e o comprovante fica pronto.` : `Pix de ${R(j.valor)} enviado pra ${pagar.nome}. O comprovante do Asaas já ficou anexado${pagar.tipo === "loja" ? " e aparece no painel da loja" : ""}.`) : `Baixa de ${R(j.valor)} dada pra ${pagar.nome}.${anexou ? " Comprovante anexado." : " Anexe o comprovante na linha dele."}`, ok: true })
      setPagar(null); setAberto(null); recarregar()
      fetch("/api/admin/transferencias-status", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(j => j && setPix(j)).catch(() => {})
    } catch (e: any) { setMsg({ t: e.message, ok: false }) }
    setEnviando(false)
  }
  async function anexar(f: File | undefined) {
    if (!f || !anexoId) return
    const fd = new FormData(); fd.append("tipo", "movimento"); fd.append("id", anexoId); fd.append("arquivo", f)
    const r = await fetch("/api/admin/comprovante", { method: "POST", credentials: "include", body: fd })
    setMsg(r.ok ? { t: "Comprovante anexado. A loja já consegue ver.", ok: true } : { t: "Não foi possível anexar.", ok: false }); setAnexoId(null); if (arqLinha.current) arqLinha.current.value = ""; recarregar()
  }
  async function recusarSaque(s: Saque) {
    if (!confirm(`Recusar o saque de ${R(Number(s.valor) - Number(s.taxa_saque ?? 0))} de ${s.motoboy?.nome}? O valor volta pro saldo dele.`)) return
    const ok = await gravarAdmin("saques", s.id, { status: "cancelado" }).then(r => !r?.error).catch(() => false)
    setMsg(ok ? { t: "Saque recusado.", ok: true } : { t: "Não deu certo.", ok: false }); recarregar()
  }
  function exportarCsv() {
    const q = (v: unknown) => `"${String(v ?? "").replace(/^[=+@-]/, "'").replaceAll('"', '""')}"`
    const linhas = [["Loja", "Pedidos", "Produtos", "A receber", "Situação"], ...lojas.map(({ l, e }) => [l.nome, l.pedidos, l.produtos.toFixed(2).replace(".", ","), (l.pago?.valor ?? l.liquido).toFixed(2).replace(".", ","), e.txt]),
      [], ["Motoboy", "Entregas", "Ganho", "A receber", ""], ...mbs.map(m => [m.nome, m.entregas, m.ganho.toFixed(2).replace(".", ","), m.livre.toFixed(2).replace(".", ","), m.reservado ? `saque pedido ${m.reservado.toFixed(2).replace(".", ",")}` : ""])]
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + linhas.map(r => r.map(q).join(";")).join("\n")], { type: "text/csv" })); a.download = `repasses-${c.ini}.csv`; a.click()
  }

  const b = aberto?.b, reg = aberto?.registro
  const linhaLojaAtual = b?.tipo === "loja" ? rep.lojas.find(l => l.loja_id === b.id) : null
  const mbAtual = b?.tipo === "motoboy" ? mbs.find(m => m.id === b.id) : null

  return (
    <>
      <input ref={arqLinha} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => anexar(e.target.files?.[0])} />
      <div className="lin rp-topo">
        <span className="per-chips">{CICLOS.map((x, i) => <button key={x.ini} aria-pressed={ci === x.ini} onClick={() => setCi(x.ini)}>Sexta {dm(x.paga)}<small> vendas {dm(x.ini)} a {dm(x.fim)}</small></button>)}</span>
        <button className="btn btn-s" onClick={exportarCsv}>Exportar planilha</button>
      </div>

      <div className="rp-kpis">
        <div className="cartao rp-k forte"><span>Falta pagar</span><b className="num">{R(total)}</b><small>{R(faltaLojas)} às lojas e {R(faltaMb)} aos motoboys</small></div>
        <div className="cartao rp-k"><span>Já pago às lojas</span><b className="num">{R(pagoLojas)}</b><small>{contagem.pagos} de {lojas.length} lojas neste ciclo</small></div>
        {lojas.some(x => (x.l.saldo ?? 0) < -0.004) && <div className="cartao rp-k"><span>Lojas devem ao Chegô</span><b className="num" style={{ color: "var(--pimenta-esc)" }}>{R(-lojas.reduce((t, x) => t + Math.min(0, x.l.saldo ?? 0), 0))}</b><small>{lojas.filter(x => (x.l.saldo ?? 0) < -0.004).length} recebeu direto mais do que tinha a receber</small></div>}
        <div className="cartao rp-k"><span>Esperando a loja conferir</span><b className="num">{contagem.loja}</b><small>{contagem.erro ? `${contagem.erro} com erro apontado` : "nenhum erro apontado"}</small></div>
        <div className="cartao rp-k"><span>Saldo no Asaas</span><b className="num">{rep.saldoAsaas == null ? "–" : R(rep.saldoAsaas)}</b><small className={rep.saldoAsaas != null && rep.saldoAsaas >= total ? "ok" : "falta"}>{rep.saldoAsaas == null ? "o Asaas não respondeu" : rep.saldoAsaas >= total ? "cobre todos os pagamentos" : `faltam ${R(total - rep.saldoAsaas)}`}</small></div>
      </div>
      {pix && pix.aguardando > 0 && <div className="aviso am rp-token" style={{ marginBottom: 12 }}>
        <b>{pix.aguardando} {pix.aguardando === 1 ? "Pix esperando" : "Pix esperando"} sua autorização no app do Asaas ({R(pix.valorAguardando)}).</b> O Asaas só envia depois que você autoriza com o token, até as 15h do próximo dia útil. Se não autorizar, o Asaas cancela e o painel desfaz o pagamento sozinho.
        <span className="t12">{pix.itens.filter(x => x.situacao === "aguardando_token").map(x => `${x.destinatario_nome ?? (x.k === "saque" ? "saque" : "")} ${R(Number(x.valor))}`).join(", ")}</span></div>}
      {pix && pix.desfeitos > 0 && <div className="aviso vm" style={{ marginBottom: 12 }}>{pix.desfeitos} {pix.desfeitos === 1 ? "Pix foi cancelado" : "Pix foram cancelados"} no Asaas (não autorizado ou falhou). O pagamento foi desfeito no painel e o valor voltou a "a receber".</div>}
      {!rep.encerrado && <div className="aviso am" style={{ marginBottom: 12 }}>A semana de {dm(c.ini)} a {dm(c.fim)} ainda está correndo. Dá pra ver o borderô, mas o pagamento das lojas libera na sexta {dm(c.paga)}.</div>}
      {erro && <div className="aviso vm" style={{ marginBottom: 12 }}>{erro}</div>}
      {msg && <div className={`aviso ${msg.ok ? "vd" : "vm"}`} role="status" style={{ marginBottom: 12 }}>{msg.t}</div>}

      <div className="abas-l">{([["lojas", `Lojas (${lojas.length})`], ["motoboys", `Motoboys (${mbs.length})`]] as const).map(([k, n]) => <button key={k} aria-pressed={aba === k} onClick={() => setAba(k)}>{n}</button>)}</div>

      {aba === "lojas" && <>
        <div className="per-chips rp-filtros">{([["todos", "Todas"], ["mandar", "Falta mandar"], ["loja", "Esperando a loja"], ["erro", "Com erro"], ["pagar", "Prontas pra pagar"], ["pagos", "Pagas"]] as const).map(([k, n]) => <button key={k} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{n} {contagem[k] ? <b>{contagem[k]}</b> : null}</button>)}</div>
        <div className="cartao rp-lista">
          {lojasFilt.length === 0 && <p className="vazio">{lojas.length ? "Nenhuma loja nesse filtro." : "Nenhuma venda entregue nesse ciclo."}</p>}
          {lojasFilt.map(({ l, e }) => (
            <div key={l.loja_id} className="rp-l">
              <span className="rp-quem">{l.logo_url ? <img src={l.logo_url} alt="" /> : <span className="av">{l.nome[0]}</span>}<span><b>{l.nome}</b><small>{l.pedidos} pedidos, {R(l.produtos)} em produtos{l.adiantado ? `, adiantou ${R(l.adiantado)}` : ""}</small></span></span>
              <Passos e={e} />
              <span className="rp-v"><b className="num" style={(l.saldo ?? 0) < -0.004 ? { color: "var(--pimenta-esc)" } : undefined}>{(l.saldo ?? 0) < -0.004 ? `− ${R(-(l.saldo ?? 0))}` : R(l.pago?.valor ?? l.liquido)}</b><small>{l.pago ? `pago ${new Date(l.pago.ocorrido_em).toLocaleDateString("pt-BR")}` : (l.saldo ?? 0) < -0.004 ? "deve ao Chegô" : "a receber"}</small></span>
              <span className="rp-ac">
                <button className="btn btn-s" disabled={carregandoB === l.loja_id} onClick={() => abrirBordero("loja", l.loja_id)}>{carregandoB === l.loja_id ? "Abrindo…" : "Borderô"}</button>
                {!l.pago && rep.encerrado && l.liquido > 0 && <button className="btn btn-v" onClick={() => abrirPagar("loja", { id: l.loja_id, nome: l.nome, valor: l.liquido, chave: l.chave, chaveTipo: l.chaveTipo, chaveOk: l.chaveOk, aviso: e.cor === "vermelho" ? e.txt : e.n < 3 ? "A loja ainda não conferiu o borderô." : null })}>Pagar</button>}
                {l.pago && (l.pago.comprovante_path ? <a className="btn btn-l" href={`/api/admin/comprovante?tipo=movimento&id=${l.pago.id}`} target="_blank" rel="noreferrer">Comprovante</a>
                  : <button className="btn btn-s" onClick={() => { setAnexoId(l.pago!.id); setTimeout(() => arqLinha.current?.click(), 0) }}>Anexar comprovante</button>)}
              </span>
            </div>))}
        </div>
      </>}

      {aba === "motoboys" && (
        <div className="cartao rp-lista">
          {mbs.length === 0 && saques.length === 0 && <p className="vazio">Nenhum motoboy com saldo a receber.</p>}
          {mbs.map(m => {
            const r = regs.motoboys[m.id], s = saques.filter(x => x.motoboy_id === m.id)
            const agMb = (pix?.itens ?? []).filter(x => x.motoboy_id === m.id && x.situacao === "aguardando_token")
            const e: Etapa = agMb.length ? { n: 3, txt: `Pix de ${R(agMb.reduce((t, x) => t + Number(x.valor), 0))} aguardando token no Asaas`, cor: "amarelo" } : m.livre <= 0.004 && !s.length ? { n: 4, txt: "Tudo pago", cor: "verde" } : r && Math.abs(Number(r.valor) - m.livre) < 0.01 ? { n: 2, txt: "Borderô enviado", cor: "amarelo" } : { n: 1, txt: "Falta mandar o borderô", cor: "cinza" }
            return (
              <div key={m.id} className="rp-l">
                <span className="rp-quem"><span className="av mb">{m.nome[0]}</span><span><b>{m.nome}</b><small>{m.entregas} entregas desde 16/10, ganhou {R(m.ganho)}, já recebeu {R(m.pago)}</small></span></span>
                <Passos e={e} />
                <span className="rp-v"><b className="num">{R(m.livre)}</b><small>{m.reservado ? `+ ${R(m.reservado)} em saque pedido` : "a receber"}</small></span>
                <span className="rp-ac">
                  <button className="btn btn-s" disabled={carregandoB === m.id} onClick={() => abrirBordero("motoboy", m.id)}>{carregandoB === m.id ? "Abrindo…" : "Borderô"}</button>
                  {m.livre > 0.004 && <button className="btn btn-v" onClick={() => abrirPagar("motoboy", { id: m.id, nome: m.nome, valor: m.livre, chave: m.chave, chaveTipo: m.chaveTipo })}>Pagar</button>}
                </span>
                {s.map(x => <div key={x.id} className="rp-saque"><span>Pediu saque de <b>{R(Number(x.valor) - Number(x.taxa_saque ?? 0))}</b> em {new Date(x.criado_em).toLocaleDateString("pt-BR")}</span>
                  <button className="btn btn-l" onClick={() => recusarSaque(x)}>Recusar</button><button className="btn btn-v" onClick={() => abrirPagar("saque", { id: x.id, nome: m.nome, valor: Number(x.valor) - Number(x.taxa_saque ?? 0), chave: x.pix_chave, chaveTipo: x.chaveTipo })}>Pagar saque</button></div>)}
              </div>)
          })}
        </div>
      )}
      <p className="t14 mut" style={{ marginTop: 10 }}>Lojas recebem só os produtos: comissão, taxas de pagamento, cupom da loja e o que ela já recebeu no balcão saem; o frete é do motoboy e nunca entra. O servidor refaz a conta antes de cada pagamento e ninguém é pago duas vezes no mesmo ciclo.</p>

      {/* Borderô */}
      <div className={`veu ${aberto ? "on" : ""}`} onClick={() => setAberto(null)} />
      <aside className={`gaveta rp-gav ${aberto ? "on" : ""}`} aria-hidden={!aberto}>
        {b && <>
          <div className="gav-cab"><span style={{ flex: 1 }}><b className="t20">Borderô, {b.nome}</b><br /><span className="t14 mut">{b.tipo === "loja" ? `Vendas de ${dm(b.periodo_ini)} a ${dm(b.periodo_fim)}, repasse na sexta ${dm(b.paga)}` : `Entregas de ${dm(b.periodo_ini)} a ${dm(b.periodo_fim)}`}</span></span><button className="btn btn-l" onClick={() => setAberto(null)} aria-label="Fechar">Fechar</button></div>
          <div className="gav-corpo">
            {reg && <div className={`aviso ${reg.status === "contestado" ? "vm" : reg.status === "conferido" ? "vd" : "am"}`} style={{ marginBottom: 12 }}>
              {reg.status === "contestado" ? <>A loja apontou um erro em {new Date(reg.respondido_em!).toLocaleString("pt-BR")}: “{reg.resposta}”</>
                : reg.status === "conferido" ? <>A loja conferiu e disse que está certo em {new Date(reg.respondido_em!).toLocaleString("pt-BR")}.</>
                : <>Enviado em {new Date(reg.enviado_em).toLocaleString("pt-BR")}{b.tipo === "loja" ? ", esperando a loja conferir." : "."}</>}
              {Math.abs(Number(reg.valor) - b.valor) > 0.009 && <> O valor mudou de {R(Number(reg.valor))} pra {R(b.valor)} depois do envio: mande de novo.</>}
            </div>}
            {b.tipo === "loja" && b.alertas > 0 && <div className="aviso vm" style={{ marginBottom: 12 }}><b>{b.alertas} {b.alertas === 1 ? "pedido não bate" : "pedidos não batem"}.</b> Confira antes de pagar: estão marcados na lista.</div>}
            {b.tipo === "loja" && b.alertas === 0 && b.linhas.length > 0 && <div className="aviso vd" style={{ marginBottom: 12 }}>Os {b.linhas.length} pedidos batem: produtos = itens + adicionais, e produtos + frete − desconto = o que o cliente pagou.</div>}

            <div className="rp-conta">
              {b.tipo === "loja" ? <>
                <div><span>Produtos <small>(sem frete)</small></span><b className="num">{R(b.produtos)}</b></div>
                {b.cupom > 0 && <div><span>Cupom da loja</span><b className="num">− {R(b.cupom)}</b></div>}
                <div><span>Comissão do Chegô</span><b className="num">− {R(b.comissao)}</b></div>
                <div><span>Taxas de pagamento</span><b className="num">− {R(b.taxas)}</b></div>
                {b.entrega > 0 && <div><span>Participação na entrega</span><b className="num">− {R(b.entrega)}</b></div>}
                {b.balcao > 0 && <div><span>Recebido direto na loja</span><b className="num">− {R(b.balcao)}</b></div>}
                {b.avulsas > 0 && <div><span>Entregas avulsas ({b.qtdAvulsas})</span><b className="num">− {R(b.avulsas)}</b></div>}
                {(b.ajustesLista ?? []).map((x, i) => <div key={i}><span>{x.motivo}</span><b className="num">{x.valor < 0 ? "− " : "+ "}{R(Math.abs(x.valor))}</b></div>)}
                {b.adiantado > 0 && <div><span>Adiantamento de terça</span><b className="num">− {R(b.adiantado)}</b></div>}
                <div className="f"><span>{b.saldo < -0.004 ? "A loja deve ao Chegô" : "A receber"}</span><b className="num" style={b.saldo < -0.004 ? { color: "var(--pimenta-esc)" } : undefined}>{R(Math.abs(b.saldo))}</b></div>
                {b.saldo < -0.004 && <p className="t12" style={{ color: "var(--pimenta-esc)", fontWeight: 700 }}>Ela recebeu direto (Pix na loja ou maquininha dela) mais do que tinha a receber: a comissão, as taxas e o frete desses pedidos ficaram com ela.</p>}
                <p className="t12 mut">Frete desses pedidos: {R(b.frete)}. É do motoboy e não entra na conta da loja.</p>
              </> : <>
                <div><span>Ganho nas entregas</span><b className="num">{R(b.ganho)}</b></div>
                {b.bonus > 0 && <div><span>Bônus</span><b className="num">+ {R(b.bonus)}</b></div>}
                {b.descontos > 0 && <div><span>Descontos</span><b className="num">− {R(b.descontos)}</b></div>}
                <div><span>Já recebeu</span><b className="num">− {R(b.pago + b.compensado)}</b></div>
                {b.reservado > 0 && <div><span>Saque já pedido</span><b className="num">− {R(b.reservado)}</b></div>}
                <div className="f"><span>A receber</span><b className="num">{R(b.valor)}</b></div>
              </>}
            </div>

            <b className="t16b" style={{ display: "block", margin: "16px 0 6px" }}>{b.tipo === "loja" ? `${b.linhas.length} pedidos` : `${b.linhas.length} entregas`}</b>
            <div className="rp-ped">
              {b.tipo === "loja" ? porDia(b.linhas).map(([d, ls]) => (<div key={d} className="rp-diag">
                <div className="rp-dia-cab"><b>{nomeDia(d)}</b><span className="num">{ls.length} {ls.length === 1 ? "pedido" : "pedidos"}, recebe <b>{R(ls.reduce((t, l) => t + l.liquido, 0))}</b></span></div>
                {ls.map(l => (
                <div key={l.codigo} className={l.alerta ? "al" : ""}>
                  <span><b>#{l.codigo}</b> <small>{l.hora ? `${l.hora}, ` : ""}{l.forma}</small><small className="it">{l.itens}</small>{l.alerta && <small className="msg">{l.alerta}</small>}</span>
                  <span className="num"><b>{R(l.liquido)}</b><small>produtos {R(l.produtos)}{l.produtos - l.liquido > 0.004 ? `, − ${R(l.produtos - l.liquido)}` : ""}</small><small>frete {R(l.frete)} não entra</small></span>
                </div>))}</div>)) : porDia(b.linhas).map(([d, ls]) => (<div key={d} className="rp-diag">
                <div className="rp-dia-cab"><b>{nomeDia(d)}</b><span className="num">{ls.length} {ls.length === 1 ? "corrida" : "corridas"}, <b>{R(ls.reduce((t, l) => t + l.ganho, 0))}</b></span></div>
                {ls.map((l, i) => <div key={l.codigo + i}><span><b>#{l.codigo}</b> <small>{l.loja}{l.avulsa ? ", avulsa" : ""}</small></span><span className="num"><b>{R(l.ganho)}</b></span></div>)}</div>))}
              {b.linhas.length === 0 && <p className="t14 mut">Nada nesse período.</p>}
            </div>
          </div>
          <div className="gav-pe">
            <button className="btn btn-s" onClick={() => imprimir(aberto!)}>Imprimir ou PDF</button>
            {wa(aberto!.telefone, textoWa(aberto!)) ? <a className="btn btn-s" href={wa(aberto!.telefone, textoWa(aberto!))!} target="_blank" rel="noreferrer">Mandar no WhatsApp</a> : <button className="btn btn-s" disabled title="Sem telefone cadastrado">Sem WhatsApp</button>}
            {b.valor > 0 && reg?.status !== "pago" && !linhaLojaAtual?.pago && (!reg || Math.abs(Number(reg.valor) - b.valor) > 0.009 || reg.status === "contestado"
              ? <button className="btn btn-p" onClick={enviarBordero}>{reg ? "Mandar de novo pra conferir" : b.tipo === "loja" ? "Mandar pra loja conferir" : "Marcar como enviado"}</button>
              : reg && <button className="btn btn-l" onClick={cancelarEnvio}>Cancelar envio</button>)}
            {b.tipo === "loja" && linhaLojaAtual && !linhaLojaAtual.pago && rep.encerrado && b.valor > 0 && <button className="btn btn-v" onClick={() => abrirPagar("loja", { id: b.id, nome: b.nome, valor: linhaLojaAtual.liquido, chave: linhaLojaAtual.chave, chaveTipo: linhaLojaAtual.chaveTipo, chaveOk: linhaLojaAtual.chaveOk, aviso: b.alertas ? `${b.alertas} pedidos não batem.` : reg?.status === "contestado" ? "A loja apontou erro no borderô." : reg?.status !== "conferido" ? "A loja ainda não conferiu o borderô." : null })}>Pagar {R(b.valor)}</button>}
            {b.tipo === "motoboy" && mbAtual && mbAtual.livre > 0.004 && <button className="btn btn-v" onClick={() => abrirPagar("motoboy", { id: b.id, nome: b.nome, valor: mbAtual.livre, chave: mbAtual.chave, chaveTipo: mbAtual.chaveTipo })}>Pagar {R(mbAtual.livre)}</button>}
          </div>
        </>}
      </aside>

      {/* Pagamento */}
      {pagar && (
        <div className="veu on" style={{ zIndex: 95 }} onClick={() => !enviando && setPagar(null)}>
          <div className="busca-caixa" onClick={e => e.stopPropagation()}>
            <div className="t20">Pagar {R(pagar.valor)}</div>
            {pagar.tipo === "motoboy" && <label className="campo" style={{ marginTop: 10 }}><span>Quanto pagar (até {R(pagar.max)})</span>
              <input inputMode="numeric" value={pagar.valorTxt} onChange={e => { const t = mascaraBrl(e.target.value); setPagar({ ...pagar, valorTxt: t, valor: paraNumBrl(t) }) }} placeholder="R$ 0,00" />
              {pagar.valor > pagar.max + 0.001 && <small style={{ color: "var(--pimenta-esc)", fontWeight: 700 }}>Passa do que ele tem a receber ({R(pagar.max)}).</small>}</label>}
            <p className="t14 mut" style={{ margin: "4px 0 12px" }}>{pagar.nome}, {pagar.tipo === "loja" ? `repasse das vendas de ${dm(c.ini)} a ${dm(c.fim)}` : pagar.tipo === "saque" ? "saque que ele pediu" : "saldo de entregas"}.</p>
            <div className="pg-modos">
              <button className="cartao" aria-pressed={pagar.modo === "asaas"} disabled={!pagar.chaveOk} style={!pagar.chaveOk ? { opacity: .45 } : undefined} onClick={() => setPagar({ ...pagar, modo: "asaas" })}><b>Pix pelo Asaas</b><small>Sai agora da conta do Chegô na chave {pagar.chave ?? "(sem chave)"}. O comprovante fica anexado sozinho.</small></button>
              <button className="cartao" aria-pressed={pagar.modo === "manual"} onClick={() => setPagar({ ...pagar, modo: "manual" })}><b>Dar baixa (paguei por fora)</b><small>Pix pelo banco. Anexe o comprovante agora ou depois.</small></button>
            </div>
            {!pagar.chaveOk && !novaChave.aberto && <div className="aviso vm" style={{ marginTop: 12 }}>A chave cadastrada ({pagar.chave ?? "nenhuma"}) não é uma chave Pix válida. Troque a chave ou pague por fora e dê baixa.</div>}
            {pagar.modo === "asaas" && pagar.chaveOk && !novaChave.aberto && <label className="campo" style={{ marginTop: 12 }}><span>Tipo da chave Pix{pagar.chaveTipo && !pagar.chaveTipo.certeza ? " (confira: pode ser CPF ou celular)" : ""}</span>
              <select value={pagar.tipoChave} onChange={e => setPagar({ ...pagar, tipoChave: e.target.value })}><option value="">Escolha</option>{TIPOS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>}
            {novaChave.aberto ? (
              <div className="rp-chave">
                <b>Nova chave Pix de {pagar.nome}</b>
                <div className="lin" style={{ gap: 8, flexWrap: "wrap" }}>
                  <select value={novaChave.tipo} onChange={e => setNovaChave({ ...novaChave, tipo: e.target.value, erro: "" })}><option value="">Tipo</option>{TIPOS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
                  <input style={{ flex: 1, minWidth: 180 }} value={novaChave.chave} onChange={e => setNovaChave({ ...novaChave, chave: e.target.value, erro: "" })}
                    placeholder={novaChave.tipo === "EMAIL" ? "email@exemplo.com" : novaChave.tipo === "PHONE" ? "(62) 99999-9999" : novaChave.tipo === "CNPJ" ? "00.000.000/0000-00" : novaChave.tipo === "EVP" ? "chave aleatória" : "000.000.000-00"} />
                </div>
                {novaChave.erro && <p className="t14" style={{ color: "var(--pimenta-esc)", fontWeight: 700 }}>{novaChave.erro}</p>}
                <div className="lin" style={{ gap: 8 }}>
                  {pagar.chaveOk && <button className="btn btn-l" onClick={() => setNovaChave({ aberto: false, chave: "", tipo: "", salvando: false, erro: "" })}>Cancelar</button>}
                  <button className="btn btn-p" style={{ marginLeft: "auto" }} disabled={novaChave.salvando || !novaChave.tipo || novaChave.chave.trim().length < 5} onClick={salvarChave}>{novaChave.salvando ? "Salvando…" : "Salvar chave no cadastro"}</button>
                </div>
                <small className="mut">Fica salva no cadastro {pagar.tipo === "loja" ? "da loja" : "do motoboy"} pros próximos pagamentos.</small>
              </div>
            ) : <button className="btn btn-l" style={{ padding: 0, marginTop: 8 }} onClick={() => setNovaChave({ aberto: true, chave: "", tipo: "", salvando: false, erro: "" })}>Trocar chave Pix</button>}
            {pagar.modo === "manual" && <label className="campo" style={{ marginTop: 12 }}><span>Comprovante (foto ou PDF)</span><input type="file" accept="image/*,application/pdf" onChange={e => setPagar({ ...pagar, arquivo: e.target.files?.[0] ?? null })} /></label>}
            {pagar.aviso && <label className="rp-ciente"><input type="checkbox" checked={pagar.ciente} onChange={e => setPagar({ ...pagar, ciente: e.target.checked })} /><span><b>{pagar.aviso}</b> Conferi e quero pagar mesmo assim.</span></label>}
            {msg && !msg.ok && <div className="aviso vm" style={{ marginTop: 10 }}>{msg.t}</div>}
            <div className="lin" style={{ marginTop: 14 }}>
              <button className="btn btn-s" style={{ flex: 1 }} disabled={enviando} onClick={() => setPagar(null)}>Cancelar</button>
              <button className="btn btn-v" style={{ flex: 2 }} disabled={enviando || !pagar.ciente || !(pagar.valor > 0) || pagar.valor > pagar.max + 0.001 || (pagar.modo === "asaas" && (!pagar.tipoChave || !pagar.chave || !pagar.chaveOk || novaChave.aberto))} onClick={confirmarPagamento}>{enviando ? "Enviando…" : pagar.modo === "asaas" ? `Enviar Pix de ${R(pagar.valor)}` : "Dar baixa"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
