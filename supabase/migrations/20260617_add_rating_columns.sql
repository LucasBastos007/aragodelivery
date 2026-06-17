-- Adiciona colunas de avaliação na tabela lojas
ALTER TABLE lojas
  ADD COLUMN IF NOT EXISTS nota_media float8,
  ADD COLUMN IF NOT EXISTS total_avaliacoes integer DEFAULT 0;

-- Adiciona colunas de avaliação na tabela motoboys (caso não existam)
ALTER TABLE motoboys
  ADD COLUMN IF NOT EXISTS nota_media float8,
  ADD COLUMN IF NOT EXISTS total_avaliacoes integer DEFAULT 0;
