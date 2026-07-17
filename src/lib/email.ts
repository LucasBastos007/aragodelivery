import { Resend } from "resend"

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

const BASE = "https://chegodelivery.com"
const LOGO = `${BASE}/logo-chego.jpg`

const base = (conteudo: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chegô Delivery</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#f97316;padding:28px 32px;text-align:center;">
            <img src="${LOGO}" alt="Chegô Delivery" style="height:52px;border-radius:10px;display:block;margin:0 auto 12px;" />
            <p style="margin:0;color:#ffffff;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Plataforma de Delivery</p>
          </td>
        </tr>
        <!-- Conteúdo -->
        <tr>
          <td style="padding:36px 32px;">
            ${conteudo}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">Chegô Delivery · Aragoiânia/GO</p>
            <p style="margin:6px 0 0;font-size:11px;color:#d1d5db;">Em caso de dúvidas, entre em contato pelo WhatsApp.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`

function credenciaisBox(email: string) {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;margin:24px 0;">
    <tr>
      <td style="padding:20px 24px;">
        <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#ea580c;text-transform:uppercase;letter-spacing:1px;">Seus dados de acesso</p>
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#6b7280;width:70px;">E-mail</td>
            <td style="padding:4px 0;font-size:13px;font-weight:700;color:#111827;">${email}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#6b7280;">Senha</td>
            <td style="padding:4px 0;font-size:13px;font-weight:700;color:#111827;">A senha que você cadastrou no momento do cadastro.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `
}

function botao(texto: string, url: string) {
  return `
  <div style="text-align:center;margin:28px 0 8px;">
    <a href="${url}" style="display:inline-block;background:#f97316;color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 36px;border-radius:12px;">
      ${texto}
    </a>
  </div>
  <p style="text-align:center;font-size:12px;color:#9ca3af;margin:8px 0 0;">Ou acesse: <a href="${url}" style="color:#f97316;">${url}</a></p>
  `
}

