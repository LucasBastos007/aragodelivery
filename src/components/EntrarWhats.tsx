"use client"

// Entrada do cliente por código no WhatsApp (Z-API). Fluxo: WhatsApp → código de 6
// números → (escolher conta, se o número tiver mais de uma | nome, se for cliente novo)
// → sessão do Supabase via verifyOtp(token_hash). Ver src/lib/loginWhats.ts.

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"

type Conta = { id: string; nome: string; email: string | null; desde: string }
const VERDE = "#25D366"
const VAZIO = ["", "", "", "", "", ""]

const inp: React.CSSProperties = {
  width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 16,
  background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#111827", outline: "none", boxSizing: "border-box",
}
const btn = (ativo = true): React.CSSProperties => ({
  width: "100%", padding: "13px 16px", borderRadius: 12, border: "none", fontWeight: 700, fontSize: 15,
  background: ativo ? "#DC2626" : "#F1B5B5", color: "white", cursor: ativo ? "pointer" : "not-allowed",
})

function mascara(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11)
  return d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d
}

export default function EntrarWhats({ onEntrou, onCancelar }: { onEntrou: () => void; onCancelar: () => void }) {
  const [etapa, setEtapa] = useState<"tel" | "cod" | "contas" | "nome">("tel")
  const [tel, setTel] = useState("")
  const [cod, setCod] = useState(VAZIO)
  const [ticket, setTicket] = useState("")
  const [contas, setContas] = useState<Conta[]>([])
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)
  const [espera, setEspera] = useState(0)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { if (espera <= 0) return; const t = setTimeout(() => setEspera(e => e - 1), 1000); return () => clearTimeout(t) }, [espera])

  async function post(rota: string, corpo: object) {
    const r = await fetch(`/api/auth/whats/${rota}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) })
    return { ok: r.ok, j: await r.json().catch(() => ({})) }
  }
  async function entrarComToken(token: string) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: "magiclink" })
    if (error) { setErro("Não foi possível entrar. Tente de novo."); return }
    onEntrou()
  }

  async function enviar() {
    setErro(""); setCarregando(true)
    const { ok, j } = await post("enviar", { telefone: tel })
    setCarregando(false)
    if (!ok) return setErro(j.error ?? "Não foi possível enviar o código.")
    setCod(VAZIO); setEtapa("cod"); setEspera(30)
    setTimeout(() => refs.current[0]?.focus(), 50)
  }

  async function conferir(digitos: string[]) {
    setErro(""); setCarregando(true)
    const { ok, j } = await post("verificar", { telefone: tel, codigo: digitos.join("") })
    setCarregando(false)
    if (!ok) { setErro(j.error ?? "Código incorreto."); setCod(VAZIO); refs.current[0]?.focus(); return }
    if (j.token) return entrarComToken(j.token)
    setTicket(j.ticket)
    if (j.contas) { setContas(j.contas); setEtapa("contas") } else setEtapa("nome")
  }

  async function concluir(corpo: object) {
    setErro(""); setCarregando(true)
    const { ok, j } = await post("concluir", { telefone: tel, ticket, ...corpo })
    setCarregando(false)
    if (!ok) return setErro(j.error ?? "Não foi possível entrar.")
    await entrarComToken(j.token)
  }

  function digito(i: number, v: string) {
    const d = v.replace(/\D/g, "")
    // colar o código inteiro (ou preenchimento automático) num campo só
    if (d.length > 1) { const novo = d.slice(0, 6).split("").concat(VAZIO).slice(0, 6); setCod(novo); if (novo.every(Boolean)) conferir(novo); return }
    const novo = [...cod]; novo[i] = d; setCod(novo)
    if (d && i < 5) refs.current[i + 1]?.focus()
    if (novo.every(Boolean)) conferir(novo)
  }

  // Visual da proposta (telas 3, 4 e 5, revisado em 20/10/2026): tela cheia, barra de 3 passos,
  // título grande, caixas do código e botões do layout novo. Lógica igual à de antes.
  const titulo = { tel: "Qual é o seu WhatsApp?", cod: "Digite o código", contas: "Qual conta é sua?", nome: "Como podemos te chamar?" }[etapa]
  const passo = etapa === "tel" ? 1 : etapa === "cod" ? 2 : 3
  const voltar = () => { setErro(""); if (etapa === "tel") onCancelar(); else if (etapa === "cod") setEtapa("tel"); else setEtapa("cod") }
  return (
    <div className="cn whats-tela">
      <div className="topo branco" style={{ borderBottom: 0 }}>
        <div className="linha-topo"><button className="voltar" onClick={voltar} aria-label="Voltar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button></div>
      </div>
      <div className="whats-passos">{[1, 2, 3].map(n => <i key={n} className={n <= passo ? "on" : ""} />)}</div>
      <div className="whats-corpo">
        <h1 className="h1">{titulo}</h1>

        {etapa === "tel" && <>
          <p className="mut sub">Mandamos um código pra confirmar. Sem senha pra lembrar.</p>
          <label className="campo"><span>WhatsApp</span>
            <input inputMode="tel" autoComplete="tel" placeholder="(62) 90000-0000" value={tel} onChange={e => setTel(mascara(e.target.value))} autoFocus /></label>
          <button className="btn btn-p" disabled={tel.replace(/\D/g, "").length < 10 || carregando} onClick={enviar}>{carregando ? "Enviando…" : "Receber código"}</button>
          <p className="mut" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 14 }}>Ao continuar você concorda com os <a href="/termos" style={{ textDecoration: "underline" }}>Termos de uso</a> e a <a href="/termos#privacidade" style={{ textDecoration: "underline" }}>Política de privacidade</a> do Chegô.</p>
          <button className="link-verm" onClick={onCancelar}>Prefiro entrar com e-mail e senha</button>
        </>}

        {etapa === "cod" && <>
          <p className="mut sub">Mandamos um código de 6 números pro WhatsApp <b style={{ color: "var(--grafite)" }}>{tel}</b>.</p>
          <div className="codigo-caixas">
            {cod.map((c, i) => (
              <input key={i} ref={el => { refs.current[i] = el }} value={c} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={i === 0 ? 6 : 1} aria-label={`Dígito ${i + 1}`}
                className={erro ? "erro" : ""} onChange={e => digito(i, e.target.value)} onKeyDown={e => { if (e.key === "Backspace" && !cod[i] && i > 0) refs.current[i - 1]?.focus() }} />
            ))}
          </div>
          {carregando && <p className="mut" style={{ textAlign: "center", fontSize: 13 }}>Conferindo…</p>}
          <a className="btn btn-s" href="https://wa.me/" target="_blank" rel="noreferrer" style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={VERDE}><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" /></svg>Abrir o WhatsApp</a>
          <button className="link-verm" onClick={enviar} disabled={espera > 0 || carregando}>{espera > 0 ? `Reenviar código em ${espera}s` : "Reenviar código"}</button>
          <button className="link-cinza" onClick={() => { setEtapa("tel"); setErro("") }}>Trocar o número</button>
        </>}

        {etapa === "contas" && <>
          <p className="mut sub">Esse WhatsApp tem mais de uma conta no Chegô. Escolha em qual entrar.</p>
          {contas.map(c => (
            <button key={c.id} className="cartao" onClick={() => concluir({ clienteId: c.id })} disabled={carregando} style={{ textAlign: "left", padding: "12px 14px", marginBottom: 8, width: "100%" }}>
              <b style={{ color: "var(--grafite)", fontSize: 15 }}>{c.nome}</b>
              <span className="mut" style={{ display: "block", fontSize: 12.5 }}>{c.email ?? "conta pelo WhatsApp"}{c.desde ? ` · desde ${c.desde.split("-").reverse().join("/")}` : ""}</span>
            </button>
          ))}
        </>}

        {etapa === "nome" && <>
          <p className="mut sub">É o nome que a loja e o entregador vão ver.</p>
          <label className="campo"><span>Nome</span><input placeholder="Seu nome" value={nome} onChange={e => setNome(e.target.value)} autoFocus autoComplete="name" /></label>
          <label className="campo"><span>E-mail (opcional)</span><input placeholder="Pra receber o comprovante" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
          <button className="btn btn-p" disabled={nome.trim().length < 2 || carregando} onClick={() => concluir({ nome, email })}>{carregando ? "Criando conta…" : "Continuar"}</button>
        </>}

        {erro && <p role="alert" className="erro-linha" style={{ textAlign: "center", marginTop: 12 }}>{erro}</p>}
      </div>
    </div>
  )
}

export const BOTAO_WHATS_ESTILO: React.CSSProperties = {
  width: "100%", padding: "12px 16px", borderRadius: 12, border: "none", background: VERDE, color: "white",
  fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
}
