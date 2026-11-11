"use client"
import { useEffect, useState } from "react"
// Mesmo texto que o robô procura (#CODIGO + "pag"), ver app/api/whats/bot
const MSG_PAGAMENTO = (codigo: string) => `Olá! Tive um problema para pagar o pedido #${codigo} na Chegô.`

// Botão "Problema com o pagamento?" na tela do Pix (24/10/2026). Abre o WhatsApp da Chegô com a
// mensagem pronta; o robô responde com um Pix novo (ver app/api/whats/bot).
export default function AjudaPagamentoWhats({ codigo }: { codigo?: string | null }) {
  const [numero, setNumero] = useState<string | null>(null)
  useEffect(() => { fetch("/api/whats/suporte").then(r => r.json()).then(j => setNumero(j.numero)).catch(() => {}) }, [])
  if (!numero || !codigo) return null
  const href = `https://wa.me/${numero}?text=${encodeURIComponent(MSG_PAGAMENTO(codigo))}`
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 14, padding: "13px 16px", borderRadius: 14, border: "1.5px solid #25D366", color: "#128C7E", fontWeight: 700, fontSize: 15, textDecoration: "none", background: "#f1fbf4" }}>
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><path fill="#25D366" d="M16 3C9 3 3.3 8.6 3.3 15.6c0 2.5.7 4.8 2 6.8L3 29l6.8-2.2c1.9 1 4 1.6 6.2 1.6 7 0 12.7-5.7 12.7-12.7S23 3 16 3z"/><path fill="#fff" d="M23.4 19.3c-.3.9-1.8 1.7-2.5 1.8-.6.1-1.5.1-2.4-.2-.6-.2-1.3-.4-2.2-.8-3.9-1.7-6.4-5.6-6.6-5.9-.2-.3-1.6-2.1-1.6-4s1-2.9 1.4-3.3c.3-.4.8-.5 1-.5h.7c.2 0 .5-.1.8.6.3.7 1 2.4 1.1 2.6.1.2.1.4 0 .6-.1.2-.2.4-.4.6-.2.2-.4.5-.5.6-.2.2-.4.4-.2.8.2.4 1 1.6 2.1 2.6 1.4 1.3 2.6 1.7 3 1.9.4.2.6.2.8-.1.2-.3 1-1.1 1.2-1.5.3-.4.5-.3.9-.2.4.1 2.3 1.1 2.7 1.3.4.2.7.3.8.5.1.1.1.9-.2 1.8z"/></svg>
      Problema com o pagamento? Fale com a gente
    </a>
  )
}
