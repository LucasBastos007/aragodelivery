"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

const PLANO_LABEL: Record<string, string> = { select: "Select", prime: "Prime", black: "Black", gold: "Gold" }
const PLANO_VALOR: Record<string, string> = {
  select: "R$ 149,00/mês",
  prime:  "R$ 497,00/mês",
  black:  "R$ 997,00/mês",
  gold:   "Isento (10% por pedido)",
}

type Loja = {
  id: string; nome: string; categoria?: string; endereco?: string
  nome_responsavel?: string; cnpj?: string; cpf_responsavel?: string
  email?: string; telefone?: string; plano?: string; comissao?: number
  mensalidade_dia?: number
  contrato_assinado: boolean
}

export default function ContratoLojaPage() {
  const { token } = useParams<{ token: string }>()

  const [loja,     setLoja]     = useState<Loja | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState("")
  const [assinado, setAssinado] = useState(false)

  useEffect(() => {
    fetch(`/api/contrato-loja?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setErro(d.error); setLoading(false); return }
        if (d.contrato_assinado) setAssinado(true)
        setLoja(d)
        setLoading(false)
      })
  }, [token])

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando contrato…</p>
      </div>
    )
  }

  // ─── Erro ──────────────────────────────────────────────────────────────────
  if (erro) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 24 }}>
        <div style={{ background: "white", borderRadius: 20, padding: "40px 32px", textAlign: "center", maxWidth: 380, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>❌</p>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginBottom: 8 }}>Link inválido</h2>
          <p style={{ fontSize: 14, color: "#6b7280" }}>{erro}</p>
        </div>
      </div>
    )
  }

  // ─── Já assinado ──────────────────────────────────────────────────────────
  if (assinado) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 24 }}>
        <div style={{ background: "white", borderRadius: 20, padding: "40px 32px", textAlign: "center", maxWidth: 420, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <p style={{ fontSize: 44, marginBottom: 12 }}>✅</p>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#111827", marginBottom: 10 }}>Contrato assinado!</h2>
          <p style={{ fontSize: 14, color: "#374151", marginBottom: 8, lineHeight: 1.6 }}>
            Recebemos sua assinatura com sucesso. Nossa equipe irá analisar e ativar sua loja em breve.
          </p>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>Você receberá um contato pelo WhatsApp informado no cadastro.</p>
        </div>
      </div>
    )
  }

  const plano = loja!.plano ?? "select"

  // ─── Página principal ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ background: "white", borderBottom: "1px solid #e5e7eb", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-chego.jpg" alt="Chegô" style={{ height: 36, width: "auto", borderRadius: 8, objectFit: "contain" }} />
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px" }}>

        {/* Título */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111827", letterSpacing: "-0.3px", marginBottom: 6 }}>
            Contrato de Parceria
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280" }}>
            Olá, <strong style={{ color: "#111827" }}>{loja!.nome}</strong>! Leia seu contrato e escolha como assinar.
          </p>
        </div>

        {/* Termos comerciais */}
        <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #FED7AA", boxShadow: "0 2px 12px rgba(249,115,22,0.08)", padding: "20px 24px", marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: "#f97316", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 14 }}>
            Condições comerciais
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
            {[
              { label: "Plano",             value: PLANO_LABEL[plano] ?? plano },
              { label: "Mensalidade",        value: PLANO_VALOR[plano]  ?? "—" },
              { label: "Taxa sobre vendas",  value: plano === "gold" ? "10%" : "0%" },
              { label: "Vencimento",         value: `Dia ${loja!.mensalidade_dia ?? 10} de cada mês` },
              { label: "Repasse",            value: "Toda terça e quinta-feira" },
              { label: "Prazo de aviso",     value: "30 dias por escrito" },
            ].map(r => (
              <div key={r.label}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{r.label}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{r.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contrato completo */}
        <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #e5e7eb", padding: "20px 24px", marginBottom: 28 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 16 }}>
            Contrato completo — leia com atenção
          </p>
          <div style={{
            maxHeight: 360, overflowY: "auto", fontSize: 13, lineHeight: 1.75,
            color: "#374151", paddingRight: 8,
          }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <p style={{ fontWeight: 900, fontSize: 14, color: "#111827" }}>CONTRATO DE PARCERIA COMERCIAL</p>
              <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>PLATAFORMA CHEGÔ DELIVERY E ESTABELECIMENTO PARCEIRO (LOJISTA)</p>
            </div>

            <p>Pelo presente instrumento particular, de um lado:</p>
            <p>
              <strong>CHEGÔ DELIVERY</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 67.543.510/0001-86, na modalidade de Microempreendedor Individual (MEI), com sede na Rua Pedro Nestor Pereira, nº 0, Quadra 14, Lote 24, Aragoiânia/GO, CEP 75330-000, representada por sua titular, Sra. Livia Rayane Sousa da Silva, doravante denominada simplesmente <strong>"PLATAFORMA"</strong>;
            </p>
            <p>e, de outro lado:</p>
            <p>
              <strong>{loja!.nome}</strong>, pessoa {loja!.cnpj ? "jurídica" : "física"}, inscrita no {loja!.cnpj ? `CNPJ sob o nº ${loja!.cnpj}` : loja!.cpf_responsavel ? `CPF sob o nº ${loja!.cpf_responsavel}` : "CPF/CNPJ a ser informado"}{loja!.endereco ? `, com endereço em ${loja!.endereco}` : ""}{loja!.nome_responsavel ? `, representado(a) por ${loja!.nome_responsavel}` : ""}, doravante denominado simplesmente <strong>"LOJISTA"</strong>.
            </p>
            <p>PLATAFORMA e LOJISTA, quando referidos conjuntamente, serão denominados "PARTES", e individualmente "PARTE", tendo entre si justo e contratado o presente Contrato de Parceria Comercial ("Contrato"), que se regerá pelas cláusulas e condições seguintes.</p>

            <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "16px 0" }} />

            <p style={{ fontWeight: 800, color: "#111827", marginTop: 16 }}>CLÁUSULA 1ª — DO OBJETO</p>
            <p>1.1. O presente Contrato tem por objeto disciplinar a parceria comercial firmada entre as PARTES, por meio da qual a PLATAFORMA disponibilizará ao LOJISTA acesso a sistema de tecnologia próprio (aplicativo e/ou painel administrativo "Chegô Delivery"), destinado à divulgação dos produtos do LOJISTA, ao recebimento de pedidos realizados por consumidores finais ("Clientes") e à intermediação logística de entrega por meio de entregadores parceiros ("Motoboys"), cadastrados de forma autônoma e independente junto à PLATAFORMA.</p>
            <p>1.2. A PLATAFORMA atua exclusivamente como intermediadora tecnológica entre o LOJISTA, o Cliente e o Motoboy, não se confundindo, em nenhuma hipótese, com fabricante, vendedor, fornecedor dos produtos comercializados pelo LOJISTA, tampouco com transportadora ou empregadora dos Motoboys.</p>

            <p style={{ fontWeight: 800, color: "#111827", marginTop: 16 }}>CLÁUSULA 2ª — DAS OBRIGAÇÕES DA PLATAFORMA</p>
            <p>2.1. A PLATAFORMA se obriga a:</p>
            <p>a) Disponibilizar ao LOJISTA acesso ao painel administrativo para gestão de cardápio/catálogo, preços, horários de funcionamento e recebimento de pedidos;</p>
            <p>b) Disponibilizar a malha de entregadores parceiros (Motoboys) cadastrados na PLATAFORMA para realização das entregas solicitadas pelos Clientes;</p>
            <p>c) Repassar ao LOJISTA, nos prazos e condições definidos na Cláusula 4ª, os valores devidos pelas vendas intermediadas, descontadas as taxas aplicáveis;</p>
            <p>d) Prestar suporte técnico ao LOJISTA quanto ao funcionamento do sistema;</p>
            <p>e) Zelar pela correta exibição das informações cadastradas pelo LOJISTA, sem prejuízo da responsabilidade do LOJISTA pela exatidão de tais informações.</p>
            <p>2.2. A PLATAFORMA não garante volume mínimo de pedidos, faturamento mínimo ou exclusividade territorial ao LOJISTA, salvo se expressamente pactuado em aditivo contratual específico.</p>

            <p style={{ fontWeight: 800, color: "#111827", marginTop: 16 }}>CLÁUSULA 3ª — DAS OBRIGAÇÕES DO LOJISTA</p>
            <p>3.1. O LOJISTA se obriga a:</p>
            <p>a) Manter cadastro atualizado de produtos, preços, fotos, horários de funcionamento e demais informações necessárias à correta exibição de seu estabelecimento na PLATAFORMA;</p>
            <p>b) Garantir a qualidade, a integridade, a segurança alimentar (quando aplicável) e a conformidade legal de todos os produtos comercializados, respondendo exclusiva e diretamente perante o Cliente e perante órgãos de fiscalização por vícios, defeitos ou inadequações dos produtos;</p>
            <p>c) Preparar e disponibilizar os pedidos dentro do prazo informado na PLATAFORMA, de forma embalada e apta ao transporte;</p>
            <p>d) Possuir e manter regularizados todos os alvarás, licenças, registros e demais documentos exigidos por lei para o exercício de sua atividade, incluindo, quando aplicável, licença sanitária;</p>
            <p>e) Não realizar cobrança de valores adicionais ao Cliente além dos preços cadastrados na PLATAFORMA, salvo taxas de entrega e serviço expressamente previstas;</p>
            <p>f) Tratar com urbanidade Clientes e Motoboys, e comunicar à PLATAFORMA qualquer irregularidade identificada;</p>
            <p>g) Efetuar o pagamento da mensalidade prevista na Cláusula 4ª, nos prazos e formas ali estabelecidos;</p>
            <p>h) Não utilizar a marca, layout, base de dados ou tecnologia da PLATAFORMA para fins distintos dos previstos neste Contrato.</p>
            <p>3.2. O LOJISTA reconhece que é o único responsável pela emissão de notas fiscais, recolhimento de tributos e cumprimento de obrigações fiscais, trabalhistas e regulatórias relacionadas à sua própria atividade comercial.</p>

            <p style={{ fontWeight: 800, color: "#111827", marginTop: 16 }}>CLÁUSULA 4ª — DA REMUNERAÇÃO E FORMA DE PAGAMENTO</p>
            <p>4.1. Pelo uso da PLATAFORMA, o LOJISTA pagará mensalidade fixa no valor de <strong>{PLANO_VALOR[plano] ?? "—"}</strong>, com vencimento todo dia <strong>{loja!.mensalidade_dia ?? 10} ({["","primeiro","dois","três","quatro","cinco","seis","sete","oito","nove","dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove","vinte","vinte e um","vinte e dois","vinte e três","vinte e quatro","vinte e cinco","vinte e seis","vinte e sete","vinte e oito"][loja!.mensalidade_dia ?? 10]})</strong> de cada mês, mediante PIX ou transferência bancária.</p>
            <p>4.2. A taxa de entrega referente a cada pedido é de responsabilidade do Cliente final, sendo repassada integralmente (ou parcialmente, conforme política vigente da PLATAFORMA) ao Motoboy responsável pela entrega, não compondo receita do LOJISTA nem da PLATAFORMA, salvo eventual percentual de intermediação expressamente informado ao LOJISTA.</p>
            <p>4.3. O atraso no pagamento da mensalidade por prazo superior a <strong>4 (quatro) dias</strong> autoriza a PLATAFORMA a suspender o acesso do LOJISTA ao sistema, independentemente de notificação prévia, sem prejuízo da cobrança dos valores em aberto, acrescidos de multa de <strong>2% (dois por cento)</strong> e juros de mora de 1% (um por cento) ao mês, pro rata die.</p>
            <p>4.4. Eventual reajuste do valor da mensalidade será comunicado ao LOJISTA com antecedência mínima de 30 (trinta) dias.</p>

            <p style={{ fontWeight: 800, color: "#111827", marginTop: 16 }}>CLÁUSULA 5ª — DA NATUREZA DA RELAÇÃO ENTRE AS PARTES</p>
            <p>5.1. O presente Contrato não cria entre as PARTES qualquer relação de sociedade, mandato, representação comercial, franquia ou vínculo empregatício, atuando cada PARTE por sua conta e risco, com estrutura, equipe e gestão próprias e independentes.</p>
            <p>5.2. Os Motoboys que realizam as entregas são prestadores de serviço autônomos, cadastrados diretamente junto à PLATAFORMA, não havendo qualquer vínculo de subordinação entre estes e o LOJISTA.</p>

            <p style={{ fontWeight: 800, color: "#111827", marginTop: 16 }}>CLÁUSULA 6ª — DA PROPRIEDADE INTELECTUAL</p>
            <p>6.1. A marca "Chegô Delivery", o aplicativo, o painel administrativo, o layout, o código-fonte e a base tecnológica são de propriedade exclusiva da PLATAFORMA, sendo concedido ao LOJISTA apenas o direito de uso, não exclusivo e intransferível, restrito à vigência deste Contrato.</p>
            <p>6.2. É vedado ao LOJISTA copiar, reproduzir, modificar ou explorar comercialmente, por qualquer meio, a tecnologia, marca ou base de dados da PLATAFORMA.</p>

            <p style={{ fontWeight: 800, color: "#111827", marginTop: 16 }}>CLÁUSULA 7ª — DA PROTEÇÃO DE DADOS (LGPD)</p>
            <p>7.1. As PARTES se obrigam a tratar os dados pessoais de Clientes e Motoboys aos quais tiverem acesso em razão deste Contrato em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais), utilizando tais dados exclusivamente para as finalidades relacionadas à execução do presente Contrato.</p>
            <p>7.2. É vedado ao LOJISTA utilizar dados de Clientes obtidos por meio da PLATAFORMA para fins de contato direto, marketing ou qualquer outra finalidade alheia ao pedido em curso, sem autorização expressa do Cliente e da PLATAFORMA.</p>

            <p style={{ fontWeight: 800, color: "#111827", marginTop: 16 }}>CLÁUSULA 8ª — DA CONFIDENCIALIDADE</p>
            <p>8.1. As PARTES se obrigam a manter sigilo sobre informações comerciais, financeiras, técnicas e operacionais trocadas em razão deste Contrato, não as divulgando a terceiros sem prévia autorização por escrito, sob pena de responsabilidade por perdas e danos.</p>

            <p style={{ fontWeight: 800, color: "#111827", marginTop: 16 }}>CLÁUSULA 9ª — DA VIGÊNCIA, RENOVAÇÃO E RESCISÃO</p>
            <p>9.1. O presente Contrato vigerá por prazo <strong>indeterminado</strong>, iniciando-se na data de sua assinatura.</p>
            <p>9.2. Qualquer das PARTES poderá rescindir o presente Contrato, sem necessidade de justificativa, mediante aviso prévio por escrito (e-mail ou aplicativo) de, no mínimo, <strong>30 (trinta) dias</strong> de antecedência.</p>
            <p>9.3. O Contrato poderá ser rescindido de forma imediata, independentemente de aviso prévio, em caso de:</p>
            <p>a) Descumprimento de qualquer obrigação prevista neste Contrato, não sanado em até 5 (cinco) dias após notificação;</p>
            <p>b) Constatação de fraude, venda de produtos ilícitos, falsificados ou que coloquem em risco a saúde ou segurança do Cliente;</p>
            <p>c) Reiteradas reclamações de Clientes quanto à qualidade dos produtos ou ao cumprimento dos pedidos;</p>
            <p>d) Inadimplência da mensalidade por prazo superior ao previsto na Cláusula 4.3;</p>
            <p>e) Perda, pelo LOJISTA, de licenças ou autorizações legais necessárias ao exercício de sua atividade.</p>
            <p>9.4. Encerrado o Contrato, o LOJISTA terá seu acesso à PLATAFORMA bloqueado, permanecendo responsável pelo pagamento de valores pendentes até a data da rescisão.</p>

            <p style={{ fontWeight: 800, color: "#111827", marginTop: 16 }}>CLÁUSULA 10ª — DAS LIMITAÇÕES DE RESPONSABILIDADE</p>
            <p>10.1. A PLATAFORMA não responde por danos decorrentes de vícios ou defeitos dos produtos comercializados pelo LOJISTA, cabendo a este a responsabilidade integral nos termos do Código de Defesa do Consumidor (Lei nº 8.078/1990).</p>
            <p>10.2. A PLATAFORMA não responde por eventuais atrasos de entrega motivados por caso fortuito, força maior, condições climáticas, trânsito ou indisponibilidade momentânea de Motoboys, devendo empregar seus melhores esforços para mitigar tais ocorrências.</p>
            <p>10.3. Eventual responsabilidade da PLATAFORMA, quando reconhecida judicialmente, fica limitada ao valor das mensalidades pagas pelo LOJISTA nos 3 (três) meses anteriores ao evento gerador do dano, ressalvados os casos de dolo.</p>

            <p style={{ fontWeight: 800, color: "#111827", marginTop: 16 }}>CLÁUSULA 11ª — DISPOSIÇÕES GERAIS</p>
            <p>11.1. Este Contrato representa a totalidade do acordo entre as PARTES, substituindo entendimentos anteriores, verbais ou escritos, sobre o mesmo objeto.</p>
            <p>11.2. A tolerância de uma PARTE quanto ao descumprimento de qualquer obrigação pela outra não implica novação, renúncia ou alteração contratual.</p>
            <p>11.3. Caso qualquer cláusula deste Contrato seja considerada nula ou inexequível, as demais permanecerão em pleno vigor.</p>
            <p>11.4. O LOJISTA declara ter lido e compreendido integralmente este Contrato, manifestando sua livre e espontânea concordância com todos os seus termos, inclusive por meio de aceite eletrônico no momento do cadastro na PLATAFORMA, quando aplicável.</p>

            <p style={{ fontWeight: 800, color: "#111827", marginTop: 16 }}>CLÁUSULA 12ª — DO FORO</p>
            <p>12.1. As PARTES elegem o foro da Comarca de Aragoiânia, Estado de Goiás, para dirimir quaisquer controvérsias decorrentes deste Contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja, ressalvado o foro do domicílio do consumidor, quando aplicável.</p>

            <p style={{ marginTop: 24, color: "#9ca3af", fontStyle: "italic", fontSize: 12 }}>
              Aragoiânia/GO, {new Date().toLocaleDateString("pt-BR")}
            </p>
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ borderBottom: "1px solid #d1d5db", marginBottom: 4, paddingBottom: 2 }}></div>
                <p style={{ fontSize: 11, color: "#6b7280" }}>CHEGÔ DELIVERY — Representante legal / PLATAFORMA</p>
              </div>
              <div>
                <div style={{ borderBottom: "1px solid #d1d5db", marginBottom: 4, paddingBottom: 2 }}></div>
                <p style={{ fontSize: 11, color: "#6b7280" }}>{loja!.nome} — LOJISTA</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ borderBottom: "1px solid #d1d5db", marginBottom: 4, paddingBottom: 2 }}></div>
                  <p style={{ fontSize: 11, color: "#6b7280" }}>Testemunha 1 — CPF: ___________</p>
                </div>
                <div>
                  <div style={{ borderBottom: "1px solid #d1d5db", marginBottom: 4, paddingBottom: 2 }}></div>
                  <p style={{ fontSize: 11, color: "#6b7280" }}>Testemunha 2 — CPF: ___________</p>
                </div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 12, textAlign: "center" }}>
            Role para ler o contrato completo antes de assinar
          </p>
        </div>

        {/* Botão de download */}
        <a
          href={`/api/chego-ctrl/contrato?tipo=loja&id=${loja!.id}&modo=preview`}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            width: "100%", padding: "17px 20px", borderRadius: 16, textDecoration: "none",
            background: "#DC2626", color: "white",
            fontSize: 15, fontWeight: 800,
            boxShadow: "0 4px 16px rgba(220,38,38,0.30)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Baixar Contrato em PDF
        </a>
        <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 10 }}>
          Imprima, assine e entregue à nossa equipe — presencialmente ou via Gov.br
        </p>

      </div>
    </div>
  )
}
