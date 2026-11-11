"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function MotoboyPerfilPage() {
  const { sessao, logout } = useAuth()
  const router = useRouter()
  const [nota, setNota] = useState<{ media: number | null; total: number }>({ media: null, total: 0 })
  const [entregas, setEntregas] = useState(0)
  const [dadosAbertos, setDadosAbertos] = useState(false)
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null

  const [loading,   setLoading]   = useState(true)
  const [salvando,  setSalvando]  = useState(false)
  const [sucesso,   setSucesso]   = useState(false)
  const [erro,      setErro]      = useState("")
  const [foto,      setFoto]      = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    nome:      "",
    email:     "",
    telefone:  "",
    cpf:       "",
    pix_key: "",
  })

  useEffect(() => {
    if (!motoboy_id) return
    supabase.from("motoboys").select("nome, email, telefone, cpf, pix_key, foto").eq("id", motoboy_id).single()
      .then(({ data }) => {
        if (data) {
          setForm({
            nome:      data.nome      ?? "",
            email:     data.email     ?? "",
            telefone:  data.telefone  ?? "",
            cpf:       data.cpf       ?? "",
            pix_key: data.pix_key ?? "",
          })
          setFoto(data.foto ?? null)
        }
        setLoading(false)
      })
    // Nota e total de entregas (mesmas consultas do menu antigo do topo)
    supabase.from("motoboys").select("nota_media, total_avaliacoes").eq("id", motoboy_id).single()
      .then(({ data }) => { if (data) setNota({ media: (data as any).nota_media ?? null, total: (data as any).total_avaliacoes ?? 0 }) })
    supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("motoboy_id", motoboy_id).eq("status", "entregue")
      .then(({ count }) => setEntregas(count ?? 0))
  }, [motoboy_id])

  // Pedido explícito do usuário, 2026-09-17: "não salva nada, nem a foto" — o problema
  // era escrever direto do navegador com a chave anon (esse app não usa Supabase Auth,
  // então RLS na tabela motoboys/bucket rejeitava o update/upload silenciosamente, sem
  // nem cair em erro visível). Agora passa pelas rotas server-side com admin client,
  // mesmo padrão já usado em /api/motoboy/status.
  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !motoboy_id) return
    setUploading(true)
    setErro("")
    const form = new FormData()
    form.append("file", file)
    const res = await fetch("/api/motoboy/foto", { method: "POST", body: form })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(json.error ?? "Erro ao enviar a foto"); setUploading(false); return }
    setFoto(json.url)
    setUploading(false)
  }

  async function salvar() {
    if (!motoboy_id) return
    setSalvando(true)
    setErro("")
    const res = await fetch("/api/motoboy/perfil", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: form.nome, telefone: form.telefone, pix_key: form.pix_key }),
    })
    const json = await res.json().catch(() => ({}))
    setSalvando(false)
    if (!res.ok) { setErro(json.error ?? "Erro ao salvar"); return }
    setSucesso(true)
    setTimeout(() => setSucesso(false), 2500)
  }

  if (loading) return <div style={{ padding: 32 }}><p className="mut">Carregando…</p></div>

  const iniciais = form.nome.trim().split(/\s+/).map(x => x[0]).slice(0, 2).join("").toUpperCase()

  return (
    <div className="mb-pagina">
      <div className="mb-cartao" style={{ display: "flex", gap: 14, alignItems: "center", boxShadow: "var(--sombra)", border: 0 }}>
        <button onClick={() => inputRef.current?.click()} aria-label="Trocar foto" style={{ position: "relative", width: 68, height: 68, borderRadius: "50%", border: 0, padding: 0, background: "var(--pimenta)", color: "#fff", fontFamily: "var(--display)", fontWeight: 800, fontSize: 24, overflow: "hidden", flex: "none" }}>
          {foto ? <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : iniciais || "?"}
          <span style={{ position: "absolute", right: 0, bottom: 0, width: 24, height: 24, borderRadius: "50%", background: "#fff", color: "var(--grafite)", display: "grid", placeItems: "center", fontSize: 12, boxShadow: "var(--sombra)" }}>📷</span>
        </button>
        <input ref={inputRef} type="file" accept="image/*" capture="user" onChange={handleFoto} style={{ display: "none" }} />
        <span style={{ minWidth: 0 }}>
          <b className="t20" style={{ display: "block" }}>{form.nome || "Entregador"}</b>
          <span className="mut" style={{ fontSize: 13.5 }}>{uploading ? "Enviando foto…" : `${entregas} ${entregas === 1 ? "entrega" : "entregas"}`}</span>
          <b style={{ display: "block", color: "var(--pimenta)", fontSize: 14 }}>★ {nota.media != null ? nota.media.toFixed(1).replace(".", ",") : "sem nota"}{nota.total ? `, ${nota.total} avaliações` : ""}</b>
        </span>
      </div>

      <div className="mb-menu">
        <button className="seta" onClick={() => setDadosAbertos(a => !a)} aria-expanded={dadosAbertos}><span className="ic">👤</span><span><b>Meus dados</b><small>Nome, telefone e foto</small></span></button>
        {dadosAbertos && (
          <div style={{ padding: "6px 16px 16px", display: "flex", flexDirection: "column", gap: 12, borderBottom: "1px solid var(--linha)" }}>
            {[
              { key: "nome",     label: "Nome completo", placeholder: "Seu nome" },
              { key: "email",    label: "E-mail",        placeholder: "email@exemplo.com", disabled: true },
              { key: "telefone", label: "Telefone",      placeholder: "(62) 9 0000-0000" },
              { key: "cpf",      label: "CPF",           placeholder: "000.000.000-00",   disabled: true },
            ].map(({ key, label, placeholder, disabled }) => (
              <label key={key} className="mb-campo"><span>{label}</span>
                <input value={(form as any)[key]} onChange={e => !disabled && setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} disabled={disabled} style={{ opacity: disabled ? .55 : 1 }} />
              </label>
            ))}
            <p className="mut" style={{ fontSize: 12.5 }}>A chave Pix fica na tela de Ganhos.</p>
            <button className="mb-btn verm peq" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar alterações"}</button>
            {erro && <p style={{ color: "var(--pimenta)", fontSize: 13.5, fontWeight: 700 }}>{erro}</p>}
          </div>
        )}
        <Link href="/motoboy/financeiro"><span className="ic">💸</span><span><b>Ganhos e chave Pix</b><small>Saldo, saque e dados do banco</small></span></Link>
        <Link href="/motoboy/dashboard"><span className="ic">📊</span><span><b>Painel</b><small>Seus números da semana</small></span></Link>
        <Link href="/motoboy/pedidos"><span className="ic">🧾</span><span><b>Pedidos</b><small>Em preparo nas lojas</small></span></Link>
        <Link href="/motoboy/caixa"><span className="ic">💵</span><span><b>Dinheiro em mãos</b><small>Declarar o caixa do dia</small></span></Link>
      </div>

      <div className="mb-menu">
        <a href={`https://wa.me/5562985845621?text=${encodeURIComponent("Olá! Sou entregador do Chegô e preciso de ajuda.")}`} target="_blank" rel="noreferrer"><span className="ic">💬</span><span><b>Falar com o suporte</b><small>Pelo WhatsApp</small></span></a>
        <button onClick={() => { logout(); router.push("/entrar/motoboy") }}><span className="ic">↪</span><span><b style={{ color: "var(--pimenta)" }}>Sair da conta</b></span></button>
      </div>

      {sucesso && <div className="mb-toast" style={{ position: "fixed", bottom: "calc(var(--nav-h) + 16px)", background: "var(--folha)", textAlign: "center" }}>Dados salvos</div>}
    </div>
  )
}
