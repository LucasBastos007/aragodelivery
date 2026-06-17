-- Colunas adicionais para o fluxo de cadastro de loja
ALTER TABLE lojas
  ADD COLUMN IF NOT EXISTS aceita_retirada boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS valor_minimo numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comissao integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS nome_responsavel text,
  ADD COLUMN IF NOT EXISTS cpf_responsavel text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
