"use client"

// Ferramentas (admin 2.0, 20/10/2026): o que hoje é pedido na mão, aqui num botão.
// Rotinas (/api/admin/ferramentas), exportações em CSV e a conferência da maquininha Ton
// (/api/admin/ton-conferir: envia o extrato, cruza com os pedidos, nada é gravado).
import { useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { R, dm } from "../_dinheiro"
import { CorridaDinamica } from "../_CorridaDinamica"

type Ton = { arquivo: string; de: string; ate: string; resumo: { vendas: number; bruto: number; liquido: number | null; taxaReal: number | null; taxaPct: number | null; porTipo: { tipo: string; n: number; valor: number }[]; bateram: number; tipoDiferente: number; soTon: number; soApp: number }
  pares: { venda: any; pedido: { codigo: string; loja: string; motoboy: string; tipo: string | null }; tipoDiferente: boolean }[]; soTon: any[]; soApp: { codigo: string; dia: string; valor: number; tipo: string | null; loja: string; motoboy: string }[] }
const TIPO: Record<string, string> = { debito: "Débito", credito: "Crédito", pix: "Pix", outro: "Outro" }
const csv = (nome: string, linhas: unknown[][]) => { const q = (x: unknown) => '"' + String(x ?? "").replace(/^[=+@-]/, "'").replaceAll('"', '""') + '"'; const u = URL.createObjectURL(new Blob(["﻿" + linhas.map(r => r.map(q).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = u; a.download = nome; a.click(); URL.revokeObjectURL(u) }

export default function FerramentasPage() {
  const [res, setRes] = useState<Record<string, { t: string; ok: boolean }>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [ton, setTon] = useState<Ton | null>(null), [tonErro, setTonErro] = useState(""), [tonAba, setTonAba] = useState<"app" | "ton" | "ok">("app")
  const arq = useRef<HTMLInputElement>(null)

  async function rodar(acao: string, texto: (j: any) => string) {
    if (acao === "fechamento_teste" && !confirm("Mandar o fechamento de hoje só pro seu e-mail? Não grava nada nem conta como o envio oficial.")) return
    setOcupado(acao)
    const r = await fetch("/api/admin/ferramentas", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao }) })
    const j = await r.json().catch(() => ({})); setOcupado(null)
    setRes(x => ({ ...x, [acao]: r.ok ? { t: texto(j.resultado ?? {}), ok: true } : { t: j.error ?? j.resultado?.error ?? "Não deu certo.", ok: false } }))
  }
  async function exportar(qual: "lojas" | "motoboys" | "clientes") {
    setOcupado(qual)
    try {
      if (qual === "clientes") { const j = await fetch("/api/admin/clientes", { credentials: "include" }).then(r => r.json()); csv("chego-clientes.csv", [["Nome", "Telefone", "E-mail", "Bairro", "Cidade", "Pedidos", "Gastou", "Último pedido", "Cliente desde"], ...(j.clientes ?? []).map((c: any) => [c.nome, c.telefone, c.email, c.bairro, c.cidade, c.pedidos, String(c.gasto).replace(".", ","), c.ultimo ? new Date(c.ultimo).toLocaleDateString("pt-BR") : "", new Date(c.criado_em).toLocaleDateString("pt-BR")])]) }
      if (qual === "lojas") { const { data } = await supabase.from("lojas").select("nome,status,categoria,telefone,email,plano,comissao,taxa_entrega,aberto,criado_em").order("nome"); csv("chego-lojas.csv", [["Loja", "Situação", "Categoria", "Telefone", "E-mail", "Plano", "Comissão %", "Taxa base", "Aberta agora", "Cadastro"], ...(data ?? []).map((l: any) => [l.nome, l.status, l.categoria, l.telefone, l.email, l.plano, l.comissao, String(l.taxa_entrega ?? "").replace(".", ","), l.aberto ? "sim" : "não", new Date(l.criado_em).toLocaleDateString("pt-BR")])]) }
      if (qual === "motoboys") { const { data } = await supabase.from("motoboys").select("nome,status,telefone,email,veiculo,placa,disponivel,criado_em").order("nome"); csv("chego-motoboys.csv", [["Motoboy", "Situação", "Telefone", "E-mail", "Veículo", "Placa", "Online agora", "Cadastro"], ...(data ?? []).map((m: any) => [m.nome, m.status, m.telefone, m.email, m.veiculo, m.placa, m.disponivel ? "sim" : "não", new Date(m.criado_em).toLocaleDateString("pt-BR")])]) }
    } finally { setOcupado(null) }
  }
  async function enviarTon(f?: File) {
    if (!f) return; setTonErro(""); setTon(null); setOcupado("ton")
    const fd = new FormData(); fd.append("arquivo", f)
    const r = await fetch("/api/admin/ton-conferir", { method: "POST", credentials: "include", body: fd }); const j = await r.json().catch(() => ({})); setOcupado(null)
    if (arq.current) arq.current.value = ""
    if (!r.ok) { setTonErro(j.error + (j.colunasVistas ? ` Colunas que vi: ${j.colunasVistas.join(", ")}.` : "")); return }
    setTon(j); setTonAba(j.resumo.soApp ? "app" : j.resumo.soTon ? "ton" : "ok")
  }

  const Ferr = ({ id, titulo, texto, botao, fn }: { id: string; titulo: string; texto: string; botao: string; fn: () => void }) => (
    <div className="cartao fr-it"><b className="t16b">{titulo}</b><p className="t14 mut">{texto}</p>
      {res[id] && <div className={`aviso ${res[id].ok ? "vd" : "vm"}`}>{res[id].t}</div>}
      <button className="btn btn-s" disabled={ocupado === id} onClick={fn}>{ocupado === id ? "Rodando…" : botao}</button></div>)

  return (
    <>
      <CorridaDinamica />
      <div className="fr-grade">
        <Ferr id="saude" titulo="Saúde do sistema" texto="Testa agora as tabelas principais do banco e diz se algo está lento ou fora do ar." botao="Testar agora"
          fn={() => rodar("saude", j => `${j.status === "ok" || j.status === "saudavel" ? "Tudo funcionando" : j.status === "lento" ? "Banco lento" : "Atenção: " + j.status}. ${(j.resultados ?? []).map((x: any) => `${x.tabela} ${x.ok ? `${x.tempoMs} ms` : "falhou"}`).join(", ")}`)} />
        <Ferr id="fechamento_teste" titulo="Fechamento de hoje no seu e-mail" texto="Manda o relatório do dia até agora só pra você, sem gravar e sem contar como o envio das 23h59." botao="Mandar pra mim"
          fn={() => rodar("fechamento_teste", j => `Enviado pra ${(j.para ?? []).join(", ")}. ${j.resumo?.pedidos ?? ""} pedidos no dia.`)} />
        <Ferr id="reescalar" titulo="Chamar motoboys de novo" texto="Pedidos que estão há mais de 2 minutos esperando um motoboy aceitar voltam pra todos os motoboys livres." botao="Chamar agora"
          fn={() => rodar("reescalar", j => j.re_escalados ? `${j.re_escalados} pedido(s) chamados de novo.` : "Nenhum pedido parado esperando motoboy.")} />
        <Ferr id="zapi_bot" titulo="Ligar o robô de pagamento no WhatsApp" texto="Aponta o WhatsApp do Z-API para o robô que gera um Pix novo quando o cliente avisa que teve problema para pagar, e grava o número usado no botão do WhatsApp." botao="Ligar robô"
          fn={() => rodar("zapi_bot", j => j.ok ? `Robô ligado. Número ${j.numero}.` : `Não ligou: ${typeof j.webhook === "string" ? j.webhook : "verifique o Z-API"}.`)} />
        <div className="cartao fr-it"><b className="t16b">Exportar planilhas</b><p className="t14 mut">Baixa em CSV (abre no Excel). Os financeiros ficam em Repasses e Fechamento diário.</p>
          <div className="lin" style={{ gap: 8, flexWrap: "wrap" }}>{(["lojas", "motoboys", "clientes"] as const).map(q => <button key={q} className="btn btn-s" style={{ flex: 1, minHeight: 42 }} disabled={!!ocupado} onClick={() => exportar(q)}>{ocupado === q ? "…" : q[0].toUpperCase() + q.slice(1)}</button>)}</div></div>
      </div>

      <div className="cartao fr-ton">
        <div className="lin" style={{ flexWrap: "wrap", gap: 10 }}>
          <span style={{ flex: 1, minWidth: 260 }}><b className="t20">Conferir a maquininha (Ton)</b><p className="t14 mut">Baixe o extrato de vendas no app ou portal da Ton (CSV ou Excel) e envie aqui. A gente cruza cada venda com os pedidos pagos na maquininha. Nada é gravado.</p></span>
          <input ref={arq} type="file" accept=".csv,.xlsx" style={{ display: "none" }} onChange={e => enviarTon(e.target.files?.[0])} />
          <button className="btn btn-p" disabled={ocupado === "ton"} onClick={() => arq.current?.click()}>{ocupado === "ton" ? "Conferindo…" : "Enviar extrato da Ton"}</button>
        </div>
        {tonErro && <div className="aviso vm" style={{ marginTop: 10 }}>{tonErro}</div>}
        {ton && <>
          <p className="t14 mut" style={{ margin: "10px 0" }}>{ton.arquivo}: vendas de {dm(ton.de)} a {dm(ton.ate)}.</p>
          <div className="kpis4">
            <div className="cartao kpi2"><small>Vendido na Ton</small><b className="num">{R(ton.resumo.bruto)}</b><span className="t14 mut">{ton.resumo.vendas} vendas: {ton.resumo.porTipo.map(t => `${TIPO[t.tipo]} ${t.n}`).join(", ")}</span></div>
            <div className="cartao kpi2"><small>Taxa que a Ton cobrou</small><b className="num">{ton.resumo.taxaReal == null ? "–" : R(ton.resumo.taxaReal)}</b><span className="t14 mut">{ton.resumo.taxaPct == null ? "o extrato não traz o líquido" : `${ton.resumo.taxaPct.toLocaleString("pt-BR")}% (o app usa 3,08% pra loja)`}</span></div>
            <div className="cartao kpi2"><small>Bateram com pedido</small><b className="num" style={{ color: "var(--folha)" }}>{ton.resumo.bateram}</b><span className="t14 mut">{ton.resumo.tipoDiferente ? `${ton.resumo.tipoDiferente} com débito/crédito trocado` : "débito e crédito certos"}</span></div>
            <div className="cartao kpi2"><small>Não bateram</small><b className="num" style={{ color: ton.resumo.soApp + ton.resumo.soTon ? "var(--pimenta)" : undefined }}>{ton.resumo.soApp + ton.resumo.soTon}</b><span className="t14 mut">{ton.resumo.soApp} pedidos sem venda, {ton.resumo.soTon} vendas sem pedido</span></div>
          </div>
          <div className="abas-l"><button aria-pressed={tonAba === "app"} onClick={() => setTonAba("app")}>Pedido sem venda na Ton ({ton.resumo.soApp})</button><button aria-pressed={tonAba === "ton"} onClick={() => setTonAba("ton")}>Venda na Ton sem pedido ({ton.resumo.soTon})</button><button aria-pressed={tonAba === "ok"} onClick={() => setTonAba("ok")}>Bateram ({ton.resumo.bateram})</button></div>
          {tonAba === "app" && <><p className="t14 mut" style={{ marginBottom: 8 }}>O motoboy marcou maquininha, mas não tem venda desse valor na Ton no dia. Pode ter passado em outra maquininha, outro valor ou não ter passado.</p>
            <table className="tabela"><tbody>{ton.soApp.map(p => <tr key={p.codigo}><td><b>#{p.codigo}</b><small className="lj-sub">{dm(p.dia)}, {p.loja}</small></td><td>{p.motoboy || "—"}</td><td>{p.tipo ? TIPO[p.tipo] : "sem tipo"}</td><td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{R(p.valor)}</td></tr>)}{!ton.soApp.length && <tr><td className="vazio">Todos os pedidos de maquininha têm venda na Ton.</td></tr>}</tbody></table></>}
          {tonAba === "ton" && <><p className="t14 mut" style={{ marginBottom: 8 }}>Venda na maquininha sem pedido de mesmo valor no app. Pode ser venda de balcão, pedido cancelado ou valor digitado diferente.</p>
            <table className="tabela"><tbody>{ton.soTon.map((v: any) => <tr key={v.linha}><td>{v.quando ? new Date(v.quando).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : v.dia}</td><td>{TIPO[v.tipo]}{v.bandeira ? `, ${v.bandeira}` : ""}</td><td className="t12 mut">linha {v.linha} do arquivo</td><td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{R(v.valor)}</td></tr>)}{!ton.soTon.length && <tr><td className="vazio">Toda venda da Ton tem pedido no app.</td></tr>}</tbody></table></>}
          {tonAba === "ok" && <table className="tabela"><tbody>{ton.pares.map((p, i) => <tr key={i}><td><b>#{p.pedido.codigo}</b><small className="lj-sub">{p.pedido.loja}, {p.pedido.motoboy}</small></td><td>{TIPO[p.venda.tipo]}{p.tipoDiferente && <small className="pd-atr">no app: {p.pedido.tipo ? TIPO[p.pedido.tipo] : "?"}</small>}</td><td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{R(p.venda.valor)}</td></tr>)}</tbody></table>}
        </>}
      </div>
    </>
  )
}
