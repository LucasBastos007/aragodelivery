"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
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
      const res = await fetch(`/api/contrato-loja?token=${token}`)
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? "Link inválido ou expirado."); setLoading(false); return }
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
    const res = await fetch("/api/contrato-loja", {
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
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#9CA3AF" }}>Contrato completo</p>
          <div className="text-sm leading-relaxed flex flex-col gap-4" style={{ color: "#374151" }}>

            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <p style={{ color: "#111827", fontWeight: 900, fontSize: 15 }}>CONTRATO DE PARCERIA COMERCIAL</p>
              <p style={{ color: "#9CA3AF", fontSize: 12 }}>PLATAFORMA CHEGÔ DELIVERY E LOJISTA PARCEIRO</p>
            </div>

            <p>Pelo presente instrumento particular, de um lado:</p>
            <p><strong style={{ color: "#111827" }}>CHEGÔ DELIVERY</strong> (67.543.510 LIVIA RAYANE SOUSA DA SILVA), pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 67.543.510/0001-86, na modalidade de Microempreendedor Individual (MEI), com sede na Rua Pedro Nestor Pereira, nº 0, Quadra 14, Lote 24, Aragoiânia/GO, CEP 75330-000, representada por sua titular, Sra. Livia Rayane Sousa da Silva, doravante <strong style={{ color: "#111827" }}>"PLATAFORMA"</strong>;</p>
            <p>e, de outro lado:</p>
            <p>
              <strong style={{ color: "#111827" }}>{loja!.nome}</strong>,
              {loja!.cnpj ? ` inscrito no CNPJ sob o nº ${loja!.cnpj},` : (loja! as any).cpf_responsavel ? ` inscrito no CPF sob o nº ${(loja! as any).cpf_responsavel},` : ""}
              {loja!.endereco ? ` com endereço em ${loja!.endereco},` : ""}
              {loja!.nome_responsavel ? ` representado por ${loja!.nome_responsavel},` : ""} doravante <strong style={{ color: "#111827" }}>"LOJISTA"</strong>.
            </p>

            <div style={{ height: 1, background: "#e5e7eb" }} />

            <p style={{ color: "#111827", fontWeight: 800 }}>CLÁUSULA 1ª — DO OBJETO</p>
            <p>1.1. O presente contrato tem por objeto estabelecer as condições de parceria comercial entre a PLATAFORMA e o LOJISTA, mediante a qual a PLATAFORMA disponibilizará, por meio do aplicativo "Chegô Delivery" e ferramentas associadas, canal digital para que o LOJISTA oferte e venda seus produtos a consumidores finais.</p>
            <p>1.2. A PLATAFORMA atua exclusivamente como intermediadora tecnológica, não sendo responsável pela relação de consumo entre o LOJISTA e o cliente final, nem pela qualidade, quantidade, composição ou segurança dos produtos comercializados.</p>

            <p style={{ color: "#111827", fontWeight: 800 }}>CLÁUSULA 2ª — DAS OBRIGAÇÕES DA PLATAFORMA</p>
            <p>2.1. A PLATAFORMA se obriga a: (a) disponibilizar ao LOJISTA o acesso ao sistema de gestão e vitrine no aplicativo pelo prazo contratual; (b) promover o LOJISTA nos canais próprios da PLATAFORMA; (c) fornecer suporte técnico para uso das ferramentas disponibilizadas; (d) repassar ao LOJISTA os valores devidos, conforme Cláusula 4ª; (e) manter sigilo sobre as informações comerciais do LOJISTA.</p>

            <p style={{ color: "#111827", fontWeight: 800 }}>CLÁUSULA 3ª — DAS OBRIGAÇÕES DO LOJISTA</p>
            <p>3.1. O LOJISTA se obriga a: (a) manter o cardápio atualizado e com informações verídicas sobre preços, disponibilidade e composição dos produtos; (b) aceitar e preparar pedidos dentro dos horários de funcionamento cadastrados; (c) garantir padrão de qualidade, higiene e segurança alimentar dos produtos; (d) embalar adequadamente os itens para entrega; (e) comunicar à PLATAFORMA indisponibilidade temporária de produtos ou encerramento antecipado de funcionamento; (f) cumprir todas as normas fiscais, sanitárias e trabalhistas aplicáveis à sua atividade; (g) tratar os entregadores parceiros e clientes com urbanidade e respeito.</p>
            <p>3.2. O LOJISTA é o único responsável perante órgãos fiscais, sanitários e de defesa do consumidor pela regularidade dos produtos que comercializa.</p>

            <p style={{ color: "#111827", fontWeight: 800 }}>CLÁUSULA 4ª — DA REMUNERAÇÃO E FORMA DE PAGAMENTO</p>
            <p>4.1. Pelo uso da PLATAFORMA, o LOJISTA pagará mensalidade fixa conforme acordado entre as partes, com vencimento mensal, mediante forma de pagamento definida no ato da contratação.</p>
            <p>4.2. Em caso de atraso no pagamento, incidirão multa de 2% (dois por cento) sobre o valor devido e juros moratórios de 1% (um por cento) ao mês, calculados pro rata die.</p>
            <p>4.3. O não pagamento por 30 (trinta) dias corridos poderá resultar na suspensão imediata do acesso do LOJISTA à PLATAFORMA, independentemente de notificação prévia.</p>

            <p style={{ color: "#111827", fontWeight: 800 }}>CLÁUSULA 5ª — DA NATUREZA DA RELAÇÃO</p>
            <p>5.1. O presente contrato não gera entre as PARTES qualquer vínculo de emprego, sociedade, associação ou representação comercial. O LOJISTA não possui exclusividade e pode operar em outros canais de venda.</p>

            <p style={{ color: "#111827", fontWeight: 800 }}>CLÁUSULA 6ª — DA PROPRIEDADE INTELECTUAL</p>
            <p>6.1. A marca, logotipo, nome e demais elementos de identidade visual do "Chegô Delivery" são de propriedade exclusiva da PLATAFORMA. O LOJISTA poderá utilizá-los apenas para fins de divulgação da parceria, vedado qualquer uso que cause confusão ao consumidor ou desvirtue a marca.</p>

            <p style={{ color: "#111827", fontWeight: 800 }}>CLÁUSULA 7ª — DA PROTEÇÃO DE DADOS (LGPD)</p>
            <p>7.1. As PARTES se comprometem a tratar os dados pessoais de clientes e terceiros em conformidade com a Lei nº 13.709/2018 (LGPD), utilizando-os estritamente para a execução das atividades objeto deste contrato.</p>
            <p>7.2. Em caso de incidente de segurança envolvendo dados pessoais, a parte que tiver ciência do fato deverá notificar a outra imediatamente e adotar as medidas de contenção cabíveis.</p>

            <p style={{ color: "#111827", fontWeight: 800 }}>CLÁUSULA 8ª — DA CONFIDENCIALIDADE</p>
            <p>8.1. As PARTES se obrigam a guardar sigilo sobre as informações comerciais, financeiras e operacionais trocadas em razão deste contrato, durante toda a vigência e por 2 (dois) anos após seu encerramento, salvo obrigação legal em contrário.</p>

            <p style={{ color: "#111827", fontWeight: 800 }}>CLÁUSULA 9ª — DA VIGÊNCIA, RENOVAÇÃO E RESCISÃO</p>
            <p>9.1. O presente contrato vigerá por prazo indeterminado, podendo ser rescindido por qualquer das PARTES mediante aviso prévio por escrito.</p>
            <p>9.2. A PLATAFORMA poderá rescindir o contrato de imediato, sem ônus, em caso de: (a) descumprimento grave das obrigações do LOJISTA; (b) reincidência em reclamações de clientes ou entregadores; (c) prática de ato ilícito; (d) inadimplência superior a 30 (trinta) dias.</p>
            <p>9.3. O LOJISTA poderá rescindir o contrato mediante comunicação prévia por escrito, ficando responsável pelos pagamentos devidos até a data da rescisão.</p>

            <p style={{ color: "#111827", fontWeight: 800 }}>CLÁUSULA 10ª — DAS LIMITAÇÕES DE RESPONSABILIDADE</p>
            <p>10.1. A PLATAFORMA não se responsabiliza por: (a) qualidade, segurança ou integridade dos produtos oferecidos pelo LOJISTA; (b) reclamações de consumidores decorrentes de falha do LOJISTA na preparação ou embalagem dos produtos; (c) eventuais danos causados por entregadores autônomos que atuem pelo aplicativo; (d) interrupções de serviço decorrentes de casos fortuitos ou força maior.</p>

            <p style={{ color: "#111827", fontWeight: 800 }}>CLÁUSULA 11ª — DISPOSIÇÕES GERAIS</p>
            <p>11.1. Este instrumento representa a totalidade do acordo entre as PARTES, substituindo negociações, propostas ou entendimentos anteriores relacionados ao mesmo objeto.</p>
            <p>11.2. Qualquer alteração das condições aqui estabelecidas deverá ser realizada por escrito e aceita por ambas as PARTES.</p>
            <p>11.3. O LOJISTA declara ter lido e compreendido integralmente este contrato, concordando livre e espontaneamente com todas as cláusulas.</p>

            <p style={{ color: "#111827", fontWeight: 800 }}>CLÁUSULA 12ª — DO FORO</p>
            <p>12.1. As PARTES elegem o foro da Comarca de Aragoiânia, Estado de Goiás, para dirimir quaisquer controvérsias oriundas deste contrato, com renúncia de qualquer outro, por mais privilegiado que seja.</p>

            <div style={{ height: 1, background: "#e5e7eb", margin: "8px 0" }} />
            <p style={{ color: "#9CA3AF", fontSize: 12 }}>
              Aragoiânia/GO, {new Date().toLocaleDateString("pt-BR")}
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
