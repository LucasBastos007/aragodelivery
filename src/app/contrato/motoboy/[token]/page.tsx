"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { Motoboy } from "@/types"

export default function ContratoMotoboyPage() {
  const { token } = useParams<{ token: string }>()
  const [motoboy, setMotoboy] = useState<Motoboy | null>(null)
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
        .from("motoboys")
        .select("*")
        .eq("contrato_token", token)
        .single()
      if (error || !data) { setErro("Link inválido ou expirado."); setLoading(false); return }
      if (data.contrato_assinado) { setAssinado(true) }
      setMotoboy(data)
      setLoading(false)
    }
    load()
  }, [token])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }, [motoboy])

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

  function stopDraw() { drawing.current = false }

  function limpar() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height)
    setTemAssinatura(false)
  }

  async function assinar() {
    const canvas = canvasRef.current
    if (!canvas || !motoboy) return
    const assinatura = canvas.toDataURL("image/png")
    setSalvando(true)
    const res = await fetch("/api/contrato-motoboy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, assinatura }),
    })
    setSalvando(false)
    if (!res.ok) { alert("Erro ao salvar assinatura. Tente novamente."); return }
    setAssinado(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando contrato...</p>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0a0a0a" }}>
        <div className="card p-8 text-center max-w-sm w-full">
          <p className="text-4xl mb-4">❌</p>
          <h2 className="text-xl font-black text-white mb-2">Link inválido</h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{erro}</p>
        </div>
      </div>
    )
  }

  if (assinado) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0a0a0a" }}>
        <div className="card p-8 text-center max-w-sm w-full">
          <p className="text-5xl mb-4">✅</p>
          <h2 className="text-xl font-black text-white mb-2">Contrato assinado!</h2>
          <p className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
            Sua assinatura foi registrada com sucesso.
          </p>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.3)" }}>
            Nossa equipe ativará seu acesso em breve. Você receberá um contato no WhatsApp.
          </p>
          <a href="/" className="btn-ghost w-full justify-center">Voltar ao início</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 flex flex-col items-center" style={{ background: "#0a0a0a" }}>
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <img src="/logo-chego.jpg" alt="Chegô" style={{ height: 48, width: "auto", borderRadius: 12, objectFit: "contain", margin: "0 auto 16px" }} />
          <h1 className="text-2xl font-black text-white">Contrato de Parceria — Motoboy</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Leia com atenção e assine abaixo para confirmar.
          </p>
        </div>

        {/* Dados do motoboy */}
        <div style={{ background: "#111", borderRadius: 14, padding: "16px", marginBottom: 24 }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Seus dados</p>
          <p className="font-black text-white text-lg">{motoboy!.nome}</p>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>CPF: {motoboy!.cpf}</p>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{motoboy!.veiculo} · {motoboy!.placa}</p>
          {motoboy!.cnh && <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>CNH: {motoboy!.cnh}</p>}
        </div>

        {/* Texto do contrato */}
        <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 14, padding: "24px", marginBottom: 24 }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>Contrato completo</p>
          <div className="text-sm leading-relaxed flex flex-col gap-4" style={{ color: "rgba(255,255,255,0.65)" }}>

            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <p style={{ color: "white", fontWeight: 900, fontSize: 15 }}>TERMO DE PARCERIA PARA PRESTAÇÃO DE SERVIÇOS DE ENTREGA</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>PLATAFORMA CHEGÔ DELIVERY E ENTREGADOR PARCEIRO (MOTOBOY) AUTÔNOMO</p>
            </div>

            <p>Pelo presente instrumento particular, de um lado:</p>
            <p><strong style={{ color: "white" }}>CHEGÔ DELIVERY</strong> (67.543.510 LIVIA RAYANE SOUSA DA SILVA), pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 67.543.510/0001-86, na modalidade de Microempreendedor Individual (MEI), com sede na Rua Pedro Nestor Pereira, nº 0, Quadra 14, Lote 24, Aragoiânia/GO, CEP 75330-000, representada por sua titular, Sra. Livia Rayane Sousa da Silva, doravante <strong style={{ color: "white" }}>"PLATAFORMA"</strong>;</p>
            <p>e, de outro lado:</p>
            <p><strong style={{ color: "white" }}>{motoboy!.nome}</strong>, pessoa física, portador(a) do CPF nº {motoboy!.cpf}{motoboy!.cnh ? ` e da CNH nº ${motoboy!.cnh}` : ""}, doravante <strong style={{ color: "white" }}>"ENTREGADOR"</strong> ou <strong style={{ color: "white" }}>"MOTOBOY"</strong>.</p>

            <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

            <p style={{ color: "white", fontWeight: 800 }}>CLÁUSULA 1ª — DO OBJETO</p>
            <p>1.1. O presente Termo disciplina a parceria entre as PARTES, por meio da qual a PLATAFORMA disponibilizará ao ENTREGADOR acesso ao aplicativo "Chegô Delivery", pelo qual poderá visualizar e aceitar, de forma livre e espontânea, solicitações de entrega de estabelecimentos parceiros ("Lojistas") a consumidores finais ("Clientes").</p>
            <p>1.2. A PLATAFORMA atua exclusivamente como intermediadora tecnológica, não se confundindo com transportadora, operadora logística ou empregadora do ENTREGADOR.</p>

            <p style={{ color: "white", fontWeight: 800 }}>CLÁUSULA 2ª — DA NATUREZA AUTÔNOMA DA RELAÇÃO</p>
            <p>2.1. O ENTREGADOR presta seus serviços de forma absolutamente autônoma, eventual e por sua livre iniciativa, <strong style={{ color: "white" }}>sem vínculo de emprego, subordinação, hierarquia ou exclusividade</strong> com a PLATAFORMA.</p>
            <p>2.2. O ENTREGADOR tem plena liberdade para: (a) conectar-se e desconectar-se nos dias e horários que melhor lhe convierem, sem obrigação de cumprir jornada ou meta; (b) aceitar ou recusar qualquer solicitação de entrega, sem penalidade pela simples recusa; (c) prestar serviços para outras plataformas ou estabelecimentos, sem cláusula de exclusividade.</p>
            <p>2.3. Em razão da natureza autônoma, o ENTREGADOR não terá direito a férias, 13º salário, FGTS, aviso prévio ou quaisquer verbas rescisórias trabalhistas, sendo responsável pelo próprio recolhimento previdenciário e obrigações fiscais.</p>

            <p style={{ color: "white", fontWeight: 800 }}>CLÁUSULA 3ª — DAS OBRIGAÇÕES DA PLATAFORMA</p>
            <p>3.1. A PLATAFORMA se obriga a: (a) disponibilizar o aplicativo para visualização e aceite de entregas; (b) informar, em cada solicitação, a origem, o destino aproximado e o valor a ser pago antes do aceite; (c) efetuar o repasse dos valores devidos na periodicidade prevista na Cláusula 4ª; (d) prestar suporte técnico ao ENTREGADOR.</p>

            <p style={{ color: "white", fontWeight: 800 }}>CLÁUSULA 4ª — DA REMUNERAÇÃO</p>
            <p>4.1. Por cada entrega efetivamente realizada e confirmada, o ENTREGADOR receberá valor fixo informado previamente no momento do oferecimento da corrida, podendo variar conforme política da PLATAFORMA, sempre informada antes do aceite.</p>
            <p>4.2. O repasse dos valores será realizado semanalmente, mediante transferência para conta bancária ou chave PIX indicada pelo ENTREGADOR.</p>
            <p>4.3. Eventuais bonificações, incentivos por meta ou taxas dinâmicas poderão ser oferecidos a critério exclusivo da PLATAFORMA, mediante comunicação prévia.</p>

            <p style={{ color: "white", fontWeight: 800 }}>CLÁUSULA 5ª — DO VEÍCULO E EQUIPAMENTOS</p>
            <p>5.1. O ENTREGADOR utilizará veículo próprio ou alugado, sendo de sua exclusiva responsabilidade: (a) manter o veículo em bom estado e com documentação regular (CRLV e CNH compatível); (b) possuir seguro pessoal e/ou do veículo quando aplicável; (c) utilizar equipamentos de proteção (capacete e bag adequado); (d) custear combustível, manutenção e multas, sem reembolso da PLATAFORMA.</p>
            <p>5.2. O ENTREGADOR deverá possuir smartphone próprio com plano de dados ativo e compatível com o aplicativo, arcando com os custos de aquisição e manutenção.</p>

            <p style={{ color: "white", fontWeight: 800 }}>CLÁUSULA 6ª — DA RESPONSABILIDADE</p>
            <p>6.1. O ENTREGADOR é o único e exclusivo responsável por acidentes de trânsito, infrações e danos causados a si, a Clientes, a Lojistas ou a terceiros durante as entregas, <strong style={{ color: "white" }}>isentando a PLATAFORMA de qualquer responsabilidade civil, trabalhista, criminal ou administrativa</strong> decorrente de tais eventos, ressalvada falha comprovada e exclusiva do sistema tecnológico da PLATAFORMA.</p>
            <p>6.2. Em caso de avaria, perda ou extravio de produto, o ENTREGADOR deverá comunicar imediatamente o ocorrido, podendo responder pelo ressarcimento quando comprovada sua culpa.</p>

            <p style={{ color: "white", fontWeight: 800 }}>CLÁUSULA 7ª — DA CONDUTA</p>
            <p>7.1. O ENTREGADOR se obriga a tratar Clientes e Lojistas com urbanidade e respeito, manter a integridade dos pedidos e não consumir bebida alcoólica ou substância que comprometa sua capacidade de condução durante as entregas.</p>
            <p>7.2. Reclamações fundamentadas e reiteradas poderão resultar em suspensão ou bloqueio do acesso, assegurado o direito de manifestação prévia, salvo em casos graves (violência, assédio, fraude).</p>

            <p style={{ color: "white", fontWeight: 800 }}>CLÁUSULA 8ª — DA PROTEÇÃO DE DADOS (LGPD)</p>
            <p>8.1. As PARTES se obrigam a tratar os dados pessoais de Clientes e Lojistas em conformidade com a Lei nº 13.709/2018 (LGPD), utilizando-os exclusivamente para a execução das entregas.</p>

            <p style={{ color: "white", fontWeight: 800 }}>CLÁUSULA 9ª — DA VIGÊNCIA E DO DESCADASTRAMENTO</p>
            <p>9.1. O presente Termo vigerá por prazo indeterminado, podendo ser encerrado a qualquer tempo por qualquer das PARTES mediante simples descadastramento no aplicativo ou comunicação por escrito, sem necessidade de aviso prévio.</p>
            <p>9.2. A PLATAFORMA poderá suspender ou bloquear o acesso do ENTREGADOR de forma imediata em caso de fraude, conduta inadequada grave, descumprimento de obrigações legais (ex.: CNH vencida) ou descumprimento reiterado deste Termo.</p>

            <p style={{ color: "white", fontWeight: 800 }}>CLÁUSULA 10ª — DISPOSIÇÕES GERAIS</p>
            <p>10.1. Este Termo representa a totalidade do acordo entre as PARTES, substituindo entendimentos anteriores sobre o mesmo objeto.</p>
            <p>10.2. O ENTREGADOR declara ter lido e compreendido integralmente este Termo, manifestando sua livre e espontânea concordância.</p>

            <p style={{ color: "white", fontWeight: 800 }}>CLÁUSULA 11ª — DO FORO</p>
            <p>11.1. As PARTES elegem o foro da Comarca de Aragoiânia, Estado de Goiás, para dirimir quaisquer controvérsias decorrentes deste Termo.</p>

            <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
              Aragoiânia/GO, {new Date().toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>

        {/* Assinatura */}
        <div style={{ marginBottom: 24 }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>Assinatura digital</p>
            <button onClick={limpar}
              style={{ background: "none", border: "1px solid #333", borderRadius: 8, padding: "4px 12px", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer" }}>
              Limpar
            </button>
          </div>
          <div style={{ border: "1.5px solid #2a2a2a", borderRadius: 14, overflow: "hidden", touchAction: "none" }}>
            <canvas
              ref={canvasRef}
              width={640}
              height={200}
              style={{ width: "100%", height: 160, background: "#0d0d0d", display: "block", cursor: "crosshair" }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
          </div>
          <p className="text-xs mt-2 text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
            Assine com o dedo ou mouse na área acima
          </p>
        </div>

        <button
          onClick={assinar}
          disabled={salvando || !temAssinatura}
          style={{
            width: "100%", padding: "16px", borderRadius: 14, border: "none",
            background: temAssinatura ? "#f97316" : "rgba(255,255,255,0.06)",
            color: temAssinatura ? "white" : "rgba(255,255,255,0.3)",
            fontWeight: 800, fontSize: 16,
            cursor: temAssinatura ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}>
          {salvando ? "Registrando assinatura..." : "✓ Assinar contrato e iniciar parceria"}
        </button>
        <p className="text-xs mt-3 text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
          Ao assinar, você declara ter lido e concordado com todos os termos acima.
        </p>
      </div>
    </div>
  )
}
