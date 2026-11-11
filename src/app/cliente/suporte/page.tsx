"use client"

// "Ajuda pelo chat" com o layout da proposta (tela 17, 20/10/2026). Quem atende é o suporte do
// Chegô pelo WhatsApp: cada assunto (e a mensagem digitada) abre a conversa já com o texto e o
// número do pedido. Nada de resposta automática inventada aqui.
import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useClienteAuth } from "@/lib/auth-cliente"
import { supabase } from "@/lib/supabase"
import { brl } from "@/lib/precoExibicao"
import { STATUS_LABEL } from "@/lib/pedidoLabels"

const SUPORTE_WHATS = "5562985845621"
const ASSUNTOS = ["Meu pedido está atrasado", "Veio item errado ou faltando", "Problema com o pagamento", "Quero cancelar o pedido", "Outro assunto"]

function Suporte() {
  const router = useRouter()
  const sp = useSearchParams()
  const { user, perfil } = useClienteAuth()
  const [pedido, setPedido] = useState<{ codigo: string; total: number; status: string; loja: { nome: string } | null } | null>(null)
  const [texto, setTexto] = useState("")

  useEffect(() => {
    const cod = sp.get("pedido")
    if (cod) {
      supabase.from("pedidos").select("codigo, total, status, loja:lojas(nome)").eq("codigo", cod).maybeSingle()
        .then(({ data }) => setPedido(data as any))
    } else if (user) {
      supabase.from("pedidos").select("codigo, total, status, loja:lojas(nome)").eq("cliente_id", user.id)
        .order("criado_em", { ascending: false }).limit(1).maybeSingle()
        .then(({ data }) => setPedido(data as any))
    }
  }, [sp, user])

  const nome = (perfil?.nome ?? "").trim().split(/\s+/)[0]
  function abrir(msg: string) {
    const t = pedido ? `Pedido #${pedido.codigo}: ${msg}` : msg
    window.open(`https://wa.me/${SUPORTE_WHATS}?text=${encodeURIComponent(t)}`, "_blank")
  }

  return (
    <div className="cn suporte-tela">
      <div className="topo branco">
        <div className="linha-topo">
          <button className="voltar" onClick={() => (window.history.length > 1 ? router.back() : router.push("/cliente/meu-perfil"))} aria-label="Voltar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
          <span className="chat-av" style={{ background: "var(--pimenta)", color: "#fff" }}>C</span>
          <span style={{ flex: 1, minWidth: 0 }}><b className="h3" style={{ display: "block" }}>Suporte Chegô</b><small className="mut">Atendimento pelo WhatsApp</small></span>
        </div>
      </div>
      <div className="chat" style={{ flex: 1 }}>
        {pedido && (
          <div className="cartao sup-ped">
            <span className="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6M9 12h6" /></svg></span>
            <span style={{ flex: 1, minWidth: 0 }}><b>Pedido #{pedido.codigo}</b><small className="mut">{[pedido.loja?.nome, brl(Number(pedido.total)), STATUS_LABEL[pedido.status as keyof typeof STATUS_LABEL] ?? pedido.status].filter(Boolean).join(" · ")}</small></span>
          </div>
        )}
        <div className="bal ele">Oi{nome ? `, ${nome}` : ""}! Aqui é o suporte do Chegô. Sobre o que você quer falar?</div>
        <div className="sup-assuntos">
          {ASSUNTOS.map(a => <button key={a} onClick={() => abrir(a)}>{a}</button>)}
        </div>
      </div>
      <div className="chat-in">
        <input value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && texto.trim()) { abrir(texto.trim()); setTexto("") } }} placeholder="Escreva uma mensagem" />
        <button onClick={() => { if (texto.trim()) { abrir(texto.trim()); setTexto("") } }} disabled={!texto.trim()} aria-label="Enviar"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 12 20 4l-4 16-4-7z" /></svg></button>
      </div>
    </div>
  )
}

export default function SuportePage() {
  return <Suspense><Suporte /></Suspense>
}
