-- Contador "Agora no app" do painel admin (31/10/2026). Uma linha por celular, sobrescrita a cada aviso.
create table if not exists public.online_agora (
  visitante text primary key,
  tela      text,
  visto_em  timestamptz not null default now()
);
create index if not exists online_agora_visto_em_idx on public.online_agora (visto_em);
alter table public.online_agora enable row level security;
