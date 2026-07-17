CREATE TABLE IF NOT EXISTS clientes_avulsos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id       uuid NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  telefone      text,
  endereco      text,
  total_pedidos int     NOT NULL DEFAULT 0,
  valor_total   numeric NOT NULL DEFAULT 0,
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clientes_avulsos_loja_tel
  ON clientes_avulsos (loja_id, telefone)
  WHERE telefone IS NOT NULL AND telefone <> '';

ALTER TABLE clientes_avulsos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loja acessa proprios clientes"
  ON clientes_avulsos FOR ALL USING (true);
