-- Rodada 5 — Dashboard/Pedidos lojista (Chegô Delivery)
-- Adiciona cancelado_em pra registrar QUANDO um pedido foi cancelado, complementando
-- cancelado_por e motivo_cancelamento (que já existem). Nullable: pedidos antigos já
-- cancelados continuam com cancelado_em = null (não é preenchido retroativamente).
--
-- Rodar manualmente no SQL Editor do Supabase — este projeto não tem CLI/migration
-- tool (ver AGENTS.md).

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz NULL;
