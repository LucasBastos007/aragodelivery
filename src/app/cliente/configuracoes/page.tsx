"use client"

// "Privacidade e conta" no layout novo (20/10/2026).
// Saíram as chaves "Promoções e cupons" e "Novidades do app": só gravavam no celular e nada
// usava, o Chegô não manda esse tipo de aviso. Ficou o que existe de verdade: o aviso do
// pedido (permissão do navegador), os Termos, a Política de privacidade, sair e pedir a
// exclusão da conta pelo suporte.
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useClienteAuth } from "@/lib/auth-cliente"
import { TopoSub } from "@/components/cliente/TopoSub"

const SUPORTE_WHATS = "5562985845621"
const Ic = ({ d }: { d: React.ReactNode }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
const I = {
  sino: <Ic d={<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>} />,
  doc: <Ic d={<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>} />,
  cadeado: <Ic d={<><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>} />,
  chat: <Ic d={<><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></>} />,
  sair: <Ic d={<><path d="M10 4H5v16h5" /><path d="M14 8l4 4-4 4M18 12H9" /></>} />,
  lixo: <Ic d={<><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>} />,
}

type Perm = "granted" | "denied" | "default" | "indisponivel"

export default function ConfiguracoesPage() {
  const router = useRouter()
  const { user, loading, logout } = useClienteAuth()
  const [perm, setPerm] = useState<Perm>("default")

  useEffect(() => {
    if (!loading && !user) router.push("/cliente/entrar")
  }, [user, loading, router])

  useEffect(() => {
    setPerm(typeof window !== "undefined" && "Notification" in window ? Notification.permission : "indisponivel")
  }, [])

  async function ativarAvisos() {
    if (!("Notification" in window)) return
    setPerm(await Notification.requestPermission())
  }

  function pedirExclusao() {
    const t = `Quero excluir minha conta do Chegô. E-mail/telefone da conta: ${user?.email ?? ""}`
    window.open(`https://wa.me/${SUPORTE_WHATS}?text=${encodeURIComponent(t)}`, "_blank")
  }

  if (loading) return <div className="cn sub-tela" style={{ display: "grid", placeItems: "center" }}><p className="mut">Carregando…</p></div>

  const textoPerm = perm === "granted" ? "Ativados. Você recebe um aviso quando o pedido muda de etapa."
    : perm === "denied" ? "Bloqueados neste celular. Libere nas configurações do navegador, em Notificações."
    : perm === "indisponivel" ? "Este navegador não recebe avisos. No iPhone, adicione o Chegô à tela de início."
    : "Receba um aviso quando a loja confirmar e quando o pedido sair pra entrega."

  return (
    <div className="cn sub-tela">
      <TopoSub titulo="Termos e privacidade" />
      <div className="conteudo">
        <div className="bloco" style={{ padding: 0, gap: 0 }}>
          <div className="linha-op">
            <span className="ic">{I.sino}</span>
            <span style={{ flex: 1, minWidth: 0 }}><b>Avisos do pedido</b><small>{textoPerm}</small></span>
            {perm === "default" && <button className="btn btn-p" style={{ width: "auto", height: 38, padding: "0 14px", fontSize: 14, borderRadius: 12 }} onClick={ativarAvisos}>Ativar</button>}
          </div>
        </div>

        <div className="bloco" style={{ padding: 0, gap: 0 }}>
          <Link href="/termos" className="linha-op"><span className="ic">{I.doc}</span><span style={{ flex: 1 }}><b>Termos de uso</b></span></Link>
          <Link href="/termos#privacidade" className="linha-op"><span className="ic">{I.cadeado}</span><span style={{ flex: 1 }}><b>Política de privacidade</b><small>Quais dados o Chegô usa e pra quê</small></span></Link>
          <Link href="/cliente/suporte" className="linha-op"><span className="ic">{I.chat}</span><span style={{ flex: 1 }}><b>Ajuda pelo chat</b></span></Link>
        </div>

        <div className="bloco" style={{ padding: 0, gap: 0 }}>
          <button className="linha-op" onClick={async () => { await logout(); router.push("/") }}><span className="ic">{I.sair}</span><span style={{ flex: 1 }}><b>Sair da conta</b></span></button>
          <button className="linha-op" onClick={pedirExclusao}><span className="ic perigo">{I.lixo}</span><span style={{ flex: 1 }}><b className="perigo">Excluir minha conta</b><small>O pedido vai pro suporte pelo WhatsApp, que confirma com você por lá.</small></span></button>
        </div>

        <div className="rodape-marca" style={{ paddingBottom: 20 }}><img src="/logo-chego-transparente.png" alt="Chegô" /><span>Aragoiânia e Guapó</span></div>
      </div>
    </div>
  )
}
