CREATE TABLE IF NOT EXISTS tabela_frete (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id   uuid NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  municipio text NOT NULL,
  taxa      numeric NOT NULL,
  UNIQUE (loja_id, municipio)
);

ALTER TABLE tabela_frete ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loja acessa propria tabela" ON tabela_frete FOR ALL USING (true);
