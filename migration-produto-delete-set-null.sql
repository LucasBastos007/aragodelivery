-- Execute no Supabase SQL Editor
-- itens_pedido.produto_id referenciava produtos(id) sem ON DELETE, então deletar
-- qualquer produto que já tenha sido pedido falhava com violação de FK (a API
-- engolia o erro e a tela recarregava mostrando o produto "voltando"). O histórico
-- do pedido não depende do produto continuar existindo — nome/preco já ficam
-- congelados na própria linha de itens_pedido — então SET NULL é seguro.
ALTER TABLE itens_pedido DROP CONSTRAINT IF EXISTS itens_pedido_produto_id_fkey;
ALTER TABLE itens_pedido
  ADD CONSTRAINT itens_pedido_produto_id_fkey
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL;
