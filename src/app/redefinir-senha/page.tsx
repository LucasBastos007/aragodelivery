"use client"

// Redefinir senha (21/10/2026): mesmo visual da entrada nova do lojista e do admin.
// Funciona igual a antes: o link do e-mail traz o token; a senha nova vai pra /api/redefinir-senha.
// O token diz se é lojista ou motoboy, pra voltar pra entrada certa.
import { useState, Suspense, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import "../chego-ctrl-login/login.css"

function tipoDoToken(token: string): "lojista" | "motoboy" | null {
  try {
    const p = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")
    const j = JSON.parse(atob(p + "===".slice((p.length + 3) % 4)))
    return j?.tipo === "motoboy" ? "motoboy" : j?.tipo === "lojista" ? "lojista" : null
  } catch { return null }
}

function RedefinirSenha() {
  const params = useSearchParams()
  const token = params.get("token") ?? ""
  const tipo = useMemo(() => tipoDoToken(token), [token])
  const voltar = tipo === "motoboy" ? "/entrar/motoboy" : "/loja/entrar"
  const [senha, setSenha] = useState(""), [confirma, setConfirma] = useState(""), [ver, setVer] = useState(false)
  const [loading, setLoading] = useState(false), [erro, setErro] = useState(""), [ok, setOk] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < 8) { setErro("A senha precisa ter pelo menos 8 caracteres."); return }
    if (senha !== confirma) { setErro("As duas senhas não são iguais."); return }
    if (!token) { setErro("Link inválido. Peça um novo em Esqueceu a senha."); return }
    setErro(""); setLoading(true)
    const res = await fetch("/api/redefinir-senha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, senha }) })
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setErro(json.error ?? "Não foi possível trocar a senha. Peça um novo link."); return }
    setOk(true)
  }

  return (
    <div className="lg">
      <div className="lg-luz" aria-hidden="true" />
      <main className="lg-centro">
        <section className="lg-marca">
          <img src="/logo-chego-transparente.png" alt="Chegô" className="lg-logo" />
          <h1>{tipo === "motoboy" ? "App do entregador" : "Painel da loja"}</h1>
          <p className="lg-frase">Troque sua senha em um minuto.</p>
        </section>
        <form className={`lg-cartao ${erro ? "erro" : ""}`} onSubmit={salvar} noValidate>
          <img src="/mascote/moto.png" alt="" className="lg-mascote" aria-hidden="true" />
          {ok ? <>
            <h2>Senha trocada</h2>
            <p className="lg-sub">Agora é só entrar com a senha nova.</p>
            <Link className="lg-entrar" href={voltar} style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>Ir para a entrada</Link>
          </> : <>
            <h2>Criar senha nova</h2>
            <p className="lg-sub">Use pelo menos 8 caracteres.</p>
            <label className="lg-campo"><input type={ver ? "text" : "password"} value={senha} onChange={e => setSenha(e.target.value)} placeholder=" " autoComplete="new-password" autoFocus /><span>Senha nova</span>
              <button type="button" className="lg-ver" onClick={() => setVer(!ver)} aria-label={ver ? "Esconder senha" : "Mostrar senha"}>{ver ? "Esconder" : "Mostrar"}</button></label>
            <label className="lg-campo"><input type={ver ? "text" : "password"} value={confirma} onChange={e => setConfirma(e.target.value)} placeholder=" " autoComplete="new-password" /><span>Repita a senha</span></label>
            {erro && <p className="lg-erro" role="alert">{erro}</p>}
            <button className="lg-entrar" disabled={loading}>{loading ? <><i className="lg-gira" />Salvando…</> : "Salvar senha nova"}</button>
            <p className="lg-cadastro"><Link href={voltar}>Voltar para a entrada</Link></p>
          </>}
        </form>
      </main>
    </div>
  )
}

export default function RedefinirSenhaPage() { return <Suspense><RedefinirSenha /></Suspense> }
