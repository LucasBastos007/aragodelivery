-- Adiciona suporte a motoboy nas entregas avulsas
ALTER TABLE entregas_avulsas
  ADD COLUMN IF NOT EXISTS motoboy_id   uuid REFERENCES motoboys(id),
  ADD COLUMN IF NOT EXISTS motoboy_nome text;
