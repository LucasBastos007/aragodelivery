"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { ganhoMotoboy as ganhoLiquido, ganhoMotoboyPedido } from "@/lib/comissao"


export default function MotoboyFinanceiroPage() {
  const { sessao } = useAuth()
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null

  const [motoboy,         setMotoboy]         = useState<any>(null)
  const [saldo,           setSaldo]           = useState(0)
  const [ultimoPag,       setUltimoPag]       = useState<{ valor: number; em: string } | null>(null)
  const [totalGanhos,     setTotalGanhos]     = useState(0)
  const [totalSaquesPagos, setTotalSaquesPagos] = useState(0)
  const [saques,          setSaques]          = useState<any[]>([])
  const [entregas,        setEntregas]        = useState<any[]>([])
  const [porDia,          setPorDia]          = useState<{ data: string; ganho: number }[]>([])
  const [aba,             setAba]             = useState<"hoje" | "semana" | "mes" | "datas">("semana")
  // Período livre (20/10/2026, pedido do Lucas): consultar ganhos de qualquer intervalo
  const [deData,          setDeData]          = useState(() => new Date(Date.now() - 29 * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }))
  const [ateData,         setAteData]         = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }))
  const [todasEntregas,   setTodasEntregas]   = useState<any[]>([])
  const [loading,         setLoading]         = useState(true)

  const [editandoPix,   setEditandoPix]   = useState(false)
  const [pixInput,      setPixInput]      = useState("")
  const [bancoInput,    setBancoInput]    = useState("")
  const [agenciaInput,  setAgenciaInput]  = useState("")
  const [contaInput,    setContaInput]    = useState("")
  const [salvandoPix,   setSalvandoPix]   = useState(false)

  const [solicitando,   setSolicitando]   = useState(false)
  const [valorSaque,    setValorSaque]    = useState("")
  const [enviandoSaque, setEnviandoSaque] = useState(false)
  const [erroSaque,     setErroSaque]     = useState("")
  const [saqueSucesso,  setSaqueSucesso]  = useState(false)

  async function load() {
    if (!motoboy_id) return

    const { data: mb } = await supabase.from("motoboys").select("*").eq("id", motoboy_id).single()
    setMotoboy(mb)
    // pix_key pode ser JSON { pix, banco } ou string legada
    try {
      const parsed = mb?.pix_key ? JSON.parse(mb.pix_key) : {}
      setPixInput(parsed.pix ?? "")
      setBancoInput(parsed.banco ?? "")
      setAgenciaInput(parsed.agencia ?? "")
      setContaInput(parsed.conta ?? "")
    } catch {
      setPixInput(mb?.pix_key ?? "")
      setBancoInput("")
      setAgenciaInput("")
      setContaInput("")
    }

    const [{ data: ped }, { data: avulsas }, { data: ajustes }] = await Promise.all([
      supabase
        .from("pedidos").select("id, codigo, taxa_entrega, taxa_dinamica, criado_em, loja:lojas(nome)")
        .eq("motoboy_id", motoboy_id).eq("status", "entregue")
        .order("criado_em", { ascending: false }),
      supabase
        .from("entregas_avulsas").select("taxa_entrega, criado_em")
        .eq("motoboy_id", motoboy_id).eq("status", "entregue"),
      supabase
        .from("saldo_ajustes").select("valor")
        .eq("motoboy_id", motoboy_id).eq("tipo", "motoboy").is("quitado_em", null),
    ])
    const pedList = ped ?? []
    setEntregas(pedList.slice(0, 30)); setTodasEntregas(pedList)
    // Ganhos por dia pro gráfico e pras abas Hoje/7 dias/Mês (mesmas consultas, só leitura)
    setPorDia([
      ...pedList.map(p => ({ data: p.criado_em, ganho: ganhoMotoboyPedido(p) })),
      ...(avulsas ?? []).map(a => ({ data: a.criado_em, ganho: ganhoMotoboyPedido(a) })),
    ])

    // Inclui entregas avulsas e ajustes manuais de saldo — mesma base de cálculo do saldo
    // sacável (/api/motoboy/saque), senão a tela mostra um valor diferente do que sai de fato
    const ganhos =
      pedList.reduce((s, p) => s + ganhoMotoboyPedido(p), 0) +
      (avulsas ?? []).reduce((s, a) => s + ganhoMotoboyPedido(a), 0) +
      (ajustes ?? []).reduce((s, a) => s + Number(a.valor ?? 0), 0)
    setTotalGanhos(ganhos)

    const { data: saq } = await supabase
      .from("saques").select("*").eq("motoboy_id", motoboy_id).eq("tipo", "motoboy")
      .order("criado_em", { ascending: false })
    setSaques(saq ?? [])

    const pagos      = (saq ?? []).filter(s => s.status === "pago").reduce((s, x) => s + x.valor, 0)
    setTotalSaquesPagos(pagos)
    // Saldo = mesma conta do fechamento e do admin, desde 16/10 (decisão do Lucas, 20/10/2026).
    // Inclui pagamentos feitos pelo painel, que a conta antiga não via.
    const sr = await fetch("/api/motoboy/saldo", { credentials: "include" }).then(r => r.ok ? r.json() : null).catch(() => null)
    setSaldo(sr ? Number(sr.livre) || 0 : 0)
    setUltimoPag(sr?.ultimoPagamento ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [motoboy_id])

  async function salvarPix() {
    if (!motoboy_id || !pixInput.trim()) return
    setSalvandoPix(true)
    const payload = JSON.stringify({ pix: pixInput.trim(), banco: bancoInput.trim(), agencia: agenciaInput.trim(), conta: contaInput.trim() })
    await fetch("/api/motoboy/perfil", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pix_key: payload }) }).catch(() => {})
    setSalvandoPix(false)
    setEditandoPix(false)
    load()
  }

  async function solicitarSaque() {
    // valor vem com máscara de dinheiro (1.234,56)
    const valor = parseFloat(valorSaque.replace(/\./g, "").replace(",", "."))
    if (!valor || valor <= 0) { setErroSaque("Informe um valor válido"); return }
    if (valor > saldo + 0.001) { setErroSaque("Valor maior que o saldo disponível"); return }
    if (!temPix) { setErroSaque("Cadastre sua chave PIX antes de solicitar"); return }
    setErroSaque(""); setEnviandoSaque(true)
    const res = await fetch("/api/motoboy/saque", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor }),
    })
    const data = await res.json()
    setEnviandoSaque(false)
    if (!res.ok) { setErroSaque(data.error ?? "Erro ao solicitar saque"); return }
    setValorSaque(""); setSolicitando(false)
    setSaqueSucesso(true); setTimeout(() => setSaqueSucesso(false), 5000)
    load()
  }

  if (loading) return <div style={{ padding: 32 }}><p className="mut">Carregando…</p></div>

  const pendentes = saques.filter(s => s.status === "solicitado")

  // Parse pix_key (pode ser JSON { pix, banco, agencia, conta } ou string legada)
  let pixChaveDisplay = ""
  let bancoDisplay = ""
  let agenciaDisplay = ""
  let contaDisplay = ""
  try {
    const pk = motoboy?.pix_key ? JSON.parse(motoboy.pix_key) : {}
    pixChaveDisplay = pk.pix   ?? ""
    bancoDisplay    = pk.banco ?? ""
    agenciaDisplay  = pk.agencia ?? ""
    contaDisplay    = pk.conta ?? ""
  } catch {
    pixChaveDisplay = motoboy?.pix_key ?? ""
  }
  const temPix = !!pixChaveDisplay

  // Ganhos por período (horário de Brasília)
  const ymd = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
  const hoje = ymd(new Date())
  const diasAtras = (n: number) => ymd(new Date(Date.now() - n * 86400000))
  const inicio = aba === "datas" ? deData : aba === "hoje" ? hoje : aba === "semana" ? diasAtras(6) : `${hoje.slice(0, 7)}-01`
  const fimPer = aba === "datas" ? ateData : hoje
  const doPeriodo = porDia.filter(x => ymd(x.data) >= inicio && ymd(x.data) <= fimPer)
  const entregasPeriodo = aba === "datas" ? todasEntregas.filter(p => ymd(p.criado_em) >= inicio && ymd(p.criado_em) <= fimPer) : null
  const dmBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`
  const totalPeriodo = doPeriodo.reduce((s, x) => s + x.ganho, 0)
  const corridasPeriodo = doPeriodo.length
  const barras = Array.from({ length: 7 }, (_, i) => {
    const d = diasAtras(6 - i)
    const v = porDia.filter(x => ymd(x.data) === d).reduce((s, x) => s + x.ganho, 0)
    const rot = i === 6 ? "hoje" : new Date(d + "T12:00:00-03:00").toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" }).replace(".", "")
    return { d, v, rot }
  })
  const maxBarra = Math.max(1, ...barras.map(b => b.v))
  // Regra (20/10/2026): repasse toda sexta; saque avulso só na terça, com taxa de R$ 5,00
  const ehTerca = new Date().toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Sao_Paulo" }) === "Tue"
  const TAXA_TERCA = 5
  const valorDigitado = parseFloat((valorSaque || "0").replace(/\./g, "").replace(",", ".")) || 0
  const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const mascaraDinheiro = (t: string) => { const c = t.replace(/\D/g, "").slice(0, 9); if (!c) return ""; return (Number(c) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

  return (
    <div className="mb-pagina">
      <h1 className="t28">Ganhos</h1>
      <p className="mut" style={{ fontSize: 13.5, margin: "4px 0 16px" }}>Valores já sem a taxa do Chegô.</p>

      {saqueSucesso && <div className="mb-ok">Adiantamento pedido. O valor, já sem a taxa de R$ 5,00, cai no seu Pix.</div>}

      <div className="mb-abas" role="tablist">
        {([["hoje", "Hoje"], ["semana", "7 dias"], ["mes", "Mês"], ["datas", "Datas"]] as const).map(([k, n]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)}>{n}</button>
        ))}
      </div>
      {aba === "datas" && (
        <div className="mb-datas">
          <label><span>De</span><input type="date" value={deData} max={ateData} onChange={e => e.target.value && setDeData(e.target.value)} /></label>
          <label><span>Até</span><input type="date" value={ateData} min={deData} max={hoje} onChange={e => e.target.value && setAteData(e.target.value)} /></label>
        </div>
      )}

      <div className="mb-cartao" style={{ marginTop: 12 }}>
        <div className="t28" style={{ fontSize: 34 }}>{brl(totalPeriodo)}</div>
        <p className="mut" style={{ fontSize: 13.5 }}>{aba === "datas" ? `de ${dmBr(deData)} a ${dmBr(ateData)}` : aba === "hoje" ? "hoje" : aba === "semana" ? "nos últimos 7 dias" : "neste mês"}, {corridasPeriodo} {corridasPeriodo === 1 ? "corrida" : "corridas"}</p>
        <div className="mb-stats" style={{ marginTop: 14 }}>
          <div><b>{corridasPeriodo}</b><span>corridas</span></div>
          <div><b>{corridasPeriodo ? brl(totalPeriodo / corridasPeriodo) : "R$ 0,00"}</b><span>por corrida</span></div>
          <div><b>{brl(totalGanhos)}</b><span>total ganho</span></div>
        </div>
        <div className="mb-barras" aria-label="Ganhos dos últimos 7 dias">
          {barras.map(b => (
            <div key={b.d} title={`${b.rot}: ${brl(b.v)}`}>
              {b.d === hoje && b.v > 0 && <small>{brl(b.v)}</small>}
              <i className={b.d === hoje ? "hoje" : ""} style={{ height: `${Math.max(6, (b.v / maxBarra) * 100)}%` }} />
              <span>{b.rot}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-cartao" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="mb-ic verde">Pix</span>
          <span style={{ flex: 1 }}><span className="mut" style={{ fontSize: 13 }}>Seu saldo</span><b className="t20" style={{ display: "block" }}>{brl(saldo)}</b><span className="mut" style={{ fontSize: 12 }}>Entregas desde 16/10, já sem o que foi pago</span></span>
          {!solicitando && ehTerca && <button className="mb-btn verde peq" style={{ width: 110 }} onClick={() => { setSolicitando(true); setErroSaque("") }} disabled={saldo <= TAXA_TERCA || !temPix}>Adiantar</button>}
        </div>
        {ultimoPag && (
          <p style={{ fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>
            Último pagamento: <b>{brl(ultimoPag.valor)}</b> em {new Date(ultimoPag.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(", ", " às ").replace(/:(\d\d)$/, "h$1")}.
            <span className="mut"> As corridas feitas até essa hora já foram pagas nele.</span>
          </p>
        )}
        <p className="mut" style={{ fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>
          O repasse cai <b style={{ color: "var(--grafite)" }}>toda sexta</b> no seu Pix, sem precisar pedir.
          {ehTerca ? " Hoje é terça: dá pra adiantar, com taxa de R$ 5,00." : " Na terça dá pra adiantar, com taxa de R$ 5,00."}
        </p>
      </div>
      {!temPix && <p className="mb-aviso-linha">Cadastre sua chave Pix abaixo pra receber os repasses.</p>}

      {solicitando && (
        <div className="mb-cartao" style={{ marginTop: 12 }}>
          <b className="t16">Adiantar na terça</b>
          <label className="mb-campo" style={{ marginTop: 10 }}>
            <span>Valor (até {brl(saldo)})</span>
            <input inputMode="numeric" placeholder="0,00" value={valorSaque} onChange={e => setValorSaque(mascaraDinheiro(e.target.value))} />
          </label>
          <p className="mut" style={{ fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>
            Taxa do adiantamento: R$ 5,00. {valorDigitado > TAXA_TERCA ? <>Você recebe <b style={{ color: "var(--folha)" }}>{brl(valorDigitado - TAXA_TERCA)}</b> na chave <b style={{ color: "var(--grafite)" }}>{pixChaveDisplay}</b>.</> : <>Vai pra chave <b style={{ color: "var(--grafite)" }}>{pixChaveDisplay}</b>.</>}
          </p>
          {erroSaque && <p style={{ color: "var(--pimenta)", fontSize: 13.5, fontWeight: 700, marginTop: 8 }}>{erroSaque}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="mb-btn verde peq" onClick={solicitarSaque} disabled={enviandoSaque}>{enviandoSaque ? "Enviando…" : "Confirmar saque"}</button>
            <button className="mb-btn claro peq" style={{ width: 120 }} onClick={() => { setSolicitando(false); setErroSaque("") }}>Cancelar</button>
          </div>
        </div>
      )}

      {pendentes.length > 0 && (
        <div className="mb-cartao" style={{ marginTop: 12 }}>
          <b className="t16">Adiantamentos pedidos</b>
          {pendentes.map(s => (
            <div key={s.id} className="mb-linha">
              <span><b>{brl(Number(s.valor) - Number(s.taxa_saque ?? 0))}</b><small className="mut">{new Date(s.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}{Number(s.taxa_saque ?? 0) > 0 ? `, pediu ${brl(Number(s.valor))} menos taxa de ${brl(Number(s.taxa_saque))}` : ""}</small></span>
              <span className="mb-selo am">Aguardando</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-cartao" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b className="t16">Chave Pix e banco</b>
          <button onClick={() => setEditandoPix(e => !e)} style={{ background: "none", border: 0, color: "var(--pimenta)", fontWeight: 800, fontSize: 14 }}>{editandoPix ? "Cancelar" : "Editar"}</button>
        </div>
        {!editandoPix ? (
          <div style={{ marginTop: 8, fontSize: 14 }}>
            <p style={{ color: pixInput ? "var(--grafite)" : "var(--pimenta)", fontWeight: 700 }}>{pixInput || "Chave Pix não cadastrada"}</p>
            <p className="mut" style={{ fontSize: 13 }}>{bancoDisplay || "Banco não informado"}{agenciaDisplay ? `, agência ${agenciaDisplay}` : ""}{contaDisplay ? `, conta ${contaDisplay}` : ""}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            <label className="mb-campo"><span>Banco</span>
              <select value={bancoInput} onChange={e => setBancoInput(e.target.value)}>
                <option value="">Selecione o banco</option>
                {["Nubank","Inter","Itaú","Bradesco","Banco do Brasil","Caixa Econômica Federal","Santander","C6 Bank","PicPay","Mercado Pago","PagBank","Sicoob","Sicredi","BTG Pactual","XP Investimentos","Neon","Next","Original","Safra","BRB","Banrisul","Banco do Nordeste","Banco da Amazônia","Votorantim","Daycoval","Rendimento","Outro"].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 8 }}>
              <label className="mb-campo"><span>Agência</span><input value={agenciaInput} onChange={e => setAgenciaInput(e.target.value)} placeholder="0001" inputMode="numeric" /></label>
              <label className="mb-campo"><span>Conta</span><input value={contaInput} onChange={e => setContaInput(e.target.value)} placeholder="12345-6" inputMode="numeric" /></label>
            </div>
            <label className="mb-campo"><span>Chave Pix</span><input value={pixInput} onChange={e => setPixInput(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" /></label>
            <button className="mb-btn verm peq" onClick={salvarPix} disabled={salvandoPix || !pixInput.trim()}>{salvandoPix ? "Salvando…" : "Salvar"}</button>
          </div>
        )}
      </div>

      {saques.filter(s => s.status !== "solicitado").length > 0 && (
        <div className="mb-cartao" style={{ marginTop: 12 }}>
          <b className="t16">Pagamentos anteriores</b>
          {saques.filter(s => s.status !== "solicitado").map(s => (
            <div key={s.id} className="mb-linha">
              <span><b>{brl(Number(s.valor) - Number(s.taxa_saque ?? 0))}</b><small className="mut">{new Date(s.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}{s.pago_em ? `, pago em ${new Date(s.pago_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}</small></span>
              <span className={`mb-selo ${s.status === "pago" ? "ok" : "erro"}`}>{s.status === "pago" ? "Pago" : "Cancelado"}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-cartao" style={{ marginTop: 12 }}>
        <b className="t16">{aba === "datas" ? `Entregas de ${dmBr(deData)} a ${dmBr(ateData)}` : "Últimas entregas"}</b>
        {(entregasPeriodo ?? entregas).length === 0 ? <p className="mut" style={{ fontSize: 13.5, marginTop: 8 }}>{entregasPeriodo ? "Nenhuma entrega nesse período." : "Nenhuma entrega ainda."}</p> : (entregasPeriodo ?? entregas).slice(0, 300).map(p => (
          <div key={p.id} className="mb-linha">
            <span><b>#{p.codigo}</b><small className="mut">{(p as any).loja?.nome}, {new Date(p.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</small></span>
            <b style={{ color: "var(--folha)" }}>+ {brl(ganhoMotoboyPedido(p))}</b>
          </div>
        ))}
      </div>
    </div>
  )
}
