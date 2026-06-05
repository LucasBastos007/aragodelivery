"use client"

import Link from "next/link"
import { useState } from "react"

const STEPS_LOJA = [
  { n: "01", title: "Preencha o cadastro", desc: "Dados da loja, responsável e chave PIX. Leva menos de 5 minutos." },
  { n: "02", title: "Análise da equipe",   desc: "Nossa equipe revisa seu cadastro em até 48h e entra em contato." },
  { n: "03", title: "Assine o contrato",   desc: "Receba o link do contrato digital e assine pelo celular." },
  { n: "04", title: "Comece a vender",     desc: "Sua loja aparece no app e você começa a receber pedidos." },
]

const STEPS_MOTOBOY = [
  { n: "01", title: "Faça seu cadastro",   desc: "Dados pessoais, veículo e chave PIX. Rápido e sem burocracia." },
  { n: "02", title: "Análise da equipe",   desc: "Nossa equipe revisa em até 48h e entra em contato pelo WhatsApp." },
  { n: "03", title: "Assine o contrato",   desc: "Receba o link do contrato digital e assine pelo celular." },
  { n: "04", title: "Comece a entregar",   desc: "Ative sua disponibilidade no app e receba pedidos na sua região." },
]

const BENEFICIOS_LOJA = [
  { icon: "📱", title: "Presença digital",    desc: "Sua loja visível para todos os clientes de Aragoiânia no app." },
  { icon: "💰", title: "Comissão de só 10%",  desc: "Uma das menores taxas do mercado. Você fica com 90% de cada venda." },
  { icon: "⚡", title: "Repasse rápido",      desc: "Receba via PIX em até 7 dias úteis após cada pedido entregue." },
  { icon: "📊", title: "Dashboard completo",  desc: "Acompanhe pedidos, cardápio e financeiro em tempo real." },
]

const BENEFICIOS_MOTOBOY = [
  { icon: "🕐", title: "Horários livres",     desc: "Trabalhe quando quiser. Você controla sua própria disponibilidade." },
  { icon: "💸", title: "Ganhe por entrega",   desc: "Remuneração por corrida realizada, sem desconto ou taxa." },
  { icon: "📍", title: "Região local",        desc: "Entregas em Aragoiânia. Perto de casa, sem grandes deslocamentos." },
  { icon: "📱", title: "App simples",         desc: "Aceite ou recuse pedidos com um toque. Interface intuitiva." },
]

