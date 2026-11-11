-- Escala dos motoboys (03/11/2026): turnos por dia, editados pelo admin e vistos pelos motoboys.
create table public.escala_motoboys (
  id bigserial primary key,
  motoboy_id uuid not null references public.motoboys(id) on delete cascade,
  data date not null,
  inicio time not null,
  fim time not null,            -- fim menor que o início = turno que vira a noite
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on public.escala_motoboys (data);
create index on public.escala_motoboys (motoboy_id, data);
alter table public.escala_motoboys enable row level security;
