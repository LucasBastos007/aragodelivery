-- RODAR MANUALMENTE no SQL Editor do projeto DEV (aragodelivery-dev, ref stndcgeurgdjtzxhhrwn).
-- NÃO RODAR EM PRODUÇÃO (aragodelivery, ref vgnqyalxqhgtlfbitpwx).
--
-- Elimina o full-scan de "todos os pedidos entregues da loja" que /api/loja/financeiro e
-- /api/loja/saque faziam pra somar em JS — agora a soma acontece no banco. Só leitura/
-- agregação, sem GRANT pra anon/authenticated: só o service_role pode chamar, e só o
-- código server-side (src/lib/financeiroLoja.ts, dentro de rotas protegidas por
-- requireLoja()) chama — o p_loja_id nunca vem do cliente.

create or replace function public.financeiro_totais_loja(p_loja_id uuid)
returns table (
  receita_bruta numeric,
  qtd_pedidos integer
)
language sql
stable
as $$
  select
    coalesce(sum(subtotal), 0),
    count(*)::integer
  from pedidos
  where loja_id = p_loja_id
    and status = 'entregue'
$$;

revoke all on function public.financeiro_totais_loja(uuid) from public;
revoke all on function public.financeiro_totais_loja(uuid) from anon;
revoke all on function public.financeiro_totais_loja(uuid) from authenticated;

grant execute on function public.financeiro_totais_loja(uuid) to service_role;
