-- ============================================================
-- FASE 1 — Split de pagamento Asaas
-- ============================================================

ALTER TABLE lojas ADD COLUMN IF NOT EXISTS asaas_wallet_id text;
