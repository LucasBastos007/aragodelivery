// Ajuda de pagamento pelo WhatsApp (pedido do Lucas, 24/10/2026): botão na tela do Pix abre o
// WhatsApp da Chegô (número da instância Z-API) e um robô responde só a "problema com o
// pagamento do pedido #CODIGO", gerando um Pix novo pelo Asaas para o próprio cliente.
import crypto from "crypto"

const Z = () => ({ id: process.env.ZAPI_INSTANCE_ID, token: process.env.ZAPI_TOKEN, client: process.env.ZAPI_CLIENT_TOKEN })
export const zapiOk = () => { if (process.env.ZAPI_SIMULAR === "1") return true; const z = Z(); return !!(z.id && z.token && z.client) }

export async function zapi(path: string, method = "GET", body?: object) {
  // Só na cópia de teste: registra o que seria enviado em vez de mandar (ZAPI_SIMULAR=1)
  if (process.env.ZAPI_SIMULAR === "1") { console.log("[ZAPI SIMULADO]", path, JSON.stringify(body ?? {}).slice(0, 600)); return { simulado: true } }
  const z = Z()
  const r = await fetch(`https://api.z-api.io/instances/${z.id}/token/${z.token}/${path}`, {
    method, headers: { "Client-Token": z.client!, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined, cache: "no-store",
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Z-API ${path} HTTP ${r.status}`)
  return j
}

export async function enviarTexto(telefone: string, mensagem: string) {
  return zapi("send-text", "POST", { phone: telefone.replace(/\D/g, ""), message: mensagem })
}

/** Senha do endereço que o Z-API chama ao receber mensagem (o Z-API não assina os avisos). */
export function chaveBot() {
  return crypto.createHash("sha256").update(`${process.env.SUPABASE_SERVICE_ROLE_KEY}|zapi-bot`).digest("hex").slice(0, 32)
}

/** Últimos 8 dígitos: compara telefones com ou sem DDI/DDD e com ou sem o 9 extra. */
export const final8 = (t?: string | null) => (t ?? "").replace(/\D/g, "").slice(-8)
