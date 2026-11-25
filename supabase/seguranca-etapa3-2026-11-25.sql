-- ════════════════════════════════════════════════════════════════════════════
-- Segurança do banco do Chegô — ETAPA 3 (25/11/2026): proteger o CARDÁPIO
-- Rodar no Supabase › SQL Editor DEPOIS que a versão nova do app (com /api/cardapio)
-- estiver no ar. Para desfazer: seguranca-etapa3-2026-11-25-VOLTAR.sql
--
-- O que muda: o navegador (chave pública "anon") para de ler produtos e categorias
-- direto do banco. O app passa a pedir o cardápio pela rota /api/cardapio, que serve
-- UMA loja por vez, com limite por IP e registro de abuso. Assim ninguém copia o
-- catálogo inteiro de uma vez (caso do app concorrente que clonava os cardápios).
-- O servidor do app usa a service role e não é afetado.
-- ════════════════════════════════════════════════════════════════════════════

begin;

revoke select on public.produtos          from anon, authenticated;
revoke select on public.categorias_produto from anon, authenticated;

commit;

-- Conferência: produtos e categorias NÃO devem aparecer para o anon -------------
select table_name
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon'
  and table_name in ('produtos', 'categorias_produto');
-- (o resultado acima deve vir VAZIO)
