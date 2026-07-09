import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLANO_LABEL: Record<string, string> = { select: "Select", prime: "Prime", black: "Black", gold: "Gold" }
const PLANO_VALOR: Record<string, string> = {
  select: "R$ 149,00/mês",
  prime:  "R$ 497,00/mês",
  black:  "R$ 997,00/mês",
  gold:   "Isento (10% por pedido)",
}

function fmt(d?: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
}

// ─────────────────────────────────────────────────────────────────────────────
// Contrato de Loja (19 cláusulas)
// ─────────────────────────────────────────────────────────────────────────────
function contratoLojaHtml(l: Record<string, any>): string {
  const plano = l.plano ?? "select"
  const comissao = l.comissao ?? 0
  const planoLabel = PLANO_LABEL[plano] ?? plano
  const planoValor = PLANO_VALOR[plano] ?? "—"

  return `
    <div class="header-bloco">
      <p class="rotulo">Dados do lojista parceiro</p>
      <p class="nome">${l.nome ?? "—"}</p>
      <table class="dados-table">
        <tr><td>Nome Fantasia</td><td>${l.nome ?? "—"}</td></tr>
        ${l.nome_responsavel ? `<tr><td>Responsável Legal</td><td>${l.nome_responsavel}</td></tr>` : ""}
        ${l.cnpj             ? `<tr><td>CNPJ</td><td>${l.cnpj}</td></tr>` : ""}
        ${l.cpf_responsavel  ? `<tr><td>CPF do Responsável</td><td>${l.cpf_responsavel}</td></tr>` : ""}
        ${l.endereco         ? `<tr><td>Endereço</td><td>${l.endereco}</td></tr>` : ""}
        ${l.email            ? `<tr><td>E-mail</td><td>${l.email}</td></tr>` : ""}
        ${l.telefone         ? `<tr><td>Telefone</td><td>${l.telefone}</td></tr>` : ""}
        <tr><td colspan="2" style="padding-top:8px;font-weight:700;color:#111;">Plano e Condições Comerciais</td></tr>
        <tr><td>Plano</td><td>${planoLabel}</td></tr>
        <tr><td>Mensalidade</td><td>${planoValor}</td></tr>
        <tr><td>Vencimento</td><td>Dia 5 de cada mês</td></tr>
        <tr><td>Taxa de Intermediação</td><td>${plano === "gold" ? "10% por pedido" : `${comissao}%`}</td></tr>
        <tr><td>Prazo de Repasse</td><td>3 dias úteis</td></tr>
        <tr><td colspan="2" style="padding-top:8px;font-weight:700;color:#111;">Identificação do Contrato</td></tr>
        <tr><td>Contrato ID</td><td>${(l.id ?? "—").toString().slice(0, 8).toUpperCase()}</td></tr>
        <tr><td>Data</td><td>${fmt(l.contrato_assinado_em) !== "—" ? fmt(l.contrato_assinado_em) : new Date().toLocaleDateString("pt-BR")}</td></tr>
      </table>
    </div>

    <div class="titulo-contrato">
      <p>CONTRATO DE PARCERIA COMERCIAL</p>
      <p class="subtitulo">PLATAFORMA CHEGÔ DELIVERY E LOJISTA PARCEIRO</p>
    </div>

    <p>Pelo presente instrumento particular, de um lado:</p>
    <p><strong>CHEGÔ DELIVERY</strong> (CNPJ 67.543.510/0001-86), MEI, com sede na Rua Pedro Nestor Pereira, nº 0, Quadra 14, Lote 24, Aragoiânia/GO, CEP 75330-000, representada por Livia Rayane Sousa da Silva, doravante <strong>"PLATAFORMA"</strong>;</p>
    <p>e, de outro lado:</p>
    <p><strong>${l.nome}</strong>${l.cnpj ? `, CNPJ ${l.cnpj}` : l.cpf_responsavel ? `, CPF ${l.cpf_responsavel}` : ""}${l.endereco ? `, endereço: ${l.endereco}` : ""}${l.nome_responsavel ? `, representado(a) por ${l.nome_responsavel}` : ""}, doravante <strong>"LOJISTA"</strong>.</p>
    <hr/>

    <p class="clausula">CLÁUSULA 1ª — OBJETO DO CONTRATO</p>
    <p>1.1. O presente contrato tem por objeto estabelecer as condições de parceria comercial entre a PLATAFORMA e o LOJISTA, mediante a qual a PLATAFORMA disponibilizará o aplicativo "Chegô Delivery" como canal digital para que o LOJISTA oferte e venda seus produtos a consumidores finais.</p>
    <p>1.2. A PLATAFORMA atua exclusivamente como intermediadora tecnológica, não sendo responsável pela relação de consumo entre o LOJISTA e o cliente final, nem pela qualidade, quantidade, composição ou segurança dos produtos comercializados.</p>

    <p class="clausula">CLÁUSULA 2ª — PRAZO DE VIGÊNCIA</p>
    <p>2.1. O presente contrato vigerá por prazo indeterminado a partir da data de assinatura, podendo ser rescindido por qualquer das PARTES mediante aviso prévio escrito de 30 (trinta) dias.</p>
    <p>2.2. A renovação se dará automaticamente, salvo manifestação expressa em contrário.</p>

    <p class="clausula">CLÁUSULA 3ª — PROCESSO DE INTEGRAÇÃO (ONBOARDING)</p>
    <p>3.1. O LOJISTA receberá acesso ao painel de gestão após: (a) assinatura deste contrato; (b) envio e aprovação da documentação exigida; (c) pagamento da primeira mensalidade, quando aplicável ao plano contratado.</p>
    <p>3.2. A PLATAFORMA realizará o onboarding em até 5 (cinco) dias úteis após o cumprimento integral dos itens acima.</p>

    <p class="clausula">CLÁUSULA 4ª — OBRIGAÇÕES DO LOJISTA</p>
    <p>4.1. O LOJISTA se obriga a: (a) manter cardápio atualizado com informações verídicas; (b) aceitar e preparar pedidos dentro dos horários cadastrados, respeitando prazo de preparo de até 30 (trinta) minutos; (c) garantir qualidade, higiene e segurança alimentar; (d) embalar adequadamente os itens para entrega; (e) comunicar à PLATAFORMA indisponibilidade temporária; (f) cumprir normas fiscais, sanitárias e trabalhistas; (g) tratar clientes e entregadores com urbanidade.</p>
    <p>4.2. O LOJISTA é exclusivamente responsável perante órgãos fiscais, sanitários e de defesa do consumidor pelos produtos que comercializa.</p>
    <p>4.3. O índice máximo tolerado de reclamações fundamentadas é de 5 (cinco) por mês. Superado esse limite, a PLATAFORMA poderá suspender ou rescindir o contrato.</p>

    <p class="clausula">CLÁUSULA 5ª — OBRIGAÇÕES DA PLATAFORMA</p>
    <p>5.1. A PLATAFORMA se obriga a: (a) disponibilizar ao LOJISTA acesso ao painel de gestão e vitrine no aplicativo; (b) promover o LOJISTA em seus canais próprios; (c) fornecer suporte técnico; (d) repassar valores devidos conforme Cláusula 6ª; (e) manter sigilo sobre informações comerciais do LOJISTA.</p>

    <p class="clausula">CLÁUSULA 6ª — PLANO COMERCIAL E CONDIÇÕES DE PAGAMENTO</p>
    <p>6.1. O LOJISTA contrata o plano <strong>${planoLabel}</strong> com mensalidade de <strong>${planoValor}</strong>, com vencimento no dia 10 de cada mês, mediante boleto bancário gerado pelo sistema Asaas.</p>
    <p>6.2. ${plano === "gold" ? "O plano Gold não possui mensalidade fixa; em contrapartida, a PLATAFORMA retém 10% (dez por cento) sobre cada pedido processado, a título de taxa de intermediação." : "O plano contratado não prevê taxa de intermediação sobre pedidos individuais."}</p>
    <p>6.3. O repasse dos valores líquidos ao LOJISTA ocorrerá em até 3 (três) dias úteis após o processamento dos pagamentos.</p>
    <p>6.4. Em caso de inadimplência, incidirão multa de 2% e juros de 1% ao mês. O não pagamento por 30 dias poderá resultar em suspensão imediata do acesso.</p>

    <p class="clausula">CLÁUSULA 7ª — PROCESSAMENTO DE PEDIDOS E PRAZO DE PREPARO</p>
    <p>7.1. O LOJISTA compromete-se a confirmar ou recusar pedidos em até 5 (cinco) minutos e a concluir o preparo em até 30 (trinta) minutos da confirmação, salvo comunicação prévia ao cliente.</p>
    <p>7.2. Pedidos não confirmados dentro do prazo poderão ser automaticamente cancelados, gerando penalidade conforme Cláusula 17ª.</p>

    <p class="clausula">CLÁUSULA 8ª — PROIBIÇÕES E RESTRIÇÕES</p>
    <p>8.1. É vedado ao LOJISTA: (a) oferecer produtos não cadastrados ou com informações falsas; (b) cobrar do cliente valores divergentes do cardápio; (c) usar a marca "Chegô Delivery" de forma que cause confusão; (d) ceder ou transferir acesso ao painel a terceiros não autorizados; (e) veicular publicidade negativa ou depreciativa da PLATAFORMA.</p>

    <p class="clausula">CLÁUSULA 9ª — EXCLUSIVIDADE E CONCORRÊNCIA</p>
    <p>9.1. O presente contrato não gera exclusividade. O LOJISTA pode operar em outros canais e plataformas, desde que não utilize informações, banco de dados ou recursos técnicos da PLATAFORMA.</p>

    <p class="clausula">CLÁUSULA 10ª — PROPRIEDADE INTELECTUAL</p>
    <p>10.1. A marca, logotipo e demais elementos de identidade visual do "Chegô Delivery" são de propriedade exclusiva da PLATAFORMA. O LOJISTA poderá utilizá-los apenas para divulgação da parceria.</p>

    <p class="clausula">CLÁUSULA 11ª — CONFIDENCIALIDADE</p>
    <p>11.1. As PARTES se obrigam a guardar sigilo das informações comerciais, financeiras e operacionais trocadas em razão deste contrato, durante toda a vigência e por 2 (dois) anos após o encerramento.</p>

    <p class="clausula">CLÁUSULA 12ª — PROTEÇÃO DE DADOS PESSOAIS (LGPD)</p>
    <p>12.1. As PARTES se comprometem a tratar dados pessoais em conformidade com a Lei nº 13.709/2018 (LGPD), utilizando-os estritamente para execução das atividades deste contrato.</p>
    <p>12.2. Em caso de incidente de segurança envolvendo dados pessoais, a parte ciente deverá notificar a outra imediatamente e adotar medidas de contenção.</p>

    <p class="clausula">CLÁUSULA 13ª — QUALIDADE, REPUTAÇÃO E RECLAMAÇÕES</p>
    <p>13.1. O LOJISTA autoriza a PLATAFORMA a exibir avaliações de clientes publicamente no aplicativo, comprometendo-se a responder às reclamações em até 24 horas.</p>
    <p>13.2. A PLATAFORMA poderá suspender preventivamente o LOJISTA enquanto investiga denúncias graves de descumprimento de normas sanitárias ou fraude.</p>

    <p class="clausula">CLÁUSULA 14ª — DISPONIBILIDADE DA PLATAFORMA</p>
    <p>14.1. A PLATAFORMA envidará esforços para manter o sistema disponível 24/7, mas não garante disponibilidade ininterrupta, não respondendo por danos decorrentes de instabilidades técnicas ou manutenções programadas devidamente comunicadas.</p>

    <p class="clausula">CLÁUSULA 15ª — RESCISÃO POR JUSTA CAUSA</p>
    <p>15.1. A PLATAFORMA poderá rescindir imediatamente, sem ônus, em caso de: (a) descumprimento grave de qualquer cláusula; (b) inadimplência superior a 30 dias; (c) prática de ato ilícito; (d) reincidência em reclamações superior ao limite da Cláusula 4.3.</p>
    <p>15.2. O LOJISTA poderá rescindir por justa causa em caso de descumprimento grave pela PLATAFORMA, mediante notificação escrita prévia de 15 dias para regularização.</p>

    <p class="clausula">CLÁUSULA 16ª — RESCISÃO IMOTIVADA</p>
    <p>16.1. Qualquer das PARTES poderá rescindir este contrato sem motivação, mediante aviso prévio escrito de 30 (trinta) dias, sem cobrança de multa rescisória.</p>
    <p>16.2. Durante o prazo de aviso prévio, as obrigações de ambas as PARTES permanecem em pleno vigor.</p>

    <p class="clausula">CLÁUSULA 17ª — PENALIDADES E MULTAS</p>
    <p>17.1. O descumprimento das obrigações previstas neste contrato sujeitará a parte infratora a: (a) notificação formal; (b) suspensão temporária do acesso; (c) rescisão contratual; (d) reparação de danos comprovados.</p>

    <p class="clausula">CLÁUSULA 18ª — DISPOSIÇÕES GERAIS</p>
    <p>18.1. Este instrumento representa a totalidade do acordo entre as PARTES, substituindo negociações ou entendimentos anteriores.</p>
    <p>18.2. Qualquer alteração deverá ser realizada por escrito e aceita por ambas as PARTES.</p>
    <p>18.3. A tolerância de uma PARTE em relação a descumprimentos da outra não implica renúncia ao direito de exigir o cumprimento posterior.</p>
    <p>18.4. Caso qualquer cláusula seja declarada nula, as demais permanecem válidas.</p>
    <p>18.5. O LOJISTA declara ter lido e compreendido integralmente este contrato, concordando livre e espontaneamente com todas as cláusulas.</p>
    <p>18.6. <strong>Assinatura eletrônica com validade jurídica:</strong> este contrato é firmado eletronicamente nos termos do art. 10, §2º, da Medida Provisória nº 2.200-2/2001. Para fins probatórios, ficam registrados: o endereço IP de origem, a data/hora da assinatura e o identificador único do contrato. A assinatura pelo portal Gov.br (ICP-Brasil) confere validade jurídica equivalente à assinatura manuscrita.</p>

    <p class="clausula">CLÁUSULA 19ª — FORO E JURISDIÇÃO</p>
    <p>19.1. As PARTES elegem o foro da Comarca de Aragoiânia, Estado de Goiás, para dirimir quaisquer controvérsias oriundas deste contrato, com renúncia expressa a qualquer outro foro.</p>

    <p class="local-data">Aragoiânia/GO, ${fmt(l.contrato_assinado_em) !== "—" ? fmt(l.contrato_assinado_em) : new Date().toLocaleDateString("pt-BR")}</p>
  `
}

