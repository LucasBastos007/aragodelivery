-- FASE 2: Dados fiscais por loja
ALTER TABLE lojas
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS inscricao_municipal text,
  ADD COLUMN IF NOT EXISTS regime_tributario  text,   -- 'mei' | 'simples' | 'lucro_presumido' | 'lucro_real'
  ADD COLUMN IF NOT EXISTS cnae               text,
  ADD COLUMN IF NOT EXISTS nfce_serie         smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fiscal_ativo       boolean  NOT NULL DEFAULT false;
