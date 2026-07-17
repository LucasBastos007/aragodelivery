ALTER TABLE entregas_avulsas
  ADD COLUMN IF NOT EXISTS loja_nome text,
  ADD COLUMN IF NOT EXISTS loja_lat  float8,
  ADD COLUMN IF NOT EXISTS loja_lng  float8;
