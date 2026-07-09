-- FASE 4: tabela de notas fiscais + flag Focus NFe

ALTER TABLE lojas
  ADD COLUMN IF NOT EXISTS focusnfe_cadastrado boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS notas_fiscais (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id     uuid        REFERENCES pedidos(id),
  loja_id       uuid        REFERENCES lojas(id),
  ref           text        NOT NULL UNIQUE,
  status        text        NOT NULL DEFAULT 'pendente',
  numero        text,
  serie         text,
  chave_acesso  text,
  danfe_url     text,
  xml_url       text,
  erro_msg      text,
  tentativas    smallint    NOT NULL DEFAULT 0,
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

ALTER TABLE notas_fiscais ENABLE ROW LEVEL SECURITY;

-- Lojista lê apenas suas próprias notas
CREATE POLICY "notas_loja_read" ON notas_fiscais FOR SELECT
  USING (
    loja_id IN (
      SELECT id FROM lojas WHERE id = loja_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_notas_pedido ON notas_fiscais(pedido_id);
CREATE INDEX IF NOT EXISTS idx_notas_loja   ON notas_fiscais(loja_id);
