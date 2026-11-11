"use client"

// Meus pedidos no layout novo (proposta aprovada em 19/10/2026). Mesma consulta, mesmo
// "Pedir de novo" (lib/reordenar) e o mesmo link pro acompanhamento.
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useClienteAuth } from "@/lib/auth-cliente"
import { useCart } from "@/lib/cart"
import { montarReordem } from "@/lib/reordenar"
import { supabase } from "@/lib/supabase"
import { brl } from "@/lib/precoExibicao"
import { MobileBottomNav } from "@/components/MobileBottomNav"

const STATUS_ANDAMENTO = ["pendente","aceito","preparando","pronto","aguardando_aceite","indo_para_loja","na_loja","em_rota","coletado"]

const STATUS_TEXTO: Record<string, string> = {
  pendente: "Esperando a loja aceitar", aceito: "A loja aceitou seu pedido", preparando: "Preparando com carinho",
  pronto: "Pronto, esperando o entregador", aguardando_aceite: "Chamando um entregador", indo_para_loja: "Entregador indo buscar",
  na_loja: "Entregador na loja", em_rota: "Saiu para entrega", coletado: "Saiu para entrega",
}
const SUPORTE_WHATS = "5562985845621"

function dataCurta(iso: string) {
  const d = new Date(iso)
  const ymd = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
  const hoje = new Date(), ontem = new Date(Date.now() - 86400000)
  if (ymd(d) === ymd(hoje)) return `Hoje, ${d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}`
  if (ymd(d) === ymd(ontem)) return "Ontem"
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })
}

export default function HistoricoPage() {
  const router = useRouter()
  const { add } = useCart()
  const { user, loading } = useClienteAuth()

  const [todos, setTodos] = useState<any[]>([])
  const [loadingPedidos, setLoadingPedidos] = useState(false)
  const [reordenadoId, setReordenadoId] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push("/cliente/entrar")
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    setLoadingPedidos(true)
    supabase
      .from("pedidos")
      .select("*, loja:lojas(id, nome, logo_url), itens:itens_pedido(*, produto:produtos(foto_url))")
      .eq("cliente_id", user.id)
      .in("status", [...STATUS_ANDAMENTO, "entregue", "cancelado"])
      .order("criado_em", { ascending: false })
      .limit(100)
      .then(({ data }) => { setTodos(data ?? []); setLoadingPedidos(false) })
  }, [user])

  async function handleReorder(pedido: any) {
    const loja  = pedido.loja
    if (!loja || !(pedido.itens ?? []).length) return
    setReordenadoId(pedido.id)
    const { itens, pendentes } = await montarReordem(pedido)
    for (const unidades of itens) for (const u of unidades) add(u)
    if (pendentes.length) setAviso(`Alguns itens não entraram: ${pendentes.join(", ")}. Escolha eles de novo no cardápio.`)
    setTimeout(() => { setReordenadoId(null); router.push(`/restaurante/${loja.id}`) }, pendentes.length ? 2600 : 700)
  }

  const andamento = todos.filter(p => STATUS_ANDAMENTO.includes(p.status))
  const anteriores = todos.filter(p => !STATUS_ANDAMENTO.includes(p.status))

  if (loading) return <div className="cn" style={{ display: "grid", placeItems: "center" }}><p className="mut">Carregando…</p></div>

  return (
    <div className="cn pedidos-novo">
      <div className="topo"><div className="h1">Pedidos</div></div>

      {loadingPedidos ? <div className="vazio">Carregando pedidos…</div> : todos.length === 0 ? (
        <div className="vazio" style={{ paddingTop: 60 }}>
          <div style={{ fontSize: 48 }}>🧾</div>
          <div className="h2" style={{ margin: "10px 0 6px" }}>Você ainda não fez pedidos</div>
          <p>Quando pedir, eles aparecem aqui.</p>
          <Link className="btn btn-p" href="/" style={{ marginTop: 20 }}>Ver lojas</Link>
        </div>
      ) : (
        <>
          {andamento.length > 0 && (
            <>
              <div style={{ padding: "4px 16px 8px" }}><span className="h3">Em andamento</span></div>
              {andamento.map(p => (
                <Link key={p.id} className="andamento" style={{ marginTop: 0, marginBottom: 10 }} href={`/pedido/${p.codigo}`}>
                  <span className="mot">🛵</span>
                  <span style={{ flex: 1, minWidth: 0 }}><b>{STATUS_TEXTO[p.status] ?? "Em andamento"}</b><small>{p.loja?.nome ?? ""}, #{p.codigo}</small></span>
                  <span>›</span>
                </Link>
              ))}
            </>
          )}

          {anteriores.length > 0 && <div style={{ padding: "10px 16px 8px" }}><span className="h3">Anteriores</span></div>}
          {anteriores.map(p => {
            const itens = (p.itens ?? []) as any[]
            const resumo = itens.map((i: any) => `${i.quantidade}× ${i.nome}`).join(", ")
            return (
              <div key={p.id} className="cartao ped-h">
                <Link className="l1" href={`/pedido/${p.codigo}`}>
                  {p.loja?.logo_url ? <img src={p.loja.logo_url} alt="" /> : <span className="sem-logo">{(p.loja?.nome ?? "L").charAt(0)}</span>}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b className="h3" style={{ display: "block" }}>{p.loja?.nome ?? "Loja"}</b>
                    <small className="mut">{dataCurta(p.criado_em)}{p.status === "cancelado" ? " · cancelado" : ""} · {resumo.slice(0, 60)}</small>
                  </span>
                  <span className="preco">{brl(Number(p.total))}</span>
                </Link>
                <div className="acts">
                  <a href={`/cliente/suporte?pedido=${p.codigo}`}>Ajuda</a>
                  <button className="p" onClick={() => handleReorder(p)} disabled={reordenadoId === p.id}>{reordenadoId === p.id ? "Na sacola" : "Pedir de novo"}</button>
                </div>
              </div>
            )
          })}
        </>
      )}

      {aviso && <div className="cn-toast" role="status">{aviso}</div>}
      <div style={{ height: 110 }} />
      <MobileBottomNav />
    </div>
  )
}
