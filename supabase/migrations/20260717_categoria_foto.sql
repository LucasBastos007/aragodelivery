-- Adiciona coluna de foto de capa para categorias
ALTER TABLE categorias_produto
  ADD COLUMN IF NOT EXISTS foto_url text;
