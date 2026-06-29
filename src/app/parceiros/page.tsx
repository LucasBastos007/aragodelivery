"use client"

import Link from "next/link"
import { useState } from "react"

// Fotos Unsplash (free, sem chave)
const FOTO_LOJA     = "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=700&q=85&fit=crop&auto=format"
const FOTO_MOTOBOY  = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&q=85&fit=crop&auto=format"
const FOTO_PRESENCA = "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=85&fit=crop&auto=format"
const FOTO_REPASSE  = "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&q=85&fit=crop&auto=format"
const FOTO_DASH     = "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=85&fit=crop&auto=format"
const FOTO_HORARIO  = "https://images.unsplash.com/photo-1484981138541-3d074aa97716?w=600&q=85&fit=crop&auto=format"
const FOTO_GANHO    = "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&q=85&fit=crop&auto=format"
const FOTO_REGIAO   = "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=600&q=85&fit=crop&auto=format"
const FOTO_APP      = "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&q=85&fit=crop&auto=format"

const STEPS_LOJA: { n: string; title: string; desc: string; detalhe: string }[] = [
  { n: "01", title: "Preencha o cadastro",  desc: "Dados da loja, responsável e chave PIX.", detalhe: "Preencha nome da loja, CNPJ ou CPF, endereço, telefone e sua chave PIX para receber repasses. Leva menos de 5 minutos e pode ser feito pelo celular." },
  { n: "02", title: "Análise da equipe",    desc: "Nossa equipe revisa em até 48h.",          detalhe: "Um de nossos atendentes analisa seus dados e entra em contato pelo WhatsApp para confirmar as informações e tirar dúvidas sobre o funcionamento da plataforma." },
  { n: "03", title: "Assine o contrato",    desc: "Contrato 100% digital pelo celular.",      detalhe: "Você recebe um link exclusivo por WhatsApp. Leia o contrato, assine digitalmente direto na tela e pronto — sem papel, sem cartório, sem sair de casa." },
  { n: "04", title: "Comece a vender",      desc: "Sua loja no app recebendo pedidos.",       detalhe: "Assim que ativado, sua loja aparece visível para todos os clientes do Chegô em Aragoiânia. Monte seu cardápio, ajuste os horários e comece a vender hoje mesmo." },
]

const STEPS_MOTOBOY: { n: string; title: string; desc: string; detalhe: string }[] = [
  { n: "01", title: "Faça seu cadastro",    desc: "Dados pessoais, veículo e chave PIX.",     detalhe: "Informe seu nome completo, CPF, modelo do veículo, placa e sua chave PIX. O processo é simples, sem burocracia e leva menos de 5 minutos." },
  { n: "02", title: "Análise da equipe",    desc: "Revisamos em até 48h via WhatsApp.",       detalhe: "Nossa equipe analisa seu cadastro e entra em contato pelo WhatsApp para confirmar os dados e explicar como funciona a plataforma de entregas." },
  { n: "03", title: "Assine o contrato",    desc: "Contrato 100% digital pelo celular.",      detalhe: "Receba o link do contrato por WhatsApp, leia com calma e assine digitalmente. Sem burocracia, sem cartório — tudo pelo celular em minutos." },
  { n: "04", title: "Comece a entregar",    desc: "Ative sua disponibilidade e ganhe.",       detalhe: "Baixe o app, ative sua disponibilidade e comece a receber pedidos na sua região. Você controla seus horários e aceita apenas as corridas que quiser." },
]

const BENEFICIOS_LOJA = [
  { foto: FOTO_PRESENCA, title: "Presença digital",   desc: "Sua loja visível para todos os clientes de Aragoiânia no app." },
  { foto: FOTO_REPASSE,  title: "Repasse rápido",     desc: "Receba via PIX em até 7 dias úteis após cada pedido entregue." },
  { foto: FOTO_DASH,     title: "Dashboard completo", desc: "Acompanhe pedidos, cardápio e financeiro em tempo real." },
]

const BENEFICIOS_MOTOBOY = [
  { foto: FOTO_HORARIO, title: "Horários livres",  desc: "Trabalhe quando quiser. Você controla sua própria disponibilidade." },
  { foto: FOTO_GANHO,   title: "Ganhe por entrega", desc: "Remuneração por corrida realizada, sem desconto ou taxa escondida." },
  { foto: FOTO_REGIAO,  title: "Região local",      desc: "Entregas em Aragoiânia. Perto de casa, sem grandes deslocamentos." },
  { foto: FOTO_APP,     title: "App simples",        desc: "Aceite ou recuse pedidos com um toque. Interface intuitiva." },
]