// ─────────────────────────────────────────────────────────────────────────────
// Contrato de Motoboy (11 cláusulas — inalterado, mas mais organizado)
// ─────────────────────────────────────────────────────────────────────────────
function contratoMotoboyHtml(m: Record<string, any>): string {
  return `
    <div class="header-bloco">
      <p class="rotulo">Dados do entregador parceiro</p>
      <p class="nome">${m.nome ?? "—"}</p>
      <table class="dados-table">
        <tr><td>CPF</td><td>${m.cpf ?? "—"}</td></tr>
        ${m.cnh     ? `<tr><td>CNH</td><td>${m.cnh}</td></tr>` : ""}
        <tr><td>Veículo</td><td>${m.veiculo ?? "—"} · ${m.placa ?? "—"}</td></tr>
        ${m.telefone ? `<tr><td>Telefone</td><td>${m.telefone}</td></tr>` : ""}
        ${m.email    ? `<tr><td>E-mail</td><td>${m.email}</td></tr>` : ""}
        ${m.pix_key  ? `<tr><td>PIX</td><td>${m.pix_key}</td></tr>` : ""}
        <tr><td>Assinado em</td><td>${fmt(m.contrato_assinado_em)}</td></tr>
      </table>
    </div>

    <div class="titulo-contrato">
      <p>TERMO DE PARCERIA PARA PRESTAÇÃO DE SERVIÇOS DE ENTREGA</p>
      <p class="subtitulo">PLATAFORMA CHEGÔ DELIVERY E ENTREGADOR PARCEIRO (MOTOBOY) AUTÔNOMO</p>
    </div>

    <p>Pelo presente instrumento particular, de um lado:</p>
    <p><strong>CHEGÔ DELIVERY</strong> (CNPJ 67.543.510/0001-86), MEI, com sede na Rua Pedro Nestor Pereira, nº 0, Quadra 14, Lote 24, Aragoiânia/GO, representada por Livia Rayane Sousa da Silva, doravante <strong>"PLATAFORMA"</strong>;</p>
    <p>e, de outro lado:</p>
    <p><strong>${m.nome}</strong>, pessoa física, CPF nº ${m.cpf}${m.cnh ? `, CNH nº ${m.cnh}` : ""}, doravante <strong>"ENTREGADOR"</strong>.</p>
    <hr/>

    <p class="clausula">CLÁUSULA 1ª — DO OBJETO</p>
    <p>1.1. O presente Termo disciplina a parceria entre as PARTES, por meio da qual a PLATAFORMA disponibilizará ao ENTREGADOR acesso ao aplicativo "Chegô Delivery" para visualizar e aceitar, de forma livre e espontânea, solicitações de entrega.</p>
    <p>1.2. A PLATAFORMA atua exclusivamente como intermediadora tecnológica, não se confundindo com transportadora, operadora logística ou empregadora.</p>

    <p class="clausula">CLÁUSULA 2ª — DA NATUREZA AUTÔNOMA DA RELAÇÃO</p>
    <p>2.1. O ENTREGADOR presta seus serviços de forma absolutamente autônoma, eventual e por sua livre iniciativa, <strong>sem vínculo de emprego, subordinação, hierarquia ou exclusividade</strong> com a PLATAFORMA.</p>
    <p>2.2. O ENTREGADOR tem plena liberdade para: (a) conectar-se e desconectar-se nos dias e horários que melhor lhe convierem; (b) aceitar ou recusar qualquer solicitação, sem penalidade; (c) prestar serviços para outras plataformas.</p>
    <p>2.3. O ENTREGADOR não terá direito a férias, 13º salário, FGTS, aviso prévio ou verbas rescisórias trabalhistas, sendo responsável pelo próprio recolhimento previdenciário.</p>

    <p class="clausula">CLÁUSULA 3ª — DAS OBRIGAÇÕES DA PLATAFORMA</p>
    <p>3.1. A PLATAFORMA se obriga a: (a) disponibilizar o aplicativo para aceite de entregas; (b) informar em cada solicitação a origem, destino aproximado e valor antes do aceite; (c) efetuar o repasse dos valores devidos; (d) prestar suporte técnico.</p>

    <p class="clausula">CLÁUSULA 4ª — DA REMUNERAÇÃO</p>
    <p>4.1. Por cada entrega efetivamente realizada, o ENTREGADOR receberá valor fixo informado previamente no oferecimento da corrida.</p>
    <p>4.2. O repasse ocorrerá semanalmente, mediante transferência para conta bancária ou chave PIX indicada pelo ENTREGADOR.</p>
    <p>4.3. Bonificações e incentivos por meta poderão ser oferecidos a critério da PLATAFORMA, mediante comunicação prévia.</p>

    <p class="clausula">CLÁUSULA 5ª — DO VEÍCULO E EQUIPAMENTOS</p>
    <p>5.1. O ENTREGADOR utilizará veículo próprio ou alugado, sendo de sua exclusiva responsabilidade: (a) manter o veículo com documentação regular (CRLV e CNH compatível); (b) utilizar equipamentos de proteção (capacete e bag adequado); (c) custear combustível, manutenção e multas.</p>
    <p>5.2. O ENTREGADOR deverá possuir smartphone com plano de dados ativo e compatível com o aplicativo.</p>

    <p class="clausula">CLÁUSULA 6ª — DA RESPONSABILIDADE</p>
    <p>6.1. O ENTREGADOR é o único e exclusivo responsável por acidentes, infrações e danos causados a si ou a terceiros durante as entregas, <strong>isentando a PLATAFORMA de qualquer responsabilidade</strong>, ressalvada falha comprovada e exclusiva do sistema tecnológico.</p>
    <p>6.2. Em caso de avaria, perda ou extravio de produto, o ENTREGADOR deverá comunicar imediatamente o ocorrido.</p>

    <p class="clausula">CLÁUSULA 7ª — DA CONDUTA</p>
    <p>7.1. O ENTREGADOR se obriga a tratar clientes e lojistas com urbanidade e respeito, manter a integridade dos pedidos e não consumir bebida alcoólica ou substância que comprometa a condução durante as entregas.</p>
    <p>7.2. Reclamações reiteradas poderão resultar em suspensão ou bloqueio, assegurado o direito de manifestação prévia, salvo em casos graves.</p>

    <p class="clausula">CLÁUSULA 8ª — DA PROTEÇÃO DE DADOS (LGPD)</p>
    <p>8.1. As PARTES se obrigam a tratar dados pessoais em conformidade com a Lei nº 13.709/2018 (LGPD), utilizando-os exclusivamente para a execução das entregas.</p>

    <p class="clausula">CLÁUSULA 9ª — DA VIGÊNCIA E DO DESCADASTRAMENTO</p>
    <p>9.1. O presente Termo vigerá por prazo indeterminado, podendo ser encerrado a qualquer tempo por qualquer das PARTES sem necessidade de aviso prévio.</p>
    <p>9.2. A PLATAFORMA poderá suspender ou bloquear o acesso do ENTREGADOR imediatamente em caso de fraude, conduta inadequada grave ou descumprimento reiterado deste Termo.</p>

    <p class="clausula">CLÁUSULA 10ª — DISPOSIÇÕES GERAIS</p>
    <p>10.1. Este Termo representa a totalidade do acordo entre as PARTES.</p>
    <p>10.2. O ENTREGADOR declara ter lido e compreendido integralmente este Termo, manifestando sua livre e espontânea concordância.</p>

    <p class="clausula">CLÁUSULA 11ª — DO FORO</p>
    <p>11.1. As PARTES elegem o foro da Comarca de Aragoiânia, Estado de Goiás, para dirimir quaisquer controvérsias decorrentes deste Termo.</p>

    <p class="local-data">Aragoiânia/GO, ${fmt(m.contrato_assinado_em)}</p>
  `
}

