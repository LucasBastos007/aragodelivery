"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { Loja } from "@/types"

export default function ContratoLojaPage() {
  const { token } = useParams<{ token: string }>()
  const [loja, setLoja] = useState<Loja | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState("")
  const [assinado, setAssinado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [temAssinatura, setTemAssinatura] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("lojas")
        .select("*")
        .eq("contrato_token", token)
        .single()
      if (error || !data) { setErro("Link inválido ou expirado."); setLoading(false); return }
      if (data.contrato_assinado) { setAssinado(true) }
      setLoja(data)
      setLoading(false)
    }
    load()
  }, [token])

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    ctx.strokeStyle = "#111827"
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }, [loja])

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    drawing.current = true
    lastPos.current = getPos(e, canvas)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    const ctx = canvas.getContext("2d")!
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
    setTemAssinatura(true)
  }

  function stopDraw() {
    drawing.current = false
  }

  function limpar() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height)
    setTemAssinatura(false)
  }

  async function assinar() {
    const canvas = canvasRef.current
    if (!canvas || !loja) return
    const assinatura = canvas.toDataURL("image/png")
    setSalvando(true)
    const { error } = await supabase.from("lojas").update({
      contrato_assinatura: assinatura,
      contrato_assinado: true,
      contrato_assinado_em: new Date().toISOString(),
      status: "contrato_assinado",
    }).eq("id", loja.id)
    setSalvando(false)
    if (error) { alert("Erro ao salvar assinatura. Tente novamente."); return }
    setAssinado(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8fafc" }}>
        <p style={{ color: "#9CA3AF" }}>Carregando contrato...</p>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#f8fafc" }}>
        <div className="card p-8 text-center max-w-sm w-full">
          <p className="text-4xl mb-4">❌</p>
          <h2 className="text-xl font-black mb-2" style={{ color: "#111827" }}>Link inválido</h2>
          <p className="text-sm" style={{ color: "#6B7280" }}>{erro}</p>
        </div>
      </div>
    )
  }

  if (assinado) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#f8fafc" }}>
        <div className="card p-8 text-center max-w-sm w-full">
          <p className="text-5xl mb-4">✅</p>
          <h2 className="text-xl font-black mb-2" style={{ color: "#111827" }}>Contrato assinado!</h2>
          <p className="text-sm mb-2" style={{ color: "#374151" }}>
            Sua assinatura foi registrada com sucesso.
          </p>
          <p className="text-sm mb-6" style={{ color: "#9CA3AF" }}>
            Nossa equipe ativará sua loja em breve. Você receberá um contato no WhatsApp informado.
          </p>
          <a href="/" className="btn-ghost w-full justify-center">Voltar ao início</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 flex flex-col items-center" style={{ background: "#f8fafc" }}>
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <img src="/logo-chego.jpg" alt="Chegô" style={{ height: 48, width: "auto", borderRadius: 12, objectFit: "contain", margin: "0 auto 16px" }} />
          <h1 className="text-2xl font-black" style={{ color: "#111827" }}>Contrato de Parceria — Loja</h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            Leia com atenção e assine abaixo para confirmar.
          </p>
        </div>

        {/* Dados da loja */}
        <div style={{ background: "#ffffff", borderRadius: 14, padding: "16px", marginBottom: 24, border: "1px solid #e5e7eb" }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#9CA3AF" }}>Dados da loja</p>
          <p className="font-black text-lg" style={{ color: "#111827" }}>{loja!.nome}</p>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>{loja!.categoria} · {loja!.endereco}</p>
          {loja!.nome_responsavel && <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>Responsável: {loja!.nome_responsavel}</p>}
          {loja!.cnpj && <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>CNPJ: {loja!.cnpj}</p>}
          {(loja! as any).cpf_responsavel && <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>CPF: {(loja! as any).cpf_responsavel}</p>}
        </div>

        {/* Texto do contrato */}
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "24px", marginBottom: 24 }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#9CA3AF" }}>Termos e condições</p>
          <div className="text-sm leading-relaxed flex flex-col gap-3" style={{ color: "#374151" }}>
            <p><strong style={{ color: "#111827" }}>1. Objeto</strong> — Este contrato estabelece os termos de parceria entre a plataforma Chegô Delivery e a loja identificada acima, para oferta e venda de produtos via aplicativo na cidade de Aragoiânia-GO.</p>
            <p><strong style={{ color: "#111827" }}>2. Comissão</strong> — A loja parceira concorda em pagar uma comissão de <strong style={{ color: "#f97316" }}>10%</strong> sobre o valor de cada pedido pago e entregue através da plataforma.</p>
            <p><strong style={{ color: "#111827" }}>3. Repasse</strong> — Os valores líquidos (após dedução de comissão) serão repassados via PIX à chave cadastrada, em até 7 dias úteis após cada transação.</p>
            <p><strong style={{ color: "#111827" }}>4. Obrigações da loja</strong> — A loja se compromete a: (a) manter o cardápio atualizado; (b) aceitar pedidos dentro do horário de funcionamento cadastrado; (c) preparar os itens com qualidade e dentro do prazo estimado; (d) informar disponibilidade de produtos em tempo real.</p>
            <p><strong style={{ color: "#111827" }}>5. Obrigações da plataforma</strong> — O Chegô Delivery se compromete a: (a) divulgar a loja no aplicativo; (b) fornecer suporte técnico; (c) repassar os valores devidos no prazo acordado.</p>
            <p><strong style={{ color: "#111827" }}>6. Suspensão</strong> — O Chegô Delivery poderá suspender temporariamente o acesso da loja em caso de reclamações recorrentes, inatividade ou descumprimento dos termos.</p>
            <p><strong style={{ color: "#111827" }}>7. Rescisão</strong> — Qualquer das partes pode encerrar a parceria com aviso prévio de 15 dias.</p>
            <p><strong style={{ color: "#111827" }}>8. Vigência</strong> — Este contrato entra em vigor na data de assinatura e é válido por prazo indeterminado.</p>
            <p style={{ color: "#9CA3AF", fontSize: 12 }}>
              Aragoiânia-GO · {new Date().toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>

        {/* Assinatura */}
        <div style={{ marginBottom: 24 }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold" style={{ color: "#374151" }}>Assinatura digital</p>
            <button onClick={limpar}
              style={{ background: "none", border: "1px solid #E5E7EB", borderRadius: 8, padding: "4px 12px", color: "#6B7280", fontSize: 12, cursor: "pointer" }}>
              Limpar
            </button>
          </div>
          <div style={{ border: "1.5px solid #E5E7EB", borderRadius: 14, overflow: "hidden", touchAction: "none" }}>
            <canvas
              ref={canvasRef}
              width={640}
              height={200}
              style={{ width: "100%", height: 160, background: "#F9FAFB", display: "block", cursor: "crosshair" }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
          </div>
          <p className="text-xs mt-2 text-center" style={{ color: "#9CA3AF" }}>
            Assine com o dedo ou mouse na área acima
          </p>
        </div>

        <button
          onClick={assinar}
          disabled={salvando || !temAssinatura}
          style={{
            width: "100%", padding: "16px", borderRadius: 14, border: "none",
            background: temAssinatura ? "#f97316" : "#F3F4F6",
            color: temAssinatura ? "white" : "#9CA3AF",
            fontWeight: 800, fontSize: 16,
            cursor: temAssinatura ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}>
          {salvando ? "Registrando assinatura..." : "✓ Assinar contrato e ativar parceria"}
        </button>
        <p className="text-xs mt-3 text-center" style={{ color: "#9CA3AF" }}>
          Ao assinar, você declara ter lido e concordado com todos os termos acima.
        </p>
      </div>
    </div>
  )
}
