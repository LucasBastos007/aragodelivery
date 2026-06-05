"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

const ADMIN_EMAIL = "admin@arago.com"
const ADMIN_SENHA = "arago2024"

type Role = "lojista" | "motoboy" | "admin"

const ROLES: { value: Role; label: string }[] = [
  { value: "lojista",  label: "🏪 Lojista" },
  { value: "motoboy",  label: "🏍️ Motoboy" },
  { value: "admin",    label: "⚙️ Admin" },
]

export default function EntrarPage() {
  const router = useRouter()
  const { login } = useAuth()

  const [role, setRole] = useState<Role>("lojista")
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState("")

  async function entrar() {
    if (!email.trim() || !senha.trim()) { setErro("Preencha email e senha."); return }
    setErro("")
    setLoading(true)

    if (role === "admin") {
      if (email.trim() === ADMIN_EMAIL && senha === ADMIN_SENHA) {
        login({ role: "admin" })
        router.push("/admin")
      } else {
        setErro("Credenciais de administrador inválidas.")
      }
      setLoading(false)
      return
    }

    if (role === "lojista") {
      const { data, error } = await supabase
        .from("lojas")
        .select("id, nome, status, email, senha")
        .eq("email", email.trim().toLowerCase())
        .single()

      if (error || !data) { setErro("Email não encontrado."); setLoading(false); return }
      if (data.senha !== senha) { setErro("Senha incorreta."); setLoading(false); return }
      if (data.status === "pendente") {
        setErro("Cadastro aguardando aprovação. Entraremos em contato em breve.")
        setLoading(false); return
      }
      if (data.status === "suspenso") {
        setErro("Esta conta foi suspensa. Entre em contato com o suporte.")
        setLoading(false); return
      }
      login({ role: "lojista", loja_id: data.id, loja_nome: data.nome })
      router.push("/loja")
      setLoading(false)
      return
    }

    if (role === "motoboy") {
      const { data, error } = await supabase
        .from("motoboys")
        .select("id, nome, status, email, senha")
        .eq("email", email.trim().toLowerCase())
        .single()

      // Coluna senha pode ainda não existir no banco (schema antigo)
      if (error && (error as any).code === "PGRST204") {
        const { data: d2, error: e2 } = await supabase
          .from("motoboys")
          .select("id, nome, status, email")
          .eq("email", email.trim().toLowerCase())
          .single()
        if (e2 || !d2) { setErro("Email não encontrado."); setLoading(false); return }
        if (d2.status === "pendente") { setErro("Cadastro aguardando aprovação."); setLoading(false); return }
        login({ role: "motoboy", motoboy_id: d2.id, motoboy_nome: d2.nome })
        router.push("/motoboy")
        setLoading(false)
        return
      }

      if (error || !data) { setErro("Email não encontrado."); setLoading(false); return }
      if (data.senha && data.senha !== senha) { setErro("Senha incorreta."); setLoading(false); return }
      if (data.status === "pendente") {
        setErro("Cadastro aguardando aprovação. Entraremos em contato em breve.")
        setLoading(false); return
      }
      if (data.status === "suspenso") {
        setErro("Esta conta foi suspensa. Entre em contato com o suporte.")
        setLoading(false); return
      }
      login({ role: "motoboy", motoboy_id: data.id, motoboy_nome: data.nome })
      router.push("/motoboy")
      setLoading(false)
      return
    }
  }

  const cadastroLink = role === "lojista"
    ? { href: "/cadastro-loja", label: "Cadastre sua loja" }
    : role === "motoboy"
    ? { href: "/cadastro-motoboy", label: "Quero ser motoboy" }
    : null

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <p style={{ fontSize: 36, marginBottom: 8 }}>🛵</p>
          <p style={{ color: "#f97316", fontWeight: 900, fontSize: 22 }}>Arago Delivery</p>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 4 }}>Área de parceiros</p>
        </div>

        <div style={{ background: "#111", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", padding: 28 }}>
          {/* Role toggle */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4, marginBottom: 24, gap: 2 }}>
            {ROLES.map(r => (
              <button key={r.value} onClick={() => { setRole(r.value); setErro("") }} style={{
                flex: 1, padding: "8px 6px", borderRadius: 9, border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 12, transition: "all 0.15s",
                background: role === r.value ? "#f97316" : "transparent",
                color: role === r.value ? "white" : "rgba(255,255,255,0.4)",
              }}>
                {r.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Email</label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && entrar()}
                placeholder={role === "admin" ? "admin@arago.com" : "seu@email.com"}
                autoComplete="email"
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 14,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "white", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Senha</label>
              <input
                type="password" value={senha}
                onChange={e => setSenha(e.target.value)}
                onKeyDown={e => e.key === "Enter" && entrar()}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 14,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "white", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {erro && (
              <p style={{ color: "#f87171", fontSize: 13, fontWeight: 500, padding: "10px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.15)" }}>
                {erro}
              </p>
            )}

            <button onClick={entrar} disabled={loading} style={{
              width: "100%", padding: "13px", borderRadius: 12, border: "none",
              background: loading ? "rgba(249,115,22,0.4)" : "#f97316",
              color: "white", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
              marginTop: 4,
            }}>
              {loading ? "Entrando..." : "Entrar →"}
            </button>
          </div>

          {cadastroLink && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
                Ainda não tem conta?{" "}
                <Link href={cadastroLink.href} style={{ color: "#f97316", fontWeight: 700 }}>
                  {cadastroLink.label}
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