// ─────────────────────────────────────────────────────────────────────────────
// Seção de assinaturas — aceita canvas image, gov.br ou presencial
// ─────────────────────────────────────────────────────────────────────────────
function secaoAssinatura(data: Record<string, any>, tipo: string, preview: boolean): string {
  if (preview) {
    return `
      <div class="assinatura-section">
        <div class="assinatura-grid">
          <div class="assinatura-bloco">
            <div style="height:80px;"></div>
            <div class="linha"></div>
            <p class="label">Chegô Delivery (Plataforma)</p>
            <p class="sub">CNPJ 67.543.510/0001-86 · Livia Rayane Sousa da Silva</p>
          </div>
          <div class="assinatura-bloco">
            <div style="height:80px;border:2px dashed #e5e7eb;border-radius:6px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;">
              <p style="color:#9ca3af;font-size:11px;font-family:system-ui,sans-serif;">Aguardando assinatura</p>
            </div>
            <div class="linha"></div>
            <p class="label">${tipo === "loja" ? "Lojista Parceiro" : "Entregador Parceiro"}</p>
            <p class="sub">${data.nome ?? "—"}</p>
          </div>
        </div>
      </div>
    `
  }

  const modalidade = data.modalidade_assinatura as string | undefined
  const assinatura  = data.contrato_assinatura  as string | undefined
  const pdfUrl      = data.contrato_pdf_url     as string | undefined

  let blocoAssinatura = ""
  if (modalidade === "gov_br") {
    blocoAssinatura = `
      <div style="padding:16px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:6px;margin-bottom:8px;text-align:center;">
        <p style="font-size:20px;margin-bottom:6px;">🔐</p>
        <p style="font-size:12px;font-weight:700;color:#1d4ed8;font-family:system-ui,sans-serif;">Assinado digitalmente via Gov.br (ICP-Brasil)</p>
        <p style="font-size:10px;color:#6b7280;font-family:system-ui,sans-serif;margin-top:4px;">Assinatura com certificado digital — validade jurídica plena (MP 2.200-2/2001)</p>
        ${pdfUrl ? `<a href="${pdfUrl}" style="display:inline-block;margin-top:8px;font-size:10px;color:#2563eb;font-family:system-ui,sans-serif;">Ver PDF assinado ↗</a>` : ""}
      </div>
    `
  } else if (modalidade === "presencial") {
    blocoAssinatura = `
      <div style="padding:16px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:6px;margin-bottom:8px;text-align:center;">
        <p style="font-size:20px;margin-bottom:6px;">🤝</p>
        <p style="font-size:12px;font-weight:700;color:#15803d;font-family:system-ui,sans-serif;">Assinado presencialmente</p>
        <p style="font-size:10px;color:#6b7280;font-family:system-ui,sans-serif;margin-top:4px;">Contrato físico assinado e arquivado pela equipe Chegô Delivery</p>
      </div>
    `
  } else if (assinatura) {
    blocoAssinatura = `
      <div class="assinatura-img-wrap"><img src="${assinatura}" alt="Assinatura digital"/></div>
    `
  }

  return `
    <div class="assinatura-section">
      <div class="assinatura-grid">
        <div class="assinatura-bloco">
          <div style="height:80px;"></div>
          <div class="linha"></div>
          <p class="label">Chegô Delivery (Plataforma)</p>
          <p class="sub">CNPJ 67.543.510/0001-86</p>
          <p class="sub">Livia Rayane Sousa da Silva</p>
        </div>
        <div class="assinatura-bloco">
          ${blocoAssinatura}
          <div class="linha"></div>
          <p class="label">${tipo === "loja" ? "Lojista Parceiro" : "Entregador Parceiro"}</p>
          <p class="sub">${data.nome ?? "—"}</p>
          <p class="sub" style="color:#9ca3af;font-size:10px;">
            ${fmt(data.contrato_assinado_em) !== "—" ? `Assinado em ${fmt(data.contrato_assinado_em)}` : ""}
          </p>
        </div>
      </div>
    </div>
  `
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chego-ctrl/contrato?tipo=loja|motoboy&id=xxx[&modo=preview]
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const tipo    = req.nextUrl.searchParams.get("tipo")   // "loja" | "motoboy"
  const id      = req.nextUrl.searchParams.get("id")
  const preview = req.nextUrl.searchParams.get("modo") === "preview"

  if (!tipo || !id) {
    return new NextResponse("Parâmetros inválidos", { status: 400 })
  }

  const tabela = tipo === "loja" ? "lojas" : "motoboys"
  const { data, error } = await admin.from(tabela).select("*").eq("id", id).single()

  if (error || !data) {
    return new NextResponse("Contrato não encontrado", { status: 404 })
  }

  if (!preview && !data.contrato_assinado) {
    return new NextResponse("Este contrato ainda não foi assinado", { status: 422 })
  }

  const nome   = data.nome ?? "—"
  const titulo = tipo === "loja" ? "Contrato de Parceria — Loja" : "Termo de Parceria — Motoboy"
  const corpo  = tipo === "loja" ? contratoLojaHtml(data) : contratoMotoboyHtml(data)
  const assBloco = secaoAssinatura(data, tipo, preview)

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${titulo} — ${nome}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, "Times New Roman", serif; font-size: 13px; line-height: 1.7; color: #111; background: #f4f4f0; }
    .page { max-width: 800px; margin: 0 auto; background: white; padding: 56px 64px; min-height: 100vh; }

    .toolbar { position: fixed; top: 0; left: 0; right: 0; background: white; border-bottom: 1px solid #e5e7eb; padding: 10px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .toolbar-info { font-family: system-ui, sans-serif; font-size: 13px; color: #374151; font-weight: 600; }
    .toolbar-info span { color: #f97316; }
    .btn-print { font-family: system-ui, sans-serif; background: #f97316; color: white; border: none; padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .btn-print:hover { background: #ea580c; }
    .toolbar-spacer { height: 52px; }

    .doc-header { text-align: center; margin-bottom: 36px; padding-bottom: 28px; border-bottom: 2px solid #111; }
    .doc-header .brand { font-family: system-ui, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #f97316; margin-bottom: 6px; }
    .doc-header h1 { font-size: 18px; font-weight: 900; color: #111; letter-spacing: -0.3px; }

    .header-bloco { border: 1px solid #d1d5db; border-radius: 6px; padding: 16px 20px; margin-bottom: 28px; background: #fafaf9; }
    .header-bloco .rotulo { font-family: system-ui, sans-serif; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #9ca3af; margin-bottom: 6px; }
    .header-bloco .nome { font-size: 16px; font-weight: 900; color: #111; margin-bottom: 10px; }
    .dados-table { width: 100%; border-collapse: collapse; }
    .dados-table td { padding: 4px 0; font-size: 12px; vertical-align: top; }
    .dados-table td:first-child { color: #6b7280; width: 160px; font-family: system-ui, sans-serif; font-weight: 600; }
    .dados-table td:last-child { color: #111; font-weight: 600; }

    .titulo-contrato { text-align: center; margin: 28px 0 20px; }
    .titulo-contrato p:first-child { font-size: 14px; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 0.5px; }
    .titulo-contrato .subtitulo { font-size: 10px; color: #6b7280; margin-top: 4px; font-family: system-ui, sans-serif; text-transform: uppercase; letter-spacing: 1px; }

    p { margin-bottom: 10px; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
    .clausula { font-weight: 700; color: #111; margin-top: 18px; margin-bottom: 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; }
    .local-data { margin-top: 24px; color: #6b7280; font-style: italic; font-size: 12px; }
    strong { color: #111; }

    .assinatura-section { margin-top: 48px; padding-top: 32px; border-top: 2px solid #111; }
    .assinatura-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 32px; }
    .assinatura-bloco { text-align: center; }
    .assinatura-bloco .linha { border-top: 1px solid #111; margin-bottom: 6px; }
    .assinatura-bloco .label { font-family: system-ui, sans-serif; font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .assinatura-bloco .sub { font-size: 11px; color: #374151; margin-top: 2px; }
    .assinatura-img-wrap { border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; margin-bottom: 8px; background: #fafaf9; }
    .assinatura-img-wrap img { width: 100%; display: block; max-height: 160px; object-fit: contain; }

    @media print {
      body { background: white; }
      .toolbar, .toolbar-spacer { display: none !important; }
      .page { padding: 24px 32px; max-width: none; }
      @page { margin: 20mm; size: A4 portrait; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <p class="toolbar-info">Chegô Delivery — <span>${titulo}</span> · ${nome}</p>
    <button class="btn-print" onclick="window.print()">⬇ Salvar como PDF</button>
  </div>
  <div class="toolbar-spacer"></div>

  <div class="page">
    <div class="doc-header">
      <p class="brand">Chegô Delivery</p>
      <h1>${titulo}</h1>
    </div>

    ${corpo}
    ${assBloco}
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