export async function notificarSaqueLojistaSolicitado({
  nomeLoja,
  valor,
  pixChave,
  saqueId,
}: {
  nomeLoja: string
  valor: number
  pixChave: string
  saqueId: string
}) {
  const resend = getResend()
  if (!resend) return

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#111827;">🏪 Nova solicitação de saque — Lojista</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Uma loja solicitou saque. Confira os dados e realize o PIX manualmente.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;margin:0 0 24px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#ea580c;text-transform:uppercase;letter-spacing:1px;">Dados do saque</p>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#6b7280;width:110px;">Loja</td>
            <td style="padding:5px 0;font-size:14px;font-weight:700;color:#111827;">${nomeLoja}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#6b7280;">Valor</td>
            <td style="padding:5px 0;font-size:20px;font-weight:900;color:#22c55e;">R$ ${valor.toFixed(2).replace(".", ",")}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#6b7280;">Chave PIX</td>
            <td style="padding:5px 0;font-size:14px;font-weight:700;color:#111827;font-family:monospace;">${pixChave}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <p style="font-size:13px;color:#374151;margin:0 0 4px;">1. Abra seu banco e realize o PIX para a chave acima</p>
    <p style="font-size:13px;color:#374151;margin:0 0 20px;">2. Depois acesse o painel e marque como pago</p>

    ${botao("Abrir painel financeiro", `${BASE}/chego-ctrl/saques`)}
  `)

  await resend.emails.send({
    from: "Chegô Delivery <noreply@chegodelivery.com>",
    to: "lucasbastos1965@gmail.com",
    subject: `🏪 Saque solicitado — ${nomeLoja} · R$ ${valor.toFixed(2)}`,
    html,
  })
}

export async function enviarReciboPagamento({
  email,
  nomeLoja,
  codigo,
  nomeCliente,
  itens,
  subtotal,
  taxaEntrega,
  desconto,
  total,
  formaPagamento,
  endereco,
}: {
  email: string
  nomeLoja: string
  codigo: string
  nomeCliente: string
  itens: { nome: string; quantidade: number; preco: number }[]
  subtotal: number
  taxaEntrega: number
  desconto: number
  total: number
  formaPagamento: string
  endereco: string
}) {
  const resend = getResend()
  if (!resend) return

  const PGTO: Record<string, string> = {
    pix: "PIX", cartao: "Cartão de crédito/débito",
    dinheiro: "Dinheiro", maquininha: "Maquininha",
  }

  const itensHtml = itens.map(i => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#374151;">${i.quantidade}x ${i.nome}</td>
      <td style="padding:6px 0;font-size:13px;color:#374151;text-align:right;white-space:nowrap;">R$ ${(i.preco * i.quantidade).toFixed(2).replace(".", ",")}</td>
    </tr>
  `).join("")

  const html = base(`
    <h2 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#111827;">Pedido confirmado! ✅</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Olá, <strong>${nomeCliente}</strong>! Aqui está o seu recibo.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;margin:0 0 20px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 3px;font-size:11px;font-weight:700;color:#ea580c;text-transform:uppercase;letter-spacing:1px;">Pedido</p>
        <p style="margin:0;font-size:22px;font-weight:900;color:#111827;">#${codigo}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${nomeLoja}</p>
      </td></tr>
    </table>

    <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Itens do pedido</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">${itensHtml}</table>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;padding-top:12px;margin:0 0 20px;">
      <tr>
        <td style="padding:3px 0;font-size:13px;color:#6b7280;">Subtotal</td>
        <td style="padding:3px 0;font-size:13px;color:#374151;text-align:right;">R$ ${subtotal.toFixed(2).replace(".", ",")}</td>
      </tr>
      ${taxaEntrega > 0 ? `<tr><td style="padding:3px 0;font-size:13px;color:#6b7280;">Taxa de entrega</td><td style="padding:3px 0;font-size:13px;color:#374151;text-align:right;">R$ ${taxaEntrega.toFixed(2).replace(".", ",")}</td></tr>` : ""}
      ${desconto > 0 ? `<tr><td style="padding:3px 0;font-size:13px;color:#22c55e;">Desconto</td><td style="padding:3px 0;font-size:13px;color:#22c55e;text-align:right;">− R$ ${desconto.toFixed(2).replace(".", ",")}</td></tr>` : ""}
      <tr>
        <td style="padding:8px 0 0;font-size:16px;font-weight:900;color:#111827;">Total</td>
        <td style="padding:8px 0 0;font-size:18px;font-weight:900;color:#f97316;text-align:right;">R$ ${total.toFixed(2).replace(".", ",")}</td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;margin:0 0 20px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;">Pagamento</p>
        <p style="margin:0;font-size:13px;color:#111827;font-weight:600;">${PGTO[formaPagamento] ?? formaPagamento}</p>
      </td></tr>
    </table>

    ${endereco ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;">Endereço de entrega</p>
        <p style="margin:0;font-size:13px;color:#111827;">${endereco}</p>
      </td></tr>
    </table>` : ""}
  `)

  await resend.emails.send({
    from: "Chegô Delivery <noreply@chegodelivery.com>",
    to: email,
    subject: `Pedido #${codigo} confirmado — ${nomeLoja}`,
    html,
  })
}

