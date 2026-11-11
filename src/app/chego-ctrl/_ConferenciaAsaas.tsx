"use client"

// Conferência com o Asaas (admin 2.0, 20/10/2026): extrato real da conta no período x o que o app
// registrou. Carrega só quando pedem (/api/admin/asaas-conferencia). Só leitura.
import { useState } from "react"
import { R, dm } from "./_dinheiro"

export default function ConferenciaAsaas({ de, ate }: { de: string; ate: string }) {
  const [d, setD] = useState<any>(null), [erro, setErro] = useState(""), [carregando, setCarregando] = useState(false), [ver, setVer] = useState(false)
  async function conferir() {
    setCarregando(true); setErro("")
    const r = await fetch(`/api/admin/asaas-conferencia?de=${de}&ate=${ate}`, { credentials: "include" }); const j = await r.json().catch(() => ({}))
    setCarregando(false); if (!r.ok) { setErro(j.error ?? "Não foi possível falar com o Asaas."); return } setD(j)
  }
  const a = d?.asaas, app = d?.app
  const fecha = a && a.saldoInicial != null && Math.abs(a.saldoInicial + a.movimento - a.saldoFinal) < 0.02
  return (
    <div className="cartao" style={{ padding: 18, marginTop: 12 }}>
      <div className="lin" style={{ flexWrap: "wrap", gap: 10 }}>
        <span style={{ flex: 1, minWidth: 240 }}><b className="t20">Conferir com o Asaas</b><p className="t14 mut">Lê o extrato real da conta de {dm(de)} a {dm(ate)} e compara com o que o app registrou: entradas, taxas de verdade, Pix enviados, antecipações e o que ainda vai cair.</p></span>
        <button className="btn btn-p" disabled={carregando} onClick={conferir}>{carregando ? "Lendo o extrato…" : d ? "Conferir de novo" : "Conferir agora"}</button>
      </div>
      {erro && <div className="aviso vm" style={{ marginTop: 10 }}>{erro}</div>}
      {a && <>
        <div className="kpis4" style={{ marginTop: 12 }}>
          <div className="cartao kpi2"><small>Saldo no Asaas agora</small><b className="num">{a.saldo == null ? "–" : R(a.saldo)}</b><span className="t14 mut">{a.saldoFinal != null ? `no fim do período: ${R(a.saldoFinal)}` : "sem lançamento no período"}</span></div>
          <div className="cartao kpi2"><small>Entrou de clientes (Asaas)</small><b className="num">{R(a.entradas)}</b><span className="t14 mut">o app registrou {R(app.total)} em Pix e cartão</span></div>
          <div className="cartao kpi2"><small>Taxas reais do Asaas</small><b className="num">{R(Math.abs(a.taxas))}</b><span className="t14 mut">o app estimou {R(app.taxaEstimada)}</span></div>
          <div className="cartao kpi2"><small>Ainda vai cair (cartão)</small><b className="num">{R(a.aReceber.liquido)}</b><span className="t14 mut">{a.aReceber.n} pagamentos aprovados, ainda não liberados</span></div>
        </div>
        <div className={`aviso ${fecha ? "vd" : "am"}`} style={{ marginTop: 4 }}>
          {a.saldoInicial == null ? "Nenhum lançamento no extrato nesse período." : fecha
            ? <>A conta fecha: saldo no início {R(a.saldoInicial)} + movimentos {R(a.movimento)} = saldo no fim {R(a.saldoFinal)}.</>
            : <>Atenção: saldo no início {R(a.saldoInicial)} + movimentos {R(a.movimento)} não dá o saldo do fim {R(a.saldoFinal)}. Confira no Asaas.</>}
        </div>
        {Math.abs(a.entradas - app.total) > 0.009 && <p className="t14 mut" style={{ marginTop: 8 }}>Diferença entre o que entrou no Asaas e o que o app registrou: {R(a.entradas - app.total)}. É normal quando cartão cai dias depois do pedido, quando há antecipação ou pedido de outro período caindo agora. Se a diferença ficar grande e sem explicação, vale olhar o extrato.</p>}
        {a.antecipacoes.length > 0 && <div style={{ marginTop: 12 }}><b className="t16b">Antecipações no período</b><table className="tabela" style={{ marginTop: 6 }}><thead><tr><th>Data</th><th>Situação</th><th style={{ textAlign: "right" }}>Valor</th><th style={{ textAlign: "right" }}>Taxa</th><th style={{ textAlign: "right" }}>Caiu</th></tr></thead>
          <tbody>{a.antecipacoes.map((x: any) => <tr key={x.id}><td>{x.data ? dm(x.data) : "–"}</td><td><span className={`selo ${x.status === "CREDITED" ? "verde" : x.status === "DENIED" ? "vermelho" : "amarelo"}`}>{({ CREDITED: "Creditada", PENDING: "Pendente", DENIED: "Negada", SCHEDULED: "Agendada", DEBITED: "Debitada", CANCELLED: "Cancelada", OVERDUE: "Vencida" } as any)[x.status] ?? x.status}</span></td><td className="num" style={{ textAlign: "right" }}>{R(x.valor)}</td><td className="num" style={{ textAlign: "right" }}>{R(x.taxa)}</td><td className="num" style={{ textAlign: "right", fontWeight: 800 }}>{R(x.liquido)}</td></tr>)}</tbody></table></div>}
        <button className="btn btn-l" style={{ padding: 0, marginTop: 10 }} onClick={() => setVer(!ver)}>{ver ? "Esconder o extrato por tipo" : `Ver o extrato por tipo (${a.lancamentos} lançamentos)`}</button>
        {ver && <table className="tabela" style={{ marginTop: 6 }}><thead><tr><th>Tipo</th><th>Lançamentos</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
          <tbody>{a.tipos.map((t: any) => <tr key={t.tipo}><td>{t.nome}</td><td className="num">{t.n}</td><td className="num" style={{ textAlign: "right", fontWeight: 800, color: t.valor < 0 ? "var(--pimenta-esc)" : "var(--folha)" }}>{R(t.valor)}</td></tr>)}</tbody></table>}
        {a.aReceber.proximos.length > 0 && ver && <div style={{ marginTop: 10 }}><b className="t16b">Próximos a cair</b>{a.aReceber.proximos.slice(0, 15).map((p: any) => <div key={p.id} className="lj-dado"><span>{p.cai ? `cai em ${new Date(p.cai + "T12:00:00").toLocaleDateString("pt-BR")}` : "sem data"}{p.ref ? `, ${p.ref}` : ""}</span><b>{R(p.liquido)}</b></div>)}</div>}
      </>}
    </div>
  )
}
