-- ============================================
-- ARAGO DELIVERY — Schema do banco de dados
-- Execute no Supabase SQL Editor
-- ============================================

-- Extensão para UUID
create extension if not exists "uuid-ossp";

-- ── LOJAS ──────────────────────────────────────
create table lojas (
  id            uuid primary key default uuid_generate_v4(),
  nome          text not null,
  descricao     text default '',
  categoria     text default 'Restaurante',
  logo_url      text default '',
  endereco      text not null,
  telefone      text not null,
  taxa_entrega  numeric(8,2) default 5.00,
  tempo_min     integer default 30,
  tempo_max     integer default 60,
  status        text default 'pendente',   -- pendente | ativo | suspenso
  aberto        boolean default false,
  comissao      numeric(5,2) default 10.0,
  criado_em     timestamptz default now()
);

-- ── MOTOBOYS ───────────────────────────────────
create table motoboys (
  id            uuid primary key default uuid_generate_v4(),
  nome          text not null,
  email         text default '',
  telefone      text not null,
  cpf           text not null,
  veiculo       text default 'Moto',
  placa         text not null,
  status        text default 'pendente',   -- pendente | ativo | suspenso | offline
  disponivel    boolean default false,
  criado_em     timestamptz default now()
);

-- ── CATEGORIAS DE PRODUTOS ─────────────────────
create table categorias_produto (
  id        uuid primary key default uuid_generate_v4(),
  loja_id   uuid references lojas(id) on delete cascade,
  nome      text not null,
  ordem     integer default 0
);

-- ── PRODUTOS ───────────────────────────────────
create table produtos (
  id            uuid primary key default uuid_generate_v4(),
  loja_id       uuid references lojas(id) on delete cascade,
  categoria_id  uuid references categorias_produto(id) on delete set null,
  nome          text not null,
  descricao     text default '',
  preco         numeric(8,2) not null,
  foto_url      text default '',
  disponivel    boolean default true,
  criado_em     timestamptz default now()
);

-- ── PEDIDOS ────────────────────────────────────
create table pedidos (
  id                uuid primary key default uuid_generate_v4(),
  codigo            text not null,
  loja_id           uuid references lojas(id),
  motoboy_id        uuid references motoboys(id),
  status            text default 'pendente',
  forma_pagamento   text not null,           -- pix | cartao | dinheiro | maquininha
  subtotal          numeric(10,2) not null,
  taxa_entrega      numeric(8,2) not null,
  total             numeric(10,2) not null,
  endereco_entrega  text not null,
  lat_entrega       numeric,
  lng_entrega       numeric,
  observacao        text default '',
  criado_em         timestamptz default now(),
  atualizado_em     timestamptz default now()
);

-- ── ITENS DO PEDIDO ────────────────────────────
create table itens_pedido (
  id          uuid primary key default uuid_generate_v4(),
  pedido_id   uuid references pedidos(id) on delete cascade,
  produto_id  uuid references produtos(id),
  nome        text not null,
  preco       numeric(8,2) not null,
  quantidade  integer not null default 1,
  observacao  text default ''
);

-- ── RASTREIO EM TEMPO REAL ─────────────────────
create table rastreio (
  id           uuid primary key default uuid_generate_v4(),
  pedido_id    uuid references pedidos(id) on delete cascade,
  motoboy_id   uuid references motoboys(id),
  lat          numeric not null,
  lng          numeric not null,
  atualizado_em timestamptz default now()
);

-- ── CLIENTES ───────────────────────────────────
create table clientes (
  id        uuid primary key default uuid_generate_v4(),
  nome      text not null,
  telefone  text not null,
  email     text default '',
  criado_em timestamptz default now()
);

-- ── ENDEREÇOS DOS CLIENTES ─────────────────────
create table enderecos_cliente (
  id           uuid primary key default uuid_generate_v4(),
  cliente_id   uuid references clientes(id) on delete cascade,
  label        text default 'Casa',
  endereco     text not null,
  complemento  text default '',
  lat          numeric,
  lng          numeric
);

-- ── POLÍTICAS DE ACESSO PÚBLICO ────────────────
-- Permite que o app leia e escreva sem autenticação (simplificado para MVP)
alter table lojas           enable row level security;
alter table motoboys        enable row level security;
alter table categorias_produto enable row level security;
alter table produtos        enable row level security;
alter table pedidos         enable row level security;
alter table itens_pedido    enable row level security;
alter table rastreio        enable row level security;
alter table clientes        enable row level security;
alter table enderecos_cliente enable row level security;

-- Policies: acesso total via anon key (MVP — restringir após adicionar auth)
create policy "allow_all" on lojas            for all using (true) with check (true);
create policy "allow_all" on motoboys         for all using (true) with check (true);
create policy "allow_all" on categorias_produto for all using (true) with check (true);
create policy "allow_all" on produtos         for all using (true) with check (true);
create policy "allow_all" on pedidos          for all using (true) with check (true);
create policy "allow_all" on itens_pedido     for all using (true) with check (true);
create policy "allow_all" on rastreio         for all using (true) with check (true);
create policy "allow_all" on clientes         for all using (true) with check (true);
create policy "allow_all" on enderecos_cliente for all using (true) with check (true);
