import type { Pedido } from "@/types"

// Extraído de src/app/loja/page.tsx (Fase 3) em 2026-09-23 pra ser reutilizado pelo
// Histórico (Fase 4) — mesma implementação, já era "somente leitura" por natureza (só
// renderiza, não dispara nenhuma ação). Timestamps REAIS do pedido — nunca estimar/
// inventar uma etapa que não tem timestamp gravado. Cada etapa só aparece se o campo
// correspondente existir no banco — por isso um pedido cancelado já funciona certo aqui
// sem nenhum ajuste: só mostra as etapas que realmente aconteceram antes do cancelamento,
// nunca finge que "pronto"/"entregue" ocorreram se não tiver esses timestamps.
export function timelineDoPedido(p: Pedido): { label: string; timestamp: string }[] {
  const entradas: { label: string; timestamp: string }[] = [
    { label: "Pedido recebido", timestamp: p.criado_em },
  ]
  if (p.aceito_em) entradas.push({ label: "Aceito pela loja", timestamp: p.aceito_em })
  if (p.pronto_em) entradas.push({ label: "Pronto", timestamp: p.pronto_em })
  if (p.coletado_em) entradas.push({ label: "Coletado pelo motoboy", timestamp: p.coletado_em })
  if (p.entregue_em) entradas.push({ label: "Entregue", timestamp: p.entregue_em })
  if (p.cancelado_em) entradas.push({ label: "Cancelado", timestamp: p.cancelado_em })
  return entradas
}

export function TimelinePedido({ pedido }: { pedido: Pedido }) {
  const entradas = timelineDoPedido(pedido)
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {entradas.map((e, i) => (
        <div key={i} style={{ display: "flex", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16, flexShrink: 0 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: i === entradas.length - 1 ? "#f97316" : "#D1D5DB", marginTop: 3, flexShrink: 0 }} />
            {i < entradas.length - 1 && <div style={{ width: 2, flex: 1, background: "#E5E7EB", minHeight: 18 }} />}
          </div>
          <div style={{ paddingBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{e.label}</p>
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
              {new Date(e.timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