export default function ParceirosPage() {
  const [aba,       setAba]       = useState<"loja" | "motoboy">("loja")
  const [stepAtivo, setStepAtivo] = useState(0)

  const steps     = aba === "loja" ? STEPS_LOJA    : STEPS_MOTOBOY
  const beneficios = aba === "loja" ? BENEFICIOS_LOJA : BENEFICIOS_MOTOBOY

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "inherit" }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #e5e7eb",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto", padding: "0 28px",
          height: 68, display: "flex", alignItems: "center", gap: 16,
        }}>
          <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
            <img src="/logo-chego.png" alt="Chegô" style={{ height: 44, width: "auto", objectFit: "contain" }} />
          </Link>
          <div style={{ flex: 1, display: "flex", alignItems: "center", marginLeft: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#f97316", padding: "4px 10px", borderRadius: 6, background: "rgba(249,115,22,0.1)" }}>
              Portal de Parceiros
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/" style={{ color: "#6B7280", fontSize: 13, fontWeight: 600, textDecoration: "none", padding: "8px 14px", borderRadius: 10 }}>
              ← Voltar ao app
            </Link>
            <Link href="/entrar" style={{ padding: "9px 20px", borderRadius: 12, border: "1px solid rgba(249,115,22,0.3)", color: "#f97316", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              Já sou parceiro
            </Link>
            <Link href="/cadastro-loja" style={{ padding: "9px 20px", borderRadius: 12, background: "#f97316", color: "white", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              Começar agora
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{
        background: "linear-gradient(160deg, #fff7ed 0%, #ffedd5 40%, #f8fafc 100%)",
        padding: "80px 24px 90px",
        textAlign: "center",
        borderBottom: "1px solid #e5e7eb",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <p style={{ color: "#f97316", fontWeight: 700, fontSize: 12, letterSpacing: 3, textTransform: "uppercase", marginBottom: 20 }}>
            Chegô Parceiros · Aragoiânia, GO
          </p>
          <h1 style={{ color: "#111827", fontWeight: 900, fontSize: "clamp(34px, 5.5vw, 58px)", lineHeight: 1.1, marginBottom: 20 }}>
            Cresça com o delivery<br />
            <span style={{ color: "#f97316" }}>que é da sua cidade.</span>
          </h1>
          <p style={{ color: "#6B7280", fontSize: 17, lineHeight: 1.7, marginBottom: 56 }}>
            Conecte sua loja ou seus serviços de entrega ao Chegô.<br />
            Simples, rápido e com as menores taxas da região.
          </p>

          {/* CTAs com foto */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 620, margin: "0 auto" }}>

            {/* Loja */}
            <Link href="/cadastro-loja" style={{ textDecoration: "none" }}>
              <div
                style={{ borderRadius: 22, overflow: "hidden", background: "white", border: "1px solid #e5e7eb", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", cursor: "pointer", transition: "all 0.25s", textAlign: "left" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 20px 48px rgba(249,115,22,0.18)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)" }}>
                <div style={{ height: 180, overflow: "hidden" }}>
                  <img src={FOTO_LOJA} alt="Restaurante" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ padding: "20px 20px 22px" }}>
                  <p style={{ color: "#111827", fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Quero cadastrar minha loja</p>
                  <p style={{ color: "#6B7280", fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
                    Restaurante, mercadinho, farmácia ou qualquer comércio local
                  </p>
                  <span style={{ display: "inline-block", padding: "9px 18px", borderRadius: 10, background: "#f97316", color: "white", fontWeight: 700, fontSize: 13 }}>
                    Cadastrar loja →
                  </span>
                </div>
              </div>
            </Link>

            {/* Motoboy */}
            <Link href="/cadastro-motoboy" style={{ textDecoration: "none" }}>
              <div
                style={{ borderRadius: 22, overflow: "hidden", background: "white", border: "1px solid #e5e7eb", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", cursor: "pointer", transition: "all 0.25s", textAlign: "left" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 20px 48px rgba(34,197,94,0.18)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)" }}>
                <div style={{ height: 180, overflow: "hidden" }}>
                  <img src={FOTO_MOTOBOY} alt="Entregador" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ padding: "20px 20px 22px" }}>
                  <p style={{ color: "#111827", fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Quero ser entregador</p>
                  <p style={{ color: "#6B7280", fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
                    Trabalhe com liberdade, nos seus horários, perto de casa
                  </p>
                  <span style={{ display: "inline-block", padding: "9px 18px", borderRadius: 10, background: "#22c55e", color: "white", fontWeight: 700, fontSize: 13 }}>
                    Cadastrar agora →
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── CORPO ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 24px 80px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 56 }}>
          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 16, padding: 4, border: "1px solid #e5e7eb" }}>
            {([
              { id: "loja",    label: "Para lojas" },
              { id: "motoboy", label: "Para entregadores" },
            ] as const).map(({ id, label }) => (
              <button key={id} onClick={() => { setAba(id); setStepAtivo(0) }}
                style={{
                  padding: "12px 28px", borderRadius: 12, border: "none", cursor: "pointer",
                  background: aba === id ? "#f97316" : "transparent",
                  color: aba === id ? "white" : "#6B7280",
                  fontWeight: 700, fontSize: 14, transition: "all 0.2s",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── BENEFÍCIOS COM FOTO ── */}
        <div style={{ marginBottom: 88 }}>
          <h2 style={{ color: "#111827", fontWeight: 900, fontSize: 28, textAlign: "center", marginBottom: 8 }}>
            Por que se tornar parceiro?
          </h2>
          <p style={{ color: "#6B7280", fontSize: 15, textAlign: "center", marginBottom: 40 }}>
            {aba === "loja" ? "Vantagens exclusivas para lojas parceiras" : "Vantagens exclusivas para entregadores parceiros"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 18 }}>
            {beneficios.map((b, i) => (
              <div key={i} style={{
                background: "white", border: "1px solid #e5e7eb",
                borderRadius: 20, overflow: "hidden",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                transition: "box-shadow 0.2s, transform 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.1)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ height: 160, overflow: "hidden" }}>
                  <img src={b.foto} alt={b.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ padding: "20px 20px 22px" }}>
                  <p style={{ color: "#111827", fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{b.title}</p>
                  <p style={{ color: "#6B7280", fontSize: 13, lineHeight: 1.6 }}>{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── STEPPER INTERATIVO ── */}
        <div style={{ marginBottom: 88 }}>
          <h2 style={{ color: "#111827", fontWeight: 900, fontSize: 28, textAlign: "center", marginBottom: 8 }}>
            Como funciona?
          </h2>
          <p style={{ color: "#6B7280", fontSize: 15, textAlign: "center", marginBottom: 48 }}>
            Clique em cada etapa para saber mais
          </p>

          {/* Progress bar */}
          <div style={{ position: "relative", marginBottom: 32 }}>
            {/* Linha de fundo */}
            <div style={{ position: "absolute", top: 22, left: "12.5%", right: "12.5%", height: 3, background: "#e5e7eb", borderRadius: 2 }} />
            {/* Linha de progresso */}
            <div style={{
              position: "absolute", top: 22, left: "12.5%", height: 3, background: "#f97316", borderRadius: 2,
              width: `${(stepAtivo / (steps.length - 1)) * 75}%`,
              transition: "width 0.4s ease",
            }} />

            {/* Círculos dos passos */}
            <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}
                  onClick={() => setStepAtivo(i)}>
                  <div style={{
                    width: 46, height: 46, borderRadius: "50%",
                    background: i <= stepAtivo ? "#f97316" : "white",
                    border: `3px solid ${i <= stepAtivo ? "#f97316" : "#e5e7eb"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.3s",
                    boxShadow: i === stepAtivo ? "0 0 0 6px rgba(249,115,22,0.15)" : "none",
                  }}>
                    {i < stepAtivo ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <span style={{ color: i <= stepAtivo ? "white" : "#9CA3AF", fontWeight: 900, fontSize: 15 }}>{i + 1}</span>
                    )}
                  </div>
                  <p style={{
                    color: i === stepAtivo ? "#f97316" : i < stepAtivo ? "#111827" : "#9CA3AF",
                    fontWeight: i === stepAtivo ? 800 : 600, fontSize: 12, textAlign: "center",
                    maxWidth: 90, lineHeight: 1.3, transition: "color 0.3s",
                  }}>
                    {s.title}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Painel do step ativo */}
          <div style={{
            background: "white", border: "1.5px solid #e5e7eb", borderRadius: 20,
            padding: "32px 36px", boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
            transition: "all 0.3s",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
                background: "rgba(249,115,22,0.1)", border: "2px solid rgba(249,115,22,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ color: "#f97316", fontWeight: 900, fontSize: 22 }}>{stepAtivo + 1}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: "#f97316", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                  Passo {steps[stepAtivo].n}
                </p>
                <p style={{ color: "#111827", fontWeight: 900, fontSize: 20, marginBottom: 10 }}>{steps[stepAtivo].title}</p>
                <p style={{ color: "#6B7280", fontSize: 15, lineHeight: 1.7 }}>{steps[stepAtivo].detalhe}</p>
              </div>
            </div>

            {/* Navegação entre steps */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, paddingTop: 20, borderTop: "1px solid #f3f4f6" }}>
              <button
                onClick={() => setStepAtivo(s => Math.max(0, s - 1))}
                disabled={stepAtivo === 0}
                style={{
                  padding: "9px 20px", borderRadius: 10,
                  border: "1px solid #e5e7eb", background: stepAtivo === 0 ? "transparent" : "white",
                  color: stepAtivo === 0 ? "#D1D5DB" : "#374151",
                  fontWeight: 700, fontSize: 13, cursor: stepAtivo === 0 ? "not-allowed" : "pointer",
                }}>
                ← Anterior
              </button>

              <div style={{ display: "flex", gap: 6 }}>
                {steps.map((_, i) => (
                  <div key={i} onClick={() => setStepAtivo(i)} style={{
                    width: i === stepAtivo ? 24 : 8, height: 8, borderRadius: 4,
                    background: i === stepAtivo ? "#f97316" : i < stepAtivo ? "rgba(249,115,22,0.3)" : "#e5e7eb",
                    cursor: "pointer", transition: "all 0.3s",
                  }} />
                ))}
              </div>

              {stepAtivo < steps.length - 1 ? (
                <button
                  onClick={() => setStepAtivo(s => Math.min(steps.length - 1, s + 1))}
                  style={{
                    padding: "9px 20px", borderRadius: 10, border: "none",
                    background: "#f97316", color: "white",
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}>
                  Próximo →
                </button>
              ) : (
                <Link href={aba === "loja" ? "/cadastro-loja" : "/cadastro-motoboy"} style={{
                  padding: "9px 20px", borderRadius: 10, border: "none",
                  background: "#22c55e", color: "white",
                  fontWeight: 700, fontSize: 13, textDecoration: "none", display: "inline-block",
                }}>
                  Começar agora →
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── CTA FINAL ── */}
        <div style={{
          background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
          border: "1px solid rgba(249,115,22,0.2)",
          borderRadius: 28, padding: "56px 40px", textAlign: "center",
        }}>
          <h2 style={{ color: "#111827", fontWeight: 900, fontSize: 32, marginBottom: 12 }}>
            Pronto para começar?
          </h2>
          <p style={{ color: "#6B7280", fontSize: 16, lineHeight: 1.7, marginBottom: 40 }}>
            Faça seu cadastro agora. Nossa equipe analisa em até 48h<br />e entra em contato pelo WhatsApp.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/cadastro-loja" style={{
              padding: "15px 36px", borderRadius: 14,
              background: "#f97316", color: "white", fontWeight: 800, fontSize: 16, textDecoration: "none",
            }}>
              Cadastrar minha loja
            </Link>
            <Link href="/cadastro-motoboy" style={{
              padding: "15px 36px", borderRadius: 14,
              background: "white", border: "1px solid #e5e7eb",
              color: "#374151", fontWeight: 800, fontSize: 16, textDecoration: "none",
            }}>
              Quero ser entregador
            </Link>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: "1px solid #e5e7eb", textAlign: "center" }}>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <Link href="/entrar" style={{ color: "#9CA3AF", fontSize: 13, textDecoration: "none", fontWeight: 500, padding: "8px 14px", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              Acessar meu painel
            </Link>
            <Link href="/" style={{ color: "#9CA3AF", fontSize: 13, textDecoration: "none", fontWeight: 500, padding: "8px 14px", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              Ver o app de pedidos
            </Link>
          </div>
          <p style={{ color: "#D1D5DB", fontSize: 12 }}>
            © 2026 Chegô Delivery · Aragoiânia, GO · Instagram{" "}
            <a href="https://instagram.com/ChegoAragyn" target="_blank" rel="noopener noreferrer" style={{ color: "#f97316", textDecoration: "none" }}>
              @ChegoAragyn
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
