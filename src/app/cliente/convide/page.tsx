"use client"

// Convide amigos no layout novo (20/10/2026). Mesma regra e mesmo código de antes (8 primeiras
// letras do id). A barra de progresso "0/5" saiu: o sistema ainda não registra quem pediu com o
// código de quem, então ela ficava sempre parada. Volta quando a contagem existir.
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useClienteAuth } from "@/lib/auth-cliente"
import { TopoSub } from "@/components/cliente/TopoSub"

export default function ConvidePage() {
  const router = useRouter()
  const { user, loading } = useClienteAuth()
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push("/cliente/entrar")
  }, [user, loading, router])

  const codigo = user ? user.id.substring(0, 8).toUpperCase() : ""
  const link = typeof window !== "undefined" ? `${window.location.origin}/?ref=${codigo}` : `https://chegodelivery.com/?ref=${codigo}`

  function copiar() {
    navigator.clipboard?.writeText(link).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) }).catch(() => {})
  }

  async function compartilhar() {
    const texto = `Peça no Chegô, o delivery de Aragoiânia e Guapó. Meu código de convite: ${codigo}`
    if (navigator.share) { try { await navigator.share({ title: "Chegô", text: texto, url: link }) } catch {} }
    else copiar()
  }

  if (loading) return <div className="cn sub-tela" style={{ display: "grid", placeItems: "center" }}><p className="mut">Carregando…</p></div>

  return (
    <div className="cn sub-tela">
      <TopoSub titulo="Convide amigos" />
      <div className="conteudo">
        <div className="convite" style={{ margin: 0 }}>
          <b>Convide amigos e ganhe cupons</b>
          <span>A cada 5 amigos que fizerem o primeiro pedido com o seu código, você ganha 1 cupom.</span>
        </div>

        <div className="bloco">
          <div className="h3">Seu código</div>
          <div className="codigo-grande">
            <code>{codigo}</code>
            <button className="btn btn-s" style={{ width: "auto", padding: "0 18px", height: 58, letterSpacing: 0 }} onClick={copiar}>{copiado ? "Copiado" : "Copiar"}</button>
          </div>
        </div>

        <div className="bloco">
          <div className="h3">Como funciona</div>
          {["Mande o seu código pros amigos.", "Eles fazem o primeiro pedido no Chegô usando o código.", "A cada 5 amigos que pedirem, você ganha 1 cupom pra usar na sacola."].map((t, i) => (
            <div key={i} className="passo"><span>{i + 1}</span>{t}</div>
          ))}
        </div>

        <button className="btn btn-p" onClick={compartilhar}>Compartilhar meu código</button>
      </div>
    </div>
  )
}
