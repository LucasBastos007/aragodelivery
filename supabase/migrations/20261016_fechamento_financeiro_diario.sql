-- Fechamento financeiro diário (autorizado pelo Lucas em 16/10/2026) — somente adições.

-- Livro-caixa de movimentos manuais e importados (retiradas, adiantamentos, bônus, Pix,
-- repasses, dinheiro entregue ao caixa, conferências). Nunca é alterado pelo fechamento.
create table if not exists public.movimentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  beneficiario_tipo text not null check (beneficiario_tipo in ('motoboy','loja','outro')),
  motoboy_id uuid references public.motoboys(id),
  loja_id uuid references public.lojas(id),
  destinatario_nome text,
  tipo text not null check (tipo in (
    'retirada_dinheiro','adiantamento','bonus','desconto','pagamento','repasse',
    'entrega_caixa','pagamento_autorizado_dinheiro','conferencia_caixa',
    'ajuste_credito','ajuste_debito','transferencia_interna','nao_identificado')),
  valor numeric(12,2) not null check (valor >= 0),
  forma text check (forma in ('dinheiro','pix','outro')),
  ocorrido_em timestamptz not null default now(),
  responsavel text,
  motivo text not null,
  pedido_id uuid references public.pedidos(id),
  origem text not null default 'manual' check (origem in ('manual','asaas')),
  externo_id text unique,
  criado_por text,
  criado_em timestamptz not null default now(),
  cancelado_em timestamptz,
  cancelado_por text,
  cancelado_motivo text,
  check (beneficiario_tipo <> 'motoboy' or motoboy_id is not null),
  check (beneficiario_tipo <> 'loja' or loja_id is not null)
);
create index if not exists movimentos_financeiros_ocorrido_idx on public.movimentos_financeiros (ocorrido_em);
create index if not exists movimentos_financeiros_motoboy_idx on public.movimentos_financeiros (motoboy_id, ocorrido_em);
create index if not exists movimentos_financeiros_loja_idx on public.movimentos_financeiros (loja_id, ocorrido_em);
alter table public.movimentos_financeiros enable row level security;

-- Histórico / trava de envio do fechamento diário
create table if not exists public.fechamentos_diarios (
  data date primary key,
  status text not null check (status in ('processando','enviado','erro','teste')),
  corte_em timestamptz,
  ultimo_movimento_em timestamptz,
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  tentativas integer not null default 0,
  erro text,
  email_id text,
  destinatarios text[],
  totais jsonb,
  pedidos_snapshot jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.fechamentos_diarios enable row level security;

-- R$ por entrega que a loja assume (Armazém Gastrobar e Petiscaria: R$ 1,00 em toda entrega)
alter table public.lojas add column if not exists participacao_entrega numeric(10,2) not null default 0;

-- Ajuda de custo semanal recorrente do motoboy (lançada no dia da semana indicado; 5 = sexta)
alter table public.motoboys add column if not exists ajuda_custo_semanal numeric(10,2) not null default 0;
alter table public.motoboys add column if not exists ajuda_custo_dia_semana smallint not null default 5;
