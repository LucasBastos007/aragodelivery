"use client"

// Termos de uso e Política de privacidade do app do cliente (criados em 20/10/2026 a pedido do
// Lucas). Escritos a partir do que o app faz hoje: cancelamento só antes da loja aceitar,
// reembolso por solicitação (Pix/cartão), pagamento em 2 formas, login por e-mail, Google,
// Apple e WhatsApp. Ao mudar uma regra no app, mudar aqui também e a data de atualização.
import { TopoSub } from "@/components/cliente/TopoSub"

const ATUALIZADO = "20 de outubro de 2026"

export default function TermosPage() {
  return (
    <div className="cn sub-tela">
      <TopoSub titulo="Termos de uso" voltarPara="/" />
      <div className="conteudo">
        <div className="bloco texto-legal">
          <p className="mut" style={{ fontSize: 13 }}>Atualizado em {ATUALIZADO}</p>
          <p>Estes termos valem pra quem usa o Chegô pra pedir em lojas de Aragoiânia e Guapó. Ao criar uma conta ou fazer um pedido, você concorda com eles.</p>
          <p>O Chegô é da CHEGÔ DELIVERY, CNPJ 67.543.510/0001-86, Rua Pedro Nestor Pereira, Quadra 14, Lote 24, Aragoiânia/GO, CEP 75330-000.</p>

          <h2>1. O que o Chegô faz</h2>
          <p>O Chegô é uma plataforma que liga você às lojas parceiras e aos entregadores. Quem prepara e vende os produtos é a loja. Quem leva o pedido é um entregador parceiro, que não é funcionário do Chegô.</p>
          <p>Preço, cardápio, fotos, horário de funcionamento e área de entrega são informados por cada loja. A loja pode recusar um pedido, por exemplo quando um item acabou.</p>

          <h2>2. Sua conta</h2>
          <ul>
            <li>Você entra com e-mail e senha, com Google, com Apple ou com um código enviado pro seu WhatsApp.</li>
            <li>Os dados da conta precisam ser verdadeiros, principalmente o telefone e o endereço de entrega.</li>
            <li>A conta é pessoal. Não passe a senha nem o código do WhatsApp pra ninguém.</li>
            <li>Bebida alcoólica só é vendida e entregue pra maiores de 18 anos. O entregador pode pedir documento e não entregar se a pessoa for menor.</li>
          </ul>

          <h2>3. Pedido e pagamento</h2>
          <ul>
            <li>O total mostrado antes de confirmar inclui os produtos, a taxa de entrega e o desconto do cupom, se houver.</li>
            <li>Você pode pagar com Pix ou cartão pelo app, ou com dinheiro ou maquininha na entrega. Também dá pra dividir o pagamento em 2 formas.</li>
            <li>Pix e cartão são processados pelo Asaas, empresa de pagamentos. O Chegô não guarda o número completo do seu cartão.</li>
            <li>Pedido com Pix só vai pra loja depois que o pagamento é confirmado. Se o Pix não for pago a tempo, o pedido é cancelado sozinho.</li>
            <li>Pagando em dinheiro, informe se precisa de troco e pra quanto.</li>
          </ul>

          <h2>4. Cupons</h2>
          <p>Cada cupom tem as suas regras (valor mínimo, loja, região e validade), mostradas na sacola. O cupom é aplicado só se o pedido cumprir essas regras e não pode ser trocado por dinheiro.</p>

          <h2>5. Cancelamento e reembolso</h2>
          <ul>
            <li>Você pode cancelar pelo app enquanto a loja ainda não aceitou o pedido. O que foi pago no Pix ou no cartão é devolvido.</li>
            <li>Depois que a loja aceita, o pedido não pode mais ser cancelado pelo app. Se algo der errado (item errado ou faltando, pedido que não chegou), peça o reembolso na tela do pedido ou fale com o suporte.</li>
            <li>Cada pedido de reembolso é analisado. Quando aprovado, o valor volta pela mesma forma de pagamento usada no app.</li>
            <li>Se a loja cancelar ou recusar o pedido, o que foi pago no app é devolvido.</li>
          </ul>

          <h2>6. Entrega</h2>
          <ul>
            <li>O tempo de entrega mostrado é uma estimativa e pode mudar com o movimento da loja, o trânsito e o clima.</li>
            <li>Alguém precisa estar no endereço pra receber. O entregador pode pedir o código de entrega que aparece no seu app.</li>
            <li>Se o endereço estiver errado ou ninguém atender, fale com o suporte pra combinar o que fazer.</li>
          </ul>

          <h2>7. Avaliações e conversa</h2>
          <p>Você pode avaliar a loja e o entregador e conversar com o entregador pelo app. Não é permitido usar esses espaços pra ofender, ameaçar ou enviar conteúdo ilegal.</p>

          <h2>8. Suporte</h2>
          <p>O atendimento é pelo WhatsApp do Chegô, (62) 98584-5621, ou pela opção “Ajuda pelo chat” no app.</p>

          <h2>9. Mudanças nestes termos</h2>
          <p>Estes termos podem mudar quando o app mudar. A data de atualização fica no topo desta página.</p>
          <p>Fica eleito o foro do domicílio do consumidor, como prevê o Código de Defesa do Consumidor.</p>
        </div>

        <div className="bloco texto-legal" id="privacidade">
          <div className="h3" style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 20, color: "var(--grafite)" }}>Política de privacidade</div>

          <h2>Quais dados usamos</h2>
          <ul>
            <li><b>Conta:</b> nome, telefone (WhatsApp), e-mail e foto, quando você entra com Google ou Apple.</li>
            <li><b>Entrega:</b> os endereços que você cadastra e a localização do celular, só quando você toca em “Usar minha localização”.</li>
            <li><b>Pedidos:</b> o que você pediu, valores, forma de pagamento, avaliações e a conversa com o entregador.</li>
            <li><b>No seu celular:</b> a sacola, as lojas favoritas e o final do cartão salvo ficam guardados no próprio aparelho.</li>
          </ul>

          <h2>Pra que usamos</h2>
          <ul>
            <li>Fazer o pedido chegar: a loja recebe seu nome, telefone, endereço e os itens. O entregador recebe seu nome, o endereço e o telefone de contato.</li>
            <li>Cobrar e devolver pagamentos, pelo Asaas.</li>
            <li>Mandar o código de entrada pelo WhatsApp e os avisos do pedido no celular, se você permitir.</li>
            <li>Atender você no suporte e cumprir obrigações legais e fiscais.</li>
          </ul>
          <p>O Chegô não vende os seus dados.</p>

          <h2>Com quem os dados ficam</h2>
          <p>Além da loja e do entregador do seu pedido, usamos serviços que guardam ou processam dados pra gente: Supabase (banco de dados), Vercel (hospedagem do app), Asaas (pagamentos), Google (login e mapas), Apple (login) e Z-API (envio do código pelo WhatsApp).</p>

          <h2>Seus direitos</h2>
          <p>Pela Lei Geral de Proteção de Dados (LGPD), você pode pedir pra ver, corrigir ou apagar os seus dados. Nome, telefone e endereço você muda em Perfil, “Meus dados”. Pra excluir a conta, use Perfil, “Termos e privacidade”, “Excluir minha conta”, ou fale com o suporte.</p>
          <p>Mesmo depois da exclusão, alguns dados de pedidos e pagamentos ficam guardados pelo tempo que a lei fiscal exige.</p>
        </div>
      </div>
    </div>
  )
}
