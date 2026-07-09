-- Colunas para fluxo de contrato digital (assinatura, token, selfie)

ALTER TABLE motoboys
  ADD COLUMN IF NOT EXISTS contrato_token          text,
  ADD COLUMN IF NOT EXISTS contrato_token_expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS contrato_assinado        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contrato_assinado_em     timestamptz,
  ADD COLUMN IF NOT EXISTS contrato_assinatura      text,
  ADD COLUMN IF NOT EXISTS selfie_contrato          text;

ALTER TABLE lojas
  ADD COLUMN IF NOT EXISTS contrato_token          text,
  ADD COLUMN IF NOT EXISTS contrato_token_expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS contrato_assinado        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contrato_assinado_em     timestamptz,
  ADD COLUMN IF NOT EXISTS contrato_assinatura      text;

-- Índice para busca por token (performance)
CREATE INDEX IF NOT EXISTS idx_motoboys_contrato_token ON motoboys(contrato_token) WHERE contrato_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lojas_contrato_token    ON lojas(contrato_token)    WHERE contrato_token IS NOT NULL;