export async function enviarComprovanteTransferencia({
  email,
  nome,
  valor,
  pixChave,
  tipo,
}: {
  email: string
  nome: string
  valor: number
  pixChave: string
  tipo: "lojista" | "motoboy"
}) {
  const resend = getResend()
  if (!resend) return

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#111827;">💸 Transferência realizada!</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Olá, <strong>${nome}</strong>! O seu saque foi processado com sucesso.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;margin:0 0 24px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:1px;">Comprovante de transferência</p>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#6b7280;width:110px;">Valor</td>
            <td style="padding:5px 0;font-size:20px;font-weight:900;color:#22c55e;">R$ ${valor.toFixed(2).replace(".", ",")}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#6b7280;">Chave PIX</td>
            <td style="padding:5px 0;font-size:14px;font-weight:700;color:#111827;font-family:monospace;">${pixChave}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#6b7280;">Data</td>
            <td style="padding:5px 0;font-size:13px;color:#111827;">${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <p style="font-size:13px;color:#374151;margin:0;">Em caso de dúvidas, entre em contato com a equipe Chegô via WhatsApp.</p>
  `)

  await resend.emails.send({
    from: "Chegô Delivery <noreply@chegodelivery.com>",
    to: email,
    subject: `✅ Transferência de R$ ${valor.toFixed(2)} realizada`,
    html,
  })
}

export async function enviarBoasVindasMotoboy({
  nome,
  email,
}: {
  nome: string
  email: string
  senha?: string // mantido para compatibilidade mas não é usado
}) {
  const resend = getResend()
  if (!resend) return

  const html = base(`
    <h1 style="margin:0 0 6px;font-size:24px;font-weight:900;color:#111827;">Bem-vindo(a), ${nome}! 🎉</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Seu contrato foi assinado com sucesso. Você faz parte da equipe <strong style="color:#f97316;">Chegô Delivery</strong>!</p>

    <p style="font-size:14px;color:#374151;margin:0 0 4px;">Sua conta será ativada em breve pela equipe Chegô. Assim que estiver ativa, você poderá fazer login e receber pedidos.</p>

    ${credenciaisBox(email)}

    <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">⚠️ Guarde sua senha em local seguro. Não compartilhe com ninguém.</p>

    ${botao("Acessar app do motoboy", `${BASE}/entrar`)}
  `)

  await resend.emails.send({
    from: "Chegô Delivery <noreply@chegodelivery.com>",
    to: email,
    subject: "Bem-vindo(a) ao Chegô Delivery! 🛵",
    html,
  })
}

export async function notificarSaqueSolicitado({
  nomeMotoboy,
  valor,
  pixChave,
  saqueId,
}: {
  nomeMotoboy: string
  valor: number
  pixChave: string
  saqueId: string
}) {
  const resend = getResend()
  if (!resend) return

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#111827;">💸 Nova solicitação de saque</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Um motoboy solicitou saque. Confira os dados e realize o PIX manualmente.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;margin:0 0 24px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#ea580c;text-transform:uppercase;letter-spacing:1px;">Dados do saque</p>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#6b7280;width:110px;">Motoboy</td>
            <td style="padding:5px 0;font-size:14px;font-weight:700;color:#111827;">${nomeMotoboy}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#6b7280;">Valor</td>
            <td style="padding:5px 0;font-size:20px;font-weight:900;color:#22c55e;">R$ ${valor.toFixed(2).replace(".", ",")}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#6b7280;">Chave PIX</td>
            <td style="padding:5px 0;font-size:14px;font-weight:700;color:#111827;font-family:monospace;">${pixChave}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <p style="font-size:13px;color:#374151;margin:0 0 4px;">1. Abra seu banco e realize o PIX para a chave acima</p>
    <p style="font-size:13px;color:#374151;margin:0 0 20px;">2. Depois acesse o painel e marque como pago</p>

    ${botao("Abrir painel financeiro", `${BASE}/chego-ctrl/saques`)}
  `)

  await resend.emails.send({
    from: "Chegô Delivery <noreply@chegodelivery.com>",
    to: "lucasbastos1965@gmail.com",
    subject: `💸 Saque solicitado — ${nomeMotoboy} · R$ ${valor.toFixed(2)}`,
    html,
  })
}

