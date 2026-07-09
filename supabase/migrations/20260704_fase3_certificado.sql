-- FASE 3: Certificado digital A1 e CSC por loja

-- Habilita Supabase Vault (já ativo na maioria dos projetos)
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Colunas na tabela lojas
ALTER TABLE lojas
  ADD COLUMN IF NOT EXISTS cert_a1_path          text,     -- caminho no bucket Storage 'certificados'
  ADD COLUMN IF NOT EXISTS cert_a1_expires_at    date,     -- validade do certificado
  ADD COLUMN IF NOT EXISTS cert_a1_senha_vault_id uuid,    -- ID do secret no Vault (senha do .pfx)
  ADD COLUMN IF NOT EXISTS csc_id                text,     -- Código de Segurança do Contribuinte (ID)
  ADD COLUMN IF NOT EXISTS csc_token_vault_id    uuid;     -- ID do secret no Vault (token CSC)

-- Bucket privado para certificados .pfx
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificados',
  'certificados',
  false,
  10485760,
  ARRAY['application/x-pkcs12','application/octet-stream','application/pkcs12']
)
ON CONFLICT (id) DO NOTHING;

-- Funções wrapper para o Vault (chamadas via service role a partir do Next.js)
CREATE OR REPLACE FUNCTION public.create_vault_secret(
  p_secret      text,
  p_name        text,
  p_description text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN vault.create_secret(p_secret, p_name, p_description);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_vault_secret(p_id uuid, p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE vault.secrets SET secret = p_secret WHERE id = p_id;
END;
$$;

-- Leitura de secret (usada em FASE 4 pelo emissor de NFC-e)
CREATE OR REPLACE FUNCTION public.read_vault_secret(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result text;
BEGIN
  SELECT decrypted_secret INTO result FROM vault.decrypted_secrets WHERE id = p_id;
  RETURN result;
END;
$$;

-- Apenas service role pode chamar essas funções
REVOKE ALL ON FUNCTION public.create_vault_secret FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_vault_secret FROM PUBLIC;
REVOKE ALL ON FUNCTION public.read_vault_secret   FROM PUBLIC;
