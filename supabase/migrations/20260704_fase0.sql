-- ============================================================
-- FASE 0 — Correções urgentes (segurança + fundação)
-- Execute no Supabase SQL Editor
-- ============================================================

-- ── 1. Idempotência do webhook Asaas ────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider          text        NOT NULL,                        -- 'asaas'
  external_event_id text        NOT NULL,                        -- event ID do provider
  payload           jsonb,
  processed_at      timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now(),
  UNIQUE (provider, external_event_id)
);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy anon: leitura/escrita só via service role

-- ── 2. RLS — reembolsos (allow_all → restrito) ───────────────
DROP POLICY IF EXISTS "allow_all" ON reembolsos;

-- Admin/API usa service role (bypassa RLS), não precisa de policy de escrita
-- Cliente autenticado pode ver apenas reembolsos de pedidos próprios
-- (pedidos.cliente_id = auth.uid())
CREATE POLICY "reembolsos_owner_read"
  ON reembolsos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id = reembolsos.pedido_id
        AND p.cliente_id = auth.uid()
    )
  );
-- Sem policy de INSERT/UPDATE/DELETE para anon/auth → bloqueado; service role bypassa

-- ── 3. RLS — configuracoes (allow_all → service role only) ───
DROP POLICY IF EXISTS "allow_all" ON configuracoes;
-- Sem nenhuma policy → anon e authenticated não acessam nada
-- Service role (todas as rotas API) bypassa normalmente

-- ── 4. pix_key em motoboys (segurança: confirma coluna existe) ─
ALTER TABLE motoboys ADD COLUMN IF NOT EXISTS pix_key text;

-- ── 5. cpf_cliente em pedidos (para PIX sem CPF inventado) ───
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cpf_cliente text;
