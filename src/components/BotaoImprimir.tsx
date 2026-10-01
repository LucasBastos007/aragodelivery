import type { Pedido } from "@/types"

// Extraído de src/app/loja/page.tsx (Fase 3) em 2026-09-23 pra ser reutilizado pelo
// Histórico (Fase 4). Visual/comportamento idênticos ao que já estava em produção;
// `sempreReimprimir` é a única adição — no Histórico o botão deve sempre dizer
// "Reimprimir" (o pedido já está encerrado), não só depois do primeiro clique da sessão.
export function BotaoImprimir({ pedido, larguraPapel, ultimaImpressao, onImprimir, onToggleLargura, sempreReimprimir }: {
  pedido: Pedido; larguraPapel: "80mm" | "58mm"; ultimaImpressao?: string
  onImprimir: (p: Pedido) => void; onToggleLargura: () => void
  sempreReimprimir?: boolean
}) {
  const mostrarComoReimpressao = sempreReimprimir || !!ultimaImpressao
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          onClick={() => onImprimir(pedido)}
          title={mostrarComoReimpressao ? `Reimprimir comanda (${larguraPapel})` : `Imprimir comanda (${larguraPapel})`}
          style={{
            padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb",
            background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            color: "#6B7280", fontSize: 12, fontWeight: 600,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          {mostrarComoReimpressao ? "Reimprimir" : "Imprimir"}
        </button>
        <button
          onClick={onToggleLargura}
          title="Alternar tamanho do papel"
          style={{
            padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb",
            background: "#f9fafb", cursor: "pointer", fontSize: 10, fontWeight: 700,
            color: "#6B7280", lineHeight: 1,
          }}
        >
          {larguraPapel}
        </button>
      </div>
      {ultimaImpressao && (
        <span style={{ fontSize: 10.5, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 4 }}>
          🖨 Impresso às {new Date(ultimaImpressao).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  )
}
