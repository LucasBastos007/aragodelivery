-- ============================================================
-- Migração: Reembolsos + Configurações do sistema
-- Execute no Supabase SQL Editor
-- ============================================================

-- ── REEMBOLSOS ──────────────────────────────────────────────
create table if not exists reembolsos (
  id                uuid primary key default uuid_generate_v4(),
  pedido_id         uuid references pedidos(id) on delete cascade,
  solicitado_em     timestamptz default now(),
  solicitado_por    text not null,    -- 'cliente' | 'loja' | 'admin'
  motivo            text not null,    -- categoria do motivo
  descricao         text default '',  -- detalhes opcionais
  foto_url          text default '',
  status            text default 'solicitado',
  -- solicitado | aprovado | processando | concluido | negado
  aprovado_por      text,             -- 'admin' | 'loja'
  aprovado_em       timestamptz,
  valor_solicitado  numeric(10,2),    -- null = valor total do pedido
  valor_aprovado    numeric(10,2),    -- null = valor total aprovado
  asaas_refund_id   text,             -- ID do estorno no Asaas
  negado_motivo     text,
  atualizado_em     timestamptz default now()
);

alter table reembolsos enable row level security;
create policy "allow_all" on reembolsos for all using (true) with check (true);

-- ── CONFIGURAÇÕES DO SISTEMA ────────────────────────────────
create table if not exists configuracoes (
  chave         text primary key,
  valor         text not null,
  atualizado_em timestamptz default now()
);

alter table configuracoes enable row level security;
create policy "allow_all" on configuracoes for all using (true) with check (true);

-- Valores padrão
insert into configuracoes (chave, valor) values
  ('max_pedidos_motoboy', '2'),
  ('raio_compatibilidade_km', '5')
on conflict (chave) do nothing;