export default function ParceirosPage() {
  const [aba, setAba] = useState<"loja" | "motoboy">("loja")

  const steps    = aba === "loja" ? STEPS_LOJA    : STEPS_MOTOBOY
  const beneficios = aba === "loja" ? BENEFICIOS_LOJA : BENEFICIOS_MOTOBOY

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "inherit" }}>

      {/* ── NAVBAR ─────────────────────────────────────────── */}
      <nav style={{
        background: "rgba(10,10,10,0.97)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto", padding: "0 28px",
          height: 68, display: "flex", alignItems: "center", gap: 16,
        }}>
          <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
            <img src="/logo-chego.jpg" alt="Chegô" style={{ height: 48, width: "auto", borderRadius: 10, objectFit: "contain" }} />
          </Link>

          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 4,
            marginLeft: 8,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#f97316", padding: "4px 10px", borderRadius: 6, background: "rgba(249,115,22,0.1)" }}>
              Portal de Parceiros
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/" style={{
              color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600,
              textDecoration: "none", padding: "8px 14px", borderRadius: 10,
            }}>
              ← Voltar ao app
            </Link>
            <Link href="/entrar" style={{
              padding: "9px 20px", borderRadius: 12,
              border: "1px solid rgba(249,115,22,0.3)",
              color: "#f97316", fontWeight: 700, fontSize: 13, textDecoration: "none",
            }}>
              Já sou parceiro
            </Link>
            <Link href="/cadastro-loja" style={{
              padding: "9px 20px", borderRadius: 12,
              background: "#f97316", color: "white",
              fontWeight: 700, fontSize: 13, textDecoration: "none",
            }}>
              Começar agora
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(160deg, #0d0500 0%, #120800 40%, #0a0a0a 100%)",
        padding: "88px 24px 96px",
        textAlign: "center",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ color: "#f97316", fontWeight: 700, fontSize: 12, letterSpacing: 3, textTransform: "uppercase", marginBottom: 20 }}>
            🤝 Chegô Parceiros · Aragoiânia, GO
          </p>
          <h1 style={{
            color: "white", fontWeight: 900,
            fontSize: "clamp(36px, 6vw, 60px)",
            lineHeight: 1.1, marginBottom: 20,
          }}>
            Cresça com o delivery<br />
            <span style={{ color: "#f97316" }}>que é da sua cidade.</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 17, lineHeight: 1.7, marginBottom: 52 }}>
            Conecte sua loja ou seus serviços de entrega ao Chegô.<br />
            Simples, rápido e com as menores taxas da região.
          </p>

          {/* Dois CTAs grandes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 580, margin: "0 auto" }}>
            <Link href="/cadastro-loja" style={{ textDecoration: "none" }}>
              <div style={{
                borderRadius: 20, padding: "28px 24px",
                background: "linear-gradient(135deg, #3d0d00 0%, #7c1d06 100%)",
                border: "1px solid rgba(249,115,22,0.2)",
                cursor: "pointer", transition: "all 0.2s",
                textAlign: "left",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(249,115,22,0.2)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "" }}>
                <p style={{ fontSize: 36, marginBottom: 12 }}>🏪</p>
                <p style={{ color: "white", fontWeight: 900, fontSize: 20, marginBottom: 6 }}>Quero cadastrar minha loja</p>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
                  Restaurante, mercadinho, farmácia ou qualquer comércio local
                </p>
                <span style={{
                  display: "inline-block", padding: "8px 16px", borderRadius: 10,
                  background: "#f97316", color: "white", fontWeight: 700, fontSize: 13,
                }}>
                  Cadastrar loja →
                </span>
              </div>
            </Link>

            <Link href="/cadastro-motoboy" style={{ textDecoration: "none" }}>
              <div style={{
                borderRadius: 20, padding: "28px 24px",
                background: "linear-gradient(135deg, #022510 0%, #053d1e 100%)",
                border: "1px solid rgba(34,197,94,0.15)",
                cursor: "pointer", transition: "all 0.2s",
                textAlign: "left",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(34,197,94,0.15)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "" }}>
                <p style={{ fontSize: 36, marginBottom: 12 }}>🛵</p>
                <p style={{ color: "white", fontWeight: 900, fontSize: 20, marginBottom: 6 }}>Quero ser entregador</p>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
                  Trabalhe com liberdade, nos seus horários, perto de casa
                </p>
                <span style={{
                  display: "inline-block", padding: "8px 16px", borderRadius: 10,
                  background: "#22c55e", color: "white", fontWeight: 700, fontSize: 13,
                }}>
                  Cadastrar agora →
                </span>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── NÚMEROS ────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0d0d0d" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 }}>
          {[
            { valor: "10%",    label: "de comissão por pedido",  sub: "das menores taxas" },
            { valor: "48h",    label: "para análise do cadastro", sub: "processo rápido" },
            { valor: "100%",   label: "digital",                 sub: "contrato e gestão online" },
          ].map((item, i) => (
            <div key={i} style={{
              textAlign: "center", padding: "24px",
              borderRight: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none",
            }}>
              <p style={{ color: "#f97316", fontWeight: 900, fontSize: 40, lineHeight: 1 }}>{item.valor}</p>
              <p style={{ color: "white", fontWeight: 700, fontSize: 15, marginTop: 8 }}>{item.label}</p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 4 }}>{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 24px 80px" }}>

        {/* ── TABS LOJA / MOTOBOY ─────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 56 }}>
          <div style={{ display: "flex", background: "#111", borderRadius: 16, padding: 4, border: "1px solid rgba(255,255,255,0.06)" }}>
            {([
              { id: "loja",    label: "🏪 Para lojas"       },
              { id: "motoboy", label: "🛵 Para entregadores" },
            ] as const).map(({ id, label }) => (
              <button key={id} onClick={() => setAba(id)}
                style={{
                  padding: "12px 28px", borderRadius: 12, border: "none", cursor: "pointer",
                  background: aba === id ? "#f97316" : "transparent",
                  color: aba === id ? "white" : "rgba(255,255,255,0.35)",
                  fontWeight: 700, fontSize: 14, transition: "all 0.2s",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── BENEFÍCIOS ──────────────────────────────────── */}
        <div style={{ marginBottom: 80 }}>
          <h2 style={{ color: "white", fontWeight: 900, fontSize: 28, textAlign: "center", marginBottom: 8 }}>
            Por que se tornar parceiro?
          </h2>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 15, textAlign: "center", marginBottom: 40 }}>
            {aba === "loja" ? "Vantagens exclusivas para lojas parceiras" : "Vantagens exclusivas para entregadores parceiros"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {beneficios.map((b, i) => (
              <div key={i} style={{
                background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 18, padding: "28px 24px",
              }}>
                <p style={{ fontSize: 36, marginBottom: 14 }}>{b.icon}</p>
                <p style={{ color: "white", fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{b.title}</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── COMO FUNCIONA ───────────────────────────────── */}
        <div style={{ marginBottom: 80 }}>
          <h2 style={{ color: "white", fontWeight: 900, fontSize: 28, textAlign: "center", marginBottom: 8 }}>
            Como funciona?
          </h2>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 15, textAlign: "center", marginBottom: 48 }}>
            4 passos simples para começar
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ position: "relative" }}>
                {/* Linha conectora */}
                {i < steps.length - 1 && (
                  <div style={{
                    position: "absolute", top: 28, left: "calc(100% - 8px)", width: "16px", height: 2,
                    background: "rgba(249,115,22,0.2)", zIndex: 1,
                    display: "none",
                  }} />
                )}
                <div style={{
                  background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 18, padding: "28px 24px",
                }}>
                  <p style={{
                    color: "#f97316", fontWeight: 900, fontSize: 32, lineHeight: 1,
                    marginBottom: 16, opacity: 0.6,
                  }}>
                    {s.n}
                  </p>
                  <p style={{ color: "white", fontWeight: 800, fontSize: 15, marginBottom: 8 }}>{s.title}</p>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA FINAL ───────────────────────────────────── */}
        <div style={{
          background: "linear-gradient(135deg, #1c0800 0%, #0f0400 100%)",
          border: "1px solid rgba(249,115,22,0.15)",
          borderRadius: 28, padding: "56px 40px", textAlign: "center",
        }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>🚀</p>
          <h2 style={{ color: "white", fontWeight: 900, fontSize: 32, marginBottom: 12 }}>
            Pronto para começar?
          </h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, lineHeight: 1.7, marginBottom: 40 }}>
            Faça seu cadastro agora. Nossa equipe analisa em até 48h<br />e entra em contato pelo WhatsApp.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/cadastro-loja" style={{
              padding: "16px 36px", borderRadius: 14,
              background: "#f97316", color: "white",
              fontWeight: 800, fontSize: 16, textDecoration: "none",
            }}>
              🏪 Cadastrar minha loja
            </Link>
            <Link href="/cadastro-motoboy" style={{
              padding: "16px 36px", borderRadius: 14,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "white", fontWeight: 800, fontSize: 16, textDecoration: "none",
            }}>
              🛵 Quero ser entregador
            </Link>
          </div>
        </div>

        {/* ── FOOTER ─────────────────────────────────────── */}
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <Link href="/entrar" style={{
              color: "rgba(255,255,255,0.25)", fontSize: 13, textDecoration: "none",
              fontWeight: 500, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)",
            }}>
              🔐 Acessar meu painel
            </Link>
            <Link href="/" style={{
              color: "rgba(255,255,255,0.25)", fontSize: 13, textDecoration: "none",
              fontWeight: 500, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)",
            }}>
              🛵 Ver o app de pedidos
            </Link>
          </div>
          <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>
            © 2026 Chegô Delivery · Aragoiânia, GO · Instagram{" "}
            <a href="https://instagram.com/ChegoAragyn" target="_blank" rel="noopener noreferrer"
              style={{ color: "#f97316", textDecoration: "none" }}>@ChegoAragyn</a>
          </p>
        </div>
      </div>
    </div>
  )
}
