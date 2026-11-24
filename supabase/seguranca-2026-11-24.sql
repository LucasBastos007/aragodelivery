-- ════════════════════════════════════════════════════════════════════════════
-- Segurança do banco do Chegô — ETAPA 1 (24/11/2026)
-- Rodar no Supabase › SQL Editor, DEPOIS que a versão nova do app estiver no ar.
-- Para desfazer: supabase/seguranca-2026-11-24-VOLTAR.sql
--
-- O que muda para quem está de fora (chave pública "anon") e para cliente logado
-- ("authenticated"). O servidor do app usa a service role e não é afetado.
--   1. Ninguém de fora grava mais nada direto no banco (só o chat do pedido).
--   2. Somem colunas sensíveis: senha, CPF, Pix, banco, tokens, Asaas, certificado.
--   3. Fecham de vez: saques, ajustes, cupons, acessos, clientes avulsos, tabela de frete.
--   4. Cliente logado só vê e edita o PRÓPRIO cadastro.
--   5. Configurações: só a linha que o app do motoboy usa.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- 0. Backup do estado atual (regras e permissões), usado pelo arquivo de VOLTAR ----------
create table if not exists public._seg_backup_policies as
  select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies where schemaname = 'public';
create table if not exists public._seg_backup_rls as
  select c.relname as tabela, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';
revoke all on public._seg_backup_policies, public._seg_backup_rls from anon, authenticated;

-- 1. Gravação: só o servidor grava --------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
grant insert on public.pedido_chat to anon, authenticated;   -- chat do cliente na tela do pedido

-- 2. Tabelas que o navegador não usa: fecha a leitura --------------------------------------
revoke select on public.saques, public.saldo_ajustes, public.cupons, public.acessos_app,
  public.clientes_avulsos, public.tabela_frete from anon, authenticated;

-- 3. Colunas sensíveis --------------------------------------------------------------------
revoke select on public.lojas from anon, authenticated;
grant select (id,nome,descricao,categoria,logo_url,endereco,telefone,taxa_entrega,tempo_min,tempo_max,status,aberto,
  comissao,criado_em,nota_media,total_avaliacoes,lat,lng,cep,numero,complemento,bairro,cidade,estado,horarios,logradouro,
  aceita_retirada,valor_minimo,plano,fiscal_ativo,entrega_avulsa_liberada,aceita_entrega,destaque,cidades_atendidas,
  ordem_home,participacao_entrega,primeiro_acesso,modalidade_assinatura,contrato_assinado)
  on public.lojas to anon, authenticated;

revoke select on public.motoboys from anon, authenticated;
grant select (id,nome,telefone,veiculo,placa,status,disponivel,criado_em,lat,lng,nota_media,total_avaliacoes,
  disponivel_atualizado_em,conta_teste,limite_pedidos_simultaneos,limite_pedidos,raio_km,cidade_fixa,foto,recusas,
  contrato_assinado)
  on public.motoboys to anon, authenticated;

revoke select on public.pedidos from anon, authenticated;
grant select (id,codigo,loja_id,motoboy_id,status,forma_pagamento,subtotal,taxa_entrega,total,endereco_entrega,
  lat_entrega,lng_entrega,observacao,criado_em,atualizado_em,cliente_id,desconto,cupom_codigo,loja_lat,loja_lng,
  coletado_em,entregue_em,nome_cliente,telefone_cliente,tipo,pix_copia_cola,aceito_em,pronto_em,cancelado_por,
  motivo_cancelamento,motivo_outro,tipo_cartao_entrega,troco_para,frete_gratis,frete_absorvido_por,
  frete_absorvido_editado_por,frete_absorvido_editado_em,zona_rural,previsao_entrega_em,imprevisto_em,
  prioridade_motoboy,distancia_km,cancelado_em,forma_pagamento_2,valor_pagamento_1,valor_pagamento_2,
  pagamentos_online_confirmados,taxa_dinamica)
  on public.pedidos to anon, authenticated;

-- 4. Clientes: cada um só o seu -----------------------------------------------------------
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'clientes' loop
    execute format('drop policy %I on public.clientes', r.policyname);
  end loop;
end $$;
alter table public.clientes enable row level security;
revoke all on public.clientes from anon, authenticated;
grant select on public.clientes to authenticated;
grant insert (id,nome,telefone,email,cpf,endereco_rua,endereco_numero,endereco_bairro,endereco_complemento,endereco_cep,endereco_cidade)
  on public.clientes to authenticated;
grant update (nome,telefone,email,cpf,endereco_rua,endereco_numero,endereco_bairro,endereco_complemento,endereco_cep,endereco_cidade)
  on public.clientes to authenticated;
create policy cliente_ve_o_seu     on public.clientes for select to authenticated using (id = auth.uid());
create policy cliente_cria_o_seu   on public.clientes for insert to authenticated with check (id = auth.uid());
create policy cliente_edita_o_seu  on public.clientes for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Nome das avaliações (só o primeiro nome) para a tela da loja
create or replace view public.clientes_nomes as
  select id, split_part(nome, ' ', 1) as nome from public.clientes;
grant select on public.clientes_nomes to anon, authenticated;

-- 5. Configurações: só o limite de pedidos do motoboy -------------------------------------
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'configuracoes' loop
    execute format('drop policy %I on public.configuracoes', r.policyname);
  end loop;
end $$;
alter table public.configuracoes enable row level security;
create policy config_publica on public.configuracoes for select to anon, authenticated
  using (chave in ('max_pedidos_motoboy'));

commit;

-- Conferência (deve mostrar as tabelas e quem pode o quê) ----------------------------------
select table_name, string_agg(distinct privilege_type, ', ') as pode
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon'
group by table_name order by table_name;
