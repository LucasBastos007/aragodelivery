"use client"

// Primeiro acesso da loja (layout novo, 20/10/2026): troca a senha temporária. Mesma API de antes
// (/api/loja/trocar-senha), no visual da entrada (mapa escuro, logo).
import { useState } from "react"
import { useRouter } from "next/navigation"
import "../../chego-ctrl-login/login.css"

export default function PrimeiroAcessoPage() {
  const router = useRouter()
  const [nova, setNova] = useState(""), [conf, setConf] = useState(""), [ver, setVer] = useState(false)
  const [loading, setLoading] = useState(false), [erro, setErro] = useState(""), [treme, setTreme] = useState(0)

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro("")
    const falha = (t: string) => { setErro(t); setTreme(x => x + 1) }
    if (!nova || !conf) return falha("Preencha os dois campos.")
    if (nova.length < 6) return falha("A senha precisa de pelo menos 6 letras ou números.")
    if (nova !== conf) return falha("As duas senhas não ficaram iguais.")
    setLoading(true)
    const res = await fetch("/api/loja/trocar-senha", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ novaSenha: nova }) }).catch(() => null)
    const j = res ? await res.json().catch(() => ({})) : {}
    if (!res || !res.ok) { setLoading(false); return falha(!res ? "Sem conexão. Tente de novo." : j.error ?? "Não foi possível salvar a senha.") }
    router.push("/loja")
  }

  return (
    <div className="lg">
      <div className="lg-luz" aria-hidden="true" />
      <main className="lg-centro" style={{ gridTemplateColumns: "1fr", maxWidth: 460 }}>
        <form className={`lg-cartao ${erro ? "erro" : ""}`} key={treme} onSubmit={salvar} noValidate>
          <img src="/logo-chego-transparente.png" alt="Chegô" style={{ width: 150, display: "block", margin: "0 auto 14px" }} />
          <h2>Crie sua senha</h2>
          <p className="lg-sub">É seu primeiro acesso. Troque a senha temporária por uma que só você saiba.</p>
          <label className="lg-campo"><input type={ver ? "text" : "password"} value={nova} onChange={e => setNova(e.target.value)} placeholder=" " autoComplete="new-password" autoFocus /><span>Senha nova</span>
            <button type="button" className="lg-ver" onClick={() => setVer(!ver)}>{ver ? "Esconder" : "Mostrar"}</button></label>
          <label className="lg-campo"><input type={ver ? "text" : "password"} value={conf} onChange={e => setConf(e.target.value)} placeholder=" " autoComplete="new-password" /><span>Repita a senha</span></label>
          {erro && <p className="lg-erro" role="alert">{erro}</p>}
          <button className="lg-entrar" disabled={loading}>{loading ? <><i className="lg-gira" />Salvando…</> : "Salvar e entrar"}</button>
        </form>
      </main>
    </div>
  )
}