export async function enviarContratoLoja({
  nome,
  email,
  linkContrato,
  linkPdf,
}: {
  nome: string
  email: string
  linkContrato: string
  linkPdf: string
}) {
  const resend = getResend()
  if (!resend) return

  const html = base(`
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:900;color:#111827;">Seu contrato está pronto, ${nome}!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">A equipe Chegô preparou o contrato de parceria para você. Leia com atenção e assine para ativar sua loja.</p>

    ${botao("📄 Ler e assinar o contrato", linkContrato)}

    <p style="font-size:13px;color:#6b7280;margin:24px 0 8px;">Prefere assinar presencialmente? Baixe o PDF, imprima, assine e entregue à nossa equipe:</p>
    <p style="margin:0;">
      <a href="${linkPdf}" style="font-size:13px;color:#f97316;font-weight:700;text-decoration:none;">⬇ Baixar PDF para impressão</a>
    </p>

    <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;">Dúvidas? Entre em contato via WhatsApp: <strong>(62) 9 9391-0717</strong></p>
  `)

  await resend.emails.send({
    from: "Chegô Delivery <noreply@chegodelivery.com>",
    to: email,
    subject: "📋 Contrato de parceria Chegô Delivery — assine agora",
    html,
  })
}

export async function enviarBoasVindasLoja({
  nome,
  email,
}: {
  nome: string
  email: string
  senha?: string // mantido para compatibilidade mas não é usado
}) {
  const resend = getResend()
  if (!resend) return

  const html = base(`
    <h1 style="margin:0 0 6px;font-size:24px;font-weight:900;color:#111827;">Bem-vindo(a), ${nome}! 🎉</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Sua loja agora é parceira oficial do <strong style="color:#f97316;">Chegô Delivery</strong>!</p>

    <p style="font-size:14px;color:#374151;margin:0 0 4px;">Faça login agora para cadastrar seu cardápio e começar a receber pedidos.</p>

    ${credenciaisBox(email)}

    <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">⚠️ Guarde sua senha em local seguro. Não compartilhe com ninguém.</p>

    ${botao("Acessar painel da loja", `${BASE}/entrar`)}
  `)

  await resend.emails.send({
    from: "Chegô Delivery <noreply@chegodelivery.com>",
    to: email,
    subject: "Bem-vindo(a) ao Chegô Delivery! 🏪",
    html,
  })
}

export async function enviarCredenciaisLojista({
  nome,
  email,
  senhaTemporaria,
  linkTrocarSenha,
}: {
  nome: string
  email: string
  senhaTemporaria: string
  linkTrocarSenha: string
}) {
  const resend = getResend()
  if (!resend) return

  const html = base(`
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:900;color:#111827;">Seu acesso foi criado, ${nome}!</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">O administrador do <strong style="color:#f97316;">Chegô Delivery</strong> criou suas credenciais de acesso ao painel da loja.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;margin:0 0 20px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#ea580c;text-transform:uppercase;letter-spacing:1px;">Seus dados de acesso</p>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:5px 0;font-size:13px;color:#6b7280;width:90px;">E-mail</td>
              <td style="padding:5px 0;font-size:13px;font-weight:700;color:#111827;">${email}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;font-size:13px;color:#6b7280;">Senha</td>
              <td style="padding:5px 0;font-size:22px;font-weight:900;color:#f97316;letter-spacing:4px;">${senhaTemporaria}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:14px 18px;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#dc2626;font-weight:700;">⚠️ Esta é uma senha temporária.</p>
      <p style="margin:6px 0 0;font-size:13px;color:#991b1b;">No seu primeiro acesso, clique no botão abaixo para definir uma senha pessoal e segura.</p>
    </div>

    ${botao("Definir minha senha permanente", linkTrocarSenha)}

    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:16px 0 0;">Se não solicitou este acesso, ignore este e-mail.</p>
  `)

  await resend.emails.send({
    from: "Chegô Delivery <noreply@chegodelivery.com>",
    to: email,
    subject: "Seu acesso ao Chegô Delivery foi criado",
    html,
  })
}
