-- DESFAZ a etapa 3 (25/11/2026). Rodar no Supabase › SQL Editor só se o cardápio
-- parar de carregar depois de seguranca-etapa3-2026-11-25.sql.
-- Volta a leitura direta de produtos e categorias para a chave pública.

begin;

grant select on public.produtos           to anon, authenticated;
grant select on public.categorias_produto to anon, authenticated;

commit;
