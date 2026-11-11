// Endereços aceitos pra inscrição de notificação: só os serviços de push de verdade
// (Google, Mozilla, Apple, Microsoft). Evita o servidor chamar URL qualquer (31/10/2026).
const PUSH_OK = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "push.apple.com", "notify.windows.com"]

export function inscricaoValida(sub: any): boolean {
  const ep = sub?.endpoint
  if (typeof ep !== "string" || !ep.startsWith("https://") || ep.length > 1000 || !sub?.keys?.p256dh || !sub?.keys?.auth) return false
  let host = ""
  try { host = new URL(ep).hostname.toLowerCase() } catch { return false }
  return PUSH_OK.some(d => host === d || host.endsWith("." + d))
}
