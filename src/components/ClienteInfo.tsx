import type { Pedido } from "@/types"

// Extraído de src/app/loja/page.tsx (Fase 3) em 2026-09-23 pra ser reutilizado pelo
// Histórico (Fase 4) — mesmo componente, mesma aparência. `contadorClientes` é opcional
// (o badge "1º pedido"/"Nº pedido" some quando não informado) porque calcular esse
// contador pra qualquer pedido do Histórico exigiria uma query extra por card; no
// Pedidos (Fase 3) o contador já é calculado uma vez pra todos os pedidos do dia.
// `compact`: usado pelo card do board de Pedidos (CardAndamento) pra caber mais
// informação num card menor — mesmos dados, só menos respiro. O drawer de detalhe e o
// card "Novo pedido" continuam do jeito que já estavam (sem a prop).
export function ClienteInfo({ pedido, contadorClientes, compact }: { pedido: Pedido; contadorClientes?: Record<string, number>; compact?: boolean }) {
  if (!pedido.nome_cliente && !pedido.endereco_entrega) return null
  const totalPedidos = contadorClientes && pedido.telefone_cliente ? (contadorClientes[pedido.telefone_cliente] ?? 0) : null
  const isPrimeiro = totalPedidos === 0
  return (
    <div style={{
      background: "#F8FAFC", borderRadius: compact ? 10 : 12, padding: compact ? "7px 9px" : "10px 13px", marginBottom: compact ? 6 : 12,
      border: "1px solid #E5E7EB", display: "flex", flexDirection: "column", gap: compact ? 3 : 5,
    }}>
      {compact ? (
        // Nome e telefone SEMPRE completos, cada um na sua linha — nada de truncar
        // com "..." (era isso que cortava "Cliente Teste" pra "Clien...").
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
              <span style={{ fontSize: 12, flexShrink: 0 }}>👤</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>{pedido.nome_cliente ?? "—"}</span>
            </div>
            {totalPedidos !== null && (
              <span style={{
                fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0,
                background: isPrimeiro ? "rgba(249,115,22,0.12)" : "rgba(34,197,94,0.1)",
                color: isPrimeiro ? "#ea580c" : "#15803d",
              }}>
                {isPrimeiro ? "1º pedido" : `${totalPedidos + 1}º pedido`}
              </span>
            )}
          </div>
          {pedido.telefone_cliente && (
            <span style={{ fontSize: 11.5, color: "#6B7280", paddingLeft: 17 }}>{pedido.telefone_cliente}</span>
          )}
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 14 }}>👤</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
              {pedido.nome_cliente ?? "—"}
            </span>
            {pedido.telefone_cliente && (
              <span style={{ fontSize: 12, color: "#6B7280" }}>{pedido.telefone_cliente}</span>
            )}
          </div>
          {totalPedidos !== null && (
            <span style={{
              fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap",
              background: isPrimeiro ? "rgba(249,115,22,0.12)" : "rgba(34,197,94,0.1)",
              color: isPrimeiro ? "#ea580c" : "#15803d",
            }}>
              {isPrimeiro ? "1º pedido" : `${totalPedidos + 1}º pedido`}
            </span>
          )}
        </div>
      )}
      {pedido.endereco_entrega && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <span style={{ fontSize: compact ? 11 : 12, flexShrink: 0, marginTop: 1 }}>📍</span>
          <span style={{ fontSize: compact ? 11 : 12, color: "#374151", lineHeight: 1.35 }}>{pedido.endereco_entrega}</span>
        </div>
      )}
    </div>
  )
}
