"use client"

// "Dinheiro em mãos" igual à proposta (20/10/2026): quanto o motoboy recebeu em dinheiro hoje,
// os pedidos de onde veio, e a mesma declaração de caixa de antes (/api/motoboy/caixa).
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { partesPagamento } from "@/lib/pagamentoDividido"

type Declaracao = { id: string; valor: number; observacao: string | null; criado_em: string }
type Linha = { id: string; loja: string; criado_em: string; valor: number }

const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function mascaraBRL(v: string) {
  const d = v.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9)
  return d ? (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
}
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).replace(":", "h")

export default function MotoboyCaixaPage() {
  const router = useRouter()
  const { sessao } = useAuth()
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null

  const [valor,        setValor]        = useState("")
  const [observacao,   setObservacao]   = useState("")
  const [enviando,     setEnviando]     = useState(false)
  const [erro,         setErro]         = useState("")
  const [sucesso,      setSucesso]      = useState(false)
  const [declaracoes,  setDeclaracoes]  = useState<Declaracao[]>([])
  const [linhas,       setLinhas]       = useState<Linha[] | null>(null)

  useEffect(() => { if (motoboy_id) { carregar(); carregarDinheiro() } }, [motoboy_id])

  async function carregar() {
    const res = await fetch("/api/motoboy/caixa", { credentials: "include" })
    const json = await res.json().catch(() => ({}))
    setDeclaracoes(json.declaracoes ?? [])
  }

  // Pedidos de hoje entregues por ele em que o cliente pagou (uma parte ou tudo) em dinheiro
  async function carregarDinheiro() {
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
    const desde = new Date(`${hoje}T00:00:00-03:00`).toISOString()
    const { data } = await supabase.from("pedidos")
      .select("id, criado_em, total, forma_pagamento, forma_pagamento_2, valor_pagamento_1, valor_pagamento_2, endereco_entrega, loja:lojas(nome)")
      .eq("motoboy_id", motoboy_id!).eq("status", "entregue").gte("criado_em", desde)
      .order("criado_em", { ascending: false })
    const ls: Linha[] = []
    for (const p of (data ?? []) as any[]) {
      if (/retirada/i.test(p.endereco_entrega ?? "")) continue
      const v = partesPagamento(p).filter(x => x.forma === "dinheiro").reduce((s, x) => s + x.valor, 0)
      if (v > 0) ls.push({ id: p.id, loja: p.loja?.nome ?? "Loja", criado_em: p.criado_em, valor: v })
    }
    setLinhas(ls)
  }

  async function enviar() {
    const v = Number(valor.replace(/\./g, "").replace(",", "."))
    if (!valor || !Number.isFinite(v) || v < 0) { setErro("Diga quanto tem em mãos"); return }
    setEnviando(true)
    setErro("")
    const res = await fetch("/api/motoboy/caixa", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor: v, observacao }),
    })
    const json = await res.json().catch(() => ({}))
    setEnviando(false)
    if (!res.ok) { setErro(json.error ?? "Erro ao enviar"); return }
    setValor("")
    setObservacao("")
    setSucesso(true)
    setTimeout(() => setSucesso(false), 2500)
    carregar()
  }

  const totalDinheiro = (linhas ?? []).reduce((s, l) => s + l.valor, 0)

  return (
    <div className="mb-pagina" style={{ paddingTop: 0 }}>
      <div className="mb-topo-pag">
        <button className="mb-redondo-peq" onClick={() => router.back()} aria-label="Voltar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
        <h1 className="t20">Dinheiro em mãos</h1>
      </div>

      <div className="mb-cartao" style={{ padding: 18 }}>
        <span className="mut" style={{ fontSize: 14 }}>Recebido em dinheiro hoje</span><br />
        <b style={{ fontFamily: "var(--display)", fontSize: 40, fontWeight: 800, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" }}>{linhas === null ? "…" : brl(totalDinheiro)}</b>
      </div>
      <p className="mut" style={{ fontSize: 14, margin: "14px 2px", lineHeight: 1.5 }}>É o que você recebeu dos clientes que pagaram em dinheiro. Esse valor entra no acerto do seu caixa com o Chegô.</p>

      {linhas && linhas.length > 0 && (
        <div className="mb-cartao" style={{ padding: "4px 16px" }}>
          {linhas.map(l => (
            <div key={l.id} className="mb-linha-h">
              <span style={{ flex: 1 }}>{l.loja}<br /><small className="mut" style={{ fontSize: 12 }}>hoje, {hora(l.criado_em)}</small></span>
              <span className="v">{brl(l.valor)}</span>
            </div>
          ))}
        </div>
      )}

      <label className="mb-campo" style={{ marginTop: 18 }}><span>Quanto você tem em mãos agora?</span>
        <input inputMode="numeric" placeholder="R$ 0,00" value={valor} onChange={e => setValor(mascaraBRL(e.target.value))} /></label>
      <label className="mb-campo" style={{ marginTop: 12 }}><span>Observação (opcional)</span>
        <textarea placeholder="Ex.: sobrou troco de uma corrida" value={observacao} onChange={e => setObservacao(e.target.value)} rows={3} /></label>
      {erro && <p style={{ color: "var(--pimenta)", fontSize: 13.5, fontWeight: 600, marginTop: 10 }}>{erro}</p>}
      {sucesso && <p style={{ color: "var(--folha)", fontSize: 13.5, fontWeight: 700, marginTop: 10 }}>Caixa declarado. O Chegô vai conferir.</p>}
      <button className="mb-btn verm" style={{ marginTop: 14 }} onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "Declarar caixa"}</button>

      {declaracoes.length > 0 && (
        <>
          <div className="mb-dia-tit">Declarações anteriores</div>
          <div className="mb-cartao" style={{ padding: "4px 16px" }}>
            {declaracoes.map(d => (
              <div key={d.id} className="mb-linha-h">
                <span style={{ flex: 1 }}>{new Date(d.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}, {hora(d.criado_em)}{d.observacao ? <><br /><small className="mut" style={{ fontSize: 12 }}>{d.observacao}</small></> : null}</span>
                <span className="v">{brl(Number(d.valor))}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
