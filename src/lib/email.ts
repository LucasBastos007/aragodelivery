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

function credenciaisBox(email: string, senha: string) {
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
            <td style="padding:4px 0;font-size:13px;font-weight:700;color:#111827;">${senha}</td>
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

export async function enviarBoasVindasMotoboy({
  nome,
  email,
  senha,
}: {
  nome: string
  email: string
  senha: string
}) {
  const resend = getResend()
  if (!resend) return

  const html = base(`
    <h1 style="margin:0 0 6px;font-size:24px;font-weight:900;color:#111827;">Bem-vindo(a), ${nome}! 🎉</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Seu contrato foi assinado com sucesso. Você faz parte da equipe <strong style="color:#f97316;">Chegô Delivery</strong>!</p>

    <p style="font-size:14px;color:#374151;margin:0 0 4px;">Sua conta já está <strong style="color:#16a34a;">ativa</strong>! Faça login agora e comece a receber pedidos.</p>

    ${credenciaisBox(email, senha)}

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

export async function enviarBoasVindasLoja({
  nome,
  email,
  senha,
}: {
  nome: string
  email: string
  senha: string
}) {
  const resend = getResend()
  if (!resend) return

  const html = base(`
    <h1 style="margin:0 0 6px;font-size:24px;font-weight:900;color:#111827;">Bem-vindo(a), ${nome}! 🎉</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Seu contrato foi assinado com sucesso. Sua loja agora é parceira oficial do <strong style="color:#f97316;">Chegô Delivery</strong>!</p>

    <p style="font-size:14px;color:#374151;margin:0 0 4px;">Sua loja já está <strong style="color:#16a34a;">ativa</strong>! Faça login agora para cadastrar seu cardápio e começar a receber pedidos.</p>

    ${credenciaisBox(email, senha)}

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
