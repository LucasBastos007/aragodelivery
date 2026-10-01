-- RODAR MANUALMENTE no SQL Editor do projeto DEV (aragodelivery-dev, ref stndcgeurgdjtzxhhrwn).
-- NÃO RODAR EM PRODUÇÃO.
--
-- Substitui financeiro_totais_loja (que só agregava pedidos) por uma função mais completa,
-- e adiciona solicitar_saque_loja pra resolver uma race condition real: duas solicitações
-- de saque simultâneas liam o mesmo saldo (calculado em JS, fora de qualquer transação) antes
-- de qualquer uma gravar — as duas podiam passar no "valor <= saldo" e as duas inserirem,
-- ultrapassando o saldo real da loja. Isso NUNCA foi seguro mesmo depois da consolidação em
-- carregarFinanceiroLoja(), porque o check e o insert continuavam sendo 2 chamadas HTTP
-- separadas ao Supabase, sem lock nenhum entre elas.
--
-- pg_advisory_xact_lock(hashtext(loja_id)) serializa chamadas concorrentes da MESMA loja
-- (a segunda espera a primeira commitar, e só então lê o saldo já atualizado) sem travar
-- lojas diferentes entre si. O lock é liberado automaticamente no fim da transação.

drop function if exists public.financeiro_totais_loja(uuid);

create or replace function public.saldo_financeiro_loja(p_loja_id uuid)
returns table (
  receita_bruta            numeric,
  qtd_pedidos              integer,
  comissao_pct             numeric,
  total_comissao           numeric,
  total_mensalidades       numeric,
  total_saques_pagos       numeric,
  total_saques_solicitados numeric,
  saldo                    numeric,
  pix_key                  text
)
language plpgsql
stable
as $$
declare
  v_comissao_pct numeric;
  v_pix_key      text;
  v_receita      numeric;
  v_qtd          integer;
  v_comissao     numeric;
  v_mens         numeric;
  v_pagos        numeric;
  v_solicitado   numeric;
begin
  select l.comissao, l.pix_key into v_comissao_pct, v_pix_key
  from lojas l where l.id = p_loja_id;

  select coalesce(sum(p.subtotal), 0), count(*)::integer
  into v_receita, v_qtd
  from pedidos p where p.loja_id = p_loja_id and p.status = 'entregue';

  v_comissao := v_receita * coalesce(v_comissao_pct, 0) / 100;

  select coalesce(sum(m.valor), 0) into v_mens
  from mensalidades m where m.loja_id = p_loja_id and m.status = 'descontado';

  select coalesce(sum(s.valor), 0) into v_pagos
  from saques s where s.loja_id = p_loja_id and s.tipo = 'lojista' and s.status = 'pago';

  select coalesce(sum(s.valor), 0) into v_solicitado
  from saques s where s.loja_id = p_loja_id and s.tipo = 'lojista' and s.status = 'solicitado';

  return query select
    v_receita, v_qtd, v_comissao_pct, v_comissao, v_mens, v_pagos, v_solicitado,
    greatest(0, (v_receita - v_comissao) - v_mens - v_pagos - v_solicitado),
    v_pix_key;
end;
$$;

revoke all on function public.saldo_financeiro_loja(uuid) from public;
revoke all on function public.saldo_financeiro_loja(uuid) from anon;
revoke all on function public.saldo_financeiro_loja(uuid) from authenticated;
grant execute on function public.saldo_financeiro_loja(uuid) to service_role;


create or replace function public.solicitar_saque_loja(p_loja_id uuid, p_valor numeric)
returns table (ok boolean, saque_id uuid, saldo_disponivel numeric, motivo text)
language plpgsql
as $$
declare
  rec        record;
  v_saque_id uuid;
begin
  if p_valor is null or p_valor <= 0 then
    return query select false, null::uuid, 0::numeric, 'VALOR_INVALIDO'; return;
  end if;

  if not exists (select 1 from lojas where id = p_loja_id) then
    return query select false, null::uuid, 0::numeric, 'LOJA_NAO_ENCONTRADA'; return;
  end if;

  -- Serializa qualquer outra chamada concorrente pra esta MESMA loja até o fim desta
  -- transação (commit ou rollback) — é isso que impede dois saques simultâneos de
  -- consumirem o mesmo saldo.
  perform pg_advisory_xact_lock(hashtext(p_loja_id::text));

  select * into rec from saldo_financeiro_loja(p_loja_id);

  if rec.pix_key is null or rec.pix_key = '' then
    return query select false, null::uuid, rec.saldo, 'SEM_PIX'; return;
  end if;

  if p_valor > rec.saldo + 0.001 then
    return query select false, null::uuid, rec.saldo, 'SALDO_INSUFICIENTE'; return;
  end if;

  insert into saques (tipo, loja_id, valor, pix_chave, status)
  values ('lojista', p_loja_id, p_valor, rec.pix_key, 'solicitado')
  returning id into v_saque_id;

  return query select true, v_saque_id, rec.saldo, null::text;
end;
$$;

revoke all on function public.solicitar_saque_loja(uuid, numeric) from public;
revoke all on function public.solicitar_saque_loja(uuid, numeric) from anon;
revoke all on function public.solicitar_saque_loja(uuid, numeric) from authenticated;
grant execute on function public.solicitar_saque_loja(uuid, numeric) to service_role;
