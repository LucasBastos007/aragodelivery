"use client"

// Notificações no layout novo (20/10/2026): os últimos 10 pedidos com a situação de cada um,
// como antes. Ícones de traço no lugar dos emojis.
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useClienteAuth } from "@/lib/auth-cliente"
import { supabase } from "@/lib/supabase"
import { brl } from "@/lib/precoExibicao"
import { TopoSub } from "@/components/cliente/TopoSub"

const Ic = ({ d }: { d: React.ReactNode }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
const I = {
  relogio: <Ic d={<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>} />,
  ok: <Ic d={<><circle cx="12" cy="12" r="8.5" /><path d="M8 12.5l2.7 2.7L16 9.8" /></>} />,
  panela: <Ic d={<><path d="M4 11h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M2 11h20M9 7c0-1.5 1-2 1-3M14 7c0-1.5 1-2 1-3" /></>} />,
  caixa: <Ic d={<><path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8" /></>} />,
  moto: <Ic d={<><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="M9 17h6l-3-7h-3M15 10h3l2 4" /></>} />,
  casa: <Ic d={<><path d="M4 11l8-6 8 6v9H4z" /><path d="M10 20v-5h4v5" /></>} />,
  x: <Ic d={<><circle cx="12" cy="12" r="8.5" /><path d="M9 9l6 6M15 9l-6 6" /></>} />,
  pix: <Ic d={<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 12h8" /></>} />,
}

// Texto pro cliente (o STATUS_LABEL é o da loja)
const SITUACAO: Record<string, { ic: React.ReactNode; msg: string; cor?: string }> = {
  aguardando_pagamento: { ic: I.pix, msg: "Esperando o pagamento" },
  pendente:             { ic: I.relogio, msg: "Esperando a loja confirmar" },
  aceito:               { ic: I.ok, msg: "A loja confirmou seu pedido", cor: "var(--folha)" },
  preparando:           { ic: I.panela, msg: "Sendo preparado" },
  pronto:               { ic: I.caixa, msg: "Pronto, chamando o entregador" },
  aguardando_aceite:    { ic: I.caixa, msg: "Pronto, chamando o entregador" },
  indo_para_loja:       { ic: I.moto, msg: "Entregador indo buscar" },
  na_loja:              { ic: I.moto, msg: "Entregador na loja" },
  em_rota:              { ic: I.moto, msg: "Saiu pra entrega", cor: "var(--pimenta)" },
  coletado:             { ic: I.moto, msg: "Saiu pra entrega", cor: "var(--pimenta)" },
  entregue:             { ic: I.casa, msg: "Entregue", cor: "var(--folha)" },
  cancelado:            { ic: I.x, msg: "Cancelado", cor: "var(--suave)" },
}

function quando(iso: string) {
  const d = new Date(iso)
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1) return "agora"
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })
}

export default function NotificacoesPage() {
  const router = useRouter()
  const { user, loading } = useClienteAuth()
  const [pedidos, setPedidos] = useState<any[] | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push("/cliente/entrar")
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    supabase.from("pedidos").select("id, codigo, status, total, criado_em, loja:lojas(nome)")
      .eq("cliente_id", user.id).order("criado_em", { ascending: false }).limit(10)
      .then(({ data }) => setPedidos(data ?? []))
  }, [user])

  if (loading) return <div className="cn sub-tela" style={{ display: "grid", placeItems: "center" }}><p className="mut">Carregando…</p></div>

  return (
    <div className="cn sub-tela">
      <TopoSub titulo="Notificações" />
      <div className="conteudo">
        {pedidos === null ? <p className="mut" style={{ padding: 20, textAlign: "center" }}>Carregando…</p>
          : pedidos.length === 0 ? (
            <div className="vazio">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto", display: "block" }}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
              <b>Nada por aqui ainda</b>
              <span>Quando você fizer um pedido, a situação dele aparece aqui.</span>
            </div>
          ) : (
            <div className="bloco" style={{ padding: 0, gap: 0 }}>
              {pedidos.map(p => {
                const s = SITUACAO[p.status] ?? { ic: I.relogio, msg: p.status }
                return (
                  <Link key={p.id} href={`/pedido/${p.codigo}`} className="linha-op">
                    <span className="ic" style={{ color: s.cor ?? "var(--grafite)" }}>{s.ic}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b>{s.msg}</b>
                      <small>{(p.loja as any)?.nome ?? "Loja"}, pedido #{p.codigo}, {brl(Number(p.total))}</small>
                    </span>
                    <small className="mut" style={{ flex: "none", alignSelf: "flex-start", fontSize: 12 }}>{quando(p.criado_em)}</small>
                  </Link>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}
