-- ════════════════════════════════════════════════════════════════════════════
-- DESFAZ a etapa 1 de segurança (24/11/2026). Rodar no Supabase › SQL Editor só
-- se alguma tela parar de funcionar depois de seguranca-2026-11-24.sql.
-- Volta as permissões ao padrão do Supabase e recria as regras antigas do backup.
-- ════════════════════════════════════════════════════════════════════════════

begin;

grant all on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;

-- Regras novas saem
drop policy if exists cliente_ve_o_seu    on public.clientes;
drop policy if exists cliente_cria_o_seu  on public.clientes;
drop policy if exists cliente_edita_o_seu on public.clientes;
drop policy if exists config_publica      on public.configuracoes;

-- RLS como estava
do $$ declare r record; begin
  for r in select tabela, rls from public._seg_backup_rls where tabela in ('clientes', 'configuracoes') loop
    if r.rls then execute format('alter table public.%I enable row level security', r.tabela);
    else          execute format('alter table public.%I disable row level security', r.tabela); end if;
  end loop;
end $$;

-- Regras antigas de volta
do $$ declare r record; begin
  for r in select * from public._seg_backup_policies where tablename in ('clientes', 'configuracoes') loop
    execute format('create policy %I on public.%I as %s for %s to %s %s %s',
      r.policyname, r.tablename, r.permissive, r.cmd, array_to_string(r.roles, ', '),
      case when r.qual is not null then 'using (' || r.qual || ')' else '' end,
      case when r.with_check is not null then 'with check (' || r.with_check || ')' else '' end);
  end loop;
end $$;

-- As tabelas de backup não devem ficar abertas
revoke all on public._seg_backup_policies, public._seg_backup_rls from anon, authenticated;

commit;
