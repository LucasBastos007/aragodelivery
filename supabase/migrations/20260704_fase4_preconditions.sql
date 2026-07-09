-- PRÉ-CONDIÇÕES FASE 4: endereço estruturado + NCM

-- Endereço estruturado na loja (IF NOT EXISTS — perfil já salva esses campos)
ALTER TABLE lojas
  ADD COLUMN IF NOT EXISTS logradouro  text,
  ADD COLUMN IF NOT EXISTS numero      text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro      text,
  ADD COLUMN IF NOT EXISTS cidade      text,
  ADD COLUMN IF NOT EXISTS estado      text,
  ADD COLUMN IF NOT EXISTS cep         text;

-- NCM por produto (necessário para NFC-e)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ncm text;
