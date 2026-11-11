"use client"
// Peças de dinheiro do admin 2.0: barra que divide, lista "pra onde foi" e formatação.
export const R = (v: number) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`
export type Linha = { id: string; codigo: string; criado_em: string; dia: string; loja_id: string; motoboy_id: string | null; forma: string
  pago: number; produtos: number; entrega: number; loja: number; mb: number; custo: number; app: number; comissao: number; taxaLoja: number; cupomLoja: number; cupomChego: number; recebidoLoja: number; meios?: Record<string, number> }
export const PARTES: { k: "loja" | "mb" | "custo" | "app"; n: string; d: string; cor: string }[] = [
  { k: "loja", n: "Lojas", d: "Produtos, já sem comissão, taxa e cupom da loja", cor: "var(--c-loja)" },
  { k: "mb", n: "Motoboys", d: "Taxa de entrega (piso de R$ 4,00 por corrida)", cor: "var(--c-mb)" },
  { k: "custo", n: "Taxas de pagamento", d: "O que o Asaas e a maquininha cobram do Chegô (estimado)", cor: "var(--c-res)" },
  { k: "app", n: "Lucro do app", d: "Comissão, taxas cobradas das lojas e parte da entrega, menos custos e cupons do Chegô", cor: "var(--c-app)" },
]
export function BarraDiv({ partes }: { partes: { n: string; v: number; cor: string }[] }) {
  const t = partes.reduce((a, x) => a + Math.max(0, x.v), 0) || 1
  return <div className="barra-div" role="img" aria-label="Divisão do dinheiro">{partes.map(x => <i key={x.n} style={{ width: `${Math.max(0, x.v) / t * 100}%`, background: x.cor }} title={`${x.n}: ${R(x.v)}`} />)}</div>
}
export const somaL = (ls: Linha[], f: (l: Linha) => number) => Math.round(ls.reduce((t, l) => t + f(l), 0) * 100) / 100
export function Divisao({ linhas, sel, onSel }: { linhas: Linha[]; sel?: string | null; onSel?: (k: string) => void }) {
  const v = { loja: somaL(linhas, l => l.loja), mb: somaL(linhas, l => l.mb), custo: somaL(linhas, l => l.custo), app: somaL(linhas, l => l.app) }, tot = somaL(linhas, l => l.pago)
  return (
    <>
      <div className="entrou"><span className="t14 mut">Entrou dos clientes</span><b className="num">{R(tot)}</b><span className="t14 mut">{linhas.length} pedidos entregues</span></div>
      <BarraDiv partes={PARTES.map(p => ({ n: p.n, v: v[p.k], cor: p.cor }))} />
      <ul className="div-l">{PARTES.map(p => (
        <li key={p.k}><button onClick={() => onSel?.(p.k)} aria-pressed={sel === p.k}><i style={{ background: p.cor }} /><span><b>{p.n}</b><small>{p.d}</small></span>
          <span className="num"><b>{R(v[p.k])}</b><small>{tot ? Math.round(v[p.k] / tot * 100) : 0}%</small></span><span className="seta">{sel === p.k ? "⌄" : "›"}</span></button></li>
      ))}</ul>
    </>
  )
}
export type Divisao = { total: number; lido: boolean; lojas: number; motoboys: number; reservado: number; app: number
  asaas?: number; dinheiro?: number; ton?: { saldo: number; aReceber: number; em: string; digitado?: { saldo: number; aReceber: number }; vendas?: number; vendido?: number } | null
  mp?: { saldo: number; em: string | null; digitado: number; vendas: number; recebido: number; daConta?: boolean } | null; porDinheiro?: { id: string; nome: string; v: number }[]
  porLoja?: { id: string; nome: string; logo: string | null; v: number }[]; porMb?: { id: string; nome: string; v: number; n: number }[] }
export function SaldoAsaas({ d, curto }: { d: Divisao; curto?: boolean }) {
  const partes = [{ n: "Das lojas (repasse de sexta)", v: d.lojas, cor: "var(--c-loja)" }, { n: "Dos motoboys (saldo desde 16/10)", v: d.motoboys, cor: "var(--c-mb)" }, { n: "Reservado (reembolsos em análise)", v: d.reservado, cor: "var(--c-res)" }, { n: "Lucro do app (pode usar)", v: d.app, cor: "var(--c-app)" }]
  return (
    <>
      <b className="num" style={{ display: "block", fontFamily: "var(--display)", fontWeight: 800, fontSize: curto ? 28 : 40, color: "var(--grafite)", margin: "6px 0 4px" }}>{d.lido ? R(d.total) : "Asaas não respondeu"}</b>
      <BarraDiv partes={partes} />
      <ul className="leg">{partes.map(x => <li key={x.n}><i style={{ background: x.cor }} /><span>{x.n}</span><b className="num" style={{ color: x.v < 0 ? "var(--pimenta-esc)" : undefined }}>{R(x.v)}</b></li>)}</ul>
      {d.app < 0 && <p className="aviso vm" style={{ marginTop: 8 }}>O saldo não cobre o que é das lojas e dos motoboys. Falta {R(-d.app)}.</p>}
    </>
  )
}

// Formas de pagamento no fechamento do dia (quem recebe cada uma)
export const MEIOS: { k: string; n: string; quem: string; cor: string }[] = [
  { k: "pix", n: "Pix no app", quem: "cai no Asaas", cor: "#1E8A4C" },
  { k: "cartao", n: "Cartão no app", quem: "cai no Asaas", cor: "#1F5FBF" },
  { k: "maquininha_debito", n: "Maquininha débito", quem: "cai na Ton", cor: "#6B3FC4" },
  { k: "maquininha_credito", n: "Maquininha crédito", quem: "cai na Ton", cor: "#9B6EE0" },
  { k: "maquininha_sem_tipo", n: "Maquininha sem tipo", quem: "cai na Ton, débito ou crédito não registrado", cor: "#B9A6E8" },
  { k: "dinheiro", n: "Dinheiro", quem: "fica com o motoboy", cor: "#F5B700" },
  { k: "pix_loja", n: "Pix direto na loja", quem: "cai na conta da loja", cor: "#706C64" },
]
