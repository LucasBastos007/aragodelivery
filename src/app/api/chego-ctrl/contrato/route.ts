import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/session"

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLANO_LABEL: Record<string, string> = { select: "Select", prime: "Prime", black: "Black", gold: "10% por Pedido" }
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
        <tr><td>Vencimento</td><td>Dia 10 de cada mês</td></tr>
        <tr><td>Taxa de Intermediação</td><td>${plano === "gold" ? "10% por pedido" : `${comissao}%`}</td></tr>
        <tr><td>Repasse semanal</td><td>Toda sexta-feira</td></tr>
        <tr><td>Saques extras</td><td>Toda terça-feira · Taxa R$ 5,00</td></tr>
        <tr><td colspan="2" style="padding-top:8px;font-weight:700;color:#111;">Identificação do Contrato</td></tr>
        <tr><td>Contrato ID</td><td>${(l.id ?? "—").toString().slice(0, 8).toUpperCase()}</td></tr>
        <tr><td>Data</td><td>${fmt(l.contrato_assinado_em) !== "—" ? fmt(l.contrato_assinado_em) : new Date().toLocaleDateString("pt-BR")}</td></tr>
      </table>
    </div>

    <div class="titulo-contrato">
      <p>CONTRATO DE CREDENCIAMENTO DE ESTABELECIMENTO PARCEIRO</p>
      <p class="subtitulo">PLATAFORMA CHEGÔ DELIVERY E ESTABELECIMENTO PARCEIRO (LOJISTA)</p>
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
    <p>6.1. O LOJISTA contrata o plano <strong>${planoLabel}</strong> com mensalidade de <strong>${planoValor}</strong>, com vencimento no dia 10 de cada mês, mediante boleto bancário ou pix gerado pelo sistema.</p>
    <p>6.2. ${plano === "gold" ? "O plano 10% por Pedido não possui mensalidade fixa; em contrapartida, a PLATAFORMA retém 10% (dez por cento) sobre cada pedido processado, a título de taxa de intermediação." : "O plano contratado não prevê taxa de intermediação sobre pedidos individuais."}</p>
    <p>6.3. O repasse dos valores líquidos ao LOJISTA ocorrerá toda sexta-feira, de forma semanal. O LOJISTA poderá solicitar saques extras às terças-feiras, com incidência de taxa administrativa de R$ 5,00 (cinco reais) por saque adicional.</p>
    <p>6.4. Em caso de inadimplência, incidirão multa de 2% (dois por cento) e juros de 1% (um por cento) ao mês, calculados sobre o valor em atraso. O bloqueio do acesso ao painel ocorrerá a partir do 4º (quarto) dia de atraso no pagamento da mensalidade.</p>

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
    <p>15.1. A PLATAFORMA poderá rescindir imediatamente, sem ônus, em caso de: (a) descumprimento grave de qualquer cláusula; (b) inadimplência a partir do 4º (quarto) dia de atraso; (c) prática de ato ilícito; (d) reincidência em reclamações superior ao limite da Cláusula 4.3.</p>
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
    <p>19.1. As PARTES elegem o foro da Comarca de Guapó, Estado de Goiás, para dirimir quaisquer controvérsias oriundas deste contrato, com renúncia expressa a qualquer outro foro.</p>

    <p class="local-data">Aragoiânia/GO, ${fmt(l.contrato_assinado_em) !== "—" ? fmt(l.contrato_assinado_em) : new Date().toLocaleDateString("pt-BR")}</p>
  `
}

// ─────────────────────────────────────────────────────────────────────────────
// Contrato de Entregador Parceiro (81 cláusulas — 7 partes)
// ─────────────────────────────────────────────────────────────────────────────
function contratoMotoboyHtml(m: Record<string, any>): string {
  return `
    <div class="header-bloco">
      <p class="rotulo">Dados do entregador parceiro</p>
      <p class="nome">${m.nome ?? "—"}</p>
      <table class="dados-table">
        <tr><td>CPF</td><td>${m.cpf ?? "—"}</td></tr>
        ${m.rg       ? `<tr><td>RG</td><td>${m.rg}</td></tr>` : ""}
        ${m.cnh      ? `<tr><td>CNH</td><td>${m.cnh}</td></tr>` : ""}
        <tr><td>Veículo</td><td>${m.veiculo ?? "—"}${m.placa ? ` · ${m.placa}` : ""}</td></tr>
        ${m.endereco ? `<tr><td>Endereço</td><td>${m.endereco}</td></tr>` : ""}
        ${m.telefone ? `<tr><td>Telefone</td><td>${m.telefone}</td></tr>` : ""}
        ${m.email    ? `<tr><td>E-mail</td><td>${m.email}</td></tr>` : ""}
        ${m.pix_key  ? `<tr><td>PIX</td><td>${m.pix_key}</td></tr>` : ""}
        <tr><td>Assinado em</td><td>${fmt(m.contrato_assinado_em)}</td></tr>
      </table>
    </div>

    <div class="titulo-contrato">
      <p>CONTRATO DE CREDENCIAMENTO DE ENTREGADOR PARCEIRO</p>
      <p class="subtitulo">PLATAFORMA CHEGÔ DELIVERY E ENTREGADOR PARCEIRO</p>
    </div>

    <p>Pelo presente instrumento particular, de um lado:</p>
    <p><strong>67.543.510 LIVIA RAYANE SOUSA DA SILVA</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob nº 67.543.510/0001-86, com sede na Rua Pedro Nestor Pereira, nº 0, Quadra 14, Lote 24, Aragoiânia/GO, CEP 75.330-000, proprietária da plataforma tecnológica denominada <strong>CHEGÔ DELIVERY</strong>, doravante denominada simplesmente <strong>CHEGÔ</strong>, <strong>PLATAFORMA</strong> ou <strong>CONTRATANTE</strong>;</p>
    <p>e, de outro lado:</p>
    <p><strong>${m.nome}</strong>, CPF nº ${m.cpf ?? "—"}${m.rg ? `, RG ${m.rg}` : ""}${m.cnh ? `, CNH nº ${m.cnh}` : ""}${m.endereco ? `, endereço: ${m.endereco}` : ""}, doravante denominado <strong>ENTREGADOR PARCEIRO</strong>.</p>
    <hr/>

    <p class="parte-titulo">PARTE I — DA QUALIFICAÇÃO DAS PARTES, DAS DEFINIÇÕES E DAS DECLARAÇÕES INICIAIS</p>

    <p class="clausula">CLÁUSULA 1ª — DO OBJETO</p>
    <p>1.1. O presente contrato tem por objeto disciplinar o credenciamento do ENTREGADOR PARCEIRO para utilização da plataforma tecnológica CHEGÔ, destinada à intermediação de entregas solicitadas por consumidores junto aos estabelecimentos parceiros cadastrados.</p>
    <p>1.2. A CHEGÔ atua exclusivamente como plataforma tecnológica de intermediação entre clientes, estabelecimentos parceiros e entregadores parceiros.</p>
    <p>1.3. O presente contrato não possui natureza trabalhista, não cria vínculo empregatício, sociedade, associação, representação comercial, franquia, mandato, agência ou qualquer outra relação além da expressamente prevista neste instrumento.</p>
    <p>1.4. A atividade exercida pelo ENTREGADOR PARCEIRO possui natureza autônoma, eventual e independente.</p>
    <p>1.5. O ENTREGADOR PARCEIRO possui plena liberdade para decidir quando deseja permanecer conectado à plataforma, respeitadas as regras previstas neste contrato.</p>

    <p class="clausula">CLÁUSULA 2ª — DAS DEFINIÇÕES</p>
    <p>Para fins deste contrato: I – Plataforma: sistema eletrônico pertencente à CHEGÔ; II – Aplicativo: software utilizado pelos entregadores; III – Pedido: solicitação realizada pelo cliente; IV – Corrida: entrega aceita pelo entregador; V – Cliente: consumidor final; VI – Lojista: estabelecimento parceiro; VII – Bag: mochila térmica utilizada para transporte dos pedidos; VIII – Painel Administrativo: sistema interno utilizado pela CHEGÔ; IX – Suporte: equipe responsável pela operação da plataforma; X – Horário de Pico: períodos de maior demanda operacional.</p>

    <p class="clausula">CLÁUSULA 3ª — DA NATUREZA DA PARCERIA</p>
    <p>3.1. O ENTREGADOR PARCEIRO exercerá suas atividades com absoluta autonomia.</p>
    <p>3.2. A CHEGÔ não estabelecerá: I – jornada de trabalho; II – controle de ponto; III – horário obrigatório; IV – escala de trabalho; V – quantidade mínima de horas; VI – quantidade mínima de entregas; VII – exclusividade.</p>
    <p>3.3. O ENTREGADOR poderá prestar serviços para outras plataformas de entrega, desde que isso não prejudique a boa execução das entregas aceitas na CHEGÔ.</p>

    <p class="clausula">CLÁUSULA 4ª — DO CADASTRO</p>
    <p>4.1. O credenciamento dependerá da aprovação cadastral realizada pela CHEGÔ. 4.2. Poderão ser solicitados: CPF, documento oficial com foto, selfie para validação, foto do veículo, comprovante de endereço, dados bancários e outros documentos necessários à segurança da plataforma. 4.3. A CHEGÔ poderá consultar bancos de dados públicos ou privados para validação das informações. 4.4. A aprovação do cadastro constitui mera faculdade da CHEGÔ, não gerando direito adquirido ao credenciamento.</p>

    <p class="clausula">CLÁUSULA 5ª — DA CNH E DOS REQUISITOS PARA CONDUÇÃO</p>
    <p>5.1. Os entregadores que utilizarem motocicleta ou automóvel deverão possuir habilitação compatível ou, excepcionalmente, enquadrar-se nas regras de cadastro provisório estabelecidas pela CHEGÔ.</p>
    <p>5.2. A critério exclusivo da CHEGÔ, poderá ser admitido cadastro provisório de entregador que ainda não possua CNH definitiva, desde que comprove haver iniciado formalmente o processo de obtenção da habilitação e assine Termo de Responsabilidade específico.</p>
    <p>5.3. O cadastro provisório poderá ser suspenso a qualquer momento caso o entregador deixe de cumprir as condições estabelecidas pela CHEGÔ ou pela legislação aplicável.</p>
    <p>5.4. O ENTREGADOR declara estar ciente de que é o único responsável pela condução do veículo, respondendo integralmente pelas consequências de eventual condução irregular.</p>
    <p>5.5. A manutenção da regularidade da CNH, quando exigível, é de responsabilidade exclusiva do ENTREGADOR.</p>

    <p class="parte-titulo">PARTE II — DA AUTONOMIA DA ATIVIDADE, DA AUSÊNCIA DE VÍNCULO EMPREGATÍCIO E DA LIBERDADE OPERACIONAL</p>

    <p class="clausula">CLÁUSULA 6ª — DA NATUREZA AUTÔNOMA DA ATIVIDADE</p>
    <p>6.1. O ENTREGADOR PARCEIRO exercerá suas atividades de forma autônoma, independente e por sua exclusiva iniciativa, utilizando a plataforma CHEGÔ apenas como ferramenta tecnológica de intermediação.</p>
    <p>6.2. O presente contrato não cria vínculo empregatício entre a CHEGÔ e o ENTREGADOR PARCEIRO, inexistindo qualquer relação de emprego prevista nos artigos 2º e 3º da CLT.</p>
    <p>6.3. As PARTES reconhecem expressamente que a parceria possui natureza civil e comercial, não sendo caracterizada por subordinação jurídica, pessoalidade obrigatória, habitualidade compulsória ou remuneração fixa.</p>
    <p>6.4. O ENTREGADOR PARCEIRO declara possuir autonomia para organizar sua rotina de trabalho, assumindo integralmente os riscos inerentes à atividade por ele desempenhada.</p>

    <p class="clausula">CLÁUSULA 7ª — DA LIBERDADE DE HORÁRIOS</p>
    <p>7.1. O ENTREGADOR PARCEIRO possui total liberdade para definir os dias e horários em que permanecerá conectado à plataforma. 7.2. A CHEGÔ não estabelece jornada mínima ou máxima de trabalho. 7.3. Não haverá controle de ponto, registro de jornada, escala obrigatória ou exigência de permanência online. 7.4. A simples permanência desconectado da plataforma não constitui infração contratual.</p>
    <p>7.6. A CHEGÔ poderá divulgar informações sobre horários de maior demanda operacional, atualmente compreendidos, em regra, entre: I – das 7h00 às 9h00; II – das 11h00 às 13h30; III – das 18h30 às 23h00. Esses horários possuem caráter exclusivamente informativo, não gerando qualquer obrigação de conexão.</p>

    <p class="clausula">CLÁUSULA 8ª — DA LIBERDADE DE ACEITAR OU RECUSAR ENTREGAS</p>
    <p>8.1. O ENTREGADOR PARCEIRO possui plena liberdade para aceitar ou recusar qualquer solicitação de entrega disponibilizada pela plataforma. 8.2. A recusa de entregas não caracteriza descumprimento contratual nem gera penalidade automática. 8.3. Recusas reiteradas poderão influenciar exclusivamente os critérios algorítmicos de distribuição das próximas solicitações, visando maior eficiência operacional. 8.4. A redução da prioridade na distribuição de pedidos não constitui punição disciplinar, mas consequência do funcionamento automático do sistema.</p>

    <p class="clausula">CLÁUSULA 9ª — DA ATUAÇÃO EM OUTRAS PLATAFORMAS</p>
    <p>9.1. O ENTREGADOR PARCEIRO poderá prestar serviços para outras plataformas de delivery ou exercer qualquer outra atividade profissional. 9.2. A CHEGÔ não exige exclusividade. 9.3. A utilização simultânea de outras plataformas não poderá comprometer a correta execução das entregas previamente aceitas na CHEGÔ. 9.4. Após aceitar uma entrega pela CHEGÔ, o ENTREGADOR deverá concluí-la com diligência, segurança e boa-fé.</p>

    <p class="clausula">CLÁUSULA 10ª — DAS ENTREGAS PARTICULARES</p>
    <p>10.1. O ENTREGADOR poderá realizar entregas particulares desde que esteja desconectado da plataforma CHEGÔ. 10.2. É expressamente proibido utilizar a plataforma CHEGÔ para captar clientes, lojistas ou entregas particulares. 10.3. É vedado oferecer transporte, entrega ou qualquer serviço diretamente ao cliente ou ao estabelecimento parceiro durante uma operação originada na plataforma. 10.4. É proibido negociar valores ou receber pagamentos fora do sistema CHEGÔ relativamente a pedidos iniciados na plataforma.</p>

    <p class="clausula">CLÁUSULA 11ª — DA INATIVIDADE</p>
    <p>11.1. Caso o ENTREGADOR permaneça por período igual ou superior a 30 (trinta) dias consecutivos sem realizar qualquer entrega, a CHEGÔ poderá entrar em contato para confirmar seu interesse em permanecer credenciado. 11.2. Persistindo a inatividade por 60 (sessenta) dias consecutivos, a CHEGÔ poderá bloquear preventivamente o cadastro. 11.3. O bloqueio por inatividade não possui natureza punitiva e tem por finalidade manter a base cadastral atualizada. 11.4. A reativação dependerá da confirmação de interesse do ENTREGADOR, atualização cadastral e eventual apresentação de documentos solicitados.</p>

    <p class="clausula">CLÁUSULA 12ª — DA AUTONOMIA FINANCEIRA</p>
    <p>12.1. O ENTREGADOR PARCEIRO é integralmente responsável pela administração de sua atividade econômica. 12.2. Compete exclusivamente ao ENTREGADOR arcar com despesas relacionadas à execução das entregas, incluindo: combustível, manutenção do veículo, pneus, óleo, revisões, estacionamento, internet móvel, aparelho celular, equipamentos de proteção individual, tributos incidentes sobre sua atividade, multas de trânsito e seguros particulares. 12.3. A CHEGÔ não realizará reembolso dessas despesas, salvo quando houver previsão expressa em campanha, promoção ou instrumento específico.</p>

    <p class="parte-titulo">PARTE III — DO CADASTRO, DA SEGURANÇA DA CONTA, DA GEOLOCALIZAÇÃO, DA PREVENÇÃO À FRAUDE E DO USO DA PLATAFORMA</p>

    <p class="clausula">CLÁUSULA 13ª — DA CONTA DO ENTREGADOR</p>
    <p>13.1. O cadastro realizado junto à CHEGÔ é individual, pessoal, intransferível e vinculado exclusivamente ao ENTREGADOR PARCEIRO aprovado pela plataforma. 13.2. É expressamente proibido: emprestar, vender, alugar ou ceder a conta; permitir que terceiros utilizem seu cadastro ou realizem entregas utilizando sua conta. 13.3. A violação desta cláusula constitui infração gravíssima e poderá ensejar suspensão imediata, bloqueio cautelar ou descredenciamento definitivo.</p>

    <p class="clausula">CLÁUSULA 14ª — DO ACESSO À PLATAFORMA</p>
    <p>14.1. O acesso será realizado mediante login e autenticação definidos pela CHEGÔ. 14.2. O ENTREGADOR deverá manter em sigilo: senha, códigos de autenticação, links de acesso e informações de segurança. 14.3. A CHEGÔ poderá exigir autenticação adicional sempre que identificar situação de risco. 14.4. Em caso de suspeita de invasão, fraude ou acesso indevido, a plataforma poderá bloquear preventivamente a conta até conclusão da análise.</p>

    <p class="clausula">CLÁUSULA 15ª — DOS DISPOSITIVOS UTILIZADOS</p>
    <p>15.1. É vedada a utilização simultânea da mesma conta por pessoas diferentes. 15.2. Constituem indícios de irregularidade: acessos simultâneos incompatíveis, utilização da conta em localidades incompatíveis, múltiplos dispositivos utilizados de forma suspeita e compartilhamento de credenciais. 15.3. Verificada suspeita razoável, a CHEGÔ poderá solicitar nova validação de identidade.</p>

    <p class="clausula">CLÁUSULA 16ª — DA IDENTIFICAÇÃO DO ENTREGADOR</p>
    <p>16.1. A CHEGÔ poderá solicitar, a qualquer momento: selfie, fotografia do documento, fotografia do veículo, confirmação de dados cadastrais e outros meios tecnológicos destinados à confirmação da identidade. 16.2. A recusa injustificada poderá resultar em suspensão temporária do cadastro até a regularização.</p>

    <p class="clausula">CLÁUSULA 17ª — DA GEOLOCALIZAÇÃO</p>
    <p>17.1. O ENTREGADOR autoriza a CHEGÔ a coletar sua localização geográfica durante a utilização da plataforma. 17.2. A geolocalização poderá ser utilizada para: distribuição de entregas, acompanhamento da operação, segurança do entregador, segurança do cliente, prevenção à fraude, resolução de conflitos, auditorias, atendimento ao suporte e cumprimento de obrigações legais. 17.3. O ENTREGADOR declara ciência de que a desativação do GPS poderá impedir o correto funcionamento da plataforma.</p>

    <p class="clausula">CLÁUSULA 18ª — DOS REGISTROS OPERACIONAIS</p>
    <p>18.1. A CHEGÔ poderá registrar automaticamente: horários de login/logout, horário de aceite da entrega, horários de chegada ao estabelecimento e ao destino, tempo de deslocamento, rota percorrida, distância percorrida e demais informações necessárias à operação. 18.2. Os registros poderão ser utilizados como prova em procedimentos internos, administrativos ou judiciais. 18.3. Os dados poderão ser armazenados pelo prazo mínimo de 6 (seis) meses ou por período superior quando exigido por lei.</p>

    <p class="clausula">CLÁUSULA 19ª — DA PREVENÇÃO À FRAUDE</p>
    <p>19.1. É proibida qualquer conduta destinada a fraudar a plataforma. 19.2. Constituem exemplos de fraude: utilização de GPS falso, manipulação de localização, utilização de aplicativos de automação, compartilhamento de conta, criação de contas falsas, combinação fraudulenta com clientes ou estabelecimentos, entregas simuladas, retirada de pedidos sem intenção de entrega, adulteração de comprovantes, falsificação de documentos e qualquer tentativa de obtenção de vantagem indevida.</p>

    <p class="clausula">CLÁUSULA 20ª — DA SUSPENSÃO CAUTELAR</p>
    <p>20.1. A CHEGÔ poderá suspender preventivamente o cadastro sempre que houver indícios razoáveis de fraude, risco à segurança da operação ou violação grave deste contrato. 20.2. A suspensão cautelar não constitui penalidade definitiva. 20.3. Concluída a investigação, a CHEGÔ poderá: restabelecer integralmente o cadastro, aplicar advertência, aplicar suspensão disciplinar ou promover o descredenciamento definitivo.</p>

    <p class="clausula">CLÁUSULA 21ª — DAS FOTOS E COMPROVAÇÕES DE ENTREGA</p>
    <p>21.1. A CHEGÔ poderá solicitar fotografia da entrega, da embalagem ou do local de entrega para fins de: comprovação da entrega, resolução de reclamações, prevenção à fraude e defesa em processos judiciais ou administrativos. 21.2. O ENTREGADOR deverá respeitar a privacidade dos clientes durante a obtenção das imagens.</p>

    <p class="clausula">CLÁUSULA 22ª — DOS REGISTROS DE IMAGEM EM SITUAÇÕES EXCEPCIONAIS</p>
    <p>22.1. Como regra geral, o ENTREGADOR não poderá gravar clientes, estabelecimentos parceiros ou colaboradores da CHEGÔ durante a execução das entregas. 22.2. Excepcionalmente, será admitida a realização de registros de imagem quando houver: acidente de trânsito, tentativa de fraude, ameaça, agressão, dano ao patrimônio, prática criminosa ou determinação de autoridade competente. 22.3. Os registros obtidos deverão ser encaminhados exclusivamente à CHEGÔ ou às autoridades competentes, sendo vedada sua divulgação em redes sociais ou qualquer meio público, salvo autorização legal ou decisão judicial.</p>

    <p class="clausula">CLÁUSULA 23ª — DO SIGILO DAS INFORMAÇÕES DA PLATAFORMA</p>
    <p>23.1. O ENTREGADOR compromete-se a manter absoluto sigilo sobre todas as informações obtidas em razão da utilização da plataforma. 23.2. É proibido divulgar: dados de clientes, telefones, endereços, informações de estabelecimentos parceiros, valores internos, telas do sistema, relatórios, procedimentos internos, informações estratégicas e qualquer dado não público da CHEGÔ. 23.3. O dever de confidencialidade permanecerá vigente mesmo após o encerramento da parceria.</p>

    <p class="clausula">CLÁUSULA 24ª — DO USO DA MARCA CHEGÔ</p>
    <p>24.1. A marca CHEGÔ, seu logotipo, identidade visual, aplicativo, layouts, materiais gráficos e demais elementos distintivos são de propriedade exclusiva da plataforma. 24.2. O ENTREGADOR não poderá utilizá-los para finalidade diversa daquela autorizada pela CHEGÔ. 24.3. É vedado utilizar a marca CHEGÔ para divulgar serviços particulares, concorrentes ou quaisquer atividades estranhas à operação da plataforma.</p>

    <p class="parte-titulo">PARTE IV — DA BAG, DO VEÍCULO, DA APRESENTAÇÃO PESSOAL, DA HIGIENE E DA CONDUTA DO ENTREGADOR</p>

    <p class="clausula">CLÁUSULA 25ª — DA BAG TÉRMICA</p>
    <p>25.1. As entregas realizadas por intermédio da plataforma CHEGÔ deverão ser transportadas em bag térmica adequada, capaz de preservar a integridade, higiene e temperatura dos produtos. 25.2. O ENTREGADOR poderá utilizar bag própria, desde que esteja em boas condições de uso, ou bag disponibilizada pela CHEGÔ, quando houver. 25.3. A utilização de bag inadequada poderá impedir o recebimento de pedidos pelos estabelecimentos parceiros.</p>

    <p class="clausula">CLÁUSULA 26ª — DA BAG FORNECIDA PELA CHEGÔ</p>
    <p>26.1. A bag eventualmente fornecida pela CHEGÔ permanecerá sendo de propriedade exclusiva da plataforma. 26.2. A entrega da bag não caracteriza venda, doação, comodato definitivo ou qualquer transferência de propriedade. 26.3. O ENTREGADOR receberá a bag exclusivamente para utilização durante a parceria firmada com a CHEGÔ.</p>

    <p class="clausula">CLÁUSULA 27ª — DA CONSERVAÇÃO DA BAG</p>
    <p>27.1. O ENTREGADOR deverá manter a bag sempre: limpa, higienizada, fechada durante o transporte, em boas condições estruturais e apta ao transporte seguro dos pedidos. 27.2. É proibido utilizar a bag para transportar produtos que possam contaminá-la. 27.3. O desgaste natural decorrente do uso regular não gerará cobrança ao ENTREGADOR.</p>

    <p class="clausula">CLÁUSULA 28ª — DA PERDA, FURTO E EXTRAVIO</p>
    <p>28.1. Em caso de perda, furto, roubo ou extravio da bag fornecida pela CHEGÔ, o ENTREGADOR deverá comunicar imediatamente a plataforma. 28.2. Na hipótese de perda, furto ou extravio, o ENTREGADOR responderá pelo ressarcimento do valor da bag, observado o contraditório e a análise das circunstâncias do caso.</p>

    <p class="clausula">CLÁUSULA 29ª — DA DEVOLUÇÃO DA BAG</p>
    <p>29.1. Encerrada a parceria, por qualquer motivo, o ENTREGADOR deverá devolver a bag fornecida pela CHEGÔ no prazo informado. 29.2. A não devolução injustificada poderá ensejar cobrança do valor correspondente ao patrimônio não restituído, observados os meios legais cabíveis.</p>

    <p class="clausula">CLÁUSULA 30ª — DO USO DA BAG</p>
    <p>30.1. É vedado: alterar a identidade visual da bag, remover logotipos, colar adesivos de terceiros sem autorização da CHEGÔ, utilizar a bag para práticas ilícitas ou de forma que prejudique a imagem ou reputação da plataforma.</p>

    <p class="clausula">CLÁUSULA 31ª — DO VEÍCULO</p>
    <p>31.1. O ENTREGADOR poderá utilizar: motocicleta, automóvel, bicicleta ou bicicleta elétrica. 31.2. O veículo poderá ser próprio, financiado, alugado ou de terceiro, desde que sua utilização seja legítima e autorizada pelo proprietário, quando aplicável. 31.3. Compete exclusivamente ao ENTREGADOR manter o veículo em condições adequadas de circulação e segurança.</p>

    <p class="clausula">CLÁUSULA 32ª — DA MANUTENÇÃO DO VEÍCULO</p>
    <p>32.1. A manutenção preventiva e corretiva do veículo é de responsabilidade exclusiva do ENTREGADOR. 32.2. Compete ao ENTREGADOR verificar regularmente: pneus, freios, iluminação, retrovisores, sistema de direção e documentação obrigatória. 32.3. A CHEGÔ não responderá por acidentes decorrentes da falta de manutenção do veículo.</p>

    <p class="clausula">CLÁUSULA 33ª — DA APRESENTAÇÃO PESSOAL</p>
    <p>33.1. Embora não exista uniforme obrigatório, espera-se que o ENTREGADOR mantenha apresentação pessoal compatível com o atendimento ao público. 33.2. Recomenda-se que o ENTREGADOR utilize roupas limpas, adequadas e compatíveis com a atividade desenvolvida.</p>

    <p class="clausula">CLÁUSULA 34ª — DA HIGIENE</p>
    <p>34.1. O ENTREGADOR deverá manter condições mínimas de higiene durante a realização das entregas. 34.2. É vedado transportar pedidos juntamente com materiais que possam comprometer sua integridade, higiene ou segurança. 34.3. Sempre que possível, os pedidos deverão permanecer protegidos contra chuva, poeira, sujeira e outras condições que possam afetar sua qualidade.</p>

    <p class="clausula">CLÁUSULA 35ª — DA CONDUTA PROFISSIONAL</p>
    <p>35.1. O ENTREGADOR deverá tratar clientes, estabelecimentos parceiros, colaboradores da CHEGÔ e demais envolvidos com respeito, cordialidade e urbanidade. 35.2. É proibido: discutir de forma agressiva, ameaçar, intimidar, praticar discriminação, proferir ofensas, praticar assédio, danificar patrimônio de terceiros, abandonar pedidos ou agir com má-fé.</p>

    <p class="clausula">CLÁUSULA 36ª — DO USO DE ÁLCOOL E DROGAS</p>
    <p>36.1. É expressamente proibido realizar entregas sob efeito de bebida alcoólica ou substâncias que comprometam a capacidade de condução do veículo ou a segurança da operação. 36.2. Caso haja indícios razoáveis de que o ENTREGADOR esteja impossibilitado de realizar entregas em condições seguras, a CHEGÔ poderá suspender preventivamente seu acesso à plataforma até a apuração dos fatos.</p>

    <p class="clausula">CLÁUSULA 37ª — DA SEGURANÇA NO TRÂNSITO</p>
    <p>37.1. O ENTREGADOR compromete-se a respeitar integralmente a legislação de trânsito vigente. 37.2. É vedado: exceder limites de velocidade, avançar sinal vermelho, conduzir utilizando telefone celular de forma incompatível com a legislação, transportar passageiros durante a entrega quando isso comprometer a segurança ou o pedido, ou praticar qualquer conduta que coloque em risco pessoas ou patrimônio. 37.3. Todas as multas, infrações e penalidades decorrentes da condução do veículo serão de responsabilidade exclusiva do ENTREGADOR.</p>

    <p class="clausula">CLÁUSULA 38ª — DO COMPROMISSO COM A QUALIDADE</p>
    <p>38.1. O ENTREGADOR compromete-se a realizar as entregas com diligência, boa-fé, cuidado e responsabilidade. 38.2. A qualidade do serviço prestado poderá ser considerada pela CHEGÔ para fins de avaliações, programas de reconhecimento e distribuição de pedidos. 38.3. O acompanhamento desses indicadores tem caráter operacional, não constituindo controle de jornada ou subordinação empregatícia.</p>

    <p class="parte-titulo">PARTE V — DAS ENTREGAS, DOS PROCEDIMENTOS OPERACIONAIS, DOS CANCELAMENTOS E DAS DEVOLUÇÕES</p>

    <p class="clausula">CLÁUSULA 39ª — DO RECEBIMENTO DAS SOLICITAÇÕES DE ENTREGA</p>
    <p>39.1. As solicitações de entrega serão disponibilizadas ao ENTREGADOR PARCEIRO por meio da plataforma CHEGÔ. 39.2. O ENTREGADOR poderá aceitar ou recusar livremente qualquer solicitação. 39.3. Após o aceite, o ENTREGADOR assume o compromisso de executá-la com diligência, boa-fé e observância das regras deste contrato.</p>

    <p class="clausula">CLÁUSULA 40ª — DO DESLOCAMENTO ATÉ O ESTABELECIMENTO</p>
    <p>40.1. Após aceitar a entrega, o ENTREGADOR deverá deslocar-se ao estabelecimento parceiro no menor tempo razoavelmente possível. 40.2. Caso identifique situação que impeça o comparecimento, deverá comunicar imediatamente a CHEGÔ por meio do suporte. 40.3. O abandono injustificado da solicitação poderá ser considerado infração contratual.</p>

    <p class="clausula">CLÁUSULA 41ª — DA RETIRADA DO PEDIDO</p>
    <p>41.1. Ao chegar ao estabelecimento parceiro, o ENTREGADOR deverá conferir, sempre que possível: número do pedido, identificação do cliente, quantidade de volumes, integridade da embalagem e eventual lacre de segurança. 41.2. O ENTREGADOR não deverá abrir embalagens lacradas para conferência do conteúdo. 41.3. Caso identifique embalagem violada, avariada ou manifestamente inadequada para transporte, deverá comunicar imediatamente o estabelecimento e o suporte da CHEGÔ antes de iniciar a entrega.</p>

    <p class="clausula">CLÁUSULA 42ª — DA GUARDA E DO TRANSPORTE DO PEDIDO</p>
    <p>42.1. Após retirar o pedido, o ENTREGADOR deverá transportá-lo utilizando bag térmica adequada. 42.2. É vedado transportar os pedidos juntamente com materiais que possam contaminá-los.</p>

    <p class="clausula">CLÁUSULA 43ª — DA ENTREGA AO CLIENTE</p>
    <p>43.1. A entrega deverá ocorrer no endereço informado pelo cliente no pedido. 43.2. O ENTREGADOR deverá agir com cordialidade, respeito e profissionalismo durante toda a operação. 43.3. Sempre que tecnicamente disponível, a conclusão da entrega será registrada no aplicativo.</p>

    <p class="clausula">CLÁUSULA 44ª — DO CLIENTE AUSENTE</p>
    <p>44.1. Caso o cliente não seja localizado no endereço informado, o ENTREGADOR deverá: permanecer no local por até 10 (dez) minutos, tentar contato pelos meios disponibilizados pela plataforma e comunicar imediatamente o suporte da CHEGÔ. 44.2. Somente a CHEGÔ poderá autorizar o cancelamento da entrega ou outro procedimento operacional. 44.3. É vedado ao ENTREGADOR abandonar o pedido ou decidir unilateralmente seu destino.</p>

    <p class="clausula">CLÁUSULA 45ª — DA DEVOLUÇÃO DO PEDIDO</p>
    <p>45.1. Quando autorizado pela CHEGÔ, o ENTREGADOR deverá devolver o pedido ao estabelecimento parceiro. 45.2. A devolução poderá ocorrer em casos de: ausência do cliente, endereço inexistente, recusa do pedido, determinação do suporte ou risco à segurança da operação. 45.3. O ENTREGADOR fará jus à remuneração prevista nas políticas financeiras da CHEGÔ para os casos de devolução autorizada.</p>

    <p class="clausula">CLÁUSULA 46ª — DO CANCELAMENTO DA ENTREGA PELO ENTREGADOR</p>
    <p>46.1. Antes da retirada do pedido, o ENTREGADOR poderá solicitar o cancelamento da entrega. 46.2. Após retirar o pedido, o cancelamento somente será admitido em situações excepcionais autorizadas pela CHEGÔ, como: acidente de trânsito, pane mecânica, mal súbito, risco concreto à integridade física ou força maior. 46.3. Fora dessas hipóteses, o cancelamento após a retirada poderá caracterizar infração grave.</p>

    <p class="clausula">CLÁUSULA 47ª — DA SUBSTITUIÇÃO DO ENTREGADOR</p>
    <p>47.1. Nos casos previstos na cláusula anterior, a CHEGÔ poderá designar outro ENTREGADOR para concluir a entrega. 47.2. É proibido entregar o pedido diretamente a outro entregador sem autorização expressa da CHEGÔ.</p>

    <p class="clausula">CLÁUSULA 48ª — DO ABANDONO DA ENTREGA</p>
    <p>48.1. Considera-se abandono da entrega: deixar o pedido sem autorização, interromper injustificadamente a entrega, descartar o pedido, ocultar a mercadoria ou deixar de prestar informações ao suporte. 48.2. O abandono da entrega constitui infração gravíssima, podendo a CHEGÔ aplicar suspensão cautelar imediata enquanto apura os fatos.</p>

    <p class="clausula">CLÁUSULA 49ª — DOS DANOS AO PEDIDO</p>
    <p>49.1. O ENTREGADOR deverá comunicar imediatamente qualquer dano ocorrido durante o transporte. 49.2. Não haverá responsabilização automática do ENTREGADOR quando ficar demonstrado que o dano decorreu de embalagem inadequada fornecida pelo estabelecimento, caso fortuito, força maior, defeito do produto ou fato exclusivo de terceiro. 49.3. Quando comprovado que o dano decorreu de negligência, imprudência, imperícia ou conduta dolosa do ENTREGADOR, poderão ser aplicadas as medidas previstas neste contrato.</p>

    <p class="clausula">CLÁUSULA 50ª — DOS ACIDENTES E IMPREVISTOS</p>
    <p>50.1. Ocorrendo acidente, pane mecânica, mal súbito ou qualquer evento que impeça a continuidade da entrega, o ENTREGADOR deverá comunicar imediatamente a CHEGÔ, informando localização, situação do pedido, estado da mercadoria e necessidade de apoio.</p>

    <p class="clausula">CLÁUSULA 51ª — DA RECUSA DE ENTREGA POR RISCO À SEGURANÇA</p>
    <p>51.1. O ENTREGADOR poderá interromper ou recusar a continuidade de uma entrega quando identificar risco concreto à sua integridade física. 51.2. Nessas situações, deverá comunicar imediatamente o suporte e aguardar orientações. 51.3. A utilização abusiva desta prerrogativa poderá ser objeto de análise pela plataforma.</p>

    <p class="clausula">CLÁUSULA 52ª — DOS PEDIDOS PERECÍVEIS</p>
    <p>52.1. Os pedidos contendo alimentos perecíveis deverão receber prioridade durante o transporte. 52.2. O ENTREGADOR deverá evitar atrasos desnecessários que possam comprometer a qualidade dos produtos.</p>

    <p class="clausula">CLÁUSULA 53ª — DA PROIBIÇÃO DE MANIPULAÇÃO DOS PRODUTOS</p>
    <p>53.1. É vedado ao ENTREGADOR: abrir embalagens lacradas, consumir produtos transportados, retirar itens do pedido, substituir mercadorias, alterar o conteúdo entregue ou violar lacres de segurança. 53.2. A violação desta cláusula caracteriza infração gravíssima e poderá ensejar o descredenciamento imediato, sem prejuízo das responsabilidades civis e penais cabíveis.</p>

    <p class="clausula">CLÁUSULA 54ª — DA COMUNICAÇÃO COM O SUPORTE</p>
    <p>54.1. Sempre que ocorrer situação extraordinária durante a entrega, o ENTREGADOR deverá comunicar a CHEGÔ pelos canais oficiais disponibilizados. 54.2. As orientações fornecidas pelo suporte deverão ser observadas durante a condução da ocorrência, desde que não exponham o ENTREGADOR a risco à sua integridade física ou violem a legislação vigente.</p>

    <p class="parte-titulo">PARTE VI — DOS REPASSES, DAS AVALIAÇÕES, DAS ADVERTÊNCIAS, DAS SUSPENSÕES, DO DESCREDENCIAMENTO E DAS PENALIDADES</p>

    <p class="clausula">CLÁUSULA 55ª — DA REMUNERAÇÃO DO ENTREGADOR</p>
    <p>55.1. O ENTREGADOR PARCEIRO fará jus à remuneração correspondente às entregas efetivamente concluídas, observadas as políticas financeiras vigentes. 55.2. O valor de cada entrega poderá variar conforme critérios operacionais da plataforma, incluindo: distância percorrida, região da entrega, horário e demanda operacional. 55.3. A CHEGÔ poderá realizar campanhas temporárias de incentivo ou bônus, sem que tais benefícios constituam direito adquirido.</p>

    <p class="clausula">CLÁUSULA 56ª — DOS REPASSES</p>
    <p>56.1. Os valores devidos ao ENTREGADOR serão repassados conforme cronograma financeiro divulgado pela CHEGÔ. 56.2. Os repasses poderão sofrer retenção temporária quando houver: suspeita fundamentada de fraude, investigação interna, determinação judicial, inconsistência cadastral, divergência bancária ou necessidade de auditoria. 56.3. Encerrada a análise, os valores serão liberados ou compensados conforme a conclusão da apuração.</p>

    <p class="clausula">CLÁUSULA 57ª — DAS INCONSISTÊNCIAS BANCÁRIAS</p>
    <p>57.1. O ENTREGADOR é responsável por manter seus dados bancários corretos e atualizados. 57.2. A CHEGÔ não responderá por atrasos ocasionados por: chave PIX incorreta, conta encerrada, conta bloqueada, dados inconsistentes ou impedimentos da instituição financeira. 57.3. Regularizada a pendência, os valores serão processados no próximo ciclo financeiro disponível.</p>

    <p class="clausula">CLÁUSULA 58ª — DAS AVALIAÇÕES</p>
    <p>58.1. Os clientes e os estabelecimentos parceiros poderão avaliar as entregas realizadas, considerando: cordialidade, pontualidade, cuidado com os pedidos, comunicação e profissionalismo. 58.2. A CHEGÔ poderá utilizar essas informações para melhoria da plataforma, programas de reconhecimento e distribuição inteligente de entregas. 58.3. Avaliações comprovadamente fraudulentas, ofensivas ou manifestamente abusivas poderão ser desconsideradas.</p>

    <p class="clausula">CLÁUSULA 59ª — DOS INDICADORES OPERACIONAIS</p>
    <p>59.1. A plataforma poderá acompanhar indicadores de qualidade da operação, como: índice de aceitação, índice de cancelamentos, índice de conclusão, pontualidade e avaliações. 59.2. Esses indicadores possuem finalidade exclusivamente operacional, não constituindo controle de jornada ou subordinação empregatícia.</p>

    <p class="clausula">CLÁUSULA 60ª — DAS ADVERTÊNCIAS</p>
    <p>60.1. Sempre que possível e proporcional à gravidade da conduta, a CHEGÔ poderá aplicar advertência antes de penalidades mais severas. 60.2. Poderão ensejar advertência: atrasos reiterados, demora na retirada do pedido, falha de comunicação com o suporte, utilização de bag em condições inadequadas e descumprimento de procedimentos operacionais.</p>

    <p class="clausula">CLÁUSULA 61ª — DAS SUSPENSÕES</p>
    <p>61.1. Sem prejuízo da suspensão cautelar, a CHEGÔ poderá aplicar suspensão disciplinar quando houver reincidência ou infração de maior gravidade. 61.2. A suspensão poderá ocorrer após: cinco advertências registradas, cinco cancelamentos injustificados após aceite da corrida ou descumprimento reiterado das políticas da plataforma. 61.3. Durante a suspensão o ENTREGADOR não receberá novas solicitações de entrega.</p>

    <p class="clausula">CLÁUSULA 62ª — DO DESCREDENCIAMENTO</p>
    <p>62.1. O descredenciamento poderá ocorrer: após cinco suspensões disciplinares, por fraude comprovada, por prática criminosa relacionada à operação, por agressão física, por ameaça grave, por utilização de documentos falsos, por abandono reiterado de entregas ou por descumprimento grave deste contrato. 62.2. Sempre que possível, será assegurada ao ENTREGADOR oportunidade de apresentar esclarecimentos, ressalvadas as hipóteses que exijam bloqueio imediato para proteção da operação.</p>

    <p class="clausula">CLÁUSULA 63ª — DAS INFRAÇÕES GRAVÍSSIMAS</p>
    <p>63.1. Constituem infrações gravíssimas, dentre outras: fraude, utilização de conta de terceiro, compartilhamento de cadastro, entrega simulada, apropriação de mercadoria, violação de embalagens, recebimento de valores por fora da plataforma, combinação fraudulenta com cliente ou estabelecimento parceiro, utilização de GPS falso, adulteração de documentos e prática de crime durante a operação. 63.2. Nas hipóteses previstas nesta cláusula, a CHEGÔ poderá promover o bloqueio cautelar imediato e, após a apuração dos fatos, aplicar o descredenciamento definitivo.</p>

    <p class="clausula">CLÁUSULA 64ª — DO DIREITO DE DEFESA</p>
    <p>64.1. Sempre que a natureza da ocorrência permitir, o ENTREGADOR poderá apresentar sua versão dos fatos pelos canais oficiais indicados pela CHEGÔ. 64.2. A apresentação de defesa não impede a adoção de medidas cautelares quando necessárias para preservar a segurança da plataforma.</p>

    <p class="clausula">CLÁUSULA 65ª — DO RESSARCIMENTO DE PREJUÍZOS</p>
    <p>65.1. Quando ficar comprovado que o ENTREGADOR causou prejuízo material à CHEGÔ em razão de dolo, fraude ou culpa grave, poderá ser obrigado ao respectivo ressarcimento, observados o contraditório, a ampla defesa e a legislação aplicável. 65.2. Não haverá responsabilização automática do ENTREGADOR, sendo necessária a apuração das circunstâncias e a demonstração do nexo entre sua conduta e o prejuízo alegado.</p>

    <p class="clausula">CLÁUSULA 66ª — DA LIMITAÇÃO DE RESPONSABILIDADE DA CHEGÔ</p>
    <p>66.1. A CHEGÔ atua exclusivamente como plataforma tecnológica de intermediação e não responderá por: acidentes de trânsito decorrentes de conduta do ENTREGADOR, multas de trânsito, manutenção de veículos, despesas pessoais do ENTREGADOR, danos causados por terceiros fora de seu controle ou eventos de caso fortuito ou força maior. 66.2. Nada nesta cláusula afasta a responsabilidade da CHEGÔ nas hipóteses em que ela seja legalmente irrenunciável.</p>

    <p class="clausula">CLÁUSULA 67ª — DA BOA-FÉ CONTRATUAL</p>
    <p>67.1. As PARTES comprometem-se a atuar com boa-fé, cooperação, lealdade e transparência durante toda a vigência da parceria.</p>

    <p class="parte-titulo">PARTE VII — DA PROTEÇÃO DE DADOS, DA CONFIDENCIALIDADE, DA PROPRIEDADE INTELECTUAL, DAS ALTERAÇÕES CONTRATUAIS E DAS DISPOSIÇÕES FINAIS</p>

    <p class="clausula">CLÁUSULA 68ª — DA PROTEÇÃO DE DADOS PESSOAIS (LGPD)</p>
    <p>68.1. As PARTES comprometem-se a cumprir integralmente a Lei nº 13.709/2018 (LGPD). 68.2. O ENTREGADOR autoriza a CHEGÔ a coletar, armazenar, utilizar, tratar, compartilhar e eliminar seus dados pessoais exclusivamente para finalidades relacionadas à execução deste contrato, incluindo: cadastro, validação de identidade, prevenção a fraudes, distribuição de entregas, processamento financeiro, cumprimento de obrigações legais e melhoria da plataforma. 68.3. Os dados poderão ser compartilhados com: instituições financeiras, processadores de pagamento, autoridades públicas e órgãos judiciais ou administrativos quando legalmente exigido.</p>

    <p class="clausula">CLÁUSULA 69ª — DOS DADOS DE GEOLOCALIZAÇÃO</p>
    <p>69.1. O ENTREGADOR declara ciência de que os registros de geolocalização constituem elemento essencial para o funcionamento da plataforma. 69.2. Os registros poderão ser preservados pelo prazo necessário ao cumprimento da legislação ou à defesa dos direitos da CHEGÔ.</p>

    <p class="clausula">CLÁUSULA 70ª — DA CONFIDENCIALIDADE</p>
    <p>70.1. O ENTREGADOR compromete-se a manter absoluto sigilo sobre todas as informações obtidas em razão da utilização da plataforma, incluindo: estratégias comerciais, informações financeiras, funcionamento do sistema, algoritmos, políticas internas, cadastros, listas de clientes e estabelecimentos parceiros. 70.2. A obrigação de confidencialidade permanecerá vigente mesmo após o encerramento deste contrato.</p>

    <p class="clausula">CLÁUSULA 71ª — DA SEGURANÇA DA INFORMAÇÃO</p>
    <p>71.1. O ENTREGADOR compromete-se a utilizar a plataforma de maneira segura, ética e compatível com sua finalidade. 71.2. É proibido: tentar invadir sistemas da CHEGÔ, praticar engenharia reversa, copiar códigos, explorar vulnerabilidades ou utilizar softwares destinados à manipulação do funcionamento da plataforma.</p>

    <p class="clausula">CLÁUSULA 72ª — DA PROPRIEDADE INTELECTUAL</p>
    <p>72.1. Todos os direitos relativos à plataforma CHEGÔ pertencem exclusivamente à CONTRATANTE, incluindo: marca, nome empresarial, logotipo, aplicativo, website, layouts, identidade visual, banco de dados, algoritmos, códigos-fonte e materiais publicitários. 72.2. Nenhuma disposição deste contrato implica cessão ou transferência de direitos de propriedade intelectual ao ENTREGADOR.</p>

    <p class="clausula">CLÁUSULA 73ª — DO USO DA MARCA CHEGÔ</p>
    <p>73.1. A utilização da marca CHEGÔ somente poderá ocorrer nos limites expressamente autorizados pela plataforma. 73.2. É vedado ao ENTREGADOR utilizar a marca para fins políticos, campanhas particulares, publicidade enganosa ou divulgação de concorrentes.</p>

    <p class="clausula">CLÁUSULA 74ª — DAS REDES SOCIAIS</p>
    <p>74.1. O ENTREGADOR compromete-se a não divulgar informações falsas ou sabidamente inverídicas sobre a CHEGÔ. 74.2. Esta cláusula não impede o exercício regular da liberdade de expressão ou da denúncia de irregularidades pelos meios legalmente adequados, desde que observados a boa-fé, a veracidade dos fatos e a legislação vigente.</p>

    <p class="clausula">CLÁUSULA 75ª — DAS ALTERAÇÕES CONTRATUAIS</p>
    <p>75.1. A CHEGÔ poderá promover alterações neste contrato para adequação à legislação, a decisões judiciais, à evolução tecnológica da plataforma ou às necessidades operacionais. 75.2. As alterações serão comunicadas ao ENTREGADOR pelos meios oficiais da plataforma. 75.3. Caso o ENTREGADOR não concorde com alterações que afetem substancialmente a parceria, poderá solicitar seu descredenciamento.</p>

    <p class="clausula">CLÁUSULA 76ª — DA VIGÊNCIA</p>
    <p>76.1. Este contrato entra em vigor na data de seu aceite eletrônico ou assinatura. 76.2. Sua vigência será por prazo indeterminado. 76.3. Qualquer das PARTES poderá encerrar a parceria a qualquer tempo, observadas as obrigações pendentes e as hipóteses de retenção ou investigação previstas neste contrato.</p>

    <p class="clausula">CLÁUSULA 77ª — DA RESCISÃO</p>
    <p>77.1. O ENTREGADOR poderá solicitar seu descredenciamento a qualquer momento. 77.2. A CHEGÔ poderá rescindir este contrato nas hipóteses previstas neste instrumento ou quando houver motivo legítimo relacionado à segurança, à integridade da operação ou ao descumprimento contratual. 77.3. O encerramento da parceria não afasta a obrigação de devolução dos bens pertencentes à CHEGÔ, nem a responsabilidade por fatos ocorridos durante a vigência deste contrato.</p>

    <p class="clausula">CLÁUSULA 78ª — DAS NOTIFICAÇÕES</p>
    <p>78.1. Todas as comunicações entre as PARTES poderão ocorrer por: aplicativo, e-mail, WhatsApp informado no cadastro, SMS ou notificações eletrônicas da plataforma. 78.2. Consideram-se válidas as comunicações encaminhadas aos dados cadastrados pelo ENTREGADOR, cabendo a este mantê-los sempre atualizados.</p>

    <p class="clausula">CLÁUSULA 79ª — DA ASSINATURA ELETRÔNICA</p>
    <p>79.1. As PARTES reconhecem como válida a assinatura eletrônica ou o aceite eletrônico realizado por meio da plataforma, nos termos da legislação brasileira aplicável. 79.2. O aceite eletrônico produzirá os mesmos efeitos jurídicos da assinatura física.</p>

    <p class="clausula">CLÁUSULA 80ª — DAS DISPOSIÇÕES GERAIS</p>
    <p>80.1. A eventual tolerância quanto ao descumprimento de qualquer cláusula não constituirá renúncia de direito nem novação contratual. 80.2. A nulidade de qualquer disposição não prejudicará a validade das demais cláusulas. 80.3. Este contrato obriga as PARTES, seus sucessores e, quando aplicável, seus representantes legais. 80.4. Os casos omissos serão resolvidos à luz da legislação brasileira, especialmente do Código Civil, da LGPD, do Marco Civil da Internet, do Código de Defesa do Consumidor quando aplicável e das demais normas pertinentes.</p>

    <p class="clausula">CLÁUSULA 81ª — DO FORO</p>
    <p>81.1. Fica eleito o foro da Comarca de Guapó, Estado de Goiás, com renúncia expressa a qualquer outro, por mais privilegiado que seja, para dirimir dúvidas ou controvérsias oriundas deste contrato, ressalvadas as hipóteses de competência absoluta previstas em lei.</p>

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
  if (!requireAdmin(req)) return new NextResponse("Não autorizado", { status: 401 })

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
