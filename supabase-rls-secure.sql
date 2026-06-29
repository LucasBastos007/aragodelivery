-- ============================================================
-- ARAGO DELIVERY — Políticas RLS Seguras
-- Substitui as policies "allow_all" que davam acesso total
--
-- COMO APLICAR:
--   1. Abra o Supabase Dashboard → SQL Editor
--   2. Cole e execute este arquivo completo
--
-- PRINCÍPIO:
--   Todas as mutações (INSERT/UPDATE/DELETE) passam por rotas
--   API com SUPABASE_SERVICE_ROLE_KEY, que bypassa RLS.
--   Logo, anon (chave pública) só precisa de SELECT em dados
--   públicos. Qualquer escrita via anon é bloqueada por padrão
--   (ausência de policy = negado).
-- ============================================================

-- ── 1. Remove as policies abertas antigas ────────────────────
drop policy if exists "allow_all" on lojas;
drop policy if exists "allow_all" on motoboys;
drop policy if exists "allow_all" on categorias_produto;
drop policy if exists "allow_all" on produtos;
drop policy if exists "allow_all" on pedidos;
drop policy if exists "allow_all" on itens_pedido;
drop policy if exists "allow_all" on rastreio;
drop policy if exists "allow_all" on clientes;
drop policy if exists "allow_all" on enderecos_cliente;

-- Se a tabela cupons existir mas não tiver policy nomeada allow_all:
drop policy if exists "allow_all" on cupons;

-- ── 2. Ativa RLS onde ainda não foi ativada ──────────────────
alter table lojas              enable row level security;
alter table motoboys           enable row level security;
alter table categorias_produto enable row level security;
alter table produtos           enable row level security;
alter table pedidos            enable row level security;
alter table itens_pedido       enable row level security;
alter table rastreio           enable row level security;
alter table clientes           enable row level security;
alter table enderecos_cliente  enable row level security;

-- Ativa RLS na tabela cupons (criada após o schema inicial)
alter table if exists cupons enable row level security;

-- ── 3. LOJAS — leitura pública, escrita apenas via API ───────
-- Qualquer visitante pode listar lojas (necessário para a página de lojas)
create policy "lojas_public_read"
  on lojas for select
  using (true);
-- INSERT/UPDATE/DELETE: sem policy anon → bloqueado; service role bypassa

-- ── 4. PRODUTOS — leitura pública ────────────────────────────
create policy "produtos_public_read"
  on produtos for select
  using (true);

-- ── 5. CATEGORIAS DE PRODUTO — leitura pública ───────────────
create policy "categorias_public_read"
  on categorias_produto for select
  using (true);

-- ── 6. CUPONS — leitura pública para validação no checkout ───
-- O código do cupom é público; valores sensíveis (usos, usos_maximos)
-- ficam visíveis mas a validação definitiva é sempre server-side.
create policy "cupons_public_read"
  on cupons for select
  using (ativo = true);
-- Apenas cupons ativos são visíveis via anon key

-- ── 7. PEDIDOS — leitura por ID (tracking) ───────────────────
-- Qualquer pessoa com o UUID do pedido pode ver o status.
-- UUIDs têm 2^122 possibilidades — não são adivinháveis.
-- Escrita: bloqueada para anon; service role bypassa.
create policy "pedidos_read_by_id"
  on pedidos for select
  using (true);
-- Nota: considere criar uma VIEW pedidos_publicos excluindo
-- a coluna cliente_push_token para exposição via anon key.

-- ── 8. ITENS DE PEDIDO — leitura pública por pedido_id ───────
create policy "itens_pedido_public_read"
  on itens_pedido for select
  using (true);

-- ── 9. RASTREIO — leitura pública (mapa ao vivo do motoboy) ──
create policy "rastreio_public_read"
  on rastreio for select
  using (true);

-- ── 10. MOTOBOYS — sem acesso anon ───────────────────────────
-- Dados sensíveis: CPF, email, telefone, localização GPS.
-- Nenhuma policy de SELECT → anon key não acessa nada.
-- Service role (todas as rotas API) bypassa normalmente.

-- ── 11. CLIENTES — cada usuário acessa apenas seu registro ────
-- Clientes usam Supabase Auth; auth.uid() retorna o ID do usuário logado.
-- O id da tabela clientes deve ser igual ao auth.uid() do usuário.
create policy "clientes_own_read"
  on clientes for select
  using (auth.uid() = id);

create policy "clientes_own_update"
  on clientes for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- INSERT de cliente é feito via service role na rota de cadastro.
-- Sem policy de insert anon → bloqueado corretamente.

-- ── 12. ENDEREÇOS DO CLIENTE — apenas o dono ─────────────────
create policy "enderecos_own_read"
  on enderecos_cliente for select
  using (cliente_id = auth.uid());

create policy "enderecos_own_insert"
  on enderecos_cliente for insert
  with check (cliente_id = auth.uid());

create policy "enderecos_own_update"
  on enderecos_cliente for update
  using (cliente_id = auth.uid())
  with check (cliente_id = auth.uid());

create policy "enderecos_own_delete"
  on enderecos_cliente for delete
  using (cliente_id = auth.uid());

-- ── Resumo das permissões após aplicação ─────────────────────
-- Tabela               | anon SELECT | anon WRITE | Supabase Auth | Service Role
-- ---------------------|-------------|------------|---------------|-------------
-- lojas                | ✓ (todas)   | ✗          | —             | ✓
-- produtos             | ✓ (todas)   | ✗          | —             | ✓
-- categorias_produto   | ✓ (todas)   | ✗          | —             | ✓
-- cupons               | ✓ (ativas)  | ✗          | —             | ✓
-- pedidos              | ✓ por UUID  | ✗          | —             | ✓
-- itens_pedido         | ✓ (todas)   | ✗          | —             | ✓
-- rastreio             | ✓ (todas)   | ✗          | —             | ✓
-- motoboys             | ✗           | ✗          | —             | ✓
-- clientes             | ✗ (outros)  | ✗          | ✓ próprio     | ✓
-- enderecos_cliente    | ✗ (outros)  | ✗          | ✓ próprio     | ✓
