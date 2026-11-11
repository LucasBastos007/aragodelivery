"use client"

// Perfil igual à proposta aprovada (tela 20, revisado em 20/10/2026): cabeçalho com avatar
// vermelho, cartão de convite com o código, menu com ícones de traço e as folhas de Formas de
// pagamento, Cupons e Lojas favoritas. Os links de antes continuam (dados, notificações,
// convite, configurações) e o "Sair" é o mesmo.
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useClienteAuth } from "@/lib/auth-cliente"
import { supabase } from "@/lib/supabase"
import { lerFavoritas } from "@/lib/favoritas"
import { MobileBottomNav } from "@/components/MobileBottomNav"

const SUPORTE_WHATS = "5562985845621"

const Ic = ({ d }: { d: React.ReactNode }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
const ICO = {
  user: <Ic d={<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>} />,
  pin: <Ic d={<><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>} />,
  cartao: <Ic d={<><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h4" /></>} />,
  cupom: <Ic d={<><path d="M3 8.5V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.5a2.5 2.5 0 0 0 0 5V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2.5a2.5 2.5 0 0 0 0-5z" /><path d="M14 5v12" strokeDasharray="2 2" /></>} />,
  coracao: <Ic d={<path d="M12 20s-7.5-4.8-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.2 12 20 12 20z" />} />,
  sino: <Ic d={<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>} />,
  chat: <Ic d={<><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></>} />,
  doc: <Ic d={<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>} />,
  sair: <Ic d={<><path d="M10 4H5v16h5" /><path d="M14 8l4 4-4 4M18 12H9" /></>} />,
}

type Folha = null | "pagamentos" | "cupons" | "favoritas"

export default function MeuPerfilPage() {
  const router = useRouter()
  const { user, perfil, loading, logout } = useClienteAuth()
  const [folha, setFolha] = useState<Folha>(null)
  const [cartao, setCartao] = useState<{ last4: string; nome?: string; validade?: string } | null>(null)
  const [favoritas, setFavoritas] = useState<{ id: string; nome: string; logo_url: string | null; categoria: string | null; cidade: string | null; aberto: boolean }[] | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push("/cliente/entrar")
  }, [user, loading, router])

  function abrir(f: Folha) {
    if (f === "pagamentos") { try { setCartao(JSON.parse(localStorage.getItem("arago_cartao") ?? "null")) } catch { setCartao(null) } }
    if (f === "favoritas") {
      const ids = lerFavoritas()
      if (!ids.length) setFavoritas([])
      else supabase.from("lojas").select("id, nome, logo_url, categoria, cidade, aberto").in("id", ids)
        .then(({ data }) => setFavoritas(((data ?? []) as any[]).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))))
    }
    setFolha(f)
  }

  const nome: string = perfil?.nome ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "Cliente"
  const iniciais = nome.trim().split(/\s+/).map(x => x[0]).slice(0, 2).join("").toUpperCase()
  // Mesmo código mostrado em /cliente/convide
  const codigoConvite = user ? user.id.substring(0, 8).toUpperCase() : ""

  if (loading) return <div className="cn" style={{ display: "grid", placeItems: "center" }}><p className="mut">Carregando…</p></div>

  return (
    <div className="cn perfil-novo">
      <div className="perfil-cab">
        {user?.user_metadata?.avatar_url ? <img className="av" src={user.user_metadata.avatar_url} alt="" /> : <span className="av">{iniciais}</span>}
        <span style={{ flex: 1, minWidth: 0 }}>
          <div className="h2">{nome}</div>
          <small className="mut">{perfil?.telefone || user?.email || ""}</small>
        </span>
      </div>

      {/* Regra real do convite (a cada 5 amigos, 1 cupom), não a frase de exemplo da proposta */}
      <Link className="convite" href="/cliente/convide">
        <b>Convide amigos e ganhe cupons</b>
        <span>A cada 5 amigos que fizerem o primeiro pedido com o seu código, você ganha 1 cupom.</span>
        {codigoConvite && <><br /><code>{codigoConvite}</code></>}
      </Link>

      <div className="cartao menu-l">
        <Link href="/cliente/alterar-dados"><span className="ic">{ICO.user}</span>Meus dados</Link>
        <Link href="/cliente/alterar-dados#endereco"><span className="ic">{ICO.pin}</span>Endereços</Link>
        <button onClick={() => abrir("pagamentos")}><span className="ic">{ICO.cartao}</span>Formas de pagamento</button>
        <button onClick={() => abrir("cupons")}><span className="ic">{ICO.cupom}</span>Cupons</button>
        <button onClick={() => abrir("favoritas")}><span className="ic">{ICO.coracao}</span>Lojas favoritas</button>
      </div>
      <div className="cartao menu-l">
        <Link href="/cliente/notificacoes"><span className="ic">{ICO.sino}</span>Notificações</Link>
        <Link href="/cliente/suporte"><span className="ic">{ICO.chat}</span>Ajuda pelo chat</Link>
        <Link href="/cliente/configuracoes"><span className="ic">{ICO.doc}</span>Termos e privacidade</Link>
        <button onClick={async () => { await logout(); router.push("/") }}><span className="ic">{ICO.sair}</span>Sair</button>
      </div>

      <div className="rodape-marca"><img src="/logo-chego-transparente.png" alt="Chegô" /><span>Aragoiânia e Guapó</span></div>

      {folha && (
        <div className="cn-veu on" onClick={() => setFolha(null)}>
          <div className="cn folha on" onClick={e => e.stopPropagation()}>
            <div className="folha-rolagem" style={{ padding: folha === "favoritas" ? "18px 8px calc(env(safe-area-inset-bottom,0px) + 30px)" : "18px 22px calc(env(safe-area-inset-bottom,0px) + 30px)" }}>
              {folha === "pagamentos" && (
                <>
                  <div className="h2" style={{ marginBottom: 16 }}>Formas de pagamento</div>
                  {cartao?.last4 && (
                    <div className="pg" aria-checked="true">
                      <span className="ic">{ICO.cartao}</span>
                      <span className="n"><b>Cartão final {cartao.last4}</b><small>Crédito{cartao.validade ? ` · validade ${cartao.validade}` : ""}</small></span>
                    </div>
                  )}
                  <div className="pg"><span className="ic"><img src="/pix-icone.svg" alt="" width={22} height={22} /></span><span className="n"><b>Pix</b><small>Sempre disponível</small></span></div>
                  {cartao?.last4
                    ? <button className="btn btn-s" style={{ marginTop: 8 }} onClick={() => { try { localStorage.removeItem("arago_cartao") } catch {} setCartao(null) }}>Remover cartão salvo</button>
                    : <p className="mut" style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 8 }}>O cartão fica salvo aqui quando você paga com ele e marca “Salvar cartão pra próximas compras”.</p>}
                </>
              )}
              {folha === "cupons" && (
                <>
                  <div className="h2" style={{ marginBottom: 8 }}>Seus cupons</div>
                  <p className="mut" style={{ lineHeight: 1.5 }}>Nenhum cupom disponível agora. Quando uma loja ou o Chegô criar um cupom pra você, ele aparece aqui. Tem um código? Use na sacola.</p>
                </>
              )}
              {folha === "favoritas" && (
                <>
                  <div className="h2" style={{ margin: "0 14px 10px" }}>Lojas favoritas</div>
                  {favoritas === null ? <p className="mut" style={{ padding: "10px 14px" }}>Carregando…</p>
                    : favoritas.length === 0 ? <p className="mut" style={{ padding: "10px 14px" }}>Toque no coração de uma loja pra salvar aqui.</p>
                    : favoritas.map(l => (
                      <Link key={l.id} href={`/restaurante/${l.id}`} className="fav-l">
                        {l.logo_url ? <img src={l.logo_url} alt="" /> : <span className="sem" />}
                        <span style={{ flex: 1, minWidth: 0 }}><b>{l.nome}</b><small className="mut">{[l.categoria, l.cidade].filter(Boolean).join(" · ")}</small></span>
                        <span className={`selo ${l.aberto ? "aberto" : "fechado"}`}>{l.aberto ? "Aberta" : "Fechada"}</span>
                      </Link>
                    ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <MobileBottomNav />
    </div>
  )
}
