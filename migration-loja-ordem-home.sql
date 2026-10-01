-- Ordem manual das lojas na home do cliente (seções "Lojas Abertas {Cidade}").
-- NULL = sem ordem definida, cai no critério antigo (destaque > aberto > nome).
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS ordem_home INTEGER NULL;
